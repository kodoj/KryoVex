import {
  ArrowTopRightOnSquareIcon,
  InboxStackIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import {
  btnDefault,
  btnPrimary,
  focusRingBtn,
} from 'renderer/components/content/shared/buttonStyles.ts';
import { SortIndicator } from 'renderer/components/content/shared/SortIndicator.tsx';
import { IMAGE_FALLBACK_DATA_URI } from 'renderer/functionsClasses/createCSGOImage.ts';
import { ConvertPricesFormatted } from 'renderer/functionsClasses/prices.ts';
import { ItemRow } from 'renderer/interfaces/items.ts';
import { markImageError, useCs2Image } from 'renderer/hooks/useCs2Image.ts';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';

const CS2_APP_ID = '730';
const CS2_CONTEXT_ID = '2';
const URL_LENGTH_WARN = 6500;
/** Fixed row slot for market inventory picker virtualization (thumbnail + two text lines). */
const PICKER_LIST_ROW_PX = 52;
const PICKER_LIST_OVERSCAN = 8;

type Line = { id: string; name: string; qty: number };

type MarketTableSortKey = 'name' | 'unit' | 'qty' | 'subtotal';

function marketLineCompare(
  a: Line,
  b: Line,
  key: MarketTableSortKey,
  unitPrice: (name: string) => number
): number {
  switch (key) {
    case 'name':
      return normalizeSteamMarketItemName(a.name.trim()).localeCompare(
        normalizeSteamMarketItemName(b.name.trim()),
        undefined,
        { sensitivity: 'base' }
      );
    case 'unit':
      return unitPrice(a.name) - unitPrice(b.name);
    case 'qty':
      return a.qty - b.qty;
    case 'subtotal':
      return (
        unitPrice(a.name) * Math.max(1, a.qty) - unitPrice(b.name) * Math.max(1, b.qty)
      );
    default:
      return 0;
  }
}

/** View order for tables; empty commodity name rows stay at the bottom. */
function sortMarketTableLines(
  lines: Line[],
  sort: { key: MarketTableSortKey; asc: boolean },
  unitPrice: (name: string) => number
): Line[] {
  return [...lines].sort((a, b) => {
    const aEmpty = !a.name.trim();
    const bEmpty = !b.name.trim();
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    const c = marketLineCompare(a, b, sort.key, unitPrice);
    if (c !== 0) return sort.asc ? c : -c;
    return a.id.localeCompare(b.id);
  });
}

function SortTh({
  label,
  sortKey,
  current,
  onSort,
  align = 'left',
  className,
}: {
  label: string;
  sortKey: MarketTableSortKey;
  current: { key: MarketTableSortKey; asc: boolean };
  onSort: (k: MarketTableSortKey) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const active = current.key === sortKey;
  const innerClass =
    align === 'right'
      ? 'flex w-full items-center justify-end gap-2'
      : 'flex w-full items-center justify-between gap-2';
  return (
    <th scope="col" className={className}>
      <button
        type="button"
        className={classNames(
          focusRingBtn,
          'w-full text-xs font-medium uppercase tracking-wider',
          align === 'right' ? 'text-right' : 'text-left',
          'text-gray-400 hover:text-zinc-300'
        )}
        onClick={() => onSort(sortKey)}
        aria-sort={active ? (current.asc ? 'ascending' : 'descending') : 'none'}
      >
        <span className={innerClass}>
          <span className={align === 'right' ? '' : 'min-w-0 truncate'}>{label}</span>
          <SortIndicator
            active={active}
            ascending={current.asc}
            className="h-3 w-3 shrink-0 opacity-80"
          />
        </span>
      </button>
    </th>
  );
}

function newLine(): Line {
  return { id: crypto.randomUUID(), name: '', qty: 1 };
}

/**
 * Steam `/market/multisell` only accepts commodity (stackable / identical) items.
 * Skins with float, stickers, or a custom name are unique listings — sell them one-by-one in Steam.
 */
function isSteamMultisellCommodityRow(r: ItemRow): boolean {
  if (r.item_paint_wear != null) return false;
  if (r.item_has_stickers) return false;
  if (r.item_customname) return false;
  return true;
}

/** Steam listing URLs use `Holo-Foil` instead of `Holo/Foil` (see tradeUp/inventoryPickers.tsx). */
function normalizeSteamMarketItemName(name: string): string {
  return String(name).replaceAll('(Holo/Foil)', '(Holo-Foil)');
}

/**
 * Build a minimal row for `ConvertPrices.getPrice` from a full market hash string (wear in parentheses).
 */
function syntheticItemRowForMarketPrice(name: string): ItemRow {
  const n = normalizeSteamMarketItemName(name.trim());
  const open = n.lastIndexOf(' (');
  if (open > 0 && n.endsWith(')')) {
    const base = n.slice(0, open);
    const wear = n.slice(open + 2, -1);
    if (base && wear) {
      return { item_name: base, item_wear_name: wear } as ItemRow;
    }
  }
  return { item_name: n, item_wear_name: '' } as ItemRow;
}

/** Matches Steam Community Market listing names (see tradeUp/inventoryPickers.tsx). */
function marketListingNameFromRow(r: ItemRow): string {
  const raw =
    r.item_paint_wear == null
      ? r.item_name
      : `${r.item_name} (${r.item_wear_name})`;
  return normalizeSteamMarketItemName(raw);
}

function mergeQtyMaps(into: Map<string, number>, from: Map<string, number>) {
  for (const [k, v] of from) {
    into.set(k, (into.get(k) ?? 0) + v);
  }
  return into;
}

function aggregateMoveableByMarketNameForKind(
  rows: ItemRow[] | undefined,
  wantCommodity: boolean
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows ?? []) {
    if (r.item_moveable !== true) continue;
    if (isSteamMultisellCommodityRow(r) !== wantCommodity) continue;
    const key = marketListingNameFromRow(r);
    const q = Math.max(1, Math.floor(Number(r.combined_QTY) || 1));
    m.set(key, (m.get(key) ?? 0) + q);
  }
  return m;
}

function buildItemUrlLookup(rowsList: (ItemRow[] | undefined)[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const rows of rowsList) {
    for (const r of rows ?? []) {
      const base = r.item_name;
      if (!base) continue;
      const u = r.item_url;
      if (!u) continue;
      const full = marketListingNameFromRow(r);
      if (!map.has(full)) map.set(full, u);
      if (!map.has(base)) map.set(base, u);
    }
  }
  return map;
}

function LineThumb({ srcKey }: { srcKey: string }) {
  const src = useCs2Image(srcKey, { fallback: IMAGE_FALLBACK_DATA_URI });
  return (
    <div
      className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-dark-level-two/90 ring-1 ring-gray-700/40"
      title={srcKey ? undefined : 'No matching inventory icon for this name'}
    >
      <img
        src={src || IMAGE_FALLBACK_DATA_URI}
        alt=""
        className="h-full w-full scale-[1.15] object-contain object-center"
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => {
          if (srcKey) markImageError(srcKey);
        }}
      />
    </div>
  );
}

