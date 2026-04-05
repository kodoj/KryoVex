import { Link } from 'react-router-dom';
import { Disclosure, DisclosureButton } from '@headlessui/react';
import {
  DocumentArrowDownIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/solid';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import  { clearAll,
  inventoryFiltersSetSearch,
  selectInventoryFilters,
} from 'renderer/store/slices/inventoryFilters.ts';
import { btnPrimary, btnText } from '../shared/buttonStyles.ts';
import { classNames } from '../shared/filters/inventoryFunctions.ts';
import PricingAmount from '../shared/filters/pricingAmount.tsx';
import MoveLeft from '../shared/filters/inventoryAmount.tsx';
import AccountAmount from '../shared/filters/accountAmount.tsx';
import { searchFilter } from 'renderer/functionsClasses/filters/search.ts';
import { ConvertPrices } from 'renderer/functionsClasses/prices.ts';
import { downloadReport } from 'renderer/functionsClasses/downloadReport.tsx';
import InventoryFiltersDisclosure from './filtersDisclosure.tsx';
import { addMajorsFilters } from 'renderer/functionsClasses/filters/filters.ts';
import { InventoryGetFilterManager } from './inventoryFilterSetup.tsx';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';

const ClassFilters = InventoryGetFilterManager()
// ClassFilters.loadFilter(CharacteristicsFilter, true)
// ClassFilters.loadFilter(ContainerFilter, true)

export default function content() {
  const dispatch = useDispatch();
  const inventoryFilters = useSelector(selectInventoryFilters);
  const inventory = useSelector(selectInventory);
  const pricesResult = useSelector(selectPricing);
  const settingsData = useSelector(selectSettings);

  // Build the "Majors" filter list once inventory is available.
  // This must NOT run during render (it can cause repeated state updates and UI hangs).
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

  async function clear_all() {
    dispatch(clearAll());
  }

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

  const filteredForTotals = useMemo(() => {
    return searchFilter(inventoryToUse, inventoryFilters, inventoryFilters);
  }, [inventoryToUse, inventoryFilters]);

  const pricesClass = useMemo(() => {
    return new ConvertPrices(settingsData, pricesResult);
  }, [settingsData, pricesResult]);

  const [totalAmountFormatted, setTotalAmountFormatted] = useState<string>('--');
  useEffect(() => {
    let cancelled = false;
    const compute = () => {
      let totalAmount = 0;
      for (const projectRow of filteredForTotals) {
        const itemRowPricing = pricesClass.getPrice(projectRow);
        if (!itemRowPricing) continue;
        const qty = (projectRow.combined_QTY as number) ?? 0;
        totalAmount += qty * itemRowPricing;
      }
      const rounded = Math.round(totalAmount);
      const formatted = new Intl.NumberFormat(settingsData.locale, {
        style: 'currency',
        currency: settingsData.currency,
        minimumFractionDigits: 0,
      }).format(rounded);
      if (!cancelled) setTotalAmountFormatted(formatted);
    };

    // Defer heavy totals calculation so Inventory click can paint immediately.
    const id = window.setTimeout(compute, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [filteredForTotals, pricesClass, settingsData.currency, settingsData.locale]);
  return (
    <div className="bg-white dark:bg-dark-level-one">
      {/* Filters */}
      <Disclosure
        as="section"
        aria-labelledby="filter-heading"
        className="relative grid items-center frost-sep-b border-b-0"
      >
        <h2 id="filter-heading" className="sr-only">
          Filters
        </h2>
        <div className="relative col-start-1 row-start-1 flex justify-between py-2.5">
          <div className="flex max-w-7xl items-center divide-x divide-gray-200 text-sm dark:divide-gray-700/60 px-4 sm:px-6 lg:px-8">
            <div className="pr-5">
              <DisclosureButton
                title="Show or hide advanced inventory filters"
                className="group flex items-center font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
              >
                <FunnelIcon
                  className="mr-2 h-5 w-5 shrink-0 text-gray-400 group-hover:text-gray-500"
                  aria-hidden="true"
                />
                {inventoryFilters.inventoryFilter.length} Filters
              </DisclosureButton>
            </div>
            <div className="px-6">
              <button
                type="button"
                className={btnText}
                title="Clear all active inventory filters and search"
                onClick={() => clear_all()}
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
                value={inventoryFilters.searchInput}
                className="block w-full pb-0.5  focus:outline-none dark:text-dark-white pl-9 sm:text-sm border-gray-300 h-7 dark:bg-dark-level-one dark:rounded-none dark:bg-dark-level-one"
                placeholder="Search items"
                spellCheck="false"
                onChange={(e) =>
                  dispatch(inventoryFiltersSetSearch({ searchField: e.target.value }))
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
                  title="Download a report of the current inventory list"
                  onClick={() => downloadReport(settingsData, pricesResult, inventoryToUse)}
                  className={classNames(
                    btnPrimary,
                    'order-1 ml-3 px-4 py-2 sm:order-0 sm:ml-0',
                    inventoryToUse.length === 0 && 'pointer-events-none opacity-50'
                  )}
                >
                  <DocumentArrowDownIcon
                    className="mr-3 h-4 w-4 text-gray-500 dark:text-dark-white"
                    aria-hidden="true"
                  />
                  Download
                </Link>
              </div>
              <div className="pl-3">
                <PricingAmount
                  totalAmount={totalAmountFormatted}
                  title="Combined value of items matching current filters and search"
                />
              </div>
              <div className="pl-3">
                <MoveLeft totalAmount={inventory.inventory.length} textToWrite="Total" />
              </div>
              <div className="pl-3">
                <AccountAmount totalAmount={inventory.totalAccountItems} textToWrite="Total" />
              </div>
            </div>
          </div>
        </div>
        <InventoryFiltersDisclosure ClassFilters={ClassFilters}/>
      </Disclosure>
    </div>
  );
}