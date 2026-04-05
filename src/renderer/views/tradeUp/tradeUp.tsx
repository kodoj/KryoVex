import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  CheckCircleIcon,
  RectangleStackIcon,
  ScaleIcon,
  VariableIcon,
} from '@heroicons/react/24/solid';
import { useDispatch, useSelector } from 'react-redux';
import PricingAmount from 'renderer/components/content/shared/filters/pricingAmount.tsx';
import { btnPrimary } from 'renderer/components/content/shared/buttonStyles.ts';
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import TradeModal from 'renderer/components/content/shared/modals-notifcations/modalTrade.tsx';
import { setTradeMove } from 'renderer/store/slices/modalTrade.ts';
import TradeUpPicker from './inventoryPickers.tsx';
import TradeUpSideBar from './sidebar/sideBar.tsx';
import TradeUpFilters from './filter/tradeUpFilter.tsx';
import { ConvertPrices } from 'renderer/functionsClasses/prices.ts';
import { useMemo, useState } from 'react';
import { getAllStorages } from 'renderer/functionsClasses/storageUnits/storageUnitsFunctions.tsx';
import { LoadingButton } from 'renderer/components/content/shared/animations.tsx';
import { selectTradeUp } from 'renderer/store/slices/tradeUp.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectMoveFrom } from 'renderer/store/slices/moveFrom.ts';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectInventoryFilters } from 'renderer/store/slices/inventoryFilters.ts';

