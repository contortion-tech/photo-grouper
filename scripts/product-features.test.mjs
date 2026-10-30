import assert from 'node:assert/strict';
import {
  DEFAULT_WORKFLOW,
  WORKFLOW_CONFIGS,
  getWorkflowConfig,
} from '../utils/workflows.ts';
import {
  basePhotoDimensions,
  effectivePhotoScale,
  maxOffsetPct,
  DEFAULT_EDITS,
} from '../utils/photoEdits.ts';
import {
  getExportDimensions,
  getExportFileDetails,
  fitTextToWidth,
} from '../utils/collageGenerator.ts';

assert.deepEqual(getExportDimensions(16 / 9, 1080), { width: 1080, height: 608 });
assert.deepEqual(getExportDimensions(9 / 16, 1080), { width: 608, height: 1080 });
assert.deepEqual(getExportDimensions(1, 4000), { width: 4000, height: 4000 });
assert.deepEqual(getExportFileDetails('png'), {
  mimeType: 'image/png',
  extension: 'png',
  fileName: 'photo-collage.png',
});
assert.deepEqual(getExportFileDetails('jpeg'), {
  mimeType: 'image/jpeg',
  extension: 'jpg',
  fileName: 'photo-collage.jpg',
});

assert.equal(fitTextToWidth('Before', 100, (text) => text.length * 10), 'Before');
assert.equal(fitTextToWidth('A very long comparison label', 80, (text) => text.length * 10), 'A very…');

const coverLandscape = basePhotoDimensions(2, 100, 100, 'cover');
assert.deepEqual(coverLandscape, { width: 200, height: 100 });
const containLandscape = basePhotoDimensions(2, 100, 100, 'contain');
assert.deepEqual(containLandscape, { width: 100, height: 50 });

const containedAt45 = effectivePhotoScale(
  { ...DEFAULT_EDITS, fitMode: 'contain', rotation: 45 },
  2,
  100,
  100,
);
assert.ok(containedAt45 < 1, 'contain mode scales rotated photos down to keep the whole image visible');

const containOffsets = maxOffsetPct(2, 100, 100, 1, 0, 'contain');
assert.deepEqual(containOffsets, { x: 0, y: 25 });

const routes = [
  'before-after-photo-maker',
  'combine-two-photos',
  'side-by-side-photo-maker',
  'merge-images-without-cropping',
  'instagram-story-collage',
];

assert.equal(WORKFLOW_CONFIGS.length, routes.length, 'all configured workflow routes are exported');
assert.deepEqual(WORKFLOW_CONFIGS.map((workflow) => workflow.slug), routes);

const beforeAfter = getWorkflowConfig('before-after-photo-maker');
assert.equal(beforeAfter.photoCount, 2);
assert.equal(beforeAfter.templateId, '2-side-by-side');
assert.equal(beforeAfter.comparisonLabels, true);

const noCrop = getWorkflowConfig('merge-images-without-cropping');
assert.equal(noCrop.photoCount, 2);
assert.equal(noCrop.defaultFitMode, 'contain');

const story = getWorkflowConfig('instagram-story-collage');
assert.equal(story.outputAspectRatio, 9 / 16);
assert.equal(story.photoCount, null);

assert.equal(getWorkflowConfig('unknown-route'), DEFAULT_WORKFLOW);

console.log('product feature tests passed');
