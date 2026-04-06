import { createSelector } from "@reduxjs/toolkit";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import { setColumnWidths } from "renderer/store/slices/settings.ts";
import { setSort as setInventorySort } from "renderer/store/slices/inventoryFilters.ts";
import { setSort as setMoveFromSort } from "renderer/store/slices/moveFrom.ts";
import { setSort as setMoveToSort } from "renderer/store/slices/moveTo.ts";
import type { RootState } from "renderer/store/rootReducer.ts";
import { inventorySetSortStorage } from "renderer/store/inventory/inventoryActions.tsx";
import { focusRingBtn } from "../../shared/buttonStyles.ts";
import { sortDataFunction } from "../../shared/filters/inventoryFunctions.ts";
import { SortIndicator } from "../../shared/SortIndicator.tsx";

type SortTarget = 'inventory' | 'moveFrom' | 'moveTo';
function sortActionFor(target: SortTarget) {
  switch (target) {
    case 'moveFrom':
      return setMoveFromSort;
    case 'moveTo':
      return setMoveToSort;
    case 'inventory':
    default:
      return setInventorySort;
  }
}

/** Inputs for storage re-sort when a column header is clicked (memoized; avoids 4 separate subscriptions per cell). */
const selectHeaderStorageSortInputs = createSelector(
  [
    (s: RootState) => s.inventory.storageInventory,
    (s: RootState) => s.inventoryFilters.storageFiltered,
    (s: RootState) => s.pricing.prices,
    (s: RootState) => s.settings.source?.title,
  ],
  (storageInventory, storageFiltered, prices, sourceTitle) => ({
    storageInventory,
    storageFiltered,
    prices,
    sourceTitle,
  })
);

function useTableSortState(sortTarget: SortTarget) {
  return useSelector(
    (s: RootState) => {
      if (sortTarget === 'moveFrom') {
        return { sortValue: s.moveFrom.sortValue, sortBack: s.moveFrom.sortBack };
      }
      if (sortTarget === 'moveTo') {
        return { sortValue: s.moveTo.sortValue, sortBack: s.moveTo.sortBack };
      }
      return { sortValue: s.inventoryFilters.sortValue, sortBack: s.inventoryFilters.sortBack };
    },
    shallowEqual
  );
}

let __lastFitClickAt = 0;
let __lastFitColKey = '';
const COLUMN_MIN_WIDTH = 60;

function tableUsesFillWidth(table: HTMLTableElement) {
  return table.getAttribute('data-table-width') === 'fill';
}

/** Fixed tables: explicit pixel width (window can hug). Fill tables: stretch in scroll area, min-width = col sum. */
function applyTableLayoutWidth(table: HTMLTableElement, sum: number) {
  const s = Math.ceil(sum);
  if (!Number.isFinite(s) || s <= 0) return;
  if (tableUsesFillWidth(table)) {
    table.style.minWidth = `${s}px`;
    table.style.width = '100%';
  } else {
    table.style.width = `${s}px`;
    table.style.minWidth = '';
  }
}

export function setTableWidthToColSum(table: HTMLTableElement) {
  const cols = Array.from(table.querySelectorAll('colgroup col')) as HTMLTableColElement[];
  let sum = 0;
  for (const c of cols) {
    const w = parseFloat(c.style.width || '');
    if (Number.isFinite(w) && w > 0) sum += w;
  }
  if (sum > 0) applyTableLayoutWidth(table, sum);
}

