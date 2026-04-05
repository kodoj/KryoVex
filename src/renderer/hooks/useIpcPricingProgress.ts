import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { pricingAddTo, pricingRecordFail } from '../store/slices/pricing.ts';

// Define expected message shape for type safety
interface PricingProgressRowPayload {
  item_name: string;
  item_wear_name?: string;
  pricing: { steam_listing: number; fromBackup: boolean; pricedAt?: number };
  failed?: { name: string; reason: string };
}

interface PricingProgressMessage {
  count: number;
  /** Batched backup fills — one IPC chunk vs thousands of single-row events. */
  rows?: PricingProgressRowPayload[];
  row?: PricingProgressRowPayload;
  /** Duplicates row.failed for `pricingRecordFail` (`seenFail` / card fail counts). */
  failed?: { name: string; reason: string };
}

const DEBUG_PRICING = process.env.DEBUG_PRICING === 'true';

/**
 * Custom hook to listen for 'pricing-progress' IPC events from Electron main process.
 * Applies row prices/failures to Redux. Session `fetchedCount` / `isFetching` are driven only by
 * `pricing-result` → `pricingSyncFromStats(uniqueProcessed)` so chunked runs are not marked complete
 * after the first batch (per-row progress + per-batch result were double-counting).
 */
export const useIpcPricingProgress = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const ipcAny = window.electron.ipcRenderer as any;

    const progressListener = (message: unknown) => {
      if (DEBUG_PRICING) console.log('Received pricing-progress:', message);

      // Validate message shape
      if (message && typeof message === 'object' && 'count' in message) {
        const typedMessage = message as PricingProgressMessage;
        if (Array.isArray(typedMessage.rows) && typedMessage.rows.length > 0) {
          dispatch(pricingAddTo({ rows: typedMessage.rows as any }));
          for (const r of typedMessage.rows) {
            if (r?.failed?.name) {
              dispatch(
                pricingRecordFail({ name: r.failed.name, reason: r.failed.reason || 'Unknown failure' })
              );
            }
          }
        } else if (typedMessage.row && typedMessage.row.item_name) {
          dispatch(pricingAddTo({ rows: [typedMessage.row] as any }));
        }
        if (typedMessage.failed?.name) {
          dispatch(pricingRecordFail({ name: typedMessage.failed.name, reason: typedMessage.failed.reason }));
        }
      } else {
        console.warn('Invalid pricing-progress message:', message);
      }
    };

    try {
      if (DEBUG_PRICING) console.log('Setting up pricing-progress listener');
      window.electron.ipcRenderer.on('pricing-progress', progressListener);
    } catch (err) {
      console.error('Failed to attach pricing-progress listener:', err);
    }

    // Cleanup on unmount
    return () => {
      try {
        if (typeof ipcAny.off === 'function') ipcAny.off('pricing-progress', progressListener);
        else if (typeof ipcAny.removeListener === 'function')
          ipcAny.removeListener('pricing-progress', progressListener);
        else if (typeof ipcAny.removeEventListener === 'function')
          ipcAny.removeEventListener('pricing-progress', progressListener);
      } catch (err) {
        console.warn('Cleanup failed for pricing-progress listener:', err);
      }
    };
  }, [dispatch]);
};