/**
 * Steam expects literal query keys `items[]` / `qty[]`. URLSearchParams encodes `[` `]` as
 * `%5B` `%5D`, which breaks multisell for every item.
 */
function buildMultisellUrl(lines: Line[]): string {
  const parts: string[] = [
    `appid=${encodeURIComponent(CS2_APP_ID)}`,
    `contextid=${encodeURIComponent(CS2_CONTEXT_ID)}`,
  ];
  for (const line of lines) {
    const name = normalizeSteamMarketItemName(line.name.trim());
    if (!name) continue;
    const qty = Math.min(Math.max(1, Math.floor(line.qty || 1)), 1_000_000);
    parts.push(`items[]=${encodeURIComponent(name)}`);
    parts.push(`qty[]=${encodeURIComponent(String(qty))}`);
  }
  return `https://steamcommunity.com/market/multisell?${parts.join('&')}`;
}

function steamMarketListingsPageUrl(marketHashName: string): string {
  const name = normalizeSteamMarketItemName(marketHashName.trim());
  return `https://steamcommunity.com/market/listings/${CS2_APP_ID}/${encodeURIComponent(name)}`;
}

function mapEntriesToLines(entries: [string, number][]): Line[] {
  return entries.map(([name, qty]) => ({ id: crypto.randomUUID(), name, qty }));
}

function pickerRowKey(r: ItemRow): string {
  const sid = r.storage_id ? String(r.storage_id) : 'bp';
  return `${sid}:${r.item_id}`;
}

function pickerSourceLabel(r: ItemRow): string {
  return r.storage_id ? 'Storage' : 'Backpack';
}

function mergeCommodityLines(prev: Line[], additions: { name: string; qty: number }[]): Line[] {
  const map = new Map<string, number>();
  for (const l of prev) {
    const n = normalizeSteamMarketItemName(l.name.trim());
    if (!n) continue;
    map.set(n, (map.get(n) ?? 0) + l.qty);
  }
  for (const a of additions) {
    const n = normalizeSteamMarketItemName(a.name.trim());
    if (!n) continue;
    map.set(n, (map.get(n) ?? 0) + a.qty);
  }
  const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return entries.length > 0
    ? entries.map(([name, qty]) => ({ id: crypto.randomUUID(), name, qty }))
    : [newLine()];
}

function mergeUniqueLines(prev: Line[], additions: { name: string; qty: number }[]): Line[] {
  const map = new Map<string, number>();
  for (const l of prev) {
    const n = normalizeSteamMarketItemName(l.name.trim());
    if (!n) continue;
    map.set(n, (map.get(n) ?? 0) + l.qty);
  }
  for (const a of additions) {
    const n = normalizeSteamMarketItemName(a.name.trim());
    if (!n) continue;
    map.set(n, (map.get(n) ?? 0) + a.qty);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, qty]) => ({ id: crypto.randomUUID(), name, qty }));
}

