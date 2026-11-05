import assert from 'node:assert/strict';
import { clusterPhotos, classifyOrientation, computeAspectBreakdown, selectBestTemplate } from '../utils/clustering.ts';
import { TEMPLATES } from '../utils/templates.ts';

let nextPhotoId = 0;
const photo = (filename, width, height, timestamp = null) => ({
  id: `p${nextPhotoId++}`,
  filename,
  width,
  height,
  timestamp,
});
const MIN = 60 * 1000;
const T0 = Date.UTC(2026, 5, 1, 12, 0, 0);

assert.deepEqual(clusterPhotos([]), []);
assert.deepEqual(clusterPhotos(undefined), []);

assert.equal(classifyOrientation(0.8), 'portrait');
assert.equal(classifyOrientation(1.25), 'landscape');
assert.equal(classifyOrientation(1, 0.05), 'square');
assert.equal(classifyOrientation(1.04), 'square');
assert.equal(classifyOrientation(1.06), 'landscape');
assert.equal(classifyOrientation(NaN), 'square');
console.log('orientation classification tests passed');

const scene = [
  photo('a.jpg', 1200, 900, T0),
  photo('b.jpg', 1200, 900, T0 + 60 * 1000),
  photo('c.jpg', 1200, 900, T0 + 20 * MIN),
];
const sceneClusters = clusterPhotos(scene);
assert.equal(sceneClusters.length, 2, 'a 19+ minute gap partitions two scenes');
assert.deepEqual(sceneClusters[0].photos.map((p) => p.filename), ['a.jpg', 'b.jpg']);
assert.deepEqual(sceneClusters[1].photos.map((p) => p.filename), ['c.jpg']);
assert.equal(sceneClusters[0].hasTimestamp, true);
assert.equal(sceneClusters[0].startTimeMs, T0);
assert.equal(sceneClusters[1].startTimeMs, T0 + 20 * MIN);
assert.equal(sceneClusters[1].endTimeMs, T0 + 20 * MIN);

const boundary = clusterPhotos([
  photo('a.jpg', 1200, 900, T0),
  photo('b.jpg', 1200, 900, T0 + 60 * 1000),
  photo('c.jpg', 1200, 900, T0 + 60 * 1000 + 15 * MIN),
]);
assert.equal(boundary.length, 1, 'a gap of exactly 15 minutes stays in one scene');

const tight = clusterPhotos(
  [photo('a.jpg', 1200, 900, T0), photo('b.jpg', 1200, 900, T0 + 4 * MIN)],
  { sceneGapMs: 1000 }
);
assert.equal(tight.length, 1, 'scene gap config is clamped up to the 5 minute minimum');

const wide = clusterPhotos(
  [photo('a.jpg', 1200, 900, T0), photo('b.jpg', 1200, 900, T0 + 6 * MIN)],
  { sceneGapMs: 1000 }
);
assert.equal(wide.length, 2, 'a 6 minute gap splits when the clamped scene gap is 5 minutes');

const oversized = clusterPhotos(
  [
    photo('a.jpg', 1200, 900, T0),
    photo('b.jpg', 1200, 900, T0 + 2 * MIN),
    photo('c.jpg', 1200, 900, T0 + 12 * MIN),
    photo('d.jpg', 1200, 900, T0 + 14 * MIN),
    photo('e.jpg', 1200, 900, T0 + 16 * MIN),
  ],
  { maxUnitsPerCluster: 2 }
);
assert.ok(oversized.every((cluster) => cluster.photos.length <= 2), 'oversized scenes partition into capped clusters');
assert.equal(oversized.length, 3);
assert.deepEqual(oversized[0].photos.map((p) => p.filename), ['a.jpg', 'b.jpg'], 'the first partition lands on the largest internal gap');
assert.deepEqual(oversized[2].photos.map((p) => p.filename), ['d.jpg', 'e.jpg']);
console.log('time-delta scene clustering tests passed');

const burst = clusterPhotos([
  photo('b1.jpg', 1000, 1500, T0),
  photo('b2.jpg', 1000, 1500, T0 + 1000),
  photo('b3.jpg', 1000, 1500, T0 + 2000),
]);
assert.equal(burst.length, 1);
assert.equal(burst[0].bursts.length, 1);
assert.equal(burst[0].bursts[0].isBurst, true, 'photos within 3 seconds group into a burst');
assert.equal(burst[0].bursts[0].candidates.length, 3);
assert.equal(burst[0].bursts[0].durationMs, 2000);
assert.equal(burst[0].bursts[0].startTimeMs, T0);
assert.equal(burst[0].bursts[0].endTimeMs, T0 + 2000);
assert.equal(burst[0].photos.length, 3);
assert.equal(burst[0].effectivePhotos.length, 1, 'a burst collapses to one representative');

