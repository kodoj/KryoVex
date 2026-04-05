import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { btnIcon, btnText } from 'renderer/components/content/shared/buttonStyles.ts';
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import { tradeUpAddRemove, tradeUpClearSelection } from 'renderer/store/slices/tradeUp.ts';
import {
  getSteamEconomySrcSet,
  IMAGE_FALLBACK_DATA_URI,
} from '../../../functionsClasses/createCSGOImage.ts';
import { markImageError, useCs2Image } from 'renderer/hooks/useCs2Image.ts';
import PossibleOutcomes from './possibleOutcomes.tsx';
import { selectTradeUp } from 'renderer/store/slices/tradeUp.ts';

function CircleImg({ srcKey, title, idForHover, itemHover, setItemHover }: any) {
  const src = useCs2Image(srcKey, { fallback: IMAGE_FALLBACK_DATA_URI });
  const srcSet = useMemo(() => getSteamEconomySrcSet(src), [src]);
  return (
    <div
      className={classNames(
        'relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-dark-level-two/90 ring-1 ring-gray-700/40',
        itemHover === idForHover && 'ring-2 ring-amber-400/90'
      )}
      onMouseEnter={() => setItemHover(idForHover)}
      onMouseLeave={() => setItemHover('')}
    >
      <img
        className="h-full w-full origin-center scale-[1.22] object-contain object-center"
        title={title}
        src={src}
        srcSet={srcSet}
        sizes="44px"
        decoding="async"
        alt=""
        draggable={false}
        onError={(e) => {
          markImageError(srcKey);
          const img = e.currentTarget;
          img.onerror = null;
          img.src = IMAGE_FALLBACK_DATA_URI;
        }}
      />
    </div>
  );
}

export default function TradeUpSideBar() {
  const dispatch = useDispatch();
  const tradeUpData = useSelector(selectTradeUp);
  const [itemHover, setItemHover] = useState('');
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
  const selectedCount = tradeUpData.tradeUpProducts.length;

  return (
    <div className="min-w-0 antialiased">
      <div className="frost-sep-b border-b-0 px-2 py-2 dark:bg-dark-level-two sm:px-3">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Selected ({selectedCount}/10)
            </span>
            <button
              type="button"
              className={classNames(
                btnText,
                'max-w-full shrink-0 text-right leading-snug',
                selectedCount === 0 && 'pointer-events-none opacity-40'
              )}
              disabled={selectedCount === 0}
              onClick={() => dispatch(tradeUpClearSelection())}
              title="Remove every item from the contract slots"
            >
              Clear all slots
            </button>
          </div>
          <div
            className="grid w-full grid-cols-5 gap-x-1.5 gap-y-1.5 justify-items-center"
            aria-label="Trade-up item slots"
          >
            {productsToUse.map((projectRow, idx) => (
              <div className="flex shrink-0 justify-center" key={projectRow.item_id || `empty-${idx}`}>
                {projectRow.item_name == 'EMPTY' ? (
                  <div
                    className={classNames(
                      'h-11 w-11 shrink-0 rounded-full border border-dashed border-gray-400/80 dark:border-gray-500'
                    )}
                  />
                ) : (
                  <button
                    type="button"
                    title={`Remove from contract (float ${projectRow.item_paint_wear?.toString()?.substring(0, 9) ?? '—'})`}
                    className={classNames(btnIcon, 'border-transparent bg-transparent p-0 ring-0 shadow-none')}
                    onClick={() => dispatch(tradeUpAddRemove(projectRow))}
                  >
                    <CircleImg
                      srcKey={projectRow.item_url}
                      title={projectRow.item_paint_wear?.toString()?.substr(0, 9)}
                      idForHover={projectRow.item_id || `empty-${idx}`}
                      itemHover={itemHover}
                      setItemHover={setItemHover}
                    />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="min-w-0 px-2 py-2 sm:px-3">
        <PossibleOutcomes />
      </div>
    </div>
  );
}