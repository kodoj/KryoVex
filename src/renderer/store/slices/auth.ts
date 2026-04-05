import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthReducer, WalletInterface } from 'renderer/interfaces/states.ts';
import { RootState } from '../rootReducer.ts';
import { SignInActionPackage } from 'renderer/interfaces/store/authReducerActionsInterfaces.ts';

const initialState: AuthReducer = {
  displayName: null,
  CSGOConnection: false,
  userProfilePicture: null,
  steamID: null,
  isLoggedIn: false,
  hasConnection: false,
  walletBalance: {
    hasWallet: false,
    currency: '',
    balance: 0,
  },
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signIn: (
      state,
      action: PayloadAction<SignInActionPackage>
    ) => {
      state.displayName = action.payload.displayName;
      state.CSGOConnection = action.payload.CSGOConnection;
      state.userProfilePicture = action.payload.userProfilePicture;
      state.steamID = action.payload.steamID;
      state.isLoggedIn = true;
      state.hasConnection = true;
      state.walletBalance = action.payload.wallet;
    },
    signOut: () => initialState,
    setConnection: (state, action: PayloadAction<{ hasConnection: boolean }>) => {
      state.hasConnection = action.payload.hasConnection;
    },
    setWalletBalance: (state, action: PayloadAction<WalletInterface>) => {
      state.walletBalance = action.payload;
    },
    setGc: (state, action: PayloadAction<{ CSGOConnection: boolean }>) => {
      state.CSGOConnection = action.payload.CSGOConnection;
    },
  },
});

export const {
  signIn,
  signOut,
  setConnection,
  setWalletBalance,
  setGc,
} = authSlice.actions;

export const selectAuth = (state: RootState) => state.auth;

export default authSlice.reducer;