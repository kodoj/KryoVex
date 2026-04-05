// src/renderer/store/slices/modalTradeSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ItemRow, ModalTrade } from 'renderer/interfaces/states.ts';
import { RootState } from '../rootReducer.ts';

const initialState: ModalTrade = {
  moveOpen: false,
  openResult: false,
  inventoryFirst: [],
  rowToMatch: {}
};

const modalTradeSlice = createSlice({
  name: 'modalTrade',
  initialState,
  reducers: {
    setTradeMove: (state) => {
      state.moveOpen = !state.moveOpen;
    },
    setTradeConfirm: (state, action: PayloadAction<{ inventory: string[] }>) => {
      state.moveOpen = false;
      state.inventoryFirst = action.payload.inventory;
    },
    setTradeReset: () => initialState,
    setTradeFoundMatch: (state, action: PayloadAction<{ matchRow: ItemRow }>) => {
      state.openResult = true;
      state.inventoryFirst = initialState.inventoryFirst;
      state.rowToMatch = action.payload.matchRow;
    },
    setTradeMoveResult: (state) => {
      if (state.moveOpen === true) {
        state.moveOpen = false;
        state.openResult = !state.openResult;
      } else {
        state.openResult = !state.openResult;
      }
    },
    signOut: () => initialState,
  },
});

export const {
  setTradeMove,
  setTradeConfirm,
  setTradeReset,
  setTradeFoundMatch,
  setTradeMoveResult,
  signOut,
} = modalTradeSlice.actions;

export const selectModalTrade = (state: RootState) => state.modalTrade;

export default modalTradeSlice.reducer;