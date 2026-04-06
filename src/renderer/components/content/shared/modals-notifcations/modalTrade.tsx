import { Fragment, useEffect, useState } from 'react';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { useDispatch, useSelector } from 'react-redux';
import { BeakerIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { classNames } from '../filters/inventoryFunctions.ts';
import { btnDefault, btnPrimary } from '../buttonStyles.ts';
import {
  selectModalTrade,
  setTradeConfirm,
  setTradeFoundMatch,
  setTradeMove,
} from 'renderer/store/slices/modalTrade.ts';
import { selectTradeUp, tradeUpAddRemove, tradeUpSetPossible } from 'renderer/store/slices/tradeUp.ts';
import { moveFromReset } from 'renderer/store/slices/moveFrom.ts';
import { ConvertPricesFormatted } from 'renderer/functionsClasses/prices.ts';
import {
  createCSGOImage,
  IMAGE_FALLBACK_DATA_URI,
} from 'renderer/functionsClasses/createCSGOImage.ts';
import { markImageError, useCs2Image } from 'renderer/hooks/useCs2Image.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectInventory } from 'renderer/store/slices/inventory.ts';

const rarityShort: Record<string, string> = {
  'Factory New': 'FN',
  'Minimal Wear': 'MW',
  'Field-Tested': 'FT',
  'Well-Worn': 'WW',
  'Battle-Scarred': 'BS',
};

function ReviewItemThumb({ srcKey }: { srcKey: string }) {
  const src = useCs2Image(srcKey, { fallback: IMAGE_FALLBACK_DATA_URI });
  return (
    <div className="relative z-10 h-12 w-12 shrink-0 overflow-hidden rounded-md bg-dark-level-three ring-1 ring-gray-700/50">
      <img
        src={src || IMAGE_FALLBACK_DATA_URI}
        alt=""
        className="h-full w-full scale-[1.12] object-contain object-center"
        draggable={false}
        onError={() => {
          if (srcKey) markImageError(srcKey);
        }}
      />
    </div>
  );
}

export default function TradeModal() {
  const tradeUpData = useSelector(selectTradeUp);
  const settingsData = useSelector(selectSettings);
  const modalData = useSelector(selectModalTrade);
  const pricesResult = useSelector(selectPricing);
  const inventory = useSelector(selectInventory);

  const pricesFormat = new ConvertPricesFormatted(settingsData, pricesResult);

  const dispatch = useDispatch();

  async function moveItemsFromStorage(): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    for (const element of tradeUpData.tradeUpProducts) {
      if (element.storage_id) {
        const pending = window.electron.ipcRenderer.moveFromStorageUnit(
          element.storage_id,
          element.item_id,
          false
        );
        if (pending && typeof (pending as Promise<unknown>).then === 'function') {
          tasks.push(pending as Promise<unknown>);
        }
      }
    }
    if (tasks.length > 0) {
      await Promise.all(tasks);
      dispatch(moveFromReset());
    }
  }

  let doTransferFirst = false;
  tradeUpData.tradeUpProducts.forEach((element) => {
    if (element.storage_id) {
      doTransferFirst = true;
    }
  });

  function pickSimulatedOutcome(
    outcomes: Array<Record<string, unknown>>
  ): Record<string, unknown> | null {
    if (!outcomes?.length) return null;
    const weights = outcomes.map((o) => parseFloat(String(o.percentage ?? 0)) || 0);
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) {
      return outcomes[Math.floor(Math.random() * outcomes.length)] ?? null;
    }
    let r = Math.random() * total;
    for (let i = 0; i < outcomes.length; i++) {
      r -= weights[i] ?? 0;
      if (r <= 0) return outcomes[i] ?? null;
    }
    return outcomes[outcomes.length - 1] ?? null;
  }

  async function confirmContract() {
    setConfirmError(null);
    const simulateOnly =
      (settingsData.tradeUpSimulateOnly ?? true) ||
      (typeof window.electron?.isTradeUpDryRun === 'function' &&
        window.electron.isTradeUpDryRun());

    if (simulateOnly) {
      let outcomes = (tradeUpData.possibleOutcomes ?? []) as unknown as Array<Record<string, unknown>>;
      if (!outcomes.length && tradeUpData.tradeUpProducts.length === 10) {
        try {
          const fetched = await window.electron.ipcRenderer.getPossibleOutcomes(
            tradeUpData.tradeUpProducts
          );
          outcomes = Array.isArray(fetched) ? fetched : [];
          dispatch(tradeUpSetPossible(outcomes as any));
        } catch {
          outcomes = [];
        }
      }
      const picked = pickSimulatedOutcome(outcomes);
      if (!picked) {
        setConfirmError(
          outcomes.length === 0
            ? 'No simulated outcomes yet — check that all items are supported trade-up inputs, or wait a moment and try again.'
            : 'Could not pick a simulated outcome. Try closing and reopening this dialog.'
        );
        return;
      }
      const img = String(picked.image ?? '');
      const matchRow = {
        item_id: `simulated-${Date.now()}`,
        item_name: String(picked.item_name ?? ''),
        item_wear_name: String(picked.item_wear_name ?? ''),
        item_url: img,
        image: img,
        item_paint_wear:
          typeof picked.float_chance === 'number'
            ? picked.float_chance
            : parseFloat(String(picked.float_chance ?? '')) || 0,
        item_moveable: true,
      };
      dispatch(setTradeMove());
      dispatch(setTradeFoundMatch({ matchRow: matchRow as any }));
      return;
    }

    const preTradeSnapshot = Array.from(
      new Set([
        ...inventory.inventory.map((i) => i.item_id),
        ...tradeUpData.tradeUpProductsIDS,
      ])
    );

    await moveItemsFromStorage();

    let rarityToUse = (tradeUpData.tradeUpProducts[0]?.rarity as number) - 1;
    if (tradeUpData.tradeUpProducts[0]?.stattrak) {
      rarityToUse += 10;
    }

    dispatch(setTradeConfirm({ inventory: preTradeSnapshot }));
    window.electron.ipcRenderer.tradeOrder(tradeUpData.tradeUpProductsIDS, rarityToUse);
    window.electron.ipcRenderer.refreshInventory();
  }

  const [activeHover, setActiveHover] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (!modalData.moveOpen) setConfirmError(null);
  }, [modalData.moveOpen]);

  async function handleOver(itemID: string) {
    if (activeHover != itemID) {
      setActiveHover(itemID);
    }
  }

  const canConfirm = tradeUpData.tradeUpProducts.length === 10;

  return (
    <Transition show={modalData.moveOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={() => dispatch(setTradeMove())}>
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
            className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm transition-opacity dark:bg-slate-950/60"
            aria-hidden="true"
          />
        </TransitionChild>

        <div className="fixed inset-0 z-[100] overflow-y-auto">
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
              <DialogPanel className="relative w-full max-w-lg transform overflow-hidden rounded-lg border border-gray-700/60 bg-dark-level-two px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:p-6">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-kryo-navy-900/80 ring-1 ring-kryo-ice-400/35">
                  <BeakerIcon className="h-6 w-6 text-kryo-ice-300" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-4">
                  <DialogTitle
                    as="h3"
                    className="text-lg font-semibold leading-6 text-zinc-100 antialiased"
                  >
                    Review trade-up contract
                  </DialogTitle>
                  <p className="mt-2 text-sm text-gray-400">
                    These items leave your inventory if you confirm. Prices shown use 7-day SCM
                    averages, not your pricing settings.
                  </p>
                </div>

                <ul
                  role="list"
                  className="mt-4 max-h-[min(50vh,360px)] space-y-2 overflow-y-auto rounded-md border border-gray-700/50 bg-dark-level-three/80 p-2"
                >
                  {tradeUpData.tradeUpProducts.map((project, index) => (
                    <li
                      key={project.item_id || `row-${index}`}
                      className="flex items-center gap-3 rounded-md border border-gray-700/40 bg-dark-level-two/90 px-2 py-2 text-left"
                    >
                      <div
                        className="relative shrink-0"
                        onMouseEnter={() => setActiveHover(project.item_id)}
                        onMouseLeave={() => setActiveHover('')}
                        onMouseOver={() => handleOver(project.item_id)}
                      >
                        {project.item_id === activeHover ? (
                          <button
                            type="button"
                            onClick={() => dispatch(tradeUpAddRemove(project))}
                            className="flex h-12 w-12 items-center justify-center rounded-md border border-red-500/40 bg-red-950/40 text-red-300"
                            title="Remove from contract"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        ) : (
                          <div className="relative flex h-12 w-12 items-center justify-center">
                            <ReviewItemThumb srcKey={project.item_url} />
                            {project.storage_name != null && project.storage_name !== '' ? (
                              <img
                                className="pointer-events-none absolute inset-0 z-0 h-full w-full scale-[1.12] object-contain opacity-45"
                                src={createCSGOImage('econ/tools/casket')}
                                alt=""
                              />
                            ) : null}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-dark-white">
                          {project.item_name} — {rarityShort[project.item_wear_name as string] ?? project.item_wear_name}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 text-xs text-gray-500">
                          <span>{pricesFormat.getFormattedPrice(project)}</span>
                          <span className="tabular-nums">
                            {project.item_paint_wear?.toString()?.substring(0, 9)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {confirmError ? (
                  <p className="mt-3 rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-100/95" role="alert">
                    {confirmError}
                  </p>
                ) : null}

                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                  {doTransferFirst ? (
                    <button
                      type="button"
                      disabled={!canConfirm}
                      className={classNames(
                        btnPrimary,
                        'w-full justify-center px-4 py-2 sm:col-start-2 sm:text-sm',
                        !canConfirm && 'pointer-events-none opacity-50'
                      )}
                      onClick={() => confirmContract()}
                    >
                      Transfer & confirm
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canConfirm}
                      className={classNames(
                        btnPrimary,
                        'w-full justify-center px-4 py-2 sm:col-start-2 sm:text-sm',
                        !canConfirm && 'pointer-events-none opacity-50'
                      )}
                      onClick={() => confirmContract()}
                    >
                      Confirm contract
                    </button>
                  )}

                  <button
                    type="button"
                    className={classNames(
                      btnDefault,
                      'mt-3 w-full justify-center px-4 py-2 sm:col-start-1 sm:mt-0 sm:text-sm'
                    )}
                    onClick={() => dispatch(setTradeMove())}
                  >
                    Cancel
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
