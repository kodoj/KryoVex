import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { SortIndicator } from 'renderer/components/content/shared/SortIndicator.tsx';
import { useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { searchFilter } from 'renderer/functionsClasses/filters/search.ts';
import { ConvertPrices, ConvertPricesFormatted } from 'renderer/functionsClasses/prices.ts';
import { IMAGE_FALLBACK_DATA_URI } from 'renderer/functionsClasses/createCSGOImage.ts';
import { ItemRow } from 'renderer/interfaces/items.ts';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectInventoryFilters } from 'renderer/store/slices/inventoryFilters.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { focusRingBtn } from 'renderer/components/content/shared/buttonStyles.ts';
import {
  overviewTheadClassName,
  overviewTheadTrClassName,
  overviewThCellOverride,
  overviewTbodyClassName,
  overviewTrClassName,
} from 'renderer/components/content/shared/tableOverviewStyles.ts';
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import { markImageError, useCs2Image } from 'renderer/hooks/useCs2Image.ts';

const overviewUniqueTableClass =
  'w-full border-collapse text-left text-xs sm:text-sm text-zinc-200 [&_th]:!px-1 [&_th]:!py-1.5 [&_td]:!px-1 [&_td]:!py-1.5 [&_th:first-child]:!pl-2 [&_td:first-child]:!pl-2 [&_th:first-child]:!pr-1 [&_td:first-child]:!pr-1 [&_th]:text-[10px] [&_th]:uppercase [&_th]:tracking-wider sm:[&_th]:text-xs';

const sortThBtnLeft = classNames(
  'w-full flex items-center justify-between gap-2 rounded-sm text-left',
  'text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:text-xs',
  'hover:text-gray-900 dark:hover:text-gray-200',
  focusRingBtn
);

const sortThBtnCenter = classNames(
  'relative w-full flex items-center justify-center gap-2 rounded-sm pr-4 text-center',
  'text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:text-xs',
  'hover:text-gray-900 dark:hover:text-gray-200',
  focusRingBtn
);

const sortChevronEnd = 'h-3 w-3 shrink-0 opacity-80 absolute right-0 top-1/2 -translate-y-1/2';

