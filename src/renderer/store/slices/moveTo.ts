import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MoveToReducer } from 'renderer/interfaces/states.tsx';
import { RootState } from '../rootReducer.ts';

const initialState: MoveToReducer = {
  doHide: false,
  hideFull: true,
  activeStorages: [],
  activeStoragesAmount: 0,
  totalToMove: [],
  totalItemsToMove: 0,
  searchInput: '',
  searchInputStorage: '',
  sortValue: 'Default',
  doCancel: false,
  sortBack: false,
};

const moveToSlice = createSlice({
  name: 'moveTo',
  initialState,
  reducers: {
    moveToSetHide: (state) => {
      state.doHide = !state.doHide;
    },
    moveToSetFull: (state) => {
      state.hideFull = !state.hideFull;
    },
    moveToAddTo: (state, action: PayloadAction<{ casketID: string; casketVolume?: number }>) => {
      let casketAlreadyExists = state.activeStorages.indexOf(action.payload.casketID) > -1;
      let chosenActiveCopy = [...state.activeStorages];
      let storageAmount = 0;
      if (casketAlreadyExists) {
        chosenActiveCopy = [];
      } else {
        chosenActiveCopy = [action.payload.casketID];
        storageAmount = action.payload.casketVolume || 0;
      }
      state.activeStorages = chosenActiveCopy;
      state.activeStoragesAmount = storageAmount;
    },
    moveToTotalToAdd: (
      state,
      action: PayloadAction<{ itemID: string; casketID: string; toMove: any[]; itemName: string }>
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
    setStorageAmount: (state, action: PayloadAction<{ storageAmount: number }>) => {
      state.activeStoragesAmount = action.payload.storageAmount;
    },
    moveToSetSearch: (state, action: PayloadAction<{ searchField: string }>) => {
      state.searchInput = action.payload.searchField;
    },
    moveToSetSearchStorage: (state, action: PayloadAction<{ searchField: string }>) => {
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
    moveToClearAll: (state) => {
      state.totalToMove = [];
      state.totalItemsToMove = 0;
      state.searchInput = '';
      state.sortValue = 'Default';
    },
    doCancel: (state, action: PayloadAction<{ doCancel: boolean }>) => {
      state.doCancel = action.payload.doCancel;
    },
  },
});

export const {
  moveToSetHide,
  moveToSetFull,
  moveToAddTo,
  moveToTotalToAdd,
  setStorageAmount,
  moveToSetSearch,
  moveToSetSearchStorage,
  setSort,
  moveToClearAll,
  doCancel,
} = moveToSlice.actions;

export const selectMoveTo = (state: RootState) => state.moveTo;

export default moveToSlice.reducer;