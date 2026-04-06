import 'core-js/stable/index.js';
import * as nodeUrl from 'node:url';
import {
  BrowserWindow,
  Menu,
  app,
  ipcMain,
  nativeImage,
  screen,
  shell,
  type NativeImage,
} from 'electron';
import 'regenerator-runtime/runtime.js';
import { CurrencyReturnValue } from '../shared/Interfaces-tsx/IPCReturn.tsx';
import { LoginCommandReturnPackage } from '../shared/Interfaces-tsx/store.ts';
import MenuBuilder from './menu.ts';
import { resolveHtmlPath, isUnpackagedDevSession } from './util.ts';
import { installReactDevTools } from './helpers/installReactDevTools.ts';
import { emitterAccount } from '../emitters.ts';
import { flowLoginRegularQR } from './helpers/login/flowLoginRegularQR.tsx';

import SteamUser from 'steam-user';
import GlobalOffensive from 'globaloffensive';
import ByteBuffer from 'bytebuffer';
import fetchItems from './helpers/classes/steam/items/getCommands.ts';
import { createCSGOImage } from '@/functionsClasses/createCSGOImage.ts';
import { ItemRow } from '@/interfaces/items.ts';

(async () => {
  const fs = await import('fs');
  const os = await import('os');
  const path = await import('path');
  const { LoginGenerator } = await import('./helpers/classes/IPCGenerators/loginGenerator.tsx');
  const currencyModule = await import('./helpers/classes/steam/currency.ts');
  const { currencyCodes, pricingEmitter, runItems: pricingItems } = await import('./helpers/classes/steam/pricing.ts');
  const { deleteUserData, getValue, setAccountPosition, setValue, storeUserAccount } = await import('./helpers/classes/steam/settings.ts');
  const { login } = await import('./helpers/classes/steam/steam.ts');
  const { tradeUps } = await import('./helpers/classes/steam/tradeup.ts');
  const log = (await import('electron-log')).default;
  const electronUpdater = await import('electron-updater');
  //@ts-ignore
  const autoUpdater = electronUpdater.default.autoUpdater;
  const Protos = (await import('globaloffensive/protobufs/generated/_load.js')).default;
  const Language = (await import('globaloffensive/language.js')).default;

  autoUpdater.logger = log;
  // @ts-ignore
  autoUpdater.logger.transports.file.level = 'info';
  log.info('App starting...');

  app.on('ready', function () {
    autoUpdater.checkForUpdatesAndNotify();
  });

  autoUpdater.on('checking-for-update', () => {
    sendUpdaterStatusToWindow('Checking for update...');
  });
  autoUpdater.on('update-available', (_info) => {
    sendUpdaterStatusToWindow('Update available.');
  });
  autoUpdater.on('update-not-available', (_info) => {
    sendUpdaterStatusToWindow('Update not available.');
  });
  autoUpdater.on('error', (err) => {
    sendUpdaterStatusToWindow('Error in auto-updater. ' + err);
  });
  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = 'Download speed: ' + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message =
      log_message +
      ' (' +
      progressObj.transferred +
      '/' +
      progressObj.total +
      ')';
    sendUpdaterStatusToWindow(log_message);
  });
  autoUpdater.on('update-downloaded', (_info) => {
    sendUpdaterStatusToWindow('Update downloaded');
  });

async function checkSteam(): Promise<{ pid?: number; status: boolean }> {
  const psList = (await import('ps-list')).default; // Dynamic import for ESM compat
  let steamName = 'steam.exe';
  if (process.platform === 'darwin') steamName = 'steam_osx';
  if (process.platform === 'linux') return { status: false };

  const processes = await psList();
  const steamProcs = processes.filter(p => p.name.toLowerCase() === steamName.toLowerCase());
  if (steamProcs.length > 0) {
    return { pid: steamProcs[0].pid, status: true };
  }
  return { status: false };
}
checkSteam();

ipcMain.handle('get-app-version', () => app.getVersion());

// Define helpers
const currencyClass = new currencyModule.Currency();
await currencyClass.init();
let tradeUpClass = new tradeUps();
const ClassLoginResponse = new LoginGenerator();

// Electron stuff
let mainWindow: BrowserWindow | null = null;
let activeSteamUser: SteamUser | null = null;
ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

let eventQueue: any[] = [];
let rendererReady = false;

