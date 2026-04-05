// src/renderer/store/slices/inventorySlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Inventory } from 'renderer/interfaces/states.ts';
import { RootState } from '../rootReducer.ts';
import { ItemRow, ItemRowStorage } from 'renderer/interfaces/items.ts';

const initialState: Inventory = {
  inventory: [],
  combinedInventory: [],
  storageInventory: [],
  storageInventoryRaw: [],
  totalAccountItems: 0,
  itemsLookUp: {},
  storageBulkLoadActive: false,
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setInventory: (state, action: PayloadAction<{ inventory: ItemRow[]; combinedInventory: ItemRow[] }>) => {
      let storageTotal = 0;
      action.payload.inventory.forEach(element => {
        storageTotal += 1;
        if (element.item_url === "econ/tools/casket") {
          storageTotal += element.item_storage_total || 0;
        }
      });
      state.inventory = action.payload.inventory;
      state.combinedInventory = action.payload.combinedInventory;
      state.totalAccountItems = storageTotal;
    },
    addStorageUnitsItems: (state, action: PayloadAction<{ casketID: string; storageData: ItemRowStorage[]; storageRowsRaw: ItemRowStorage[] }>) => {
      const add_to_filtered = state.storageInventory.filter(id => id.storage_id !== action.payload.casketID);
      const add_to_filtered_raw = state.storageInventoryRaw.filter(id => id.storage_id !== action.payload.casketID);
      action.payload.storageData.forEach(storageRow => add_to_filtered.push(storageRow));
      action.payload.storageRowsRaw.forEach(storageRow => add_to_filtered_raw.push(storageRow));
      state.storageInventory = add_to_filtered;
      state.storageInventoryRaw = add_to_filtered_raw;
    },
    clearStorageUnitItems: (state, action: PayloadAction<{ casketID: string }>) => {
      const AddToFiltered = state.storageInventory.filter(id => id.storage_id !== action.payload.casketID);
      const AddToFilteredRaw = state.storageInventoryRaw.filter(id => id.storage_id !== action.payload.casketID);
      state.storageInventory = AddToFiltered;
      state.storageInventoryRaw = AddToFilteredRaw;
    },
    setSortStorageUnits: (state, action: PayloadAction<{ storageData: ItemRowStorage[] }>) => {
      state.storageInventory = action.payload.storageData;
    },
    clearAllStorageUnits: (state) => {
      state.storageInventory = initialState.storageInventory;
      state.storageInventoryRaw = initialState.storageInventoryRaw;
    },
    setStorageBulkLoadActive: (state, action: PayloadAction<boolean>) => {
      state.storageBulkLoadActive = action.payload;
    },
    moveFromClear: () => {
      // No-op as per original; returns state unchanged
    },
    moveFromReset: (state) => {
      state.storageInventory = initialState.storageInventory;
      state.storageInventoryRaw = initialState.storageInventoryRaw;
    },
    signOut: () => initialState,
  },
});

export const {
  setInventory,
  addStorageUnitsItems,
  clearStorageUnitItems,
  setSortStorageUnits,
  clearAllStorageUnits,
  setStorageBulkLoadActive,
  moveFromClear,
  moveFromReset,
  signOut,
} = inventorySlice.actions;

export const selectInventory = (state: RootState) => state.inventory;

export default inventorySlice.reducer;