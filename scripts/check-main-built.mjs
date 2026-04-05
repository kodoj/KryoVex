/**
 * Ensures `electron .` has a main bundle (dev: use `npm run dev`; prod-like: `npm run build` first).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainMjs = path.join(repoRoot, 'dist', 'main', 'main.mjs');
if (!fs.existsSync(mainMjs)) {
  console.error(
    `[check-main-built] Missing ${mainMjs}\n` +
      '  Run: npm run dev   (recommended)\n' +
      '  or:  npm run build && npm run electron-dev\n'
  );
  process.exit(1);
}