let __lastWindowFitAt = 0;
let __lastWindowFitWidth = 0;
const __windowFitRetryByTable = new Map<string, number>();
export function requestWindowFitForTable(table: HTMLTableElement) {
  if (!table) return;
  // Prefer explicit scroll wrapper; else legacy overflow-x-auto > min-w-max > table
  const overflowWrap =
    (table.closest('[data-table-scroll]') as HTMLElement | null) ??
    (table.closest('.min-w-max')?.parentElement as HTMLElement | null) ??
    (table.parentElement?.parentElement as HTMLElement | null);
  if (!overflowWrap) return;
  const tableWidth = Math.ceil(
    Math.max(
      table.scrollWidth || 0,
      table.getBoundingClientRect().width || 0
    )
  );
  const wrapWidth = Math.ceil(overflowWrap.clientWidth || 0);
  if (tableWidth <= 0 || wrapWidth <= 0) return;
  // Positive delta: table wider than viewport band → grow window. Negative → shrink to hug table.
  const delta = tableWidth - wrapWidth;
  if (Math.abs(delta) <= 3) {
    __windowFitRetryByTable.set(String(table.getAttribute('data-tableid') || 'table'), 0);
    return;
  }

  const targetContentWidth = Math.ceil(window.innerWidth + delta);
  const now = Date.now();
  if (now - __lastWindowFitAt < 120 && Math.abs(targetContentWidth - __lastWindowFitWidth) < 2) return;
  __lastWindowFitAt = now;
  __lastWindowFitWidth = targetContentWidth;

  try {
    (window.electron?.ipcRenderer as any)?.invoke?.('window-fit-content-width', targetContentWidth);
  } catch {}
  // Follow-up passes after layout settles (fonts/sidebar/colgroup timing).
  const tableId = String(table.getAttribute('data-tableid') || 'table');
  const prevRetries = __windowFitRetryByTable.get(tableId) ?? 0;
  if (prevRetries >= 3) {
    __windowFitRetryByTable.set(tableId, 0);
    return;
  }
  __windowFitRetryByTable.set(tableId, prevRetries + 1);
  window.setTimeout(() => {
    try {
      const lateTableWidth = Math.ceil(
        Math.max(
          table.scrollWidth || 0,
          table.getBoundingClientRect().width || 0
        )
      );
      const lateWrapWidth = Math.ceil(overflowWrap.clientWidth || 0);
      const lateDelta = lateTableWidth - lateWrapWidth;
      if (Math.abs(lateDelta) <= 3) {
        __windowFitRetryByTable.set(tableId, 0);
        return;
      }
      const lateTarget = Math.ceil(window.innerWidth + lateDelta);
      (window.electron?.ipcRenderer as any)?.invoke?.('window-fit-content-width', lateTarget);
      requestWindowFitForTable(table);
    } catch {}
  }, 120);
}

function measureHeaderMinWidth(th: HTMLTableCellElement): number {
  try {
    const cs = window.getComputedStyle(th);
    const text = (th.innerText || '').trim().replace(/\s+/g, ' ');
    const padL = parseFloat(cs.paddingLeft || '0') || 0;
    const padR = parseFloat(cs.paddingRight || '0') || 0;
    const iconPad = th.querySelector('svg') ? 12 : 0;

    // Keep some room for resize affordance and sort icon.
    const base = padL + padR + iconPad + 18;
    if (!text) return Math.ceil(base);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return Math.ceil(base);
    ctx.font = cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return Math.ceil(ctx.measureText(text).width + base);
  } catch {
    return 80;
  }
}