function steamMarketListingUrl(marketHashName: string): string {
  const n = marketHashName.replaceAll('(Holo/Foil)', '(Holo-Foil)');
  return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(n)}`;
}

type SortKey = 'name' | 'qty' | 'storVal' | 'unit' | 'total';

type Row = {
  name: string;
  itemUrl: string;
  /** Canonical market hash name (wear, Holo/Foil) from first contributing row */
  marketHashName: string;
  qty: number;
  storVal: number;
  total: number;
  unit: number;
};

function buildRows(
  invRows: ItemRow[],
  storRows: ItemRow[],
  conv: ConvertPrices
): Row[] {
  const map = new Map<
    string,
    { qty: number; invVal: number; storVal: number; itemUrl: string; marketHashName: string }
  >();

  const bump = (rows: ItemRow[], field: 'invVal' | 'storVal') => {
    for (const row of rows) {
      if (row?.item_moveable !== true) continue;
      const name = String(row.item_name ?? '').trim() || '(unnamed)';
      const qty = row.combined_QTY ?? 0;
      const p = conv.getPrice(row, true);
      const line = (Number.isFinite(p) ? p : 0) * qty;
      const cur =
        map.get(name) ?? {
          qty: 0,
          invVal: 0,
          storVal: 0,
          itemUrl: '',
          marketHashName: '',
        };
      cur.qty += qty;
      cur[field] += line;
      if (!cur.itemUrl && row.item_url) {
        cur.itemUrl = row.item_url;
      }
      if (!cur.marketHashName) {
        cur.marketHashName = conv._getName(row);
      }
      map.set(name, cur);
    }
  };

  bump(invRows, 'invVal');
  bump(storRows, 'storVal');

  const out: Row[] = [];
  for (const [name, v] of map) {
    const total = v.invVal + v.storVal;
    const unit = v.qty > 0 ? total / v.qty : 0;
    out.push({
      name,
      itemUrl: v.itemUrl,
      marketHashName: v.marketHashName || name,
      qty: v.qty,
      storVal: v.storVal,
      total,
      unit,
    });
  }
  return out;
}

function sortRows(rows: Row[], sortKey: SortKey, sortDir: 'asc' | 'desc'): Row[] {
  const copy = [...rows];
  const m = sortDir === 'asc' ? 1 : -1;
  copy.sort((a, b) => {
    switch (sortKey) {
      case 'name':
        return m * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      case 'qty':
        return m * (a.qty - b.qty);
      case 'storVal':
        return m * (a.storVal - b.storVal);
      case 'unit':
        return m * (a.unit - b.unit);
      case 'total':
        return m * (a.total - b.total);
      default:
        return 0;
    }
  });
  return copy;
}

function defaultDirForColumn(key: SortKey): 'asc' | 'desc' {
  return key === 'name' ? 'asc' : 'desc';
}

function ItemThumb({ srcKey }: { srcKey: string }) {
  const src = useCs2Image(srcKey, { fallback: IMAGE_FALLBACK_DATA_URI });
  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-dark-level-two/90 ring-1 ring-gray-700/40">
      <img
        src={src || IMAGE_FALLBACK_DATA_URI}
        alt=""
        className="h-full w-full scale-[1.18] object-contain object-center"
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

export default function UniqueItemsSummaryCard() {
  const settings = useSelector(selectSettings);
  const pricing = useSelector(selectPricing);
  const inventory = useSelector(selectInventory);
  const filters = useSelector(selectInventoryFilters);

  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const conv = useMemo(() => new ConvertPrices(settings, pricing), [settings, pricing]);
  const fmt = useMemo(() => new ConvertPricesFormatted(settings, pricing), [settings, pricing]);

  const rows = useMemo(() => {
    const inv = searchFilter(inventory.combinedInventory, filters, undefined) as ItemRow[];
    const stor = searchFilter(inventory.storageInventory, filters, undefined) as ItemRow[];
    return buildRows(inv, stor, conv);
  }, [inventory.combinedInventory, inventory.storageInventory, filters, conv]);

  const sortedRows = useMemo(
    () => sortRows(rows, sortKey, sortDir),
    [rows, sortKey, sortDir]
  );

  const onSort = useCallback((key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(defaultDirForColumn(key));
    }
  }, [sortKey]);

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-gray-800 bg-dark-level-three px-2 py-1.5 text-sm text-gray-500">
        No items match the current filters.
      </div>
    );
  }

  const thSep = 'relative whitespace-nowrap border-r border-gray-600/55 dark:border-gray-600/50';

  return (
    <div className="overflow-hidden rounded-lg border border-gray-700/90 bg-dark-level-three shadow-[0_4px_24px_rgba(0,0,0,0.35)] ring-1 ring-gray-900/80">
      <div className="border-b border-gray-700/60 bg-dark-level-three px-2 py-1.5 sm:px-2.5">
        <h2 className="text-sm font-semibold text-zinc-100 antialiased">Unique items</h2>
        <p className="text-xs text-gray-500">Same filters as charts.</p>
      </div>
      <div className="max-h-[min(72vh,620px)] w-full min-w-0 overflow-auto">
        <table className={classNames(overviewUniqueTableClass, overviewThCellOverride)}>
          <thead className={overviewTheadClassName}>
            <tr className={overviewTheadTrClassName}>
              <th scope="col" className={thSep}>
                <button
                  type="button"
                  className={sortThBtnLeft}
                  onClick={() => onSort('name')}
                  aria-sort={
                    sortKey === 'name'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <span className="truncate">Product</span>
                  <SortIndicator
                    active={sortKey === 'name'}
                    ascending={sortDir === 'asc'}
                    className="h-3 w-3 shrink-0 opacity-80"
                  />
                </button>
              </th>
              <th scope="col" className={thSep}>
                <button
                  type="button"
                  className={sortThBtnCenter}
                  onClick={() => onSort('qty')}
                  aria-sort={
                    sortKey === 'qty'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <span>Qty</span>
                  <SortIndicator
                    active={sortKey === 'qty'}
                    ascending={sortDir === 'asc'}
                    className={sortChevronEnd}
                  />
                </button>
              </th>
              <th scope="col" className={thSep}>
                <button
                  type="button"
                  className={sortThBtnCenter}
                  onClick={() => onSort('storVal')}
                  aria-sort={
                    sortKey === 'storVal'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <span>Storage</span>
                  <SortIndicator
                    active={sortKey === 'storVal'}
                    ascending={sortDir === 'asc'}
                    className={sortChevronEnd}
                  />
                </button>
              </th>
              <th scope="col" className={thSep}>
                <button
                  type="button"
                  className={sortThBtnCenter}
                  onClick={() => onSort('unit')}
                  aria-sort={
                    sortKey === 'unit'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <span>Unit</span>
                  <SortIndicator
                    active={sortKey === 'unit'}
                    ascending={sortDir === 'asc'}
                    className={sortChevronEnd}
                  />
                </button>
              </th>
              <th scope="col" className={thSep}>
                <button
                  type="button"
                  className={sortThBtnCenter}
                  onClick={() => onSort('total')}
                  aria-sort={
                    sortKey === 'total'
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <span>Total</span>
                  <SortIndicator
                    active={sortKey === 'total'}
                    ascending={sortDir === 'asc'}
                    className={sortChevronEnd}
                  />
                </button>
              </th>
              <th
                scope="col"
                className="relative w-10 whitespace-nowrap px-0.5 py-1.5 text-center sm:w-11 sm:px-1"
              >
                <span className="sr-only">Steam Market</span>
                <ArrowTopRightOnSquareIcon className="mx-auto h-4 w-4 opacity-80" aria-hidden />
              </th>
            </tr>
          </thead>
          <tbody className={overviewTbodyClassName}>
            {sortedRows.map((r) => (
              <tr key={r.name} className={overviewTrClassName}>
                <td className="max-w-[min(100vw-10rem,32rem)] px-1 py-0.5 sm:px-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <ItemThumb srcKey={r.itemUrl} />
                    <span
                      className="min-w-0 truncate font-medium text-zinc-100"
                      title={r.name}
                    >
                      {r.name}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-0.5 py-0.5 text-right tabular-nums text-gray-300 sm:px-1.5">
                  {r.qty % 1 === 0 ? String(r.qty) : r.qty.toFixed(2)}
                </td>
                <td className="whitespace-nowrap px-0.5 py-0.5 text-right tabular-nums text-gray-300 sm:px-1.5">
                  {fmt.formatPrice(r.storVal)}
                </td>
                <td className="whitespace-nowrap px-0.5 py-0.5 text-right tabular-nums text-gray-300 sm:px-1.5">
                  {fmt.formatPrice(r.unit)}
                </td>
                <td className="whitespace-nowrap px-1 py-0.5 text-right text-sm font-medium tabular-nums text-green-400 sm:px-2">
                  {fmt.formatPrice(r.total)}
                </td>
                <td className="whitespace-nowrap px-0.5 py-0.5 text-center sm:px-1">
                  <Link
                    to={{ pathname: steamMarketListingUrl(r.marketHashName) }}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Steam Community Market: ${r.marketHashName}`}
                    className="inline-flex rounded p-1 text-gray-500 transition-colors hover:bg-dark-level-four/60 hover:text-zinc-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-500"
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
                    <span className="sr-only">Open Steam market listing</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