const mixedOrientation = clusterPhotos([
  photo('m1.jpg', 1000, 1500, T0),
  photo('m2.jpg', 1500, 1000, T0 + 1000),
  photo('m3.jpg', 1000, 1500, T0 + 2000),
]);
assert.equal(mixedOrientation.length, 1);
assert.equal(mixedOrientation[0].bursts.length, 3, 'orientation changes split a sub-3-second sequence');
assert.ok(mixedOrientation[0].bursts.every((unit) => !unit.isBurst));

const justOutside = clusterPhotos([
  photo('n1.jpg', 1000, 1500, T0),
  photo('n2.jpg', 1000, 1500, T0 + 3001),
]);
assert.equal(justOutside[0].bursts.length, 2, 'a gap of 3.001 seconds is not a burst');
console.log('burst detection tests passed');

const highestRes = clusterPhotos([
  photo('r1.jpg', 1000, 1500, T0),
  photo('r2.jpg', 2000, 3000, T0 + 1000),
  photo('r3.jpg', 1000, 1500, T0 + 2000),
]);
assert.equal(highestRes[0].bursts[0].representative.filename, 'r2.jpg', 'the highest resolution burst photo represents the stack');

const centerTie = clusterPhotos([
  photo('c1.jpg', 1000, 1500, T0),
  photo('c2.jpg', 1000, 1500, T0 + 1000),
  photo('c3.jpg', 1000, 1500, T0 + 2000),
]);
assert.equal(centerTie[0].bursts[0].representative.filename, 'c2.jpg', 'equal resolution ties resolve to the centered photo');

const firstOnTie = clusterPhotos([
  photo('f1.jpg', 2000, 3000, T0),
  photo('f2.jpg', 1000, 1500, T0 + 1000),
  photo('f3.jpg', 2000, 3000, T0 + 2000),
]);
assert.equal(firstOnTie[0].bursts[0].representative.filename, 'f1.jpg', 'outer photos with equal top resolution resolve to the first');

const burstPlusSingle = clusterPhotos([
  photo('s1.jpg', 1000, 1500, T0),
  photo('s2.jpg', 2000, 3000, T0 + 1000),
  photo('s3.jpg', 1000, 1500, T0 + 2000),
  photo('s4.jpg', 1200, 900, T0 + 5 * MIN),
]);
assert.equal(burstPlusSingle.length, 1);
assert.equal(burstPlusSingle[0].photos.length, 4);
assert.equal(burstPlusSingle[0].effectivePhotos.length, 2, 'one burst plus one single yields two effective photos');
assert.equal(burstPlusSingle[0].bursts[0].representative.filename, 's2.jpg');
assert.ok(burstPlusSingle[0].recommendedTemplate.template, 'a template is recommended for the effective set');
assert.ok(burstPlusSingle[0].expandedTemplate.template, 'an expanded template is recommended for every photo');
console.log('burst stacking and representative selection tests passed');

const untimed = clusterPhotos(
  [
    photo('IMG_10.jpg', 1200, 900),
    photo('IMG_1.jpg', 1200, 900),
    photo('IMG_2.jpg', 1200, 900),
  ],
  { maxUnitsPerCluster: 2 }
);
assert.equal(untimed.length, 2, 'untimed photos collate by filename in capped batches');
assert.equal(untimed[0].hasTimestamp, false);
assert.equal(untimed[0].startTimeMs, null);
assert.deepEqual(untimed[0].photos.map((p) => p.filename), ['IMG_1.jpg', 'IMG_2.jpg'], 'numeric filename order (IMG_2 before IMG_10)');
assert.deepEqual(untimed[1].photos.map((p) => p.filename), ['IMG_10.jpg']);

const mixedTimed = clusterPhotos([
  photo('u1.jpg', 1200, 900),
  photo('t1.jpg', 1200, 900, T0),
  photo('u2.jpg', 1200, 900),
  photo('t2.jpg', 1200, 900, T0 + 30 * MIN),
]);
assert.equal(mixedTimed.length, 3);
assert.equal(mixedTimed[0].hasTimestamp, true, 'timed clusters come first');
assert.equal(mixedTimed[2].hasTimestamp, false);
assert.deepEqual(mixedTimed[2].photos.map((p) => p.filename), ['u1.jpg', 'u2.jpg']);