export default function settingsContent() {
  const tradeUpData = useSelector(selectTradeUp);
  const settingsData = useSelector(selectSettings);
  const pricingData = useSelector(selectPricing);
  const moveFrom = useSelector(selectMoveFrom);
  const inventory = useSelector(selectInventory);
  const inventoryFilters = useSelector(selectInventoryFilters);

  const dispatch = useDispatch();
  const PricingClass = useMemo(
    () => new ConvertPrices(settingsData, pricingData),
    [settingsData, pricingData]
  );
  const [getLoadingButton, setLoadingButton] = useState(false);
  async function getAllStor() {
    setLoadingButton(true)
    getAllStorages(dispatch, {
      inventory,
      moveFrom,
      settings: settingsData,
      pricing: pricingData,
      inventoryFilters,
    } as any).then(() => {
      setLoadingButton(false)
    })
  }

  const totals = useMemo(() => {
    const products = tradeUpData.tradeUpProducts;
    const outcomes = tradeUpData.possibleOutcomes as any[];

    let totalFloat = 0;
    let totalPrice = 0;
    for (const element of products) {
      const wear = Number(element.item_paint_wear);
      if (Number.isFinite(wear)) totalFloat += wear;
      const p = PricingClass.getPrice(element, true);
      totalPrice += Number.isFinite(p) ? p : 0;
    }
    totalFloat = products.length ? totalFloat / products.length : 0;

    let totalEV = 0;
    for (const element of outcomes) {
      const individualPrice = PricingClass.getPrice(element, true);
      const pct = Number(element.percentage) || 0;
      const piece = Number.isFinite(individualPrice) ? individualPrice : 0;
      totalEV += piece * (pct / 100);
    }

    return { totalFloat, totalPrice, totalEV };
  }, [PricingClass, tradeUpData.possibleOutcomes, tradeUpData.tradeUpProducts]);

  const formatCurrency = (n: number) =>
    Number.isFinite(n)
      ? new Intl.NumberFormat(settingsData.locale, {
          style: 'currency',
          currency: settingsData.currency,
        }).format(n)
      : '—';

  const formatDecimal = (n: number, suffix = '') =>
    Number.isFinite(n)
      ? new Intl.NumberFormat(settingsData.locale, {
          style: 'decimal',
          maximumFractionDigits: 2,
        }).format(n) + suffix
      : '—';

  const evPercent =
    totals.totalPrice > 0 && Number.isFinite(totals.totalEV)
      ? (100 / totals.totalPrice) * totals.totalEV
      : 0;

  const tradeUpSimulate =
    (settingsData.tradeUpSimulateOnly ?? true) ||
    (typeof window.electron?.isTradeUpDryRun === 'function' && window.electron.isTradeUpDryRun());

  return (
    <>
      <TradeModal />

      <div>
        {/* Page title & actions — chrome aligned with overview / unique table */}
        <div className="frost-sep-b border-b-0 px-2 py-2 sm:px-4 sm:py-3 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            <h1 className="shrink-0 text-lg font-semibold leading-6 text-zinc-100 antialiased sm:leading-7">
              Trade up contracts
            </h1>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:shrink-0 lg:justify-end">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-2 sm:gap-x-2">
                <PricingAmount
                  totalAmount={
                    Number.isFinite(totals.totalFloat)
                      ? totals.totalFloat.toString().substring(0, 9)
                      : '—'
                  }
                  IconToUse={VariableIcon}
                  colorOf={'text-gray-500'}
                  title="Average float of items currently in the trade-up contract"
                />
                <span
                  className="frost-sep-v-left relative hidden h-4 w-px shrink-0 sm:inline-block"
                  aria-hidden
                />
                <PricingAmount
                  totalAmount={formatCurrency(totals.totalPrice)}
                  IconToUse={ArrowUpCircleIcon}
                  colorOf={'text-red-500'}
                  title="Combined market value of selected inputs (your pricing source)"
                />
                <PricingAmount
                  totalAmount={formatCurrency(totals.totalEV)}
                  IconToUse={ArrowDownCircleIcon}
                  colorOf={'text-green-500'}
                  title="Probability-weighted expected value of outcomes (same pricing source)"
                />
                <PricingAmount
                  totalAmount={formatCurrency(-(totals.totalPrice - totals.totalEV))}
                  colorOf={'text-yellow-500'}
                  title="Expected value minus input cost (negative = expected loss)"
                />
                <PricingAmount
                  totalAmount={formatDecimal(evPercent, '  %')}
                  colorOf={'text-yellow-500'}
                  IconToUse={ScaleIcon}
                  title="Expected outcome value as a percent of input cost"
                />
              </div>
              <div className="frost-sep-t-sm-l flex flex-wrap items-center gap-2 border-0 pt-2 pl-0 sm:pl-3 sm:pt-0">
                <button
                  type="button"
                  onClick={() => getAllStor()}
                  className={classNames(btnPrimary, 'px-4 py-2')}
                  title="Load storage unit contents into this view so you can pick items for a contract"
                >
                  {moveFrom.activeStorages.length !== 0
                    ? `${moveFrom.activeStorages.length} Storage units loaded`
                    : 'Load storage units'}
                  {getLoadingButton ? (
                    <LoadingButton
                      className="ml-2 h-4 w-4 text-kryo-ice-100"
                      aria-hidden="true"
                    />
                  ) : (
                    <RectangleStackIcon className="ml-2 h-4 w-4 text-kryo-ice-100" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  disabled={tradeUpData.tradeUpProducts.length === 0}
                  onClick={() => dispatch(setTradeMove())}
                  className={classNames(
                    btnPrimary,
                    'px-4 py-2 disabled:pointer-events-none disabled:opacity-45'
                  )}
                  title="Open the trade-up review dialog (10 items required to confirm)"
                >
                  Edit & Review
                  <CheckCircleIcon className="ml-2 h-4 w-4 text-kryo-ice-100" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
          {tradeUpSimulate ? (
            <div className="mt-3 rounded-md border border-amber-500/35 bg-amber-950/40 px-3 py-2 dark:bg-amber-950/25">
              <p className="text-[11px] leading-snug text-amber-100/95 sm:text-xs">
                <span className="font-semibold text-amber-200">Practice mode.</span>{' '}
                Confirming a contract does not move items or submit a trade-up to CS2. Turn off
                &quot;Simulate trade-ups only&quot; in Settings when you want a real contract.
              </p>
            </div>
          ) : null}
        </div>

        {/* Content area */}

        <div className="">
          <div
            className={classNames(
              settingsData.os != 'win32'
                ? 'h-screen-tradeup'
                : 'h-screen-tradeup-windows',
              'relative z-0 flex h-screen-fixed flex-1 flex-col lg:flex-row'
            )}
          >
            <aside className="frost-aside-edge order-1 flex min-h-0 w-full min-w-0 shrink-0 flex-col overflow-x-hidden overflow-y-auto border-0 bg-dark-level-one lg:order-2 lg:min-w-[19rem] lg:w-[21rem] xl:min-w-[20rem] xl:w-[23rem]">
              <div className="min-w-0 flex-1">
                <TradeUpSideBar />
              </div>
            </aside>
            <main className="order-2 min-h-0 min-w-0 flex-1 overflow-y-auto lg:order-1">
              <div className="inset-0">
                <TradeUpFilters />
                <TradeUpPicker />
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}