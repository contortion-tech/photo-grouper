import { strFromU8, strToU8, unzipSync, Zip, ZipPassThrough } from 'fflate';
const isVideoFile = (file: { name: string; type?: string }) => file.type?.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name);

export type BundleRatio = 'original' | 'square' | 'portrait' | 'tall' | 'landscape';
export interface BundleCrop { fit: 'cover' | 'contain'; zoom: number; x: number; y: number }
export interface BundleItem { id: string; file: File; crop: BundleCrop; caption?: string; title?: string }
export interface BundlePage { id: string; items: BundleItem[]; ratio: BundleRatio; width: 1080 | 2160; background: string }
export interface BundleDraft {
  version: 1 | 2; id: string; name: string;
  items: BundleItem[]; ratio: BundleRatio; width: 1080 | 2160; background: string;
  pages?: BundlePage[]; updatedAt: number;
}
export const DEFAULT_BUNDLE_CROP: BundleCrop = { fit: 'cover', zoom: 1, x: .5, y: .5 };
export const BUNDLE_RATIOS: Array<{ id: BundleRatio; label: string; ratio: number | null }> = [
  { id: 'original', label: 'Original proportions', ratio: null },
  { id: 'square', label: 'Square · 1:1', ratio: 1 },
  { id: 'portrait', label: 'Portrait · 4:5', ratio: 4 / 5 },
  { id: 'tall', label: 'Tall portrait · 3:4', ratio: 3 / 4 },
  { id: 'landscape', label: 'Landscape · 1.91:1', ratio: 1.91 },
];
const MAX_FILE = 25 * 1024 * 1024;
const MAX_TOTAL = 20 * MAX_FILE;
const MAX_ARCHIVE = MAX_TOTAL * 2 + 12 * 1024 * 1024;
const MAX_PAGE_ITEMS = 9;
const MAX_PAGES = 20;
const DB_NAME = 'photo-grouper-bundles-v1';
const STORE = 'bundles';
function fail(message: string): never { throw new Error(message); }
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const validId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
const validName = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 80 && !/[\u0000-\u001f]/.test(v);
const validFileName = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 255 && !/[\\/\u0000-\u001f]/.test(v) && v !== '.' && v !== '..';
const validMime = (v: unknown): v is string => typeof v === 'string' && v.length <= 100 && !/[\u0000-\u001f\u007f]/.test(v);
const imageName = (name: string) => /\.(jpe?g|png|webp|gif|avif|bmp|svg|heic|heif|tiff?|mp4|mov|webm|m4v)$/i.test(name);
function validateCrop(value: unknown): BundleCrop {
  if (!object(value) || !['cover', 'contain'].includes(String(value.fit)) || !finite(value.zoom) || value.zoom < 1 || value.zoom > 3 || !finite(value.x) || value.x < 0 || value.x > 1 || !finite(value.y) || value.y < 0 || value.y > 1) fail('Invalid bundle crop settings.');
  return { fit: value.fit as BundleCrop['fit'], zoom: value.zoom as number, x: value.x as number, y: value.y as number };
}
function validatePage(value: unknown, ids: Set<string>, budget: { bytes: number }): BundlePage {
  if (!object(value) || !validId(value.id) || ids.has(value.id) || !BUNDLE_RATIOS.some((r) => r.id === value.ratio) || (value.width !== 1080 && value.width !== 2160) || !/^#[0-9a-fA-F]{6}$/.test(String(value.background)) || !Array.isArray(value.items) || value.items.length < 1 || value.items.length > MAX_PAGE_ITEMS) fail('Invalid bundle page.');
  ids.add(value.id);
  const itemIds = new Set<string>();
  const items = value.items.map((item: unknown) => {
    if (!object(item) || !validId(item.id) || itemIds.has(item.id) || !(item.file instanceof File) || !validFileName(item.file.name) || !imageName(item.file.name) || !validMime(item.file.type) || !finite(item.file.lastModified) || item.file.size <= 0 || item.file.size > (isVideoFile(item.file) ? 500 * 1024 * 1024 : MAX_FILE)) fail('Bundle contains an invalid, duplicate or oversized image.');
    itemIds.add(item.id); budget.bytes += item.file.size;
    const caption = typeof (item as any).caption === 'string' && (item as any).caption.length <= 4000 ? (item as any).caption : undefined;
    const title = typeof (item as any).title === 'string' && (item as any).title.length <= 120 ? (item as any).title : undefined;
    return { id: item.id, file: item.file, crop: validateCrop(item.crop), caption, title };
  });
  return { id: value.id as string, items, ratio: value.ratio as BundleRatio, width: value.width as 1080 | 2160, background: value.background as string };
}
export function safeBundleName(name: string) {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/\.{2,}/g, '.').replace(/^[.\-]+|[.\-]+$/g, '').slice(0, 80) || 'post-bundle';
}
/** Converts a legacy v1 flat bundle into a v2 multi-page bundle, one page per up-to-9 photos. */
function migrateV1(value: Record<string, unknown>): BundleDraft {
  const ids = new Set<string>();
  const budget = { bytes: 0 };
  const items = (value.items as unknown[]).map((item: unknown) => {
    if (!object(item) || !validId(item.id) || ids.has(item.id) || !(item.file instanceof File) || !validFileName(item.file.name) || !imageName(item.file.name) || !validMime(item.file.type) || !finite(item.file.lastModified) || item.file.size <= 0 || item.file.size > MAX_FILE) fail('Bundle contains an invalid, duplicate or oversized image.');
    ids.add(item.id); budget.bytes += item.file.size;
    return { id: item.id, file: item.file, crop: validateCrop(item.crop) };
  });
  if (budget.bytes > MAX_TOTAL) fail('Bundle exceeds the 500 MiB source limit.');
  const pages: BundlePage[] = [];
  const ratio = value.ratio as BundleRatio, width = value.width as 1080 | 2160, background = value.background as string;
  for (let index = 0; index < items.length; index += MAX_PAGE_ITEMS) {
    pages.push({ id: crypto.randomUUID(), items: items.slice(index, index + MAX_PAGE_ITEMS), ratio, width, background });
  }
  return { version: 2, id: value.id as string, name: (value.name as string).trim(), items, ratio, width, background, pages, updatedAt: value.updatedAt as number };
}
export function validateBundle(value: unknown): BundleDraft {
  if (!object(value) || !validId(value.id) || !validName(value.name) || !finite(value.updatedAt) || value.updatedAt < 0) fail('Invalid or incomplete bundle.');
  if (value.version === 1) {
    if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 20) fail('Invalid or incomplete bundle.');
    return migrateV1(value);
  }
  if (value.version !== 2 || !Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > MAX_PAGES) fail('Invalid or incomplete bundle.');
  const ids = new Set<string>();
  const budget = { bytes: 0 };
  const pages = value.pages.map((page: unknown) => validatePage(page, ids, budget));
  if (budget.bytes > MAX_TOTAL) fail('Bundle exceeds the 500 MiB source limit.');
  const items = pages[0].items, ratio = pages[0].ratio, width = pages[0].width, background = pages[0].background;
  return { version: 2, id: value.id, name: value.name.trim(), items, ratio, width, background, pages, updatedAt: value.updatedAt };
}
export function createBundle(files: File[]): BundleDraft {
  const raw = validateBundle({ version: 1, id: crypto.randomUUID(), name: 'Untitled bundle', items: files.map((file) => ({ id: crypto.randomUUID(), file, crop: { ...DEFAULT_BUNDLE_CROP } })), ratio: 'original', width: 2160, background: '#ffffff', updatedAt: Date.now() });
  return raw;
}
export function postingPlacement(iw: number, ih: number, w: number, h: number, crop: BundleCrop) {
  if (![iw, ih, w, h].every((v) => finite(v) && v > 0)) fail('Invalid image dimensions.');
  const clean = validateCrop(crop);
  const scale = clean.fit === 'contain' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih) * clean.zoom;
  const width = iw * scale, height = ih * scale;
  return { x: (w - width) * (clean.fit === 'contain' ? .5 : clean.x) || 0, y: (h - height) * (clean.fit === 'contain' ? .5 : clean.y) || 0, width, height };
}
async function imageFor(file: Blob) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    image.src = url;
    await Promise.race([image.decode(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Image decoding timed out.')), 15000); })]);
    if (!image.naturalWidth || !image.naturalHeight) fail('Image has no dimensions.');
    return { image, release: () => { image.src = ''; URL.revokeObjectURL(url); } };
  } catch (error) { image.src = ''; URL.revokeObjectURL(url); throw error; }
  finally { if (timer) clearTimeout(timer); }
}
async function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Image encoding timed out.')), 15000);
    canvas.toBlob((blob) => { clearTimeout(timer); if (blob) resolve(blob); else reject(new Error('Image encoding failed.')); }, 'image/jpeg', .95);
  });
}
export async function renderBundleImage(file: File, ratio: BundleRatio, width: number, crop: BundleCrop, background: string): Promise<Blob> {
  if (isVideoFile(file)) return file;
  const value = BUNDLE_RATIOS.find((r) => r.id === ratio)?.ratio;
  if (!value) return file;
  if (![1080, 2160].includes(width) || !/^#[0-9a-fA-F]{6}$/.test(background)) fail('Invalid posting image settings.');
  const source = await imageFor(file);
  try {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = Math.round(width / value);
    const ctx = canvas.getContext('2d'); if (!ctx) fail('Canvas unavailable.');
    ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const placement = postingPlacement(source.image.naturalWidth, source.image.naturalHeight, canvas.width, canvas.height, crop);
    ctx.drawImage(source.image, placement.x, placement.y, placement.width, placement.height);
    return await canvasBlob(canvas);
  } finally { source.release(); }
}
/** Flattens a v2 bundle into the legacy v1 shape for archive encoding. */
export function flattenBundle(draft: BundleDraft): Required<Pick<BundleDraft, 'items' | 'ratio' | 'width' | 'background'>> {
  const items: BundleItem[] = [];
  let ratio: BundleRatio = 'original'; let width: 1080 | 2160 = 2160; let background = '#ffffff';
  for (const page of draft.pages ?? []) {
    items.push(...page.items); ratio = page.ratio; width = page.width; background = page.background;
  }
  return { items, ratio, width, background };
}
interface ManifestItem { id: string; originalPath: string; imagePath: string; fileName: string; type: string; lastModified: number; size: number; sha256: string; crop: BundleCrop; caption?: string; title?: string }
interface PageManifest { id: string; ratio: BundleRatio; width: 1080 | 2160; background: string; items: ManifestItem[] }
interface BundleManifest { format: 'photo-grouper-bundle'; version: number; id: string; name: string; updatedAt: number; postingCopies: boolean; pages: PageManifest[] }
async function sha256(bytes: Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)), (v) => v.toString(16).padStart(2, '0')).join(''); }
async function contactSheet(items: BundleItem[], postingBlobs?: Blob[]) {
  const columns = 4, cell = 240, rows = Math.ceil(items.length / columns);
  const canvas = document.createElement('canvas'); canvas.width = columns * cell; canvas.height = rows * (cell + 30) + 50;
  const ctx = canvas.getContext('2d'); if (!ctx) fail('Canvas unavailable.');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#111111'; ctx.font = '20px sans-serif'; ctx.fillText('Photo Grouper bundle', 12, 30, canvas.width - 24);
  for (const [index, item] of items.entries()) {
    const blob = postingBlobs?.[index] ?? item.file;
    if (isVideoFile(item.file)) {
      const x = (index % columns) * cell, y = Math.floor(index / columns) * (cell + 30) + 50;
      ctx.fillStyle = '#1e293b'; ctx.fillRect(x + 6, y, cell - 12, cell);
      ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('▶ VIDEO', x + cell / 2, y + cell / 2); ctx.textAlign = 'left';
      ctx.fillStyle = '#111111'; ctx.font = '14px sans-serif'; ctx.fillText(`${String(index + 1).padStart(2, '0')} · ${item.file.name}`, x + 6, y + cell + 20, cell - 12);
      continue;
    }
    const source = await imageFor(blob);
    try {
      const x = (index % columns) * cell, y = Math.floor(index / columns) * (cell + 30) + 50;
      const p = postingPlacement(source.image.naturalWidth, source.image.naturalHeight, cell - 12, cell, { ...DEFAULT_BUNDLE_CROP, fit: 'contain' });
      ctx.drawImage(source.image, x + 6 + p.x, y + p.y, p.width, p.height);
      ctx.fillStyle = '#111111'; ctx.font = '14px sans-serif'; ctx.fillText(`${String(index + 1).padStart(2, '0')} · ${item.file.name}`, x + 6, y + cell + 20, cell - 12);
    } finally { source.release(); }
  }
  return canvasBlob(canvas);
}

