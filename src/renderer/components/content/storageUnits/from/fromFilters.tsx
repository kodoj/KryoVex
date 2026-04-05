import { Link } from 'react-router-dom';
import { Disclosure, DisclosureButton } from '@headlessui/react';
import {
  ArchiveBoxIcon,
  DocumentArrowDownIcon,
  FunnelIcon,
  ArrowDownOnSquareStackIcon,
  MagnifyingGlassIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/solid';
import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  moveFromClearAll,
  moveFromsetSearchField,
} from 'renderer/store/slices/moveFrom.ts';
import MoveModal from '../../shared/modals-notifcations/modalMove.tsx';
import { moveModalQuerySet } from 'renderer/store/slices/modalMove.ts';
import PricingAmount from '../../shared/filters/pricingAmount.tsx';
import { downloadReport } from 'renderer/functionsClasses/downloadReport.tsx';
import { btnPrimary, btnText } from '../../shared/buttonStyles.ts';
import { classNames } from '../../shared/filters/inventoryFunctions.ts';
import StorageFilterDisclosure from './storageFilterDisclosure.tsx';
import { fromGetFilterManager } from './fromFilterSetup.tsx';
import { addMajorsFilters } from 'renderer/functionsClasses/filters/filters.ts';
import { searchFilter } from 'renderer/functionsClasses/filters/search.ts';
import { selectInventoryFilters } from 'renderer/store/slices/inventoryFilters.ts';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { selectMoveFrom } from 'renderer/store/slices/moveFrom.ts';

const ClassFilters = fromGetFilterManager();