// Registered once: fetch avatar using current logged-in SteamUser.
ipcMain.handle('get-steam-profile-image', async (_event, steamID) => {
  try {
    const user = activeSteamUser;
    if (!user) {
      return createCSGOImage("econ/characters/customplayer_tm_separatist");
    }
    const personas = await new Promise((resolve, reject) => {
      user.getPersonas([steamID], (err, p) => {
        if (err) reject(err);
        else resolve(p);
      });
    });
    const profile = (personas as Record<string, { avatar_url_medium?: string }>)[steamID];
    return profile?.avatar_url_medium || createCSGOImage("econ/characters/customplayer_tm_separatist");
  } catch (error) {
    console.error('Error fetching Steam profile in main:', error);
    return createCSGOImage("econ/characters/customplayer_tm_separatist");
  }
});

// Queue events until renderer is ready to avoid race conditions
ipcMain.on('renderer-ready', () => {
  rendererReady = true;
  const win = mainWindow;
  if (win && !win.isDestroyed()) {
    eventQueue.forEach(msg => win.webContents.send('userEvents', msg));
    eventQueue = [];
    console.log('Flushed event queue to renderer');
  }
});

// Optional: improves stack traces for unpacked/prod-like runs. Packaged builds do not ship this module.
if (process.env.NODE_ENV === 'production' && !app.isPackaged) {
  try {
    const m = await import('source-map-support');
    const sms = (m as { default?: { install?: () => void }; install?: () => void }).default ?? m;
    sms.install?.();
  } catch {
    /* ignore */
  }
}

if (isUnpackagedDevSession()) {
  const debug = (await import('electron-debug')).default;
  debug({ showDevTools: false });
}

// const installExtensions = async () => {
//   const installer = (await import('electron-devtools-installer'));
//   const forceDownload = !process.env.UPGRADE_EXTENSIONS;
//   const extensions = ['REACT_DEVELOPER_TOOLS', 'REDUX_DEVTOOLS'];

//   return installer
//     .default(
//       extensions.map((name) => installer[name]),
//       forceDownload
//     )
//     .catch(console.log);
// };

const createWindow = async () => {
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  const windowIconCandidates = [
    getAssetPath('icon.png'),
    getAssetPath('icon.ico'),
    path.join(process.cwd(), 'assets', 'icon.png'),
    path.join(process.cwd(), 'assets', 'icon.ico'),
  ];
  let windowIcon: NativeImage | undefined;
  for (const p of windowIconCandidates) {
    if (!fs.existsSync(p)) continue;
    const img = nativeImage.createFromPath(p);
    if (!img.isEmpty()) {
      windowIcon = img;
      break;
    }
  }

  let frameValue = true;
  if (process.platform == 'win32') {
    frameValue = false;
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 800,
    ...(windowIcon ? { icon: windowIcon } : {}),
    frame: frameValue,
    webPreferences: {
      //@ts-ignore
      preload: (() => {
        const preloadCjs = nodeUrl.fileURLToPath(new URL('./preload.cjs', import.meta.url));
        const preloadMjs = nodeUrl.fileURLToPath(new URL('./preload.mjs', import.meta.url));
        try {
          return fs.existsSync(preloadCjs) ? preloadCjs : preloadMjs;
        } catch {
          return preloadMjs;
        }
      })(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: isUnpackagedDevSession() ? false : true,
      allowRunningInsecureContent: isUnpackagedDevSession() ? true : false,
      enableBlinkFeatures: '',
    },
  });
  myWindow = mainWindow;
  mainWindow.webContents.session.clearStorageData();

  // Standard right-click context menu for inputs (copy/paste) + selected text.
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const hasSelection = !!params.selectionText;
    const isEditable = params.isEditable;
    if (!hasSelection && !isEditable) return;

    const template = [
      ...(isEditable ? [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }] : []),
      ...(hasSelection || isEditable ? [{ role: 'cut' }, { role: 'copy' }] : []),
      ...(isEditable ? [{ role: 'paste' }, { role: 'delete' }] : []),
      { type: 'separator' },
      ...(isEditable ? [{ role: 'selectAll' }] : []),
    ] as any[];

    Menu.buildFromTemplate(template).popup({ window: mainWindow! });
  });

  // Fallback: preload can request a context menu directly (for inputs).
  ipcMain.on('show-context-menu', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const template = [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'delete' },
      { type: 'separator' },
      { role: 'selectAll' },
    ] as any[];
    Menu.buildFromTemplate(template).popup({ window: win });
  });

  ipcMain.on('download', (_event, info) => {
    let fileP = path.join(os.homedir(), '/Downloads/KryoVex.csv');

    fs.writeFileSync(fileP, info, 'utf-8');
    shell.showItemInFolder(fileP);
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    console.log(app.getVersion());
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    myWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.platform == 'linux') {
    mainWindow.removeMenu();
  }
};

