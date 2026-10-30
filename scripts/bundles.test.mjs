import assert from 'node:assert/strict';
import { strToU8, strFromU8, unzipSync, zipSync } from 'fflate';
import { BUNDLE_RATIOS, DEFAULT_BUNDLE_CROP, createBundle, validateBundle, safeBundleName, postingPlacement, flattenBundle, encodeBundleArchive, restoreBundleZip, saveBundle, loadBundle, listBundles } from '../utils/bundles.ts';

const a = new File(['original a exact bytes'], 'a.jpg', { type: 'image/jpeg', lastModified: 1000 });
const b = new File(['original b exact bytes'], 'b.jpg', { type: 'image/jpeg', lastModified: 2000 });
const draft = createBundle([a, b]);
draft.name = 'Opening night';
draft.pages[0].ratio = 'portrait';
draft.pages[0].items[0].crop = { fit: 'cover', zoom: 1.5, x: .2, y: .8 };
assert.equal(draft.version, 2, 'new bundles are v2 multi-page');
assert.equal(draft.items.length, 2);
assert.equal(draft.pages.length, 1, 'two photos form one page');
assert.equal(draft.pages[0].items.length, 2);
assert.equal(draft.pages[0].ratio, 'portrait');
assert.equal(BUNDLE_RATIOS.length, 5);
assert.throws(() => createBundle([]), /incomplete/);
assert.throws(() => createBundle(Array.from({ length: 21 }, () => a)), /incomplete/);
assert.equal(createBundle(Array.from({ length: 10 }, () => new File(['a'], 'a.jpg', { type: 'image/jpeg' }))).pages.length, 2, '10 photos make two pages of 9+1');
assert.throws(() => validateBundle({ ...draft, name: 'x'.repeat(81) }), /incomplete/);
assert.throws(() => validateBundle({ ...draft, pages: [{ ...draft.pages[0], width: '1080' }] }), /page/);
assert.throws(() => validateBundle({ ...draft, pages: [{ ...draft.pages[0], items: [{ ...draft.pages[0].items[0], crop: { ...DEFAULT_BUNDLE_CROP, x: 2 } }] }] }), /crop/);
assert.throws(() => validateBundle({ ...draft, pages: [{ ...draft.pages[0], items: [draft.pages[0].items[0], draft.pages[0].items[0]] }] }), /duplicate/);
assert.equal(safeBundleName('../../Name / test'), 'Name-test');
assert.equal(safeBundleName('...'), 'post-bundle');
const cover = postingPlacement(200, 100, 100, 100, DEFAULT_BUNDLE_CROP);
assert.deepEqual(cover, { x: -50, y: 0, width: 200, height: 100 });
assert.deepEqual(postingPlacement(200, 100, 100, 100, { fit: 'cover', zoom: 2, x: 1, y: 0 }), { x: -300, y: 0, width: 400, height: 200 });
assert.deepEqual(postingPlacement(200, 100, 100, 100, { fit: 'contain', zoom: 3, x: 0, y: 1 }), { x: 0, y: 25, width: 100, height: 50 });
assert.throws(() => postingPlacement(0, 100, 100, 100, DEFAULT_BUNDLE_CROP), /dimensions/);
const sheet = new Blob(['contact sheet fixture'], { type: 'image/jpeg' });
const blob = await encodeBundleArchive(draft, undefined, [sheet]);
const zipFile = new File([blob], 'backup.zip');
const unpacked = unzipSync(new Uint8Array(await blob.arrayBuffer()));
assert.equal(strFromU8(unpacked['images/01_a.jpg']), await a.text());
const manifest = JSON.parse(strFromU8(unpacked['bundle.json']));
assert.equal(manifest.version, 2);
assert.equal(manifest.pages.length, 1);
assert.equal(manifest.pages[0].items[0].fileName, 'a.jpg');
assert.equal(manifest.pages[0].items[0].sha256.length, 64);
assert.equal(manifest.postingCopies, false);
const restored = await restoreBundleZip(zipFile);
assert.notEqual(restored.id, draft.id, 'restoring never overwrites a draft');
assert.notEqual(restored.items[0].id, draft.items[0].id, 'restored assets receive new IDs');
assert.equal(restored.name, draft.name);
assert.equal(restored.pages[0].ratio, draft.pages[0].ratio);
assert.equal(restored.ratio, draft.pages[0].ratio, 'legacy top-level ratio mirrors page 1');
assert.deepEqual(restored.items[0].crop, draft.items[0].crop);
assert.equal(await restored.items[0].file.text(), await a.text());
assert.equal(restored.items[1].file.lastModified, 2000);
assert.equal(restored.items[1].file.type, 'image/jpeg');
const posting = await encodeBundleArchive(draft, [new Blob(['crop a']), new Blob(['crop b'])], [sheet]);
const postingFiles = unzipSync(new Uint8Array(await posting.arrayBuffer()));
assert.equal(strFromU8(postingFiles['images/01_a.jpg']), 'crop a');
assert.equal(strFromU8(postingFiles['originals/01_a.jpg']), await a.text());
assert.equal(await (await restoreBundleZip(new File([posting], 'post.zip'))).items[0].file.text(), await a.text());
const repack = (files) => new File([zipSync(files, { level: 0 })], 'modified.zip');
const wrongHash = { ...unpacked, 'images/01_a.jpg': strToU8('tampered file content!') };
await assert.rejects(restoreBundleZip(repack(wrongHash)), /integrity/);
const badManifest = JSON.parse(strFromU8(unpacked['bundle.json']));
badManifest.pages[0].items[0].crop.x = 100;
await assert.rejects(restoreBundleZip(repack({ ...unpacked, 'bundle.json': strToU8(JSON.stringify(badManifest)) })), /crop/);
await assert.rejects(restoreBundleZip(repack({ ...unpacked, '../escape.jpg': strToU8('bad') })), /unsafe/);
await assert.rejects(restoreBundleZip(repack({ ...unpacked, 'images/extra.jpg': strToU8('extra') })), /contents/);
await assert.rejects(restoreBundleZip(new File([zipSync(unpacked, { level: 6 })], 'compressed.zip')), /app backup ZIP/);
const corrupt = new Uint8Array(await blob.arrayBuffer());
corrupt[60] ^= 1;
await assert.rejects(restoreBundleZip(new File([corrupt], 'corrupt.zip')), /integrity|ZIP/);
await assert.rejects(restoreBundleZip(new File(['bad'], 'bad.zip')), /ZIP/);
const longName = new File(['a'], `${'a'.repeat(200)}.jpg`, { type: 'image/jpeg' });
const longDraft = createBundle([longName]);
const longZip = await encodeBundleArchive(longDraft, undefined, [sheet]);
const longFiles = Object.keys(unzipSync(new Uint8Array(await longZip.arrayBuffer())));
assert.ok(longFiles.some((name) => name.startsWith('images/') && name.endsWith('.jpg')));
assert.equal((await restoreBundleZip(new File([longZip], 'long.zip'))).items[0].file.name, longName.name);
const twenty = createBundle(Array.from({ length: 20 }, (_, i) => new File([`photo-${i}`], `item-${i}.jpg`, { type: 'image/jpeg' })));
assert.equal(twenty.pages.length, 3, '20 photos split into pages of 9');
const twentyZip = await encodeBundleArchive(twenty, undefined, [sheet, sheet, sheet]);
const twentyRestored = await restoreBundleZip(new File([twentyZip], '20.zip'));
assert.equal(twentyRestored.pages.length, 3);
assert.equal(flattenBundle(twentyRestored).items.length, 20);
assert.equal(await twentyRestored.pages[2].items[1].file.text(), 'photo-19');
console.log('Bundle geometry, schema, byte-exact ZIP restoration, hashes, paths, corruption, pages and 20-image tests passed.');

