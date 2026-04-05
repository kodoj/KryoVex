import { ItemRow } from 'renderer/interfaces/items.ts';
import { Prices, Settings } from 'renderer/interfaces/states.tsx';
import { pricingAddToRequested, pricingStart, pricingResetProgress } from 'renderer/store/slices/pricing.ts';

/** Key into `prices.prices` — must match `ConvertPrices._getName`. */
export function pricingInventoryKey(item: Pick<ItemRow, 'item_name' | 'item_wear_name'>) {
  let name = String(item.item_name || '').replaceAll('(Holo/Foil)', '(Holo-Foil)');
  if (item.item_wear_name) {
    name += ` (${item.item_wear_name})`;
  }
  return name;
}

export class ConvertPrices {
  settingsData: Settings;
  prices: Prices;

  constructor(settingsData: Settings, prices: Prices) {
    this.settingsData = settingsData;
    this.prices = prices;
  }

  _getName(itemRow: ItemRow): string {
    let name = itemRow.item_name.replaceAll('(Holo/Foil)', '(Holo-Foil)');
    if (itemRow.item_wear_name) {
      name += ' (' + itemRow.item_wear_name + ')';
    }
    return name;
  }

  getPrice(itemRow: ItemRow, nanToZero = false) {
      const itemName = this._getName(itemRow);
      const priceData = this.prices.prices[itemName];
      if (process.env.DEBUG_PRICING === 'true') {
        console.log(
          'Getting price for:',
          itemName,
          'Price data:',
          priceData,
          'Settings source:',
          this.settingsData.source?.title,
          ''
        );
      }
      // Redux rows are { steam_listing, fromBackup }. Prefer steam_listing, then legacy per-source keys.
      const pd = priceData as unknown as Record<string, unknown> | undefined;
      const titleKey = this.settingsData.source?.title ?? '';
      const fromSteam = pd?.steam_listing;
      const fromTitleKey = titleKey ? pd?.[titleKey] : undefined;
      const pick = fromSteam ?? fromTitleKey;
      let sourcePrice = Number.NaN;
      if (pick !== undefined && pick !== null && pick !== '') {
        const n = typeof pick === 'number' ? pick : Number(pick);
        sourcePrice = Number.isFinite(n) ? n : Number.NaN;
      }
      if (process.env.DEBUG_PRICING === 'true') {
        console.log('Source price for', itemName, 'from', this.settingsData.source?.title, 'is', sourcePrice);
      }
      const currencyRate =
        this.settingsData.currencyPrice?.[this.settingsData.currency] ?? 1;
      let itemPrice = sourcePrice * currencyRate;
      if (isNaN(itemPrice) && nanToZero) {
        itemPrice = 0;
        if (process.env.DEBUG_PRICING === 'true') console.log('Price NaN, returning 0 for', itemName);
      }
      if (process.env.DEBUG_PRICING === 'true') {
        console.log(
          'Got price for:',
          itemName,
          ' : ',
          itemPrice,
          ' sourcePrice: ',
          sourcePrice,
          ' currencyRate: ',
          currencyRate
        );
      }
      return itemPrice;
    }
}

export class ConvertPricesFormatted extends ConvertPrices {
  constructor(settingsData: Settings, prices: Prices) {
    super(settingsData, prices);
  }

  formatPrice(price: number) {
    return new Intl.NumberFormat(this.settingsData.locale, {
      style: 'currency',
      currency: this.settingsData.currency,
    }).format(price);
  }

  getFormattedPrice(itemRow: ItemRow) {
    return this.formatPrice(this.getPrice(itemRow));
  }
  getFormattedPriceCombined(itemRow: ItemRow) {
    let comQty = itemRow?.combined_QTY as number;
    return new Intl.NumberFormat(this.settingsData.locale, {
      style: 'currency',
      currency: this.settingsData.currency,
    }).format(comQty * this.getPrice(itemRow));
  }
}

async function requestPrice(priceToGet: Array<ItemRow>, options?: { forceFresh?: boolean; sessionId?: string }) {
  window.electron.ipcRenderer.getPrice(priceToGet, options);
}

