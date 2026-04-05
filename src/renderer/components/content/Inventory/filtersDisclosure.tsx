import { Disclosure } from '@headlessui/react';
import { useSelector } from 'react-redux';
import { useAppDispatch } from 'renderer/store/configureStore.ts';
import { selectInventoryFilters } from 'renderer/store/slices/inventoryFilters.ts';
import { filterInventoryAddOption } from 'renderer/store/thunks/inventoryFilters.ts';
import { searchFilter } from 'renderer/functionsClasses/filters/search.ts';
import { ConvertPrices } from 'renderer/functionsClasses/prices.ts';
import { Filter, Filters } from 'renderer/interfaces/filters.ts';
import * as _ from 'lodash';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';



export default function InventoryFiltersDisclosure({ClassFilters}) {
  const dispatch = useAppDispatch();

  const inventoryFilters = useSelector(selectInventoryFilters);
  const inventory = useSelector(selectInventory)
  const pricesResult = useSelector(selectPricing)
  const settingsData = useSelector(selectSettings)


  // Update selected filter
  async function addRemoveFilter(filterValue: Filter) {
    dispatch(filterInventoryAddOption(filterValue));
  }


  let inventoryToUse = [] as any;

  if (
    inventoryFilters.inventoryFiltered.length == 0 &&
    inventoryFilters.inventoryFilter.length == 0
  ) {
    inventoryToUse = inventory.combinedInventory;
  } else {
    inventoryToUse = inventoryFilters.inventoryFiltered;
  }

  // Calculate inventory amount prices
  let _totalAmount = 0 as any;
  const inventoryFilter = searchFilter(inventoryToUse, inventoryFilters, inventoryFilters);
  const PricesClass = new ConvertPrices(settingsData, pricesResult);
  inventoryFilter.forEach((projectRow) => {
    let itemRowPricing = PricesClass.getPrice(projectRow)
    if (itemRowPricing) {
      let individualPrice = projectRow.combined_QTY as number * itemRowPricing
      _totalAmount += individualPrice = individualPrice ? individualPrice : 0
    }
  });

  let totalSeen = 0;
  let ignoreCategories: Array<Filter> = []

  Object.entries(ClassFilters.filters as Filters).map(([_key, filterObject]) => {
    filterObject.map((filter, _optionIdx) => {
      if (inventoryFilters.inventoryFilter.filter(filt => _.isEqual(filt, filter)).length > 0) {
        totalSeen += 1
        ignoreCategories.push(filter)
      }
    });
  });
  let categoriesToRemove: Array<Filter> = []
  if (inventoryFilters.inventoryFilter.length > totalSeen) {
    inventoryFilters.inventoryFilter.forEach(element => {
      if (!_.some(ignoreCategories, element) && element.label != 'Storage moveable') {
        categoriesToRemove.push(element)
      }
    });
  }
  categoriesToRemove.forEach(element => {
    addRemoveFilter(element)
  });




  return (
    <Disclosure.Panel className="border-t border-kryo-ice-400/25 py-10 dark:border-kryo-ice-300/20">
          <div className="mx-auto grid grid-cols-1 gap-x-4 px-4 text-sm sm:px-6 md:gap-x-6 lg:px-8 ">
            <div className="grid grid-cols-1 gap-y-10 auto-rows-min md:grid-cols-3 md:gap-x-6">
            {Object.entries(ClassFilters.filters as Filters).map(([key, filterObject]) => (
              <fieldset key={key}>
              <legend className="block font-medium dark:text-dark-white">{key}</legend>
              <div className="pt-6 space-y-6 sm:pt-4 sm:space-y-4">
                {filterObject.map((filter, optionIdx) => (
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
                          inventoryFilters.inventoryFilter.filter(filt => _.isEqual(filt, filter)).length > 0
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