let closes = 0;
function installStorage(mode) {
  globalThis.indexedDB = { open() {
    const request = {};
    request.result = { close() { closes++; }, transaction() {
      if (mode === 'transactionThrow') throw new Error('transaction failed');
      const tx = { error: new Error('quota abort'), objectStore() { return {
        put() { if (mode === 'putThrow') throw new Error('clone failed'); queueMicrotask(() => { if (mode === 'abort') tx.onabort(); else tx.oncomplete(); }); },
        get() { const result = { result: draft }; queueMicrotask(() => { result.onsuccess(); queueMicrotask(() => tx.onabort()); }); return result; },
        openCursor() { const result = { result: null }; queueMicrotask(() => { result.onsuccess(); queueMicrotask(() => tx.onabort()); }); return result; },
      }; } };
      return tx;
    } };
    queueMicrotask(() => request.onsuccess());
    return request;
  } };
}
try {
  installStorage('putThrow'); await assert.rejects(saveBundle(draft), /clone failed/);
  installStorage('transactionThrow'); await assert.rejects(saveBundle(draft), /transaction failed/);
  installStorage('abort'); await assert.rejects(saveBundle(draft), /quota abort/);
  installStorage('success'); await saveBundle(draft);
  installStorage('abort'); await assert.rejects(loadBundle(draft.id), /quota abort/);
  installStorage('abort'); await assert.rejects(listBundles(), /quota abort/);
  assert.equal(closes, 6, 'every tested storage success/failure closes its database');
} finally { delete globalThis.indexedDB; }
console.log('Bundle storage complete/abort/synchronous failure and cleanup tests passed.');

