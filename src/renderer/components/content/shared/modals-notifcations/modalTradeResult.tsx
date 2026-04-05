import { Fragment, useMemo } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { useDispatch, useSelector } from 'react-redux';
import { selectModalTrade, setTradeMoveResult } from 'renderer/store/slices/modalTrade.ts';
import { tradeUpResetPossible } from 'renderer/store/slices/tradeUp.ts';
import {
  getSteamEconomySrcSet,
  IMAGE_FALLBACK_DATA_URI,
} from 'renderer/functionsClasses/createCSGOImage.ts';
import { markImageError, useCs2Image } from 'renderer/hooks/useCs2Image.ts';
import { btnPrimary } from '../buttonStyles.ts';
import { classNames } from '../filters/inventoryFunctions.ts';

function ResultItemImage({ srcKey, prize }: { srcKey: string; prize?: boolean }) {
  const src = useCs2Image(srcKey, { fallback: IMAGE_FALLBACK_DATA_URI });
  const srcSet = useMemo(() => getSteamEconomySrcSet(src), [src]);
  return (
    <div
      className={classNames(
        'rounded-full p-1.5 sm:p-2',
        prize
          ? 'bg-linear-to-b from-amber-400/40 via-amber-500/15 to-transparent shadow-[0_0_48px_-10px_rgba(251,191,36,0.55)] dark:from-amber-400/30 dark:shadow-[0_0_56px_-8px_rgba(251,191,36,0.35)]'
          : 'bg-linear-to-b from-white/15 to-transparent shadow-2xl dark:from-white/10'
      )}
    >
      <img
        className={classNames(
          'max-w-none rounded-full bg-linear-to-t from-gray-100 to-gray-300 object-cover shadow-inner dark:from-gray-300 dark:to-gray-400',
          'h-36 w-36 sm:h-44 sm:w-44',
          prize
            ? 'ring-4 ring-amber-400/60 dark:ring-amber-400/45'
            : 'ring-4 ring-white/30 dark:ring-gray-500/40'
        )}
        src={src}
        srcSet={srcSet}
        sizes="(max-width:640px) 144px, 176px"
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

export default function TradeResultModal() {
  const dispatch = useDispatch();
  const modalData = useSelector(selectModalTrade);

  let devMode = false;

  async function setDone() {
    dispatch(setTradeMoveResult())
    dispatch(tradeUpResetPossible())
  }


  const row = modalData.rowToMatch;
  const isSimulated =
    row && typeof row === 'object' && 'item_id' in row && String((row as any).item_id).startsWith('simulated-');
  const imgKey = (() => {
    if (!row || typeof row !== 'object') return '';
    const r = row as Record<string, unknown>;
    const fromUrl = String(r.item_url ?? '').trim();
    const fromImage = String(r.image ?? '').trim();
    return fromUrl || fromImage || '';
  })();

  return (
    <Transition show={devMode ? true : modalData.openResult} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={() => dispatch(setTradeMoveResult())}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 bg-slate-900/35 backdrop-blur-md transition-opacity dark:bg-slate-950/45"
            aria-hidden="true"
          />
        </TransitionChild>

        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <DialogPanel className="relative w-full max-w-lg transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all dark:bg-dark-level-two sm:my-8 sm:p-6">
                <div className="flex flex-col items-center">
                  {imgKey ? <ResultItemImage srcKey={imgKey} prize={Boolean(isSimulated)} /> : null}
                  <div className="mt-5 text-center sm:mt-6">
                    <DialogTitle
                      as="h3"
                      className="text-lg font-medium leading-6 text-gray-900 dark:text-dark-white"
                    >
                      {row && 'item_name' in row ? (row as any).item_name : ''}
                    </DialogTitle>
                    {row && 'item_wear_name' in row && (row as any).item_wear_name ? (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {(row as any).item_wear_name}
                      </p>
                    ) : null}
                    <div className="mt-2 text-lg text-gray-400 dark:text-gray-400">
                      {isSimulated ? 'Simulated trade-up outcome' : 'Trade Up Contract Reward'}
                    </div>
                    {isSimulated ? (
                      <p className="mt-2 text-xs leading-snug text-gray-500 dark:text-gray-500">
                        Rolled from your possible outcomes using each skin&apos;s listed chance. Nothing was
                        spent and your inventory is unchanged.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 sm:mt-6">
                  <button
                    type="button"
                    className={classNames(btnPrimary, 'mt-3 w-full px-4 py-2 sm:mt-0 sm:text-sm')}
                    onClick={() => setDone()}
                  >
                    Done
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
