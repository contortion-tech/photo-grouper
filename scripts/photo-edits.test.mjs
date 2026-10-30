import assert from 'node:assert/strict';
import {
  effectivePhotoScale,
  maxOffsetPct,
  normalizeRotation,
  rotationCoverScale,
} from '../utils/photoEdits.ts';

function coverDimensions(imgAspect, slotW, slotH) {
  return imgAspect >= slotW / slotH
    ? { width: slotH * imgAspect, height: slotH }
    : { width: slotW, height: slotW / imgAspect };
}

function assertCoverage(imgAspect, slotW, slotH, rotation, userScale = 1) {
  const edits = {
    scale: userScale,
    rotation,
    offsetX: 0,
    offsetY: 0,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    blur: 0,
    filter: 'none',
  };
  const base = coverDimensions(imgAspect, slotW, slotH);
  const scale = effectivePhotoScale(edits, imgAspect, slotW, slotH);
  const max = maxOffsetPct(imgAspect, slotW, slotH, userScale, rotation);
  const radians = (normalizeRotation(rotation) * Math.PI) / 180;
  const c = Math.cos(radians);
  const s = Math.sin(radians);

  for (const offsetX of [-max.x, max.x]) {
    for (const offsetY of [-max.y, max.y]) {
      const tx = offsetX * slotW / 100;
      const ty = offsetY * slotH / 100;
      for (const x of [-slotW / 2, slotW / 2]) {
        for (const y of [-slotH / 2, slotH / 2]) {
          const u = c * (x - tx) + s * (y - ty);
          const v = -s * (x - tx) + c * (y - ty);
          assert.ok(Math.abs(u) <= base.width * scale / 2 + 1e-7);
          assert.ok(Math.abs(v) <= base.height * scale / 2 + 1e-7);
        }
      }
    }
  }
}

assert.equal(normalizeRotation(270), -90);
assert.equal(normalizeRotation(-270), 90);
assert.equal(normalizeRotation(540), 180);
assert.equal(rotationCoverScale(1, 300, 300, 0), 1);
assert.ok(rotationCoverScale(1, 300, 300, 45) > 1);

for (const imgAspect of [0.5, 1, 4 / 3, 2]) {
  for (const [slotW, slotH] of [[300, 200], [200, 300], [300, 300]]) {
    for (const rotation of [-180, -135, -90, -45, 0, 30, 45, 90, 135, 180]) {
      assertCoverage(imgAspect, slotW, slotH, rotation, 1);
      assertCoverage(imgAspect, slotW, slotH, rotation, 1.8);
    }
  }
}

console.log('photo edit geometry tests passed');
