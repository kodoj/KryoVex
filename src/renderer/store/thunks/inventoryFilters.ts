// src/renderer/store/slices/filtersInventoryThunks.ts
import { createAsyncThunk } from '@reduxjs/toolkit';
import { isEqual } from 'lodash';
import { sortDataFunction } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import { filterItemRows } from 'renderer/functionsClasses/filters/custom.ts';
import { Filter } from 'renderer/interfaces/filters.ts';
import { RootState } from '../rootReducer.ts';
import { setFilteredStorage, setFiltered, allButClear } from '../slices/inventoryFilters.ts';

// Thunk for storageInventoryAddOption
export const storageInventoryAddOption = createAsyncThunk(
  'inventoryFilters/storageInventoryAddOption',
  async (newFilter: Filter, { dispatch, getState }) => {
    const state = getState() as RootState;
    let newFilterState: Filter[] = [];
    let wasSeen: boolean = false;
    state.inventoryFilters.storageFilter.forEach(element => {
      if (!isEqual(element, newFilter)) {
        newFilterState.push(element);
      } else {
        wasSeen = true;
      }
    });
    if (!wasSeen) {
      newFilterState.push(newFilter);
    }
    let filteredStorage = await filterItemRows(state.inventory.storageInventory, newFilterState);
    filteredStorage = await sortDataFunction(state.moveFrom.sortValue, filteredStorage, state.pricing.prices, state.settings?.source?.title);
    dispatch(setFilteredStorage({
      storageFiltered: filteredStorage,
      storageFilter: newFilterState
    }));
    return filteredStorage;
  }
);

// Thunk for filterInventoryAddOption
export const filterInventoryAddOption = createAsyncThunk(
  'inventoryFilters/filterInventoryAddOption',
  async (newFilter: Filter, { dispatch, getState }) => {
    const state = getState() as RootState;
    let newFilterState: Filter[] = [];
    let wasSeen: boolean = false;
    state.inventoryFilters.inventoryFilter.forEach(element => {
      if (!isEqual(element, newFilter)) {
        newFilterState.push(element);
      } else {
        wasSeen = true;
      }
    });
    if (!wasSeen) {
      newFilterState.push(newFilter);
    }
    let filteredInv = await filterItemRows(state.inventory.combinedInventory, newFilterState);
    filteredInv = await sortDataFunction(state.inventoryFilters.sortValue, filteredInv, state.pricing.prices, state.settings?.source?.title);
    dispatch(setFiltered({
      inventoryFilter: newFilterState,
      sortValue: state.inventoryFilters.sortValue,
      inventoryFiltered: filteredInv
    }));
    return filteredInv;
  }
);

// Thunk for filterInventorySetSort
export const filterInventorySetSort = createAsyncThunk(
  'inventoryFilters/filterInventorySetSort',
  async (newSort: string, { dispatch, getState }) => {
    const state = getState() as RootState;
    let inventoryData = await sortDataFunction(newSort, state.inventory.inventory, state.pricing, state.settings?.source?.title);
    dispatch(allButClear({
      inventoryFilter: state.inventoryFilters.inventoryFilter,
      sortValue: newSort,
      inventoryFiltered: inventoryData
    }));
    return inventoryData;
  }
);