const genericFile = new File(['generic JPEG bytes'], 'generic.jpg', { type: 'application/octet-stream', lastModified: -1000 });
const genericDraft = createBundle([genericFile]);
const genericZip = await encodeBundleArchive(genericDraft, undefined, [sheet]);
const genericRestored = await restoreBundleZip(new File([genericZip], 'generic.zip'));
assert.equal(genericRestored.items[0].file.type, 'application/octet-stream');
assert.equal(genericRestored.items[0].file.lastModified, -1000);
assert.equal(await genericRestored.items[0].file.text(), await genericFile.text());
assert.throws(() => createBundle([new File(['a'], 'photo.jpg', { type: 'x'.repeat(101) })]), /invalid/);
console.log('Bundle generic MIME and pre-epoch file metadata roundtrip passed.');

// Video clip and campaign plan test
const videoFile = new File(['video stream bytes'], 'clip.mp4', { type: 'video/mp4', lastModified: 3000 });
const photoFile = new File(['photo stream bytes'], 'hero.jpg', { type: 'image/jpeg', lastModified: 4000 });
const campaignDraft = createBundle([videoFile, photoFile]);
campaignDraft.name = 'Summer Campaign';
campaignDraft.pages[0].items[0].title = 'Teaser Reel';
campaignDraft.pages[0].items[0].caption = 'Dropping something special tomorrow ✨ #summer #teaser';
campaignDraft.pages[0].items[1].title = 'Hero Portrait';
campaignDraft.pages[0].items[1].caption = 'First look at the new collection. #fashion #portrait';

const campaignZipBlob = await encodeBundleArchive(campaignDraft, undefined, [sheet]);
const campaignUnpacked = unzipSync(new Uint8Array(await campaignZipBlob.arrayBuffer()));
assert.ok(campaignUnpacked['POSTING_PLAN.md'], 'POSTING_PLAN.md was generated');
const postingPlanText = strFromU8(campaignUnpacked['POSTING_PLAN.md']);
assert.ok(postingPlanText.includes('Summer Campaign'));
assert.ok(postingPlanText.includes('Reel / Video'));
assert.ok(postingPlanText.includes('Feed Photo'));
assert.ok(postingPlanText.includes('Dropping something special tomorrow ✨'));
assert.ok(postingPlanText.includes('First look at the new collection.'));

const campaignRestored = await restoreBundleZip(new File([campaignZipBlob], 'campaign.zip'));
assert.equal(campaignRestored.items.length, 2);
assert.equal(campaignRestored.items[0].file.name, 'clip.mp4');
assert.equal(campaignRestored.items[0].file.type, 'video/mp4');
assert.equal(campaignRestored.items[0].title, 'Teaser Reel');
assert.equal(campaignRestored.items[0].caption, 'Dropping something special tomorrow ✨ #summer #teaser');
assert.equal(campaignRestored.items[1].title, 'Hero Portrait');
assert.equal(campaignRestored.items[1].caption, 'First look at the new collection. #fashion #portrait');
console.log('Video clip bundle and campaign plan generation roundtrip passed.');

