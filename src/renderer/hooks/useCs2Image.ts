import { useEffect, useMemo, useState } from 'react';
import {
  IMAGE_FALLBACK_DATA_URI,
  preferLargerSteamEconomyImage,
} from 'renderer/functionsClasses/createCSGOImage.ts';

const IMAGES_JSON_URL =
  'https://raw.githubusercontent.com/ByMykel/counter-strike-image-tracker/refs/heads/main/static/images.json';

const STEAM_ECONOMY_IMAGE_BASE = 'https://steamcommunity-a.akamaihd.net/economy/image/';

let __imagesJsonPromise: Promise<Record<string, string>> | null = null;
let __imagesJsonCache: Record<string, string> | null = null;

type ImageStatus = {
  requested: number;
  resolved: number;
  missing: number; // key not in images.json
  errors: number; // network/image decode error in <img>
  isLoadingMap: boolean;
  missingSamples: string[];
  errorSamples: string[];
};

let __status: ImageStatus = {
  requested: 0,
  resolved: 0,
  missing: 0,
  errors: 0,
  isLoadingMap: false,
  missingSamples: [],
  errorSamples: [],
};

const __seenRequested = new Set<string>();
const __seenResolved = new Set<string>();
const __seenMissing = new Set<string>();
const __seenError = new Set<string>();
const __missingSamples: string[] = [];
const __errorSamples: string[] = [];

const __listeners = new Set<(s: ImageStatus) => void>();
function notify() {
  for (const cb of __listeners) cb(__status);
}

export function getImageStatusSnapshot(): ImageStatus {
  return __status;
}

export function subscribeImageStatus(cb: (s: ImageStatus) => void) {
  __listeners.add(cb);
  cb(__status);
  return () => {
    __listeners.delete(cb);
  };
}

export function markImageError(srcKey: string) {
  const k = normalizeKey(srcKey);
  if (!k) return;
  if (__seenError.has(k)) return;
  __seenError.add(k);
  if (__errorSamples.length < 5) __errorSamples.push(k);
  __status = { ...__status, errors: __seenError.size, errorSamples: [...__errorSamples] };
  notify();
}

function loadImagesJson(): Promise<Record<string, string>> {
  if (__imagesJsonCache) return Promise.resolve(__imagesJsonCache);
  if (!__imagesJsonPromise) {
    __status = { ...__status, isLoadingMap: true };
    notify();
    __imagesJsonPromise = fetch(IMAGES_JSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`images.json HTTP ${r.status}`);
        return r.json() as Promise<Record<string, string>>;
      })
      .then((json) => {
        __imagesJsonCache = json || {};
        __status = { ...__status, isLoadingMap: false };
        notify();
        return __imagesJsonCache;
      })
      .catch(() => {
        __imagesJsonCache = {};
        __status = { ...__status, isLoadingMap: false };
        notify();
        return __imagesJsonCache;
      });
  }
  return __imagesJsonPromise;
}

