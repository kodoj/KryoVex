import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import { selectTradeUp, tradeUpAddRemove } from 'renderer/store/slices/tradeUp.ts';
import { createCSGOImage } from '../../../functionsClasses/createCSGOImage.ts';
import PossibleOutcomes from './possibleOutcomes.tsx';

export default function TradeUpSideBar() {
  const tradeUpData = useSelector(selectTradeUp);
  const [itemHover, setItemHover] = useState('');
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

  return (
    <div>
      <div className="frost-sep-b items-center border-b-0 px-4 py-5 sm:px-6 dark:bg-dark-level-two">
        <div className="flex justify-center items-center">
          <div className="">
            <div className="flex items-center flex-nowrap">
              {productsToUse.map((projectRow) => (
                <div
                  className="flex shrink-0 -space-x-1"
                  key={projectRow.item_id}
                >
                  {projectRow.item_name == 'EMPTY' ? (
                    <div className={classNames(
                      'max-w-none h-8 w-8 rounded-full  object-cover border border-gray-300 border-dashed rounded-full'
                    )}/>
                  ) : (
                    <button
                      title={projectRow.item_paint_wear?.toString()?.substr(0, 9)}
                      onClick={() => dispatch(tradeUpAddRemove(projectRow))}
                    >
                      <img
                        onMouseEnter={() => setItemHover(projectRow.item_id)}
                        onMouseLeave={() => setItemHover('')}
                        className={classNames(
                          itemHover == projectRow.item_id
                            ? 'transform-gpu hover:-translate-y-1 hover:scale-110'
                            : '',
                          'max-w-none h-8 w-8 transition duration-500 ease-in-out  dark:from-gray-300 dark:to-gray-400 rounded-full ring-2 ring-transparent object-cover bg-linear-to-t from-gray-100 to-gray-300'
                        )}
                        src={
                          createCSGOImage(projectRow.item_url)
                        }
                      />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 py-5">
        <PossibleOutcomes />
      </div>
    </div>
  );
}
