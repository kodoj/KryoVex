// src/renderer/store/slices/modalMoveSlice.ts (updated; handles move-specific actions)
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ModalMove, MoveModalQuery } from 'renderer/interfaces/states.ts';
import { RootState } from '../rootReducer.ts';

const initialState: ModalMove = {
  moveOpen: false,
  notifcationOpen: false,
  storageIdsToClearFrom: [],
  modalPayload: {
    number: 0,
    itemID: '',
    isLast: false
  },
  doCancel: [],
  query: [],
  totalFailed: 0
};

const modalMoveSlice = createSlice({
  name: 'modalMove',
  initialState,
  reducers: {
    moveModalQuerySet: (state, action: PayloadAction<{ query: MoveModalQuery[] }>) => {
      const q = action.payload?.query;
      if (!Array.isArray(q) || q.length === 0 || !q[0]?.payload) {
        return;
      }
      const queryData = [...q];
      queryData.shift();
      state.moveOpen = true;
      state.totalFailed = 0;
      //@ts-ignore
      state.modalPayload = q[0].payload;
      state.query = queryData;
    },
    modalResetStorageIdsToClearFrom: (state) => {
      state.storageIdsToClearFrom = initialState.storageIdsToClearFrom;
    },
    closeMoveModal: (state) => {
      state.moveOpen = false;
      state.totalFailed = initialState.totalFailed;
    },
    moveModalCancel: (state, action: PayloadAction<{ doCancel: string }>) => {
      state.doCancel = [...state.doCancel, action.payload.doCancel];
      state.totalFailed = initialState.totalFailed;
    },
    modalAddToFailed: (state) => {
      state.totalFailed = state.totalFailed + 1;
    },
    moveModalUpdate: (state) => {
      if (state.query.length === 0) {
        state.modalPayload = initialState.modalPayload;
        state.moveOpen = false;
        return;
      }
      let initialStoragesToClear = [...state.storageIdsToClearFrom];
      if (!initialStoragesToClear.includes(state.query[0].payload.storageID)) {
        initialStoragesToClear.push(state.query[0].payload.storageID);
      }
      if (state.doCancel.includes(state.query[0].payload.key)) {
        // Cancel: skip this step and advance (same shape as after a completed move).
        const newQuery = [...state.query];
        newQuery.shift();
        if (newQuery.length === 0) {
          state.modalPayload = initialState.modalPayload;
          state.moveOpen = false;
          state.query = newQuery;
        } else {
          state.moveOpen = true;
          //@ts-ignore
          state.modalPayload = newQuery[0].payload;
          state.query = newQuery;
        }
        state.storageIdsToClearFrom = initialStoragesToClear;
        return;
      }
      let newQuery = [...state.query];
      newQuery.shift();
      state.moveOpen = true;
      //@ts-ignore
      state.modalPayload = state.query[0].payload;
      state.storageIdsToClearFrom = initialStoragesToClear;
      state.query = newQuery;
    },
    moveModalResetPayload: (state) => {
      state.query = initialState.query;
    },
    /** Close the post-move failure summary (keeps totalFailed visible until user dismisses). */
    moveModalDismissFailureSummary: (state) => {
      state.totalFailed = initialState.totalFailed;
    },
  },
});

export const {
  moveModalQuerySet,
  modalResetStorageIdsToClearFrom,
  closeMoveModal,
  moveModalCancel,
  modalAddToFailed,
  moveModalUpdate,
  moveModalResetPayload,
  moveModalDismissFailureSummary,
} = modalMoveSlice.actions;

export const selectModalMove = (state: RootState) => state.modalMove;

export default modalMoveSlice.reducer;