async function dispatchRequested(
  dispatch: Function,
  rowsToGet: Array<ItemRow>
) {
  dispatch(pricingAddToRequested({ itemRows: rowsToGet }));
}

/** Same as main `BACKUP_MAX_AGE_MS`: re-run pricing so main can use disk backup first, then Steam if stale. */
const BACKUP_PRICE_TTL_MS = 60 * 60 * 1000;

export class RequestPrices extends ConvertPrices {
  dispatch: Function;
  constructor(dispatch: Function, settingsData: Settings, prices: Prices) {
    super(settingsData, prices);
    this.dispatch = dispatch;
  }

  /**
   * Main checks disk backup first; Steam only if backup is missing, zero, or older than 1h.
   * Re-IPC when we have no price yet, or cached backup age in Redux is ≥ 1h (so main may refetch).
   */
  private _shouldRequest(itemRow: ItemRow): boolean {
    const name = this._getName(itemRow);
    const priceData = this.prices.prices[name];
    const hasAny = !!priceData && (priceData.steam_listing ?? 0) > 0;
    if (isNaN(this.getPrice(itemRow)) || !hasAny) return true;
    if (!priceData?.fromBackup) return false;
    const pa = priceData.pricedAt;
    if (pa == null) return true;
    return Date.now() - pa >= BACKUP_PRICE_TTL_MS;
  }

  /** Account-wide auto runs: request only truly missing prices (no stale-backup refresh here). */
  private _shouldRequestMissingOnly(itemRow: ItemRow): boolean {
    const priceData = this.prices.prices[this._getName(itemRow)];
    const hasAny = !!priceData && (priceData.steam_listing ?? 0) > 0;
    return isNaN(this.getPrice(itemRow)) || !hasAny;
  }

  _checkRequested(itemRow: ItemRow): boolean {
    return (
      this.prices.productsRequested.includes(this._getName(itemRow)) == false
    );
  }

  handleRequested(itemRow: ItemRow): void {
    if (this._shouldRequest(itemRow) && this._checkRequested(itemRow)) {
      let rowsToSend = [itemRow];
      requestPrice(rowsToSend);
      dispatchRequested(this.dispatch, rowsToSend);
    }
  }

  /** Unique canonical names for moveable rows (same as main `_getName` dedupe). */
  private _collectSurfaceUniqueNames(rows: ItemRow[] | undefined): string[] | undefined {
    if (!rows?.length) return undefined;
    const seen = new Map<string, true>();
    const out: string[] = [];
    for (const row of rows) {
      if (row?.item_moveable !== true) continue;
      const name = this._getName(row);
      if (seen.has(name)) continue;
      seen.set(name, true);
      out.push(name);
    }
    return out.length ? out : undefined;
  }