/**
 * Add event listeners...
 */
// Windows actions

ipcMain.on('windowsActions', async (_event, message) => {
  if (message == 'min') {
    mainWindow?.minimize();
  }
  if (message == 'max') {
    if (mainWindow?.isMaximized()) {
      mainWindow.restore();
    } else {
      mainWindow?.maximize();
    }
  }
  if (message == 'close') {
    mainWindow?.close();
  }
});

function isSteamCommunityMarketNavigationUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host !== 'steamcommunity.com' && host !== 'www.steamcommunity.com') return false;
    return parsed.pathname.startsWith('/market/');
  } catch {
    return false;
  }
}

ipcMain.handle('open-steamcommunity-url', async (_event, url: unknown) => {
  if (typeof url !== 'string' || url.length === 0 || url.length > 12000) {
    return { ok: false, error: 'invalid-url' as const };
  }
  if (!isSteamCommunityMarketNavigationUrl(url)) {
    return { ok: false, error: 'not-allowed' as const };
  }
  await shell.openExternal(url);
  return { ok: true as const };
});

ipcMain.handle('window-fit-content-width', async (_event, requestedContentWidth) => {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return false;
  if (win.isMaximized() || win.isFullScreen()) return false;
  // Match Tailwind `lg` (1024px): sidebar is `hidden lg:flex`, so shrinking below this collapses the nav.
  const MIN_CONTENT_WIDTH = 1024;
  const requested = Math.max(MIN_CONTENT_WIDTH, Math.round(Number(requestedContentWidth) || 0));
  if (!Number.isFinite(requested) || requested <= 0) return false;

  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const workArea = display?.workArea;
  const [contentW] = win.getContentSize();
  const [outerW] = win.getSize();
  const frameDeltaW = Math.max(0, outerW - contentW);
  const maxOuterW = Math.max(MIN_CONTENT_WIDTH, (workArea?.width ?? requested + frameDeltaW) - 8);
  const targetOuterW = Math.min(requested + frameDeltaW, maxOuterW);
  const targetContentWidth = Math.max(MIN_CONTENT_WIDTH, targetOuterW - frameDeltaW);
  if (requested + frameDeltaW >= maxOuterW - 2) {
    win.maximize();
    return true;
  }
  const currentContent = win.getContentSize();
  if (Math.abs(currentContent[0] - targetContentWidth) < 4) return true;

  const nextX = workArea
    ? Math.max(workArea.x, Math.min(bounds.x, workArea.x + workArea.width - targetOuterW))
    : bounds.x;
  win.setBounds(
    { x: nextX, y: bounds.y, width: targetOuterW, height: bounds.height },
    true
  );
  return true;
});

let currentLocale = 'da-dk';

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
    // localStorage.clear();
  }
});

let myWindow = null as any;
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (myWindow) {
      if (myWindow.isMinimized()) myWindow.restore();
      myWindow.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      if (isUnpackagedDevSession() && process.env.SKIP_REACT_DEVTOOLS !== '1') {
        void installReactDevTools().catch((e) => {
          console.error('Failed to install React DevTools:', e);
        });
      }
      currentLocale = app.getLocale();
      console.log('Currentlocal', currentLocale);
      try {
        await createWindow();
      } catch (e) {
        log.error('createWindow failed:', e);
        console.error('createWindow failed:', e);
      }
      app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (mainWindow === null) void createWindow();
      });
    })
    .catch((err) => {
      log.error('app.whenReady failed:', err);
      console.error('app.whenReady failed:', err);
    });
}

/**
 * IPC...
 */

var fetchItemClass = new fetchItems();


/* Pricing handlers */
  pricingEmitter.on('result', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('pricing-result', data);
      if (process.env.DEBUG_PRICING === 'true') {
        console.log('Sent pricing-result to renderer:', data.rows.length, 'stats:', data.stats);
      }
    }
  });
  pricingEmitter.on('progress', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('pricing-progress', data);
      if (process.env.DEBUG_PRICING === 'true') {
        console.log('Sent pricing-progress:', data);
      }
    }
  });