function MarketInventoryPickerDialog({
  open,
  onClose,
  mode,
  inventoryRows,
  itemUrlByName,
  formatRowUnitPrice,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'commodity' | 'unique';
  inventoryRows: ItemRow[];
  itemUrlByName: Map<string, string>;
  formatRowUnitPrice: (r: ItemRow) => string;
  onConfirm: (selected: ItemRow[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [moveableOnly, setMoveableOnly] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (open) {
      setSearch('');
      setMoveableOnly(true);
      setSelectedKeys(new Set());
    }
  }, [open, mode]);

  const thumbFor = useCallback(
    (name: string) => {
      const t = name.trim();
      return itemUrlByName.get(normalizeSteamMarketItemName(t)) ?? itemUrlByName.get(t) ?? '';
    },
    [itemUrlByName]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventoryRows.filter((r) => {
      if (moveableOnly && r.item_moveable !== true) return false;
      const comm = isSteamMultisellCommodityRow(r);
      if (mode === 'commodity' && !comm) return false;
      if (mode === 'unique' && comm) return false;
      if (!q) return true;
      const display = marketListingNameFromRow(r).toLowerCase();
      return display.includes(q) || r.item_name.toLowerCase().includes(q);
    });
  }, [inventoryRows, search, moveableOnly, mode]);

  const listScrollRef = useRef<HTMLDivElement>(null);
  const listScrollRafRef = useRef<number | null>(null);
  const [listScrollTop, setListScrollTop] = useState(0);
  const [listViewportH, setListViewportH] = useState(400);

  useLayoutEffect(() => {
    if (!open) return;
    const el = listScrollRef.current;
    if (!el) return;
    const measure = () => setListViewportH(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listScrollRef.current;
    if (el) el.scrollTop = 0;
    setListScrollTop(0);
  }, [open, mode]);

  const onPickerListScroll = useCallback(() => {
    if (listScrollRafRef.current != null) return;
    listScrollRafRef.current = requestAnimationFrame(() => {
      listScrollRafRef.current = null;
      const el = listScrollRef.current;
      if (el) setListScrollTop(el.scrollTop);
    });
  }, []);

  const pickerListTotal = filteredRows.length;
  const pickerStartIdx = Math.max(
    0,
    Math.floor(listScrollTop / PICKER_LIST_ROW_PX) - PICKER_LIST_OVERSCAN
  );
  const pickerEndIdx = Math.min(
    pickerListTotal,
    Math.ceil((listScrollTop + listViewportH) / PICKER_LIST_ROW_PX) + PICKER_LIST_OVERSCAN
  );

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedKeys(new Set(filteredRows.map(pickerRowKey)));
  };

  const clearSelection = () => setSelectedKeys(new Set());

  const selectedRows = useMemo(() => {
    const want = selectedKeys;
    return inventoryRows.filter((r) => want.has(pickerRowKey(r)));
  }, [inventoryRows, selectedKeys]);

  const apply = () => {
    const rows =
      mode === 'commodity'
        ? selectedRows.filter(isSteamMultisellCommodityRow)
        : selectedRows.filter((r) => !isSteamMultisellCommodityRow(r));
    onConfirm(rows);
    onClose();
  };

  const title = mode === 'commodity' ? 'Pick commodities' : 'Pick unique items';
  const blurb =
    mode === 'commodity'
      ? 'Only stackable commodity lines (cases, keys, etc.). Nothing with wear, stickers, or a custom name.'
      : 'Only non-commodities: skins with wear, sticker crafts, or renamed items.';

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[80]" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" aria-hidden />
        </TransitionChild>
        <div className="fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto p-4 sm:items-center">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel className="flex max-h-[min(40rem,85vh)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-700/80 bg-dark-level-three shadow-2xl">
              <div className="frost-sep-b flex shrink-0 items-start justify-between gap-3 border-b-0 px-4 py-3">
                <div>
                  <DialogTitle as="h2" className="text-base font-semibold text-zinc-100">
                    {title}
                  </DialogTitle>
                  <p className="mt-0.5 text-xs text-gray-500">{blurb}</p>
                  <p className="mt-1 text-xs text-gray-600">
                    Backpack and loaded storage. Quantities use combined stack size.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-md p-1 text-gray-400 hover:bg-dark-level-four hover:text-zinc-200"
                  onClick={onClose}
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="frost-sep-b shrink-0 space-y-2 border-b-0 px-4 py-3">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by item or market name…"
                  className="w-full rounded-md border border-gray-600 bg-dark-level-one px-3 py-2 text-sm text-zinc-100 placeholder:text-gray-600 focus:border-kryo-navy-500 focus:outline-none focus:ring-1 focus:ring-kryo-navy-500"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-gray-400">
                    <input
                      type="checkbox"
                      className="rounded border-gray-500 bg-dark-level-one text-kryo-navy-600 focus:ring-kryo-navy-500"
                      checked={moveableOnly}
                      onChange={(e) => setMoveableOnly(e.target.checked)}
                    />
                    Moveable only
                  </label>
                  <span
                    className={classNames(
                      'rounded px-2 py-0.5 text-[11px] font-medium',
                      mode === 'commodity'
                        ? 'bg-emerald-950/60 text-emerald-300/90'
                        : 'bg-violet-950/50 text-violet-200/85'
                    )}
                  >
                    {mode === 'commodity' ? 'Commodities only' : 'Unique only'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={classNames(btnDefault, 'px-2 py-1 text-xs')} onClick={selectAllVisible}>
                    Select visible ({filteredRows.length})
                  </button>
                  <button type="button" className={classNames(btnDefault, 'px-2 py-1 text-xs')} onClick={clearSelection}>
                    Clear selection
                  </button>
                </div>
              </div>

              <div
                ref={listScrollRef}
                onScroll={onPickerListScroll}
                className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
              >
                {filteredRows.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-gray-500">Nothing matches these filters.</p>
                ) : (
                  <div
                    className="relative"
                    style={{ height: pickerListTotal * PICKER_LIST_ROW_PX }}
                  >
                    {filteredRows.slice(pickerStartIdx, pickerEndIdx).map((r, vi) => {
                      const index = pickerStartIdx + vi;
                      const k = pickerRowKey(r);
                      const checked = selectedKeys.has(k);
                      const display = marketListingNameFromRow(r);
                      const qty = Math.max(1, Math.floor(Number(r.combined_QTY) || 1));
                      return (
                        <div
                          key={k}
                          className="absolute left-2 right-2"
                          style={{ top: index * PICKER_LIST_ROW_PX, height: PICKER_LIST_ROW_PX }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleKey(k)}
                            className={classNames(
                              'flex h-full w-full items-center gap-2 rounded-lg border px-2 py-1 text-left transition-colors',
                              checked
                                ? 'border-kryo-navy-600/70 bg-kryo-navy-950/40'
                                : 'border-transparent bg-dark-level-two/40 hover:bg-dark-level-two/80'
                            )}
                          >
                            <span
                              className={classNames(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]',
                                checked
                                  ? 'border-kryo-navy-500 bg-kryo-navy-800 text-white'
                                  : 'border-gray-500 bg-dark-level-one'
                              )}
                              aria-hidden
                            >
                              {checked ? '✓' : ''}
                            </span>
                            <LineThumb srcKey={thumbFor(display)} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-zinc-100">{display}</span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500">
                                <span className="tabular-nums">×{qty}</span>
                                <span>{pickerSourceLabel(r)}</span>
                              </span>
                            </span>
                            <span className="shrink-0 text-right text-[11px] font-medium tabular-nums text-emerald-400/90">
                              {formatRowUnitPrice(r)}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-700/80 px-4 py-3">
                <span className="mr-auto text-xs text-gray-500">{selectedKeys.size} selected</span>
                <button type="button" className={classNames(btnDefault, 'px-3 py-2 text-sm')} onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={classNames(btnPrimary, 'px-3 py-2 text-sm disabled:opacity-45')}
                  disabled={selectedKeys.size === 0}
                  onClick={apply}
                >
                  {mode === 'commodity' ? 'Add to commodity list' : 'Add to unique list'}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}

export default function MarketMultisellHelper() {
  const settingsData = useSelector(selectSettings);
  const pricingState = useSelector(selectPricing);
  const { inventory, combinedInventory, storageInventory, storageInventoryRaw } =
    useSelector(selectInventory);

  const priceFmt = useMemo(
    () => new ConvertPricesFormatted(settingsData, pricingState),
    [settingsData, pricingState]
  );

  const marketLineUnitPrice = useCallback(
    (marketName: string) => {
      const t = marketName.trim();
      if (!t) return '—';
      const p = priceFmt.getPrice(syntheticItemRowForMarketPrice(t));
      if (!Number.isFinite(p) || p <= 0) return '—';
      return priceFmt.formatPrice(p);
    },
    [priceFmt]
  );

  const marketLineSubtotal = useCallback(
    (marketName: string, qty: number) => {
      const t = marketName.trim();
      if (!t) return '—';
      const p = priceFmt.getPrice(syntheticItemRowForMarketPrice(t));
      if (!Number.isFinite(p) || p <= 0) return '—';
      return priceFmt.formatPrice(p * Math.max(1, qty));
    },
    [priceFmt]
  );

  const formatPickerRowUnitPrice = useCallback(
    (r: ItemRow) => {
      const p = priceFmt.getPrice(r);
      if (!Number.isFinite(p) || p <= 0) return '—';
      return priceFmt.formatPrice(p);
    },
    [priceFmt]
  );

  const [commodityLines, setCommodityLines] = useState<Line[]>(() => [newLine()]);
  const [uniqueLines, setUniqueLines] = useState<Line[]>([]);
  const [commoditySort, setCommoditySort] = useState<{ key: MarketTableSortKey; asc: boolean }>({
    key: 'name',
    asc: true,
  });
  const [uniqueSort, setUniqueSort] = useState<{ key: MarketTableSortKey; asc: boolean }>({
    key: 'name',
    asc: true,
  });
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [lastLoadCounts, setLastLoadCounts] = useState<{ c: number; u: number } | null>(null);
  const [pickerTarget, setPickerTarget] = useState<'commodity' | 'unique' | null>(null);

  const getUnitPriceNum = useCallback(
    (marketName: string) => {
      const t = marketName.trim();
      if (!t) return 0;
      const p = priceFmt.getPrice(syntheticItemRowForMarketPrice(t));
      return Number.isFinite(p) && p > 0 ? p : 0;
    },
    [priceFmt]
  );

  const sortedCommodityLines = useMemo(
    () => sortMarketTableLines(commodityLines, commoditySort, getUnitPriceNum),
    [commodityLines, commoditySort, getUnitPriceNum]
  );

  const sortedUniqueLines = useMemo(
    () => sortMarketTableLines(uniqueLines, uniqueSort, getUnitPriceNum),
    [uniqueLines, uniqueSort, getUnitPriceNum]
  );

  const toggleCommoditySort = useCallback((key: MarketTableSortKey) => {
    setCommoditySort((prev) => (prev.key === key ? { key, asc: !prev.asc } : { key, asc: true }));
  }, []);

  const toggleUniqueSort = useCallback((key: MarketTableSortKey) => {
    setUniqueSort((prev) => (prev.key === key ? { key, asc: !prev.asc } : { key, asc: true }));
  }, []);

  const inventoryRowsFlat = useMemo(() => {
    const out: ItemRow[] = [];
    for (const r of (combinedInventory as ItemRow[] | undefined) ?? []) out.push(r);
    for (const r of (storageInventoryRaw as ItemRow[] | undefined) ?? []) out.push(r);
    return out;
  }, [combinedInventory, storageInventoryRaw]);

  const applyCommodityPicker = useCallback((selected: ItemRow[]) => {
    const adds = selected.map((r) => ({
      name: marketListingNameFromRow(r),
      qty: Math.max(1, Math.floor(Number(r.combined_QTY) || 1)),
    }));
    if (adds.length) setCommodityLines((prev) => mergeCommodityLines(prev, adds));
  }, []);

  const applyUniquePicker = useCallback((selected: ItemRow[]) => {
    const adds = selected.map((r) => ({
      name: marketListingNameFromRow(r),
      qty: Math.max(1, Math.floor(Number(r.combined_QTY) || 1)),
    }));
    if (adds.length) setUniqueLines((prev) => mergeUniqueLines(prev, adds));
  }, []);

  const url = useMemo(() => buildMultisellUrl(commodityLines), [commodityLines]);
  const hasCommodityPayload = useMemo(
    () => commodityLines.some((l) => l.name.trim().length > 0),
    [commodityLines]
  );
  const urlLong = url.length > URL_LENGTH_WARN;

  const itemUrlByName = useMemo(
    () =>
      buildItemUrlLookup([
        inventory as ItemRow[] | undefined,
        combinedInventory as ItemRow[] | undefined,
        storageInventory as ItemRow[] | undefined,
        storageInventoryRaw as ItemRow[] | undefined,
      ]),
    [inventory, combinedInventory, storageInventory, storageInventoryRaw]
  );

  const thumbSrc = (name: string) => {
    const t = name.trim();
    return (
      itemUrlByName.get(normalizeSteamMarketItemName(t)) ?? itemUrlByName.get(t) ?? ''
    );
  };

  const loadFromMoveable = useCallback(() => {
    let comm = aggregateMoveableByMarketNameForKind(combinedInventory as ItemRow[] | undefined, true);
    mergeQtyMaps(comm, aggregateMoveableByMarketNameForKind(storageInventoryRaw as ItemRow[] | undefined, true));
    let uniq = aggregateMoveableByMarketNameForKind(combinedInventory as ItemRow[] | undefined, false);
    mergeQtyMaps(uniq, aggregateMoveableByMarketNameForKind(storageInventoryRaw as ItemRow[] | undefined, false));

    const cEntries = [...comm.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const uEntries = [...uniq.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    setLastLoadCounts({ c: cEntries.length, u: uEntries.length });
    setCommodityLines(cEntries.length > 0 ? mapEntriesToLines(cEntries) : [newLine()]);
    setUniqueLines(mapEntriesToLines(uEntries));
  }, [combinedInventory, storageInventoryRaw]);

  const clearCommodities = useCallback(() => {
    setCommodityLines([newLine()]);
  }, []);

  const clearUniques = useCallback(() => {
    setUniqueLines([]);
  }, []);

  const clearAll = useCallback(() => {
    setCommodityLines([newLine()]);
    setUniqueLines([]);
    setLastLoadCounts(null);
  }, []);

  const updateCommodityLine = useCallback((id: string, patch: Partial<Pick<Line, 'name' | 'qty'>>) => {
    setCommodityLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);

  const removeCommodityLine = useCallback((id: string) => {
    setCommodityLines((prev) => (prev.length <= 1 ? [newLine()] : prev.filter((l) => l.id !== id)));
  }, []);

  const addCommodityLine = useCallback(() => {
    setCommodityLines((prev) => [...prev, newLine()]);
  }, []);

  const removeUniqueLine = useCallback((id: string) => {
    setUniqueLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const openInBrowser = useCallback(async () => {
    setOpenError(null);
    if (!hasCommodityPayload) return;
    const res = await window.electron.ipcRenderer.openSteamCommunityUrl(url);
    if (!res.ok) {
      setOpenError(
        res.error === 'not-allowed'
          ? 'That link could not be opened (only steamcommunity.com market URLs are allowed).'
          : 'Could not open link.'
      );
    }
  }, [hasCommodityPayload, url]);

  const openListingsInBrowser = useCallback(async (marketHashName: string) => {
    setOpenError(null);
    const u = steamMarketListingsPageUrl(marketHashName);
    const res = await window.electron.ipcRenderer.openSteamCommunityUrl(u);
    if (!res.ok) setOpenError('Could not open market page.');
  }, []);

  const copyUrl = useCallback(async () => {
    setCopyHint(null);
    if (!hasCommodityPayload) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopyHint('Copied');
      window.setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setCopyHint('Copy failed');
    }
  }, [hasCommodityPayload, url]);

  return (
    <div className="min-h-full bg-dark-level-one px-2 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-lg font-semibold text-zinc-100 sm:text-xl">
          Steam Community Market — links
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Build Valve&apos;s official <span className="text-gray-400">multisell</span> link for{' '}
          <strong className="font-medium text-gray-400">commodity</strong> items only (CS2 app{' '}
          {CS2_APP_ID}, context {CS2_CONTEXT_ID}). Open it in your browser; KryoVex does not post listings.
        </p>

        <div
          className={classNames(
            'mt-4 rounded-lg border p-4 text-sm',
            'border-sky-800/50 bg-sky-950/20 text-sky-100/95'
          )}
          role="note"
        >
          <p className="font-medium text-sky-200/95">Commodities vs unique items</p>
          <p className="mt-2 text-sky-100/85">
            Steam&apos;s multisell page only accepts <strong className="font-semibold">commodities</strong>{' '}
            (stackable items where every unit is identical: cases, keys, capsules, plain stickers, etc.).
            Weapon skins with wear, anything with stickers applied, or a custom name are{' '}
            <strong className="font-semibold">not commodities</strong> — Steam shows an error like &quot;not a
            commodity and cannot be sold using this page.&quot; Those must be listed individually from your
            Steam inventory or the normal sell flow.
          </p>
        </div>

        <div
          className={classNames(
            'mt-3 rounded-lg border p-4 text-sm',
            'border-amber-700/50 bg-amber-950/25 text-amber-100/95'
          )}
          role="note"
        >
          <p className="font-medium text-amber-200/95">Steam Guard &amp; browser login</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-amber-100/85">
            <li>
              Use a browser where you are already signed into Steam, or complete Steam&apos;s sign-in when
              the page loads.
            </li>
            <li>
              Listings usually require confirmations in the{' '}
              <strong className="font-semibold">Steam Mobile app</strong>. KryoVex does not automate that.
            </li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className={classNames(btnDefault, 'px-3 py-2 text-sm')} onClick={loadFromMoveable}>
            Load all moveable (inventory + storage)
          </button>
          <button type="button" className={classNames(btnDefault, 'px-3 py-2 text-sm')} onClick={clearAll}>
            Clear all
          </button>
        </div>
        {lastLoadCounts != null ? (
          <p className="mt-2 text-xs text-gray-500">
            Last load: {lastLoadCounts.c} commodity line(s), {lastLoadCounts.u} unique line(s).
          </p>
        ) : null}

        <h2 className="mt-8 text-base font-semibold text-zinc-200">
          1. Commodities — multisell link
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Only these rows are included in the URL below. Names must match the Community Market (e.g. case
          names). Use <span className="font-mono text-gray-400">items[]</span> /{' '}
          <span className="font-mono text-gray-400">qty[]</span> format as on Steam.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={classNames(btnPrimary, 'px-3 py-2 text-sm inline-flex items-center gap-2')}
            onClick={() => setPickerTarget('commodity')}
          >
            <InboxStackIcon className="h-4 w-4 shrink-0" aria-hidden />
            Pick commodities
          </button>
          <button
            type="button"
            className={classNames(btnDefault, 'px-3 py-2 text-sm')}
            onClick={clearCommodities}
          >
            Clear commodities
          </button>
          <button
            type="button"
            className={classNames(btnDefault, 'px-3 py-2 text-sm inline-flex items-center gap-1')}
            onClick={addCommodityLine}
          >
            <PlusIcon className="h-4 w-4" aria-hidden />
            Add commodity row
          </button>
        </div>

        <div className="mt-3 overflow-x-auto rounded-lg border border-gray-700/80 bg-dark-level-three">
          <table className="min-w-full text-left text-sm text-zinc-200">
            <thead className="border-b border-gray-700/80 bg-dark-level-two/80 text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th scope="col" className="w-12 px-2 py-2">
                  <span className="sr-only">Icon</span>
                </th>
                <SortTh
                  label="Market name (commodity)"
                  sortKey="name"
                  current={commoditySort}
                  onSort={toggleCommoditySort}
                  className="px-3 py-2"
                />
                <SortTh
                  label="Unit"
                  sortKey="unit"
                  align="right"
                  current={commoditySort}
                  onSort={toggleCommoditySort}
                  className="w-[5.5rem] whitespace-nowrap px-2 py-2"
                />
                <SortTh
                  label="Qty"
                  sortKey="qty"
                  align="right"
                  current={commoditySort}
                  onSort={toggleCommoditySort}
                  className="w-28 px-3 py-2"
                />
                <SortTh
                  label="Subtotal"
                  sortKey="subtotal"
                  align="right"
                  current={commoditySort}
                  onSort={toggleCommoditySort}
                  className="w-[6rem] whitespace-nowrap px-2 py-2"
                />
                <th scope="col" className="w-12 px-1 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/60">
              {sortedCommodityLines.map((line) => (
                <tr key={line.id}>
                  <td className="px-2 py-1.5 align-middle">
                    <LineThumb srcKey={thumbSrc(line.name)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <label className="sr-only" htmlFor={`c-name-${line.id}`}>
                      Item name
                    </label>
                    <input
                      id={`c-name-${line.id}`}
                      className="w-full min-w-[10rem] rounded border border-gray-600 bg-dark-level-one px-2 py-1.5 text-sm text-zinc-100 placeholder:text-gray-600 focus:border-kryo-navy-500 focus:outline-none focus:ring-1 focus:ring-kryo-navy-500"
                      placeholder="e.g. Falchion Case"
                      value={line.name}
                      onChange={(e) => updateCommodityLine(line.id, { name: e.target.value })}
                      autoComplete="off"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right align-middle text-xs tabular-nums text-emerald-400/90">
                    {marketLineUnitPrice(line.name)}
                  </td>
                  <td className="px-2 py-1.5">
                    <label className="sr-only" htmlFor={`c-qty-${line.id}`}>
                      Quantity
                    </label>
                    <input
                      id={`c-qty-${line.id}`}
                      type="number"
                      min={1}
                      step={1}
                      className="w-full rounded border border-gray-600 bg-dark-level-one px-2 py-1.5 text-right text-sm text-zinc-100 focus:border-kryo-navy-500 focus:outline-none focus:ring-1 focus:ring-kryo-navy-500"
                      value={line.qty}
                      onChange={(e) =>
                        updateCommodityLine(line.id, {
                          qty: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                        })
                      }
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right align-middle text-xs font-medium tabular-nums text-emerald-400/90">
                    {marketLineSubtotal(line.name, line.qty)}
                  </td>
                  <td className="px-1 py-1.5 text-center">
                    <button
                      type="button"
                      className="rounded p-1.5 text-gray-500 hover:bg-dark-level-four hover:text-zinc-200"
                      onClick={() => removeCommodityLine(line.id)}
                      title="Remove row"
                    >
                      <TrashIcon className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-600">
          Unit / subtotal use your pricing source and wallet currency when a price exists in KryoVex.
        </p>

        <div className="mt-4 space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Multisell URL</label>
          <textarea
            readOnly
            className="h-24 w-full resize-y rounded-lg border border-gray-700 bg-dark-level-two px-3 py-2 font-mono text-xs text-gray-300"
            value={hasCommodityPayload ? url : ''}
            placeholder="Add at least one commodity name to generate a multisell link."
          />
          {urlLong ? (
            <p className="text-sm text-amber-400/90">
              This URL is very long ({url.length} characters). Try fewer lines or split into multiple
              sessions.
            </p>
          ) : null}
          {openError ? <p className="text-sm text-red-400">{openError}</p> : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={classNames(
              btnPrimary,
              'inline-flex items-center gap-2 px-4 py-2 disabled:pointer-events-none disabled:opacity-45'
            )}
            disabled={!hasCommodityPayload}
            onClick={() => void openInBrowser()}
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
            Open multisell in browser
          </button>
          <button
            type="button"
            className={classNames(btnDefault, 'px-4 py-2 disabled:pointer-events-none disabled:opacity-45')}
            disabled={!hasCommodityPayload}
            onClick={() => void copyUrl()}
          >
            Copy multisell link
          </button>
          {copyHint ? <span className="text-sm text-gray-500">{copyHint}</span> : null}
        </div>

        <h2 className="mt-10 text-base font-semibold text-zinc-200">
          2. Unique items — not for multisell
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Detected moveable skins and other non-commodities (wear, stickers, or custom name). Sell these one
          at a time in Steam. The button opens that item&apos;s Community Market listings page (buy/sell hub)
          for reference — not the bulk multisell screen.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={classNames(btnPrimary, 'px-3 py-2 text-sm inline-flex items-center gap-2')}
            onClick={() => setPickerTarget('unique')}
          >
            <InboxStackIcon className="h-4 w-4 shrink-0" aria-hidden />
            Pick unique items
          </button>
          <button type="button" className={classNames(btnDefault, 'px-3 py-2 text-sm')} onClick={clearUniques}>
            Clear unique list
          </button>
        </div>

        {uniqueLines.length === 0 ? (
          <p className="mt-3 rounded-md border border-gray-700/80 bg-dark-level-three/80 px-3 py-2 text-sm text-gray-500">
            No items here yet. Use <span className="font-medium text-gray-400">Pick unique items</span>,{' '}
            <span className="font-medium text-gray-400">Load all moveable</span>, or you may only have
            commodities.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-gray-700/80 bg-dark-level-three">
            <table className="min-w-full text-left text-sm text-zinc-200">
              <thead className="border-b border-gray-700/80 bg-dark-level-two/80 text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th scope="col" className="w-12 px-2 py-2">
                    <span className="sr-only">Icon</span>
                  </th>
                  <SortTh
                    label="Market name"
                    sortKey="name"
                    current={uniqueSort}
                    onSort={toggleUniqueSort}
                    className="px-3 py-2"
                  />
                  <SortTh
                    label="Unit"
                    sortKey="unit"
                    align="right"
                    current={uniqueSort}
                    onSort={toggleUniqueSort}
                    className="w-[5.5rem] whitespace-nowrap px-2 py-2"
                  />
                  <SortTh
                    label="Qty"
                    sortKey="qty"
                    align="right"
                    current={uniqueSort}
                    onSort={toggleUniqueSort}
                    className="w-24 px-3 py-2"
                  />
                  <SortTh
                    label="Subtotal"
                    sortKey="subtotal"
                    align="right"
                    current={uniqueSort}
                    onSort={toggleUniqueSort}
                    className="w-[6rem] whitespace-nowrap px-2 py-2"
                  />
                  <th scope="col" className="px-3 py-2 text-right">
                    Market
                  </th>
                  <th scope="col" className="w-12 px-1 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/60">
                {sortedUniqueLines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-2 py-1.5 align-middle">
                      <LineThumb srcKey={thumbSrc(line.name)} />
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <span className="text-sm text-zinc-200">{line.name}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right align-middle text-xs tabular-nums text-emerald-400/90">
                      {marketLineUnitPrice(line.name)}
                    </td>
                    <td className="px-2 py-1.5 text-right align-middle tabular-nums">{line.qty}</td>
                    <td className="px-2 py-1.5 text-right align-middle text-xs font-medium tabular-nums text-emerald-400/90">
                      {marketLineSubtotal(line.name, line.qty)}
                    </td>
                    <td className="px-2 py-1.5 text-right align-middle">
                      <button
                        type="button"
                        className={classNames(btnDefault, 'px-2 py-1 text-xs')}
                        onClick={() => void openListingsInBrowser(line.name)}
                      >
                        Listings
                      </button>
                    </td>
                    <td className="px-1 py-1.5 text-center align-middle">
                      <button
                        type="button"
                        className="rounded p-1.5 text-gray-500 hover:bg-dark-level-four hover:text-zinc-200"
                        onClick={() => removeUniqueLine(line.id)}
                        title="Remove from list"
                      >
                        <TrashIcon className="h-4 w-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-8 text-xs text-gray-600">
          Multisell pattern:{' '}
          <span className="break-all font-mono text-gray-500">
            https://steamcommunity.com/market/multisell?appid=730&amp;contextid=2&amp;items[]=…&amp;qty[]=…
          </span>
        </p>

        <MarketInventoryPickerDialog
          open={pickerTarget !== null}
          mode={pickerTarget ?? 'commodity'}
          onClose={() => setPickerTarget(null)}
          inventoryRows={inventoryRowsFlat}
          itemUrlByName={itemUrlByName}
          formatRowUnitPrice={formatPickerRowUnitPrice}
          onConfirm={pickerTarget === 'unique' ? applyUniquePicker : applyCommodityPicker}
        />
      </div>
    </div>
  );
}
