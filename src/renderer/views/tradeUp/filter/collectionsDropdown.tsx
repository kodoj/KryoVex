import { Fragment } from 'react'
import {  Popover, PopoverButton, PopoverGroup, PopoverPanel, Transition } from '@headlessui/react'
import { useDispatch, useSelector } from 'react-redux';
import { selectTradeUp, tradeUpCollectionsAddRemove } from 'renderer/store/slices/tradeUp.ts';
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectInventoryFilters } from 'renderer/store/slices/inventoryFilters.ts';

export default function CollectionsDropDown() {
  const tradeUpData = useSelector(selectTradeUp);
  const inventory = useSelector(selectInventory);
  const inventoryFilters = useSelector(selectInventoryFilters);
  const dispatch = useDispatch();

  let inventoryToUse = [...inventory.inventory, ...inventory.storageInventoryRaw] as any;
  let collections = [...tradeUpData.collections] as any;

  inventoryToUse = inventoryToUse.filter(function (item) {
    if (!item.tradeUpConfirmed) {
      return false;
    }
    if (item.item_paint_wear == undefined) {
      return false;
    }
    if (tradeUpData.MinFloat > item.item_paint_wear || tradeUpData.MaxFloat < item.item_paint_wear) {
      return false;
    }
    if (tradeUpData.tradeUpProductsIDS.includes(item.item_id)) {
      return false;
    }
    if (tradeUpData.options.includes('Hide equipped')) {
      if (item.equipped_t || item.equipped_ct) {
        return false;
      }
    }
    if (tradeUpData.tradeUpProducts.length != 0) {
      let restrictRarity = tradeUpData.tradeUpProducts[0].rarityName
      let restrictStattrak = tradeUpData.tradeUpProducts[0].stattrak
      if (item.rarityName != restrictRarity) {
        return false
      }
      if (item.stattrak != restrictStattrak) {
        return false
      }
    }

    if (item.tradeUp) {
      return true;
    }
    return false;
  });

  inventoryToUse.forEach(element => {

    if (inventoryFilters.rarityFilter.length != 0) {
      if (inventoryFilters.rarityFilter?.includes(
        element.rarityColor
        )) {
          if (element['collection'] != undefined && collections.includes(element['collection']) == false) {
            collections.push(element['collection'])
          }
        }
    } else {
      if (element['collection'] != undefined && collections.includes(element['collection']) == false) {
        collections.push(element['collection'])
      }
    }
  });
  collections.sort()

  return (
    <PopoverGroup className="-mx-4 flex items-center divide-x divide-gray-200">
      <Popover  className="pl-4 relative inline-block text-left">
        <PopoverButton className={classNames(collections.length == 0 ? 'pointer-events-none' : '',"group inline-flex justify-center text-sm font-medium text-gray-700 hover:text-gray-900 dark:hover:text-gray-400 dark:text-gray-500")}>
          Collections
          <span className="mr-1.5 ml-1.5 rounded py-0.5 px-1.5 bg-gray-200 dark:bg-dark-level-four dark:text-gray-400 text-xs font-semibold text-gray-700 tabular-nums" >
                {tradeUpData.collections.length}
              </span>




        </PopoverButton>

        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
          >
          <PopoverPanel className="origin-top-right absolute right-0 mt-2 z-20 bg-white dark:bg-dark-level-four rounded-md shadow-2xl p-4 ring-1 ring-black ring-opacity-5 focus:outline-none">
            <form className="space-y-4">
              {collections.map((option, optionIdx) => (
                <div key={option} className="flex items-center">
                  <input
                    id={`filter-${option}-${optionIdx}`}
                    name={`${option}[]`}
                    defaultValue={option}
                    type="checkbox"
                    checked={tradeUpData.collections.includes(option)}
                    className="h-4 w-4 border-gray-300 rounded text-kryo-ice-400 focus:ring-kryo-ice-400"
                    onClick={() => dispatch(tradeUpCollectionsAddRemove(option))}
                    onChange={() => ('')}
                    />
                  <label
                    htmlFor={`filter-${option}-${optionIdx}`}
                    className="ml-3 pr-6 text-sm font-medium dark:text-gray-400 text-gray-900 whitespace-nowrap"
                    >
                    {option.replace('The ', '').replace(' Collection', '')}
                  </label>
                </div>
              ))}
            </form>
          </PopoverPanel>
        </Transition>
      </Popover>
  </PopoverGroup>
  )
}
