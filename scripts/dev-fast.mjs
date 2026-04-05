import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();

async function freePort1212() {
  if (process.platform !== 'win32') return;

  const netstat = await runOnceCapture('cmd.exe', ['/c', 'netstat -ano'], { cwd: ROOT });
  const line = netstat
    .split(/\r?\n/)
    .find((l) => l.includes(':1212') && /LISTENING/i.test(l));
  if (!line) return;

  const pidStr = line.trim().split(/\s+/).pop() ?? '';
  const pid = Number(pidStr);
  if (!Number.isFinite(pid) || pid <= 0) return;

  // Best-effort; ignore failure.
  try {
    await runOnce('cmd.exe', ['/c', 'taskkill', '/PID', String(pid), '/F'], {
      cwd: ROOT,
      env: process.env,
    });
  } catch {
    // ignore
  }
}

function withBinPath(env) {
  const bin = path.join(ROOT, 'node_modules', '.bin');
  const sep = process.platform === 'win32' ? ';' : ':';
  return { ...env, PATH: `${bin}${sep}${env.PATH ?? ''}` };
}

function runOnce(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

function runOnceCapture(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => (out += d.toString()));
    child.stderr?.on('data', (d) => (err += d.toString()));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited with code ${code}\n${err}`));
    });
  });
}

function spawnBg(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
  child.on('exit', (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
  return child;
}

async function main() {
  await freePort1212();

  // Fast path: do a one-shot tsup build first so Electron can start quickly.
  const tsupCli = path.join(ROOT, 'node_modules', 'tsup', 'dist', 'cli-default.js');
  const viteCli = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

  await runOnce(process.execPath, [tsupCli], {
    cwd: ROOT,
    env: withBinPath(process.env),
  });

  // Now start watchers.
  // Watch only main/preload sources to avoid a slow full-repo scan that can
  // trigger a late first rebuild (and restart electronmon ~30s later).
  spawnBg(process.execPath, [
    tsupCli,
    '--watch',
    'src/main',
    '--ignore-watch',
    'src/renderer',
    '--ignore-watch',
    'src/shared',
    '--ignore-watch',
    'release',
    '--ignore-watch',
    'dist',
  ], {
    cwd: ROOT,
    env: withBinPath(process.env),
  });

  spawnBg(process.execPath, [viteCli], {
    cwd: ROOT,
    env: withBinPath(process.env),
  });

  // Start Electron (waits for Vite + build outputs).
  await runOnce(
    process.execPath,
    [path.join(ROOT, 'scripts', 'wait-electron-dev.mjs')],
    {
      cwd: ROOT,
      env: { ...process.env, DEV_FAST: 'true' },
    }
  );
}

main().catch((err) => {
  console.error('[dev-fast] failed:', err?.stack || err);
  process.exit(1);
});

