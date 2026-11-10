/**
 * MJ-072 magnetic canvas snapping engine (pure, no DOM).
 *
 * Slot rects are the photo edges on the canvas, and the only geometry
 * mutation path is layout-divider dragging, so snapping works in divider
 * space: a dragged divider magnetically engages canvas boundaries, canvas
 * center axes, and neighboring slot edges.
 *
 * All positions are percentages (0-100); pixel quantities convert through
 * the canvas length of the axis being dragged.
 */
import type { LayoutDivider } from './layoutGeometry';
import type { SlotPosition } from './templates';

/** Magnetic engagement radius in preview pixels. */
export const SNAP_MAGNET_RADIUS_PX = 8;

/** Gutter standoff tokens: px kept between a snapped edge and a neighbor edge. */
export const SNAP_GUTTER_TOKENS = {
    hairline: 1,
    compact: 8,
    relaxed: 16,
} as const;

export type SnapGutterToken = keyof typeof SNAP_GUTTER_TOKENS;

export type SnapGuideKind = 'canvas-edge' | 'canvas-center' | 'neighbor-edge';

export interface SnapGuide {
    /** 'x' = vertical line at `position`, 'y' = horizontal line. */
    axis: 'x' | 'y';
    position: number;
    kind: SnapGuideKind;
}

export interface SnapResult {
    position: number;
    guide: SnapGuide | null;
}

export interface SnapOptions {
    enabled: boolean;
    gutterToken: SnapGutterToken;
    /** Magnetic radius in px; defaults to SNAP_MAGNET_RADIUS_PX. */
    magnetPx?: number;
}

const EDGE_EPSILON = 0.02;
const round2 = (value: number) => Math.round(value * 100) / 100;

/** Converts a pixel length on the canvas axis into percentage space. */
export function pxToPercent(px: number, canvasLengthPx: number): number {
    if (!Number.isFinite(canvasLengthPx) || canvasLengthPx <= 0) return 0;
    return (px / canvasLengthPx) * 100;
}

/**
 * Ordered, deduplicated snap lines along one axis: canvas boundaries, canvas
 * center, and interior slot edges (canvas boundaries/center win dedup first).
 */
export function collectSnapTargets(slots: SlotPosition[], axis: 'x' | 'y'): SnapGuide[] {
    const extent = (slot: SlotPosition) => (axis === 'x' ? slot.width : slot.height);
    const targets: SnapGuide[] = [
        { axis, position: 0, kind: 'canvas-edge' },
        { axis, position: 50, kind: 'canvas-center' },
        { axis, position: 100, kind: 'canvas-edge' },
    ];
    const edges = new Set<number>();
    for (const slot of slots) {
        for (const edge of [slot[axis], slot[axis] + extent(slot)]) {
            if (edge > EDGE_EPSILON && edge < 100 - EDGE_EPSILON) edges.add(round2(edge));
        }
    }
    for (const edge of [...edges].sort((a, b) => a - b)) {
        if (!targets.some((target) => Math.abs(target.position - edge) < EDGE_EPSILON)) {
            targets.push({ axis, position: edge, kind: 'neighbor-edge' });
        }
    }
    return targets.sort((a, b) => a.position - b.position);
}

const approachSign = (requested: number, target: number) => (requested >= target ? 1 : -1);

/**
 * Snap a dragged divider position. Neighbor-edge engagements apply the gutter
 * standoff in the approach direction (hairline ≈ flush; compact/relaxed leave
 * a visible step); canvas edges and center axes always engage flush.
 * Canvas boundary/center targets are gutter-free because they are alignment
 * lines, not photo edges. Returns the unmodified position when disabled or
 * when no target is inside the magnetic radius.
 */
export function snapDividerPosition(
    slots: SlotPosition[],
    divider: Pick<LayoutDivider, 'axis'>,
    requestedPosition: number,
    canvasLengthPx: number,
    options: SnapOptions,
): SnapResult {
    if (!options.enabled || !Number.isFinite(requestedPosition)) {
        return { position: requestedPosition, guide: null };
    }
    const targets = collectSnapTargets(slots, divider.axis);
    const magnet = pxToPercent(options.magnetPx ?? SNAP_MAGNET_RADIUS_PX, canvasLengthPx);
    let best: SnapGuide | null = null;
    let bestDistance = Infinity;
    for (const target of targets) {
        const distance = Math.abs(target.position - requestedPosition);
        if (distance <= magnet && distance < bestDistance) {
            best = target;
            bestDistance = distance;
        }
    }
    if (!best) return { position: requestedPosition, guide: null };

    const gutterPct = pxToPercent(SNAP_GUTTER_TOKENS[options.gutterToken], canvasLengthPx);
    const standoff = best.kind === 'neighbor-edge' ? gutterPct * approachSign(requestedPosition, best.position) : 0;
    return { position: round2(best.position + standoff), guide: best };
}

/** Guides (subset) that a divider drag would visually light up, for overlays. */
export function guideExtent(divider: Pick<LayoutDivider, 'axis' | 'start' | 'end'>): { start: number; end: number } {
    return { start: divider.start, end: divider.end };
}
