import assert from 'node:assert/strict';
import { TEMPLATES, POSTER_TEMPLATES } from '../utils/templates.ts';
import { getLayoutDividers, moveLayoutDivider } from '../utils/layoutGeometry.ts';
import {
    collectSnapTargets,
    pxToPercent,
    snapDividerPosition,
    SNAP_MAGNET_RADIUS_PX,
    SNAP_GUTTER_TOKENS,
} from '../utils/canvasSnapping.ts';
import {
    getExportDimensions,
    resolveExportDimensions,
    MAX_EXPORT_LONG_EDGE,
    MAX_EXPORT_PIXELS,
} from '../utils/collageGenerator.ts';

/* ==================== magnetic snapping engine ==================== */

const CANVAS_PX = 448;
const magnetPct = pxToPercent(SNAP_MAGNET_RADIUS_PX, CANVAS_PX);
assert.ok(Math.abs(magnetPct - 8 / 448 * 100) < 1e-9, 'magnet radius percent conversion');
assert.equal(pxToPercent(8, 0), 0, 'zero-length canvas is safe');

// Target collection: canvas boundaries + center + deduped interior edges.
const asymmetricSlots = [
    { id: 'a', x: 0, y: 0, width: 62, height: 100 },
    { id: 'b', x: 62, y: 0, width: 38, height: 100 },
];
const xTargets = collectSnapTargets(asymmetricSlots, 'x');
assert.deepEqual(xTargets.map((t) => t.position), [0, 50, 62, 100]);
assert.deepEqual(xTargets.map((t) => t.kind), ['canvas-edge', 'canvas-center', 'neighbor-edge', 'canvas-edge']);
// Canvas center wins dedup over a coinciding neighbor edge.
const quadSlots = [
    { id: 'a', x: 0, y: 0, width: 50, height: 50 },
    { id: 'b', x: 50, y: 0, width: 50, height: 50 },
    { id: 'c', x: 0, y: 50, width: 50, height: 50 },
    { id: 'd', x: 50, y: 50, width: 50, height: 50 },
];
for (const axis of ['x', 'y']) {
    const targets = collectSnapTargets(quadSlots, axis);
    assert.equal(targets.filter((t) => Math.abs(t.position - 50) < 0.1).length, 1, `${axis} center deduped`);
    assert.equal(targets.find((t) => Math.abs(t.position - 50) < 0.1).kind, 'canvas-center');
}

// Magnetic threshold: engages inside the radius, passes through outside.
const snap = (slots, divider, position, canvasPx, gutterToken = 'hairline', enabled = true) =>
    snapDividerPosition(slots, divider, position, canvasPx, { enabled, gutterToken });
const dividerX = { axis: 'x', start: 0, end: 100 };
assert.equal(snap(quadSlots, dividerX, 51.5, CANVAS_PX).position, 50, 'inside radius snaps to center axis');
assert.equal(snap(quadSlots, dividerX, 51.7, CANVAS_PX).guide.position, 50);
assert.equal(snap(quadSlots, dividerX, 52.5, CANVAS_PX).position, 52.5, 'outside radius passes through');
assert.equal(snap(quadSlots, dividerX, 52.5, CANVAS_PX).guide, null);
assert.equal(snap(quadSlots, dividerX, 51, CANVAS_PX, 'hairline', false).position, 51, 'disabled = passthrough');
assert.equal(snap(quadSlots, dividerX, Number.NaN, CANVAS_PX).position, Number.NaN, 'non-finite guarded');

// Coordinate rounding: snapped results carry at most 2 decimals.
for (const position of [49.6, 50.4, 61.93, 62.4]) {
    const result = snap(asymmetricSlots, dividerX, position, CANVAS_PX);
    const decimals = String(result.position).split('.')[1]?.length ?? 0;
    assert.ok(decimals <= 2, `rounding for ${position}`);
}

