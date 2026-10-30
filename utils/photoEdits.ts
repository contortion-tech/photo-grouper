/**
 * Per-slot photo edits and collage-wide style settings.
 */

export type FilterId =
    | 'none'
    | 'mono'
    | 'noir'
    | 'sepia'
    | 'vintage'
    | 'fade'
    | 'warm'
    | 'cool'
    | 'vivid'
    | 'dramatic'
    | 'cinematic'
    | 'pastel'
    | 'lush'
    | 'matte';

export type FitMode = 'cover' | 'contain';

export interface PhotoEdits {
    fitMode: FitMode;
    rotation: number;    // degrees, -180 .. 180 (image content rotation)
    scale: number;       // 1.0 .. 3.0 (zoom inside slot)
    offsetX: number;     // -50 .. 50 (% of slot width)
    offsetY: number;     // -50 .. 50 (% of slot height)
    filter: FilterId;
    brightness: number;  // 0.5 .. 1.5 (1 = no change)
    contrast: number;    // 0.5 .. 1.5
    saturation: number;  // 0 .. 2
    blur: number;        // 0 .. 6 (px)
}

export const DEFAULT_EDITS: PhotoEdits = {
    fitMode: 'cover',
    rotation: 0,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    filter: 'none',
    brightness: 1,
    contrast: 1,
    saturation: 1,
    blur: 0,
};

/**
 * CSS filter contribution for each named preset.
 * Combined with user brightness/contrast/saturation in `editsToCssFilter`.
 */
const FILTER_PRESETS: Record<FilterId, string> = {
    none: '',
    mono: 'grayscale(1)',
    noir: 'grayscale(1) contrast(1.25) brightness(0.92)',
    sepia: 'sepia(0.85) saturate(1.05)',
    vintage: 'sepia(0.4) saturate(0.85) contrast(0.95) brightness(1.05) hue-rotate(-10deg)',
    fade: 'contrast(0.85) brightness(1.1) saturate(0.8)',
    warm: 'saturate(1.15) hue-rotate(-15deg) brightness(1.05)',
    cool: 'saturate(1.1) hue-rotate(15deg) brightness(1.02)',
    vivid: 'saturate(1.6) contrast(1.1)',
    dramatic: 'contrast(1.35) saturate(1.1) brightness(0.95)',
    cinematic: 'contrast(1.15) saturate(0.85) hue-rotate(-5deg)',
    pastel: 'saturate(0.7) brightness(1.12) contrast(0.95)',
    lush: 'saturate(1.4) brightness(1.05) contrast(1.05)',
    matte: 'contrast(0.9) brightness(1.05) saturate(0.95)',
};

export const FILTER_OPTIONS: { id: FilterId; label: string }[] = [
    { id: 'none', label: 'Original' },
    { id: 'mono', label: 'Mono' },
    { id: 'noir', label: 'Noir' },
    { id: 'sepia', label: 'Sepia' },
    { id: 'vintage', label: 'Vintage' },
    { id: 'fade', label: 'Fade' },
    { id: 'warm', label: 'Warm' },
    { id: 'cool', label: 'Cool' },
    { id: 'vivid', label: 'Vivid' },
    { id: 'dramatic', label: 'Dramatic' },
    { id: 'cinematic', label: 'Cinema' },
    { id: 'pastel', label: 'Pastel' },
    { id: 'lush', label: 'Lush' },
    { id: 'matte', label: 'Matte' },
];

function clampNum(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}

/** Keep editor rotations inside the slider's canonical range. */
export function normalizeRotation(rotation: number): number {
    const normalized = ((rotation + 180) % 360 + 360) % 360 - 180;
    return normalized === -180 && rotation > 0 ? 180 : normalized;
}

export function basePhotoDimensions(
    imgAspect: number,
    slotW: number,
    slotH: number,
    fitMode: FitMode = 'cover',
) {
    const slotAspect = slotW / slotH;
    if (fitMode === 'contain') {
        if (imgAspect >= slotAspect) {
            return { width: slotW, height: slotW / imgAspect };
        }
        return { width: slotH * imgAspect, height: slotH };
    }
    if (imgAspect >= slotAspect) {
        return { width: slotH * imgAspect, height: slotH };
    }
    return { width: slotW, height: slotW / imgAspect };
}

