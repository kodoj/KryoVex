import { app } from 'electron';
import * as path from 'path';
import { URL, pathToFileURL } from 'url';

/**
 * Resolve the renderer entry URL.
 * Uses `app.isPackaged` so a stray `NODE_ENV=development` on the user's machine
 * cannot force a packaged build to load localhost (nothing listening → blank window).
 */
export function resolveHtmlPath(htmlFileName: string): string {
  const useViteDevServer =
    !app.isPackaged &&
    (process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true');
  if (useViteDevServer) {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return pathToFileURL(path.join(__dirname, '../renderer/', htmlFileName)).href;
}
