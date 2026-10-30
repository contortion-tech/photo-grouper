import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = new URL('../node_modules/browser-image-compression/dist/browser-image-compression.js', import.meta.url);
const destination = new URL('../public/browser-image-compression.js', import.meta.url);

await mkdir(dirname(fileURLToPath(destination)), { recursive: true });
await copyFile(source, destination);
const info = await stat(destination);
console.log(`Compression worker prepared (${info.size} bytes)`);
