const PANORAMA_BASE =
  'https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/main/static/panorama/images/';

// Steam’s economy image service (works for both hashed ids and "econ/..." paths).
const STEAM_ECONOMY_IMAGE_BASE =
  'https://steamcommunity-a.akamaihd.net/economy/image/';

const STEAM_SIZE_DEFAULT = '360fx360f';
const STEAM_SIZE_HIDPI = '512fx512f';

/**
 * Trade-up backup data and older payloads use `http://media.steampowered.com/...`.
 * Electron treats those as mixed/insecure next to HTTPS pages, so images fail and show the fallback.
 */
export function ensureHttpsSteamAssetUrl(url: string): string {
  const u = String(url || '').trim();
  if (!u.startsWith('http://')) return u;
  try {
    const { hostname } = new URL(u);
    if (
      hostname === 'steampowered.com' ||
      hostname.endsWith('.steampowered.com') ||
      hostname === 'steamstatic.com' ||
      hostname.endsWith('.steamstatic.com') ||
      hostname === 'steamcommunity.com' ||
      hostname.endsWith('.steamcommunity.com') ||
      hostname.endsWith('akamaihd.net')
    ) {
      return `https://${u.slice('http://'.length)}`;
    }
  } catch {
    /* ignore */
  }
  return u;
}

/** Normalize Steam economy URLs to a solid default size (360² — better than tiny inventory thumbs). */
export function preferLargerSteamEconomyImage(url: string): string {
  const u = ensureHttpsSteamAssetUrl(String(url || '').trim());
  if (!u || u.startsWith('data:')) return u;
  if (!/\/economy\/image\//i.test(u)) return u;
  const [pathPart, ...rest] = u.split('?');
  const query = rest.length ? `?${rest.join('?')}` : '';
  if (/\d+fx\d+f$/i.test(pathPart)) {
    return pathPart.replace(/\/\d+fx\d+f$/i, `/${STEAM_SIZE_DEFAULT}`) + query;
  }
  const join = pathPart.endsWith('/') ? '' : '/';
  return `${pathPart}${join}${STEAM_SIZE_DEFAULT}${query}`;
}

/**
 * `srcSet` so HiDPI / zoomed windows pull a denser bitmap (reduces fuzzy upscaling in the renderer).
 */
export function getSteamEconomySrcSet(url: string): string | undefined {
  const u = String(url || '').trim();
  if (!u || u.startsWith('data:') || !/\/economy\/image\//i.test(u)) return undefined;
  const [pathPart, ...rest] = u.split('?');
  const query = rest.length ? `?${rest.join('?')}` : '';
  const base = pathPart.replace(/\/\d+fx\d+f$/i, '');
  return `${base}/${STEAM_SIZE_DEFAULT}${query} 1x, ${base}/${STEAM_SIZE_HIDPI}${query} 2x`;
}

export const IMAGE_FALLBACK_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#111827"/>
      <stop offset="1" stop-color="#0b1220"/>
    </linearGradient>
  </defs>
  <rect x="6" y="10" width="76" height="68" rx="10" fill="url(#g)" stroke="#334155" stroke-width="3"/>
  <path d="M16 30h56" stroke="#334155" stroke-width="3" stroke-linecap="round"/>
  <path d="M16 58h56" stroke="#334155" stroke-width="3" stroke-linecap="round"/>
  <rect x="38" y="38" width="12" height="12" rx="3" fill="#1f2937" stroke="#64748b" stroke-width="2"/>
</svg>`);

const IMAGES_JSON_URL =
  'https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/refs/heads/main/static/images.json';

let __imagesJsonPromise: Promise<Record<string, string>> | null = null;
let __imagesJsonCache: Record<string, string> | null = null;

async function loadImagesJson(): Promise<Record<string, string>> {
  if (__imagesJsonCache) return __imagesJsonCache;
  if (!__imagesJsonPromise) {
    __imagesJsonPromise = fetch(IMAGES_JSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`images.json HTTP ${r.status}`);
        return r.json() as Promise<Record<string, string>>;
      })
      .then((json) => {
        __imagesJsonCache = json || {};
        return __imagesJsonCache;
      })
      .catch(() => {
        __imagesJsonCache = {};
        return __imagesJsonCache;
      });
  }
  return __imagesJsonPromise;
}

export async function getCS2ImageFromTracker(pathLike: string): Promise<string> {
  if (!pathLike) return '';
  const raw = String(pathLike).trim();
  if (!raw) return '';
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw;

  // Some callers store Steam economy "image id" (hash-like) without the base URL.
  // Example values seen in images.json: "i0CoZ81Ui0m-..." (no slashes).
  if (!raw.includes('/') && raw.length >= 24) return STEAM_ECONOMY_IMAGE_BASE + raw;

  // Normalize to the key format used by images.json (e.g. "econ/stickers/...")
  let key = raw.replace(/^[./]+/, '').replace(/^panorama\/images\//i, '');
  key = key.replace(/^\/+/, '').replace(/\/+$/, '');

  const map = await loadImagesJson();
  return map[key] || '';
}

export function createCSGOImage(urlEndpath: string): string {
  if (!urlEndpath) return '';
  const raw = String(urlEndpath).trim();

  // Already a fully qualified URL (Steam CDN, cached assets, etc.)
  if (raw.startsWith('data:')) return raw;
  if (/^(https?:)?\/\//i.test(raw)) return preferLargerSteamEconomyImage(raw);

  // Steam economy image IDs/hashes (no slashes). Prefer the Steam CDN directly.
  // This is the dominant format for many CS2 inventory images.
  if (!raw.includes('/') && raw.length >= 24) {
    return preferLargerSteamEconomyImage(STEAM_ECONOMY_IMAGE_BASE + raw);
  }

  // Some callers may pass only the tail after ".../economy/image/".
  if (raw.startsWith('economy/image/')) {
    return preferLargerSteamEconomyImage(STEAM_ECONOMY_IMAGE_BASE + raw.slice('economy/image/'.length));
  }

  // NOTE:
  // Many `image_inventory` keys look like "econ/default_generated/...".
  // Steam no longer serves these directly via the economy image endpoint (often 404),
  // so we rely on either:
  // - Steam-provided icon_url/icon_url_large (hash-like) from the inventory payload, OR
  // - a mapping (e.g. ByMykel images.json) elsewhere.
  if (raw.startsWith('econ/')) return '';

  // Some callers may already pass a full panorama path or a suffixed filename.
  let path = raw.replace(/^[./]+/, '').replace(/^panorama\/images\//i, '');

  // If the string already contains the tracker base path, strip it to avoid duplication.
  if (path.includes('panorama/images/')) {
    path = path.split('panorama/images/').pop() || path;
  }

  // Normalize leading slashes.
  path = path.replace(/^\/+/, '');
  // Normalize trailing slashes (prevents ".../casket/_png.png" 404s).
  path = path.replace(/\/+$/, '');

  // If the caller already provided an extension or the tracker suffix, don’t append again.
  if (/_png\.png$/i.test(path)) return PANORAMA_BASE + path;
  if (/\.(png|jpg|jpeg|webp|gif)$/i.test(path)) return PANORAMA_BASE + path;

  return PANORAMA_BASE + path + '_png.png';
}