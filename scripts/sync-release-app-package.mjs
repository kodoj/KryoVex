/**
 * Writes release/app/package.json from the root manifest (runtime deps only).
 * Keeps packaged app version/deps aligned with the repo and avoids stale locks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const trimmedPkg = {
  ...pkg,
  main: 'dist/main/main.mjs',
};

delete trimmedPkg.devDependencies;
delete trimmedPkg.scripts;
delete trimmedPkg.build;
delete trimmedPkg.jest;
delete trimmedPkg['lint-staged'];
delete trimmedPkg.husky;
delete trimmedPkg.prettier;
delete trimmedPkg.browserslist;

// Packaged app has no react/react-dom in node_modules (renderer is pre-bundled).
if (trimmedPkg.overrides && typeof trimmedPkg.overrides === 'object') {
  const o = { ...trimmedPkg.overrides };
  delete o['@testing-library/jest-dom'];
  delete o.cheerio;
  delete o.react;
  delete o['react-dom'];
  if (Object.keys(o).length === 0) {
    delete trimmedPkg.overrides;
  } else {
    trimmedPkg.overrides = o;
  }
}

const outDir = path.join(root, 'release', 'app');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'package.json'), `${JSON.stringify(trimmedPkg, null, 2)}\n`);
console.log('sync-release-app-package: wrote release/app/package.json');
