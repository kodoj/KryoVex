import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';
import { dependencies } from '../../release/app/package.json' with { type: 'json' };
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPath = path.resolve(__dirname, '../../');
const appNodeModulesPath = path.join(rootPath, 'release', 'app', 'node_modules');

if (
  Object.keys(dependencies || {}).length > 0 &&
  fs.existsSync(appNodeModulesPath)
) {
  const binName = process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild';
  const electronRebuildCmd = `node_modules/.bin/${binName} --parallel --force --types prod,dev,optional --module-dir release/app`;
  const cmd = process.platform === 'win32' ? electronRebuildCmd.replace(/\//g, '\\') : electronRebuildCmd;
  execSync(cmd, { cwd: rootPath, stdio: 'inherit' });
}