/** Extra scale needed for a rotated cover-fit photo to cover every slot corner. */
export function rotationCoverScale(
    imgAspect: number,
    slotW: number,
    slotH: number,
    rotation: number,
): number {
    if (!imgAspect || !isFinite(imgAspect) || slotW <= 0 || slotH <= 0) return 1;
    const base = basePhotoDimensions(imgAspect, slotW, slotH, 'cover');
    const radians = (normalizeRotation(rotation) * Math.PI) / 180;
    const c = Math.abs(Math.cos(radians));
    const s = Math.abs(Math.sin(radians));
    return Math.max(
        1,
        (c * slotW + s * slotH) / base.width,
        (s * slotW + c * slotH) / base.height,
    );
}

export function rotationContainScale(
    imgAspect: number,
    slotW: number,
    slotH: number,
    rotation: number,
): number {
    if (!imgAspect || !isFinite(imgAspect) || slotW <= 0 || slotH <= 0) return 1;
    const base = basePhotoDimensions(imgAspect, slotW, slotH, 'contain');
    const radians = (normalizeRotation(rotation) * Math.PI) / 180;
    const c = Math.abs(Math.cos(radians));
    const s = Math.abs(Math.sin(radians));
    const rotatedW = c * base.width + s * base.height;
    const rotatedH = s * base.width + c * base.height;
    return Math.min(1, slotW / rotatedW, slotH / rotatedH);
}

export function effectivePhotoScale(
    edits: PhotoEdits,
    imgAspect: number,
    slotW: number,
    slotH: number,
): number {
    const rotationScale = edits.fitMode === 'contain'
        ? rotationContainScale(imgAspect, slotW, slotH, edits.rotation)
        : rotationCoverScale(imgAspect, slotW, slotH, edits.rotation);
    return edits.scale * rotationScale;
}

/**
 * How far (as a % of the slot's width/height) a photo can be panned before its
 * edge would pull inside the slot and reveal empty space.
 *
 * The photo is rendered "cover" (fills the slot, overflowing on one axis) and
 * then multiplied by the user `scale`. The pannable range in each axis is half
 * the overflow. This is what keeps panning from cropping the image out of frame
 * and what lets a zoomed-in photo recover its edges when you zoom back out.
 */
export function maxOffsetPct(
    imgAspect: number,
    slotW: number,
    slotH: number,
    scale: number,
    rotation = 0,
    fitMode: FitMode = 'cover',
): { x: number; y: number } {
    if (!imgAspect || !isFinite(imgAspect) || slotW <= 0 || slotH <= 0) {
        return { x: 0, y: 0 };
    }

    const radians = (normalizeRotation(rotation) * Math.PI) / 180;
    const c = Math.abs(Math.cos(radians));
    const s = Math.abs(Math.sin(radians));

    if (fitMode === 'contain') {
        const base = basePhotoDimensions(imgAspect, slotW, slotH, 'contain');
        const containScale = scale * rotationContainScale(imgAspect, slotW, slotH, rotation);
        const renderedW = base.width * containScale;
        const renderedH = base.height * containScale;
        const boundsW = c * renderedW + s * renderedH;
        const boundsH = s * renderedW + c * renderedH;
        return {
            x: (Math.abs(slotW - boundsW) / 2 / slotW) * 100,
            y: (Math.abs(slotH - boundsH) / 2 / slotH) * 100,
        };
    }

    const base = basePhotoDimensions(imgAspect, slotW, slotH, 'cover');
    const coverScale = rotationCoverScale(imgAspect, slotW, slotH, rotation);
    const renderedW = base.width * scale * coverScale;
    const renderedH = base.height * scale * coverScale;

    // At 0°/180°, preserve the full independent pan range.
    if (s < 1e-8) {
        const maxX = Math.max(0, (renderedW - slotW) / 2);
        const maxY = Math.max(0, (renderedH - slotH) / 2);
        return { x: (maxX / slotW) * 100, y: (maxY / slotH) * 100 };
    }

    // A conservative translation box guarantees every slot corner remains
    // covered even when both axes are panned to their limits simultaneously.
    const uMargin = renderedW / 2 - (c * slotW + s * slotH) / 2;
    const vMargin = renderedH / 2 - (s * slotW + c * slotH) / 2;
    const safePx = Math.max(0, Math.min(uMargin, vMargin) / (c + s));
    return { x: (safePx / slotW) * 100, y: (safePx / slotH) * 100 };
}