  handleRequestArray(
    itemRows: Array<ItemRow>,
    meta?: {
      scope?: 'total' | 'storage' | 'inv';
      mode?: 'missingOrBackup' | 'allUniques' | 'missingOnly';
      reset?: boolean;
      /** For scope `total`, populate per-card session maps (inventory vs storage uniques). */
      invSurfaceRows?: ItemRow[];
      storageSurfaceRows?: ItemRow[];
      /**
       * True when storage was loaded after inventory pricing completed — append IPC work only,
       * preserve fetchedCount and per-surface done maps (handled in pricingStart extendProgress).
       */
      extendProgress?: boolean;
    }
  ): void {
    // IMPORTANT: Requesting/pricing is unique-by-name (main process dedupes by `_getName`).
    // If we send/count per raw row, progress totals get inflated (e.g. storage units with many duplicates).
    const uniqueByName = new Map<string, ItemRow>();
    for (const itemRow of itemRows) {
      if (itemRow?.item_moveable !== true) continue;
      const name = this._getName(itemRow);
      if (uniqueByName.has(name)) continue;
      if (meta?.mode === 'allUniques') {
        uniqueByName.set(name, itemRow);
      } else if (meta?.mode === 'missingOnly') {
        // Do not gate on `productsRequested`: a name can be marked requested while the IPC batch
        // never applied a price (overlap, retries, strict-mode). Missing-only auto-pricing must be
        // able to re-queue until Redux has a usable listing.
        if (this._shouldRequestMissingOnly(itemRow)) {
          uniqueByName.set(name, itemRow);
        }
      } else {
        if (this._shouldRequest(itemRow) && this._checkRequested(itemRow)) {
          uniqueByName.set(name, itemRow);
        }
      }
    }
    const rowsToSend = Array.from(uniqueByName.values());
    if (rowsToSend.length === 0) return;

    // Large IPC payloads can stall the renderer at startup. Chunk requests and yield.
    // BUT: when we want progress to represent "all uniques" (including already-cached backup),
    // chunking breaks the progress totals because backup counts are reported per-chunk.
    // For those runs, send a single batch so main can report accurate total/fetched.
    const CHUNK_SIZE = meta?.mode === 'allUniques' ? rowsToSend.length : 60;
    // If Redux already has an in-flight auto session, keep tagging IPC with that id so
    // `useIpcPricingProgress` matches and concurrent `pricingStart` merges do not strand chunks
    // under a session id Redux no longer treats as active.
    const sessionId =
      !meta?.reset &&
      this.prices.isFetching &&
      this.prices.activeSessionId
        ? this.prices.activeSessionId
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    if (meta?.reset) {
      const storageUniqueNames =
        meta?.scope === 'storage' ? rowsToSend.map((r) => this._getName(r)) : undefined;
      const invUniqueNames =
        meta?.scope === 'inv' ? rowsToSend.map((r) => this._getName(r)) : undefined;
      this.dispatch(
        pricingResetProgress({
          total: rowsToSend.length,
          sessionId,
          scope: meta?.scope,
          storageUniqueNames,
          invUniqueNames,
        })
      );
    } else {
      // Per-card session maps: `total` uses row surfaces; `storage` / `inv` runs need explicit keys
      // or Overview shows 0/0 for `sessionSurface*Storage` / `Inv` (pricing still runs via runTotal).
      const invUniqueNames =
        meta?.scope === 'total'
          ? this._collectSurfaceUniqueNames(meta.invSurfaceRows)
          : meta?.scope === 'inv'
            ? rowsToSend.map((r) => this._getName(r))
            : undefined;
      const storageUniqueNames =
        meta?.scope === 'total'
          ? this._collectSurfaceUniqueNames(meta.storageSurfaceRows)
          : meta?.scope === 'storage'
            ? rowsToSend.map((r) => this._getName(r))
            : undefined;
      // Storage-only incremental runs (after inv finishes) must extend totals too — otherwise
      // `totalItems` resets, `fetchedCount` goes to 0, and Overview "Total" no longer matches
      // the combined inv + storage work the user expects (e.g. 34/108 stuck).
      const useExtendProgress =
        meta?.extendProgress === true &&
        !this.prices.isFetching &&
        (meta?.scope === 'total' || meta?.scope === 'storage');
      this.dispatch(
        pricingStart({
          total: rowsToSend.length,
          sessionId,
          scope: meta?.scope,
          invUniqueNames,
          storageUniqueNames,
          ...(useExtendProgress ? { extendProgress: true } : {}),
        })
      );
    }

    let sent = 0;
    const sendNext = () => {
      const chunk = rowsToSend.slice(sent, sent + CHUNK_SIZE);
      if (chunk.length === 0) return;
      sent += chunk.length;
      requestPrice(chunk, { sessionId });
      dispatchRequested(this.dispatch, chunk);
      if (sent < rowsToSend.length) {
        window.setTimeout(sendNext, 0);
      }
    };
    // Defer first send to let the UI paint.
    window.setTimeout(sendNext, 0);

    if (process.env.DEBUG_PRICING === 'true') {
      console.log('Queued pricing requests for', rowsToSend.length, 'items');
    }
  }
}
