import StorageFilter from './toFilters.tsx';
import StorageRow from './toStorageRow.tsx';
import StorageSelectorContent from './toSelector.tsx';
import { useDispatch, useSelector } from 'react-redux';
import {
  classNames,
  sortDataFunctionOffThread,
  sortDataFunctionSync,
} from '../../shared/filters/inventoryFunctions.ts';
import {
  overviewTableScrollWrap,
  overviewTableClassName,
  overviewTheadClassName,
  overviewTheadTrClassName,
  overviewThCellOverride,
  overviewTbodyClassName,
  overviewTrClassName,
} from '../../shared/tableOverviewStyles.ts';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NoSymbolIcon, FireIcon } from '@heroicons/react/24/solid';
import { searchFilter } from 'renderer/functionsClasses/filters/search.ts';
import {
  RowHeader,
  RowHeaderCondition,
  RowHeaderPlain,
  RowHeaderCustomKey,
  applyPersistedWidthsToTable,
  requestWindowFitForTable,
} from '../../Inventory/inventoryRows/headerRows.tsx';
import { autoFitAllColumns } from '../../Inventory/inventoryRows/headerRows.tsx';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectMoveTo } from 'renderer/store/slices/moveTo.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { selectInventoryFilters } from 'renderer/store/slices/inventoryFilters.ts';