export async function encodeBundleArchive(input: BundleDraft, postingBlobs?: Blob[], sheets?: Blob[], onProgress?: (text: string) => void): Promise<Blob> {
  const draft = validateBundle(input);
  const flattened = flattenBundle(draft);
  const posting = !!postingBlobs;
  if (posting && (flattened.ratio === 'original' || postingBlobs.length !== flattened.items.length)) fail('Posting copies do not match the bundle.');
  const chunks: BlobPart[] = [];
  let zipError: Error | null = null;
  const zip = new Zip((error, data) => { if (error) zipError = error; else chunks.push(new Uint8Array(data).buffer); });
  const add = (path: string, bytes: Uint8Array) => {
    const stream = new ZipPassThrough(path); zip.add(stream); stream.push(bytes, true);
    if (zipError) throw zipError;
  };
  const manifest: BundleManifest = { format: 'photo-grouper-bundle', version: 2, id: draft.id, name: draft.name, updatedAt: draft.updatedAt, postingCopies: posting, pages: [] };
  let offset = 0;
  for (const page of draft.pages!) {
    const pageItems: ManifestItem[] = [];
    for (const [localIndex, item] of page.items.entries()) {
      const index = offset + localIndex;
      onProgress?.(`Packing ${index + 1}/${flattened.items.length}`);
      const prefix = String(index + 1).padStart(2, '0');
      const extension = item.file.name.match(/\.([^.]+)$/)![1].toLowerCase();
      const stem = safeBundleName(item.file.name.replace(/\.[^.]+$/, '')).slice(0, 70);
      const fileName = `${prefix}_${stem}.${extension}`;
      const imagePath = posting ? `images/${prefix}_${safeBundleName(item.file.name.replace(/\.[^.]+$/, ''))}.jpg` : `images/${fileName}`;
      const originalPath = posting ? `originals/${fileName}` : imagePath;
      const bytes = new Uint8Array(await item.file.arrayBuffer());
      const hash = await sha256(bytes);
      add(originalPath, bytes);
      if (postingBlobs) {
        if (postingBlobs[index].size > MAX_FILE) fail('Posting copy exceeds 25 MiB.');
        add(imagePath, new Uint8Array(await postingBlobs[index].arrayBuffer()));
      }
      pageItems.push({ id: item.id, originalPath, imagePath, fileName: item.file.name, type: item.file.type, lastModified: item.file.lastModified, size: item.file.size, sha256: hash, crop: item.crop, ...(item.caption ? { caption: item.caption } : {}), ...(item.title ? { title: item.title } : {}) });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    manifest.pages.push({ id: page.id, ratio: page.ratio, width: page.width, background: page.background, items: pageItems });
    offset += page.items.length;
  }
  add('bundle.json', strToU8(JSON.stringify(manifest, null, 2)));
  const hasCaptions = flattened.items.some((it) => it.caption || it.title);
  if (hasCaptions) {
    const planLines = [
      `# Launch Plan: ${draft.name}`,
      '',
      `> **Total Posts:** ${flattened.items.length}`,
      `> **Aspect Ratio:** ${flattened.ratio.toUpperCase()}`,
      `> **Generated by:** Photo Grouper Campaign Planner`,
      '',
      '---',
      ''
    ];
    flattened.items.forEach((item, idx) => {
      const prefix = String(idx + 1).padStart(2, '0');
      const isVid = isVideoFile(item.file);
      const ext = item.file.name.match(/\.([^.]+)$/)![1].toLowerCase();
      const stem = safeBundleName(item.file.name.replace(/\.[^.]+$/, '')).slice(0, 70);
      planLines.push(`### #${prefix} • ${item.title || item.file.name}`);
      planLines.push(`- **Format:** ${isVid ? 'Reel / Video' : 'Feed Photo'}`);
      planLines.push(`- **File:** \`images/${prefix}_${stem}.${ext}\``);
      planLines.push('');
      planLines.push('**Caption & Hashtags:**');
      planLines.push('```text');
      planLines.push(item.caption?.trim() || '#photography #photo');
      planLines.push('```');
      planLines.push('');
      planLines.push('---');
      planLines.push('');
    });
    add('POSTING_PLAN.md', strToU8(planLines.join('\n')));
  }
  if (sheets) for (const [index, sheet] of sheets.entries()) add(`contact-sheet-${index + 1}.jpg`, new Uint8Array(await sheet.arrayBuffer()));
  zip.end();
  if (zipError) throw zipError;
  return new Blob(chunks, { type: 'application/zip' });
}
export async function exportBundle(input: BundleDraft, includePosting: boolean, onProgress?: (text: string) => void): Promise<Blob> {
  const draft = validateBundle(input);
  const flattened = flattenBundle(draft);
  const posting = includePosting && flattened.ratio !== 'original';
  const copies: Blob[] | undefined = posting ? [] : undefined;
  const sheets: Blob[] = [];
  if (copies) {
    let index = 0;
    for (const page of draft.pages!) for (const item of page.items) {
      onProgress?.(`Rendering ${index + 1}/${flattened.items.length}`);
      copies.push(await renderBundleImage(item.file, page.ratio, page.width, item.crop, page.background));
      index += 1;
    }
  }
  onProgress?.('Making contact sheet');
  for (const page of draft.pages!) sheets.push(await contactSheet(page.items, copies));
  return encodeBundleArchive(draft, copies, sheets, onProgress);
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}
interface ZipEntry { name: string; size: number; crc: number }
function inspectZip(bytes: Uint8Array): ZipEntry[] {
  if (bytes.length < 22 || bytes.length > MAX_ARCHIVE) fail('ZIP is empty or too large.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) fail('Unsupported ZIP archive.');
  const count = view.getUint16(end + 10, true), directorySize = view.getUint32(end + 12, true), start = view.getUint32(end + 16, true);
  if (!count || count > 42 || count !== view.getUint16(end + 8, true) || start + directorySize !== end) fail('Invalid ZIP directory.');
  let cursor = start, total = 0;
  const entries: ZipEntry[] = [], names = new Set<string>();
  for (let n = 0; n < count; n++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) fail('Invalid ZIP directory entry.');
    const flags = view.getUint16(cursor + 8, true), method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true), size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true), extra = view.getUint16(cursor + 30, true), comment = view.getUint16(cursor + 32, true), local = view.getUint32(cursor + 42, true);
    if (cursor + 46 + nameLength + extra + comment > end || flags & ~(8 | 2048) || method !== 0 || compressed !== size || local + 30 > start) fail('Restore accepts only Photo Grouper app backup ZIPs with uncompressed entries.');
    const name = strFromU8(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (!/^(bundle\.json|POSTING_PLAN\.md|contact-sheet(-\d+)?\.jpg|(?:images|originals)\/[a-zA-Z0-9_.-]+)$/.test(name) || name.includes('..') || names.has(name)) fail('ZIP contains unsafe or duplicate paths.');
    if (size > (['bundle.json', 'POSTING_PLAN.md'].includes(name) ? 1024 * 1024 : name.includes('contact-sheet') ? 10 * 1024 * 1024 : MAX_FILE)) fail('ZIP entry exceeds its size limit.');
    if (view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 8, true) !== method || view.getUint16(local + 6, true) !== flags) fail('ZIP local entry does not match directory.');
    const localNameLength = view.getUint16(local + 26, true), localExtra = view.getUint16(local + 28, true), dataStart = local + 30 + localNameLength + localExtra;
    if (dataStart + size > start || strFromU8(bytes.subarray(local + 30, local + 30 + localNameLength)) !== name) fail('Invalid ZIP entry bounds.');
    total += size; if (total > MAX_ARCHIVE) fail('ZIP exceeds its total size limit.');
    names.add(name); entries.push({ name, size, crc: view.getUint32(cursor + 16, true) });
    cursor += 46 + nameLength + extra + comment;
  }
  if (cursor !== end || !names.has('bundle.json')) fail('Bundle manifest is missing.');
  return entries;
}
function parseManifest(value: unknown): BundleManifest {
  if (!object(value) || value.format !== 'photo-grouper-bundle' || !validId(value.id) || !validName(value.name) || !finite(value.updatedAt) || value.updatedAt < 0 || typeof value.postingCopies !== 'boolean' || ![1, 2].includes(Number(value.version))) fail('Invalid bundle manifest.');
  const ids = new Set<string>(), originals = new Set<string>(), images = new Set<string>();
  const readItem = (item: unknown, globalIds: Set<string>): ManifestItem => {
    const globalSet = globalIds as Set<string>;
    if (!object(item) || !validId(item.id) || globalSet.has(item.id) || !validFileName(item.fileName) || !imageName(item.fileName) || typeof item.originalPath !== 'string' || typeof item.imagePath !== 'string' || !/^(images|originals)\/[a-zA-Z0-9_.-]+$/.test(item.originalPath) || !/^images\/[a-zA-Z0-9_.-]+$/.test(item.imagePath) || originals.has(item.originalPath) || images.has(item.imagePath) || !validMime(item.type) || !finite(item.lastModified) || !finite(item.size) || item.size <= 0 || item.size > MAX_FILE || !Number.isInteger(item.size) || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) fail('Invalid bundle image manifest.');
    if (value.postingCopies ? !item.originalPath.startsWith('originals/') : item.originalPath !== item.imagePath) fail('Bundle original mapping is inconsistent.');
    globalSet.add(item.id); originals.add(item.originalPath); images.add(item.imagePath);
    const caption = typeof (item as any).caption === 'string' && (item as any).caption.length <= 4000 ? (item as any).caption : undefined;
    const title = typeof (item as any).title === 'string' && (item as any).title.length <= 120 ? (item as any).title : undefined;
    return { id: item.id, originalPath: item.originalPath, imagePath: item.imagePath, fileName: item.fileName, type: item.type, lastModified: item.lastModified, size: item.size, sha256: item.sha256, crop: validateCrop(item.crop), caption, title };
  };
  const readPage = (page: unknown, pageIds: Set<string>): PageManifest => {
    if (!object(page) || !validId(page.id) || pageIds.has(page.id) || !BUNDLE_RATIOS.some((r) => r.id === page.ratio) || (page.width !== 1080 && page.width !== 2160) || !/^#[0-9a-fA-F]{6}$/.test(String(page.background)) || !Array.isArray(page.items) || !page.items.length || page.items.length > MAX_PAGE_ITEMS) fail('Invalid bundle page manifest.');
    pageIds.add(page.id); ids.add(page.id);
    const items = (page.items as unknown[]).map((item: unknown) => readItem(item, ids));
    return { id: page.id as string, ratio: page.ratio as BundleRatio, width: page.width as 1080 | 2160, background: page.background as string, items };
  };
  let pages: PageManifest[];
  if (Number(value.version) === 1) {
    if (!Array.isArray(value.items) || !value.items.length || value.items.length > 20) fail('Invalid bundle manifest.');
    const flat = (value.items as unknown[]).map((item: unknown) => readItem(item, ids));
    pages = [{ id: crypto.randomUUID(), ratio: value.ratio as BundleRatio, width: value.width as 1080 | 2160, background: value.background as string, items: flat }];
  } else {
    if (!Array.isArray(value.pages) || !value.pages.length || value.pages.length > MAX_PAGES) fail('Invalid bundle manifest.');
    pages = (value.pages as unknown[]).map((page: unknown) => readPage(page, new Set()));
  }
  if (pages.reduce((sum, page) => sum + page.items.reduce((s, item) => s + item.size, 0), 0) > MAX_TOTAL) fail('Invalid bundle size.');
  return { format: 'photo-grouper-bundle', version: 2, id: value.id, name: value.name.trim(), updatedAt: value.updatedAt, postingCopies: value.postingCopies, pages };
}
export async function restoreBundleZip(file: File): Promise<BundleDraft> {
  if (file.size > MAX_ARCHIVE) fail('ZIP exceeds the bundle size limit.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = inspectZip(bytes);
  const extracted = unzipSync(bytes);
  for (const entry of entries) {
    const data = extracted[entry.name];
    if (!data || data.length !== entry.size || crc32(data) !== entry.crc) fail('ZIP integrity check failed.');
  }
  let json: unknown;
  try { json = JSON.parse(strFromU8(extracted['bundle.json'])); } catch { fail('Bundle manifest cannot be read.'); }
  const manifest = parseManifest(json);
  const sheets = entries.map((entry) => /^contact-sheet(-\d+)?\.jpg$/.test(entry.name) ? entry.name : null).filter((name): name is string => !!name);
  const plan = entries.some((e) => e.name === 'POSTING_PLAN.md') ? ['POSTING_PLAN.md'] : [];
  const expected = new Set(['bundle.json', ...plan, ...sheets, ...manifest.pages.flatMap((page) => page.items.flatMap((item) => [item.originalPath, item.imagePath]))]);
  if (entries.some((entry) => !expected.has(entry.name)) || [...expected].some((name) => !extracted[name])) fail('ZIP contents do not match the bundle manifest.');
  const pages: BundlePage[] = [];
  for (const page of manifest.pages) {
    const items: BundleItem[] = [];
    for (const item of page.items) {
      const data = extracted[item.originalPath];
      if (data.length !== item.size || await sha256(data) !== item.sha256) fail(`Original integrity check failed: ${item.fileName}`);
      items.push({ id: crypto.randomUUID(), file: new File([new Uint8Array(data).buffer], item.fileName, { type: item.type, lastModified: item.lastModified }), crop: item.crop, caption: item.caption, title: item.title });
    }
    pages.push({ id: crypto.randomUUID(), items, ratio: page.ratio, width: page.width, background: page.background });
  }
  return validateBundle({ version: 2, id: crypto.randomUUID(), name: manifest.name, pages, updatedAt: Date.now() });
}
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Local bundle storage is unavailable. Export a recovery ZIP instead.')); return; }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' }); };
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error || new Error('Local bundle storage could not open.'));
    request.onblocked = () => reject(new Error('Bundle storage is blocked by another tab.'));
  });
}
export async function saveBundle(input: BundleDraft): Promise<void> {
  const draft = validateBundle(input), db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || new Error('Bundle was not saved. Export a recovery ZIP.')); };
      tx.objectStore(STORE).put(draft);
    } catch (error) { db.close(); reject(error); }
  });
}
export async function loadBundle(id: string): Promise<BundleDraft> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE, 'readonly'), request = tx.objectStore(STORE).get(id);
      let result: BundleDraft | undefined;
      request.onsuccess = () => { try { result = validateBundle(request.result); } catch (error) { reject(error); } };
      request.onerror = () => reject(request.error || new Error('Local bundle could not be read.'));
      tx.oncomplete = () => { db.close(); if (result) resolve(result); else reject(new Error('Saved bundle was not found.')); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error('Local bundle read was interrupted.')); };
    } catch (error) { db.close(); reject(error); }
  });
}
export async function listBundles(): Promise<Array<{ id: string; name: string; count: number; updatedAt: number }>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE, 'readonly'), request = tx.objectStore(STORE).openCursor();
      const list: Array<{ id: string; name: string; count: number; updatedAt: number }> = [];
      request.onsuccess = () => { const cursor = request.result; if (!cursor) return; const value = cursor.value; if (object(value) && validId(value.id) && validName(value.name) && (Array.isArray(value.items) || Array.isArray(value.pages)) && finite(value.updatedAt)) { const pages = value.pages as unknown[] | undefined; const items = value.items as unknown[] | undefined; list.push({ id: value.id as string, name: value.name as string, count: (pages ?? items)?.length ?? 0, updatedAt: value.updatedAt as number }); } cursor.continue(); };
      request.onerror = () => reject(request.error || new Error('Local bundles could not be listed.'));
      tx.oncomplete = () => { db.close(); resolve(list.sort((a, b) => b.updatedAt - a.updatedAt)); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error('Local bundle read was interrupted.')); };
    } catch (error) { db.close(); reject(error); }
  });
}