function startResize(e: any, dispatch: any, th: HTMLTableCellElement, fallbackColKey: string) {
  // Don't preventDefault here: it can suppress the browser's `dblclick`.
  // We'll "take over" only after the pointer actually moves a few pixels.
  e.stopPropagation();

  const handle = e.currentTarget as HTMLElement;
  const table = th?.closest('table') as HTMLTableElement | null;
  if (!th || !table) return;

  const tableId = table.getAttribute('data-tableid') || 'inventory';
  const thColKey = String(th.getAttribute('data-colkey') || fallbackColKey);

  const cols = Array.from(table.querySelectorAll('colgroup col')) as HTMLTableColElement[];
  const colKey = thColKey;
  const colEl =
    cols.find((c) => String(c.getAttribute('data-colkey') || '') === colKey) ??
    cols[(typeof th.cellIndex === 'number' ? th.cellIndex : 0)] ??
    null;

  // Manual double-click detection on the resize handle:
  // some Electron builds don't reliably deliver `dblclick` for absolutely-positioned spans.
  const now = Date.now();
  if (__lastFitColKey === colKey && now - __lastFitClickAt <= 350) {
    __lastFitClickAt = 0;
    __lastFitColKey = '';
    fitColumnToContent(th, dispatch, colKey);
    return;
  }
  __lastFitClickAt = now;
  __lastFitColKey = colKey;

  const startW = (colEl?.getBoundingClientRect().width || th.getBoundingClientRect().width) || 0;
  const headerMinW = Math.max(
    COLUMN_MIN_WIDTH,
    measureHeaderMinWidth(th)
  );

  // Important: to avoid browser "distributing" width into neighbor columns,
  // we let the table width change along with the grabbed column width.
  const prevLayout = table.style.tableLayout;

  const startX = e.clientX;
  const startY = e.clientY;
  let lastW = startW;
  let raf = 0;
  let activated = false;

  const apply = (w: number) => {
    const px = `${Math.max(60, Math.round(w))}px`;
    if (colEl) colEl.style.width = px;
    // Keep table width synchronized while dragging so neighbors don't get redistributed.
    setTableWidthToColSum(table);
  };

  const onMove = (ev: PointerEvent) => {
    if (!activated) {
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      // Don't start resize on a pure click/double-click.
      if (dx < 3 && dy < 3) return;
      activated = true;
      // Switch to fixed layout only when an actual drag starts.
      table.style.tableLayout = 'fixed';
      // Once we are truly dragging, prevent text selection/dragging.
      try {
        (e as any)?.preventDefault?.();
      } catch {}
    }
    lastW = Math.max(headerMinW, startW + (ev.clientX - startX));
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      apply(lastW);
    });
  };

  const finish = () => {
    document.body.style.cursor = '';
    document.removeEventListener('pointermove', onMove, true);
    document.removeEventListener('pointerup', finish, true);
    document.removeEventListener('pointercancel', finish, true);
    if (!activated) {
      // Pure click (no drag) must be a no-op.
      return;
    }
    try {
      window.sessionStorage.setItem(`cm-manual-widths-${tableId}`, '1');
    } catch {}
    // Lock out later "auto-fit all" passes after user-manual resize.
    table.setAttribute('data-manual-widths', '1');
    // If the table was controlled via CSS (inline style was ''), keep it fixed so widths apply.
    table.style.tableLayout = prevLayout || 'fixed';
    // Keep table width explicit via colgroup widths.
    setTableWidthToColSum(table);
    // Persist exactly what is currently rendered at pointer-up to avoid
    // release-time "jump" and preserve user's chosen width precisely.
    const colEls = Array.from(table.querySelectorAll('colgroup col')) as HTMLTableColElement[];
    const widths: Record<string, number> = {};
    for (const c of colEls) {
      const k = String(c.getAttribute('data-colkey') || '');
      if (!k) continue;
      const w = c.getBoundingClientRect().width;
      if (Number.isFinite(w) && w > 0) widths[k] = Math.round(w);
    }
    // Ensure the dragged key is present even in edge cases.
    widths[colKey] = Math.round(
      colEl?.getBoundingClientRect().width || Math.max(headerMinW, lastW)
    );
    dispatch(setColumnWidths({ tableId, widths }));
  };

  document.body.style.cursor = 'col-resize';
  // Avoid touch/pan gestures interfering with pointer moves.
  handle.style.touchAction = 'none';
  // Use capture listeners on document to reliably receive events even if something overlays the header.
  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('pointerup', finish, true);
  document.addEventListener('pointercancel', finish, true);
}

function maybeStartResizeFromTh(e: any, dispatch: any, th: HTMLTableCellElement, fallbackColKey: string) {
  // Start resize when pointer is near the right edge.
  const rect = th.getBoundingClientRect();
  const nearRightEdge = (e.clientX - rect.left) >= (rect.width - 10);
  if (!nearRightEdge) return;
  startResize(e, dispatch, th, fallbackColKey);
}