export default function StorageUnits() {
  const inventory = useSelector(selectInventory);
  const toStorage = useSelector(selectMoveTo);
  const pricesResult = useSelector(selectPricing);
  const settingsData = useSelector(selectSettings);
  const inventoryFilters = useSelector(selectInventoryFilters);
  const inventoryFiltered = inventoryFilters.inventoryFiltered;

  const tableId = 'transferTo';
  const colWidths = (settingsData as any)?.columnWidths?.[tableId] ?? {};
  const didAutoFitRef = useRef(false);
  const colStyle = (key: string) => {
    const width = colWidths?.[key];
    return width != null ? ({ width: `${width}px` } as any) : ({} as any);
  };

  const inventoryToUse = useMemo(() => {
    const combined = inventory.combinedInventory ?? [];
    if (inventoryFiltered.length === 0 && inventoryFilters.inventoryFilter.length === 0) {
      return combined;
    }
    return inventoryFiltered;
  }, [inventory.combinedInventory, inventoryFiltered, inventoryFilters.inventoryFilter.length]);

  // Filter first, then sort (much cheaper during interaction).
  const filteredBase = useMemo(() => {
    const filtered = searchFilter(inventoryToUse as any, inventoryFilters as any, toStorage as any) as any[];
    return filtered.filter((item) => item.item_moveable == true);
  }, [inventoryToUse, inventoryFilters, toStorage]);

  const [sortedRows, setSortedRows] = useState<any[]>(filteredBase as any[]);
  function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }
  async function ultimateFire() {
    const runIndex = [] as any;
    const relevantRows = document.getElementsByClassName(`findRow`);
    Array.from(relevantRows).forEach(function (element, index) {
      if (!element.classList.contains('hidden')) {
        runIndex.push(index);
      }
    });

    for (let index = 0; index < runIndex.length; index++) {
      const indexToRun = runIndex[index];

      // Actual run
      const htmlElement = document.getElementById(`fire-${indexToRun}`);
      if (htmlElement != undefined) {
        if (!htmlElement.classList.contains('hidden')) {
          htmlElement.click();
          await sleep(25);
        }
      }
    }
  }

  async function removeFire() {
    let i = 0;
    const htmlElements = document.getElementsByClassName('removeXButton');
    Array.from(htmlElements).forEach(function (element) {
      console.log(element);
    });
    while (true) {
      const htmlElement = document.getElementById(`removeX-${i}`);
      console.log(htmlElement);
      if (htmlElement != undefined) {
        htmlElement.click();
      } else {
        break;
      }
      i++;
    }
  }


  const sortedBase = useMemo(() => {
    if (filteredBase.length <= 2500) {
      return sortDataFunctionSync(
        toStorage.sortValue,
        filteredBase as any,
        pricesResult.prices,
        settingsData?.source?.title
      ) as any[];
    }
    return sortedRows;
  }, [filteredBase, toStorage.sortValue, pricesResult.prices, settingsData, sortedRows]);

  // Async fallback for huge lists.
  useEffect(() => {
    if (filteredBase.length <= 2500) return;
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        // Yield once so route-switch paints before any heavy sort work starts.
        await new Promise((r) => setTimeout(r, 0));
        const result = await sortDataFunctionOffThread(
          toStorage.sortValue,
          filteredBase as any,
          pricesResult.prices,
          settingsData?.source?.title
        );
        if (!cancelled) setSortedRows(result as any[]);
      } catch {}
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [
    filteredBase,
    toStorage.sortValue,
    toStorage.sortValue === 'Price' ? pricesResult.prices : null,
    settingsData?.source?.title,
  ]);

  const processedRows = useMemo(() => {
    const base = [...(filteredBase.length <= 2500 ? sortedBase : sortedRows)];
    if (toStorage.sortBack) base.reverse();
    return base;
  }, [filteredBase.length, sortedBase, sortedRows, toStorage.sortBack]);

  const inventoryMoveable = processedRows;
  const dispatch = useDispatch();

  useLayoutEffect(() => {
    if (didAutoFitRef.current) return;
    if (colWidths && Object.keys(colWidths).length > 0) return;
    if (!inventoryMoveable || inventoryMoveable.length === 0) return;
    const table = document.querySelector(`table[data-tableid="${tableId}"]`) as HTMLTableElement | null;
    if (!table) return;
    didAutoFitRef.current = true;
    autoFitAllColumns(table, dispatch);
    requestAnimationFrame(() => {
      autoFitAllColumns(table, dispatch);
      requestWindowFitForTable(table);
    });
  }, [inventoryMoveable.length, dispatch, tableId, colWidths]);

  useLayoutEffect(() => {
    if (!colWidths || Object.keys(colWidths).length === 0) return;
    const table = document.querySelector(`table[data-tableid="${tableId}"]`) as HTMLTableElement | null;
    if (!table) return;
    applyPersistedWidthsToTable(table, colWidths as Record<string, number>);
    requestWindowFitForTable(table);
  }, [tableId, colWidths]);

  return (
    <>
      {/* Page title & actions */}
      <div className="frost-sep-b border-b-0 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-medium dark:text-dark-white leading-6 mt-2 mb-2 text-gray-900 sm:truncate">
            Transfer to storage units
          </h1>
        </div>
      </div>
      {/* Storage units */}
      <StorageSelectorContent />

      <StorageFilter />

      {/* Projects table (small breakpoint and up) */}

      <div className="frost-sep-b hidden w-full min-w-0 border-b-0 bg-dark-level-one px-2 py-3 text-gray-400 sm:block sm:px-3 dark:text-gray-400">
        <div data-table-scroll className={overviewTableScrollWrap}>
            <table
              data-tableid={tableId}
              data-table-width="fill"
              className={classNames(overviewTableClassName, overviewThCellOverride)}
            >
            <colgroup>
              <col data-colkey="Product name" style={colStyle('Product name')} />
              {(settingsData.columns ?? []).includes('Collections') ? (
                <col data-colkey="Collection" style={colStyle('Collection')} />
              ) : null}
              {(settingsData.columns ?? []).includes('Price') ? (
                <col data-colkey="Price" style={colStyle('Price')} />
              ) : null}
              {(settingsData.columns ?? []).includes('Stickers/patches') ? (
                <col data-colkey="Stickers" style={colStyle('Stickers')} />
              ) : null}
              {(settingsData.columns ?? []).includes('Float') ? (
                <col data-colkey="wearValue" style={colStyle('wearValue')} />
              ) : null}
              {(settingsData.columns ?? []).includes('Rarity') ? (
                <col data-colkey="Rarity" style={colStyle('Rarity')} />
              ) : null}
              {(settingsData.columns ?? []).includes('Tradehold') ? (
                <col data-colkey="tradehold" style={colStyle('tradehold')} />
              ) : null}
              <col data-colkey="QTY" style={colStyle('QTY')} />
              <col data-colkey="Move" style={colStyle('Move')} />
              <col data-colkey="Actions" style={colStyle('Actions')} />
            </colgroup>
            <thead className={overviewTheadClassName}>
              <tr className={classNames(overviewTheadTrClassName, 'border-gray-200')}>
                <RowHeader headerName="Product" sortName="Product name" sortTarget="moveTo" />
                <RowHeaderCondition
                  headerName="Collection"
                  sortName="Collection"
                  condition="Collections"
                  sortTarget="moveTo"
                />
                <RowHeaderCondition
                  headerName="Price"
                  sortName="Price"
                  condition="Price"
                  sortTarget="moveTo"
                />
                <RowHeaderCondition
                  headerName="Stickers/Patches"
                  sortName="Stickers"
                  condition="Stickers/patches"
                  sortTarget="moveTo"
                />
                <RowHeaderCondition
                  headerName="Float"
                  sortName="wearValue"
                  condition="Float"
                  sortTarget="moveTo"
                />
                <RowHeaderCondition
                  headerName="Rarity"
                  sortName="Rarity"
                  condition="Rarity"
                  sortTarget="moveTo"
                />
                <RowHeaderCondition
                  headerName="Tradehold"
                  sortName="tradehold"
                  condition="Tradehold"
                  sortTarget="moveTo"
                />
                <RowHeader headerName="QTY" sortName="QTY" sortTarget="moveTo" />
                <RowHeaderPlain headerName="Move" />

                <RowHeaderCustomKey colKey="Actions" className="text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => ultimateFire()}
                      className={classNames(
                        'p-0 m-0 border-0 bg-transparent shadow-none rounded-none inline-flex items-center justify-center',
                        (1000 -
                          toStorage.activeStoragesAmount -
                          toStorage.totalItemsToMove) ===
                          0 ||
                          (Array.isArray(toStorage.totalToMove) ? toStorage.totalToMove.length : 0) ===
                          inventoryFilters.inventoryFiltered.length
                          ? 'pointer-events-none text-gray-200 dark:text-gray-600'
                          : 'text-gray-600 dark:text-gray-400'
                      )}
                    >
                      <FireIcon
                        className={classNames(
                          ' h-4 w-4 text-current dark:text-current hover:text-yellow-400 dark:hover:text-yellow-400'
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFire()}
                      className={classNames(
                        'p-0 m-0 border-0 bg-transparent shadow-none rounded-none inline-flex items-center justify-center',
                        toStorage.totalToMove.length == 0
                          ? 'pointer-events-none text-gray-200 dark:text-gray-600'
                          : 'text-gray-600 dark:text-gray-400'
                      )}
                    >
                      <NoSymbolIcon
                        className={classNames(
                          ' h-4 w-4 text-current dark:text-current hover:text-red-400 dark:hover:text-red-400'
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </RowHeaderCustomKey>
              </tr>
            </thead>
            <tbody className={overviewTbodyClassName}>
              {inventoryMoveable.map((project, index) => (
                <tr
                  key={project.item_id}
                  className={overviewTrClassName}
                >
                  <StorageRow projectRow={project} index={index} />
                </tr>
              ))}
            </tbody>
            </table>
        </div>
      </div>
    </>
  );
}