// Return 1 = Success
// Return 2 = Steam Guard
// Return 3 = Steam Guard wrong
// Return 4 = Wrong password
// Return 5 = Unknown
// Return 6 = Error with loginkey
async function sendLoginReply(event: any) {
  event.reply('login-reply', ClassLoginResponse.returnValue);
}

ipcMain.handle('check-steam', async () => {
  const pid = await checkSteam();
  if (pid.status) {
    return true;
  }
  return false;
});

ipcMain.handle('close-steam', async () => {
  const pid = await checkSteam();
  if (pid.status) {
    process.kill(pid.pid as number);
    return true;
  }
  return false;
});


emitterAccount.on(
  'login',
  async (
    event,
    user: SteamUser,
    cs2: GlobalOffensive,
    username: string,
    shouldRemember: boolean,
    secretKey: string | null
  ) => {
    // Success
    user.once('accountInfo', (displayName: string) => {
      console.log('Logged into Steam as main ' + displayName);
      activeSteamUser = user;
      getValue('pricing').then((pricing) => {
        let returnValue = pricing?.currency;
        if (returnValue == undefined) {
          const newCurrency = currencyCodes?.[user?.wallet?.currency ?? ''] || 'EUR';
          setValue('pricing', { ...pricing ?? {}, currency: newCurrency });
        }
      });
      console.log('logged on main');

      async function gameCoordinate(resolve: any = null) {
        cs2.once('connectedToGC', () => {
          if (resolve) {
            resolve('GC');
          }
          console.log('Connected to GC!');
          if (cs2.haveGCSession) {
            console.log('Have Session!');
            fetchItemClass.convertInventory(cs2.inventory).then((returnValue) => {
              tradeUpClass.getTradeUp(returnValue).then((newReturnValue) => {
                const rows = newReturnValue as ItemRow[];
                let walletToSend = user.wallet;
                if (walletToSend) {
                  walletToSend.currency = currencyCodes?.[walletToSend?.currency];
                }
                const returnPackage: LoginCommandReturnPackage = {
                  steamID: user.steamID?.getSteamID64() ?? 'unknown',
                  displayName,
                  haveGCSession: cs2.haveGCSession,
                  cs2Inventory: rows,
                  walletToSend: walletToSend
                    ? { ...walletToSend, currency: String(walletToSend.currency) }
                    : { hasWallet: false, currency: 'EUR', balance: 0 },
                };
                startEvents(cs2, user);
                if (shouldRemember) {
                  storeUserAccount(
                    username,
                    displayName,
                    user.steamID?.getSteamID64() ?? 'unknown',
                    secretKey
                  );
                }
                ClassLoginResponse.setResponseStatus('loggedIn');
                ClassLoginResponse.setPackage(returnPackage);
                sendLoginReply(event);
              });
            });
          }
        });
      }
      
      // // Create a timeout race to catch an infinite loading error in case the Steam account hasnt added the CSGO license
      // Run the normal version

      let GCResponse = new Promise((resolve) => {
        user.once('playingState', function (blocked, _playingApp) {
          if (!blocked) {
            startGameCoordinator();
            gameCoordinate(resolve);
          } else {
            ClassLoginResponse.setEmptyPackage();
            ClassLoginResponse.setResponseStatus('playingElsewhere');
            sendLoginReply(event);
            resolve('error');
          }
        });
      });

      // Run the timeout
      let timeout = new Promise((resolve, _reject) => {
        setTimeout(resolve, 10000, 'time');
      });

      // Run the timeout
      let error = new Promise((resolve, _reject) => {
        user.once('error', (error) => {
          if (error.message === 'Error: LoggedInElsewhere') {
            resolve('error');
          }
        });
      });

      // Race the two
      Promise.race([timeout, GCResponse, error]).then((value) => {
        if (value == 'error') {
          // Force login
          ipcMain.on('forceLogin', async () => {
            console.log('forceLogin');
            setTimeout(() => {
              // user.setPersona(SteamUser.EPersonaState.Online);
              gameCoordinate();
              user.gamesPlayed([730], true);
            }, 3000);

            ipcMain.removeAllListeners('forceLogin');
            ipcMain.removeAllListeners('signOut');
          });
          ipcMain.once('signOut', async () => {
            console.log('Sign out');
            user.logOff();
            ipcMain.removeAllListeners('forceLogin');
            ipcMain.removeAllListeners('signOut');
          });
        }
        if (value == 'time') {
          console.log(
            'GC didnt start in time, adding CS2 to the library and retrying.'
          );
          user.requestFreeLicense([730], function (err, packageIds, appIds) {
            if (err) {
              console.log(err);
              ClassLoginResponse.setEmptyPackage();
              ClassLoginResponse.setResponseStatus('playingElsewhere');
              sendLoginReply(event);
            }
            console.log('Granted package: ', packageIds);
            console.log('Granted App: ', appIds);
            startGameCoordinator();
          });
        }
      });
    });

    // Steam guard
    user.once('steamGuard', function (domain, callback, lastCodeWrong) {
      domain;
      callback;
      if (lastCodeWrong) {
        console.log('Last code wrong, try again!');
        cancelLogin(user);

        ClassLoginResponse.setEmptyPackage();
        ClassLoginResponse.setResponseStatus('steamGuardCodeIncorrect');
        sendLoginReply(event);
      } else {
        cancelLogin(user);
        ClassLoginResponse.setEmptyPackage();
        ClassLoginResponse.setResponseStatus('steamGuardError');
        sendLoginReply(event);
      }
    });

    // Login

    // Start the game coordinator for CSGO
    async function startGameCoordinator() {
      // user.setPersona(SteamUser.EPersonaState.Online);

      setTimeout(() => {
        // user.setPersona(SteamUser.EPersonaState.Online);
        user.gamesPlayed([730], true);
      }, 3000);
    }
  }
);

