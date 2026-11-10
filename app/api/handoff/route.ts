/**
 * MJ-062 Media Triad handoff: dispatch exported collages from PhotoGrouper to
 * Upload Queue (intake folder + .upqueue.json sidecar), FileConverter Light
 * (:3301) or FrameCrop (:47823). Loopback-only; never throws uncaught errors.
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_PIXEL_PROOF = 64; // sanity cap on base64 header length
const PROBE_TIMEOUT_MS = 1500;
const POST_TIMEOUT_MS = 5000;
const HANDOFF_TARGETS = new Set(['uploadqueue', 'fileconverter', 'framecrop']);
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function intakeDirectory(): string {
  return process.env.PG_HANDOFF_INTAKE_DIR || path.join(os.homedir(), 'Desktop', 'UpQueue_Intake');
}

function fileConverterBase(): string {
  return process.env.PG_FCL_BASE || 'http://127.0.0.1:3301';
}

function frameCropBase(): string {
  return process.env.PG_FRAMECROP_BASE || 'http://127.0.0.1:47823';
}

/** Strip any path traversal and hostile characters; guarantee an image extension. */
function sanitizeFileName(raw: unknown): string {
  const base = path.basename(String(raw ?? '').replace(/\\/g, '/')).trim();
  const cleaned = base.replace(/[<>:"|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').slice(0, 120).trim().replace(/^\.+/, '');
  const withName = cleaned || 'photo-collage.png';
  return /\.[A-Za-z0-9]{2,5}$/.test(withName) ? withName : `${withName}.png`;
}

/** Decode a data URI or bare base64 payload into image bytes. */
function decodeImageDataUri(value: unknown): { buffer: Buffer; extension: string } {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('imageData is required.');
  const dataUriMatch = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(raw);
  if (dataUriMatch) {
    const extension = IMAGE_EXTENSIONS[dataUriMatch[1].toLowerCase()];
    if (!extension) throw new Error(`Unsupported image media type: ${dataUriMatch[1]}`);
    return { buffer: Buffer.from(dataUriMatch[2], 'base64'), extension };
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(raw.replace(/[\r\n\s]/g, ''))) {
    throw new Error('imageData must be a data URI or base64 string.');
  }
  return { buffer: Buffer.from(raw, 'base64'), extension: '.png' };
}

/** First non-colliding path: <stem>.<ext>, <stem>-1.<ext>, <stem>-2.<ext> … */
async function nextAvailablePath(directory: string, fileName: string): Promise<string> {
  const stem = path.basename(fileName, path.extname(fileName));
  const extension = path.extname(fileName);
  let candidate = path.join(directory, fileName);
  for (let counter = 0; await exists(candidate); counter += 1) {
    candidate = path.join(directory, `${stem}-${counter + 1}${extension}`);
  }
  return candidate;
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/** MJ-043 creator-handoff sidecar manifest (upload-queue intake contract). */
function buildSidecar(input: {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  title: string;
}): Record<string, unknown> {
  return {
    schema: 'creator-handoff',
    version: 1,
    source: 'photo-grouper',
    fileName: input.fileName,
    filePath: input.filePath,
    sizeBytes: input.sizeBytes,
    mediaType: 'image',
    title: input.title,
    exportedAt: new Date().toISOString(),
  };
}

async function loopbackFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const hostname = new URL(url).hostname;
  if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
    throw new Error('Handoff probes are loopback-only.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probeIdentity(base: string): Promise<{ online: boolean; identity?: unknown }> {
  try {
    const response = await loopbackFetch(
      new URL('/api/app-identity', base).toString(),
      { method: 'GET', headers: { accept: 'application/json' } },
      PROBE_TIMEOUT_MS,
    );
    if (!response.ok) return { online: false };
    return { online: true, identity: await response.json().catch(() => null) };
  } catch {
    return { online: false };
  }
}

function fail(error: string, status = 400): Response {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('Request body must be valid JSON.');
  }
  const target = String(body.target ?? '');
  if (!HANDOFF_TARGETS.has(target)) {
    return fail('target must be one of: uploadqueue, fileconverter, framecrop.');
  }
  let decoded: { buffer: Buffer; extension: string };
  try {
    decoded = decodeImageDataUri(body.imageData);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Invalid image payload.');
  }
  if (!decoded.buffer.length) return fail('imageData decodes to zero bytes.');
  if (decoded.buffer.length > MAX_BYTES) {
    return fail('Image exceeds the 25 MB handoff limit.', 413);
  }
  const fileName = sanitizeFileName(body.fileName || `photo-collage${decoded.extension}`);
  const title = String(body.title ?? '').trim().slice(0, 160) || 'PhotoGrouper collage';

  try {
    const directory = intakeDirectory();
    await fs.mkdir(directory, { recursive: true });
    const filePath = await nextAvailablePath(directory, fileName);
    await fs.writeFile(filePath, decoded.buffer);
    const sidecarPath = `${filePath}.upqueue.json`;
    const sidecar = buildSidecar({
      fileName: path.basename(filePath),
      filePath,
      sizeBytes: decoded.buffer.length,
      title,
    });
    await fs.writeFile(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`);

    if (target === 'uploadqueue') {
      return Response.json({ ok: true, delivered: 'uploadqueue', fileName: path.basename(filePath), filePath, sidecarPath });
    }

    if (target === 'fileconverter') {
      const probe = await probeIdentity(fileConverterBase());
      if (!probe.online) {
        return Response.json({ ok: true, staged: true, notice: 'FCL offline on :3301 — staged to intake', filePath });
      }
      let forwarded: unknown = null;
      let forwardOk = false;
      try {
        const response = await loopbackFetch(
          new URL('/api/v1/handoff', fileConverterBase()).toString(),
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              sourcePath: filePath,
              targetFormat: 'mp4',
              targetCodec: 'h264',
              source: 'photo-grouper',
              title,
            }),
          },
          POST_TIMEOUT_MS,
        );
        forwardOk = response.ok;
        forwarded = await response.json().catch(() => null);
      } catch (error) {
        forwarded = { error: error instanceof Error ? error.message : 'FCL dispatch failed' };
      }
      return Response.json({
        ok: forwardOk,
        staged: true,
        filePath,
        forwarded,
        notice: forwardOk
          ? 'Dispatched to File Converter Light!'
          : 'FCL reachable but declined the image — staged to intake for manual use',
      });
    }

    const probe = await probeIdentity(frameCropBase());
    return Response.json({
      ok: true,
      staged: true,
      filePath,
      identity: probe.identity ?? null,
      notice: probe.online
        ? 'FrameCrop online on :47823 — staged to intake'
        : 'FrameCrop offline on :47823 — staged to intake',
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Handoff failed' },
      { status: 500 },
    );
  }
}
