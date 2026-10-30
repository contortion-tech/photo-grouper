import { strFromU8, strToU8, unzipSync, Zip, ZipPassThrough } from 'fflate';

export type BundleRatio = 'original' | 'square' | 'portrait' | 'tall' | 'landscape';
export interface BundleCrop { fit: 'cover' | 'contain'; zoom: number; x: number; y: number }
export interface BundleItem { id: string; file: File; crop: BundleCrop }
export interface BundleDraft {
  version: 1; id: string; name: string; items: BundleItem[]; ratio: BundleRatio;
  width: 1080 | 2160; background: string; updatedAt: number;
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
const DB_NAME = 'photo-grouper-bundles-v1';
const STORE = 'bundles';
function fail(message: string): never { throw new Error(message); }
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const validId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
const validName = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 80 && !/[\u0000-\u001f]/.test(v);
const validFileName = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 255 && !/[\\/\u0000-\u001f]/.test(v) && v !== '.' && v !== '..';
const validMime = (v: unknown): v is string => typeof v === 'string' && v.length <= 100 && !/[\u0000-\u001f\u007f]/.test(v);
const imageName = (name: string) => /\.(jpe?g|png|webp|gif|avif|bmp|svg|heic|heif|tiff?)$/i.test(name);
function validateCrop(value: unknown): BundleCrop {
  if (!object(value) || !['cover', 'contain'].includes(String(value.fit)) || !finite(value.zoom) || value.zoom < 1 || value.zoom > 3 || !finite(value.x) || value.x < 0 || value.x > 1 || !finite(value.y) || value.y < 0 || value.y > 1) fail('Invalid bundle crop settings.');
  return { fit: value.fit as BundleCrop['fit'], zoom: value.zoom as number, x: value.x as number, y: value.y as number };
}
export function safeBundleName(name: string) {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/\.{2,}/g, '.').replace(/^[.\-]+|[.\-]+$/g, '').slice(0, 80) || 'post-bundle';
}
export function validateBundle(value: unknown): BundleDraft {
  if (!object(value) || value.version !== 1 || !validId(value.id) || !validName(value.name) || !Array.isArray(value.items) || value.items.length < 1 || value.items.length > 20 || !BUNDLE_RATIOS.some((r) => r.id === value.ratio) || (value.width !== 1080 && value.width !== 2160) || !/^#[0-9a-fA-F]{6}$/.test(String(value.background)) || !finite(value.updatedAt) || value.updatedAt < 0) fail('Invalid or incomplete bundle.');
  const ids = new Set<string>();
  let bytes = 0;
  const items = value.items.map((item: unknown) => {
    if (!object(item) || !validId(item.id) || ids.has(item.id) || !(item.file instanceof File) || !validFileName(item.file.name) || !imageName(item.file.name) || !validMime(item.file.type) || !finite(item.file.lastModified) || item.file.size <= 0 || item.file.size > MAX_FILE) fail('Bundle contains an invalid, duplicate or oversized image.');
    ids.add(item.id); bytes += item.file.size;
    return { id: item.id, file: item.file, crop: validateCrop(item.crop) };
  });
  if (bytes > MAX_TOTAL) fail('Bundle exceeds the 500 MiB source limit.');
  return { version: 1, id: value.id, name: value.name.trim(), items, ratio: value.ratio as BundleRatio, width: value.width as 1080 | 2160, background: value.background as string, updatedAt: value.updatedAt };
}
export function createBundle(files: File[]): BundleDraft {
  return validateBundle({ version: 1, id: crypto.randomUUID(), name: 'Untitled bundle', items: files.map((file) => ({ id: crypto.randomUUID(), file, crop: { ...DEFAULT_BUNDLE_CROP } })), ratio: 'original', width: 2160, background: '#ffffff', updatedAt: Date.now() });
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
interface ManifestItem { id: string; originalPath: string; imagePath: string; fileName: string; type: string; lastModified: number; size: number; sha256: string; crop: BundleCrop }
interface BundleManifest { format: 'photo-grouper-bundle'; version: 1; id: string; name: string; ratio: BundleRatio; width: 1080 | 2160; background: string; updatedAt: number; postingCopies: boolean; items: ManifestItem[] }
async function sha256(bytes: Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)), (v) => v.toString(16).padStart(2, '0')).join(''); }
async function contactSheet(draft: BundleDraft, postingBlobs?: Blob[]) {
  const columns = 4, cell = 240, rows = Math.ceil(draft.items.length / columns);
  const canvas = document.createElement('canvas'); canvas.width = columns * cell; canvas.height = rows * (cell + 30) + 50;
  const ctx = canvas.getContext('2d'); if (!ctx) fail('Canvas unavailable.');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#111111'; ctx.font = '20px sans-serif'; ctx.fillText(draft.name, 12, 30, canvas.width - 24);
  for (const [index, item] of draft.items.entries()) {
    const blob = postingBlobs?.[index] ?? item.file;
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

export async function encodeBundleArchive(input: BundleDraft, postingBlobs?: Blob[], sheet?: Blob, onProgress?: (text: string) => void): Promise<Blob> {
  const draft = validateBundle(input);
  const posting = !!postingBlobs;
  if (posting && (draft.ratio === 'original' || postingBlobs.length !== draft.items.length)) fail('Posting copies do not match the bundle.');
  const chunks: BlobPart[] = [];
  let zipError: Error | null = null;
  const zip = new Zip((error, data) => { if (error) zipError = error; else chunks.push(new Uint8Array(data).buffer); });
  const add = (path: string, bytes: Uint8Array) => {
    const stream = new ZipPassThrough(path); zip.add(stream); stream.push(bytes, true);
    if (zipError) throw zipError;
  };
  const manifest: BundleManifest = { format: 'photo-grouper-bundle', version: 1, id: draft.id, name: draft.name, ratio: draft.ratio, width: draft.width, background: draft.background, updatedAt: draft.updatedAt, postingCopies: posting, items: [] };
  for (const [index, item] of draft.items.entries()) {
    onProgress?.(`Packing ${index + 1}/${draft.items.length}`);
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
    manifest.items.push({ id: item.id, originalPath, imagePath, fileName: item.file.name, type: item.file.type, lastModified: item.file.lastModified, size: item.file.size, sha256: hash, crop: item.crop });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  add('bundle.json', strToU8(JSON.stringify(manifest, null, 2)));
  if (sheet) add('contact-sheet.jpg', new Uint8Array(await sheet.arrayBuffer()));
  zip.end();
  if (zipError) throw zipError;
  return new Blob(chunks, { type: 'application/zip' });
}
export async function exportBundle(input: BundleDraft, includePosting: boolean, onProgress?: (text: string) => void): Promise<Blob> {
  const draft = validateBundle(input), posting = includePosting && draft.ratio !== 'original';
  const copies: Blob[] | undefined = posting ? [] : undefined;
  if (copies) for (const [index, item] of draft.items.entries()) {
    onProgress?.(`Rendering ${index + 1}/${draft.items.length}`);
    copies.push(await renderBundleImage(item.file, draft.ratio, draft.width, item.crop, draft.background));
  }
  onProgress?.('Making contact sheet');
  const sheet = await contactSheet(draft, copies);
  return encodeBundleArchive(draft, copies, sheet, onProgress);
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
    if (!/^(bundle\.json|contact-sheet\.jpg|(?:images|originals)\/[a-zA-Z0-9_.-]+)$/.test(name) || name.includes('..') || names.has(name)) fail('ZIP contains unsafe or duplicate paths.');
    if (size > (name === 'bundle.json' ? 1024 * 1024 : name === 'contact-sheet.jpg' ? 10 * 1024 * 1024 : MAX_FILE)) fail('ZIP entry exceeds its size limit.');
    if (view.getUint32(local, true) !== 0x04034b50 || view.getUint16(local + 8, true) !== method || view.getUint16(local + 6, true) !== flags) fail('ZIP local entry does not match directory.');
    const localNameLength = view.getUint16(local + 26, true), localExtra = view.getUint16(local + 28, true), dataStart = local + 30 + localNameLength + localExtra;
    if (dataStart + size > start || strFromU8(bytes.subarray(local + 30, local + 30 + localNameLength)) !== name) fail('Invalid ZIP entry bounds.');
    total += size; if (total > MAX_ARCHIVE) fail('ZIP exceeds its total size limit.');
    names.add(name); entries.push({ name, size, crc: view.getUint32(cursor + 16, true) });
    cursor += 46 + nameLength + extra + comment;
  }
  if (cursor !== end || !names.has('bundle.json') || !names.has('contact-sheet.jpg')) fail('Bundle manifest is missing.');
  return entries;
}
function parseManifest(value: unknown): BundleManifest {
  if (!object(value) || value.format !== 'photo-grouper-bundle' || value.version !== 1 || !validId(value.id) || !validName(value.name) || !BUNDLE_RATIOS.some((r) => r.id === value.ratio) || (value.width !== 1080 && value.width !== 2160) || !/^#[0-9a-fA-F]{6}$/.test(String(value.background)) || !finite(value.updatedAt) || value.updatedAt < 0 || typeof value.postingCopies !== 'boolean' || !Array.isArray(value.items) || !value.items.length || value.items.length > 20) fail('Invalid bundle manifest.');
  const ids = new Set<string>(), originals = new Set<string>(), images = new Set<string>();
  const items: ManifestItem[] = value.items.map((item: unknown) => {
    if (!object(item) || !validId(item.id) || ids.has(item.id) || !validFileName(item.fileName) || !imageName(item.fileName) || typeof item.originalPath !== 'string' || typeof item.imagePath !== 'string' || !/^(images|originals)\/[a-zA-Z0-9_.-]+$/.test(item.originalPath) || !/^images\/[a-zA-Z0-9_.-]+$/.test(item.imagePath) || originals.has(item.originalPath) || images.has(item.imagePath) || !validMime(item.type) || !finite(item.lastModified) || !finite(item.size) || item.size <= 0 || item.size > MAX_FILE || !Number.isInteger(item.size) || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256)) fail('Invalid bundle image manifest.');
    if (value.postingCopies ? !item.originalPath.startsWith('originals/') : item.originalPath !== item.imagePath) fail('Bundle original mapping is inconsistent.');
    ids.add(item.id); originals.add(item.originalPath); images.add(item.imagePath);
    return { id: item.id, originalPath: item.originalPath, imagePath: item.imagePath, fileName: item.fileName, type: item.type, lastModified: item.lastModified, size: item.size, sha256: item.sha256, crop: validateCrop(item.crop) };
  });
  if (items.reduce((sum, item) => sum + item.size, 0) > MAX_TOTAL || (value.postingCopies && value.ratio === 'original')) fail('Invalid bundle size or posting settings.');
  return { format: 'photo-grouper-bundle', version: 1, id: value.id, name: value.name.trim(), ratio: value.ratio as BundleRatio, width: value.width as 1080 | 2160, background: value.background as string, updatedAt: value.updatedAt, postingCopies: value.postingCopies, items };
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
  const expected = new Set(['bundle.json', ...(extracted['contact-sheet.jpg'] ? ['contact-sheet.jpg'] : []), ...manifest.items.flatMap((item) => [item.originalPath, item.imagePath])]);
  if (entries.some((entry) => !expected.has(entry.name)) || [...expected].some((name) => !extracted[name])) fail('ZIP contents do not match the bundle manifest.');
  const items: BundleItem[] = [];
  for (const item of manifest.items) {
    const data = extracted[item.originalPath];
    if (data.length !== item.size || await sha256(data) !== item.sha256) fail(`Original integrity check failed: ${item.fileName}`);
    items.push({ id: crypto.randomUUID(), file: new File([new Uint8Array(data).buffer], item.fileName, { type: item.type, lastModified: item.lastModified }), crop: item.crop });
  }
  return validateBundle({ version: 1, id: crypto.randomUUID(), name: manifest.name, items, ratio: manifest.ratio, width: manifest.width, background: manifest.background, updatedAt: Date.now() });
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
      request.onsuccess = () => { const cursor = request.result; if (!cursor) return; const value = cursor.value; if (object(value) && validId(value.id) && validName(value.name) && Array.isArray(value.items) && finite(value.updatedAt)) list.push({ id: value.id, name: value.name, count: value.items.length, updatedAt: value.updatedAt }); cursor.continue(); };
      request.onerror = () => reject(request.error || new Error('Local bundles could not be listed.'));
      tx.oncomplete = () => { db.close(); resolve(list.sort((a, b) => b.updatedAt - a.updatedAt)); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error('Local bundle read was interrupted.')); };
    } catch (error) { db.close(); reject(error); }
  });
}