export function fitColumnToContent(th: HTMLTableCellElement, dispatch: any, fallbackColKey: string) {
  const table = th?.closest('table') as HTMLTableElement | null;
  if (!th || !table) return;
  const tableId = table.getAttribute('data-tableid') || 'inventory';
  try {
    window.sessionStorage.setItem(`cm-manual-widths-${tableId}`, '1');
  } catch {}
  // Lock out later "auto-fit all" passes after user-manual auto-fit.
  table.setAttribute('data-manual-widths', '1');
  const prevLayout = table.style.tableLayout;
  table.style.tableLayout = 'fixed';
  const colEls = Array.from(table.querySelectorAll('colgroup col')) as HTMLTableColElement[];
  const colKey = String(fallbackColKey || th.getAttribute('data-colkey') || '');
  const colEl =
    colEls.find((c) => String(c.getAttribute('data-colkey') || '') === colKey) ??
    colEls[(typeof th.cellIndex === 'number' ? th.cellIndex : 0)] ??
    null;

  if (colKey === 'SteamLink') {
    const width = 40;
    if (colEl) {
      colEl.style.width = `${width}px`;
      colEl.style.minWidth = `${width}px`;
      colEl.style.maxWidth = `${width}px`;
    }
    setTableWidthToColSum(table);
    const widths: Record<string, number> = {};
    for (const c of colEls) {
      const k = String(c.getAttribute('data-colkey') || '');
      if (!k) continue;
      const w = parseFloat(c.style.width || '') || c.getBoundingClientRect().width;
      if (Number.isFinite(w) && w > 0) widths[k] = Math.round(w);
    }
    widths[colKey] = width;
    dispatch(setColumnWidths({ tableId, widths }));
    table.style.tableLayout = prevLayout || 'fixed';
    return;
  }

  if (colKey === 'Inventory link' || colKey === 'Moveable' || colKey === 'Actions') {
    const headerMinW = Math.max(44, measureHeaderMinWidth(th));
    const width = Math.min(80, headerMinW);
    if (colEl) colEl.style.width = `${width}px`;
    setTableWidthToColSum(table);
    const widths: Record<string, number> = {};
    for (const c of colEls) {
      const k = String(c.getAttribute('data-colkey') || '');
      if (!k) continue;
      const w = parseFloat(c.style.width || '') || c.getBoundingClientRect().width;
      if (Number.isFinite(w) && w > 0) widths[k] = Math.round(w);
    }
    widths[colKey] = width;
    dispatch(setColumnWidths({ tableId, widths }));
    table.style.tableLayout = prevLayout || 'fixed';
    return;
  }

  const width = measureFitWidth(th);
  if (colEl) colEl.style.width = `${width}px`;
  setTableWidthToColSum(table);
  const widths: Record<string, number> = {};
  for (const c of colEls) {
    const k = String(c.getAttribute('data-colkey') || '');
    if (!k) continue;
    const w = parseFloat(c.style.width || '') || c.getBoundingClientRect().width;
    if (Number.isFinite(w) && w > 0) widths[k] = Math.round(w);
  }
  widths[colKey] = width;
  dispatch(setColumnWidths({ tableId, widths }));
  table.style.tableLayout = prevLayout || 'fixed';
  return;
}

function measureFitWidth(th: HTMLTableCellElement): number {
  const table = th?.closest('table') as HTMLTableElement | null;
  if (!th || !table) return Math.max(60, Math.round(th.getBoundingClientRect().width || 120));
  const tableW = Math.max(1, table.getBoundingClientRect().width);
  // Keep fit deterministic regardless of current table width so startup
  // auto-fit and later manual per-column auto-fit converge to the same values.
  const cap = 900;
  const headerMinW = Math.max(
    COLUMN_MIN_WIDTH,
    measureHeaderMinWidth(th)
  );

  const samples: number[] = [];
  const pushSample = (w: number) => {
    if (!Number.isFinite(w) || w <= 0) return;
    samples.push(Math.min(Math.ceil(w), cap));
  };

  const textWidth = (el: HTMLElement) => {
    const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
    if (!text) return 0;
    try {
      const cs = window.getComputedStyle(el);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      ctx.font = cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const padL = parseFloat(cs.paddingLeft || '0') || 0;
      const padR = parseFloat(cs.paddingRight || '0') || 0;
      return Math.ceil(ctx.measureText(text).width + padL + padR);
    } catch {
      return 0;
    }
  };

  const considerCell = (cell: HTMLElement) => {
    const style = window.getComputedStyle(cell);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const padL = parseFloat(style.paddingLeft || '0') || 0;
    const padR = parseFloat(style.paddingRight || '0') || 0;
    let best = 0;

    const flex =
      (cell.matches('.flex') ? cell : null) ||
      (cell.querySelector('.flex') as HTMLElement | null);
    if (flex) {
      const flexStyle = window.getComputedStyle(flex);
      if (flexStyle.display === 'flex') {
        const children = Array.from(flex.children) as HTMLElement[];
        let sum = 0;
        for (const c of children) {
          const r = c.getBoundingClientRect();
          if (r.width >= tableW * 0.95) continue;
          sum += r.width;
        }
        const gap = parseFloat(flexStyle.columnGap || flexStyle.gap || '0') || 0;
        if (children.length > 1) sum += gap * (children.length - 1);
        best = Math.max(best, sum);
      }
    }

    const imgs = Array.from(cell.querySelectorAll('img')) as HTMLImageElement[];
    if (imgs.length) {
      let sum = 0;
      for (const img of imgs) {
        const r = img.getBoundingClientRect();
        if (r.width >= tableW * 0.95) continue;
        sum += r.width;
      }
      best = Math.max(best, sum);
    }

    const inputs = Array.from(cell.querySelectorAll('input')) as HTMLInputElement[];
    for (const inp of inputs) {
      const r = inp.getBoundingClientRect();
      if (r.width > 0 && r.width < tableW * 0.95) best = Math.max(best, r.width);
    }

    const textCandidates = Array.from(
      cell.querySelectorAll<HTMLElement>('span, a, p, button')
    );
    for (const t of textCandidates) best = Math.max(best, textWidth(t));

    pushSample(best + padL + padR);
  };

  // include header min width
  pushSample(headerMinW);

  const bodyRows = Array.from(table.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
  let considered = 0;
  for (const tr of bodyRows) {
    if (considered >= 60) break;
    const trStyle = window.getComputedStyle(tr);
    if (trStyle.display === 'none' || trStyle.visibility === 'hidden') continue;
    const cell = tr.cells[th.cellIndex] as unknown as HTMLElement | undefined;
    if (!cell) continue;
    considerCell(cell);
    considered++;
  }

  const fallback = th.getBoundingClientRect().width || 120;
  let chosen = fallback;
  if (samples.length) {
    const sorted = samples.slice().sort((a, b) => a - b);
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * 0.95)));
    chosen = sorted[idx];
  }
  return Math.max(headerMinW, Math.round(chosen));
}

