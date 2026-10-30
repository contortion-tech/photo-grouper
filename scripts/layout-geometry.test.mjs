import assert from 'node:assert/strict';
import { TEMPLATES, EDITORIAL_TEMPLATES } from '../utils/templates.ts';
import { getLayoutDividers, moveLayoutDivider } from '../utils/layoutGeometry.ts';

const area = (slots) => slots.reduce((sum, slot) => sum + slot.width * slot.height, 0);
function checkRectangles(slots) {
    assert.equal(new Set(slots.map((slot) => slot.id)).size, slots.length);
    for (const slot of slots) {
        assert.ok(slot.x >= -0.0001 && slot.y >= -0.0001);
        assert.ok(slot.width >= 9.999 && slot.height >= 9.999);
        assert.ok(slot.x + slot.width <= 100.0001 && slot.y + slot.height <= 100.0001);
    }
    for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
            const a = slots[i], b = slots[j];
            const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
            const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
            assert.ok(overlapX < 0.0001 || overlapY < 0.0001, `${a.id}/${b.id} overlap`);
        }
    }
    assert.ok(Math.abs(area(slots) - 10000) < 0.001, 'full canvas coverage');
}
assert.equal(EDITORIAL_TEMPLATES.length, 24);
assert.equal(new Set(TEMPLATES.map((template) => template.id)).size, TEMPLATES.length);
for (let count = 2; count <= 9; count++) assert.equal(EDITORIAL_TEMPLATES.filter((template) => template.slots.length === count).length, 3);
for (const template of EDITORIAL_TEMPLATES) {
    checkRectangles(template.slots);
    const dividers = getLayoutDividers(template.slots);
    assert.ok(dividers.length > 0, template.id);
    for (const divider of dividers) {
        for (const request of [-100, divider.position + 3, 200]) {
            const updated = moveLayoutDivider(template.slots, divider, request);
            checkRectangles(updated);
            assert.deepEqual(updated.map((slot) => slot.id), template.slots.map((slot) => slot.id));
            const next = getLayoutDividers(updated).find((candidate) => candidate.id === divider.id);
            assert.ok(next, 'divider identity survives movement');
            assert.ok(Math.abs(next.position - Math.max(divider.min, Math.min(divider.max, request))) < 0.0001);
        }
    }
}
const tJunction = TEMPLATES.find((template) => template.id === '3-left-focus');
const local = getLayoutDividers(tJunction.slots).find((divider) => divider.axis === 'y');
assert.ok(local && local.start === 60 && local.end === 100, 'local T junction divider');
const moved = moveLayoutDivider(tJunction.slots, local, 70);
assert.equal(moved[0], tJunction.slots[0], 'unrelated hero remains untouched');
assert.equal(moved[1].height, 70);
assert.equal(moved[2].y, 70);
assert.equal(moved[2].height, 30);
assert.equal(moveLayoutDivider(tJunction.slots, local, NaN), tJunction.slots);
const floating = TEMPLATES.find((template) => template.id === '2-portrait-frame');
assert.equal(getLayoutDividers(floating.slots).length, 0, 'separated frames are not shared boundaries');
console.log('Layout geometry: 24 editorial presets, bounds, coverage, overlap, clamping and T junctions passed.');
