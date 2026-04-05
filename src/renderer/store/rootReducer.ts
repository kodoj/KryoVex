// src/renderer/store/rootReducer.ts (new file to break circular dependencies and define RootState)
import { combineReducers } from '@reduxjs/toolkit';

// Import all slice reducers (adjust paths; these are from your migrations)
import authReducer from './slices/auth.ts';
import inventoryReducer from './slices/inventory.ts';
import inventoryFiltersReducer from './slices/inventoryFilters.ts';
import modalMoveReducer from './slices/modalMove.ts';
import modalRenameReducer from './slices/modalRename.ts';
import moveFromReducer from './slices/moveFrom.ts';
import moveToReducer from './slices/moveTo.ts';
import settingsReducer from './slices/settings.ts';
import pricingReducer from './slices/pricing.ts';
import tradeUpReducer from './slices/tradeUp.ts';
import modalTradeReducer from './slices/modalTrade.ts';

export const rootReducer = {
  auth: authReducer,
  inventory: inventoryReducer,
  inventoryFilters: inventoryFiltersReducer,
  modalMove: modalMoveReducer,
  modalRename: modalRenameReducer,
  moveFrom: moveFromReducer,
  moveTo: moveToReducer,
  settings: settingsReducer,
  pricing: pricingReducer,
  tradeUp: tradeUpReducer,
  modalTrade: modalTradeReducer,
};

export const combinedRootReducer = combineReducers(rootReducer);

export type RootState = ReturnType<typeof combinedRootReducer>;