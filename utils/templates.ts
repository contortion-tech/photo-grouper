/**
 * Template definitions for collage layouts
 * Expanded with many more creative options per photo count.
 */

export interface SlotPosition {
    id: string;
    x: number;      // percentage (0-100)
    y: number;      // percentage (0-100)
    width: number;  // percentage (0-100)
    height: number; // percentage (0-100)
}

export interface CollageTemplate {
    id: string;
    name: string;
    slots: SlotPosition[];
    aspectRatio: number; // width / height
    style?: 'clean' | 'polaroid' | 'rounded' | 'artistic';
    /** Fold editorial tokens: hairline divider rendering for Fold presets. */
    foldTokens?: { gap: number };
    /** MJ-072 poster presets: exact rasterization size (and DPI where print-meaningful). */
    canvasResolution?: CanvasResolution;
}

export interface CanvasResolution {
    width: number;
    height: number;
    dpi?: number;
}

// Template definitions - organized by photo count
export const TEMPLATES: CollageTemplate[] = [
    // ==================== 2 PHOTOS ====================
    {
        id: '2-side-by-side',
        name: 'Side by Side',
        aspectRatio: 2,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 50, height: 100 },
            { id: 's2', x: 50, y: 0, width: 50, height: 100 },
        ],
    },
    {
        id: '2-stacked',
        name: 'Stacked',
        aspectRatio: 0.8,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 100, height: 50 },
            { id: 's2', x: 0, y: 50, width: 100, height: 50 },
        ],
    },
    {
        id: '2-big-small',
        name: 'Big & Small',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 70, height: 100 },
            { id: 's2', x: 70, y: 25, width: 30, height: 50 },
        ],
    },
    {
        id: '2-big-top',
        name: 'Hero Top',
        aspectRatio: 0.9,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 100, height: 65 },
            { id: 's2', x: 0, y: 65, width: 100, height: 35 },
        ],
    },
    {
        id: '2-big-bottom',
        name: 'Hero Bottom',
        aspectRatio: 0.9,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 100, height: 35 },
            { id: 's2', x: 0, y: 35, width: 100, height: 65 },
        ],
    },
    {
        id: '2-tall-side',
        name: 'Tall Pair',
        aspectRatio: 1.4,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 40, height: 100 },
            { id: 's2', x: 40, y: 0, width: 60, height: 100 },
        ],
    },
    {
        id: '2-portrait-frame',
        name: 'Frame Pair',
        aspectRatio: 1.6,
        style: 'rounded',
        slots: [
            { id: 's1', x: 5, y: 10, width: 42, height: 80 },
            { id: 's2', x: 53, y: 10, width: 42, height: 80 },
        ],
    },

    // ==================== 3 PHOTOS ====================
    {
        id: '3-left-focus',
        name: 'Left Focus',
        aspectRatio: 1.5,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 60, height: 100 },
            { id: 's2', x: 60, y: 0, width: 40, height: 50 },
            { id: 's3', x: 60, y: 50, width: 40, height: 50 },
        ],
    },
    {
        id: '3-right-focus',
        name: 'Right Focus',
        aspectRatio: 1.5,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 40, height: 50 },
            { id: 's2', x: 0, y: 50, width: 40, height: 50 },
            { id: 's3', x: 40, y: 0, width: 60, height: 100 },
        ],
    },
    {
        id: '3-top-focus',
        name: 'Top Focus',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 100, height: 60 },
            { id: 's2', x: 0, y: 60, width: 50, height: 40 },
            { id: 's3', x: 50, y: 60, width: 50, height: 40 },
        ],
    },
    {
        id: '3-bottom-focus',
        name: 'Bottom Focus',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 50, height: 40 },
            { id: 's2', x: 50, y: 0, width: 50, height: 40 },
            { id: 's3', x: 0, y: 40, width: 100, height: 60 },
        ],
    },
    {
        id: '3-row',
        name: 'Triptych',
        aspectRatio: 3,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 33.33, height: 100 },
            { id: 's2', x: 33.33, y: 0, width: 33.33, height: 100 },
            { id: 's3', x: 66.66, y: 0, width: 33.34, height: 100 },
        ],
    },
    {
        id: '3-column',
        name: 'Tall Stack',
        aspectRatio: 0.6,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 100, height: 33.33 },
            { id: 's2', x: 0, y: 33.33, width: 100, height: 33.33 },
            { id: 's3', x: 0, y: 66.66, width: 100, height: 33.34 },
        ],
    },
    {
        id: '3-l-shape',
        name: 'L Shape',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 65, height: 65 },
            { id: 's2', x: 65, y: 0, width: 35, height: 100 },
            { id: 's3', x: 0, y: 65, width: 65, height: 35 },
        ],
    },
    {
        id: '3-magazine',
        name: 'Magazine',
        aspectRatio: 1.3,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 55, height: 100 },
            { id: 's2', x: 55, y: 0, width: 45, height: 45 },
            { id: 's3', x: 55, y: 45, width: 45, height: 55 },
        ],
    },

    // ==================== 4 PHOTOS ====================
    {
        id: '4-grid',
        name: 'Grid',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 50, height: 50 },
            { id: 's2', x: 50, y: 0, width: 50, height: 50 },
            { id: 's3', x: 0, y: 50, width: 50, height: 50 },
            { id: 's4', x: 50, y: 50, width: 50, height: 50 },
        ],
    },
    {
        id: '4-big-left',
        name: 'Big Left',
        aspectRatio: 1.2,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 65, height: 100 },
            { id: 's2', x: 65, y: 0, width: 35, height: 33.33 },
            { id: 's3', x: 65, y: 33.33, width: 35, height: 33.33 },
            { id: 's4', x: 65, y: 66.66, width: 35, height: 33.34 },
        ],
    },
    {
        id: '4-big-right',
        name: 'Big Right',
        aspectRatio: 1.2,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 35, height: 33.33 },
            { id: 's2', x: 0, y: 33.33, width: 35, height: 33.33 },
            { id: 's3', x: 0, y: 66.66, width: 35, height: 33.34 },
            { id: 's4', x: 35, y: 0, width: 65, height: 100 },
        ],
    },
    {
        id: '4-horizontal-strip',
        name: 'Strip',
        aspectRatio: 4,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 25, height: 100 },
            { id: 's2', x: 25, y: 0, width: 25, height: 100 },
            { id: 's3', x: 50, y: 0, width: 25, height: 100 },
            { id: 's4', x: 75, y: 0, width: 25, height: 100 },
        ],
    },
    {
        id: '4-vertical-strip',
        name: 'Tall Strip',
        aspectRatio: 0.4,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 100, height: 25 },
            { id: 's2', x: 0, y: 25, width: 100, height: 25 },
            { id: 's3', x: 0, y: 50, width: 100, height: 25 },
            { id: 's4', x: 0, y: 75, width: 100, height: 25 },
        ],
    },
    {
        id: '4-t-layout',
        name: 'T Layout',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 100, height: 55 },
            { id: 's2', x: 0, y: 55, width: 33.33, height: 45 },
            { id: 's3', x: 33.33, y: 55, width: 33.33, height: 45 },
            { id: 's4', x: 66.66, y: 55, width: 33.34, height: 45 },
        ],
    },
    {
        id: '4-inverse-t',
        name: 'Inverse T',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 33.33, height: 45 },
            { id: 's2', x: 33.33, y: 0, width: 33.33, height: 45 },
            { id: 's3', x: 66.66, y: 0, width: 33.34, height: 45 },
            { id: 's4', x: 0, y: 45, width: 100, height: 55 },
        ],
    },
    {
        id: '4-pinwheel',
        name: 'Pinwheel',
        aspectRatio: 1,
        style: 'artistic',
        slots: [
            { id: 's1', x: 0, y: 0, width: 60, height: 40 },
            { id: 's2', x: 60, y: 0, width: 40, height: 60 },
            { id: 's3', x: 40, y: 60, width: 60, height: 40 },
            { id: 's4', x: 0, y: 40, width: 40, height: 60 },
        ],
    },
    {
        id: '4-window',
        name: 'Window',
        aspectRatio: 1,
        style: 'rounded',
        slots: [
            { id: 's1', x: 5, y: 5, width: 42, height: 42 },
            { id: 's2', x: 53, y: 5, width: 42, height: 42 },
            { id: 's3', x: 5, y: 53, width: 42, height: 42 },
            { id: 's4', x: 53, y: 53, width: 42, height: 42 },
        ],
    },

    // ==================== 5 PHOTOS ====================
    {
        id: '5-featured',
        name: 'Featured',
        aspectRatio: 1.2,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 60, height: 60 },
            { id: 's2', x: 60, y: 0, width: 40, height: 30 },
            { id: 's3', x: 60, y: 30, width: 40, height: 30 },
            { id: 's4', x: 0, y: 60, width: 30, height: 40 },
            { id: 's5', x: 30, y: 60, width: 70, height: 40 },
        ],
    },
    {
        id: '5-cross',
        name: 'Cross',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 25, y: 0, width: 50, height: 40 },
            { id: 's2', x: 0, y: 40, width: 33.33, height: 30 },
            { id: 's3', x: 33.33, y: 40, width: 33.33, height: 30 },
            { id: 's4', x: 66.66, y: 40, width: 33.34, height: 30 },
            { id: 's5', x: 25, y: 70, width: 50, height: 30 },
        ],
    },
    {
        id: '5-mosaic',
        name: 'Mosaic',
        aspectRatio: 1.5,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 50, height: 50 },
            { id: 's2', x: 50, y: 0, width: 50, height: 50 },
            { id: 's3', x: 0, y: 50, width: 33.33, height: 50 },
            { id: 's4', x: 33.33, y: 50, width: 33.33, height: 50 },
            { id: 's5', x: 66.66, y: 50, width: 33.34, height: 50 },
        ],
    },
    {
        id: '5-hero-top',
        name: 'Hero Top',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 100, height: 55 },
            { id: 's2', x: 0, y: 55, width: 25, height: 45 },
            { id: 's3', x: 25, y: 55, width: 25, height: 45 },
            { id: 's4', x: 50, y: 55, width: 25, height: 45 },
            { id: 's5', x: 75, y: 55, width: 25, height: 45 },
        ],
    },
    {
        id: '5-hero-side',
        name: 'Hero Side',
        aspectRatio: 1.3,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 60, height: 100 },
            { id: 's2', x: 60, y: 0, width: 40, height: 25 },
            { id: 's3', x: 60, y: 25, width: 40, height: 25 },
            { id: 's4', x: 60, y: 50, width: 40, height: 25 },
            { id: 's5', x: 60, y: 75, width: 40, height: 25 },
        ],
    },
    {
        id: '5-row',
        name: '5 Strip',
        aspectRatio: 5,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 20, height: 100 },
            { id: 's2', x: 20, y: 0, width: 20, height: 100 },
            { id: 's3', x: 40, y: 0, width: 20, height: 100 },
            { id: 's4', x: 60, y: 0, width: 20, height: 100 },
            { id: 's5', x: 80, y: 0, width: 20, height: 100 },
        ],
    },
    {
        id: '5-split',
        name: 'Split',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 50, height: 50 },
            { id: 's2', x: 50, y: 0, width: 50, height: 33.33 },
            { id: 's3', x: 50, y: 33.33, width: 50, height: 33.33 },
            { id: 's4', x: 50, y: 66.66, width: 50, height: 33.34 },
            { id: 's5', x: 0, y: 50, width: 50, height: 50 },
        ],
    },

    // ==================== 6 PHOTOS ====================
    {
        id: '6-grid',
        name: '2×3 Grid',
        aspectRatio: 1.5,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 33.33, height: 50 },
            { id: 's2', x: 33.33, y: 0, width: 33.33, height: 50 },
            { id: 's3', x: 66.66, y: 0, width: 33.34, height: 50 },
            { id: 's4', x: 0, y: 50, width: 33.33, height: 50 },
            { id: 's5', x: 33.33, y: 50, width: 33.33, height: 50 },
            { id: 's6', x: 66.66, y: 50, width: 33.34, height: 50 },
        ],
    },
    {
        id: '6-tall-grid',
        name: '3×2 Grid',
        aspectRatio: 0.66,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 50, height: 33.33 },
            { id: 's2', x: 50, y: 0, width: 50, height: 33.33 },
            { id: 's3', x: 0, y: 33.33, width: 50, height: 33.33 },
            { id: 's4', x: 50, y: 33.33, width: 50, height: 33.33 },
            { id: 's5', x: 0, y: 66.66, width: 50, height: 33.34 },
            { id: 's6', x: 50, y: 66.66, width: 50, height: 33.34 },
        ],
    },
    {
        id: '6-hero',
        name: 'Hero 6',
        aspectRatio: 1.2,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 66.66, height: 60 },
            { id: 's2', x: 66.66, y: 0, width: 33.34, height: 30 },
            { id: 's3', x: 66.66, y: 30, width: 33.34, height: 30 },
            { id: 's4', x: 0, y: 60, width: 33.33, height: 40 },
            { id: 's5', x: 33.33, y: 60, width: 33.33, height: 40 },
            { id: 's6', x: 66.66, y: 60, width: 33.34, height: 40 },
        ],
    },
    {
        id: '6-mosaic',
        name: 'Mosaic 6',
        aspectRatio: 1.2,
        style: 'artistic',
        slots: [
            { id: 's1', x: 0, y: 0, width: 50, height: 66.66 },
            { id: 's2', x: 50, y: 0, width: 50, height: 33.33 },
            { id: 's3', x: 50, y: 33.33, width: 25, height: 33.33 },
            { id: 's4', x: 75, y: 33.33, width: 25, height: 33.33 },
            { id: 's5', x: 0, y: 66.66, width: 33.33, height: 33.34 },
            { id: 's6', x: 33.33, y: 66.66, width: 66.67, height: 33.34 },
        ],
    },
    {
        id: '6-center-hero',
        name: 'Center Hero',
        aspectRatio: 1,
        style: 'artistic',
        slots: [
            { id: 's1', x: 0, y: 0, width: 100, height: 25 },
            { id: 's2', x: 0, y: 25, width: 25, height: 50 },
            { id: 's3', x: 25, y: 25, width: 50, height: 50 },
            { id: 's4', x: 75, y: 25, width: 25, height: 50 },
            { id: 's5', x: 0, y: 75, width: 50, height: 25 },
            { id: 's6', x: 50, y: 75, width: 50, height: 25 },
        ],
    },
    {
        id: '6-side-hero',
        name: 'Side Hero',
        aspectRatio: 1.2,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 50, height: 100 },
            { id: 's2', x: 50, y: 0, width: 25, height: 33.33 },
            { id: 's3', x: 75, y: 0, width: 25, height: 33.33 },
            { id: 's4', x: 50, y: 33.33, width: 50, height: 33.33 },
            { id: 's5', x: 50, y: 66.66, width: 25, height: 33.34 },
            { id: 's6', x: 75, y: 66.66, width: 25, height: 33.34 },
        ],
    },

    // ==================== 7 PHOTOS ====================
    {
        id: '7-spotlight',
        name: 'Spotlight',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 20, y: 20, width: 60, height: 40 },
            { id: 's2', x: 0, y: 0, width: 33.33, height: 25 },
            { id: 's3', x: 33.33, y: 0, width: 33.33, height: 25 },
            { id: 's4', x: 66.66, y: 0, width: 33.34, height: 25 },
            { id: 's5', x: 0, y: 65, width: 33.33, height: 35 },
            { id: 's6', x: 33.33, y: 65, width: 33.33, height: 35 },
            { id: 's7', x: 66.66, y: 65, width: 33.34, height: 35 },
        ],
    },
    {
        id: '7-hero-grid',
        name: 'Hero + Grid',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 100, height: 50 },
            { id: 's2', x: 0, y: 50, width: 33.33, height: 25 },
            { id: 's3', x: 33.33, y: 50, width: 33.33, height: 25 },
            { id: 's4', x: 66.66, y: 50, width: 33.34, height: 25 },
            { id: 's5', x: 0, y: 75, width: 33.33, height: 25 },
            { id: 's6', x: 33.33, y: 75, width: 33.33, height: 25 },
            { id: 's7', x: 66.66, y: 75, width: 33.34, height: 25 },
        ],
    },
    {
        id: '7-magazine',
        name: 'Magazine 7',
        aspectRatio: 1.2,
        style: 'artistic',
        slots: [
            { id: 's1', x: 0, y: 0, width: 50, height: 50 },
            { id: 's2', x: 50, y: 0, width: 25, height: 50 },
            { id: 's3', x: 75, y: 0, width: 25, height: 25 },
            { id: 's4', x: 75, y: 25, width: 25, height: 25 },
            { id: 's5', x: 0, y: 50, width: 33.33, height: 50 },
            { id: 's6', x: 33.33, y: 50, width: 33.33, height: 50 },
            { id: 's7', x: 66.66, y: 50, width: 33.34, height: 50 },
        ],
    },
    {
        id: '7-side-feature',
        name: 'Side Feature',
        aspectRatio: 1.3,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 50, height: 100 },
            { id: 's2', x: 50, y: 0, width: 25, height: 33.33 },
            { id: 's3', x: 75, y: 0, width: 25, height: 33.33 },
            { id: 's4', x: 50, y: 33.33, width: 25, height: 33.33 },
            { id: 's5', x: 75, y: 33.33, width: 25, height: 33.33 },
            { id: 's6', x: 50, y: 66.66, width: 25, height: 33.34 },
            { id: 's7', x: 75, y: 66.66, width: 25, height: 33.34 },
        ],
    },

    // ==================== 8 PHOTOS ====================
    {
        id: '8-grid',
        name: '4×2 Grid',
        aspectRatio: 2,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 25, height: 50 },
            { id: 's2', x: 25, y: 0, width: 25, height: 50 },
            { id: 's3', x: 50, y: 0, width: 25, height: 50 },
            { id: 's4', x: 75, y: 0, width: 25, height: 50 },
            { id: 's5', x: 0, y: 50, width: 25, height: 50 },
            { id: 's6', x: 25, y: 50, width: 25, height: 50 },
            { id: 's7', x: 50, y: 50, width: 25, height: 50 },
            { id: 's8', x: 75, y: 50, width: 25, height: 50 },
        ],
    },
    {
        id: '8-tall-grid',
        name: '2×4 Grid',
        aspectRatio: 0.5,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 50, height: 25 },
            { id: 's2', x: 50, y: 0, width: 50, height: 25 },
            { id: 's3', x: 0, y: 25, width: 50, height: 25 },
            { id: 's4', x: 50, y: 25, width: 50, height: 25 },
            { id: 's5', x: 0, y: 50, width: 50, height: 25 },
            { id: 's6', x: 50, y: 50, width: 50, height: 25 },
            { id: 's7', x: 0, y: 75, width: 50, height: 25 },
            { id: 's8', x: 50, y: 75, width: 50, height: 25 },
        ],
    },
    {
        id: '8-hero',
        name: 'Hero 8',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 75, height: 75 },
            { id: 's2', x: 75, y: 0, width: 25, height: 25 },
            { id: 's3', x: 75, y: 25, width: 25, height: 25 },
            { id: 's4', x: 75, y: 50, width: 25, height: 25 },
            { id: 's5', x: 75, y: 75, width: 25, height: 25 },
            { id: 's6', x: 0, y: 75, width: 25, height: 25 },
            { id: 's7', x: 25, y: 75, width: 25, height: 25 },
            { id: 's8', x: 50, y: 75, width: 25, height: 25 },
        ],
    },
    {
        id: '8-magazine',
        name: 'Magazine 8',
        aspectRatio: 1,
        style: 'artistic',
        slots: [
            { id: 's1', x: 0, y: 0, width: 50, height: 50 },
            { id: 's2', x: 50, y: 0, width: 25, height: 25 },
            { id: 's3', x: 75, y: 0, width: 25, height: 25 },
            { id: 's4', x: 50, y: 25, width: 50, height: 25 },
            { id: 's5', x: 0, y: 50, width: 25, height: 50 },
            { id: 's6', x: 25, y: 50, width: 25, height: 25 },
            { id: 's7', x: 50, y: 50, width: 50, height: 50 },
            { id: 's8', x: 25, y: 75, width: 25, height: 25 },
        ],
    },

    // ==================== 9 PHOTOS ====================
    {
        id: '9-grid',
        name: '3×3 Grid',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 33.33, height: 33.33 },
            { id: 's2', x: 33.33, y: 0, width: 33.33, height: 33.33 },
            { id: 's3', x: 66.66, y: 0, width: 33.34, height: 33.33 },
            { id: 's4', x: 0, y: 33.33, width: 33.33, height: 33.33 },
            { id: 's5', x: 33.33, y: 33.33, width: 33.33, height: 33.33 },
            { id: 's6', x: 66.66, y: 33.33, width: 33.34, height: 33.33 },
            { id: 's7', x: 0, y: 66.66, width: 33.33, height: 33.34 },
            { id: 's8', x: 33.33, y: 66.66, width: 33.33, height: 33.34 },
            { id: 's9', x: 66.66, y: 66.66, width: 33.34, height: 33.34 },
        ],
    },
    {
        id: '9-hero',
        name: 'Hero 9',
        aspectRatio: 1,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 20, height: 20 },
            { id: 's2', x: 20, y: 0, width: 20, height: 20 },
            { id: 's3', x: 40, y: 0, width: 20, height: 20 },
            { id: 's4', x: 60, y: 0, width: 20, height: 20 },
            { id: 's5', x: 80, y: 0, width: 20, height: 20 },
            { id: 's6', x: 0, y: 20, width: 100, height: 60 },
            { id: 's7', x: 0, y: 80, width: 33.33, height: 20 },
            { id: 's8', x: 33.33, y: 80, width: 33.33, height: 20 },
            { id: 's9', x: 66.66, y: 80, width: 33.34, height: 20 },
        ],
    },
    {
        id: '9-magazine',
        name: 'Magazine 9',
        aspectRatio: 1.2,
        style: 'artistic',
        slots: [
            { id: 's1', x: 0, y: 0, width: 40, height: 50 },
            { id: 's2', x: 40, y: 0, width: 30, height: 25 },
            { id: 's3', x: 70, y: 0, width: 30, height: 25 },
            { id: 's4', x: 40, y: 25, width: 60, height: 25 },
            { id: 's5', x: 0, y: 50, width: 33.33, height: 25 },
            { id: 's6', x: 33.33, y: 50, width: 33.33, height: 50 },
            { id: 's7', x: 66.66, y: 50, width: 33.34, height: 25 },
            { id: 's8', x: 0, y: 75, width: 33.33, height: 25 },
            { id: 's9', x: 66.66, y: 75, width: 33.34, height: 25 },
        ],
    },
    {
        id: '9-rows',
        name: '3 Rows',
        aspectRatio: 1.5,
        style: 'clean',
        slots: [
            { id: 's1', x: 0, y: 0, width: 50, height: 33.33 },
            { id: 's2', x: 50, y: 0, width: 25, height: 33.33 },
            { id: 's3', x: 75, y: 0, width: 25, height: 33.33 },
            { id: 's4', x: 0, y: 33.33, width: 25, height: 33.33 },
            { id: 's5', x: 25, y: 33.33, width: 50, height: 33.33 },
            { id: 's6', x: 75, y: 33.33, width: 25, height: 33.33 },
            { id: 's7', x: 0, y: 66.66, width: 25, height: 33.34 },
            { id: 's8', x: 25, y: 66.66, width: 25, height: 33.34 },
            { id: 's9', x: 50, y: 66.66, width: 50, height: 33.34 },
        ],
    },
];