ipcMain.on(
  'login',
  async (
    event,
    username,
    password = null,
    shouldRemember,
    steamGuard = null,
    secretKey = null,
    clientjstoken = null
  ) => {
    let user = new SteamUser();
    let cs2 = new (GlobalOffensive as any)(user); // Temporarily cast to 'any' if the type definition is incomplete
    emitterAccount.emit(
      'login',
      event,
      user,
      cs2,
      username,
      shouldRemember,
      secretKey
    );
    let loginClass = new login();
    loginClass
      .mainLogin(
        user,
        username,
        shouldRemember,
        password,
        steamGuard,
        secretKey,
        clientjstoken
      )
      .then((returnValue: any) => {
        console.log(returnValue);
        event.reply('login-reply', returnValue);
      });
  }
);

emitterAccount.on('qrLogin:show', async (qrChallengeLogin) => {
  mainWindow?.webContents.send('qrLogin:show', qrChallengeLogin);
});
ipcMain.on('startQRLogin', async (event, shouldRemember) => {
  let user = new SteamUser();
  let cs2 = new GlobalOffensive(user);
  let loginClass = new login();
  emitterAccount.emit('qrLogin:cancel')
  flowLoginRegularQR(shouldRemember).then((returnValue) => {
    if (!returnValue.session) {
      return;
    }

    emitterAccount.emit(
      'login',
      event,
      user,
      cs2,
      returnValue.session.accountName,
      shouldRemember
    );
    loginClass
      .mainLogin(
        user,
        returnValue.session.accountName,
        shouldRemember,
        null,
        null,
        null,
        null,
        returnValue.session.refreshToken
      )
      .then((returnValue: any) => {
        event.reply('login-reply', returnValue);
      });
  });
});

const forwardQrLoginCancel = () => {
  emitterAccount.emit('qrLogin:cancel');
};
ipcMain.on('qrLogin:cancel', forwardQrLoginCancel);
// Renderer/preload sends this channel from `cancelQRLogin()`.
ipcMain.on('cancelQRLogin', forwardQrLoginCancel);

async function cancelLogin(user: SteamUser) {
  console.log('Cancel login');
  user.removeAllListeners('loggedOn');
  user.removeAllListeners('loginKey');
  user.removeAllListeners('steamGuard');
  user.removeAllListeners('error');
}

function sendUpdaterStatusToWindow(text: string) {
  log.info(text);
  mainWindow?.webContents.send('updater', [text]);
}

