import { MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { useDispatch, useSelector } from 'react-redux';
import { selectTradeUp, tradeUpResetPossible, tradeUpSetMax, tradeUpSetMin, tradeUpSetSearch } from 'renderer/store/slices/tradeUp.ts';
import CollectionsDropDown from './collectionsDropdown.tsx';
import TradeUpOptionsDropDown from './optionsDropdown.tsx';
import { TradeUpActions } from 'renderer/interfaces/states.tsx';

export default function TradeUpFilters() {
  const tradeUpData: TradeUpActions = useSelector(selectTradeUp);
  const dispatch = useDispatch();

  let productsToUse = [...tradeUpData.tradeUpProducts];
  while (true) {
    if (productsToUse.length != 10) {
      productsToUse.push({
        item_name: 'EMPTY',
        storage_id: '',
        item_storage_total: 0,
        storage_name: '',
        item_customname: null,
        item_url: '',
        item_id: '',
        position: 0,
        item_wear_name: '',
        item_origin: 0,
        item_moveable: false,
        item_has_stickers: false,
        equipped_ct: false,
        equipped_t: false,
        def_index: 0,
        stickers: [],
        rarity: 0,
        rarityName: '',
        tradeUp: false,
        stattrak: false,
        tradeUpConfirmed: false,
        collection: '',
        combined_ids: [],
        combined_QTY: 0,
        bgColorClass: '',
        category: '',
        major: '',
        percentage: 0,
        profit_cal: 0,
        image: '',
        float_chance: 0
      });
    } else {
      break;
    }
  }
  async function updateMin(valueToSet) {
    if (valueToSet < tradeUpData.MaxFloat) {
      dispatch(tradeUpSetMin(valueToSet))
    }
  }
  async function updateMax(valueToSet) {
    if (valueToSet > tradeUpData.MinFloat) {
      dispatch(tradeUpSetMax(valueToSet))
    }
  }


  return (
  <div>
    <div className="frost-sep-b items-center border-b-0 py-5 dark:bg-dark-level-one">
      <div className="flex justify-between">
        <div className="max-w-7xl flex h-8 items-center space-x-6 divide-x divide-gray-200 text-sm px-4 sm:px-6 lg:px-8">
          <div className="">
            <button
              type="button"
              className="text-gray-500 dark:text-gray-400"
              onClick={() => dispatch(tradeUpResetPossible())}
            >
              Clear all
            </button>
          </div>
          <div className='pl-4 pr-2'>
              <TradeUpOptionsDropDown />
          </div>
          <div className='pl-4 pr-2'>
          <CollectionsDropDown />
          </div>
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
            value={tradeUpData.searchInput}
            className="block w-full pb-0.5  focus:outline-none dark:text-dark-white pl-9 sm:text-sm border-gray-300 h-7 dark:bg-dark-level-one dark:rounded-none dark:bg-dark-level-one"
            placeholder="Search items"
            spellCheck="false"
            onChange={(e) =>
              dispatch(tradeUpSetSearch({searchField: e.target.value}))
            }
          />
        </div>
        </div>
        <div className="flex ">
          <div className='ml-2 pl-2  border-gray-200 dark:border-gray-400'></div>
          <div className="hidden xl:block max-w-7xl h-8 items-center space-x-6 divide-x divide-gray-200 text-sm px-4 sm:px-6 lg:px-8">
            <div className="">
              <div className="flex items-center justify-end">
                <p className="text-gray-500 dark:text-gray-400 pr-3 truncate">{tradeUpData.MinFloat} min </p>
                <input type="range" min="0" max="1" value={tradeUpData.MinFloat} step="0.01" onChange={(e) => updateMin(e.target.value)} className=" dark:bg-dark-level-three h-2 dark:appearance-none" />
              </div>
              <div className="flex items-center justify-end">
                <p className="text-gray-500 dark:text-gray-400 pr-3 truncate">{tradeUpData.MaxFloat} max </p>
                <input type="range" min="0" max="1" value={tradeUpData.MaxFloat} step="0.01" onChange={(e) => updateMax(e.target.value)} className=" dark:bg-dark-level-three h-2 dark:appearance-none" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