/** Clean editorial families keep shared edges aligned for divider editing. */
export const EDITORIAL_TEMPLATES: CollageTemplate[] = Array.from({ length: 8 }, (_, index) => {
    const count = index + 2;
    const slot = (x: number, y: number, width: number, height: number, position: number): SlotPosition =>
        ({ id: `s${position + 1}`, x, y, width, height });
    const side = [slot(0, 0, 62, 100, 0), ...Array.from({ length: count - 1 }, (_, i) =>
        slot(62, i * 100 / (count - 1), 38, 100 / (count - 1), i + 1))];
    const top = [slot(0, 0, 100, 57, 0), ...Array.from({ length: count - 1 }, (_, i) =>
        slot(i * 100 / (count - 1), 57, 100 / (count - 1), 43, i + 1))];
    const firstRow = Math.floor(count / 2);
    const bands = count === 2 ? [slot(0, 0, 35, 100, 0), slot(35, 0, 65, 100, 1)] :
        [firstRow, count - firstRow].flatMap((columns, row) => {
            const weights = Array.from({ length: columns }, (_, i) => i === row % columns ? 1.35 : 1);
            const total = weights.reduce((sum, value) => sum + value, 0);
            let x = 0;
            return weights.map((weight, column) => {
                const width = weight / total * 100;
                const result = slot(x, row === 0 ? 0 : 43, width, row === 0 ? 43 : 57, (row ? firstRow : 0) + column);
                x += width;
                return result;
            });
        });
    return [
        { id: `${count}-editorial-feature`, name: 'Editorial Feature', aspectRatio: 1.4, style: 'clean' as const, slots: side },
        { id: `${count}-editorial-banner`, name: 'Editorial Banner', aspectRatio: 0.85, style: 'clean' as const, slots: top },
        { id: `${count}-editorial-rhythm`, name: 'Editorial Rhythm', aspectRatio: 1.25, style: 'clean' as const, slots: bands },
    ];
}).flat();
TEMPLATES.push(...EDITORIAL_TEMPLATES);

