import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PG_HANDOFF_INTAKE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-handoff-test-'));
process.env.PG_FCL_BASE = 'http://127.0.0.1:1';
process.env.PG_FRAMECROP_BASE = 'http://127.0.0.1:1';

const { POST } = await import('../app/api/handoff/route.ts');

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PNG_DATA_URI = `data:image/png;base64,${PNG_1PX.toString('base64')}`;
const intake = process.env.PG_HANDOFF_INTAKE_DIR;

const post = body => POST(new Request('http://127.0.0.1:3000/api/handoff', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
}));
const intakeCount = () => fs.readdirSync(intake).length;

let response = await post({ target: 'uploadqueue', imageData: PNG_DATA_URI, fileName: 'collage one.png', title: 'Test collage' });
let result = await response.json();
assert.equal(response.status, 200);
assert.equal(result.ok, true);
assert.equal(result.delivered, 'uploadqueue');
const written = path.join(intake, 'collage one.png');
assert.ok(fs.existsSync(written), 'staged file exists');
assert.deepEqual(fs.readFileSync(written), PNG_1PX, 'byte integrity');
const sidecarPath = `${written}.upqueue.json`;
assert.ok(fs.existsSync(sidecarPath), 'sidecar exists');
const manifest = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
assert.deepEqual(Object.keys(manifest), ['schema', 'version', 'source', 'fileName', 'filePath', 'sizeBytes', 'mediaType', 'title', 'exportedAt']);
assert.equal(manifest.schema, 'creator-handoff');
assert.equal(manifest.version, 1);
assert.equal(manifest.source, 'photo-grouper');
assert.equal(manifest.fileName, 'collage one.png');
assert.equal(manifest.filePath, written);
assert.equal(manifest.sizeBytes, PNG_1PX.length);
assert.equal(manifest.mediaType, 'image');
assert.equal(manifest.title, 'Test collage');
assert.ok(!Number.isNaN(Date.parse(manifest.exportedAt)));

response = await post({ target: 'uploadqueue', imageData: PNG_DATA_URI, fileName: 'collage one.png', title: 'Second' });
result = await response.json();
assert.equal(result.ok, true);
assert.equal(path.basename(result.filePath), 'collage one-1.png', 'collision suffix -1');
assert.deepEqual(fs.readFileSync(written), PNG_1PX, 'original never overwritten');
assert.ok(fs.existsSync(`${result.filePath}.upqueue.json`), 'sidecar follows collision name');
assert.deepEqual(fs.readFileSync(`${result.filePath}`), PNG_1PX, 'collision payload byte integrity');

response = await post({ target: 'uploadqueue', imageData: PNG_DATA_URI, fileName: '../../etc/passwd' });
result = await response.json();
assert.equal(result.ok, true);
assert.equal(path.basename(result.filePath), 'passwd.png', 'traversal stripped to basename');
assert.equal(path.dirname(result.filePath), intake, 'stays inside intake directory');

response = await post({ target: 'uploadqueue', imageData: PNG_DATA_URI, fileName: 'sub\\dir\\evil.png' });
result = await response.json();
assert.equal(path.basename(result.filePath), 'evil.png', 'backslash traversal stripped');

response = await post({ target: 'uploadqueue', imageData: PNG_DATA_URI, fileName: '' });
result = await response.json();
assert.equal(path.basename(result.filePath), 'photo-collage.png', 'empty name falls back');

response = await post({ target: 'uploadqueue', imageData: PNG_DATA_URI, fileName: 'no extension here' });
result = await response.json();
assert.ok(/\.png$/.test(result.filePath), 'image extension guaranteed');

const beforeFailures = intakeCount();
response = await post({ target: 'wallhaven', imageData: PNG_DATA_URI });
result = await response.json();
assert.equal(result.ok, false);
assert.match(result.error, /target must be one of/);
response = await post({ target: 'uploadqueue' });
assert.equal((await response.json()).ok, false);
response = await post({ target: 'uploadqueue', imageData: 'data:image/tiff;base64,AAAA' });
assert.equal((await response.json()).ok, false);
response = await post({ target: 'uploadqueue', imageData: '' });
assert.equal((await response.json()).ok, false);
response = await post({ target: 'uploadqueue', imageData: Buffer.alloc(0).toString('base64') });
assert.equal((await response.json()).ok, false);
response = await post('{not json');
assert.equal(response.status, 400);
assert.equal((await response.json()).ok, false);
response = await post({ target: 'uploadqueue', imageData: Buffer.alloc(26 * 1024 * 1024).toString('base64') });
assert.equal(response.status, 413);
assert.equal(intakeCount(), beforeFailures, 'invalid payloads write nothing');

response = await post({ target: 'fileconverter', imageData: PNG_DATA_URI, fileName: 'to-fcl.png' });
result = await response.json();
assert.equal(result.ok, true);
assert.equal(result.staged, true);
assert.match(result.notice, /FCL offline on :3301/);
assert.ok(fs.existsSync(path.join(intake, 'to-fcl.png')));
assert.ok(fs.existsSync(path.join(intake, 'to-fcl.png.upqueue.json')));

response = await post({ target: 'framecrop', imageData: PNG_DATA_URI, fileName: 'to-framecrop.png' });
result = await response.json();
assert.equal(result.ok, true);
assert.equal(result.staged, true);
assert.match(result.notice, /FrameCrop offline on :47823/);

process.env.PG_FCL_BASE = 'http://10.0.0.5:3301';
response = await post({ target: 'fileconverter', imageData: PNG_DATA_URI, fileName: 'nonloopback.png' });
result = await response.json();
assert.equal(result.ok, true);
assert.equal(result.staged, true, 'non-loopback probe is refused, not thrown');

// MJ-072 companion readiness status endpoint (pulse pills data source).
const { GET } = await import('../app/api/handoff/route.ts');
const status = await (await GET()).json();
assert.equal(status.ok, true);
assert.equal(status.framecrop.port, 47823);
assert.equal(status.fileconverter.port, 3301);
assert.equal(status.framecrop.online, false, 'framecrop offline probe');
assert.equal(status.fileconverter.online, false, 'non-loopback FCL base reads offline');
assert.equal(status.framecrop.name, null);

console.log('Handoff: sidecar schema, collision safety, byte integrity, invalid payloads and offline probes passed.');
