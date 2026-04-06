import type { Extension } from 'electron';
import { session } from 'electron';

type DownloadChromeExtension = (
  chromeStoreID: string,
  opts?: { forceDownload?: boolean; attempts?: number }
) => Promise<string>;

let downloadChromeExtensionCached: DownloadChromeExtension | undefined;

async function getDownloadChromeExtension(): Promise<DownloadChromeExtension> {
  if (!downloadChromeExtensionCached) {
    const mod = (await import(
      'electron-devtools-installer/dist/downloadChromeExtension.js'
    )) as { downloadChromeExtension: DownloadChromeExtension };
    downloadChromeExtensionCached = mod.downloadChromeExtension;
  }
  return downloadChromeExtensionCached;
}

/** Chrome Web Store id for React Developer Tools (same as `electron-devtools-installer`). */
const REACT_DEVTOOLS_ID = 'fmkadmapgofadopljbjfkapdkoienihi';

/**
 * Installs React DevTools using `session.extensions` (Electron 39+) to avoid deprecated
 * `session.getAllExtensions` / `session.loadExtension` warnings from `installExtension()`.
 *
 * Uses dynamic `import()` for the downloader so we do not emit a second top-level
 * `createRequire` (tsup already injects one in the main bundle banner).
 */
export async function installReactDevTools(): Promise<void> {
  const extApi = session.defaultSession.extensions;
  let existing = extApi.getAllExtensions().find((e: Extension) => e.id === REACT_DEVTOOLS_ID);

  if (existing && process.env.REACT_DEVTOOLS_FORCE === '1') {
    const toRemove = existing;
    await new Promise<void>((resolve) => {
      const handler = (_evt: unknown, unloaded: Extension) => {
        if (unloaded.id === toRemove.id) {
          extApi.off('extension-unloaded', handler);
          resolve();
        }
      };
      extApi.on('extension-unloaded', handler);
      extApi.removeExtension(toRemove.id);
    });
    existing = undefined;
  }

  if (existing) return;

  const downloadChromeExtension = await getDownloadChromeExtension();
  const folder = await downloadChromeExtension(REACT_DEVTOOLS_ID, {
    forceDownload: process.env.REACT_DEVTOOLS_FORCE === '1',
  });
  await extApi.loadExtension(folder, { allowFileAccess: true });
}
