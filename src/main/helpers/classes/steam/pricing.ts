import { getValue, setValue } from './settings.ts';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import axios from 'axios';
import { Currency } from './currency.ts';
let PQueue: any;
import { EventEmitter } from 'events';
import { ItemRow } from '@/interfaces/items.ts';
import SteamUser from 'steam-user';
import { steamListing } from '@/interfaces/states.ts';

class MyEmitter extends EventEmitter {}
const pricingEmitter = new MyEmitter();

function isAxios429(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 429;
}

let currencyCodes = {
  1: 'USD',
  2: 'GBP',
  3: 'EUR',
  4: 'CHF',
  5: 'RUB',
  6: 'PLN',
  7: 'BRL',
  8: 'JPY',
  9: 'NOK',
  10: 'IDR',
  11: 'MYR',
  12: 'PHP',
  13: 'SGD',
  14: 'THB',
  15: 'VND',
  16: 'KRW',
  17: 'TRY',
  18: 'UAH',
  19: 'MXN',
  20: 'CAD',
  21: 'AUD',
  22: 'NZD',
  23: 'CNY',
  24: 'INR',
  25: 'CLP',
  26: 'PEN',
  27: 'COP',
  28: 'ZAR',
  29: 'HKD',
  30: 'TWD',
  31: 'SAR',
  32: 'AED',
  33: 'SEK',
  34: 'ARS',
  35: 'ILS',
  36: 'BYN',
  37: 'KZT',
  38: 'KWD',
  39: 'QAR',
  40: 'CRC',
  41: 'UYU',
  42: 'BGN',
  43: 'HRK',
  44: 'CZK',
  45: 'DKK',
  46: 'HUF',
  47: 'RON',
};

const appDataBase = process.env.APPDATA || app.getPath('appData');
const backupDir: string = path.join(appDataBase, 'kryovex/backup');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

/** After this age, disk backup is stale → fetch from Steam (backup is still checked first). */
const BACKUP_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

class runItems {
  steamUser: SteamUser;
  seenItems: {};
  packageToSend: {};
  header: any;
  currency: any;
  headers: any;
  prices: { [x: string]: any; };
  private queue!: InstanceType<typeof PQueue>;
  /**
   * `ipcMain.on('getPrice')` may invoke handlers concurrently when the renderer chunks requests.
   * Overlapping `processPricing` calls share mutable cache/queue state and can emit partial IPC.
   * Serialize here so each batch completes before the next starts.
   */
  private pricingDrain: Promise<void> = Promise.resolve();

  constructor(steamUser: SteamUser) {
    this.steamUser = steamUser;
    this.seenItems = {};
    this.packageToSend = {};
    this.initQueue();
    const pricesPath = path.join(backupDir, 'prices.json');
    try {
      if (fs.existsSync(pricesPath)) {
        const fileMtime = fs.statSync(pricesPath).mtimeMs;
        const parsed = JSON.parse(fs.readFileSync(pricesPath, 'utf8'));
        this.prices =
          parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        // Legacy entries without timestamp would otherwise force a Steam request every time.
        for (const key of Object.keys(this.prices)) {
          const v = this.prices[key];
          if (
            v &&
            typeof v === 'object' &&
            v.steam_listing != null &&
            v.timestamp == null
          ) {
            v.timestamp = fileMtime;
          }
        }
        console.log('Loaded prices from backup:', Object.keys(this.prices).length, 'entries');
      } else {
        this.prices = {};
      }
    } catch (err) {
      console.error('Error loading prices backup:', err);
      this.prices = {};
    }
    getValue('pricing').then((pricing) => {
      let returnValue = pricing?.currency;
      if (returnValue == undefined) {
        const walletCurrency = this.steamUser.wallet?.currency ?? 3; // 3 = EUR
        const newCurrency = currencyCodes[walletCurrency] ?? 'EUR';
        setValue('pricing', { ...pricing ?? {}, currency: newCurrency });
      }
    });
  }

