import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ItemRow, Prices } from 'renderer/interfaces/states.ts';
import { RootState } from '../rootReducer.ts';

const DEBUG_PRICING = process.env.DEBUG_PRICING === 'true';

/** When a run finishes in one batch (disk fast path, etc.), row keys may not match session keys — align done maps with Redux prices. */
function reconcileSessionSurfacesWithPrices(state: Prices) {
  const hasListing = (n: string) => {
    const p = state.prices[n];
    return !!(p && (p.steam_listing ?? 0) > 0);
  };
  const hasFail = (n: string) => !!state.seenFail[n];
  for (const n of Object.keys(state.sessionSurfaceKeysStorage)) {
    if (hasListing(n) || hasFail(n)) state.sessionSurfaceDoneStorage[n] = true;
  }
  for (const n of Object.keys(state.sessionSurfaceKeysInv)) {
    if (hasListing(n) || hasFail(n)) state.sessionSurfaceDoneInv[n] = true;
  }
}

const initialState: Prices = {
  prices: {},
  storageAmount: 0,
  productsRequested: [],
  isFetching: false,
  error: null,
  stats: { backupPct: '0' },
  fetchedCount: 0,
  totalItems: 0,
  activeSessionId: undefined,
  activeSessionScope: undefined,
  sessionSurfaceKeysStorage: {},
  sessionSurfaceKeysInv: {},
  sessionSurfaceDoneStorage: {},
  sessionSurfaceDoneInv: {},
  seenFresh: {},
  seenBackup: {},
  seenFail: {},
};