/**
 * Get templates filtered by photo count (exact match only)
 */
export function getTemplatesForPhotoCount(count: number): CollageTemplate[] {
    return TEMPLATES.filter((t) => t.slots.length === count);
}

// ==================== FOLD EDITORIAL PRESETS (MJ-062) ====================

/** Fold hairline divider token (px at the 448px editor reference width). */
export const FOLD_HAIRLINE_GAP = 2;

const FOLD_TOKENS = { gap: FOLD_HAIRLINE_GAP };

/** Fold quad: clean symmetric grid with hairline dividers, 1:1 canvas. */
TEMPLATES.push({
    id: '4-grid-fold',
    name: 'Fold Quad',
    aspectRatio: 1,
    style: 'clean',
    foldTokens: FOLD_TOKENS,
    slots: [
        { id: 's1', x: 0, y: 0, width: 50, height: 50 },
        { id: 's2', x: 50, y: 0, width: 50, height: 50 },
        { id: 's3', x: 0, y: 50, width: 50, height: 50 },
        { id: 's4', x: 50, y: 50, width: 50, height: 50 },
    ],
});

/** Fold hero story, 4:5 portrait: dominant hero (62%) + two stacked companions (38%). */
TEMPLATES.push({
    id: '3-hero-story',
    name: 'Hero Story',
    aspectRatio: 0.8,
    style: 'clean',
    foldTokens: FOLD_TOKENS,
    slots: [
        { id: 's1', x: 0, y: 0, width: 62, height: 100 },
        { id: 's2', x: 62, y: 0, width: 38, height: 50 },
        { id: 's3', x: 62, y: 50, width: 38, height: 50 },
    ],
});

