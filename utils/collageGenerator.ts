/**
 * Collage Generator - exports final collage image
 *
 * Applies per-slot edits (rotation/scale/offset/filter) and collage-wide
 * style (background, gap, corner radius, padding) so the exported image
 * matches the preview. Honors an optional output aspect-ratio override.
 */

import { CollageTemplate } from './templates';
import {
  PhotoEdits,
  DEFAULT_EDITS,
  CollageStyle,
  DEFAULT_STYLE,
  editsToCssFilter,
  clampOffsets,
  effectivePhotoScale,
  basePhotoDimensions,
} from './photoEdits';

import { PhotoData } from '@/types/photo';

export type ExportFormat = 'jpeg' | 'png';

export interface ExportOptions {
  format: ExportFormat;
  width: number;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'jpeg',
  width: 2000,
};

export interface ComparisonLabels {
  enabled: boolean;
  left: string;
  right: string;
}

export const DEFAULT_COMPARISON_LABELS: ComparisonLabels = {
  enabled: false,
  left: 'Before',
  right: 'After',
};

export type SaveResult = 'shared' | 'downloaded';

export function getExportDimensions(aspect: number, width: number) {
  const longestEdge = Math.max(320, Math.min(4000, Math.round(width)));
  if (aspect >= 1) {
    return { width: longestEdge, height: Math.round(longestEdge / aspect) };
  }
  return { width: Math.round(longestEdge * aspect), height: longestEdge };
}

export function getExportFileDetails(format: ExportFormat) {
  const extension = format === 'png' ? 'png' : 'jpg';
  return {
    mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
    extension,
    fileName: `photo-collage.${extension}`,
  };
}

// Reference width used in the editor preview (Tailwind max-w-md ≈ 448px).
// Style values (gap, padding, radius) are scaled by EXPORT_WIDTH / REFERENCE_WIDTH.
const REFERENCE_WIDTH = 448;

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

function pathRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  const c = ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void };
  if (typeof c.roundRect === 'function') {
    c.roundRect(x, y, w, h, radius);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

/**
 * Draw an image into a slot, replicating the editor's CSS pipeline:
 * cover-fit → translate(offset) → scale → rotate, with the offset clamped so
 * the image always covers the slot (never reveals empty space).
 */
function drawSlot(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
  edits: PhotoEdits,
  cornerRadius: number,
) {
  ctx.save();

  ctx.beginPath();
  pathRoundedRect(ctx, x, y, w, h, cornerRadius);
  ctx.clip();

  const filter = editsToCssFilter(edits);
  if (filter) ctx.filter = filter;

  const iw = img.width;
  const ih = img.height;
  const imgAspect = iw / ih;

  const base = basePhotoDimensions(imgAspect, w, h, edits.fitMode);
  const nw = base.width;
  const nh = base.height;

  // Clamp offsets to the same bounds used in the editor.
  const { offsetX, offsetY } = clampOffsets(edits, imgAspect, w, h);

  ctx.translate(x + w / 2, y + h / 2);
  ctx.translate((offsetX / 100) * w, (offsetY / 100) * h);
  const displayScale = effectivePhotoScale(edits, imgAspect, w, h);
  ctx.scale(displayScale, displayScale);
  ctx.rotate((edits.rotation * Math.PI) / 180);

  ctx.drawImage(img, -nw / 2, -nh / 2, nw, nh);

  ctx.restore();
}

export function fitTextToWidth(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string {
  if (measure(text) <= maxWidth) return text;
  const ellipsis = '…';
  let end = text.length;
  while (end > 0) {
    const candidate = `${text.slice(0, end).trimEnd()}${ellipsis}`;
    if (measure(candidate) <= maxWidth) return candidate;
    end -= 1;
  }
  return measure(ellipsis) <= maxWidth ? ellipsis : '';
}

function drawComparisonLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  w: number,
  pxScale: number,
) {
  const rawText = label.trim().slice(0, 24);
  if (!rawText) return;
  const fontSize = Math.max(8, Math.round(11 * pxScale));
  const horizontalPadding = Math.round(10 * pxScale);
  const height = Math.max(18, Math.round(24 * pxScale));
  const availablePillWidth = Math.max(0, w - horizontalPadding * 2);
  ctx.save();
  ctx.font = `600 ${fontSize}px sans-serif`;
  ctx.textBaseline = 'middle';
  const text = fitTextToWidth(
    rawText,
    Math.max(0, availablePillWidth - horizontalPadding * 2),
    (value) => ctx.measureText(value).width,
  );
  if (!text) {
    ctx.restore();
    return;
  }
  const pillWidth = Math.min(availablePillWidth, ctx.measureText(text).width + horizontalPadding * 2);
  const pillX = x + (w - pillWidth) / 2;
  const pillY = y + Math.round(12 * pxScale);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
  ctx.beginPath();
  pathRoundedRect(ctx, pillX, pillY, pillWidth, height, height / 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + w / 2, pillY + height / 2 + 1);
  ctx.restore();
}

/**
 * Generate the final collage image as an object URL.
 */
export async function generateCollage(
  template: CollageTemplate,
  photos: Map<string, PhotoData>,
  slotEdits: Map<string, PhotoEdits> = new Map(),
  collageStyle: CollageStyle = DEFAULT_STYLE,
  outputAspectRatio: number | null = null,
  exportOptions: ExportOptions = DEFAULT_EXPORT_OPTIONS,
  comparisonLabels: ComparisonLabels = DEFAULT_COMPARISON_LABELS,
): Promise<string> {
  const aspect = outputAspectRatio ?? template.aspectRatio;
  const { width: canvasWidth, height: canvasHeight } = getExportDimensions(aspect, exportOptions.width);

  const pxScale = canvasWidth / REFERENCE_WIDTH;
  const gapPx = collageStyle.gap * pxScale;
  const paddingPx = collageStyle.padding * pxScale;
  const cornerPx = collageStyle.cornerRadius * pxScale;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas rendering context unavailable');
  }

  ctx.fillStyle = collageStyle.background || '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const innerX = paddingPx;
  const innerY = paddingPx;
  const innerW = canvasWidth - paddingPx * 2;
  const innerH = canvasHeight - paddingPx * 2;

  for (const [slotIndex, slot] of template.slots.entries()) {
    const photo = photos.get(slot.id);
    if (!photo) continue;

    const edits = slotEdits.get(slot.id) ?? DEFAULT_EDITS;

    const sx = innerX + (slot.x / 100) * innerW + gapPx / 2;
    const sy = innerY + (slot.y / 100) * innerH + gapPx / 2;
    const sw = (slot.width / 100) * innerW - gapPx;
    const sh = (slot.height / 100) * innerH - gapPx;
    if (sw <= 0 || sh <= 0) continue;

    try {
      const img = await loadImage(photo.previewUrl);
      drawSlot(ctx, img, sx, sy, sw, sh, edits, cornerPx);
    } catch (error) {
      console.error('Failed to load image:', error);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(sx, sy, sw, sh);
    }
    if (comparisonLabels.enabled && slotIndex < 2) {
      drawComparisonLabel(
        ctx,
        slotIndex === 0 ? comparisonLabels.left : comparisonLabels.right,
        sx,
        sy,
        sw,
        pxScale,
      );
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(URL.createObjectURL(blob));
      } else {
        reject(new Error('Canvas to Blob failed'));
      }
    }, getExportFileDetails(exportOptions.format).mimeType, exportOptions.format === 'jpeg' ? 0.92 : undefined);
  });
}

/**
 * Download or share the collage.
 */
export async function saveCollage(
  template: CollageTemplate,
  photos: Map<string, PhotoData>,
  slotEdits: Map<string, PhotoEdits> = new Map(),
  collageStyle: CollageStyle = DEFAULT_STYLE,
  outputAspectRatio: number | null = null,
  exportOptions: ExportOptions = DEFAULT_EXPORT_OPTIONS,
  comparisonLabels: ComparisonLabels = DEFAULT_COMPARISON_LABELS,
): Promise<SaveResult> {
  const url = await generateCollage(
    template,
    photos,
    slotEdits,
    collageStyle,
    outputAspectRatio,
    exportOptions,
    comparisonLabels,
  );
  const fileDetails = getExportFileDetails(exportOptions.format);

  if (navigator.share && navigator.canShare) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], fileDetails.fileName, { type: fileDetails.mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Photo Collage' });
        URL.revokeObjectURL(url);
        return 'shared';
      }
    } catch (error) {
      console.warn('Share failed, falling back to download:', error);
    }
  }

  const link = document.createElement('a');
  link.href = url;
  link.download = fileDetails.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return 'downloaded';
}
