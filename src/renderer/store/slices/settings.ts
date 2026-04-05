// src/renderer/store/slices/settingsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Settings, source, Overview } from 'renderer/interfaces/states.ts';
import { RootState } from '../rootReducer.ts';
import { CurrencyReturnValue } from 'shared/Interfaces-tsx/IPCReturn.ts';

const initialState: Settings = {
  fastMove: false,
  currency: 'USD',
  locale: 'EN-GB',
  os: '',
  steamLoginShow: true,
  devmode: false,
  tradeUpSimulateOnly: true,
  columns: ["Price", "Stickers/patches", "Storage", "Tradehold", 'Moveable', 'Inventory link'],
  columnWidths: {},
  currencyPrice: {},
  source: {
    title: 'steam_listing',
    name: 'Steam Community Market',
    avatar: 'https://steamcommunity.com/favicon.ico'
  },
  overview: {
    by: 'price',
    chartleft: 'overall',
    chartRight: 'itemDistribution'
  }
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setFastMove: (state, action: PayloadAction<boolean>) => {
      state.fastMove = action.payload;
    },
    setColumns: (state, action: PayloadAction<string[]>) => {
      state.columns = action.payload;
    },
    setColumnWidth: (
      state,
      action: PayloadAction<{ tableId: string; colKey: string; width: number }>
    ) => {
      const { tableId, colKey, width } = action.payload;
      if (!state.columnWidths) state.columnWidths = {};
      if (!state.columnWidths[tableId]) state.columnWidths[tableId] = {};
      state.columnWidths[tableId][colKey] = Math.max(40, Math.round(width));
    },
    setColumnWidths: (
      state,
      action: PayloadAction<{ tableId: string; widths: Record<string, number> }>
    ) => {
      const { tableId, widths } = action.payload;
      if (!state.columnWidths) state.columnWidths = {};
      if (!state.columnWidths[tableId]) state.columnWidths[tableId] = {};
      for (const [colKey, width] of Object.entries(widths || {})) {
        state.columnWidths[tableId][colKey] = Math.max(40, Math.round(width));
      }
    },
    clearColumnWidths: (state, action: PayloadAction<{ tableId: string }>) => {
      if (!state.columnWidths) state.columnWidths = {};
      state.columnWidths[action.payload.tableId] = {};
    },
    setCurrencyValue: (state, action: PayloadAction<string>) => {
      state.currency = action.payload;
    },
    setLocale: (state, action: PayloadAction<string>) => {
      state.locale = action.payload;
    },
    setSourceValue: (state, action: PayloadAction<source>) => {
      state.source = action.payload;
    },
    setCurrencyRate: (state, action: PayloadAction<CurrencyReturnValue>) => {
      let currencyDict = { ...state.currencyPrice };
      currencyDict[action.payload.currency] = action.payload.rate;
      state.currency = action.payload.currency;
      state.currencyPrice = currencyDict;
    },
    setOS: (state, action: PayloadAction<string>) => {
      state.os = action.payload;
    },
    setSteamLoginShow: (state, action: PayloadAction<boolean>) => {
      state.steamLoginShow = action.payload;
    },
    setDevmode: (state, action: PayloadAction<boolean>) => {
      state.devmode = action.payload;
    },
    setTradeUpSimulateOnly: (state, action: PayloadAction<boolean>) => {
      state.tradeUpSimulateOnly = action.payload;
    },
    setOverview: (state, action: PayloadAction<Overview>) => {
      state.overview = action.payload;
    },
    signOut: () => initialState,
  },
});

export const {
  setFastMove,
  setColumns,
  setColumnWidth,
  setColumnWidths,
  clearColumnWidths,
  setCurrencyValue,
  setLocale,
  setSourceValue,
  setCurrencyRate,
  setOS,
  setSteamLoginShow,
  setDevmode,
  setTradeUpSimulateOnly,
  setOverview,
  signOut,
} = settingsSlice.actions;

export const selectSettings = (state: RootState) => state.settings;

export default settingsSlice.reducer;