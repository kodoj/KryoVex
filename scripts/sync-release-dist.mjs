/**
 * Copies root `dist/` (main + renderer build) into `release/app/dist/` for electron-builder.
 * Keeps a single build output at repo root so `electron .` works after `npm run build`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'dist');
const dest = path.join(root, 'release', 'app', 'dist');

const mainMjs = path.join(src, 'main', 'main.mjs');
const indexHtml = path.join(src, 'renderer', 'index.html');

if (!fs.existsSync(mainMjs)) {
  console.error('sync-release-dist: expected', mainMjs, '— run npm run build first');
  process.exit(1);
}
if (!fs.existsSync(indexHtml)) {
  console.error('sync-release-dist: expected', indexHtml, '— run npm run build first');
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log('sync-release-dist: copied dist/ → release/app/dist/');
