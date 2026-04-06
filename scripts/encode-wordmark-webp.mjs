/**
 * Regenerate `src/renderer/assets/kryovex-wordmark.webp` from the PNG source.
 * Run after updating the PNG: `npm run asset:wordmark-webp`
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const png = path.join(root, 'src/renderer/assets/kryovex-wordmark.png');
const webp = path.join(root, 'src/renderer/assets/kryovex-wordmark.webp');

await sharp(png).webp({ quality: 88, effort: 4 }).toFile(webp);
console.log('asset:wordmark-webp wrote', path.relative(root, webp));
