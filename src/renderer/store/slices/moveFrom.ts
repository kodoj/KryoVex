// src/renderer/store/slices/moveFromSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MoveFromReducer } from 'renderer/interfaces/states.ts';
import { RootState } from '../rootReducer.ts';

const initialState: MoveFromReducer = {
  hideFull: false,
  activeStorages: [],
  totalToMove: [],
  totalItemsToMove: 0,
  searchInput: '',
  searchInputStorage: '',
  sortValue: 'Default',
  doCancel: false,
  sortBack: false,
};

const moveFromSlice = createSlice({
  name: 'moveFrom',
  initialState,
  reducers: {
    moveFromSetFull: (state) => {
      state.hideFull = !state.hideFull;
    },
    moveFromSetSortBack: (state) => {
      state.sortBack = !state.sortBack;
    },
    moveFromClearAll: (state) => {
      state.totalToMove = [];
      state.totalItemsToMove = 0;
      state.searchInput = '';
      state.sortValue = 'Default';
    },
    moveFromReset: () => initialState,
    moveFromsetSearchField: (state, action: PayloadAction<{ searchField: string }>) => {
      state.searchInput = action.payload.searchField;
    },
    moveFromsetSearchFieldStorage: (state, action: PayloadAction<{ searchField: string }>) => {
      state.searchInputStorage = action.payload.searchField;
    },
    setSort: (state, action: PayloadAction<{ sortValue: string }>) => {
      if (state.sortValue === action.payload.sortValue) {
        state.sortBack = !state.sortBack;
      } else {
        state.sortValue = action.payload.sortValue;
        state.sortBack = initialState.sortBack;
      }
    },
    moveFromAddCasketToStorages: (state, action: PayloadAction<{ casketID: string }>) => {
      let casketAlreadyExists = state.activeStorages.indexOf(action.payload.casketID) > -1;
      let chosenActiveCopy = [...state.activeStorages];
      if (casketAlreadyExists) {
        chosenActiveCopy = chosenActiveCopy.filter(id => id !== action.payload.casketID);
      } else {
        chosenActiveCopy.push(action.payload.casketID);
      }
      state.activeStorages = chosenActiveCopy;
    },
    /** Append many casket ids (bulk load). Does not toggle — ids are unioned in order. */
    moveFromAppendCaskets: (state, action: PayloadAction<{ casketIDs: string[] }>) => {
      const next = new Set(state.activeStorages);
      for (const id of action.payload.casketIDs) next.add(id);
      state.activeStorages = [...next];
    },
    moveFromAddRemove: (
      state,
      action: PayloadAction<{ casketID: string; itemID: string; toMove: any[]; itemName: string }>
    ) => {
      const payloadToMove = Array.isArray(action.payload.toMove) ? action.payload.toMove : [];
      let toMoveAlreadyExists = state.totalToMove.filter(row => row[0] !== action.payload.itemID);
      if (payloadToMove.length > 0) {
        toMoveAlreadyExists.push([
          action.payload.itemID,
          action.payload.casketID,
          payloadToMove,
          action.payload.itemName,
        ]);
      }
      let newTotalItemsToMove = 0;
      toMoveAlreadyExists.forEach((element) => {
        newTotalItemsToMove += Array.isArray(element[2]) ? element[2].length : 0;
      });
      state.totalToMove = toMoveAlreadyExists;
      state.totalItemsToMove = newTotalItemsToMove;
    },
    moveFromRemoveCasket: (state, action: PayloadAction<{ casketID: string }>) => {
      let allCasketResults = state.totalToMove.filter(row => row[1] !== action.payload.casketID);
      let allCasketToRemoveTotal = 0;
      allCasketResults.forEach((element) => {
        allCasketToRemoveTotal += Array.isArray(element[2]) ? element[2].length : 0;
      });
      state.totalToMove = allCasketResults;
      state.totalItemsToMove = allCasketToRemoveTotal;
    },
    doCancel: (state, action: PayloadAction<{ doCancel: boolean }>) => {
      state.doCancel = action.payload.doCancel;
    }
  },
});

export const {
  moveFromSetFull,
  moveFromSetSortBack,
  moveFromClearAll,
  moveFromReset,
  moveFromsetSearchField,
  moveFromsetSearchFieldStorage,
  setSort,
  moveFromAddCasketToStorages,
  moveFromAppendCaskets,
  moveFromAddRemove,
  moveFromRemoveCasket,
  doCancel
} = moveFromSlice.actions;

export const selectMoveFrom = (state: RootState) => state.moveFrom;

export default moveFromSlice.reducer;