import fs from 'node:fs';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const MAIN_PATH = path.join(ROOT, 'dist', 'main', 'main.mjs');
const PRELOAD_PATH = path.join(ROOT, 'dist', 'main', 'preload.cjs');

const START_TIMEOUT_MS = 120_000;
const POLL_MS = 250;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fileReady(p) {
  try {
    const st = fs.statSync(p);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

function fileMtimeMs(p) {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

async function waitForStableFiles(timeoutMs, stableMs = 2000) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const m1 = fileMtimeMs(MAIN_PATH);
    const m2 = fileMtimeMs(PRELOAD_PATH);
    if (m1 && m2) {
      await sleep(stableMs);
      const n1 = fileMtimeMs(MAIN_PATH);
      const n2 = fileMtimeMs(PRELOAD_PATH);
      if (m1 === n1 && m2 === n2) return;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for stable build outputs`);
    }
    await sleep(POLL_MS);
  }
}

async function waitForHttp(url, timeoutMs) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.resume();
          res.statusCode && res.statusCode >= 200 && res.statusCode < 500
            ? resolve()
            : reject(new Error(`HTTP ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(1500, () => req.destroy(new Error('timeout')));
      });
      return;
    } catch {
      if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${url}`);
      await sleep(POLL_MS);
    }
  }
}

async function waitForFiles(timeoutMs) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ok = fileReady(MAIN_PATH) && fileReady(PRELOAD_PATH);
    if (ok) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timed out waiting for build outputs:\n- ${MAIN_PATH}\n- ${PRELOAD_PATH}`
      );
    }
    await sleep(POLL_MS);
  }
}

async function waitForFreshFiles(timeoutMs, initialMainMtime, initialPreloadMtime) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const mainOk = fileReady(MAIN_PATH) && fileMtimeMs(MAIN_PATH) > initialMainMtime;
    const preloadOk =
      fileReady(PRELOAD_PATH) && fileMtimeMs(PRELOAD_PATH) > initialPreloadMtime;
    if (mainOk && preloadOk) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timed out waiting for fresh build outputs (tsup first build):\n- ${MAIN_PATH}\n- ${PRELOAD_PATH}`
      );
    }
    await sleep(POLL_MS);
  }
}

function resolveElectronmonBin() {
  // Spawning `.cmd` shims can throw `EINVAL` on some Windows setups.
  // Use the actual JS entrypoint and spawn with Node instead.
  return path.join(ROOT, 'node_modules', 'electronmon', 'bin', 'cli.js');
}

async function main() {
  const initialMainMtime = fileMtimeMs(MAIN_PATH);
  const initialPreloadMtime = fileMtimeMs(PRELOAD_PATH);

  // Vite first, then tsup outputs.
  await waitForHttp('http://localhost:1212', START_TIMEOUT_MS);
  await waitForFiles(START_TIMEOUT_MS);

  // In the "dev-fast" flow we already ran a one-shot build. Don't block startup on the first watch rebuild.
  const skipStabilityWait = process.env.DEV_FAST === 'true';
  if (!skipStabilityWait) {
    // Ensure we don't start Electron against stale dist files from a previous run,
    // otherwise tsup's first build will trigger an immediate electronmon restart.
    await waitForFreshFiles(START_TIMEOUT_MS, initialMainMtime, initialPreloadMtime);
    // tsup watch often does a second write shortly after first output; wait until files stop changing
    // so electronmon doesn't immediately restart the app.
    await waitForStableFiles(START_TIMEOUT_MS, 2000);
  }

  // Give the filesystem a beat to settle (avoid "exists but still being replaced").
  await sleep(250);

  const electronmonCli = resolveElectronmonBin();
  const child = spawn(process.execPath, [electronmonCli, 'dist/main/main.mjs'], {
    stdio: 'inherit',
    cwd: ROOT,
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error('[dev-electron] failed to start:', err?.stack || err);
  process.exit(1);
});

