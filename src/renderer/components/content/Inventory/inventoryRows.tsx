
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { searchFilter } from 'renderer/functionsClasses/filters/search.ts';
import { RequestPrices } from 'renderer/functionsClasses/prices.ts';
import { btnDefault } from '../shared/buttonStyles.ts';
import { classNames, sortDataFunctionOffThread, sortDataFunctionSync } from '../shared/filters/inventoryFunctions.ts';
import {
  overviewTableScrollWrap,
  overviewTableClassName,
  overviewTheadClassName,
  overviewTheadTrClassName,
  overviewThCellOverride,
  overviewTbodyClassName,
  overviewTrClassName,
} from '../shared/tableOverviewStyles.ts';
import RenameModal from '../shared/modals-notifcations/modalRename.tsx';
import { RowCollections } from './inventoryRows/collectionsRow.tsx';
import { RowFloat } from './inventoryRows/floatRow.tsx';
import {
  RowHeader,
  RowHeaderCondition,
  RowHeaderConditionNoSort,
  applyPersistedWidthsToTable,
  requestWindowFitForTable,
} from './inventoryRows/headerRows.tsx';
import { RowLinkInventory } from './inventoryRows/inventoryLinkRow.tsx';
import { RowMoveable } from './inventoryRows/moveableRow.tsx';
import { RowPrice } from './inventoryRows/priceRow.tsx';
import { RowQTY } from './inventoryRows/QTYRow.tsx';
import { RowRarity } from './inventoryRows/rarityRow.tsx';
import { RowProduct } from './inventoryRows/rowName.tsx';
import { RowStickersPatches } from './inventoryRows/stickerPatchesRow.tsx';
import { RowTradehold } from './inventoryRows/tradeholdRow.tsx';
import { autoFitAllColumns } from './inventoryRows/headerRows.tsx';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectInventoryFilters } from 'renderer/store/slices/inventoryFilters.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { selectAuth } from 'renderer/store/slices/auth.ts';
import { isAutoPricingEnabled } from 'renderer/pricing/autoPricing.ts';

type InvTableRowProps = {
  projectRow: any;
  settingsData: any;
  pricesResult: any;
  usrDetails: any;
};

const InventoryTableRow = memo(function InventoryTableRow({
  projectRow,
  settingsData,
  pricesResult,
  usrDetails,
}: InvTableRowProps) {
  return (
    <tr className={overviewTrClassName}>
      <RowProduct itemRow={projectRow} />
      <RowCollections itemRow={projectRow} settingsData={settingsData} />
      <RowPrice itemRow={projectRow} settingsData={settingsData} pricesReducer={pricesResult} />
      <RowStickersPatches itemRow={projectRow} settingsData={settingsData} />
      <RowFloat itemRow={projectRow} settingsData={settingsData} />
      <RowRarity itemRow={projectRow} settingsData={settingsData} />
      <RowQTY itemRow={projectRow} />
      <RowMoveable itemRow={projectRow} settingsData={settingsData} />
      <RowLinkInventory itemRow={projectRow} settingsData={settingsData} userDetails={usrDetails} />
      <RowTradehold itemRow={projectRow} settingsData={settingsData} />
    </tr>
  );
});

