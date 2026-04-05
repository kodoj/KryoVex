import { rimraf } from 'rimraf';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const commandMap = {
  dist: path.join(repoRoot, 'dist'),
  release: path.join(repoRoot, 'release'),
  dll: path.join(repoRoot, '.erb', 'dll'),
};

const args = process.argv.slice(2);

args.forEach((x) => {
  const pathToRemove = commandMap[x];
  if (pathToRemove !== undefined) {
    rimraf.sync(pathToRemove);
  }
});