// Forward Steam notifications to renderer
async function startEvents(cs2: GlobalOffensive, user: SteamUser) {
   if (!mainWindow || !mainWindow.webContents) {
    console.warn('mainWindow not ready, delaying startEvents');
    setTimeout(() => startEvents(cs2, user), 1000);
    return;
  }
  // Pricing
  const pricing = new pricingItems(user);
  
  // Trade up handlers
  ipcMain.on('getTradeUpPossible', async (event, itemsToGet) => {
    try {
      const returnValue = await tradeUpClass.getPotentitalOutcome(itemsToGet);
      const list = Array.isArray(returnValue) ? returnValue : [];
      pricing.handleTradeUp(list as ItemRow[]);
      event.reply('getTradeUpPossible-reply', list);
    } catch (err) {
      log.error('[trade up] getTradeUpPossible failed', err);
      event.reply('getTradeUpPossible-reply', []);
    }
  });

  ipcMain.on('getPrice', async (_event, items, options) => {
    try {
      await pricing.handleItems(items, options);
      if (process.env.DEBUG_PRICING === 'true') {
        console.log('Pricing request handled for', items.length, 'items');
      }
    } catch (err) {
      console.error('Pricing handler error:', err);
    }
  });
  
  ipcMain.on('processTradeOrder', async (_event, idsToProcess, rarityToUse) => {
    const envDry = ['1', 'true', 'yes'].includes(
      String(process.env.KRYOVEX_TRADEUP_DRY_RUN || '').toLowerCase()
    );
    const simulateOnly = (await getValue('tradeUpSimulateOnly')) !== false;
    if (envDry || simulateOnly) {
      log.info(
        '[trade up] Skipped CS2 craft (simulate-only or KRYOVEX_TRADEUP_DRY_RUN). No items were consumed.'
      );
      return;
    }
    // Extra safety in development: real crafts need an explicit opt-in (production unchanged).
    const isDev = isUnpackagedDevSession();
    const allowRealInDev = ['1', 'true', 'yes'].includes(
      String(process.env.KRYOVEX_ALLOW_REAL_TRADEUP || '').toLowerCase()
    );
    if (isDev && !allowRealInDev) {
      log.warn(
        '[trade up] Development build: blocked real CS2 craft. Set KRYOVEX_ALLOW_REAL_TRADEUP=1 to test real trade-ups, or use a production build.'
      );
      return;
    }
    const rarObject = {
      0: '00000A00',
      1: '01000A00',
      2: '02000A00',
      3: '03000A00',
      4: '04000A00',
      10: '0a000a00',
      11: '0b000a00',
      12: '0c000a00',
      13: '0d000a00',
      14: '0e000a00',
    };
    const idsToUse = idsToProcess.map((id: string) => parseInt(id));
    const tradeupPayLoad = new ByteBuffer(1 + 2 + idsToUse.length * 8, ByteBuffer.LITTLE_ENDIAN);
    tradeupPayLoad.append(rarObject[rarityToUse], 'hex');
    for (const id of idsToUse) {
      tradeupPayLoad.writeUint64(id);
    }
    await (cs2 as any)._send(Language.Craft, null, tradeupPayLoad);
  });

  // Open container
  ipcMain.on('openContainer', async (_event, itemsToOpen) => {
    let containerPayload = new ByteBuffer(16, ByteBuffer.LITTLE_ENDIAN);
    containerPayload.append('0000000000000000', 'hex');
    for (let id of itemsToOpen) {
      containerPayload.writeUint64(parseInt(id));
    }
    await (cs2 as any)._send(Language.UnlockCrate, null, containerPayload);
  });

  // Helper to send or queue userEvents
  function sendOrQueueUserEvent(message: any[]) {
    if (rendererReady && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('userEvents', message);
      if (isUnpackagedDevSession()) {
        console.log('Sent userEvents to renderer');
      }
    } else {
      console.warn('Renderer not ready, queuing userEvents');
      eventQueue.push(message);
    }
  }

  // CSGO listeners
  // Inventory events
  async function startChangeEvents() {
  console.log('Start events');
  cs2.on('itemRemoved', (item) => {
    if (!Object.keys(item).includes('casket_id') && !Object.keys(item).includes('casket_contained_item_count')) {
      console.log('Item ' + item.id + ' was removed');
      fetchItemClass.convertInventory(cs2.inventory).then((returnValue) => {
        (tradeUpClass.getTradeUp(returnValue) as Promise<ItemRow[]>).then((newReturnValue) => {
          const message = [1, 'itemRemoved', [item, newReturnValue]];
          sendOrQueueUserEvent(message);
        });
      });
    }
  });

  cs2.on('itemChanged', (item) => {
    fetchItemClass.convertInventory(cs2.inventory).then((returnValue) => {
      (tradeUpClass.getTradeUp(returnValue) as Promise<ItemRow[]>).then((newReturnValue) => {
        const message = [1, 'itemChanged', [item, newReturnValue]];
        sendOrQueueUserEvent(message);
      });
    });
  });

  cs2.on('itemAcquired', (item) => {
    if (!Object.keys(item).includes('casket_id') && !Object.keys(item).includes('casket_contained_item_count')) {
      // console.log('Item ' + item.id + ' was acquired');
      removeInventoryListeners();
      fetchItemClass.convertInventory(cs2.inventory).then((returnValue) => {
        (tradeUpClass.getTradeUp(returnValue) as Promise<ItemRow[]>).then((newReturnValue) => {
          const message = [1, 'itemAcquired', [item, newReturnValue]];
          sendOrQueueUserEvent(message);
          // Pricing is driven by the renderer (`useAccountWidePricingRequest` + missing-only).
          // `handleItems(fullInventory)` here re-hit Steam for every unique on each acquire (429 spam).
        });
      });
    }
  });
}
  startChangeEvents();

  cs2.on('disconnectedFromGC', (reason) => {
    console.log('Disconnected from GC - reason: ', reason);
    sendOrQueueUserEvent([3, 'disconnectedFromGC', [reason]]);
  });

  cs2.on('connectedToGC', () => {
    console.log('Connected to GC!');
    if (cs2.haveGCSession) {
      sendOrQueueUserEvent([3, 'connectedToGC']);
    }
  });

  // User listeners
      // Steam Connection
    user.on('error', (err) => {
      console.log('main', err?.eresult, err?.message || err);
      sendOrQueueUserEvent([2, 'fatalError']);
      clearForNewSession();
    });
  
    user.on('disconnected', (eresult, msg) => {
      console.log(eresult, msg);
      sendOrQueueUserEvent([2, 'disconnected']);
    });

  user.on('loggedOn', () => {
    sendOrQueueUserEvent([2, 'reconnected']);
  });
  user.on('wallet', (hasWallet, currency, balance) => {
    const walletToSend = { hasWallet, currency: currencyCodes?.[currency] || 'EUR', balance };
    console.log('Wallet update: ', balance);
    sendOrQueueUserEvent([4, walletToSend]);
  });

  // Get commands from Renderer
  async function removeInventoryListeners() {
    console.log('Removed inventory listeners');
    cs2.removeAllListeners('itemRemoved');
    cs2.removeAllListeners('itemChanged');
    cs2.removeAllListeners('itemAcquired');
  }

ipcMain.on('refreshInventory', async () => {
  removeInventoryListeners();
  startChangeEvents();
  fetchItemClass.convertInventory(cs2.inventory).then((returnValue) => {
    tradeUpClass.getTradeUp(returnValue).then((newReturnValue) => {
      const message = [1, 'itemAcquired', [{}, newReturnValue]];
      sendOrQueueUserEvent(message);
      // Do not call `pricing.handleItems(rows)` — that walks the full inventory on every refresh
      // and defeats missing-only / backup-fast-path logic in the renderer (terminal 429 loops).
    });
  });
});

  // Retry connection
  ipcMain.on('retryConnection', async () => {
    user.gamesPlayed([]);
    user.gamesPlayed([730]);
    console.log('Retrying');
  });
  // Rename Storage units
  ipcMain.on('renameStorageUnit', async (event, itemID, newName) => {
    cs2.nameItem('0', String(itemID), newName);
    cs2.once('itemCustomizationNotification', (itemIds, notificationType) => {
      if (
        notificationType ==
        GlobalOffensive.ItemCustomizationNotification.NameItem
      ) {
        event.reply('renameStorageUnit-reply', [1, itemIds[0]]);
      }
    });
  });

  // Set item positions
  ipcMain.on('setItemsPositions', async (_event, dictOfItems) => {
    await (cs2 as any)._send(
      Language.SetItemPositions,
      Protos.CMsgSetItemPositions,
      dictOfItems
    );
  });

  // Set item positions
  ipcMain.on(
    'setItemEquipped',
    async (_event, item_id, item_name, itemClass) => {
      item_name;

      await (cs2 as any)._send(
        Language.k_EMsgGCAdjustItemEquippedState,
        Protos.CMsgAdjustItemEquippedState,
        {
          item_id: item_id,
          new_class: itemClass,
          new_slot: 0,
          swap: 0,
        }
      );
    }
  );

  // Remove items from storage unit
  ipcMain.on(
    'removeFromStorageUnit',
    async (event, casketID, itemID, fastMode) => {
      removeInventoryListeners();
      cs2.removeFromCasket(casketID, itemID);

      if (fastMode == false) {
        cs2.once(
          'itemCustomizationNotification',
          (itemIds, notificationType) => {
            if (
              notificationType ==
              GlobalOffensive.ItemCustomizationNotification.CasketRemoved
            ) {
              console.log(itemIds + ' got an item removed from it');
              event.reply('removeFromStorageUnit-reply', [1, itemIds[0]]);
            }
          }
        );
      }
    }
  );

  // Move to Storage Unit
  ipcMain.on('moveToStorageUnit', async (event, casketID, itemID, fastMode) => {
    cs2.addToCasket(casketID, itemID);
    //if (fastMode) {

    removeInventoryListeners();

    // }

    if (fastMode == false) {
      cs2.once(
        'itemCustomizationNotification',
        (itemIds, notificationType) => {
          if (
            notificationType ==
            GlobalOffensive.ItemCustomizationNotification.CasketAdded
          ) {
            console.log(itemIds[0] + ' got an item added to it');
            event.reply('moveToStorageUnit-reply', [1, itemIds[0]]);
          }
        }
      );
    }
  });

  // Get storage unit contents
  ipcMain.on('getCasketContents', async (event, casketID, _casketName) => {
    await cs2.getCasketContents(casketID, async function (err, items) {
      if (err) {
        event.reply('getCasketContent-reply', [0]);
        return;
      }
      try {
        const returnValue = await fetchItemClass.convertStorageData(items);
        const newReturnValue = await tradeUpClass.getTradeUp(returnValue);
        event.reply('getCasketContent-reply', [1, newReturnValue]);
      } catch {
        event.reply('getCasketContent-reply', [0]);
      }
    });
  });
  // Get commands from Renderer
  ipcMain.on('signOut', async () => {
    clearForNewSession();
  });

  async function clearForNewSession() {
    console.log('Signout');
    // Remove for CSGO
    removeInventoryListeners();
    cs2.removeAllListeners('connectedToGC');
    cs2.removeAllListeners('disconnectedFromGC');

    user.logOff();
    pricingEmitter.removeAllListeners('result');
    // Remove for user
    user.removeAllListeners('error');
    user.removeAllListeners('disconnected');
    user.removeAllListeners('loggedOn');

    // IPC
    ipcMain.removeAllListeners('renameStorageUnit');
    ipcMain.removeAllListeners('removeFromStorageUnit');
    ipcMain.removeAllListeners('moveToStorageUnit');
    ipcMain.removeAllListeners('getCasketContents');
    ipcMain.removeAllListeners('signOut');
    ipcMain.removeAllListeners('forceLogin');
  }
}

