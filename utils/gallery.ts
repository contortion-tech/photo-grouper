export type TileShape = 'original' | 'landscape' | 'square' | 'portrait';
export interface GallerySettings {
  shape: TileShape;
  size: number;
  gap: number;
  fit: 'cover' | 'contain';
  labels: boolean;
  sort: 'name' | 'newest' | 'oldest' | 'manual';
}
export const GALLERY_SETTINGS_KEY = 'photo-grouper.gallery-view.v1';
export const DEFAULT_GALLERY_SETTINGS: GallerySettings = {
  shape: 'square', size: 160, gap: 2, fit: 'cover', labels: false, sort: 'name',
};
export interface GalleryAsset {
  id: string;
  file: File;
  path: string;
  folder: string;
  isVideo?: boolean;
}
export type Colour = [number, number, number];
export interface ImageMetadata { width: number; height: number; error?: string; edgeColour?: Colour; centreColour?: Colour }
export interface Thumbnail extends ImageMetadata { blob: Blob }

export function readGallerySettings(value: unknown): GallerySettings {
  const source = value && typeof value === 'object' ? value as Partial<GallerySettings> : {};
  const number = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(min, Math.min(max, v))) : fallback;
  return {
    shape: ['original', 'landscape', 'square', 'portrait'].includes(source.shape ?? '') ? source.shape! : 'square',
    size: number(source.size, 160, 80, 320),
    gap: number(source.gap, 2, 0, 12),
    fit: source.fit === 'contain' ? 'contain' : 'cover',
    labels: source.labels === true,
    sort: ['name', 'newest', 'oldest', 'manual'].includes(source.sort ?? '') ? source.sort! : 'name',
  };
}
export function isImageFile(file: Pick<File, 'type' | 'name'>) {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|bmp|svg|heic|heif|tiff?)$/i.test(file.name);
}
export function isVideoFile(file: Pick<File, 'type' | 'name'>) {
  return file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv|avi|wmv)$/i.test(file.name);
}
export function isMediaFile(file: Pick<File, 'type' | 'name'>) {
  return isImageFile(file) || isVideoFile(file);
}
export function appendGalleryAssets(existing: GalleryAsset[], files: File[], makeId = () => crypto.randomUUID()) {
  const known = new Set(existing.map((asset) => asset.file));
  const additions: GalleryAsset[] = [];
  for (const file of files) {
    const isVid = isVideoFile(file);
    const isImg = isImageFile(file);
    if ((!isImg && !isVid) || known.has(file)) continue;
    const maxSize = isVid ? 500 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > maxSize) continue;
    known.add(file);
    const path = file.webkitRelativePath || file.name;
    additions.push({ id: makeId(), file, path, folder: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '', isVideo: isVid });
  }
  return [...existing, ...additions];
}
export function gridGeometry(width: number, settings: GallerySettings) {
  const columns = Math.max(1, Math.floor((width + settings.gap) / (settings.size + settings.gap)));
  const cellWidth = Math.max(1, (width - settings.gap * (columns - 1)) / columns);
  const ratio = settings.shape === 'landscape' ? 4 / 3 : settings.shape === 'portrait' ? 3 / 4 : 1;
  return { columns, cellWidth, cellHeight: cellWidth / ratio, rowHeight: cellWidth / ratio + settings.gap };
}
export function toggleSelection(ids: string[], orderedIds: string[], id: string, anchor: string | null, range: boolean, max: number) {
  const position = orderedIds.indexOf(id);
  const anchorPosition = anchor ? orderedIds.indexOf(anchor) : -1;
  if (range && position >= 0 && anchorPosition >= 0) {
    const batch = orderedIds.slice(Math.min(position, anchorPosition), Math.max(position, anchorPosition) + 1);
    return Array.from(new Set([...ids, ...batch])).slice(0, max);
  }
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id].slice(0, max);
}

