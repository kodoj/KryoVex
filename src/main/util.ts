import { app } from 'electron';
import * as path from 'path';
import { URL, pathToFileURL } from 'url';

/**
 * Unpackaged app running in a dev-oriented session (Vite, devtools, relaxed webSecurity).
 * Prefer `ELECTRON_IS_DEV=1` from `npm run dev` so the renderer URL stays correct even when
 * a spawned Electron process does not inherit `NODE_ENV=development` (blank window otherwise).
 */
export function isUnpackagedDevSession(): boolean {
  if (app.isPackaged) return false;
  return (
    process.env.ELECTRON_IS_DEV === '1' ||
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  );
}

/**
 * Resolve the renderer entry URL.
 * Packaged apps always load the on-disk bundle (never localhost), even if NODE_ENV is wrong.
 */
export function resolveHtmlPath(htmlFileName: string): string {
  if (isUnpackagedDevSession()) {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    const name = htmlFileName.replace(/^\/+/, '');
    url.pathname = `/${name}`;
    return url.href;
  }
  return pathToFileURL(path.join(__dirname, '../renderer/', htmlFileName)).href;
}
