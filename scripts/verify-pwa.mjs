import { readFile, stat } from 'node:fs/promises';

const path = new URL('../public/sw.js', import.meta.url);
const [info, contents] = await Promise.all([
  stat(path),
  readFile(path, 'utf8'),
]);

if (info.size === 0 || !contents.includes('precacheAndRoute')) {
  throw new Error('PWA verification failed: public/sw.js is missing a Workbox precache manifest');
}

console.log(`PWA service worker verified (${info.size} bytes)`);