export function autoFitAllColumns(table: HTMLTableElement, dispatch: any) {
  if (table.getAttribute('data-manual-widths') === '1') return;
  const tableId = table.getAttribute('data-tableid') || 'inventory';
  const ths = Array.from(table.querySelectorAll('thead th[data-colkey]')) as HTMLTableCellElement[];
  const cols = Array.from(table.querySelectorAll('colgroup col')) as HTMLTableColElement[];
  const widths: Record<string, number> = {};
  for (const th of ths) {
    const style = window.getComputedStyle(th);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const colKey = String(th.getAttribute('data-colkey') || '');
    const colEl =
      cols.find((c) => String(c.getAttribute('data-colkey') || '') === colKey) ??
      cols[(typeof th.cellIndex === 'number' ? th.cellIndex : 0)];
    if (!colKey) continue;

    let width = 0;
    if (colKey === 'SteamLink') {
      width = 40;
    } else if (
      colKey === 'Inventory link' ||
      colKey === 'Moveable' ||
      colKey === 'Actions'
    ) {
      const headerMinW = Math.max(44, measureHeaderMinWidth(th));
      width = Math.min(80, headerMinW);
    } else {
      width = measureFitWidth(th);
    }
    widths[colKey] = width;
    if (colEl) colEl.style.width = `${width}px`;
  }
  setTableWidthToColSum(table);
  dispatch(setColumnWidths({ tableId, widths }));
}

export function applyPersistedWidthsToTable(
  table: HTMLTableElement,
  widths: Record<string, number> | undefined
) {
  if (!table || !widths) return;
  const entries = Object.entries(widths);
  if (!entries.length) return;
  const cols = Array.from(table.querySelectorAll('colgroup col')) as HTMLTableColElement[];
  for (const c of cols) {
    const key = String(c.getAttribute('data-colkey') || '');
    if (!key) continue;
    const w = widths[key];
    if (Number.isFinite(w) && (w as number) > 0) {
      c.style.width = `${Math.round(w as number)}px`;
    }
  }
  table.style.tableLayout = 'fixed';
  setTableWidthToColSum(table);
}

function headerVisibilityClass(conditionOrSort?: string) {
  // Keep header visibility aligned with the corresponding <td> components.
  // If these diverge, columns will appear “shifted/misaligned”.
  switch (conditionOrSort) {
    // Sort keys (used by RowHeader in some views)
    case 'Collection':
      return 'hidden xl:table-cell';
    case 'Stickers':
      // Inventory body cells for stickers use `lg:table-cell` (see stickerPatchesRow).
      return 'hidden lg:table-cell';
    case 'wearValue':
      return 'table-cell';
    case 'StorageName':
      return 'hidden md:table-cell';
    case 'tradehold':
      return 'hidden md:table-cell';

    case 'Collections':
    case 'Stickers/patches':
    case 'Float':
    case 'Rarity':
      return conditionOrSort === 'Stickers/patches' ? 'hidden lg:table-cell' : 'hidden xl:table-cell';
    case 'Storage':
    case 'Tradehold':
    case 'Moveable':
    case 'Inventory link':
      return 'hidden md:table-cell';
    default:
      return 'table-cell';
  }
}

function headerAlignClass(colKey?: string) {
  switch (colKey) {
    case 'Product name':
    case 'Collection':
      return 'text-left';
    case 'StorageName':
    case 'tradehold':
      return 'text-center';
    case 'Price':
    case 'Stickers':
    case 'wearValue':
    case 'Rarity':
    case 'QTY':
    case 'Move':
    case 'Actions':
    case 'Moveable':
    case 'Inventory link':
    case 'SteamLink':
      return 'text-center';
    default:
      return 'text-left';
  }
}

