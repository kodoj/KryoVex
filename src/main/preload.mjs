import { contextBridge, ipcRenderer } from 'electron';
console.log('Preload script loaded and exposing APIs');

// Ensure right-click copy/paste works even if Electron's 'context-menu' event is blocked.
try {
  window.addEventListener(
    'contextmenu',
    (e) => {
      const t = e.target;
      const isEditable =
        (t && t.isContentEditable) ||
        (t && t.tagName === 'INPUT') ||
        (t && t.tagName === 'TEXTAREA');
      if (!isEditable) return;
      e.preventDefault();
      ipcRenderer.send('show-context-menu');
    },
    { capture: true }
  );
} catch {}

const __tradeUpEnvDryRun = ['1', 'true', 'yes'].includes(
  String(process.env.KRYOVEX_TRADEUP_DRY_RUN || '').toLowerCase()
);

// Map channel -> (original listener -> wrapped listener)
const __channelWrappers = new Map();
function __getWrapperMap(channel) {
  let m = __channelWrappers.get(channel);
  if (!m) {
    m = new WeakMap();
    __channelWrappers.set(channel, m);
  }
  return m;
}
function __wrapListener(channel, func) {
  const wrappers = __getWrapperMap(channel);
  const existing = wrappers.get(func);
  if (existing) return existing;
  const wrapped = (_event, ...args) => func(...args);
  wrappers.set(func, wrapped);
  return wrapped;
}
contextBridge.exposeInMainWorld('electron', {
  /** When true, forces trade-up simulation even if settings allow real crafts. */
  isTradeUpDryRun: () => __tradeUpEnvDryRun,
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    myPing(message = 'ping') {
      ipcRenderer.send('ipc-example', message);
    },
    // User commands
    refreshInventory() {
      ipcRenderer.send('refreshInventory');
    },
    checkSteam() {
      return ipcRenderer.invoke('check-steam');
    },
    closeSteam() {
      return ipcRenderer.invoke('close-steam');
    },
    // User commands
    getAppVersion() {
      return ipcRenderer.invoke('get-app-version');
    },
    // User account
    getAccountDetails() {
      return new Promise((resolve) => {
        ipcRenderer.send('electron-store-getAccountDetails');
        ipcRenderer.once(
          'electron-store-getAccountDetails-reply',
          (_evt, message) => {
            resolve(message);
          }
        );
      });
    },
    // User account
    getPossibleOutcomes(resultsToGet) {
      console.log(resultsToGet);
      return new Promise((resolve) => {
        ipcRenderer.send('getTradeUpPossible', resultsToGet);
        ipcRenderer.once('getTradeUpPossible-reply', (_evt, message) => {
          console.log(message);
          resolve(message);
        });
      });
    },
    // Trade up
    tradeOrder(idsToProcess, idToUse) {
      ipcRenderer.send('processTradeOrder', idsToProcess, idToUse);
    },
    //
    setItemsPosition(dictToUse) {
      ipcRenderer.send('setItemsPositions', dictToUse);
    },
    //
    OpenContainer(listToUse) {
      ipcRenderer.send('openContainer', listToUse);
    },
    // User account
    deleteAccountDetails(username) {
      ipcRenderer.send('electron-store-deleteAccountDetails', username);
    },
    // User account
    setAccountPosition(username, indexPosition) {
      ipcRenderer.send(
        'electron-store-setAccountPosition',
        username,
        indexPosition
      );
    },
    downloadFile(data) {
      ipcRenderer.send('download', data);
    },
    openSteamCommunityUrl(url) {
      return ipcRenderer.invoke('open-steamcommunity-url', url);
    },
    getPrice(itemRows, options) {
      ipcRenderer.send('getPrice', itemRows, options);
    },
    getCurrencyRate() {
      return new Promise((resolve) => {
        ipcRenderer.send('getCurrency');
        ipcRenderer.once('getCurrency-reply', (_evt, message) => {
          console.log(message);
          resolve(message);
        });
      });
    },
    // User commands
    retryConnection() {
      ipcRenderer.send('retryConnection');
    },
    debugLog(scope, payload) {
      ipcRenderer.send('renderer-log', scope, payload);
    },
    // User commands
    logUserOut() {
      ipcRenderer.send('signOut');
    },
    // User commands
    handleWindowsActions(action_type) {
      ipcRenderer.send('windowsActions', action_type);
    },
    // Send Confirm Force
    forceLogin() {
      ipcRenderer.send('forceLogin');
    },
    startQRLogin(shouldRemember) {
      return new Promise((resolve) => {
        ipcRenderer.removeAllListeners('login-reply');
        
        ipcRenderer.send('startQRLogin', shouldRemember);
        ipcRenderer.once('login-reply', (_event, arg) => {
          resolve(arg);
        });
      });
    },
    cancelQRLogin() {
      ipcRenderer.send('cancelQRLogin');
    },
    // USER CONNECTIONS
    loginUser(
      username,
      password,
      shouldRemember,
      authcode,
      sharedSecret,
      clientjstoken
    ) {
      console.log(clientjstoken);

      if (authcode == '') {
        authcode = null;
      }
      if (sharedSecret == '') {
        sharedSecret = null;
      }
      if (clientjstoken == '') {
        clientjstoken = null;
      }
      return new Promise((resolve) => {
        ipcRenderer.send(
          'login',
          username,
          password,
          shouldRemember,
          authcode,
          sharedSecret,
          clientjstoken
        );
        ipcRenderer.once('login-reply', (_event, arg) => {
          resolve(arg);
        });
      });
    },
    forceLoginReply() {
      return new Promise((resolve) => {
        ipcRenderer.once('login-reply', (_event, arg) => {
          resolve(arg);
        });
      });
    },
    userEvents() {
      return new Promise((resolve) => {
        ipcRenderer.once('userEvents', (_evt, message) => {
          resolve(message);
        });
      });
    },
    // Commands
    renameStorageUnit(itemID, newName) {
      return new Promise((resolve) => {
        ipcRenderer.send('renameStorageUnit', itemID, newName);

        ipcRenderer.once('renameStorageUnit-reply', (_event, arg) => {
          resolve(arg);
        });
      });
    },
    // Commands
    getStorageUnitData(itemID, storageName) {
      return new Promise((resolve) => {
        ipcRenderer.send('getCasketContents', itemID, storageName);

        ipcRenderer.once('getCasketContent-reply', (_event, arg) => {
          resolve(arg);
        });
      });
    },
    // Commands
    moveFromStorageUnit(casketID, itemID, fastMode) {
      // Create a promise that rejects in <ms> milliseconds
      let storageUnitResponse = new Promise((resolve) => {
        ipcRenderer.send('removeFromStorageUnit', casketID, itemID, fastMode);

        if (fastMode) {
          resolve(fastMode);
        } else {
          ipcRenderer.once('removeFromStorageUnit-reply', (_event, arg) => {
            resolve(arg);
          });
        }
      });
      if (fastMode) {
        return true;
      } else {
        let timeout = new Promise((_resolve, reject) => {
          let id = setTimeout(() => {
            clearTimeout(id);
            reject();
          }, 10000);
        });
        return Promise.race([storageUnitResponse, timeout]);
      }
    },

    // Commands
    moveToStorageUnit(casketID, itemID, fastMode) {
      let storageUnitResponse = new Promise((resolve) => {
        ipcRenderer.send('moveToStorageUnit', casketID, itemID, fastMode);
        if (fastMode) {
          resolve(fastMode);
        } else {
          ipcRenderer.once('moveToStorageUnit-reply', (_event, arg) => {
            resolve(arg);
          });
        }
      });
      if (fastMode) {
        return true;
      } else {
        let timeout = new Promise((_resolve, reject) => {
          let id = setTimeout(() => {
            clearTimeout(id);
            reject();
          }, 10000);
        });
        return Promise.race([storageUnitResponse, timeout]);
      }
    },
    removeUserEvents: (channel, func) => {
      try {
        const wrapped = __channelWrappers.get(channel)?.get(func);
        ipcRenderer.removeListener(channel, wrapped || func);
      } catch (err) {
        ipcRenderer.removeListener(channel, func);
      }
    },
    off: (channel, func) => {
      try {
        const wrapped = __channelWrappers.get(channel)?.get(func);
        ipcRenderer.removeListener(channel, wrapped || func);
      } catch (err) {
        ipcRenderer.removeListener(channel, func);
      }
    },
    removeListener: (channel, func) => {
      try {
        const wrapped = __channelWrappers.get(channel)?.get(func);
        ipcRenderer.removeListener(channel, wrapped || func);
      } catch (err) {
        ipcRenderer.removeListener(channel, func);
      }
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    on(channel, func) {
      const validChannels = [
        'ipc-example',
        'login',
        'userEvents',
        'refreshInventory',
        'renameStorageUnit',
        'removeFromStorageUnit',
        'errorMain',
        'signOut',
        'retryConnection',
        'download',
        'electron-store-getAccountDetails',
        'electron-store-get',
        'electron-store-set',
        'pricing',
        'pricing-progress',
        'pricing-result',
        'getPrice',
        'windowsActions',
        'getTradeUpPossible',
        'processTradeOrder',
        'setItemsPositions',
        'openContainer',
        'forceLogin',
        'checkSteam',
        'closeSteam',
        'updater',
        'startQRLogin',
        'cancelQRLogin',
        'qrLogin:show',
      ];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, __wrapListener(channel, func));
      }
    },
    once(channel, func) {
      const validChannels = [
        'login',
        'userEvents',
        'refreshInventory',
        'renameStorageUnit',
        'removeFromStorageUnit',
        'errorMain',
        'signOut',
        'retryConnection',
        'download',
        'electron-store-getAccountDetails',
        'electron-store-get',
        'electron-store-set',
        'pricing',
        'getPrice',
        'windowsActions',
        'getTradeUpPossible',
        'processTradeOrder',
        'setItemsPositions',
        'openContainer',
        'forceLogin',
        'checkSteam',
        'closeSteam',
        'updater',
        'startQRLogin',
        'cancelQRLogin',
        'qrLogin:show',
      ];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.once(channel, __wrapListener(channel, func));
      }
    },
    send(channel, ...args) {
      const validChannels = [
        'renderer-ready',
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },
  },
  store: {
    // Commands
    get(val) {
      const key =
        Math.random().toString(36).substr(2, 3) +
        '-' +
        Math.random().toString(36).substr(2, 3) +
        '-' +
        Math.random().toString(36).substr(2, 4);
      return new Promise((resolve) => {
        ipcRenderer.send('electron-store-get', val, key);

        ipcRenderer.once('electron-store-get-reply' + key, (_event, arg) => {
          console.log(arg);
          resolve(arg);
        });
      });
    },
    set(property, val) {
      ipcRenderer.send('electron-store-set', property, val);
    },
  },
});