/** Fold hero story, 16:9 landscape variant of the hero story geometry. */
TEMPLATES.push({
    id: '3-hero-story-wide',
    name: 'Hero Story Wide',
    aspectRatio: 16 / 9,
    style: 'clean',
    foldTokens: FOLD_TOKENS,
    slots: [
        { id: 's1', x: 0, y: 0, width: 62, height: 100 },
        { id: 's2', x: 62, y: 0, width: 38, height: 50 },
        { id: 's3', x: 62, y: 50, width: 38, height: 50 },
    ],
});

/** Fold panoramic strip, 2.39:1 cinematic: three equal widescreen slots. */
TEMPLATES.push({
    id: 'panoramic-strip',
    name: 'Panoramic Strip',
    aspectRatio: 2.39,
    style: 'clean',
    foldTokens: FOLD_TOKENS,
    slots: [
        { id: 's1', x: 0, y: 0, width: 33.33, height: 100 },
        { id: 's2', x: 33.33, y: 0, width: 33.33, height: 100 },
        { id: 's3', x: 66.66, y: 0, width: 33.34, height: 100 },
    ],
});

/** Fold panoramic quad strip, 16:9: four widescreen slots for hero banners. */
TEMPLATES.push({
    id: 'panoramic-strip-quad',
    name: 'Panoramic Quad',
    aspectRatio: 16 / 9,
    style: 'clean',
    foldTokens: FOLD_TOKENS,
    slots: [
        { id: 's1', x: 0, y: 0, width: 25, height: 100 },
        { id: 's2', x: 25, y: 0, width: 25, height: 100 },
        { id: 's3', x: 50, y: 0, width: 25, height: 100 },
        { id: 's4', x: 75, y: 0, width: 25, height: 100 },
    ],
});

