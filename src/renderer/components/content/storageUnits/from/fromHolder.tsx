import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { classNames, sortDataFunctionOffThread, sortDataFunctionSync } from '../../shared/filters/inventoryFunctions.ts';
import {
  overviewTableScrollWrap,
  overviewTableClassName,
  overviewTheadClassName,
  overviewTheadTrClassName,
  overviewThCellOverride,
  overviewTbodyClassName,
  overviewTrClassName,
} from '../../shared/tableOverviewStyles.ts';
import { NoSymbolIcon, FireIcon } from '@heroicons/react/24/solid';
import { RowHeader, RowHeaderCondition, RowHeaderPlainKey, RowHeaderCustomKey } from '../../Inventory/inventoryRows/headerRows.tsx';
import {
  autoFitAllColumns,
  applyPersistedWidthsToTable,
  requestWindowFitForTable,
} from '../../Inventory/inventoryRows/headerRows.tsx';
import { searchFilter } from 'renderer/functionsClasses/filters/search.ts';
import StorageFilter from './fromFilters.tsx';
import StorageRow from './fromStorageRow.tsx';
import StorageSelectorContent from './fromSelector.tsx';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectInventoryFilters } from 'renderer/store/slices/inventoryFilters.ts';
import { selectMoveFrom } from 'renderer/store/slices/moveFrom.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';

export default function StorageUnits() {
  const inventory = useSelector(selectInventory);
  const inventoryFilters = useSelector(selectInventoryFilters);
  const fromReducer = useSelector(selectMoveFrom);
  const settingsData = useSelector(selectSettings);
  const pricesResult = useSelector(selectPricing);

  const tableId = 'transferFrom';
  const colWidths = (settingsData as any)?.columnWidths?.[tableId] ?? {};
  const colStyle = (key: string) => {
    const width = colWidths?.[key];
    return width != null ? ({ width: `${width}px` } as any) : ({} as any);
  };

  const [sortedRows, setSortedRows] = useState<any[]>([]);

  function sleep(time: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }

  async function ultimateFire() {
    const runIndex = [] as any[];
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

  const baseRows = useMemo(() => {
    const storageInv = inventory.storageInventory ?? [];
    const filtered = inventoryFilters.storageFiltered ?? [];
    return filtered.length === 0 && inventoryFilters.storageFilter.length === 0
      ? storageInv
      : filtered;
  }, [
    inventory.storageInventory,
    inventoryFilters.storageFiltered,
    inventoryFilters.storageFilter.length,
  ]);

  const filteredRows = useMemo(() => {
    return searchFilter(baseRows, inventoryFilters, fromReducer) as any[];
  }, [baseRows, inventoryFilters, fromReducer]);

  const sortedBase = useMemo(() => {
    if (filteredRows.length <= 2500) {
      return sortDataFunctionSync(
        fromReducer.sortValue,
        filteredRows as any,
        pricesResult.prices,
        settingsData?.source?.title
      ) as any[];
    }
    return sortedRows;
  }, [
    filteredRows,
    fromReducer.sortValue,
    fromReducer.sortValue === 'Price' ? pricesResult.prices : null,
    settingsData?.source?.title,
    sortedRows,
  ]);

  // Async fallback for huge lists.
  useEffect(() => {
    if (filteredRows.length <= 2500) return;
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        // Yield once so route-switch paints before any heavy sort work starts.
        await new Promise((r) => setTimeout(r, 0));
        const result = await sortDataFunctionOffThread(
          fromReducer.sortValue,
          filteredRows as any,
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
    filteredRows,
    fromReducer.sortValue,
    fromReducer.sortValue === 'Price' ? pricesResult.prices : null,
    settingsData?.source?.title,
  ]);

  const storageFiltered = useMemo(() => {
    // Never mutate in place (reverse()) since lists may be backed by Redux state.
    const out = [...(filteredRows.length <= 2500 ? (sortedBase ?? []) : (sortedRows ?? []))];
    if (fromReducer.sortBack) out.reverse();
    return out;
  }, [filteredRows.length, sortedBase, sortedRows, fromReducer.sortBack]);

  const didAutoFitRef = useRef(false);
  const dispatch = useDispatch();
  useLayoutEffect(() => {
    if (didAutoFitRef.current) return;
    if (colWidths && Object.keys(colWidths).length > 0) return;
    if (!storageFiltered || storageFiltered.length === 0) return;
    const table = document.querySelector(`table[data-tableid="${tableId}"]`) as HTMLTableElement | null;
    if (!table) return;
    didAutoFitRef.current = true;
    autoFitAllColumns(table, dispatch);
    // A second pass on next frame makes initial fit match settled layout.
    requestAnimationFrame(() => {
      autoFitAllColumns(table, dispatch);
      requestWindowFitForTable(table);
    });
  }, [storageFiltered.length, dispatch, tableId, colWidths]);

  useLayoutEffect(() => {
    if (!colWidths || Object.keys(colWidths).length === 0) return;
    const table = document.querySelector(`table[data-tableid="${tableId}"]`) as HTMLTableElement | null;
    if (!table) return;
    applyPersistedWidthsToTable(table, colWidths as Record<string, number>);
    requestWindowFitForTable(table);
  }, [tableId, colWidths]);

  return (
    <>
      {/* Storage units */}
      <StorageSelectorContent />
      <StorageFilter />
      {/* Projects table (small breakpoint and up) */}
      <div className="frost-sep-b hidden w-full min-w-0 border-b-0 bg-dark-level-one px-2 py-3 sm:block sm:px-3">
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
              {(settingsData.columns ?? []).includes('Storage') ? (
                <col data-colkey="StorageName" style={colStyle('StorageName')} />
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
                <RowHeader headerName='Product' sortName='Product name' sortTarget="moveFrom"/>
                <RowHeaderCondition headerName='Collection' sortName='Collection' condition='Collections' sortTarget="moveFrom"/>
                <RowHeaderCondition headerName='Price' sortName='Price' condition='Price' sortTarget="moveFrom"/>
                <RowHeaderCondition headerName='Stickers/Patches' sortName='Stickers' condition='Stickers/patches' sortTarget="moveFrom"/>
                <RowHeaderCondition headerName='Float' sortName='wearValue' condition='Float' sortTarget="moveFrom"/>
                <RowHeaderCondition headerName='Rarity' sortName='Rarity' condition='Rarity' sortTarget="moveFrom"/>
                <RowHeaderCondition headerName='Storage' sortName='StorageName' condition='Storage' sortTarget="moveFrom"/>
                <RowHeaderCondition headerName='Tradehold' sortName='tradehold' condition='Tradehold' sortTarget="moveFrom"/>
                <RowHeader headerName='QTY' sortName='QTY' sortTarget="moveFrom"/>
                <RowHeaderPlainKey colKey="Move" label="Move" />
                <RowHeaderCustomKey colKey="Actions" className="text-center">
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => ultimateFire()}
                      className={classNames(
                        'p-0 m-0 border-0 bg-transparent shadow-none rounded-none inline-flex items-center justify-center',
                        (1000 -
                          inventory.inventory.length -
                          fromReducer.totalItemsToMove ==
                          0 &&
                          storageFiltered.length != 0) ||
                          storageFiltered.length == 0 ||
                          storageFiltered.length == fromReducer.totalToMove.length
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
                        fromReducer.totalToMove.length == 0
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
              {storageFiltered.map((project, index) => (
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