// Gutter standoffs on a real neighbor edge (62), approach-direction aware.
const round2 = (value) => Math.round(value * 100) / 100;
const hairlinePct = pxToPercent(SNAP_GUTTER_TOKENS.hairline, CANVAS_PX);
const compactPct = pxToPercent(SNAP_GUTTER_TOKENS.compact, CANVAS_PX);
const relaxedPct = pxToPercent(SNAP_GUTTER_TOKENS.relaxed, CANVAS_PX);
const neighborSnap = snap(asymmetricSlots, dividerX, 62, CANVAS_PX);
assert.equal(neighborSnap.guide.kind, 'neighbor-edge');
assert.equal(neighborSnap.position, round2(62 + hairlinePct), 'exact hit from the right side keeps the hairline standoff');
assert.equal(snap(asymmetricSlots, dividerX, 61.7, CANVAS_PX, 'hairline').position, round2(62 - hairlinePct));
assert.equal(snap(asymmetricSlots, dividerX, 62.3, CANVAS_PX, 'compact').position, round2(62 + compactPct));
assert.equal(snap(asymmetricSlots, dividerX, 61.2, CANVAS_PX, 'relaxed').position, round2(62 - relaxedPct));
// Canvas boundary and center axes always engage flush (no gutter standoff).
assert.equal(snap(asymmetricSlots, dividerX, 0.3, CANVAS_PX, 'relaxed').position, 0);
assert.equal(snap(asymmetricSlots, dividerX, 99.7, CANVAS_PX, 'relaxed').position, 100);
assert.equal(snap(asymmetricSlots, dividerX, 49.8, CANVAS_PX, 'relaxed').position, 50);

// Integration with real layout dividers: snapping then clamping stays valid.
const gridTemplate = TEMPLATES.find((t) => t.id === '4-grid');
for (const divider of getLayoutDividers(gridTemplate.slots)) {
    for (const request of [divider.position + 1.2, divider.position - 1.2, divider.position + 6]) {
        const snapped = snap(gridTemplate.slots, divider, request, CANVAS_PX, 'compact');
        const updated = moveLayoutDivider(gridTemplate.slots, divider, snapped.position);
        assert.ok(updated.every((slot) => slot.x >= 0 && slot.x + slot.width <= 100.0001), 'snap+clamp stays in bounds');
    }
}

/* ==================== high-DPI poster presets ==================== */

assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length, 'template id uniqueness');
assert.deepEqual(POSTER_TEMPLATES.map((t) => t.id), ['editorial-a4-portrait', 'editorial-spread-4k', 'social-master-square']);

function checkPosterGeometry(template) {
    const slots = template.slots;
    assert.equal(new Set(slots.map((s) => s.id)).size, slots.length);
    const area = slots.reduce((sum, s) => sum + s.width * s.height, 0);
    assert.ok(Math.abs(area - 10000) < 0.001, `${template.id} full coverage`);
    for (const slot of slots) {
        assert.ok(slot.x >= 0 && slot.y >= 0 && slot.width >= 10 && slot.height >= 10);
        assert.ok(slot.x + slot.width <= 100.0001 && slot.y + slot.height <= 100.0001);
    }
    assert.ok(getLayoutDividers(slots).length > 0, `${template.id} resizable`);
}
for (const template of POSTER_TEMPLATES) {
    checkPosterGeometry(template);
    const { width, height, dpi } = template.canvasResolution;
    assert.ok(Math.abs(template.aspectRatio - width / height) < 1e-9, `${template.id} aspect = resolution ratio`);
    if (template.id === 'editorial-a4-portrait') assert.equal(dpi, 300);
}

// Exact rasterization: 1x hits the poster canvas precisely.
const a4 = POSTER_TEMPLATES[0];
const spread = POSTER_TEMPLATES[1];
const social = POSTER_TEMPLATES[2];
const noOverride = null;
const baseOptions = { format: 'png', width: 2000 };
assert.deepEqual(resolveExportDimensions(a4, noOverride, baseOptions), { width: 2480, height: 3508, clamped: false, base: 'canvas-resolution' });
assert.deepEqual(resolveExportDimensions(spread, noOverride, baseOptions), { width: 3840, height: 2160, clamped: false, base: 'canvas-resolution' });
assert.deepEqual(resolveExportDimensions(social, noOverride, baseOptions), { width: 2048, height: 2048, clamped: false, base: 'canvas-resolution' });