const exifFormats = clusterPhotos([
  photo('e1.jpg', 1200, 900, '2026:06:01 12:00:00'),
  photo('e2.jpg', 1200, 900, '2026:06:01 12:00:01'),
  photo('e3.jpg', 1200, 900, '2026:06:01 12:00:02'),
]);
assert.equal(exifFormats.length, 1, 'EXIF-formatted timestamps parse and cluster');
assert.equal(exifFormats[0].bursts[0].isBurst, true);

const epochSeconds = clusterPhotos([
  photo('sec1.jpg', 1200, 900, T0 / 1000),
  photo('sec2.jpg', 1200, 900, T0 / 1000 + 1),
]);
assert.equal(epochSeconds.length, 1, 'epoch-second timestamps scale to milliseconds');
assert.equal(epochSeconds[0].bursts[0].isBurst, true);
console.log('untimed fallback and timestamp parsing tests passed');

const miniTemplates = [
  { id: 't-1', name: 'Single', aspectRatio: 1, slots: [{ id: 'a', x: 0, y: 0, width: 100, height: 100 }] },
  { id: 't-2-tall', name: 'Tall pair', aspectRatio: 0.5, slots: [{ id: 'a', x: 0, y: 0, width: 50, height: 100 }, { id: 'b', x: 50, y: 0, width: 50, height: 100 }] },
  { id: 't-2-wide', name: 'Wide pair', aspectRatio: 2, slots: [{ id: 'a', x: 0, y: 0, width: 100, height: 50 }, { id: 'b', x: 0, y: 50, width: 100, height: 50 }] },
  { id: 't-4', name: 'Four cell', aspectRatio: 1, slots: [
    { id: 'a', x: 0, y: 0, width: 50, height: 50 },
    { id: 'b', x: 50, y: 0, width: 50, height: 50 },
    { id: 'c', x: 0, y: 50, width: 50, height: 50 },
    { id: 'd', x: 50, y: 50, width: 50, height: 50 },
  ] },
];

const portraitPair = selectBestTemplate(
  [photo('pp1.jpg', 900, 1600), photo('pp2.jpg', 900, 1600)],
  miniTemplates
);
assert.equal(portraitPair.templateId, 't-2-tall', 'portrait photos match the template with tall slots');

const landscapePair = selectBestTemplate(
  [photo('lp1.jpg', 1600, 900), photo('lp2.jpg', 1600, 900)],
  miniTemplates
);
assert.equal(landscapePair.templateId, 't-2-wide', 'landscape photos match the template with wide slots');

const fourPhotos = selectBestTemplate(
  [photo('q1.jpg', 1600, 900), photo('q2.jpg', 1600, 900), photo('q3.jpg', 1600, 900), photo('q4.jpg', 1600, 900)],
  miniTemplates
);
assert.equal(fourPhotos.templateId, 't-4', 'slot-count coverage outweighs a two-slot layout with better aspect pairing');
assert.equal(fourPhotos.slotCountDelta, 0);

const emptyTemplates = selectBestTemplate([photo('z.jpg', 100, 100)], []);
assert.equal(emptyTemplates.templateId, 'default-single');
assert.equal(emptyTemplates.template, null);

const landscapeQuad = clusterPhotos([
  photo('w1.jpg', 1600, 900, T0),
  photo('w2.jpg', 1600, 900, T0 + 1000),
  photo('w3.jpg', 1600, 900, T0 + 2 * MIN),
  photo('w4.jpg', 1600, 900, T0 + 3 * MIN),
]);
assert.equal(landscapeQuad.length, 1);
const quadRecommendation = landscapeQuad[0].recommendedTemplate;
assert.ok(quadRecommendation.template, 'a real template is recommended against COLLAGE_TEMPLATES');
assert.ok(TEMPLATES.some((tpl) => tpl.id === quadRecommendation.templateId), 'the recommendation names a real template');
assert.ok(quadRecommendation.score > 0 && quadRecommendation.score <= 1, 'the recommendation score stays normalized in (0, 1]');
console.log('template recommendation tests passed');

const breakdown = computeAspectBreakdown([
  photo('d1.jpg', 900, 1600),
  photo('d2.jpg', 900, 1600),
  photo('d3.jpg', 1600, 900),
  photo('d4.jpg', 1000, 1000),
]);
assert.deepEqual(
  { portrait: breakdown.portrait, landscape: breakdown.landscape, square: breakdown.square, dominant: breakdown.dominant },
  { portrait: 2, landscape: 1, square: 1, dominant: 'portrait' }
);
assert.ok(Math.abs(breakdown.portraitRatio - 0.5) < 1e-9);
console.log('aspect breakdown tests passed');

console.log('clustering engine tests passed');