/**
 * Clamp an edit's pan offsets to the pannable range for the given image/slot.
 * Returns the (possibly) adjusted offsets.
 */
export function clampOffsets(
    edits: PhotoEdits,
    imgAspect: number,
    slotW: number,
    slotH: number,
): { offsetX: number; offsetY: number } {
    const m = maxOffsetPct(imgAspect, slotW, slotH, edits.scale, edits.rotation, edits.fitMode);
    return {
        offsetX: clampNum(edits.offsetX, -m.x, m.x),
        offsetY: clampNum(edits.offsetY, -m.y, m.y),
    };
}

export function editsToCssFilter(edits: PhotoEdits): string {
    const parts: string[] = [];
    const preset = FILTER_PRESETS[edits.filter];
    if (preset) parts.push(preset);
    if (edits.brightness !== 1) parts.push(`brightness(${edits.brightness})`);
    if (edits.contrast !== 1) parts.push(`contrast(${edits.contrast})`);
    if (edits.saturation !== 1) parts.push(`saturate(${edits.saturation})`);
    if (edits.blur > 0) parts.push(`blur(${edits.blur}px)`);
    return parts.join(' ');
}

/**
 * Translate slot-relative offsets into a CSS transform string applied to
 * the photo element inside its slot container.
 */
export function editsToTransform(edits: PhotoEdits, effectiveScale = edits.scale): string {
    const tx = edits.offsetX;
    const ty = edits.offsetY;
    return `translate(${tx}%, ${ty}%) scale(${effectiveScale}) rotate(${normalizeRotation(edits.rotation)}deg)`;
}

// ===== Collage-wide style =====

export interface CollageStyle {
    background: string;   // hex color for canvas background
    gap: number;          // 0 .. 24 (px in editor; scaled for export)
    cornerRadius: number; // 0 .. 32 (px in editor; scaled for export)
    padding: number;      // 0 .. 40 (px outer padding in editor; scaled for export)
}

export const DEFAULT_STYLE: CollageStyle = {
    background: '#ffffff',
    gap: 6,
    cornerRadius: 4,
    padding: 0,
};

export const BACKGROUND_PRESETS: { name: string; value: string }[] = [
    { name: 'White', value: '#ffffff' },
    { name: 'Black', value: '#111111' },
    { name: 'Cream', value: '#f7efe1' },
    { name: 'Blush', value: '#fadadd' },
    { name: 'Mint', value: '#d6f5e3' },
    { name: 'Sky', value: '#d6e9f7' },
    { name: 'Lavender', value: '#e6dbf5' },
    { name: 'Charcoal', value: '#2b2b2e' },
    { name: 'Sunset', value: '#ffb088' },
    { name: 'Forest', value: '#2f4a3a' },
];

// ===== Output aspect ratios =====

export interface AspectPreset {
    id: string;
    label: string;     // short name shown on the chip
    platform: string;  // where it's used
    ratio: number | null; // width / height; null = follow the layout's own ratio
}

/**
 * Final-image aspect ratios. The layout's slots are percentage-based, so they
 * reflow to whatever output ratio is chosen — letting one collage be exported
 * for several platforms.
 */
export const ASPECT_PRESETS: AspectPreset[] = [
    { id: 'auto', label: 'Layout', platform: 'Original', ratio: null },
    { id: 'square', label: '1:1', platform: 'Instagram Post', ratio: 1 },
    { id: 'portrait45', label: '4:5', platform: 'Instagram Portrait', ratio: 4 / 5 },
    { id: 'story', label: '9:16', platform: 'Story / Reel / TikTok', ratio: 9 / 16 },
    { id: 'landscape169', label: '16:9', platform: 'YouTube / X', ratio: 16 / 9 },
    { id: 'pin23', label: '2:3', platform: 'Pinterest', ratio: 2 / 3 },
    { id: 'fb', label: '1.91:1', platform: 'Facebook Link', ratio: 1.91 },
    { id: 'landscape43', label: '4:3', platform: 'Classic Photo', ratio: 4 / 3 },
];
