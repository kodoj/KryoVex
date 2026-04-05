import { Disclosure } from '@headlessui/react';
import { useDispatch, useSelector } from 'react-redux';
import { searchFilter } from 'renderer/functionsClasses/filters/search.ts';
import { ConvertPrices } from 'renderer/functionsClasses/prices.ts';
import { Filter, Filters } from 'renderer/interfaces/filters.ts';
import { isEqual } from 'lodash';
import { storageInventoryAddOption } from 'renderer/store/thunks/inventoryFilters.ts';
import { selectInventoryFilters } from 'renderer/store/slices/inventoryFilters.ts';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { AppDispatch } from 'renderer/store/configureStore.ts'; // For typed dispatch

export default function StorageFilterDisclosure({ classFilters }: { classFilters: { filters: Filters } }) {
  const dispatch = useDispatch<AppDispatch>(); // Typed dispatch for async thunks
  const inventoryFilters = useSelector(selectInventoryFilters);
  const inventory = useSelector(selectInventory);
  const pricesResult = useSelector(selectPricing);
  const settingsData = useSelector(selectSettings);

  // Update selected filter
  async function addRemoveFilter(filterValue: Filter) {
    await dispatch(storageInventoryAddOption(filterValue)); // Await for async handling
  }

  let inventoryToUse: any[] = [];
  const filteredToUse = inventoryFilters.storageFiltered;
  const filterToUse = inventoryFilters.storageFilter;

  if (
    filteredToUse.length === 0 &&
    filterToUse.length === 0
  ) {
    // Storage-unit filters apply to the storage inventory, not the combined inventory.
    inventoryToUse = inventory.storageInventory as any[];
  } else {
    inventoryToUse = filteredToUse as any[];
  }

  // Calculate inventory amount prices
  let _totalAmount = 0;
  const inventoryFilter = searchFilter(inventoryToUse, inventoryFilters, inventoryFilters);
  const PricesClass = new ConvertPrices(settingsData, pricesResult);
  inventoryFilter.forEach((projectRow) => {
    let itemRowPricing = PricesClass.getPrice(projectRow);
    if (itemRowPricing) {
      let individualPrice = (projectRow.combined_QTY as number) * itemRowPricing;
      _totalAmount += individualPrice = individualPrice ? individualPrice : 0;
    }
  });

  let totalSeen = 0;
  let ignoreCategories: Filter[] = [];
  Object.entries((classFilters.filters ?? {}) as Filters).map(([_key, filterObject]) => {
    if (!Array.isArray(filterObject)) return;
    filterObject.map((filter, _optionIdx) => {
      if (filterToUse.filter(filt => isEqual(filt, filter)).length > 0) {
        totalSeen += 1;
        ignoreCategories.push(filter);
      }
    });
  });

  let categoriesToRemove: Filter[] = [];
  if (filterToUse.length > totalSeen) {
    filterToUse.forEach(element => {
      if (!ignoreCategories.some(ig => isEqual(ig, element)) && element.label !== 'Storage moveable') {
        categoriesToRemove.push(element);
      }
    });
  }

  categoriesToRemove.forEach(element => {
    addRemoveFilter(element);
  });

  return (
    <Disclosure.Panel className="border-t border-gray-200 py-10">
      <div className="mx-auto grid grid-cols-1 gap-x-4 px-4 text-sm sm:px-6 md:gap-x-6 lg:px-8 ">
        <div className="grid grid-cols-1 gap-y-10 auto-rows-min md:grid-cols-3 md:gap-x-6">
          {Object.entries((classFilters.filters ?? {}) as Filters).map(([key, filterObject]) => (
            <fieldset key={key}>
              <legend className="block font-medium dark:text-dark-white">{key}</legend>
              <div className="pt-6 space-y-6 sm:pt-4 sm:space-y-4">
                {(Array.isArray(filterObject) ? filterObject : []).map((filter, optionIdx) => (
                  <div
                    key={filter.label + filter.include}
                    className="flex items-center text-base sm:text-sm"
                  >
                    <input
                      id={`${filter.label + filter.include}-${optionIdx}`}
                      name="price[]"
                      type="checkbox"
                      className="shrink-0 h-4 w-4 border-gray-300 rounded text-kryo-ice-400 focus:ring-kryo-ice-400"
                      onClick={() => addRemoveFilter(filter)}
                      checked={
                        filterToUse.filter(filt => isEqual(filt, filter)).length > 0
                          ? true
                          : false
                      }
                      onChange={(e) => {
                        e;
                      }}
                    />
                    <label
                      htmlFor={`${filter.label + filter.include}-${optionIdx}`}
                      className="ml-3 min-w-0 flex-1 text-gray-600 dark:text-gray-400"
                    >
                      {filter.label}
                    </label>
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </div>
    </Disclosure.Panel>
  );
}