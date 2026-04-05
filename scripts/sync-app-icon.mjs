/**
 * Generates app icons from the source KV mark (assets/kv-icon.png):
 * - assets/icon.png — 1024×1024 for Electron + electron-builder (Windows/macOS/Linux)
 * - src/renderer/public/favicon.png — in-app / dev favicon
 *
 * 1. Tight crop: source is often a circle inside a square with opaque black corners (JPEG, no
 *    alpha). `trim()` cannot remove those corners because the disk reaches the sides, so we crop
 *    using row/column black ratios so the mark fills the output canvas (much more visible on the
 *    Windows taskbar).
 * 2. Black/near-black padding → transparent PNG so the shell can composite instead of a tiny disk
 *    on a huge black square.
 */
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const SRC = path.join(root, 'assets', 'kv-icon.png');
const OUT_ICON = path.join(root, 'assets', 'icon.png');
const OUT_FAVICON = path.join(root, 'src', 'renderer', 'public', 'favicon.png');
const SIZE = 1024;

/** Pixels with all channels ≤ this are treated as “black corner” for crop + alpha. */
const BLACK_LEVEL = 10;
/** Row/column must exceed this fraction of black pixels to be trimmed from that edge. */
const EDGE_BLACK_RATIO = 0.45;

function computeTightSquareCrop(data, width, height, channels) {
  const isBlackPx = (idx) => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return Math.max(r, g, b) <= BLACK_LEVEL;
  };

  const rowBlackFrac = (y) => {
    let n = 0;
    const row = y * width * channels;
    for (let x = 0; x < width; x++) {
      if (isBlackPx(row + x * channels)) n++;
    }
    return n / width;
  };

  const colBlackFrac = (x) => {
    let n = 0;
    for (let y = 0; y < height; y++) {
      if (isBlackPx(y * width * channels + x * channels)) n++;
    }
    return n / height;
  };

  let top = 0;
  while (top < height && rowBlackFrac(top) > EDGE_BLACK_RATIO) top++;
  let bottom = height - 1;
  while (bottom > 0 && rowBlackFrac(bottom) > EDGE_BLACK_RATIO) bottom--;
  let left = 0;
  while (left < width && colBlackFrac(left) > EDGE_BLACK_RATIO) left++;
  let right = width - 1;
  while (right > 0 && colBlackFrac(right) > EDGE_BLACK_RATIO) right--;

  if (bottom <= top || right <= left) return null;

  let cropW = right - left + 1;
  let cropH = bottom - top + 1;
  const side = Math.max(cropW, cropH);
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  let sqLeft = Math.round(cx - side / 2);
  let sqTop = Math.round(cy - side / 2);
  sqLeft = Math.max(0, Math.min(sqLeft, width - side));
  sqTop = Math.max(0, Math.min(sqTop, height - side));
  return { left: sqLeft, top: sqTop, width: side, height: side };
}

function knockoutBlackToTransparent(rgba, width, height) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      if (Math.max(r, g, b) <= BLACK_LEVEL) rgba[i + 3] = 0;
    }
  }
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Missing source icon:', SRC);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(OUT_FAVICON), { recursive: true });

  const base = sharp(SRC).ensureAlpha();
  const { data: rawIn, info } = await base.clone().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;

  let pipeline = sharp(SRC);
  const crop =
    ch >= 3
      ? computeTightSquareCrop(rawIn, w, h, ch)
      : null;

  if (crop && crop.width > 32 && crop.height > 32) {
    pipeline = pipeline.extract(crop);
  } else {
    pipeline = pipeline.trim({ threshold: 14 });
  }

  const { data, info: outInfo } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  knockoutBlackToTransparent(data, outInfo.width, outInfo.height);

  const buf = await sharp(data, {
    raw: { width: outInfo.width, height: outInfo.height, channels: 4 },
  })
    // Slightly brighter midtones so the navy disk reads on dark taskbars (still subtle).
    .modulate({ brightness: 1.07, saturation: 1.04 })
    .resize(SIZE, SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await fs.promises.writeFile(OUT_ICON, buf);
  await fs.promises.writeFile(OUT_FAVICON, buf);

  const meta = await sharp(SRC).metadata();
  const note = crop ? ` crop ${crop.width}×${crop.height}@${crop.left},${crop.top}` : ' (trim fallback)';
  console.log(
    `sync-app-icon: ${path.relative(root, SRC)} (${meta.width}×${meta.height})${note} → icon.png + favicon.png (${SIZE}×${SIZE})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
