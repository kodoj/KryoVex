import { Fragment } from 'react'
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react';
import { useDispatch, useSelector } from 'react-redux';
import { selectTradeUp, tradeUpCollectionsAddRemove } from 'renderer/store/slices/tradeUp.ts';
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import { Inventory, InventoryFilters, TradeUpActions } from 'renderer/interfaces/states.tsx';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectInventoryFilters } from 'renderer/store/slices/inventoryFilters.ts';

export default function CollectionsDropDown() {
  const tradeUpData: TradeUpActions = useSelector(selectTradeUp);
  const inventory: Inventory = useSelector(selectInventory);
  const inventoryFilters: InventoryFilters = useSelector(selectInventoryFilters);
  
  const dispatch = useDispatch();
  let inventoryToUse = [...inventory.inventory];
  let collections = [...tradeUpData.collections] as any;

  inventoryToUse = inventoryToUse.filter(function (item) {
    if (!item.tradeUpConfirmed) {
      return false;
    }
    if (tradeUpData.MinFloat > (item.item_paint_wear ?? 0) || tradeUpData.MaxFloat < (item.item_paint_wear ?? 0)) {
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
        element.rarityColor ?? ''
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
    <Popover className="relative inline-block text-left">
      <PopoverButton
        className={classNames(
          'group inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-0 dark:focus-visible:ring-gray-400 rounded-sm',
          collections.length === 0 && 'pointer-events-none opacity-50'
        )}
      >
        <span>Collections</span>
        <span className="tabular-nums text-gray-500 dark:text-gray-400 font-medium">
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
                    className="ml-3 pr-6 text-sm font-medium text-gray-900 dark:text-gray-200 whitespace-nowrap"
                  >
                    {option.replace('The ', '').replace(' Collection', '')}
                  </label>
                </div>
              ))}
            </form>
          </PopoverPanel>
        </Transition>
    </Popover>
  );
}