  _getName(itemRow: ItemRow): string {
    let name = itemRow.item_name.replaceAll('(Holo/Foil)', '(Holo-Foil)');
    if (itemRow.item_wear_name !== undefined) {
      name += ' (' + itemRow.item_wear_name + ')';
    }
    return name;
  }

  private async initQueue() {
    if (!PQueue) {
      const { default: ImportedPQueue } = await import('p-queue');
      PQueue = ImportedPQueue;
    }
    // Steam priceoverview rate-limits aggressively; stay conservative (was 1500ms).
    this.queue = new PQueue({ concurrency: 1, interval: 2600, intervalCap: 1 });
  }

  private enqueueProcessPricing(
    itemRows: ItemRow[],
    options?: { sessionId?: string; forceFresh?: boolean }
  ): Promise<void> {
    this.pricingDrain = this.pricingDrain
      .catch((err) => {
        console.error('[pricing] Previous pricing batch failed:', err);
      })
      .then(() => this.processPricing(itemRows, options));
    return this.pricingDrain;
  }

  async setPricing(pricingData, commandFrom) {
    console.log('pricingSet', commandFrom);
    this.prices = pricingData;
  }

  /**
   * Use disk backup without Steam when: positive listing, timestamp present, age < BACKUP_MAX_AGE_MS.
   * Zero / missing / stale (>1h) → not eligible (caller fetches from Steam). Force refresh bypasses this.
   */
  private static backupEligibleForFastPath(cached: Record<string, unknown> | null | undefined): boolean {
    if (!cached || typeof cached !== 'object') return false;
    const n = Number((cached as { steam_listing?: unknown }).steam_listing);
    if (!Number.isFinite(n) || n <= 0) return false;
    const ts = (cached as { timestamp?: unknown }).timestamp;
    if (ts == null || !Number.isFinite(Number(ts))) return false;
    return Date.now() - Number(ts) < BACKUP_MAX_AGE_MS;
  }

  /** Same-currency backup: sync (hot path for large inventories). */
  private getEligibleDiskBackupSameCurrency(
    itemNamePricing: string,
    currentCurrency: string
  ): { steam_listing: number; timestamp: number } | null {
    const cached = this.prices[itemNamePricing];
    if (!runItems.backupEligibleForFastPath(cached)) return null;
    const diskCcy = cached.currency ?? currentCurrency;
    if (diskCcy !== currentCurrency) return null;
    return {
      steam_listing: Number(cached.steam_listing),
      timestamp: Number(cached.timestamp) || Date.now(),
    };
  }

  /** Cross-currency backup row (caller applies cached conversion factor). */
  private getEligibleDiskBackupConvertSource(
    itemNamePricing: string,
    currentCurrency: string
  ): { diskCcy: string; raw: number; timestamp: number } | null {
    const cached = this.prices[itemNamePricing];
    if (!runItems.backupEligibleForFastPath(cached)) return null;
    const diskCcy = cached.currency ?? currentCurrency;
    if (diskCcy === currentCurrency) return null;
    return {
      diskCcy,
      raw: Number(cached.steam_listing),
      timestamp: Number(cached.timestamp) || Date.now(),
    };
  }

