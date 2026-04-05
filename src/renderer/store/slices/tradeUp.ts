// src/renderer/store/slices/tradeUpSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TradeUpActions, ItemRowStorage } from 'renderer/interfaces/states.ts';
import { RootState } from '../rootReducer.ts';

const initialState: TradeUpActions = {
  tradeUpProducts: [],
  tradeUpProductsIDS: [],
  possibleOutcomes: [],
  searchInput: '',
  MinFloat: 0,
  MaxFloat: 1,
  collections: [],
  options: ["Hide equipped"],
};

const tradeUpSlice = createSlice({
  name: 'tradeUp',
  initialState,
  reducers: {
    tradeUpAddRemove: (state, action: PayloadAction<ItemRowStorage>) => {
      let toMoveAlreadyExists = state.tradeUpProducts.filter(row => row.item_id !== action.payload.item_id);
      if (toMoveAlreadyExists.length === state.tradeUpProducts.length) {
        toMoveAlreadyExists.push(action.payload);
      }
      let newTradeUpIDS: string[] = [];
      toMoveAlreadyExists.forEach(element => {
        newTradeUpIDS.push(element.item_id);
      });
      if (toMoveAlreadyExists.length !== 10) {
        state.tradeUpProducts = toMoveAlreadyExists;
        state.tradeUpProductsIDS = newTradeUpIDS;
        state.possibleOutcomes = initialState.possibleOutcomes;
      } else {
        state.tradeUpProducts = toMoveAlreadyExists;
        state.tradeUpProductsIDS = newTradeUpIDS;
      }
    },
    tradeUpSetPossible: (state, action: PayloadAction<any[]>) => {
      state.possibleOutcomes = action.payload;
    },
    tradeUpResetPossible: () => initialState,
    tradeUpSetSearch: (state, action: PayloadAction<{ searchField: string }>) => {
      state.searchInput = action.payload.searchField;
    },
    tradeUpSetMin: (state, action: PayloadAction<number>) => {
      state.MinFloat = action.payload;
    },
    tradeUpSetMax: (state, action: PayloadAction<number>) => {
      state.MaxFloat = action.payload;
    },
    tradeUpCollectionsAddRemove: (state, action: PayloadAction<string>) => {
      let collectionAlreadyExists = state.collections.filter(row => row !== action.payload);
      if (collectionAlreadyExists.length === state.collections.length) {
        collectionAlreadyExists.push(action.payload);
      }
      state.collections = collectionAlreadyExists;
    },
    tradeUpOptionsAddRemove: (state, action: PayloadAction<string>) => {
      let optionAlready = state.options.filter(row => row !== action.payload);
      if (optionAlready.length === state.options.length) {
        optionAlready.push(action.payload);
      }
      state.options = optionAlready;
    },
    tradeUpClearSelection: (state) => {
      state.tradeUpProducts = [];
      state.tradeUpProductsIDS = [];
      state.possibleOutcomes = [];
    },
    signOut: () => initialState,
  },
});

export const {
  tradeUpAddRemove,
  tradeUpSetPossible,
  tradeUpResetPossible,
  tradeUpSetSearch,
  tradeUpSetMin,
  tradeUpSetMax,
  tradeUpCollectionsAddRemove,
  tradeUpOptionsAddRemove,
  tradeUpClearSelection,
  signOut,
} = tradeUpSlice.actions;

export const selectTradeUp = (state: RootState) => state.tradeUp;

export default tradeUpSlice.reducer;