function normalizeKey(input: string): string {
  let key = String(input || '').trim();
  key = key.replace(/^[./]+/, '').replace(/^panorama\/images\//i, '');
  key = key.replace(/^\/+/, '').replace(/\/+$/, '');
  return key;
}

function keyVariants(key: string): string[] {
  const k = key;
  const out = new Set<string>();
  if (!k) return [];
  out.add(k);
  out.add(k.toLowerCase());

  // Common CS2 schema mismatch: our app produces "..._light_large" but the tracker uses "..._light".
  const swapSuffix = (from: string, to: string) => {
    if (k.endsWith(from)) out.add(k.slice(0, -from.length) + to);
    const lower = k.toLowerCase();
    if (lower.endsWith(from)) out.add(lower.slice(0, -from.length) + to);
  };
  swapSuffix('_light_large', '_light');
  swapSuffix('_medium_large', '_medium');
  swapSuffix('_heavy_large', '_heavy');

  // Another common case: "..._light_large_png" style.
  swapSuffix('_light_large_png', '_light');
  swapSuffix('_medium_large_png', '_medium');
  swapSuffix('_heavy_large_png', '_heavy');

  return Array.from(out);
}

function immediateUrlOrEmpty(pathLike: string): string {
  const raw = String(pathLike || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:')) return raw;
  if (/^(https?:)?\/\//i.test(raw)) return preferLargerSteamEconomyImage(raw);

  // Steam hash-style economy images (e.g. icon_url/icon_url_large): no slashes, long token.
  if (!raw.includes('/') && raw.length >= 24) {
    return preferLargerSteamEconomyImage(STEAM_ECONOMY_IMAGE_BASE + raw);
  }

  // Some callers pass only the tail after ".../economy/image/".
  if (raw.startsWith('economy/image/')) {
    return preferLargerSteamEconomyImage(STEAM_ECONOMY_IMAGE_BASE + raw.slice('economy/image/'.length));
  }

  return '';
}

/**
 * Resolve CS2 inventory images via ByMykel `images.json`.
 * - Returns a stable `src` string (starts as fallback, updates once resolved).
 * - Caches `images.json` in-memory for the whole app session.
 */
export function useCs2Image(pathLike: string, options?: { fallback?: string }) {
  const fallback = options?.fallback ?? IMAGE_FALLBACK_DATA_URI;

  const normalizedKey = useMemo(() => normalizeKey(pathLike), [pathLike]);
  const variants = useMemo(() => keyVariants(normalizedKey), [normalizedKey]);
  const direct = useMemo(() => immediateUrlOrEmpty(pathLike), [pathLike]);

  /** URL resolved from `images.json` only; `direct` URLs are not mirrored here. */
  const [mapUrl, setMapUrl] = useState('');

  const resolved = direct || (normalizedKey ? mapUrl : '');

  useEffect(() => {
    let cancelled = false;
    const runAfterPaint = (fn: () => void) => {
      queueMicrotask(() => {
        if (!cancelled) fn();
      });
    };

    if (direct || !normalizedKey) {
      if (!direct && !normalizedKey) {
        runAfterPaint(() => setMapUrl(''));
      }
      return () => {
        cancelled = true;
      };
    }

    if (!__seenRequested.has(normalizedKey)) {
      __seenRequested.add(normalizedKey);
      __status = { ...__status, requested: __seenRequested.size };
      notify();
    }

    if (__imagesJsonCache) {
      let cachedUrl = '';
      for (const k of variants) {
        cachedUrl = __imagesJsonCache[k] || '';
        if (cachedUrl) break;
      }
      if (cachedUrl) {
        if (!__seenResolved.has(normalizedKey)) {
          __seenResolved.add(normalizedKey);
          __status = { ...__status, resolved: __seenResolved.size };
          notify();
        }
        runAfterPaint(() => setMapUrl(cachedUrl));
        return () => {
          cancelled = true;
        };
      }
    }

    runAfterPaint(() => setMapUrl(''));
    loadImagesJson().then((map) => {
      if (cancelled) return;
      let url = '';
      for (const k of variants) {
        url = map[k] || '';
        if (url) break;
      }
      if (url) {
        if (!__seenResolved.has(normalizedKey)) {
          __seenResolved.add(normalizedKey);
          __status = { ...__status, resolved: __seenResolved.size };
          notify();
        }
      } else {
        if (!__seenMissing.has(normalizedKey)) {
          __seenMissing.add(normalizedKey);
          if (__missingSamples.length < 5) __missingSamples.push(normalizedKey);
          __status = {
            ...__status,
            missing: __seenMissing.size,
            missingSamples: [...__missingSamples],
          };
          notify();
        }
      }
      setMapUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [direct, normalizedKey, variants]);

  const out = resolved || fallback;
  if (!out || out === fallback || out.startsWith('data:')) return out;
  return preferLargerSteamEconomyImage(out);
}
