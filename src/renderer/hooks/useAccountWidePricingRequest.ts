import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RequestPrices } from 'renderer/functionsClasses/prices.ts';
import { selectAuth } from 'renderer/store/slices/auth.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { store } from 'renderer/store/configureStore.ts';
import type { RootState } from 'renderer/store/rootReducer.ts';
import { isAutoPricingEnabled } from 'renderer/pricing/autoPricing.ts';

/**
 * One place to queue Steam price lookups for the whole account (inventory + loaded storage).
 * Previously Overview only requested `inventory.inventory`, so storage never joined the same
 * session as the Total card and inv work could repeat whenever storage used a separate batch.
 */
export function useAccountWidePricingRequest() {
  const dispatch = useDispatch();
  const { isLoggedIn } = useSelector(selectAuth);
  const settingsData = useSelector(selectSettings);
  const pricingData = useSelector(selectPricing);
  const combinedLen = useSelector((s: RootState) => s.inventory.combinedInventory?.length ?? 0);
  const storLen = useSelector((s: RootState) => s.inventory.storageInventory?.length ?? 0);
  const bulkActive = useSelector((s: RootState) => s.inventory.storageBulkLoadActive ?? false);
  const lastKeyRef = useRef('');
  /** Previous storage row count — when it grows, only queue new storage work (see extendProgress). */
  const prevStorLenRef = useRef<number | null>(null);
  /** Tracks `storageBulkLoadActive` for the previous effect run (detect transition to idle). */
  const prevBulkRef = useRef(false);
  const pricingRef = useRef(pricingData);
  const settingsRef = useRef(settingsData);

  useEffect(() => {
    pricingRef.current = pricingData;
    settingsRef.current = settingsData;
  }, [pricingData, settingsData]);

  useEffect(() => {
    if (!isAutoPricingEnabled()) return;
    if (!isLoggedIn) {
      lastKeyRef.current = '';
      prevStorLenRef.current = null;
      prevBulkRef.current = false;
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isAutoPricingEnabled()) return;
    if (!isLoggedIn) return;

    const bulkJustEnded = prevBulkRef.current === true && bulkActive === false;
    prevBulkRef.current = bulkActive;

    // While bulk-loading all storage caskets, skip pricing so row counts (and progress %) don't thrash.
    if (bulkActive) return;

    const invLen = combinedLen;
    const prevStor = prevStorLenRef.current;

    const requestKey =
      `${settingsRef.current?.source?.title ?? ''}|${settingsRef.current?.currency ?? ''}|` +
      `${invLen}|${storLen}`;

    if (lastKeyRef.current === requestKey) return;

    // Do not start another `handleRequestArray` while pricing is still in flight: a new session id
    // would desync Redux from IPC progress, and incremental storage work must wait for a clean handoff.
    if (pricingRef.current.isFetching) {
      return;
    }

    lastKeyRef.current = requestKey;

    // Storage row count grew (e.g. units loaded after inventory). Do not require inv length to stay
    // equal — combinedInventory often refreshes in the same tick as storage and would defeat incremental mode.
    // After bulk load ends: same as incremental — only pass storage rows so missingOnly does not walk the
    // full inventory surface again (IPC stays on new/missing storage uniques). If we never had a baseline
    // storage count (prevStor === null), keep a full pass so inventory is not skipped.
    const storageIncremental =
      !bulkJustEnded && prevStor !== null && storLen > prevStor;
    const afterBulkStorageOnly = bulkJustEnded && prevStor !== null;
    const storageRowsOnly = storageIncremental || afterBulkStorageOnly;

    const invState = store.getState().inventory;
    const combined = invState.combinedInventory ?? [];
    const storageRows = invState.storageInventory ?? [];
    const rows = storageRowsOnly ? [...storageRows] : [...combined, ...storageRows];
    const scope: 'total' | 'storage' = storageRowsOnly ? 'storage' : 'total';
    if (rows.length === 0) {
      prevStorLenRef.current = storLen;
      return;
    }

    prevStorLenRef.current = storLen;

    const PricingRequest = new RequestPrices(
      dispatch,
      settingsRef.current,
      pricingRef.current
    );
    PricingRequest.handleRequestArray(rows, {
      scope,
      mode: 'missingOnly',
      ...(scope === 'total' ? { invSurfaceRows: combined } : {}),
      storageSurfaceRows: storageRows,
      extendProgress: storageRowsOnly,
    });
  }, [
    dispatch,
    isLoggedIn,
    settingsData?.source?.title,
    settingsData?.currency,
    combinedLen,
    storLen,
    bulkActive,
    pricingData.isFetching,
  ]);
}