function isCenterAlign(alignClass: string) {
  return alignClass.includes('text-center');
}

function thBase(extra?: string) {
  return [
    extra ?? '',
    'relative group', // needed for resize handle positioning + hover affordance
    'select-none', // avoid text selection while resizing
    'px-3 py-2 border-b border-gray-200 bg-gray-50',
    'dark:border-opacity-50 dark:bg-dark-level-two',
    'text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider',
  ]
    .filter(Boolean)
    .join(' ');
}

function sortButtonBase(alignClass: string) {
  const centered = isCenterAlign(alignClass);
  return [
    'w-full flex items-center gap-2 relative rounded-sm',
    centered ? 'justify-center text-center pr-4' : 'justify-between text-left',
    'text-xs font-medium uppercase tracking-wider',
    'text-gray-500 dark:text-gray-400',
    'hover:text-gray-900 dark:hover:text-gray-200',
    focusRingBtn,
  ].join(' ');
}

function sortIconClass(alignClass: string) {
  const centered = isCenterAlign(alignClass);
  return centered
    ? 'h-3 w-3 opacity-80 absolute right-0 top-1/2 -translate-y-1/2'
    : 'h-3 w-3 shrink-0 opacity-80';
}

// Row header with sort option
export function RowHeader({
  headerName,
  sortName,
  sortTarget = 'inventory' as SortTarget,
  visibilityClass,
  thClassName,
}: {
  headerName: string;
  sortName: string;
  sortTarget?: SortTarget;
  /** Overrides default breakpoint visibility from `headerVisibilityClass(sortName)`. */
  visibilityClass?: string;
  /** Extra classes on the `<th>` (e.g. borders). */
  thClassName?: string;
}) {
    const dispatch = useDispatch();
    const sortInputs = useSelector(selectHeaderStorageSortInputs);
    const { sortValue, sortBack } = useTableSortState(sortTarget);
    const sortActive = sortValue === sortName;
    const ascending = !sortBack;

    const handleSort = async () => {
      dispatch(sortActionFor(sortTarget)({ sortValue: sortName }));
      const storageResult = await sortDataFunction(
        sortName,
        sortInputs.storageInventory,
        sortInputs.prices,
        sortInputs.sourceTitle
      );
      const storageResultFiltered = await sortDataFunction(
        sortName,
        sortInputs.storageFiltered,
        sortInputs.prices,
        sortInputs.sourceTitle
      );
      dispatch(inventorySetSortStorage(storageResult, storageResultFiltered));
    };
    const align = headerAlignClass(sortName);
    const vis = [visibilityClass ?? headerVisibilityClass(sortName), align, thClassName].filter(Boolean).join(' ');
    return (
        <>
            <th
              className={thBase(vis)}
              data-colkey={sortName}
              onPointerDown={(e) => {
                const th = e.currentTarget as any as HTMLTableCellElement;
                maybeStartResizeFromTh(e, dispatch, th, sortName);
              }}
            >
                <button
                    type="button"
                    onClick={handleSort}
                    className={sortButtonBase(align)}
                    aria-sort={sortActive ? (ascending ? 'ascending' : 'descending') : 'none'}
                >
                    <span className="truncate">{headerName}</span>
                    <SortIndicator active={sortActive} ascending={ascending} className={sortIconClass(align)} />
                </button>
                <span
                  className={[
                    "absolute right-0 top-0 h-full w-0.5 cursor-col-resize",
                    "z-20 pointer-events-auto",
                    "opacity-70 group-hover:opacity-100",
                    "bg-transparent",
                  ].join(" ")}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement | null;
                    if (!th) return;
                    startResize(e, dispatch, th, sortName);
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement | null;
                    if (!th) return;
                    fitColumnToContent(th, dispatch, sortName);
                  }}
                >
                  <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-400/40 group-hover:bg-yellow-400/60" />
                </span>
            </th>
        </>
    );
}
// Row header with sort option
export function RowHeaderHiddenXL({ headerName, sortName }) {
    const dispatch = useDispatch();
    const sortInputs = useSelector(selectHeaderStorageSortInputs);
    const { sortValue, sortBack } = useTableSortState('inventory');
    const sortActive = sortValue === sortName;
    const ascending = !sortBack;

    const handleSort = async () => {
      dispatch(sortActionFor('inventory')({ sortValue: sortName }));
      const storageResult = await sortDataFunction(
        sortName,
        sortInputs.storageInventory,
        sortInputs.prices,
        sortInputs.sourceTitle
      );
      const storageResultFiltered = await sortDataFunction(
        sortName,
        sortInputs.storageFiltered,
        sortInputs.prices,
        sortInputs.sourceTitle
      );
      dispatch(inventorySetSortStorage(storageResult, storageResultFiltered));
    };
    const align = headerAlignClass(sortName);
    return (
        <>
            <th
              className={thBase(`hidden 2xl:table-cell ${align}`)}
              data-colkey={sortName}
              onPointerDown={(e) => {
                const th = e.currentTarget as any as HTMLTableCellElement;
                maybeStartResizeFromTh(e, dispatch, th, sortName);
              }}
            >
                <button
                    type="button"
                    onClick={handleSort}
                    className={sortButtonBase(align)}
                    aria-sort={sortActive ? (ascending ? 'ascending' : 'descending') : 'none'}
                >
                    <span className="truncate">{headerName}</span>
                    <SortIndicator active={sortActive} ascending={ascending} className={sortIconClass(align)} />
                </button>
                <span
                  className={[
                    "absolute right-0 top-0 h-full w-0.5 cursor-col-resize",
                    "z-20 pointer-events-auto",
                    "opacity-70 group-hover:opacity-100",
                    "bg-transparent",
                  ].join(" ")}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement | null;
                    if (!th) return;
                    startResize(e, dispatch, th, sortName);
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement | null;
                    if (!th) return;
                    fitColumnToContent(th, dispatch, sortName);
                  }}
                >
                  <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-400/40 group-hover:bg-yellow-400/60" />
                </span>
            </th>
        </>
    );
}
// Row header sort and condition
export function RowHeaderCondition({
  headerName,
  sortName,
  condition,
  sortTarget = 'inventory' as SortTarget,
  visibilityClass,
  thClassName,
  forceVisible,
}: {
  headerName: string;
  sortName: string;
  condition: string;
  sortTarget?: SortTarget;
  visibilityClass?: string;
  thClassName?: string;
  /** When true, show the column even if it is disabled in settings (e.g. trade-up table). */
  forceVisible?: boolean;
}) {
    const dispatch = useDispatch();
    const settingsColumns = useSelector((s: RootState) => s.settings.columns);
    const sortInputs = useSelector(selectHeaderStorageSortInputs);
    const { sortValue, sortBack } = useTableSortState(sortTarget);
    const sortActive = sortValue === sortName;
    const ascending = !sortBack;

    const handleSort = async () => {
      dispatch(sortActionFor(sortTarget)({ sortValue: sortName }));
      const storageResult = await sortDataFunction(
        sortName,
        sortInputs.storageInventory,
        sortInputs.prices,
        sortInputs.sourceTitle
      );
      const storageResultFiltered = await sortDataFunction(
        sortName,
        sortInputs.storageFiltered,
        sortInputs.prices,
        sortInputs.sourceTitle
      );
      dispatch(inventorySetSortStorage(storageResult, storageResultFiltered));
    };
    const align = headerAlignClass(sortName);
    const vis = [visibilityClass ?? headerVisibilityClass(condition), align, thClassName].filter(Boolean).join(' ');
    return (
        <>
            {(forceVisible || settingsColumns.includes(condition)) ?
                <th
                  className={thBase(vis)}
                  data-colkey={sortName}
                  onPointerDown={(e) => {
                    const th = e.currentTarget as any as HTMLTableCellElement;
                    maybeStartResizeFromTh(e, dispatch, th, sortName);
                  }}
                >
                    <button
                        type="button"
                        onClick={handleSort}
                        className={sortButtonBase(align)}
                        aria-sort={sortActive ? (ascending ? 'ascending' : 'descending') : 'none'}
                    >
                        <span className="truncate">{headerName}</span>
                        <SortIndicator active={sortActive} ascending={ascending} className={sortIconClass(align)} />
                    </button>
                    <span
                      className={[
                        "absolute right-0 top-0 h-full w-0.5 cursor-col-resize",
                        "z-20 pointer-events-auto",
                        "opacity-70 group-hover:opacity-100",
                        "bg-transparent",
                      ].join(" ")}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement | null;
                        if (!th) return;
                        startResize(e, dispatch, th, sortName);
                      }}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement | null;
                        if (!th) return;
                        fitColumnToContent(th, dispatch, sortName);
                      }}
                    >
                      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-400/40 group-hover:bg-yellow-400/60" />
                    </span>
                </th> : ''}
        </>
    );
}