  /** Single-item path (e.g. queued fetch) — optional `convertCache` avoids repeat rate lookups in batches. */
  private async pricingFromEligibleDiskBackup(
    itemNamePricing: string,
    currentCurrency: string,
    convertCache?: Map<string, number>
  ): Promise<{ steam_listing: number; timestamp: number } | null> {
    const same = this.getEligibleDiskBackupSameCurrency(itemNamePricing, currentCurrency);
    if (same) return same;
    const conv = this.getEligibleDiskBackupConvertSource(itemNamePricing, currentCurrency);
    if (!conv) return null;
    let factor = convertCache?.get(conv.diskCcy);
    if (factor === undefined) {
      const currencyClass = new Currency();
      const rate = (await currencyClass.getRate(currentCurrency)) as number;
      const cachedRate = (await currencyClass.getRate(conv.diskCcy)) as number;
      factor = cachedRate ? rate / cachedRate : 0;
      convertCache?.set(conv.diskCcy, factor);
    }
    const convertedPrice = conv.raw * factor;
    if (convertedPrice <= 0) return null;
    if (process.env.DEBUG_PRICING === 'true') {
      console.log('Converted backup for', itemNamePricing, 'from', conv.diskCcy, 'to', currentCurrency);
    }
    return { steam_listing: convertedPrice, timestamp: conv.timestamp };
  }

async makeSinglerequest(
    itemRow: ItemRow,
    opts?: { forceFresh?: boolean; terminalAttempt?: boolean }
  ): Promise<{
    itemRow: ItemRow;
    pricing: {
      steam_listing: number;
      currency: string;
      timestamp: number;
      fromBackup: boolean;
    };
    /** No disk backup — main queue will retry this item once at the end (no inline waits). */
    deferRetry?: boolean;
  }> {
  const forceFresh = opts?.forceFresh === true;
  const terminalAttempt = opts?.terminalAttempt === true;
  let itemNamePricing = this._getName(itemRow);
  let currencyCode: number = 3; // Default EUR
  let currentCurrency: string = 'EUR';
  await getValue('pricing').then((pricing) => {
    currentCurrency = pricing?.currency || 'EUR';
    const foundKey = Object.keys(currencyCodes).find(key => currencyCodes[key] === pricing?.currency);
    currencyCode = foundKey ? parseInt(foundKey, 10) : 3;
  });
  // Always evaluate disk backup before Steam (unless user force-refresh). Stale/missing → fetch below.
  if (!forceFresh) {
    const pb = await this.pricingFromEligibleDiskBackup(itemNamePricing, currentCurrency);
    if (pb) {
      return {
        itemRow,
        pricing: {
          steam_listing: pb.steam_listing,
          currency: currentCurrency,
          timestamp: pb.timestamp,
          // Source-of-truth for UI counts: disk/cache path is backup-sourced, even if a live
          // Steam snapshot exists in memory from a previous run.
          fromBackup: true,
        },
      };
    }
  }
  const encodedName = encodeURIComponent(itemNamePricing);
  const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=${currencyCode}&market_hash_name=${encodedName}`;
  const diskEntry = this.prices[itemNamePricing];
  /** After a failed fetch: only positive listings count as backup (never treat 0 as a price). */
  const useDiskBackup = (): {
    itemRow: ItemRow;
    pricing: {
      steam_listing: number;
      currency: string;
      timestamp: number;
      fromBackup: boolean;
    };
  } | null => {
    const n = Number(diskEntry?.steam_listing);
    if (!Number.isFinite(n) || n <= 0) return null;
    return {
      itemRow,
      pricing: {
        steam_listing: n,
        currency: currentCurrency,
        timestamp: diskEntry.timestamp ?? Date.now(),
        fromBackup: true,
      },
    };
  };

  type Outcome = {
    itemRow: ItemRow;
    pricing: {
      steam_listing: number;
      currency: string;
      timestamp: number;
      fromBackup: boolean;
    };
    deferRetry?: boolean;
  };

  const deferOrZero = (): Outcome => {
    const fromDisk = useDiskBackup();
    if (fromDisk) return fromDisk;
    if (!terminalAttempt) {
      return {
        itemRow,
        pricing: {
          steam_listing: 0,
          currency: currentCurrency,
          timestamp: Date.now(),
          fromBackup: false,
        },
        deferRetry: true,
      };
    }
    return {
      itemRow,
      pricing: {
        steam_listing: 0,
        currency: currentCurrency,
        timestamp: Date.now(),
        fromBackup: false,
      },
    };
  };

  try {
    const response = await axios.get(url, { timeout: 45000 });
    const data = response.data as steamListing;
    if (!data.success || (!data.median_price && !data.lowest_price)) {
      console.warn(`No price data for ${itemNamePricing} — using backup or deferring`);
      return deferOrZero();
    }
    const parsedPrice =
      parseFloat(
        (data.median_price || data.lowest_price).replaceAll(',', '.').replace('--', '')
      ) || 0;
    if (parsedPrice > 0) {
      this.prices[itemNamePricing] = {
        steam_listing: parsedPrice,
        currency: currentCurrency,
        timestamp: Date.now(),
        fromBackup: false,
      };
      console.log(
        'Parsed steam_pricing for',
        itemNamePricing,
        ':',
        parsedPrice,
        'currency:',
        currentCurrency
      );
      return {
        itemRow,
        pricing: {
          steam_listing: parsedPrice,
          currency: currentCurrency,
          timestamp: Date.now(),
          fromBackup: false,
        },
      };
    }
    console.warn(
      `Invalid/empty parsed price for ${itemNamePricing} — using backup or deferring`
    );
    return deferOrZero();
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (isAxios429(error)) {
      console.warn(
        `[pricing] 429 for ${itemNamePricing} — using backup if present, else deferring (no inline retry)`
      );
    } else {
      console.error('Error fetching price for', itemNamePricing, errMsg);
    }
    return deferOrZero();
  }
}

async processPricing(
    itemRows: Array<ItemRow>,
    options?: { sessionId?: string; forceFresh?: boolean }
  ) {
  const forceFresh = options?.forceFresh === true;
  let returnRows: ItemRow[] = [];
  const uniques = new Map<string, ItemRow>();
  itemRows.forEach((row) => {
    if (row.item_name !== undefined && row.item_moveable === true) {
      uniques.set(this._getName(row), row);
    }
  });

  let cachedPrices = {};
  await getValue('pricing').then((pricing) => {
    cachedPrices = pricing?.cache || {};
  });
  const toQuery: any[] = [];
  let currentCurrency = 'EUR';
  await getValue('pricing').then((pricing) => {
    currentCurrency = pricing?.currency || 'EUR';
  });
  let numBackup = 0;
  let numUpdated = 0;

  const failReasonUnpriced = (fromBackup: boolean, afterDeferredRetry: boolean) => {
    if (fromBackup) return 'No listing price in cache';
    if (afterDeferredRetry) return 'No market price after fetch (deferred retry exhausted)';
    return 'No market price after fetch';
  };

  const emitProgressRow = (
    row: ItemRow,
    pricing: { steam_listing: number; fromBackup: boolean; timestamp?: number },
    failedReason?: string
  ) => {
    const canonicalName = this._getName(row);
    const rowPayload: Record<string, unknown> = {
      item_name: row.item_name,
      item_wear_name: row.item_wear_name,
      pricing: {
        steam_listing: pricing.steam_listing,
        fromBackup: pricing.fromBackup,
        ...(pricing.timestamp != null ? { pricedAt: pricing.timestamp } : {}),
      },
    };
    const payload: Record<string, unknown> = {
      count: 1,
      sessionId: options?.sessionId,
      row: rowPayload,
    };
    if (failedReason) {
      rowPayload.failed = { name: canonicalName, reason: failedReason };
      payload.failed = { name: canonicalName, reason: failedReason };
    }
    pricingEmitter.emit('progress', payload);
  };

  /** Fewer IPC round-trips than one event per row (backup-only runs can be thousands of uniques). */
  const BACKUP_PROGRESS_CHUNK = 400;
  type BackupProgressRow = {
    item_name: string;
    item_wear_name?: string;
    pricing: { steam_listing: number; fromBackup: boolean; pricedAt: number };
  };
  const backupProgressRows: BackupProgressRow[] = [];
  const convertFactorByDiskCcy = new Map<string, number>();

  for (const uniqueItem of Array.from(uniques.values())) {
    const itemNamePricing = this._getName(uniqueItem);
    if (!forceFresh) {
      let pb: { steam_listing: number; timestamp: number } | null =
        this.getEligibleDiskBackupSameCurrency(itemNamePricing, currentCurrency);
      if (!pb) {
        const conv = this.getEligibleDiskBackupConvertSource(itemNamePricing, currentCurrency);
        if (conv) {
          let factor = convertFactorByDiskCcy.get(conv.diskCcy);
          if (factor === undefined) {
            const currencyClass = new Currency();
            const rate = (await currencyClass.getRate(currentCurrency)) as number;
            const cachedRate = (await currencyClass.getRate(conv.diskCcy)) as number;
            factor = cachedRate ? rate / cachedRate : 0;
            convertFactorByDiskCcy.set(conv.diskCcy, factor);
          }
          const steam_listing = conv.raw * factor;
          if (steam_listing > 0) {
            pb = { steam_listing, timestamp: conv.timestamp };
          }
        }
      }
      if (pb) {
        // Disk/cache fast-path always counts as backup source.
        const emitBackup = true;
        cachedPrices[itemNamePricing] = {
          steam_listing: pb.steam_listing,
          fromBackup: emitBackup,
          timestamp: pb.timestamp,
        };
        if (emitBackup) {
          numBackup++;
        } else {
          numUpdated++;
        }
        backupProgressRows.push({
          item_name: uniqueItem.item_name,
          item_wear_name: uniqueItem.item_wear_name,
          pricing: {
            steam_listing: pb.steam_listing,
            fromBackup: emitBackup,
            pricedAt: pb.timestamp,
          },
        });
        continue;
      }
    }
    // Force refresh, or backup missing / zero / older than 1h → one Steam request (then save to disk).
    toQuery.push(uniqueItem);
    numUpdated++;
  }

  if (backupProgressRows.length > 0) {
    await getValue('pricing').then((pricingStore) => {
      setValue('pricing', { ...pricingStore ?? {}, cache: cachedPrices });
    });
    for (let i = 0; i < backupProgressRows.length; i += BACKUP_PROGRESS_CHUNK) {
      const chunk = backupProgressRows.slice(i, i + BACKUP_PROGRESS_CHUNK);
      pricingEmitter.emit('progress', {
        count: chunk.length,
        sessionId: options?.sessionId,
        rows: chunk,
      });
    }
  }

    const deferredForRetry: ItemRow[] = [];
    /** Canonical names that went through `applyFetchedRow` — for final `pricing-result` fail reasons. */
    const pricingFailMetaByName = new Map<string, { afterDeferredRetry: boolean }>();

    const applyFetchedRow = async (
      itemRow: ItemRow,
      pricing: {
        steam_listing: number;
        fromBackup: boolean;
        currency: string;
        timestamp: number;
      },
      afterDeferredRetry: boolean
    ) => {
      const itemNamePricing = this._getName(itemRow);
      const priced = {
        steam_listing: pricing.steam_listing,
        fromBackup: !!pricing.fromBackup,
        timestamp: pricing.timestamp ?? Date.now(),
      };
      cachedPrices[itemNamePricing] = priced;
      if (!pricing.fromBackup && pricing.steam_listing > 0) {
        this.prices[itemNamePricing] = {
          steam_listing: pricing.steam_listing,
          currency: pricing.currency,
          timestamp: pricing.timestamp,
          fromBackup: false,
        };
      } else if (process.env.DEBUG_PRICING === 'true') {
        console.log(
          `Skipping backup update for ${itemNamePricing} due to invalid/0 value or backup usage`
        );
      }
      // Avoid `electron-store` persistence per row — one flush after the queue drains (see below).
      const listing = pricing.steam_listing ?? 0;
      pricingFailMetaByName.set(itemNamePricing, { afterDeferredRetry });
      const failReason =
        listing > 0
          ? undefined
          : failReasonUnpriced(!!pricing.fromBackup, afterDeferredRetry);
      emitProgressRow(
        itemRow,
        {
          steam_listing: pricing.steam_listing,
          fromBackup: !!pricing.fromBackup,
          timestamp: pricing.timestamp,
        },
        failReason
      );
    };

    const runQueuedFetch = async (el: ItemRow, terminalAttempt: boolean) => {
      const r = await this.makeSinglerequest(el, { forceFresh, terminalAttempt });
      if (r.deferRetry) {
        deferredForRetry.push(el);
        return;
      }
      await applyFetchedRow(r.itemRow, r.pricing, terminalAttempt);
    };

    await Promise.all(toQuery.map((el) => this.queue.add(() => runQueuedFetch(el, false))));

    if (deferredForRetry.length > 0) {
      console.log(
        `[pricing] Deferred retry after main queue: ${deferredForRetry.length} item(s), single attempt each`
      );
      const retryThese = deferredForRetry.slice();
      await Promise.all(
        retryThese.map((el) => this.queue.add(() => runQueuedFetch(el, true)))
      );
    }

    if (toQuery.length > 0) {
      await getValue('pricing').then((pricingStore) => {
        setValue('pricing', { ...(pricingStore ?? {}), cache: cachedPrices });
      });
    }

    console.log('All pricing queue work resolved, emitting result');

  itemRows.forEach((row) => {
    if (row.item_name !== undefined && row.item_moveable === true) {
      let itemNamePricing = this._getName(row);
      const cached = cachedPrices[itemNamePricing] || { steam_listing: 0, fromBackup: false };
      const ts = (cached as { timestamp?: number }).timestamp;
      const listing = cached.steam_listing ?? 0;
      row['pricing'] = {
        steam_listing: cached.steam_listing,
        fromBackup: cached.fromBackup,
        ...(ts != null ? { pricedAt: ts } : {}),
      };
      if (listing <= 0) {
        const meta = pricingFailMetaByName.get(itemNamePricing);
        (row as ItemRow & { failed?: { name: string; reason: string } }).failed = {
          name: itemNamePricing,
          reason: failReasonUnpriced(!!cached.fromBackup, meta?.afterDeferredRetry ?? false),
        };
      }
      returnRows.push(row);
    }
  });

  const pricesPath = path.join(backupDir, 'prices.json');
  try {
    const keys = Object.keys(this.prices).filter(
      (k) => this.prices[k] && typeof this.prices[k] === 'object'
    );
    if (keys.length > 0) {
      fs.writeFileSync(pricesPath, JSON.stringify(this.prices, null, 2));
      if (process.env.DEBUG_PRICING === 'true') {
        console.log('Saved prices to', pricesPath, 'with', keys.length, 'entries');
      }
    }
  } catch (err) {
    console.error('Error saving prices to', pricesPath, ':', err);
  }
  const total = numBackup + numUpdated;
  const stats = {
    backupPct: total > 0 ? ((numBackup / total) * 100).toFixed(0) : '0'
  };
  const dataToEmit = {
    rows: returnRows || [],
    stats,
    uniqueProcessed: uniques.size,
  };
  pricingEmitter.emit('result', dataToEmit);
  console.log('Emitting result with', dataToEmit.rows.length, 'rows, uniques:', uniques.size);
}

  async handleItems(itemRows: ItemRow[], options?: { sessionId?: string; forceFresh?: boolean }) {
    await this.enqueueProcessPricing(itemRows, {
      sessionId: options?.sessionId,
      forceFresh: options?.forceFresh,
    });
  }

  async handleTradeUp(itemRows: ItemRow[]) {
    await this.enqueueProcessPricing(itemRows, undefined);
  }
}

export { runItems, pricingEmitter, currencyCodes };