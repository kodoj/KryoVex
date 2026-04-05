import { Link } from 'react-router-dom';
import { Disclosure, DisclosureButton } from '@headlessui/react';
import {
  ArchiveBoxIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowsRightLeftIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/solid';
// import MoveModal from '../../shared/modals-notifcations/modalMove';
import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { btnPrimary, btnText } from '../../shared/buttonStyles.ts';
import { classNames } from '../../shared/filters/inventoryFunctions.ts';
import MoveModal from '../../shared/modals-notifcations/modalMove.tsx';
import { moveModalQuerySet } from '../../../../store/slices/modalMove.ts';
import {
  moveToClearAll,
  moveToSetSearch,
  selectMoveTo,
  setStorageAmount,
} from 'renderer/store/slices/moveTo.ts';
import PricingAmount from '../../shared/filters/pricingAmount.tsx';
import InventoryFiltersDisclosure from '../../Inventory/filtersDisclosure.tsx';
import { searchFilter } from 'renderer/functionsClasses/filters/search.ts';
import { ConvertPrices } from 'renderer/functionsClasses/prices.ts';
import { toGetFilterManager } from './toFilterSetup.tsx';
import { addMajorsFilters } from '../../../../functionsClasses/filters/filters.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { selectInventoryFilters } from 'renderer/store/slices/inventoryFilters.ts';
const ClassFilters = toGetFilterManager()

function content() {
  const dispatch = useDispatch();
  const pricesResult = useSelector(selectPricing);
  const toReducer = useSelector(selectMoveTo);
  const inventory = useSelector(selectInventory);
  const settingsData = useSelector(selectSettings);
  const inventoryFilters = useSelector(selectInventoryFilters);

  async function moveItems() {
    const key = (Math.random() + 1).toString(36).substring(7);
    let totalCount = 0;
    const queryNew = [] as any[];
    const storageID = toReducer.activeStorages[0];
    if (!storageID) {
      return;
    }
    const rows = Array.isArray(toReducer.totalToMove) ? toReducer.totalToMove : [];
    for (const elemental of rows) {
      const row = elemental as unknown as [string, string, string[], string];
      const ids = Array.isArray(row?.[2]) ? row[2] : [];
      for (const itemID of ids) {
        queryNew.push({
          payload: {
            name: row[3] ?? '',
            number: toReducer.totalItemsToMove - totalCount,
            type: 'to',
            storageID,
            itemID,
            isLast: toReducer.totalItemsToMove - totalCount === 1,
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

  // Storage count
  const activeStorageRow = useMemo(() => {
    const sid = toReducer.activeStorages[0];
    if (!sid) return null;
    return (
      inventory.inventory.find((item) => item.item_id?.includes(sid)) ?? null
    );
  }, [inventory.inventory, toReducer.activeStorages]);

  useEffect(() => {
    const total = activeStorageRow?.item_storage_total;
    if (total == null) return;
    if (total !== toReducer.activeStoragesAmount) {
      dispatch(setStorageAmount({ storageAmount: total }));
    }
  }, [activeStorageRow?.item_storage_total, dispatch, toReducer.activeStoragesAmount]);

  const inventoryFilter = useMemo(() => {
    return searchFilter(inventory.inventory ?? [], inventoryFilters, toReducer);
  }, [inventory.inventory, inventoryFilters, toReducer]);

  const pricesConvert = useMemo(() => {
    return new ConvertPrices(settingsData, pricesResult);
  }, [settingsData, pricesResult]);

  const totals = useMemo(() => {
    let totalAmount = 0;
    let totalHighlighted = 0;
    for (const projectRow of inventoryFilter as any[]) {
      const filtered = toReducer.totalToMove.filter((row) => row[0] == projectRow.item_id);
      if (filtered.length > 0) {
        const ids = filtered[0]?.[2];
        totalHighlighted +=
          pricesConvert.getPrice(projectRow) * (Array.isArray(ids) ? ids.length : 0);
      }
      totalAmount += pricesConvert.getPrice(projectRow, true);
    }
    return {
      totalAmount: totalAmount.toFixed(0),
      totalHighlighted: totalHighlighted.toFixed(0),
    };
  }, [inventoryFilter, pricesConvert, toReducer.totalToMove]);

  useEffect(() => {
    if (!inventory?.combinedInventory || inventory.combinedInventory.length === 0) return;
    let cancelled = false;
    addMajorsFilters(inventory.combinedInventory).then((returnValue) => {
      if (cancelled) return;
      ClassFilters.loadFilter(returnValue, true);
    });
    return () => {
      cancelled = true;
    };
  }, [inventory?.combinedInventory]);

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
                title="Show or hide inventory filters for transfer to storage"
                className="group flex items-center font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-500"
              >
                <FunnelIcon
                  className="mr-2 h-5 w-5 shrink-0 text-gray-400 group-hover:text-gray-500"
                  aria-hidden="true"
                />
                {inventoryFilters.inventoryFilter.length - 1 == -1
                  ? 0
                  : inventoryFilters.inventoryFilter.length - 1}{' '}
                Filters
              </DisclosureButton>
            </div>

            <div className="px-6">
              <button
                type="button"
                className={btnText}
                title="Clear filters, search, and queued quantities for transfer to storage"
                onClick={() => dispatch(moveToClearAll())}
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
                value={toReducer.searchInput}
                className="block w-full pb-0.5  focus:outline-none dark:text-dark-white pl-9 sm:text-sm border-gray-300 h-7 dark:bg-dark-level-one dark:rounded-none dark:bg-dark-level-one"
                placeholder="Search items"
                spellCheck="false"
                onChange={(e) => dispatch(moveToSetSearch({searchField: e.target.value}))}
              />
            </div>
            </div>
          </div>
          <div className="flex max-w-7xl justify-end justify-items-end px-4 sm:px-6 lg:px-8">
            <div className="flex items-center divide-x divide-gray-200 dark:divide-gray-700/60">
              <div className="pr-3">
                <PricingAmount
                  totalAmount={new Intl.NumberFormat(settingsData.locale, {
                    style: 'currency',
                    currency: settingsData.currency,
                  }).format(Number(totals.totalAmount))}
                  pricingAmount={Number(totals.totalHighlighted)}
                  title="Total value of listed inventory; number in parentheses is value of items queued to insert"
                />
              </div>
              <div className="pl-3">
                <span className="mr-3 flex items-center text-gray-500 text-xs font-medium uppercase tracking-wide">
                  <ArchiveBoxIcon
                    className="flex-none w-5 h-5 mr-2 text-gray-400 group-hover:text-gray-500"
                    aria-hidden="true"
                  />{' '}
                  {1000 -
                    toReducer.activeStoragesAmount -
                    toReducer.totalItemsToMove <
                  0 ? (
                    <span className="text-red-500">
                      {1000 -
                        toReducer.activeStoragesAmount -
                        toReducer.totalItemsToMove}{' '}
                      left
                    </span>
                  ) : (
                    <span className="text-green-500">
                      {1000 -
                        toReducer.activeStoragesAmount -
                        toReducer.totalItemsToMove}{' '}
                      left
                    </span>
                  )}
                </span>
              </div>
              <div className="pl-3">
                <span className="mr-3 flex items-center text-gray-500 text-xs font-medium uppercase tracking-wide">
                  <ArrowsRightLeftIcon
                    className="flex-none w-5 h-5 mr-2 text-gray-400 group-hover:text-gray-500"
                    aria-hidden="true"
                  />{' '}
                  <span className="text-blue-500">
                    {toReducer.totalItemsToMove} Items
                  </span>
                </span>
              </div>
              <div className="pl-3">
                <Link
                  to=""
                  type="button"
                  title="Insert queued items into the selected storage unit"
                  onClick={() => moveItems()}
                  className={classNames(
                    btnPrimary,
                    'order-1 ml-3 px-4 py-2 sm:order-0 sm:ml-0',
                    (toReducer.totalItemsToMove === 0 ||
                      toReducer.activeStorages.length === 0 ||
                      1000 - toReducer.activeStoragesAmount - toReducer.totalItemsToMove < 0) &&
                      'pointer-events-none opacity-50'
                  )}
                >
                  Insert
                  <ArrowUpTrayIcon
                    className="ml-3 dark:text-dark-white h-4 w-4 text-gray-700"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
        <InventoryFiltersDisclosure ClassFilters={ClassFilters}  />
      </Disclosure>
    </div>
  );
}

export default function StorageFilter() {
  return content();
}
