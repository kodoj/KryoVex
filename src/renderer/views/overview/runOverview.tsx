import { Fragment, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, Transition, TransitionChild } from '@headlessui/react';
import {
  ArchiveBoxIcon,
  RectangleStackIcon,
  CircleStackIcon,
  ArrowDownTrayIcon,
  PresentationChartBarIcon,
  PresentationChartLineIcon,
  TagIcon,
} from '@heroicons/react/24/solid';
import { useDispatch, useSelector } from 'react-redux';
import { ConvertPrices } from 'renderer/functionsClasses/prices.ts';
import { downloadReport } from 'renderer/functionsClasses/downloadReport.tsx';
import { LoadButton } from 'renderer/components/content/loadStorageUnitsButton.tsx';
import ListBoxOptions from './overviewOptionsDropdown.tsx';
import { OverviewLeftCharts, OverviewRightCharts, OverviewBy } from 'renderer/variables/overviewOptions.tsx';
import RightGraph from './rightGraph.tsx';
import LeftGraph from './leftGraph.tsx';
import UniqueItemsSummaryCard from './UniqueItemsSummaryCard.tsx';
import { selectAuth } from 'renderer/store/slices/auth.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { btnPrimary } from 'renderer/components/content/shared/buttonStyles.ts';
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import { pricingAddToRequested, pricingResetProgress } from 'renderer/store/slices/pricing.ts';