// ==================== POSTER / PUBLICATION PRESETS (MJ-072) ====================

/**
 * High-DPI editorial poster templates. `aspectRatio` is derived from
 * `canvasResolution` so the ratio and the rasterization size can never drift,
 * and `resolveExportDimensions` rasterizes at the exact canvas size when no
 * aspect override is set.
 */
export const POSTER_TEMPLATES: CollageTemplate[] = [
    {
        id: 'editorial-a4-portrait',
        name: 'A4 Editorial 300 DPI',
        aspectRatio: 2480 / 3508,
        style: 'clean',
        foldTokens: FOLD_TOKENS,
        canvasResolution: { width: 2480, height: 3508, dpi: 300 },
        slots: [
            { id: 's1', x: 0, y: 0, width: 100, height: 57 },
            { id: 's2', x: 0, y: 57, width: 50, height: 43 },
            { id: 's3', x: 50, y: 57, width: 50, height: 43 },
        ],
    },
    {
        id: 'editorial-spread-4k',
        name: '4K Editorial Spread',
        aspectRatio: 16 / 9,
        style: 'clean',
        foldTokens: FOLD_TOKENS,
        canvasResolution: { width: 3840, height: 2160 },
        slots: [
            { id: 's1', x: 0, y: 0, width: 38, height: 100 },
            { id: 's2', x: 38, y: 0, width: 62, height: 33.33 },
            { id: 's3', x: 38, y: 33.33, width: 62, height: 33.33 },
            { id: 's4', x: 38, y: 66.66, width: 62, height: 33.34 },
        ],
    },
    {
        id: 'social-master-square',
        name: 'Social Master 2048',
        aspectRatio: 1,
        style: 'clean',
        foldTokens: FOLD_TOKENS,
        canvasResolution: { width: 2048, height: 2048 },
        slots: [
            { id: 's1', x: 0, y: 0, width: 50, height: 50 },
            { id: 's2', x: 50, y: 0, width: 50, height: 50 },
            { id: 's3', x: 0, y: 50, width: 50, height: 50 },
            { id: 's4', x: 50, y: 50, width: 50, height: 50 },
        ],
    },
];
TEMPLATES.push(...POSTER_TEMPLATES);

/**
 * Get the best default template for a given photo count
 */
export function getDefaultTemplate(count: number): CollageTemplate {
    // Find exact match first
    const exact = TEMPLATES.find((t) => t.slots.length === count);
    if (exact) return exact;

    // Find closest smaller match
    const smaller = TEMPLATES
        .filter((t) => t.slots.length <= count)
        .sort((a, b) => b.slots.length - a.slots.length);

    return smaller[0] || TEMPLATES[0];
}
