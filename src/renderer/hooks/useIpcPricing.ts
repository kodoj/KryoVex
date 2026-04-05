// hooks/useIpcPricing.ts (new file—ESM friendly)
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { pricingAddTo, pricingSyncFromStats, pricingError, pricingRecordFail } from '../store/slices/pricing.ts';

const DEBUG_PRICING = process.env.DEBUG_PRICING === 'true';

export const useIpcPricing = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const ipcAny = window.electron.ipcRenderer as any;

    const listener = (message: any) => {
      if (DEBUG_PRICING) console.log('Pricing listener triggered');
      if (DEBUG_PRICING) console.log('Received pricing-result IPC:', message);
      if (!message || typeof message !== 'object' || !message.rows) {
        console.warn('Invalid pricing message:', message);
        dispatch(pricingError('Invalid pricing message'));
        return;
      }
      const { rows, stats } = message;
      if (!Array.isArray(rows)) {
        console.warn('Invalid pricing rows:', rows);
        dispatch(pricingError('Invalid pricing rows'));
        return;
      }
      const formattedRows = rows.map((item: any) => ({
        item_name: item.item_name,
        item_wear_name: item.item_wear_name,
        pricing: {
          steam_listing: item.pricing?.steam_listing || 0,
          fromBackup: item.pricing?.fromBackup || false,
          ...(item.pricing?.pricedAt != null ? { pricedAt: item.pricing.pricedAt } : {}),
        },
        failed: item.failed,
      }));
      dispatch(pricingAddTo({ rows: formattedRows }));
      // Record failures from the final result as well (progress events may be suppressed by session switching).
      for (const r of formattedRows as any[]) {
        if (r?.failed?.name) {
          dispatch(pricingRecordFail({ name: r.failed.name, reason: r.failed.reason }));
        }
      }
      const up = (message as { uniqueProcessed?: number }).uniqueProcessed;
      dispatch(
        pricingSyncFromStats({
          ...(stats || { backupPct: '0' }),
          ...(typeof up === 'number' && up > 0 ? { fetched: up } : {}),
        })
      );
      if (DEBUG_PRICING) {
        console.log('Pricing dispatched to Redux:', formattedRows.length, 'rows');
      }
    };

    //try-catch for proxy quirks
    try {
      if (DEBUG_PRICING) console.log('Setting up pricing-result listener');
      window.electron.ipcRenderer.on('pricing-result', listener);
    } catch (err) {
      console.error('Failed to attach pricing listener:', err);
    }

    return () => {
      try {
        if (typeof ipcAny.off === 'function') ipcAny.off('pricing-result', listener);
        else if (typeof ipcAny.removeListener === 'function')
          ipcAny.removeListener('pricing-result', listener);
        else if (typeof ipcAny.removeEventListener === 'function')
          ipcAny.removeEventListener('pricing-result', listener);
      } catch (err) {
        console.warn('Cleanup failed for pricing listener:', err);
      }
    };
  }, []);
};