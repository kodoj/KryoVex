import { IpcRenderer, IpcRendererEvent } from 'electron';

declare global {
  interface Window {
    electron: {
      /** Preload: env forces trade-up dry run */
      isTradeUpDryRun: () => boolean;
      ipcRenderer: IpcRenderer & {
        // Sync sends (void)
        myPing: (message?: string) => void;
        refreshInventory: () => void;
        closeSteam: () => void;
        tradeOrder: (idsToProcess: any, idToUse: any) => void;
        setItemsPosition: (dictToUse: any) => void;
        OpenContainer: (listToUse: any) => void;
        retryConnection: () => void;
        logUserOut: () => void;
        handleWindowsActions: (action_type: any) => void;
        forceLogin: () => void;
        cancelQRLogin: () => void;
        downloadFile: (data: any) => void;
        openSteamCommunityUrl: (
          url: string
        ) => Promise<{ ok: boolean; error?: 'invalid-url' | 'not-allowed' }>;
        getPrice: (itemRows: Array<ItemRow>, options?: unknown) => void;
        getAppVersion: () => Promise<string>;
        deleteAccountDetails: (username: any) => void;
        setAccountPosition: (username: any, indexPosition: any) => void;
        userEvents: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => void;
        removeUserEvents: (channel: string, func: (...args: any[]) => void) => void;
        // Async (Promise)
        checkSteam: () => Promise<any>;
        needUpdate: () => Promise<any>;
        getAccountDetails: () => Promise<any>;
        getPossibleOutcomes: (resultsToGet: any) => Promise<any>;
        getCurrencyRate: () => Promise<any>;
        startQRLogin: (shouldRemember: any) => Promise<any>;
        loginUser: (
          username: any,
          password: any,
          shouldRemember: any,
          authcode: any,
          sharedSecret: any,
          clientjstoken: any
        ) => Promise<any>;
        forceLoginReply: () => Promise<any>;
        renameStorageUnit: (itemID: any, newName: any) => Promise<any>;
        getStorageUnitData: (itemID: any, storageName: any) => Promise<any>;
        moveFromStorageUnit: (casketID: any, itemID: any, fastMode: any) => Promise<any>;
        moveToStorageUnit: (casketID: any, itemID: any, fastMode: any) => Promise<any>;
        // Listeners (on/once)
        on: (channel: string, func: (event: IpcRendererEvent, ...args: any[]) => void) => void;
        once: (channel: string, func: (event: IpcRendererEvent, ...args: any[]) => void) => void;
      };
      store: {
        get: (val: string, key?: string) => Promise<any>;
        set: (property: any, val: any) => void;
      };
    };
  }
}