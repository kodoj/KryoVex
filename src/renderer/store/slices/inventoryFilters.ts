import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { InventoryFilters, Filter, ItemRow } from 'renderer/interfaces/states.ts';
import { RootState } from '../rootReducer.ts';

const initialState: InventoryFilters = {
  inventoryFilter: [
    {
      include: true,
      label: 'Storage moveable',
      valueToCheck: 'item_moveable',
      commandType: 'checkBooleanVariable',
    },
  ],
  storageFilter: [],
  sortValue: 'Default',
  inventoryFiltered: [],
  storageFiltered: [],
  searchInput: '',
  sortBack: false,
  categoryFilter: [],
  rarityFilter: [],
};

const inventoryFiltersSlice = createSlice({
  name: 'inventoryFilters',
  initialState,
  reducers: {
    setFiltered: (
      state,
      action: PayloadAction<{
        inventoryFilter: Filter[];
        sortValue: string;
        inventoryFiltered: ItemRow[];
      }>
    ) => {
      state.inventoryFilter = action.payload.inventoryFilter;
      state.sortValue = action.payload.sortValue;
      state.inventoryFiltered = action.payload.inventoryFiltered;
    },
    setFilteredStorage: (
      state,
      action: PayloadAction<{
        storageFiltered: ItemRow[];
        storageFilter: Filter[];
      }>
    ) => {
      state.storageFiltered = action.payload.storageFiltered;
      state.storageFilter = action.payload.storageFilter;
    },
    allButClear: (
      state,
      action: PayloadAction<{
        inventoryFilter: Filter[];
        sortValue: string;
        inventoryFiltered: ItemRow[];
      }>
    ) => {
      if (state.sortValue === action.payload.sortValue) {
        state.inventoryFilter = action.payload.inventoryFilter;
        state.sortValue = action.payload.sortValue;
        state.inventoryFiltered = action.payload.inventoryFiltered;
        state.sortBack = !state.sortBack;
      } else {
        state.inventoryFilter = action.payload.inventoryFilter;
        state.sortValue = action.payload.sortValue;
        state.inventoryFiltered = action.payload.inventoryFiltered;
      }
    },
    inventoryStoragesClearCasket: (
      state,
      action: PayloadAction<{ casketID: string }>
    ) => {
      const addToFiltered = state.storageFiltered.filter(
        (id) => id.storage_id !== action.payload.casketID
      );
      state.storageFiltered = addToFiltered;
    },
    inventoryStoragesSetSortStorages: (
      state,
      action: PayloadAction<{ storageFiltered: ItemRow[] }>
    ) => {
      state.storageFiltered = action.payload.storageFiltered;
    },
    clearAll: () => initialState,
    moveFromClear: (state) => {
      state.categoryFilter = initialState.categoryFilter;
      state.storageFiltered = initialState.storageFiltered;
      state.storageFilter = initialState.storageFilter;
    },
    moveFromClearAll: (state) => {
      state.categoryFilter = initialState.categoryFilter;
      state.storageFiltered = initialState.storageFiltered;
      state.storageFilter = initialState.storageFilter;
    },
    moveToClearAll: (state) => {
      state.categoryFilter = initialState.categoryFilter;
      state.inventoryFilter = initialState.inventoryFilter;
    },
    inventoryAddCategoryFilter: (state, action: PayloadAction<string>) => {
      let newFilters = [...state.categoryFilter];
      if (newFilters.includes(action.payload)) {
        newFilters.splice(newFilters.indexOf(action.payload), 1);
      } else {
        newFilters = [...newFilters, action.payload];
      }
      state.categoryFilter = newFilters;
    },
    inventoryAddRarityFilter: (state, action: PayloadAction<string>) => {
      let newRarity = [...state.rarityFilter];
      if (newRarity.includes(action.payload)) {
        newRarity.splice(newRarity.indexOf(action.payload), 1);
      } else {
        newRarity = [...newRarity, action.payload];
      }
      state.rarityFilter = newRarity;
    },
    inventoryFiltersSetSearch: (
      state,
      action: PayloadAction<{ searchField: string }>
    ) => {
      state.searchInput = action.payload.searchField;
    },
    setSort: (state, action: PayloadAction<{ sortValue: string }>) => {
      if (state.sortValue === action.payload.sortValue) {
        state.sortBack = !state.sortBack;
      } else {
        state.sortValue = action.payload.sortValue;
        state.sortBack = initialState.sortBack;
      }
    }
  },
});

export const {
  setFiltered,
  setFilteredStorage,
  allButClear,
  inventoryStoragesClearCasket,
  inventoryStoragesSetSortStorages,
  clearAll,
  moveFromClear,
  moveFromClearAll,
  moveToClearAll,
  inventoryAddCategoryFilter,
  inventoryAddRarityFilter,
  inventoryFiltersSetSearch,
  setSort
} = inventoryFiltersSlice.actions;

export const selectInventoryFilters = (state: RootState) => state.inventoryFilters;

export default inventoryFiltersSlice.reducer;