export default function Content() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const userDetails = useSelector(selectAuth);
  const settingsData = useSelector(selectSettings);
  const inventory = useSelector(selectInventory);
  const pricingData = useSelector(selectPricing);
  const isLoading = pricingData.isFetching;

  const dispatch = useDispatch();

  // Sticky progress so it doesn't disappear instantly.
  const [showProgress, setShowProgress] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const [manualProgressUntil, setManualProgressUntil] = useState<number>(0);
  const [manualProgressScope, setManualProgressScope] = useState<'total' | 'storage' | 'inv' | null>(null);

  useEffect(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (isLoading) {
      setShowProgress(true);
      return;
    }
    // Keep last progress visible briefly after completion.
    if (pricingData.totalItems > 0 && pricingData.fetchedCount >= pricingData.totalItems) {
      setShowProgress(true);
      hideTimerRef.current = window.setTimeout(() => setShowProgress(false), 4000);
      return;
    }
    setShowProgress(false);
  }, [isLoading, pricingData.fetchedCount, pricingData.totalItems]);

  // If a manual refresh session is active, stop it as soon as pricing completes.
  useEffect(() => {
    if (manualProgressScope && !pricingData.isFetching) {
      setManualProgressUntil(0);
      setManualProgressScope(null);
    }
  }, [manualProgressScope, pricingData.isFetching]);

  let hr = new Date().getHours();
  let goodMessage: string = 'Good Evening';
  if (hr >= 4 && hr < 12) {
    goodMessage = 'Good morning';
  } else if (hr == 12) {
    goodMessage = 'Good day';
  } else if (hr >= 12 && hr <= 17) {
    goodMessage = 'Good afternoon';
  } else if (hr >= 0 && hr <= 3) {
    goodMessage = 'Wassup';
  }

  const PricingClass = useMemo(() => new ConvertPrices(settingsData, pricingData), [settingsData, pricingData]);

  const buildUniqueMoveableRows = useCallback((rows: any[]) => {
    const uniques = new Map<string, any>();
    for (const row of rows ?? []) {
      if (row?.item_moveable !== true || !row?.item_name) continue;
      const name = PricingClass._getName(row);
      if (!uniques.has(name)) uniques.set(name, row);
    }
    return Array.from(uniques.values());
  }, [PricingClass]);

  const forceRefreshPrices = useCallback(
    (scope: 'total' | 'storage' | 'inv', rows: any[]) => {
      try {
        const toSend = buildUniqueMoveableRows(rows);
        if (toSend.length > 0) {
          const sessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          let storageUniqueNames: string[] | undefined;
          let invUniqueNames: string[] | undefined;
          if (scope === 'total') {
            // Session keys must use the same canonical names as the batch sent to getPrice.
            const batchCanonical = [...new Set(toSend.map((r) => PricingClass._getName(r)))];
            const nameAppearsOnSurface = (surfaceRows: any[], name: string) =>
              (surfaceRows ?? []).some(
                (row) => row?.item_moveable === true && PricingClass._getName(row) === name
              );
            storageUniqueNames = batchCanonical.filter((n) =>
              nameAppearsOnSurface(inventory.storageInventory ?? [], n)
            );
            invUniqueNames = batchCanonical.filter((n) =>
              nameAppearsOnSurface(inventory.combinedInventory ?? [], n)
            );
          } else if (scope === 'storage') {
            storageUniqueNames = toSend.map((r) => PricingClass._getName(r));
          } else {
            invUniqueNames = toSend.map((r) => PricingClass._getName(r));
          }
          dispatch(
            pricingResetProgress({
              total: toSend.length,
              sessionId,
              scope,
              storageUniqueNames,
              invUniqueNames,
            })
          );
          dispatch(pricingAddToRequested({ itemRows: toSend }));
          window.electron.ipcRenderer.getPrice(toSend, { forceFresh: true, sessionId });
          // For a short window after manual refresh, show global progress counters
          // so the user sees the reset + live counting even if everything is cached.
          setManualProgressUntil(Date.now() + 8000);
          setManualProgressScope(scope);
        }
      } catch (err) {
        console.warn('Failed to force refresh prices:', err);
      }
    },
    [buildUniqueMoveableRows, dispatch, inventory.combinedInventory, inventory.storageInventory, PricingClass]
  );

  const storageUnitsItemsCount = useMemo(() => {
    const total = inventory.totalAccountItems ?? 0;
    const inv = inventory.inventory?.length ?? 0;
    // `totalAccountItems` counts inventory items + storage contents.
    // Storage contents ≈ total - inventory count.
    return Math.max(0, total - inv);
  }, [inventory.inventory?.length, inventory.totalAccountItems]);

  const {
    totalNeed,
    totalUnique,
    storageNeed,
    storageUnique,
    invNeed,
    invUnique,
  } = useMemo(() => {
    const getNeed = (rows: any[]) => {
      const uniques = new Set<string>();
      for (const el of rows ?? []) {
        if (el?.item_moveable === true) {
          uniques.add(PricingClass._getName(el));
        }
      }

      let missing = 0;

      uniques.forEach((name) => {
        const price = pricingData.prices[name];
        const hasAny = !!price && (price.steam_listing ?? 0) > 0;

        // "Missing" means no usable price value at all.
        if (!hasAny) missing++;
      });

      return { missing, unique: uniques.size };
    };

    const inv = getNeed(inventory.combinedInventory ?? []);
    const stor = getNeed(inventory.storageInventory ?? []);
    const total = getNeed([...(inventory.combinedInventory ?? []), ...(inventory.storageInventory ?? [])]);

    return {
      totalNeed: total.missing,
      totalUnique: total.unique,
      storageNeed: stor.missing,
      storageUnique: stor.unique,
      invNeed: inv.missing,
      invUnique: inv.unique,
    };
  }, [PricingClass, inventory.combinedInventory, inventory.storageInventory, pricingData.prices]);

  const totalPriced = Math.max(0, totalUnique - totalNeed);
  const storagePriced = Math.max(0, storageUnique - storageNeed);
  const invPriced = Math.max(0, invUnique - invNeed);

  const { totalFresh, totalBackup, storageFresh, storageBackup, invFresh, invBackup } = useMemo(() => {
    // Use current Redux price rows (fromBackup flag), not lifetime seen* maps — avoids backup === uniques
    // after a later fresh fetch, and matches the euro totals users expect.
    const countSeen = (rows: any[]) => {
      const uniques = new Set<string>();
      for (const el of rows ?? []) {
        if (el?.item_moveable === true) {
          uniques.add(PricingClass._getName(el));
        }
      }
      let fresh = 0;
      let backup = 0;
      uniques.forEach((name) => {
        const p = pricingData.prices[name];
        if (!p || (p.steam_listing ?? 0) <= 0) return;
        if (p.fromBackup) backup++;
        else fresh++;
      });
      return { fresh, backup };
    };

    const inv = countSeen(inventory.combinedInventory ?? []);
    const stor = countSeen(inventory.storageInventory ?? []);
    const total = countSeen([...(inventory.combinedInventory ?? []), ...(inventory.storageInventory ?? [])]);
    return {
      totalFresh: total.fresh,
      totalBackup: total.backup,
      storageFresh: stor.fresh,
      storageBackup: stor.backup,
      invFresh: inv.fresh,
      invBackup: inv.backup,
    };
  }, [PricingClass, inventory.combinedInventory, inventory.storageInventory, pricingData]);

  const { totalFails, totalFailTooltip, storageFails, storageFailTooltip, invFails, invFailTooltip } = useMemo(() => {
    const build = (rows: any[]) => {
      const uniques = new Set<string>();
      for (const el of rows ?? []) {
        if (el?.item_moveable === true) uniques.add(PricingClass._getName(el));
      }
      const entries: Array<{ name: string; reason: string }> = [];
      uniques.forEach((name) => {
        const reason = pricingData.seenFail?.[name];
        if (!reason) return;
        const p = pricingData.prices[name];
        const hasPrice = !!(p && (p.steam_listing ?? 0) > 0);
        // seenFail can linger from a prior attempt; only show as "fail" if still unpriced.
        if (!hasPrice) entries.push({ name, reason });
      });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      const lines = entries.slice(0, 10).map((e) => `${e.name}: ${e.reason}`);
      const more = entries.length > 10 ? `\n…and ${entries.length - 10} more` : '';
      return {
        count: entries.length,
        tooltip: entries.length ? `Failed to fetch some prices:\n${lines.join('\n')}${more}` : '',
      };
    };

    const inv = build(inventory.combinedInventory ?? []);
    const stor = build(inventory.storageInventory ?? []);
    const total = build([...(inventory.combinedInventory ?? []), ...(inventory.storageInventory ?? [])]);
    return {
      totalFails: total.count,
      totalFailTooltip: total.tooltip,
      storageFails: stor.count,
      storageFailTooltip: stor.tooltip,
      invFails: inv.count,
      invFailTooltip: inv.tooltip,
    };
  }, [PricingClass, inventory.combinedInventory, inventory.storageInventory, pricingData]);

  const rowsForFailedTotal = useMemo(
    () =>
      buildUniqueMoveableRows(
        [...(inventory.combinedInventory ?? []), ...(inventory.storageInventory ?? [])].filter((el) => {
          if (el?.item_moveable !== true) return false;
          const name = PricingClass._getName(el);
          const reason = pricingData.seenFail?.[name];
          const p = pricingData.prices[name];
          const hasPrice = !!(p && (p.steam_listing ?? 0) > 0);
          return !!reason && !hasPrice;
        })
      ),
    [
      buildUniqueMoveableRows,
      inventory.combinedInventory,
      inventory.storageInventory,
      pricingData.seenFail,
      pricingData.prices,
      PricingClass,
    ]
  );

  const rowsForFailedStorage = useMemo(
    () =>
      buildUniqueMoveableRows(
        (inventory.storageInventory ?? []).filter((el) => {
          if (el?.item_moveable !== true) return false;
          const name = PricingClass._getName(el);
          const reason = pricingData.seenFail?.[name];
          const p = pricingData.prices[name];
          const hasPrice = !!(p && (p.steam_listing ?? 0) > 0);
          return !!reason && !hasPrice;
        })
      ),
    [buildUniqueMoveableRows, inventory.storageInventory, pricingData.seenFail, pricingData.prices, PricingClass]
  );

  const rowsForFailedInv = useMemo(
    () =>
      buildUniqueMoveableRows(
        (inventory.combinedInventory ?? []).filter((el) => {
          if (el?.item_moveable !== true) return false;
          const name = PricingClass._getName(el);
          const reason = pricingData.seenFail?.[name];
          const p = pricingData.prices[name];
          const hasPrice = !!(p && (p.steam_listing ?? 0) > 0);
          return !!reason && !hasPrice;
        })
      ),
    [buildUniqueMoveableRows, inventory.combinedInventory, pricingData.seenFail, pricingData.prices, PricingClass]
  );

  const [pricingRetryTarget, setPricingRetryTarget] = useState<'total' | 'storage' | 'inv' | null>(null);
  useEffect(() => {
    if (!pricingData.isFetching) setPricingRetryTarget(null);
  }, [pricingData.isFetching]);

  // Rollup = usable price or terminal fail per surface (source of truth for "done" in the UI).
  const totalRollupComplete =
    totalUnique === 0 || totalPriced + totalFails >= totalUnique;
  const storageRollupComplete =
    storageUnique === 0 || storagePriced + storageFails >= storageUnique;
  const invRollupComplete = invUnique === 0 || invPriced + invFails >= invUnique;

  const showManualProgress =
    manualProgressUntil > Date.now() &&
    pricingData.totalItems > 0 &&
    pricingData.isFetching;
  const showManualProgressTotal = showManualProgress && manualProgressScope === 'total';
  // Only the card that started the refresh may use global fetchedCount/totalItems; mirroring Total
  // onto Storage/Inventory showed wrong fractions (e.g. 7/109 vs 77 / 35 uniques).
  const showManualProgressStorage =
    showManualProgress && manualProgressScope === 'storage';
  const showManualProgressInv =
    showManualProgress && manualProgressScope === 'inv';
  const manualPct = showManualProgress
    ? Math.min(100, Math.max(0, Math.round((pricingData.fetchedCount / pricingData.totalItems) * 100)))
    : 0;

  // When inv or storage still has gaps, cap Total by priced uniques on those surfaces (overlap-aware).
  const subSurfacesPricingIncomplete = invNeed > 0 || storageNeed > 0;
  const totalPricedForProgressLine =
    subSurfacesPricingIncomplete && totalUnique > 0
      ? Math.min(totalPriced, storagePriced + invPriced)
      : totalPriced;
  const totalPctForProgressLine =
    totalUnique > 0
      ? Math.min(100, Math.max(0, Math.round((totalPricedForProgressLine / totalUnique) * 100)))
      : 0;
  const storagePct =
    storageUnique > 0 ? Math.min(100, Math.max(0, Math.round((storagePriced / storageUnique) * 100))) : 0;
  const invPct =
    invUnique > 0 ? Math.min(100, Math.max(0, Math.round((invPriced / invUnique) * 100))) : 0;

  // "Run progress" reflects how many uniques have been processed in the current pricing run,
  // regardless of whether each result came from fresh or backup.
  const runTotal = pricingData.totalItems || 0;
  const runFetched = pricingData.fetchedCount || 0;
  const runPct = runTotal > 0 ? Math.min(100, Math.max(0, Math.round((runFetched / runTotal) * 100))) : 0;

  // Global runTotal can be inflated when multiple inv (or storage) batches merge in Redux; card
  // denominators must stay aligned with moveable uniques for that surface.
  const invRunDenom = invUnique > 0 ? invUnique : runTotal;
  const invRunNum =
    invRunDenom > 0 ? Math.min(runFetched, invRunDenom) : runFetched;
  const invRunPct =
    invRunDenom > 0 ? Math.min(100, Math.max(0, Math.round((invRunNum / invRunDenom) * 100))) : 0;

  const storageRunDenom = storageUnique > 0 ? storageUnique : runTotal;
  const storageRunNum =
    storageRunDenom > 0 ? Math.min(runFetched, storageRunDenom) : runFetched;
  const storageRunPct =
    storageRunDenom > 0
      ? Math.min(100, Math.max(0, Math.round((storageRunNum / storageRunDenom) * 100)))
      : 0;

  const runScope = pricingData.activeSessionScope;
  const isRunActiveTotal = pricingData.isFetching && runScope === 'total';
  // Total-wide pricing hits inventory + storage; sub-cards should spin too, but text stays per-card.
  const isRunActiveStorage =
    pricingData.isFetching && (runScope === 'storage' || runScope === 'total');
  const isRunActiveInv =
    pricingData.isFetching && (runScope === 'inv' || runScope === 'total');

  const storageSessionDenom = Object.keys(pricingData.sessionSurfaceKeysStorage ?? {}).length;
  const storageSessionNum = Object.keys(pricingData.sessionSurfaceDoneStorage ?? {}).length;
  const storageSessionPct =
    storageSessionDenom > 0
      ? Math.min(100, Math.max(0, Math.round((storageSessionNum / storageSessionDenom) * 100)))
      : 0;
  const invSessionDenom = Object.keys(pricingData.sessionSurfaceKeysInv ?? {}).length;
  const invSessionNum = Object.keys(pricingData.sessionSurfaceDoneInv ?? {}).length;
  const invSessionPct =
    invSessionDenom > 0
      ? Math.min(100, Math.max(0, Math.round((invSessionNum / invSessionDenom) * 100)))
      : 0;
  // Per-surface session maps: stop this card's "Pricing …" line + spinner when *this* surface's
  // session keys are all done — do not keep spinning until a merged `total` run finishes storage.
  const storageSurfaceSessionComplete =
    storageSessionDenom === 0 || storageSessionNum >= storageSessionDenom;
  const invSurfaceSessionComplete =
    invSessionDenom === 0 || invSessionNum >= invSessionDenom;
  const showStorageSessionPricingLine =
    storageSessionDenom > 0 &&
    pricingData.isFetching &&
    !storageSurfaceSessionComplete;
  const showInvSessionPricingLine =
    invSessionDenom > 0 && pricingData.isFetching && !invSurfaceSessionComplete;

  const storageBulkProg = inventory.storageBulkLoadProgress;
  const storageBulkLoadSpinning =
    storageBulkProg != null &&
    storageBulkProg.total > 0 &&
    storageBulkProg.done < storageBulkProg.total;

  // While only Storage or Inv is pricing (e.g. after "load storage units"), rollup totalPriced can
  // already be 100% from backup — show account-wide progress: uniques outside the active session
  // count only if already priced; uniques in the session count when session maps mark them done.
  const totalSessionBlend = useMemo(() => {
    const nameSet = new Set<string>();
    const invMoveableNames = new Set<string>();
    const storageMoveableNames = new Set<string>();
    for (const el of inventory.combinedInventory ?? []) {
      if (el?.item_moveable === true) {
        const n = PricingClass._getName(el);
        invMoveableNames.add(n);
        nameSet.add(n);
      }
    }
    for (const el of inventory.storageInventory ?? []) {
      if (el?.item_moveable === true) {
        const n = PricingClass._getName(el);
        storageMoveableNames.add(n);
        nameSet.add(n);
      }
    }
    const skS = pricingData.sessionSurfaceKeysStorage ?? {};
    const skI = pricingData.sessionSurfaceKeysInv ?? {};
    const doneS = pricingData.sessionSurfaceDoneStorage ?? {};
    const doneI = pricingData.sessionSurfaceDoneInv ?? {};
    const seenFail = pricingData.seenFail ?? {};
    const unionKeys = new Set([...Object.keys(skS), ...Object.keys(skI)]);
    const storagePricingActive =
      pricingData.isFetching &&
      pricingData.activeSessionScope === 'storage' &&
      Object.keys(skS).length > 0;
    let done = 0;
    for (const name of nameSet) {
      if (unionKeys.has(name)) {
        const priced = !!pricingData.prices[name] && (pricingData.prices[name].steam_listing ?? 0) > 0;
        if (seenFail[name] || doneS[name] || doneI[name]) {
          done++;
        } else if (priced) {
          const onInv = invMoveableNames.has(name);
          const onStor = storageMoveableNames.has(name);
          // During an active storage pricing session, do not treat overlap names as "storage done"
          // just because inventory already has a price — otherwise Total hits 100% while Storage
          // is still mid-run. Storage-only rows with a price still count; inv-only shortcut applies
          // when not in skS or when storage session is idle.
          const invOverlapShortcut =
            priced && invRollupComplete && onInv && !(storagePricingActive && skS[name]);
          const storageOk =
            !skS[name] ||
            storageRollupComplete ||
            (priced && onStor && !onInv) ||
            invOverlapShortcut;
          const storageInvShortcut =
            priced && storageRollupComplete && onStor && !(pricingData.isFetching && pricingData.activeSessionScope === 'inv' && skI[name]);
          const invOk =
            !skI[name] || invRollupComplete || storageInvShortcut;
          if (storageOk && invOk) done++;
        }
      } else {
        const price = pricingData.prices[name];
        const hasAny = !!price && (price.steam_listing ?? 0) > 0;
        if (hasAny || seenFail[name]) done++;
      }
    }
    const denom = nameSet.size;
    const pct =
      denom > 0 ? Math.min(100, Math.max(0, Math.round((done / denom) * 100))) : 0;
    return { done, denom, pct };
  }, [
    inventory.combinedInventory,
    inventory.storageInventory,
    PricingClass,
    pricingData.prices,
    pricingData.sessionSurfaceKeysStorage,
    pricingData.sessionSurfaceKeysInv,
    pricingData.sessionSurfaceDoneStorage,
    pricingData.sessionSurfaceDoneInv,
    pricingData.seenFail,
    storageRollupComplete,
    invRollupComplete,
    pricingData.isFetching,
    pricingData.activeSessionScope,
  ]);

  // Once Redux has a usable price (or terminal fail) for every unique on a surface, stop showing
  // live "run" counters — they track IPC progress and can lag behind pricing-result / backup fills.

  const showRunProgressTotal =
    // Only show combined run progress when the session is explicitly total-wide (manual refresh
    // or merged inv+storage batches — see pricing slice pricingStart).
    // While isFetching, keep IPC run line visible even if prior prices mean rollup looks "complete"
    // (avoids Total stuck at static % during force-refresh while old prices are still in Redux).
    showProgress &&
    runTotal > 0 &&
    runScope === 'total' &&
    (!totalRollupComplete || pricingData.isFetching);
  const showRunProgressStorage =
    // Don't use runTotal on Storage when scope is only "inv" (denominator would be wrong).
    showProgress &&
    runTotal > 0 &&
    runScope === 'storage' &&
    (!storageRollupComplete || pricingData.isFetching);
  const showRunProgressInv =
    showProgress &&
    runTotal > 0 &&
    runScope === 'inv' &&
    (!invRollupComplete || pricingData.isFetching);

  const showTotalSessionBlend =
    pricingData.isFetching &&
    (storageSessionDenom > 0 || invSessionDenom > 0) &&
    !showManualProgressTotal &&
    !showRunProgressTotal;

  const inventoryValue = useMemo(() => {
    let value = 0;
    for (const element of inventory.combinedInventory ?? []) {
      if (element?.item_moveable !== true) continue;
      const itemPrice = PricingClass.getPrice(element, true);
      if (!itemPrice) {
      } else {
        value += itemPrice * (element.combined_QTY || 1);
      }
    }
    return value;
  }, [inventory.combinedInventory, PricingClass, pricingData.prices]);

  const storageUnitsValue = useMemo(() => {
    let value = 0;
    for (const element of inventory.storageInventory ?? []) {
      if (element?.item_moveable !== true) continue;
      const itemPrice = PricingClass.getPrice(element, true);
      if (!itemPrice) {
      } else {
        value += itemPrice * (element.combined_QTY || 1);
      }
    }
    return value;
  }, [inventory.storageInventory, PricingClass, pricingData.prices]);

  // Rounding each card separately can make Storage + Inventory ≠ Total by €1; align to integer euros.
  const invValueRounded = Math.round(inventoryValue);
  const storValueRounded = Math.round(storageUnitsValue);
  const totalValueRounded = invValueRounded + storValueRounded;

  if (inventory.combinedInventory.length === 0 && inventory.storageInventory.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center py-16 min-h-[min(100dvh,28rem)] bg-dark-level-one">
        <p className="text-dark-white mb-4">No items loaded. Try refreshing inventory.</p>
        <button
          type="button"
          onClick={() => window.electron.ipcRenderer.refreshInventory()}
          className={classNames(btnPrimary, 'px-4 py-2')}
        >
          Refresh
        </button>
      </div>
    );
  }

  if (inventoryValue === 0 && storageUnitsValue === 0 && !isLoading) {
    return (
      <div className="flex flex-col justify-center items-center py-16 min-h-[min(100dvh,28rem)] bg-dark-level-one">
        <p className="text-dark-white mb-4">No prices loaded (API issues). Try refreshing.</p>
        <button
          type="button"
          onClick={() => window.electron.ipcRenderer.refreshInventory()}
          className={classNames(btnPrimary, 'px-4 py-2')}
        >
          Refresh
        </button>
        <div className="text-sm text-gray-500 mt-2">
          From cache: {pricingData.stats.backupPct}%
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full bg-dark-level-one">
        <Transition show={sidebarOpen} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-40 lg:hidden"
            onClose={setSidebarOpen}
          >
            <TransitionChild
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
            </TransitionChild>
            <div className="fixed inset-0 flex z-40">
              <TransitionChild
                as={Fragment}
                enter="transition ease-in-out duration-300 transform"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transition ease-in-out duration-300 transform"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                {/* Sidebar content goes here if needed */}
              </TransitionChild>
              <div className="shrink-0 w-14" aria-hidden="true">
                {/* Dummy element to force sidebar to shrink to fit close icon */}
              </div>
            </div>
          </Dialog>
        </Transition>
        <div className="">
          <main className="w-full pb-4 sm:pb-6 lg:pb-8 bg-dark-level-one">
            <div className="frost-sep-b border-b-0 bg-dark-level-one shadow">
              <div className="px-2 sm:px-3 lg:max-w-6xl lg:mx-auto lg:px-4">
                <div className="py-4 md:flex md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center">
                      <img
                        className="hidden h-16 w-16 rounded-full sm:block"
                        src={userDetails.userProfilePicture as string}
                        alt=""
                      />
                      <div>
                        <div className="flex items-center">
                          <img
                            className="h-16 w-16 rounded-full sm:hidden"
                            src={userDetails.userProfilePicture as string}
                            alt=""
                          />
                          <h1 className="ml-3 text-2xl font-bold leading-7 tracking-tight text-zinc-100 antialiased sm:leading-9 sm:truncate">
                            {goodMessage}, {userDetails.displayName}.
                          </h1>
                        </div>
                        <dl className="mt-4 flex flex-col gap-2 sm:ml-3 sm:mt-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
                          <dd className="mt-2 text-sm font-medium text-dark-white sm:mt-0">
                            <ListBoxOptions
                              optionsObject={OverviewBy}
                              keyToUse="by"
                              Icon={TagIcon}
                            />
                          </dd>
                          <dd className="text-sm font-medium text-dark-white">
                            <ListBoxOptions
                              optionsObject={OverviewLeftCharts}
                              keyToUse="chartleft"
                              Icon={PresentationChartBarIcon}
                            />
                          </dd>
                          <dd className="text-sm font-medium text-dark-white sm:mr-1">
                            <ListBoxOptions
                              optionsObject={OverviewRightCharts}
                              keyToUse="chartRight"
                              Icon={PresentationChartLineIcon}
                            />
                          </dd>
                          <dt className="sr-only">Account status</dt>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col items-end gap-2 md:mt-0 md:ml-4">
                    <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => downloadReport(settingsData, pricingData, [...inventory.combinedInventory, ...inventory.storageInventory])}
                      className={classNames(btnPrimary, 'px-4 py-2')}
                    >
                      <ArrowDownTrayIcon
                        className="shrink-0 mr-1.5 h-5 w-5 text-kryo-ice-100"
                        aria-hidden="true"
                      />
                      Download all
                    </button>
                    <LoadButton />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 bg-dark-level-one">
              <div className="max-w-6xl mx-auto px-2 sm:px-3 lg:px-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                  <div key="all card" className="bg-dark-level-three overflow-hidden shadow">
                    <div className="p-3 sm:p-4">
                      <div className="flex items-center">
                        <div className="shrink-0">
                          <CircleStackIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-base font-semibold text-dark-white truncate">Total</dt>
                            <dd>
                              <div className="text-lg font-medium text-green-500">
                                {new Intl.NumberFormat(settingsData.locale, {
                                  style: 'currency',
                                  currency: settingsData.currency,
                                  maximumFractionDigits: 0,
                                }).format(totalValueRounded)}
                              </div>
                              <div className="text-sm text-gray-500 tabular-nums">
                                <div className="flex items-center whitespace-nowrap">
                                  / {new Intl.NumberFormat(settingsData.locale).format(inventory.totalAccountItems)} Items
                                  <span
                                    className="ml-2 text-gray-500"
                                    title="Each item name is counted once for the whole account. The same name can appear in both inventory and storage, so the two cards’ unique counts do not add up to this total."
                                  >
                                    ({totalUnique} uniques)
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap leading-tight">
                                  <span
                                    className={classNames(
                                      "inline-flex items-center min-w-[9rem]",
                                      "opacity-100"
                                    )}
                                  >
                                    <button
                                      type="button"
                                      className="inline-flex items-center"
                                      onClick={() => forceRefreshPrices('total', [...(inventory.combinedInventory ?? []), ...(inventory.storageInventory ?? [])])}
                                      title="Force refresh Total prices"
                                    >
                                      <ArrowPathIcon
                                        className={classNames(
                                          "h-4 w-4 text-gray-400 mr-1",
                                          pricingData.isFetching &&
                                            (showManualProgressTotal ||
                                              isRunActiveTotal ||
                                              showTotalSessionBlend)
                                            ? "animate-spin"
                                            : ""
                                        )}
                                      />
                                    </button>
                                    {showManualProgressTotal
                                      ? `Pricing ${manualPct}% (${pricingData.fetchedCount}/${pricingData.totalItems})`
                                      : showRunProgressTotal
                                        ? `Pricing ${runPct}% (${runFetched}/${runTotal})`
                                        : showTotalSessionBlend
                                          ? `Pricing ${totalSessionBlend.pct}% (${totalSessionBlend.done}/${totalSessionBlend.denom})`
                                          : `Pricing ${totalPctForProgressLine}% (${totalPricedForProgressLine}/${totalUnique})`}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center justify-start gap-x-2 gap-y-1 leading-tight">
                                  <span
                                    className={classNames(
                                      "whitespace-nowrap",
                                      totalFresh > 0 ? "opacity-100" : "opacity-60"
                                    )}
                                    title={`${totalFresh} fresh prices`}
                                  >
                                    (fresh {totalFresh})
                                  </span>
                                  <span
                                    className={classNames(
                                      "whitespace-nowrap",
                                      totalBackup > 0 ? "opacity-100" : "opacity-60"
                                    )}
                                    title={`${totalBackup} uniques currently priced from backup cache (deduped across inventory + storage).`}
                                  >
                                    (backup {totalBackup})
                                  </span>
                                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                    <span
                                      className={classNames(
                                        totalFails > 0 ? "opacity-100" : "opacity-60"
                                      )}
                                      title={totalFailTooltip}
                                    >
                                      (fails {totalFails})
                                    </span>
                                    <button
                                      type="button"
                                      className={classNames(
                                        'rounded p-0.5 text-gray-400 hover:text-dark-white focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-500',
                                        totalFails > 0 ? '' : 'hidden'
                                      )}
                                      title="Retry prices that failed to load"
                                      aria-label="Retry failed prices"
                                      onClick={() => {
                                        if (rowsForFailedTotal.length === 0) return;
                                        setPricingRetryTarget('total');
                                        forceRefreshPrices('total', rowsForFailedTotal);
                                      }}
                                    >
                                      <ArrowPathIcon
                                        className={classNames(
                                          'h-3.5 w-3.5',
                                          pricingRetryTarget === 'total' && pricingData.isFetching
                                            ? 'animate-spin'
                                            : ''
                                        )}
                                        aria-hidden
                                      />
                                    </button>
                                  </span>
                                </div>
                              </div>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div key="Storage Units" className="bg-dark-level-three overflow-hidden shadow">
                    <div className="p-3 sm:p-4">
                      <div className="flex items-center">
                        <div className="shrink-0">
                          <RectangleStackIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-base font-semibold text-dark-white truncate">Storage Units</dt>
                            <dd>
                              <div className="text-lg font-medium text-green-500">
                                {new Intl.NumberFormat(settingsData.locale, {
                                  style: 'currency',
                                  currency: settingsData.currency,
                                  maximumFractionDigits: 0,
                                }).format(storValueRounded)}
                              </div>
                              <div className="text-sm text-gray-500 tabular-nums">
                                <div className="flex items-center whitespace-nowrap">
                                  / {new Intl.NumberFormat(settingsData.locale).format(storageUnitsItemsCount)} Items
                                  <span className="ml-2 text-gray-500">({storageUnique} uniques)</span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap leading-tight">
                                  <span
                                    className={classNames(
                                      "inline-flex items-center min-w-[9rem]",
                                      "opacity-100"
                                    )}
                                  >
                                    <button
                                      type="button"
                                      className="inline-flex items-center"
                                      onClick={() => forceRefreshPrices('storage', inventory.storageInventory ?? [])}
                                      title="Force refresh Storage Unit prices"
                                    >
                                      <ArrowPathIcon
                                        className={classNames(
                                          "h-4 w-4 text-gray-400 mr-1",
                                          pricingData.isFetching &&
                                            (showManualProgressStorage ||
                                              (showManualProgress &&
                                                manualProgressScope === 'total' &&
                                                !storageSurfaceSessionComplete) ||
                                              (storageSessionDenom === 0 &&
                                                isRunActiveStorage &&
                                                !storageRollupComplete) ||
                                              showStorageSessionPricingLine) ||
                                            storageBulkLoadSpinning
                                            ? "animate-spin"
                                            : ""
                                        )}
                                      />
                                    </button>
                                    {showStorageSessionPricingLine
                                      ? `Pricing ${storageSessionPct}% (${storageSessionNum}/${storageSessionDenom})`
                                      : showManualProgressStorage
                                        ? `Pricing ${manualPct}% (${pricingData.fetchedCount}/${pricingData.totalItems})`
                                        : showRunProgressStorage
                                          ? `Pricing ${storageRunPct}% (${storageRunNum}/${storageRunDenom})`
                                          : `Pricing ${storagePct}% (${storagePriced}/${storageUnique})`}
                                  </span>
                                </div>
                                {storageBulkLoadSpinning && storageBulkProg ? (
                                  <div className="mt-0.5 text-xs text-amber-200/90 tabular-nums">
                                    Reading caskets {storageBulkProg.done}/{storageBulkProg.total}…
                                  </div>
                                ) : null}
                                <div className="mt-0.5 flex flex-wrap items-center justify-start gap-x-2 gap-y-1 leading-tight">
                                  <span
                                    className={classNames(
                                      "whitespace-nowrap",
                                      storageFresh > 0 ? "opacity-100" : "opacity-60"
                                    )}
                                    title={`${storageFresh} fresh prices`}
                                  >
                                    (fresh {storageFresh})
                                  </span>
                                  <span
                                    className={classNames(
                                      "whitespace-nowrap",
                                      storageBackup > 0 ? "opacity-100" : "opacity-60"
                                    )}
                                    title={`${storageBackup} priced from backup cache`}
                                  >
                                    (backup {storageBackup})
                                  </span>
                                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                    <span
                                      className={classNames(
                                        storageFails > 0 ? "opacity-100" : "opacity-60"
                                      )}
                                      title={storageFailTooltip}
                                    >
                                      (fails {storageFails})
                                    </span>
                                    <button
                                      type="button"
                                      className={classNames(
                                        'rounded p-0.5 text-gray-400 hover:text-dark-white focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-500',
                                        storageFails > 0 ? '' : 'hidden'
                                      )}
                                      title="Retry prices that failed to load"
                                      aria-label="Retry failed storage prices"
                                      onClick={() => {
                                        if (rowsForFailedStorage.length === 0) return;
                                        setPricingRetryTarget('storage');
                                        forceRefreshPrices('storage', rowsForFailedStorage);
                                      }}
                                    >
                                      <ArrowPathIcon
                                        className={classNames(
                                          'h-3.5 w-3.5',
                                          pricingRetryTarget === 'storage' && pricingData.isFetching
                                            ? 'animate-spin'
                                            : ''
                                        )}
                                        aria-hidden
                                      />
                                    </button>
                                  </span>
                                </div>
                              </div>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div key="Inventory items" className="bg-dark-level-three overflow-hidden shadow">
                    <div className="p-3 sm:p-4">
                      <div className="flex items-center">
                        <div className="shrink-0">
                          <ArchiveBoxIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-base font-semibold text-dark-white truncate">Inventory</dt>
                            <dd>
                              <div className="text-lg font-medium text-green-500">
                                {new Intl.NumberFormat(settingsData.locale, {
                                  style: 'currency',
                                  currency: settingsData.currency,
                                  maximumFractionDigits: 0,
                                }).format(invValueRounded)}
                              </div>
                              <div className="text-sm text-gray-500 tabular-nums">
                                <div className="flex items-center whitespace-nowrap">
                                  / {new Intl.NumberFormat(settingsData.locale).format(inventory.inventory.length)} Items
                                  <span className="ml-2 text-gray-500">({invUnique} uniques)</span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap leading-tight">
                                  <span
                                    className={classNames(
                                      "inline-flex items-center min-w-[9rem]",
                                      "opacity-100"
                                    )}
                                  >
                                    <button
                                      type="button"
                                      className="inline-flex items-center"
                                      onClick={() => forceRefreshPrices('inv', inventory.combinedInventory ?? [])}
                                      title="Force refresh Inventory prices"
                                    >
                                      <ArrowPathIcon
                                        className={classNames(
                                          "h-4 w-4 text-gray-400 mr-1",
                                          pricingData.isFetching &&
                                            (showManualProgressInv ||
                                              (showManualProgress &&
                                                manualProgressScope === 'total' &&
                                                !invSurfaceSessionComplete) ||
                                              (invSessionDenom === 0 &&
                                                isRunActiveInv &&
                                                !invRollupComplete) ||
                                              showInvSessionPricingLine)
                                            ? "animate-spin"
                                            : ""
                                        )}
                                      />
                                    </button>
                                    {showInvSessionPricingLine
                                      ? `Pricing ${invSessionPct}% (${invSessionNum}/${invSessionDenom})`
                                      : showManualProgressInv
                                        ? `Pricing ${manualPct}% (${pricingData.fetchedCount}/${pricingData.totalItems})`
                                        : showRunProgressInv
                                          ? `Pricing ${invRunPct}% (${invRunNum}/${invRunDenom})`
                                          : `Pricing ${invPct}% (${invPriced}/${invUnique})`}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center justify-start gap-x-2 gap-y-1 leading-tight">
                                  <span
                                    className={classNames(
                                      "whitespace-nowrap",
                                      invFresh > 0 ? "opacity-100" : "opacity-60"
                                    )}
                                    title={`${invFresh} fresh prices`}
                                  >
                                    (fresh {invFresh})
                                  </span>
                                  <span
                                    className={classNames(
                                      "whitespace-nowrap",
                                      invBackup > 0 ? "opacity-100" : "opacity-60"
                                    )}
                                    title={`${invBackup} priced from backup cache`}
                                  >
                                    (backup {invBackup})
                                  </span>
                                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                    <span
                                      className={classNames(
                                        invFails > 0 ? "opacity-100" : "opacity-60"
                                      )}
                                      title={invFailTooltip}
                                    >
                                      (fails {invFails})
                                    </span>
                                    <button
                                      type="button"
                                      className={classNames(
                                        'rounded p-0.5 text-gray-400 hover:text-dark-white focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-500',
                                        invFails > 0 ? '' : 'hidden'
                                      )}
                                      title="Retry prices that failed to load"
                                      aria-label="Retry failed inventory prices"
                                      onClick={() => {
                                        if (rowsForFailedInv.length === 0) return;
                                        setPricingRetryTarget('inv');
                                        forceRefreshPrices('inv', rowsForFailedInv);
                                      }}
                                    >
                                      <ArrowPathIcon
                                        className={classNames(
                                          'h-3.5 w-3.5',
                                          pricingRetryTarget === 'inv' && pricingData.isFetching
                                            ? 'animate-spin'
                                            : ''
                                        )}
                                        aria-hidden
                                      />
                                    </button>
                                  </span>
                                </div>
                              </div>
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="max-w-6xl mx-auto mt-2 px-2 sm:px-3 lg:px-4">
                  <div className="grid grid-cols-1 items-stretch gap-2 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:gap-3 lg:items-stretch">
                    <div className="flex min-h-[min(360px,42vh)] min-w-0 flex-col overflow-x-auto bg-dark-level-three p-2 shadow-sm ring-1 ring-gray-800/60 lg:min-h-[min(400px,48vh)]">
                      <LeftGraph />
                    </div>
                    <div className="flex min-h-[min(360px,42vh)] min-w-0 flex-col overflow-x-auto bg-dark-level-three p-2 shadow-sm ring-1 ring-gray-800/60 lg:min-h-[min(400px,48vh)]">
                      <RightGraph />
                    </div>
                  </div>
                </div>
              </div>
              <div className="max-w-6xl mx-auto mt-2 px-2 sm:px-3 lg:px-4">
                <UniqueItemsSummaryCard />
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}