// Row header sort and condition
export function RowHeaderConditionNoSort({ headerName, condition }) {
    const settingsColumns = useSelector((s: RootState) => s.settings.columns);
    return (
        <>
            {settingsColumns.includes(condition) ?
                <RowHeaderPlainKey colKey={condition} label={headerName} />
                : ''}
        </>
    );
}

// Row header plain
export function RowHeaderPlain({ headerName }: { headerName: string }) {
    const dispatch = useDispatch();
    const align = headerAlignClass(headerName);
    const centered = isCenterAlign(align);
    return (
        <>
            <th
              className={thBase(`${headerVisibilityClass(headerName)} ${align}`)}
              data-colkey={headerName}
              onPointerDown={(e) => {
                const th = e.currentTarget as any as HTMLTableCellElement;
                maybeStartResizeFromTh(e, dispatch, th, headerName);
              }}
            >
                <button
                  className={[
                    "pointer-events-none w-full tracking-wider uppercase text-xs font-medium text-gray-500 dark:text-gray-400",
                    centered ? "text-center" : "text-left",
                  ].join(" ")}
                >
                    {headerName}
                </button>
                <span
                  className={[
                    "absolute right-0 top-0 h-full w-0.5 cursor-col-resize",
                    "z-20 pointer-events-auto",
                    "opacity-70 group-hover:opacity-100",
                    "bg-transparent",
                  ].join(" ")}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement | null;
                    if (!th) return;
                    startResize(e, dispatch, th, headerName);
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement | null;
                    if (!th) return;
                    fitColumnToContent(th, dispatch, headerName);
                  }}
                >
                  <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-400/40 group-hover:bg-yellow-400/60" />
                </span>
            </th>
        </>
    );
}