function content() {
  const [getInventory, setInventory] = useState([] as any);
  const [visibleCount, setVisibleCount] = useState(250);
  const inventory = useSelector(selectInventory);
  const inventoryFilters = useSelector(selectInventoryFilters);
  const pricesResult = useSelector(selectPricing);
  const settingsData = useSelector(selectSettings);
  const usrDetails = useSelector(selectAuth)
  const tableId = 'inventory';
  const colWidths = (settingsData as any)?.columnWidths?.[tableId] ?? {};
  const didAutoFitRef = useRef(false);

  const colStyle = (key: string) => {
    const width = colWidths?.[key];
    return width != null ? ({ width: `${width}px` } as any) : ({} as any);
  };

  const dispatch = useDispatch();

  // Sort function
  const inventoryToUse = useMemo(() => {
    if (
      inventoryFilters.inventoryFiltered.length === 0 &&
      inventoryFilters.inventoryFilter.length === 0
    ) {
      return inventory.combinedInventory;
    }
    return inventoryFilters.inventoryFiltered;
  }, [
    inventory.combinedInventory,
    inventoryFilters.inventoryFiltered,
    inventoryFilters.inventoryFilter.length,
  ]);

  // Filter first, then sort. Sorting the full list on every click is expensive.
  const filteredBase = useMemo(() => {
    return searchFilter(inventoryToUse as any, inventoryFilters as any, inventoryFilters as any) as any[];
    // Depend only on inputs that actually affect filtering (not sortValue/sortBack).
  }, [
    inventoryToUse,
    inventoryFilters.searchInput,
    inventoryFilters.inventoryFilter,
    inventoryFilters.categoryFilter,
    inventoryFilters.rarityFilter,
    inventoryFilters.storageFilter,
  ]);

  // (intentionally no extra refs here)

  const sortedBase = useMemo(() => {
    // For small lists, do it synchronously so it feels instant.
    if (filteredBase.length <= 2500) {
      return sortDataFunctionSync(
        inventoryFilters.sortValue,
        filteredBase,
        pricesResult.prices,
        settingsData?.source?.title
      );
    }
    // For huge lists, keep previous rows until async sort completes.
    return getInventory as any[];
  }, [
    filteredBase,
    inventoryFilters.sortValue,
    inventoryFilters.sortValue === 'Price' ? pricesResult.prices : null,
    settingsData?.source?.title,
  ]);

  // Async fallback for large lists.
  useEffect(() => {
    if (filteredBase.length <= 2500) return;
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        const result = await sortDataFunctionOffThread(
          inventoryFilters.sortValue,
          filteredBase,
          pricesResult.prices,
          settingsData?.source?.title
        );
        if (!cancelled) setInventory(result);
      } catch {}
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [
    filteredBase,
    inventoryFilters.sortValue,
    inventoryFilters.sortValue === 'Price' ? pricesResult.prices : null,
    settingsData?.source?.title,
  ]);

  const processedInventory = useMemo(() => {
    const base = [...(filteredBase.length <= 2500 ? (sortedBase as any[]) : getInventory)];
    if (inventoryFilters.sortBack === true) base.reverse();
    return base;
  }, [filteredBase.length, getInventory, sortedBase, inventoryFilters.sortBack]);

  const finalToUse = processedInventory;

  useEffect(() => {
    // Reset window when the underlying list/filter changes.
    setVisibleCount(250);
  }, [
    inventoryToUse,
    inventoryFilters.sortValue,
    inventoryFilters.sortBack,
    inventoryFilters.inventoryFilter.length,
    inventoryFilters.searchInput,
  ]);

  const visibleRows = useMemo(() => finalToUse.slice(0, visibleCount), [finalToUse, visibleCount]);

  useEffect(() => {
    window.electron.ipcRenderer.debugLog('inventoryRows:state', {
      rawInventoryCount: inventory.inventory?.length ?? -1,
      combinedInventoryCount: inventory.combinedInventory?.length ?? -1,
      filteredInventoryCount: inventoryFilters.inventoryFiltered?.length ?? -1,
      inventoryFilterCount: inventoryFilters.inventoryFilter?.length ?? -1,
      finalCount: finalToUse?.length ?? -1,
      visibleCount: visibleRows?.length ?? -1,
      isLoggedIn: usrDetails?.isLoggedIn ?? false,
      hasGc: usrDetails?.CSGOConnection ?? false,
    });
  }, [
    inventory.inventory,
    inventory.combinedInventory,
    inventoryFilters.inventoryFiltered,
    inventoryFilters.inventoryFilter,
    finalToUse,
    visibleRows,
    usrDetails,
  ]);

  useLayoutEffect(() => {
    if (didAutoFitRef.current) return;
    if (colWidths && Object.keys(colWidths).length > 0) return;
    if (!visibleRows || visibleRows.length === 0) return;
    const table = document.querySelector(`table[data-tableid="${tableId}"]`) as HTMLTableElement | null;
    if (!table) return;
    didAutoFitRef.current = true;
    // Fit before paint so first visit is already correct.
    autoFitAllColumns(table, dispatch);
    requestAnimationFrame(() => {
      autoFitAllColumns(table, dispatch);
      requestWindowFitForTable(table);
    });
  }, [visibleRows.length, dispatch, tableId, colWidths]);

  useLayoutEffect(() => {
    if (!colWidths || Object.keys(colWidths).length === 0) return;
    const table = document.querySelector(`table[data-tableid="${tableId}"]`) as HTMLTableElement | null;
    if (!table) return;
    applyPersistedWidthsToTable(table, colWidths as Record<string, number>);
    requestWindowFitForTable(table);
  }, [tableId, colWidths]);

  useLayoutEffect(() => {
    const table = document.querySelector(`table[data-tableid="${tableId}"]`) as HTMLTableElement | null;
    if (!table || !visibleRows.length) return;
    requestAnimationFrame(() => requestWindowFitForTable(table));
  }, [tableId, visibleRows.length]);

  useEffect(() => {
    const table = document.querySelector(`table[data-tableid="${tableId}"]`) as HTMLTableElement | null;
    if (!table || !visibleRows.length) return;
    const t1 = window.setTimeout(() => requestWindowFitForTable(table), 0);
    const t2 = window.setTimeout(() => requestWindowFitForTable(table), 180);
    const t3 = window.setTimeout(() => requestWindowFitForTable(table), 420);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [tableId, visibleRows.length, colWidths]);

  // Request pricing only for visible rows (and only once per item_id).
  const requestedPriceIdsRef = useRef<Set<string>>(new Set());
  const pricesRef = useRef(pricesResult);
  pricesRef.current = pricesResult;
  useEffect(() => {
    if (!isAutoPricingEnabled()) return;
    const source = settingsData?.source?.title;
    if (!source) return;
    if (visibleRows.length === 0) return;

    const toRequest: any[] = [];
    for (const row of visibleRows) {
      const id = row?.item_id;
      if (!id) continue;
      if (requestedPriceIdsRef.current.has(id)) continue;
      requestedPriceIdsRef.current.add(id);
      toRequest.push(row);
    }

    if (toRequest.length === 0) return;
    const pricingRequest = new RequestPrices(dispatch, settingsData, pricesRef.current);
    pricingRequest.handleRequestArray(toRequest, { scope: 'inv' });
  }, [visibleRows, dispatch, settingsData]);

  useEffect(() => {
    // `combinedInventory` is a new array reference on most GC events (itemChanged, etc.).
    // Only reset when cardinality or the filtered list changes — otherwise visible rows
    // re-queue pricing for the same item_ids forever.
    requestedPriceIdsRef.current = new Set();
  }, [inventoryFilters.inventoryFiltered, inventory.combinedInventory?.length]);

  return (
    <>
      <RenameModal />

      {/* Projects list (only on smallest breakpoint) */}
      <div className="mt-10 sm:hidden">
        <div className="px-4 sm:px-6">
          <h2 className="text-gray-500 text-xs font-medium uppercase tracking-wide">
            Product details
          </h2>
        </div>
        <ul
          role="list"
          className="mt-3 border-t border-gray-200 divide-y divide-gray-100 dark:divide-gray-500"
        >
          {visibleRows.map((project) => (
            <li key={project.item_id}>
              <a
                href="#"
                className="group flex items-center justify-between px-4 py-4 hover:bg-gray-50 sm:px-6"
              >
                <span className="flex items-center truncate space-x-3">
                  <span
                    className={classNames(
                      project.bgColorClass,
                      'w-2.5 h-2.5 shrink-0 rounded-full'
                    )}
                    aria-hidden="true"
                  />
                  <span className="font-medium truncate text-sm leading-6">
                    {project.item_name}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div data-table-scroll className={overviewTableScrollWrap}>
        <table
          data-tableid={tableId}
          data-table-width="fill"
          className={classNames(overviewTableClassName, overviewThCellOverride)}
        >
        <colgroup>
          <col data-colkey="Product name" style={colStyle('Product name')} />
          {settingsData.columns.includes('Collections') ? (
            <col data-colkey="Collection" style={colStyle('Collection')} />
          ) : null}
          {settingsData.columns.includes('Price') ? (
            <col data-colkey="Price" style={colStyle('Price')} />
          ) : null}
          {settingsData.columns.includes('Stickers/patches') ? (
            <col data-colkey="Stickers" style={colStyle('Stickers')} />
          ) : null}
          {settingsData.columns.includes('Float') ? (
            <col data-colkey="wearValue" style={colStyle('wearValue')} />
          ) : null}
          {settingsData.columns.includes('Rarity') ? (
            <col data-colkey="Rarity" style={colStyle('Rarity')} />
          ) : null}
          <col data-colkey="QTY" style={colStyle('QTY')} />
          {settingsData.columns.includes('Moveable') ? (
            <col data-colkey="Moveable" style={colStyle('Moveable')} />
          ) : null}
          {settingsData.columns.includes('Inventory link') ? (
            <col data-colkey="Inventory link" style={colStyle('Inventory link')} />
          ) : null}
          {settingsData.columns.includes('Tradehold') ? (
            <col data-colkey="tradehold" style={colStyle('tradehold')} />
          ) : null}
        </colgroup>
        <thead className={overviewTheadClassName}>
          <tr className={classNames(overviewTheadTrClassName, 'border-gray-200')}>

            <RowHeader headerName='Product' sortName='Product name' />
            <RowHeaderCondition headerName='Collection' sortName='Collection' condition='Collections' />
            <RowHeaderCondition headerName='Price' sortName='Price' condition='Price' />
            <RowHeaderCondition headerName='Stickers/Patches' sortName='Stickers' condition='Stickers/patches' />
            <RowHeaderCondition headerName='Float' sortName='wearValue' condition='Float' />
            <RowHeaderCondition headerName='Rarity' sortName='Rarity' condition='Rarity' />
            <RowHeader headerName='QTY' sortName='QTY' />
            <RowHeaderConditionNoSort headerName='Moveable' condition='Moveable' />
            <RowHeaderConditionNoSort headerName='Link' condition='Inventory link' />
            <RowHeaderCondition headerName='Tradehold' sortName='tradehold' condition='Tradehold' />



          </tr>
        </thead>
        <tbody className={overviewTbodyClassName}>
          {visibleRows.map((projectRow) => (
            <InventoryTableRow
              key={projectRow.item_id}
              projectRow={projectRow}
              settingsData={settingsData}
              pricesResult={pricesResult}
              usrDetails={usrDetails}
            />
          ))}
        </tbody>
        </table>
      </div>
      {finalToUse.length > visibleCount ? (
        <div className="py-4 flex justify-center">
          <button
            type="button"
            className={classNames(btnDefault, 'px-4 py-2')}
            onClick={() => setVisibleCount((c) => Math.min(finalToUse.length, c + 250))}
          >
            Load more ({visibleCount}/{finalToUse.length})
          </button>
        </div>
      ) : null}
    </>
  );
}

export default function InventoryRowsComponent() {
  return content();
}
