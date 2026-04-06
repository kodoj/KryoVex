import { BanknotesIcon } from '@heroicons/react/24/solid';
import { useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import {
  getSteamEconomySrcSet,
  IMAGE_FALLBACK_DATA_URI,
} from 'renderer/functionsClasses/createCSGOImage.ts';
import { markImageError, useCs2Image } from 'renderer/hooks/useCs2Image.ts';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { pricingInventoryKey } from 'renderer/functionsClasses/prices.ts';
import { store } from 'renderer/store/configureStore.ts';
import { selectTradeUp, tradeUpSetPossible } from 'renderer/store/slices/tradeUp.ts';

const rarityShort = {
  'Factory New': 'FN',
  'Minimal Wear': 'MW',
  'Field-Tested': 'FT',
  'Well-Worn': 'WW',
  'Battle-Scarred': 'BS',
};

function OutcomeImg({
  srcKey,
  className,
  sizes,
}: {
  srcKey: string;
  className: string;
  sizes: string;
}) {
  const normalizedSrcKey = useMemo(() => {
    const raw = String(srcKey || '').trim();
    if (!raw) return '';
    // Legacy trade-up backup data often uses insecure media URLs.
    // Force HTTPS so Electron doesn't drop them as mixed/insecure content.
    if (raw.startsWith('http://')) return `https://${raw.slice('http://'.length)}`;
    return raw;
  }, [srcKey]);
  const src = useCs2Image(normalizedSrcKey, { fallback: IMAGE_FALLBACK_DATA_URI });
  const srcSet = useMemo(() => getSteamEconomySrcSet(src), [src]);
  return (
    <img
      className={className}
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      decoding="sync"
      alt=""
      draggable={false}
      onError={(e) => {
        markImageError(normalizedSrcKey);
        const img = e.currentTarget;
        img.onerror = null;
        img.src = IMAGE_FALLBACK_DATA_URI;
      }}
    />
  );
}

export default function PossibleOutcomes() {
  const pricesResult = useSelector(selectPricing);
  const tradeUpData = useSelector(selectTradeUp);
  const settingsData = useSelector(selectSettings);
  const inventory = useSelector(selectInventory);
  const dispatch = useDispatch();

  const inventoryImageByNameWear = useMemo(() => {
    const map = new Map<string, string>();
    const rows = [...(inventory.inventory || []), ...(inventory.storageInventoryRaw || [])] as any[];
    for (const row of rows) {
      const key = `${row?.item_name || ''}|${row?.item_wear_name || ''}`;
      if (!key || map.has(key)) continue;
      if (row?.item_url) map.set(key, row.item_url);
    }
    return map;
  }, [inventory.inventory, inventory.storageInventoryRaw]);

  const priceSource = settingsData?.source?.title ?? 'steam_listing';
  const currencyRate = settingsData.currencyPrice?.[settingsData.currency] ?? 1;

  const totalPrice = useMemo(() => {
    let total = 0;
    for (const element of tradeUpData.tradeUpProducts) {
      const row = pricesResult.prices[pricingInventoryKey(element)] as unknown as
        | Record<string, number>
        | undefined;
      const raw = row?.[priceSource] ?? row?.steam_listing;
      const n = typeof raw === 'number' && !Number.isNaN(raw) ? raw : 0;
      total += n * currencyRate;
    }
    return total;
  }, [tradeUpData.tradeUpProducts, pricesResult.prices, priceSource, currencyRate]);

  const outcomesSorted = useMemo(() => {
    const denom = totalPrice > 0 ? totalPrice : 1;
    return [...tradeUpData.possibleOutcomes]
      .map((element: any) => {
        const row = pricesResult.prices[pricingInventoryKey(element)] as unknown as
        | Record<string, number>
        | undefined;
        const raw = row?.[priceSource] ?? row?.steam_listing;
        const n = typeof raw === 'number' && !Number.isNaN(raw) ? raw : 0;
        const price = n * currencyRate;
        const profit_cal = (100 / denom) * price;
        return { ...element, profit_cal };
      })
      .sort((a: any, b: any) => (b.profit_cal ?? 0) - (a.profit_cal ?? 0));
  }, [tradeUpData.possibleOutcomes, pricesResult.prices, totalPrice, priceSource, currencyRate]);

  const lastOutcomesKeyRef = useRef<string>('');
  useEffect(() => {
    if (tradeUpData.tradeUpProducts.length === 0) {
      lastOutcomesKeyRef.current = '';
      return;
    }
    const key = tradeUpData.tradeUpProductsIDS.join('|');
    if (lastOutcomesKeyRef.current === key) return;
    window.electron.ipcRenderer
      .getPossibleOutcomes(tradeUpData.tradeUpProducts)
      .then((messageValue) => {
        const latest = store.getState().tradeUp.tradeUpProductsIDS.join('|');
        if (latest !== key) return;
        dispatch(tradeUpSetPossible(Array.isArray(messageValue) ? messageValue : []));
        lastOutcomesKeyRef.current = key;
      })
      .catch(() => {
        lastOutcomesKeyRef.current = '';
      });
  }, [dispatch, tradeUpData.tradeUpProducts, tradeUpData.tradeUpProductsIDS]);

  return (
    <div className="min-w-0">
      <h2 className="text-[10px] font-medium uppercase leading-normal tracking-wider text-gray-500 dark:text-gray-400 sm:text-xs">
        Possible outcomes
      </h2>
      {outcomesSorted.length != 0 ? (
        <ul
          role="list"
          className="mt-2 divide-y divide-gray-700/60 overflow-hidden rounded-lg border border-gray-700/90 bg-dark-level-three/70 text-xs sm:text-sm shadow-[0_4px_24px_rgba(0,0,0,0.35)] ring-1 ring-gray-900/80"
        >
          {outcomesSorted.map((project: any, index: number) => {
            const marketHash = `${project.item_name} (${project.item_wear_name})`.replaceAll(
              '(Holo/Foil)',
              '(Holo-Foil)'
            );
            const marketPath = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketHash)}`;
            const imgSrc =
              inventoryImageByNameWear.get(`${project.item_name || ''}|${project.item_wear_name || ''}`) ||
              project.image ||
              '';
            return (
              <li
                key={index}
                className="antialiased flex min-w-0 items-start gap-2 px-2 py-2 transition-colors hover:bg-dark-level-four/45 sm:px-2.5 sm:py-2.5"
              >
                <Link
                  to={{ pathname: marketPath }}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-dark-level-two/90 ring-1 ring-gray-700/40"
                  title={`View ${project.item_name} (${project.item_wear_name}) on Steam Community Market`}
                >
                  <OutcomeImg
                    className="h-full w-full origin-center scale-[1.22] object-contain object-center"
                    srcKey={imgSrc}
                    sizes="44px"
                  />
                </Link>
                <div className="min-w-0 flex-1 pt-px">
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="min-w-0 flex-1 break-words font-normal leading-snug text-zinc-100 sm:font-medium">
                      {project.item_name}
                    </span>
                    <span
                      className="inline-flex shrink-0 items-center gap-1 tabular-nums text-zinc-200"
                      title="Listed outcome price as percent of total selected input value"
                    >
                      <span
                        className={classNames(
                          project?.profit_cal > 100 ? 'bg-green-500' : 'bg-red-500',
                          'h-2 w-2 shrink-0 rounded-full'
                        )}
                        aria-hidden="true"
                      />
                      <BanknotesIcon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
                      <span className="text-xs font-medium sm:text-sm">
                        {new Intl.NumberFormat(settingsData.locale, {
                          style: 'decimal',
                          maximumFractionDigits: 2,
                        }).format(Number.isFinite(project?.profit_cal) ? project.profit_cal : 0)}{' '}
                        %
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 text-xs tabular-nums leading-snug text-gray-500 dark:text-gray-400">
                    {project.percentage}% ·{' '}
                    {rarityShort[project.item_wear_name as keyof typeof rarityShort] ?? project.item_wear_name} ·{' '}
                    {typeof project.float_chance === 'number' && Number.isFinite(project.float_chance)
                      ? project.float_chance.toFixed(6)
                      : String(project.float_chance ?? '').slice(0, 10)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div
          className="mt-2 rounded-lg border border-dashed border-gray-600/70 bg-dark-level-three/70 px-2.5 py-2.5 text-left shadow-[0_4px_24px_rgba(0,0,0,0.35)] ring-1 ring-gray-900/80 sm:px-3 sm:py-3"
          role="status"
        >
          <p className="text-sm font-medium leading-snug text-zinc-100">Select items to see possible outcomes</p>
          <p className="mt-1.5 text-xs leading-snug break-words text-gray-500 dark:text-gray-400">
            Percentages come from the trade-up sim. Dollar values use your pricing source ({priceSource}).
          </p>
        </div>
      )}
    </div>
  );
}