function content() {
  const dispatch = useDispatch();
  const fromReducer = useSelector(selectMoveFrom);
  const inventory = useSelector(selectInventory);
  const pricesResult = useSelector(selectPricing);
  const settingsData = useSelector(selectSettings);
  const inventoryFilters = useSelector(selectInventoryFilters);

  async function moveItems() {
    const key = (Math.random() + 1).toString(36).substring(7);
    let totalCount = 0;
    const queryNew = [] as any[];
    const rows = Array.isArray(fromReducer.totalToMove) ? fromReducer.totalToMove : [];
    for (const elemental of rows) {
      const row = elemental as unknown as [string, string, string[], string];
      const ids = Array.isArray(row?.[2]) ? row[2] : [];
      for (const itemID of ids) {
        queryNew.push({
          payload: {
            name: row[3] ?? '',
            number: fromReducer.totalItemsToMove - totalCount,
            type: 'from',
            storageID: row[1],
            itemID,
            isLast: fromReducer.totalItemsToMove - totalCount === 1,
            key,
          },
        });
        totalCount++;
      }
    }
    if (queryNew.length === 0) {
      return;
    }
    dispatch(moveModalQuerySet({ query: queryNew }));
  }

  // Calculate storage amount prices
  const storageDataToUse = useMemo(() => {
    const storageInv = inventory.storageInventory ?? [];
    const filtered = inventoryFilters.storageFiltered ?? [];
    if (filtered.length === 0 && inventoryFilters.storageFilter.length === 0) {
      return storageInv;
    }
    return filtered;
  }, [
    inventory.storageInventory,
    inventoryFilters.storageFiltered,
    inventoryFilters.storageFilter.length,
  ]);

  const inventoryFilter = useMemo(() => {
    return searchFilter(storageDataToUse as any, inventoryFilters as any, fromReducer as any) as any[];
  }, [storageDataToUse, inventoryFilters, fromReducer]);

  const totals = useMemo(() => {
    const source = settingsData.source.title;
    const rate = settingsData.currencyPrice[settingsData.currency] ?? 1;
    let totalAmount = 0;
    let totalHighlighted = 0;
    for (const projectRow of inventoryFilter) {
      const filtered = fromReducer.totalToMove.filter((row) => row[0] == projectRow.item_id);
      const basePrice =
        (pricesResult.prices[projectRow.item_name + projectRow.item_wear_name || '']?.[source] ?? 0) *
        rate;

      if (filtered.length > 0) {
        const ids = filtered[0]?.[2];
        totalHighlighted += basePrice * (Array.isArray(ids) ? ids.length : 0);
      }
      totalAmount += (projectRow.combined_QTY ?? 0) * basePrice;
    }
    return {
      totalAmount: totalAmount.toFixed(0),
      totalHighlighted: totalHighlighted.toFixed(0),
    };
  }, [
    inventoryFilter,
    fromReducer.totalToMove,
    pricesResult.prices,
    settingsData.currency,
    settingsData.currencyPrice,
    settingsData.source.title,
  ]);

  useEffect(() => {
    if (inventoryFilter.length === 0) return;
    let cancelled = false;
    addMajorsFilters(inventoryFilter).then((returnValue) => {
      if (cancelled) return;
      ClassFilters.loadFilter(returnValue, true);
    });
    return () => {
      cancelled = true;
    };
  }, [inventoryFilter]);
  return (
    <div className="mt-4 bg-white dark:bg-dark-level-one">
      {/* Filters */}
      <MoveModal />
      <Disclosure
        as="section"
        aria-labelledby="filter-heading"
        className="relative grid items-center border-b dark:border-opacity-50"
      >
        <div className="relative col-start-1 row-start-1 flex justify-between py-2.5">
          <div className="flex max-w-7xl items-center divide-x divide-gray-200 text-sm dark:divide-gray-700/60 px-4 sm:px-6 lg:px-8">
            <div className="pr-5">
              <DisclosureButton
                title="Show or hide storage filters"
                className="group flex items-center font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-500"
              >
                <FunnelIcon
                  className="mr-2 h-5 w-5 shrink-0 text-gray-400 group-hover:text-gray-500"
                  aria-hidden="true"
                />
                {inventoryFilters.storageFilter.length == 0
                  ? inventoryFilters.storageFilter.length + ' Filters'
                  : inventoryFilters.storageFilter.length + ' Filter'}
              </DisclosureButton>
            </div>
            <div className="px-6">
              <button
                type="button"
                className={btnText}
                title="Clear filters, search, and queued quantities for transfer from storage"
                onClick={() => dispatch(moveFromClearAll())}
              >
                Clear all
              </button>
            </div>
            <div className="min-w-0 flex-1 pl-6">
            <label htmlFor="search" className="sr-only">
              Search items
            </label>
            <div className="relative rounded-md focus:outline-none">
              <div
                className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                aria-hidden="true"
              >
                <MagnifyingGlassIcon
                  className="mr-3 h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
              </div>
              <input
                type="text"
                name="search"
                id="search"
                value={fromReducer.searchInput}
                className="block w-full pb-0.5  focus:outline-none dark:text-dark-white pl-9 sm:text-sm border-gray-300 h-7 dark:bg-dark-level-one dark:rounded-none dark:bg-dark-level-one"
                placeholder="Search items"
                spellCheck="false"
                onChange={(e) =>
                  dispatch(moveFromsetSearchField({ searchField: e.target.value }))
                }
              />
            </div>
            </div>
          </div>
          <div className="flex max-w-7xl justify-end justify-items-end px-4 sm:px-6 lg:px-8">
            <div className="flex items-center divide-x divide-gray-200 dark:divide-gray-700/60">
              <div className="pr-3">
                <Link
                  to=""
                  type="button"
                  title="Download report of items in the current storage list"
                  onClick={() =>
                    downloadReport(settingsData, pricesResult, inventoryFilter)
                  }
                  className={classNames(
                    btnPrimary,
                    'order-1 ml-3 px-4 py-2 sm:order-0 sm:ml-0',
                    (inventory.storageInventory ?? []).length === 0 && 'pointer-events-none opacity-50'
                  )}
                >
                  <DocumentArrowDownIcon
                    className="mr-3 h-4 dark:text-dark-white w-4 text-gray-500"
                    aria-hidden="true"
                  />
                  Download
                </Link>
              </div>
              <div className="pl-3">
                <PricingAmount
                  totalAmount={new Intl.NumberFormat(settingsData.locale, {
                    style: 'currency',
                    currency: settingsData.currency,
                  }).format(Number(totals.totalAmount))}
                  pricingAmount={Number(totals.totalHighlighted)}
                  title="Total value of listed storage items; number in parentheses is value of items queued to move"
                />
              </div>
              <div className="pl-3">
                <span className="mr-3 flex items-center text-gray-500 text-xs font-medium uppercase tracking-wide">
                  <ArchiveBoxIcon
                    className="flex-none w-5 h-5 mr-2 text-gray-400 group-hover:text-gray-500"
                    aria-hidden="true"
                  />{' '}
                  <span className="text-green-500">
                    {1000 -
                      inventory.inventory.length -
                      fromReducer.totalItemsToMove}{' '}
                    left
                  </span>
                </span>
              </div>
              <div className="pl-3">
                <span className="mr-3 flex items-center text-gray-500 text-xs font-medium uppercase tracking-wide">
                  <ArrowsRightLeftIcon
                    className="flex-none w-5 h-5 mr-2 text-gray-400 group-hover:text-gray-500"
                    aria-hidden="true"
                  />{' '}
                  <span className="text-blue-500">
                    {fromReducer.totalItemsToMove} Items
                  </span>
                </span>
              </div>
              <div className="pl-3">
                <Link
                  to=""
                  type="button"
                  title="Start moving queued items out of storage units"
                  onClick={() => moveItems()}
                  className={classNames(
                    btnPrimary,
                    'order-1 ml-3 px-4 py-2 sm:order-0 sm:ml-0',
                    fromReducer.totalItemsToMove === 0 && 'pointer-events-none opacity-50'
                  )}
                >
                  Move
                  <ArrowDownOnSquareStackIcon
                    className="ml-3 dark:text-dark-white h-4 w-4 text-gray-700"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
        <StorageFilterDisclosure classFilters={ClassFilters} />
      </Disclosure>
    </div>
  );
}
export default function StorageFilter() {
  return content();
}