// Get currency
ipcMain.on('getCurrency', async (event) => {
  try {
    const pricing = await getValue('pricing'); // Await the pricing value
    const returnValue = pricing?.currency;

    if (returnValue) {
      const response = await currencyClass.getRate(returnValue); // Await the rate retrieval
      const returnObject: CurrencyReturnValue = {
        currency: returnValue as string,
        rate: response as number,
      };
      event.reply('getCurrency-reply', returnObject);
    } else {
      event.reply('getCurrency-reply', { error: 'Currency not found' });
    }
  } catch (error) {
    console.error('Error fetching currency:', error);
    event.reply('getCurrency-reply', { error: 'Failed to fetch currency' });
  }
});

// Set initial settings
async function settingsSetup() {
  getValue('devmode').then((returnValue) => {
    if (returnValue == undefined) {
      setValue('devmode', false);
    }
  });
  getValue('fastmove').then((returnValue) => {
    if (returnValue == undefined) {
      console.log('fastmove', returnValue);
      setValue('fastmove', false);
    }
  });
}
settingsSetup();

// Set platform
setValue('os', process.platform);

// Kinda store
ipcMain.on('electron-store-getAccountDetails', async (event) => {
  const accountDetails = await getValue('account');
  event.returnValue = event.reply(
    'electron-store-getAccountDetails-reply',
    accountDetails
  );
});

ipcMain.on('electron-store-deleteAccountDetails', async (_event, username) => {
  deleteUserData(username);
});

ipcMain.on(
  'electron-store-setAccountPosition',
  async (_event, username, position) => {
    setAccountPosition(username, position);
  }
);

// Store IPC
ipcMain.on('electron-store-get', async (event, val, key) => {
  if (val == 'locale') {
    event.reply('electron-store-get-reply' + key, currentLocale);
    return;
  }
  getValue(val).then((returnValue) => {
    event.reply('electron-store-get-reply' + key, returnValue);
  });
});
ipcMain.on('electron-store-set', async (event, key, val) => {
  event;
  setValue(key, val);
});
})().catch(console.error);