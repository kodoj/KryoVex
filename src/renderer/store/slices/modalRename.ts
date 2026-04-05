// src/renderer/store/slices/modalRenameSlice.ts (updated or new; handles rename-specific actions)
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RenameModal, RenameModalPayload } from 'renderer/interfaces/states.ts';
import { RootState } from '../rootReducer.ts';

const initialState: RenameModal = {
  renameOpen: false,
  modalPayload: {
    itemID: '',
    itemName: ''
  },
};

const modalRenameSlice = createSlice({
  name: 'modalRename',
  initialState,
  reducers: {
    setRenameModal: (state, action: PayloadAction<RenameModalPayload>) => {
      state.renameOpen = true;
      state.modalPayload = action.payload;
    },
    closeRenameModal: (state) => {
      state.renameOpen = false;
    },
    signOut: () => initialState,
  },
});

export const {
  setRenameModal,
  closeRenameModal,
  signOut,
} = modalRenameSlice.actions;

export const selectModalRename = (state: RootState) => state.modalRename;

export default modalRenameSlice.reducer;