// 2x stays under the guard; 3x clamps while preserving aspect.
const a4x2 = resolveExportDimensions(a4, noOverride, { ...baseOptions, exportMultiplier: 2 });
assert.deepEqual([a4x2.width, a4x2.height, a4x2.clamped], [4960, 7016, false]);
const a4x3 = resolveExportDimensions(a4, noOverride, { ...baseOptions, exportMultiplier: 3 });
assert.equal(a4x3.clamped, true, '3x A4 exceeds the pixel guard');
assert.ok(a4x3.width * a4x3.height <= MAX_EXPORT_PIXELS * 1.001, 'guard cap respected');
assert.ok(Math.abs(a4x3.width / a4x3.height - 2480 / 3508) / (2480 / 3508) < 0.01, 'aspect preserved under clamp');
assert.ok(a4x3.width <= MAX_EXPORT_LONG_EDGE && a4x3.height <= MAX_EXPORT_LONG_EDGE);
const spreadX2 = resolveExportDimensions(spread, noOverride, { ...baseOptions, exportMultiplier: 2 });
assert.deepEqual([spreadX2.width, spreadX2.height, spreadX2.clamped], [7680, 4320, false]);
const spreadX3 = resolveExportDimensions(spread, noOverride, { ...baseOptions, exportMultiplier: 3 });
assert.equal(spreadX3.clamped, true);
assert.ok(spreadX3.width * spreadX3.height <= MAX_EXPORT_PIXELS * 1.001);
assert.ok(Math.abs(spreadX3.width / spreadX3.height - 16 / 9) / (16 / 9) < 0.01);

// Aspect override wins over the poster resolution (classic path).
const overridden = resolveExportDimensions(a4, 1, { ...baseOptions, exportMultiplier: 2 });
assert.equal(overridden.base, 'aspect-width');
assert.deepEqual([overridden.width, overridden.height], [4000, 4000]);
// Classic path unchanged at 1x; multiplier scales beyond the legacy cap with
// the guard still protecting the result.
const quad = resolveExportDimensions(gridTemplate, noOverride, baseOptions);
assert.deepEqual([quad.width, quad.height], [2000, 2000]);
const quadX3 = resolveExportDimensions(gridTemplate, noOverride, { ...baseOptions, exportMultiplier: 3 });
assert.deepEqual([quadX3.width, quadX3.height, quadX3.clamped], [6000, 6000, false]);
assert.ok(quadX3.width * quadX3.height <= MAX_EXPORT_PIXELS * 1.001);
const tallX3 = resolveExportDimensions(gridTemplate, 0.5, { format: 'jpeg', width: 4000, exportMultiplier: 3 });
assert.equal(tallX3.clamped, true, '3x portrait 4000px selection hits the pixel guard');
assert.ok(tallX3.width <= MAX_EXPORT_LONG_EDGE && tallX3.height <= MAX_EXPORT_LONG_EDGE);
assert.ok(Math.abs(tallX3.width / tallX3.height - 0.5) / 0.5 < 0.01, 'portrait aspect preserved');
// Legacy helper untouched.
assert.deepEqual(getExportDimensions(0.5, 2000), { width: 1000, height: 2000 });
assert.deepEqual(getExportDimensions(2, 5000), { width: 4000, height: 2000 });
assert.deepEqual(getExportDimensions(1, 800), { width: 800, height: 800 });

// Poster templates participate in the normal selection paths.
assert.ok(TEMPLATES.includes(social));
assert.ok(getLayoutDividers(a4.slots).some((d) => d.axis === 'y'), 'A4 has a horizontal divider');
for (const template of POSTER_TEMPLATES) {
    assert.ok(template.foldTokens?.gap >= 1, `${template.id} hairline token`);
}

console.log('Snapping: magnet radius, gutter standoffs, rounding, divider integration, poster resolution math and guards passed.');