export function RowHeaderPlainKey({
  colKey,
  label,
  className,
  visibilityClass,
}: {
  colKey: string;
  label?: string;
  className?: string;
  visibilityClass?: string;
}) {
  const dispatch = useDispatch();
  const shown = label ?? colKey;
  const align = headerAlignClass(colKey);
  const centered = isCenterAlign(align);
  return (
    <th
      className={thBase([(visibilityClass ?? headerVisibilityClass(colKey)), headerAlignClass(colKey), className].filter(Boolean).join(' '))}
      data-colkey={colKey}
      onPointerDown={(e) => {
        const th = e.currentTarget as any as HTMLTableCellElement;
        maybeStartResizeFromTh(e, dispatch, th, colKey);
      }}
    >
      <button
        className={[
          "pointer-events-none w-full tracking-wider uppercase text-xs font-medium text-gray-500 dark:text-gray-400",
          centered ? "text-center" : "text-left",
        ].join(" ")}
      >
        {shown}
      </button>
      <span
        className={[
          "absolute right-0 top-0 h-full w-0.5 cursor-col-resize",
          "z-20 pointer-events-auto",
          "opacity-70 group-hover:opacity-100",
          "bg-transparent",
        ].join(" ")}
        onPointerDown={(e) => {
          e.stopPropagation();
          const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement | null;
          if (!th) return;
          startResize(e, dispatch, th, colKey);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement | null;
          if (!th) return;
          fitColumnToContent(th, dispatch, colKey);
        }}
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-400/40 group-hover:bg-yellow-400/60" />
      </span>
    </th>
  );
}

export function RowHeaderCustomKey({
  colKey,
  className,
  children,
}: {
  colKey: string;
  className?: string;
  children: any;
}) {
  const dispatch = useDispatch();
  const align = headerAlignClass(colKey);
  return (
    <th
      className={thBase([headerVisibilityClass(colKey), align, className].filter(Boolean).join(' '))}
      data-colkey={colKey}
      onPointerDown={(e) => {
        const th = e.currentTarget as any as HTMLTableCellElement;
        maybeStartResizeFromTh(e, dispatch, th, colKey);
      }}
    >
      {children}
      <span
        className={[
          "absolute right-0 top-0 h-full w-0.5 cursor-col-resize",
          "z-20 pointer-events-auto",
          "opacity-70 group-hover:opacity-100",
          "bg-transparent",
        ].join(" ")}
        onPointerDown={(e) => {
          e.stopPropagation();
          const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement | null;
          if (!th) return;
          startResize(e, dispatch, th, colKey);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement | null;
          if (!th) return;
          fitColumnToContent(th, dispatch, colKey);
        }}
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-400/40 group-hover:bg-yellow-400/60" />
      </span>
    </th>
  );
}