const pricingSlice = createSlice({
  name: 'pricing',
  initialState,
  reducers: {
    // Grand Total of all storage units
    pricingAddStorageTotal: (state, action: PayloadAction<{ storageAmount: number }>) => {
      state.storageAmount = state.storageAmount + action.payload.storageAmount;
    },
    pricingAddToRequested: (state, action: PayloadAction<{ itemRows: ItemRow[] }>) => {
      action.payload.itemRows.forEach(row => {
        const name = row.item_name.replaceAll('(Holo/Foil)', '(Holo-Foil)') + (row.item_wear_name ? ` (${row.item_wear_name})` : '');
        if (!state.productsRequested.includes(name)) {
          state.productsRequested.push(name);
        }
      });
      state.error = null;
      if (DEBUG_PRICING) {
        console.log('Added to requested:', action.payload.itemRows.length, 'items');
      }
    },
    pricingAddTo: (state, action: PayloadAction<{ rows: Array<{ item_name: string; item_wear_name?: string; pricing: { steam_listing: number; fromBackup: boolean }; failed?: { name: string; reason?: string } }> }>) => {
      action.payload.rows.forEach(item => {
        const name = item.item_name.replaceAll('(Holo/Foil)', '(Holo-Foil)') + (item.item_wear_name ? ` (${item.item_wear_name})` : '');
        const incoming = item.pricing.steam_listing || 0;
        const prevRow = state.prices[name];
        const prevListing = prevRow?.steam_listing ?? 0;
        const hasFailed = !!(item as { failed?: { name?: string } }).failed?.name;
        // While main is fetching, zeros are placeholders — do not apply them over a good listing.
        // After fetch, `!isFetching` used to allow any row through and late backup-shaped batches
        // could flip fresh → backup or clear prices; only apply when updating real outcome.
        const shouldApplyPrice = incoming > 0 || hasFailed || prevListing === 0;
        if (shouldApplyPrice) {
          const p = item.pricing as {
            fromBackup?: boolean;
            pricedAt?: number;
          };
          let fromBackup = p.fromBackup || false;
          const prevWasFresh = prevListing > 0 && prevRow && !prevRow.fromBackup;
          if (prevWasFresh && fromBackup && incoming > 0) {
            fromBackup = false;
          }
          const pricedAt =
            p.pricedAt ??
            (!fromBackup && incoming > 0 ? Date.now() : prevRow?.pricedAt);
          state.prices[name] = {
            steam_listing: incoming,
            fromBackup,
            ...(pricedAt != null ? { pricedAt } : {}),
          };
          if (incoming > 0) {
            // Resolved — don't keep stale "fail" badges next to "Pricing 100%".
            delete state.seenFail[name];
            if (fromBackup) state.seenBackup[name] = true;
            else state.seenFresh[name] = true;
          }
        }
        const sessionTerminal = (item.pricing.steam_listing || 0) > 0 || hasFailed;
        if (state.sessionSurfaceKeysStorage[name] && sessionTerminal) {
          state.sessionSurfaceDoneStorage[name] = true;
        }
        if (state.sessionSurfaceKeysInv[name] && sessionTerminal) {
          state.sessionSurfaceDoneInv[name] = true;
        }
      });
      if (DEBUG_PRICING) {
        console.log('Added prices for', action.payload.rows.length, 'items');
      }
    },
    pricingRecordFail: (state, action: PayloadAction<{ name: string; reason: string }>) => {
      if (!action.payload?.name) return;
      const name = action.payload.name;
      // Keep first failure reason (lifetime), avoid noisy overwrites.
      if (!state.seenFail[name]) {
        state.seenFail[name] = action.payload.reason || 'Unknown failure';
      }
      if (state.sessionSurfaceKeysStorage[name]) {
        state.sessionSurfaceDoneStorage[name] = true;
      }
      if (state.sessionSurfaceKeysInv[name]) {
        state.sessionSurfaceDoneInv[name] = true;
      }
    },
    pricingRemove: (state, action: PayloadAction<{ itemName: string }>) => {
      const removeCurrentPrices = { ...state.prices };
      if (removeCurrentPrices[action.payload.itemName]) {
        delete removeCurrentPrices[action.payload.itemName];
      }
      state.prices = removeCurrentPrices;
    },
    pricingStart: (
      state,
      action: PayloadAction<{
        total: number;
        sessionId?: string;
        scope?: 'total' | 'storage' | 'inv';
        invUniqueNames?: string[];
        storageUniqueNames?: string[];
        /**
         * After inventory pricing finished, loading storage must not reset session maps or
         * fetchedCount — only append work for new rows (see useAccountWidePricingRequest).
         */
        extendProgress?: boolean;
      }>
    ) => {
      const { total, sessionId, scope, invUniqueNames, storageUniqueNames, extendProgress } =
        action.payload;

      if (extendProgress) {
        state.isFetching = true;
        state.totalItems = (state.fetchedCount ?? 0) + total;
        if (sessionId) state.activeSessionId = sessionId;
        state.activeSessionScope = scope ?? 'total';
        for (const n of storageUniqueNames ?? []) {
          if (n) state.sessionSurfaceKeysStorage[n] = true;
        }
        for (const n of invUniqueNames ?? []) {
          if (n) state.sessionSurfaceKeysInv[n] = true;
        }
        if (DEBUG_PRICING) {
          console.log('Pricing extended (+', total, '), totalItems:', state.totalItems);
        }
      } else if (state.isFetching && state.totalItems > 0) {
        // If a pricing batch is already in-flight (e.g. storage units streamed in),
        // extend the total instead of resetting progress (prevents 0%↔100% jumps).
        state.totalItems += total;
        // Merging two different scopes (e.g. inv auto-run + storage load) inflates a single
        // runTotal; UI cards must treat that as a "total" session so Inventory/Storage don't
        // show fetched/total against the wrong denominator.
        const incoming = scope;
        const current = state.activeSessionScope;
        if (
          incoming &&
          current &&
          incoming !== current &&
          incoming !== 'total' &&
          current !== 'total'
        ) {
          state.activeSessionScope = 'total';
        }
        // Don't let a concurrent auto-session stomp the currently visible progress session.
        if (state.activeSessionId == null && sessionId) {
          state.activeSessionId = sessionId;
          state.activeSessionScope = scope;
        }
        // Per-card progress (Inventory vs Storage): union of unique names per surface for this session.
        for (const n of storageUniqueNames ?? []) {
          if (n) state.sessionSurfaceKeysStorage[n] = true;
        }
        for (const n of invUniqueNames ?? []) {
          if (n) state.sessionSurfaceKeysInv[n] = true;
        }
      } else {
        state.isFetching = true;
        state.totalItems = total;
        state.fetchedCount = 0;
        state.activeSessionId = sessionId;
        state.activeSessionScope = scope;
        state.sessionSurfaceKeysStorage = {};
        state.sessionSurfaceKeysInv = {};
        state.sessionSurfaceDoneStorage = {};
        state.sessionSurfaceDoneInv = {};
        // Per-card progress (Inventory vs Storage): union of unique names per surface for this session.
        for (const n of storageUniqueNames ?? []) {
          if (n) state.sessionSurfaceKeysStorage[n] = true;
        }
        for (const n of invUniqueNames ?? []) {
          if (n) state.sessionSurfaceKeysInv[n] = true;
        }
      }
      if (DEBUG_PRICING && !extendProgress) {
        console.log('Pricing started, total items:', state.totalItems);
      }
    },
    pricingResetProgress: (
      state,
      action: PayloadAction<{
        total: number;
        sessionId?: string;
        scope?: 'total' | 'storage' | 'inv';
        storageUniqueNames?: string[];
        invUniqueNames?: string[];
      }>
    ) => {
      state.isFetching = action.payload.total > 0;
      state.totalItems = action.payload.total;
      state.fetchedCount = 0;
      state.activeSessionId = action.payload.sessionId;
      state.activeSessionScope = action.payload.scope;
      state.sessionSurfaceKeysStorage = {};
      state.sessionSurfaceKeysInv = {};
      state.sessionSurfaceDoneStorage = {};
      state.sessionSurfaceDoneInv = {};
      for (const n of action.payload.storageUniqueNames ?? []) {
        if (n) state.sessionSurfaceKeysStorage[n] = true;
      }
      for (const n of action.payload.invUniqueNames ?? []) {
        if (n) state.sessionSurfaceKeysInv[n] = true;
      }
      if (DEBUG_PRICING) {
        console.log('Pricing progress reset, total items:', state.totalItems);
      }
    },
    pricingProgress: (state, action: PayloadAction<{ count: number }>) => {
      if (state.totalItems > 0) {
        state.fetchedCount = Math.min(
          state.totalItems,
          state.fetchedCount + action.payload.count
        );
        state.isFetching = state.fetchedCount < state.totalItems;
        if (!state.isFetching) reconcileSessionSurfacesWithPrices(state);
      } else {
        state.fetchedCount += action.payload.count;
      }
      if (DEBUG_PRICING) {
        console.log('Updated fetchedCount:', state.fetchedCount, 'of', state.totalItems);
      }
    },
    pricingError: (state, action: PayloadAction<string>) => {
      state.isFetching = false;
      state.error = action.payload;
      state.sessionSurfaceKeysStorage = {};
      state.sessionSurfaceKeysInv = {};
      state.sessionSurfaceDoneStorage = {};
      state.sessionSurfaceDoneInv = {};
    },
    pricingComplete: (state) => {
      state.isFetching = false;
      state.sessionSurfaceKeysStorage = {};
      state.sessionSurfaceKeysInv = {};
      state.sessionSurfaceDoneStorage = {};
      state.sessionSurfaceDoneInv = {};
      if (DEBUG_PRICING) {
        console.log('Pricing completed');
      }
    },
    pricingSyncFromStats: (
      state,
      action: PayloadAction<{ total?: number; fetched?: number; backupPct?: string }>
    ) => {
      if (action.payload.backupPct != null) state.stats = { backupPct: action.payload.backupPct };
      const incomingTotal = typeof action.payload.total === 'number' ? action.payload.total : undefined;
      const incomingFetched = typeof action.payload.fetched === 'number' ? action.payload.fetched : undefined;

      // Never let totals/progress move backwards (multiple pricing batches can overlap).
      if (incomingTotal != null) {
        state.totalItems = state.totalItems > 0 ? Math.max(state.totalItems, incomingTotal) : incomingTotal;
      }
      // `uniqueProcessed` from main is per IPC batch (chunk), not a running total — Math.max
      // across batches was wrong (e.g. 34 then 30 → stuck at 34) and left isFetching true forever.
      if (incomingFetched != null && incomingFetched > 0) {
        const next = state.fetchedCount + incomingFetched;
        state.fetchedCount =
          state.totalItems > 0 ? Math.min(state.totalItems, next) : next;
      }
      if (state.totalItems > 0) {
        state.fetchedCount = Math.min(state.totalItems, state.fetchedCount);
        state.isFetching = state.fetchedCount < state.totalItems;
        if (!state.isFetching) reconcileSessionSurfacesWithPrices(state);
      }
    },
    pricingClear: () => initialState,
    moveFromClear: (state) => {
      state.storageAmount = initialState.storageAmount;
    },
  },
});

export const {
  pricingAddStorageTotal,
  pricingAddTo,
  pricingAddToRequested,
  pricingRecordFail,
  pricingStart,
  pricingResetProgress,
  pricingProgress,
  pricingSyncFromStats,
  pricingRemove,
  pricingClear,
  moveFromClear,
  pricingError,
  pricingComplete,
} = pricingSlice.actions;

export const selectPricing = (state: RootState) => state.pricing;

export default pricingSlice.reducer;