// A shared decode queue bounds transient image memory; the cache stores small blobs, never originals.
export class ThumbnailPool {
  readonly metadata = new Map<string, ImageMetadata>();
  private cache = new Map<string, Thumbnail>();
  private pending = new Map<string, Promise<Thumbnail>>();
  private queue: Array<() => Promise<void>> = [];
  private active = 0;
  private disposed = false;
  constructor(private changed: () => void, readonly capacity = 128, private decode = makeThumbnail) {}
  activate() { this.disposed = false; }
  get cacheSize() { return this.cache.size; }
  request(asset: GalleryAsset): Promise<Thumbnail> {
    const cached = this.cache.get(asset.id);
    if (cached) {
      this.cache.delete(asset.id);
      this.cache.set(asset.id, cached);
      return Promise.resolve(cached);
    }
    const pending = this.pending.get(asset.id);
    if (pending) return pending;
    const promise = new Promise<Thumbnail>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          if (this.disposed) throw new Error('Gallery closed');
          const result = await this.decode(asset.file);
          if (this.disposed) throw new Error('Gallery closed');
          this.metadata.set(asset.id, { width: result.width, height: result.height, edgeColour: result.edgeColour, centreColour: result.centreColour });
          this.cache.set(asset.id, result);
          while (this.cache.size > this.capacity) this.cache.delete(this.cache.keys().next().value!);
          resolve(result);
        } catch (error) {
          if (!this.disposed) this.metadata.set(asset.id, { width: 0, height: 0, error: 'Unsupported or damaged image' });
          reject(error);
        } finally {
          this.pending.delete(asset.id);
          if (!this.disposed) this.changed();
        }
      });
    });
    this.pending.set(asset.id, promise);
    this.drain();
    return promise;
  }
  private drain() {
    while (this.active < 2 && this.queue.length) {
      const job = this.queue.shift()!;
      this.active += 1;
      void job().finally(() => { this.active -= 1; this.drain(); });
    }
  }
  dispose() { this.disposed = true; this.cache.clear(); this.metadata.clear(); }
}
async function makeVideoThumbnail(file: File): Promise<Thumbnail> {
  if (typeof document === 'undefined') {
    return { blob: new Blob(['video-thumb']), width: 640, height: 360, edgeColour: [0, 0, 0], centreColour: [0, 0, 0] };
  }
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  try {
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error('Cannot load video')); };
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Video thumbnail timeout')); }, 8000);
      function cleanup() {
        video.removeEventListener('loadeddata', onLoaded);
        video.removeEventListener('error', onError);
        clearTimeout(timeout);
      }
      video.addEventListener('loadeddata', onLoaded);
      video.addEventListener('error', onError);
    });

    video.currentTime = Math.min(0.1, video.duration || 0);
    await new Promise<void>((resolve) => {
      const onSeeked = () => { cleanup(); resolve(); };
      const timeout = setTimeout(() => { cleanup(); resolve(); }, 600);
      function cleanup() {
        video.removeEventListener('seeked', onSeeked);
        clearTimeout(timeout);
      }
      video.addEventListener('seeked', onSeeked);
    });

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    const scale = Math.min(1, 384 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error('Thumbnail failed'))), 'image/webp', 0.75)
    );
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colours = sampleColours(pixels, canvas.width, canvas.height);
    return { blob, width, height, ...colours };
  } finally {
    video.src = '';
    URL.revokeObjectURL(url);
  }
}

async function makeThumbnail(file: File): Promise<Thumbnail> {
  if (isVideoFile(file)) {
    return makeVideoThumbnail(file);
  }
  return makeImageThumbnail(file);
}

async function makeImageThumbnail(file: File): Promise<Thumbnail> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) throw new Error('Empty image');
    const scale = Math.min(1, 384 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Thumbnail failed')), 'image/webp', 0.75));
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const colours = sampleColours(pixels, canvas.width, canvas.height);
    return { blob, width, height, ...colours };
  } finally {
    image.src = '';
    URL.revokeObjectURL(url);
  }
}

export function moveBefore<T>(items: T[], source: T, target: T): T[] {
  if (source === target || !items.includes(source) || !items.includes(target)) return items;
  const next = items.filter((item) => item !== source);
  next.splice(next.indexOf(target), 0, source);
  return next;
}

// Reorder the visible subset only: hidden items keep their existing positions.
export function replaceVisibleOrder<T>(items: T[], ordered: T[]): T[] {
  const subset = new Set(ordered);
  let cursor = 0;
  return items.map((item) => subset.has(item) ? ordered[cursor++] : item);
}

export function sampleColours(pixels: Uint8ClampedArray, width: number, height: number) {
  const edge: Colour = [0, 0, 0], centre: Colour = [0, 0, 0];
  let edgeCount = 0, centreCount = 0;
  const step = Math.max(1, Math.floor(Math.max(width, height) / 48));
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
    const i = (y * width + x) * 4;
    if (pixels[i + 3] < 128) continue;
    const nx = x / width, ny = y / height;
    const atEdge = nx < .15 || nx > .85 || ny < .15 || ny > .85;
    const atCentre = nx >= .3 && nx <= .7 && ny >= .25 && ny <= .85;
    if (atEdge) { for (let c = 0; c < 3; c++) edge[c] += pixels[i + c]; edgeCount++; }
    if (atCentre) { for (let c = 0; c < 3; c++) centre[c] += pixels[i + c]; centreCount++; }
  }
  return {
    edgeColour: edge.map((v) => Math.round(v / Math.max(1, edgeCount))) as Colour,
    centreColour: centre.map((v) => Math.round(v / Math.max(1, centreCount))) as Colour,
  };
}

export function colourKey(colour: Colour) {
  const [r, g, b] = colour.map((v) => v / 255);
  const hi = Math.max(r, g, b), lo = Math.min(r, g, b), delta = hi - lo;
  const lightness = (hi + lo) / 2;
  if (delta < .08) return [-1, Math.round(lightness * 4), lightness];
  let hue = hi === r ? ((g - b) / delta) % 6 : hi === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return [Math.floor(hue / 30), Math.round(lightness * 4), lightness];
}

export function suggestColourOrder(ids: string[], metadata: Map<string, ImageMetadata>, region: 'edgeColour' | 'centreColour') {
  return [...ids].sort((a, b) => {
    const ca = metadata.get(a)?.[region], cb = metadata.get(b)?.[region];
    if (!ca || !cb) return ca ? -1 : cb ? 1 : 0;
    const ka = colourKey(ca), kb = colourKey(cb);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
  });
}
