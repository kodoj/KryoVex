import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  ArrowTopRightOnSquareIcon,
  LockClosedIcon,
} from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { LoadingButton } from 'renderer/components/content/shared/animations.tsx';
import { btnDefault, btnPrimary } from 'renderer/components/content/shared/buttonStyles.ts';
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import NotificationElement from 'renderer/components/content/shared/modals-notifcations/notification.tsx';
import SteamLogo from 'renderer/components/content/shared/steamLogo.tsx';
import {
  HandleLoginObjectClass,
  LoginCommand,
  LoginCommandReturnPackage,
  LoginNotificationObject,
  LoginOptions,
} from 'shared/Interfaces-tsx/store.ts';
import { handleSuccess } from './HandleSuccess.ts';
import SteamCloseModal from './closeSteamModal.tsx';
import LoginTabs from './components/LoginTabs.tsx';
import ConfirmModal from './confirmLoginModal.tsx';
import { LoginMethod } from './types/LoginMethod.ts';
import { store } from 'renderer/store/configureStore.ts';

const loginResponseObject: LoginNotificationObject = {
  loggedIn: {
    success: true,
    title: 'Logged in successfully!',
    text: 'The app has successfully logged you in. Happy storaging.',
  },
  steamGuardError: {
    success: false,
    title: 'Steam Guard error!',
    text: 'Steam Guard might be required. Try again.',
  },
  steamGuardCodeIncorrect: {
    success: false,
    title: 'Wrong Steam Guard code',
    text: 'Got the wrong Steam Guard code. Try again.',
  },
  defaultError: {
    success: false,
    title: 'Unknown error',
    text: 'Could be wrong credentials, a network error, the account playing another game or something else. ',
  },
  playingElsewhere: {
    success: false,
    title: 'Playing elsewhere',
    text: 'You were logged in but the account is currently playing elsewhere.',
  },
  wrongLoginToken: {
    success: false,
    title: 'Wrong login token',
    text: 'Got the wrong login token.',
  },
  webtokenNotJSON: {
    success: false,
    title: 'Not a JSON string',
    text: 'Did you copy the entire string? Try again.',
  },
  webtokenNotLoggedIn: {
    success: false,
    title: 'Not logged in',
    text: 'Please log in to the browser and try again.',
  },
};

interface LoginFormProps {
  isLock: any;
  autoLoginNonce: number;
  replaceLock: () => void;
  runDeleteUser: (user: string) => void;
}

export default function LoginForm({ isLock, autoLoginNonce, replaceLock, runDeleteUser }: LoginFormProps) {
  // Usestate
  isLock;
  replaceLock;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [open, setOpen] = useState(false);
  const [sharedSecret, setSharedSecret] = useState('');
  const [clientjstoken, setClientjstoken] = useState('');
  const [doShow, setDoShow] = useState(false);
  const [wasSuccess, setWasSuccess] = useState(false);
  const [titleToDisplay, setTitleToDisplay] = useState('test');
  const [textToDisplay, setTextToDisplay] = useState('test');
  const [storeRefreshToken, setStoreRefreshToken] = useState(false);
  const [getLoadingButton, setLoadingButton] = useState(false);
  const [secretEnabled, setSecretEnabled] = useState(false);

  const currentState = store.getState();
  // Handle login
  const dispatch = useDispatch();

  async function openNotification(keyValue: keyof LoginOptions) {
    setWasSuccess(loginResponseObject?.[keyValue]?.success);
    setTitleToDisplay(loginResponseObject?.[keyValue]?.title);
    setTextToDisplay(loginResponseObject?.[keyValue]?.text);
    setDoShow(true);
  }

  class HandleLogin {
    command: keyof LoginOptions;
    relevantFunction: Function;
    handleObject: HandleLoginObjectClass = {
      webtokenNotLoggedIn: this.handleWebTokenNotLoggedIn,
      webtokenNotJSON: this.handlewebtokenNotJson,
      wrongLoginToken: this.handleWrongLoginToken,
      steamGuardError: this.handleSteamGuardError,
      defaultError: this.handleUnknownError,
      steamGuardCodeIncorrect: this.handleWrongSteamGuard,
      playingElsewhere: this.handlePlayingElsewhere,
      loggedIn: this.handleSuccesLogin,
    };
    constructor(command: keyof LoginOptions) {
      this.command = command;
      this.relevantFunction = this.handleObject[this.command];
    }

    async handlewebtokenNotJson() {
      openNotification(this.command);
      setLoadingButton(false);
      setClientjstoken('');
    }

    async handleWebTokenNotLoggedIn() {
      openNotification(this.command);
      setLoadingButton(false);
      setClientjstoken('');
    }

    async handleSteamGuardError() {
      openNotification(this.command);
    }
    async handleUnknownError() {
      openNotification(this.command);
      setUsername('');
      setPassword('');
    }

    async handleWrongLoginToken() {
      replaceLock();
      if (isLock) {
        runDeleteUser(isLock);
      } else {
        runDeleteUser(username);
      }
    }

    async handlePlayingElsewhere() {
      setOpen(true);
      openNotification(this.command);
    }

    async handleWrongSteamGuard() {
      openNotification(this.command);
    }

    async handleSuccesLogin() {
      openNotification(this.command);
      window.electron.ipcRenderer.refreshInventory();
    }
  }

  async function handleError() {
    setAuthCode('');
    setLoadingButton(false);
  }
  async function validateWebToken() {
    // Saved-account / refresh-token logins should bypass webtoken validation.
    if (lockedUsername) {
      return '';
    }
    let clientjstokenToSend = clientjstoken as any;
    // Validate web token
    if (loginMethod == 'WEBTOKEN') {
      // Is json string?
      try {
        clientjstokenToSend = JSON.parse(clientjstoken);
      } catch {
        openNotification('webtokenNotJSON');
        setLoadingButton(false);
        setClientjstoken('');
        return;
      }

      // Is logged in?
      if (!clientjstokenToSend.logged_in) {
        openNotification('webtokenNotLoggedIn');
        setLoadingButton(false);
        setClientjstoken('');
        return;
      }
    } else {
      clientjstokenToSend = '';
    }
    return clientjstokenToSend;
  }

  let hasChosenAccountLoginKey = false;
  let lockedUsername = '';
  if (Array.isArray(isLock) && isLock.length >= 2 && isLock[0]) {
    hasChosenAccountLoginKey = true;
    lockedUsername = String(isLock[0]);
  } else if (typeof isLock === 'string') {
    lockedUsername = isLock;
  }

  // When a saved account card is clicked, auto-attempt login with that lock.
  useEffect(() => {
    if (!autoLoginNonce) return;
    if (!lockedUsername) return;
    // Ensure we don't accidentally route through WEBTOKEN validation when auto-logging in.
    setLoginMethod('REGULAR');
    setClientjstoken('');
    onSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoginNonce]);
  const [closeSteamOpen, setCloseSteamOpen] = useState(false);
  const [hasAskedCloseSteam, setHasAskedCloseSteam] = useState(false);
  setLoadingButton;

  async function onSubmit() {
    setLoadingButton(true);

    if (!hasAskedCloseSteam && currentState.settings.steamLoginShow) {
      setHasAskedCloseSteam(true);
      const steamRunning = await window.electron.ipcRenderer.checkSteam();
      console.log('steam running', steamRunning);
      if (steamRunning) {
        setCloseSteamOpen(true);
        return;
      }
    }
    let clientjstokenToSend = await validateWebToken();
    let usernameToSend = username as any;
    let passwordToSend = password as any;
    let storePasswordToSend = storeRefreshToken as any;
    if (lockedUsername != '') {
      usernameToSend = lockedUsername;
      passwordToSend = null;
      storePasswordToSend = true;
    }
    const responseStatus: LoginCommand =
      await window.electron.ipcRenderer.loginUser(
        usernameToSend,
        passwordToSend,
        clientjstokenToSend != '' ? false : storePasswordToSend,
        authCode,
        sharedSecret,
        clientjstokenToSend
      );

    // Notification and react
    const HandleClass = new HandleLogin(responseStatus.responseStatus);
    HandleClass.relevantFunction();
    if (responseStatus.responseStatus == 'loggedIn') {
      handleSuccess(responseStatus.returnPackage as LoginCommandReturnPackage, dispatch,
      );
    } else {
      handleError();
    }
  }
  async function updateUsername(value) {
    setUsername(value);
    if (isLock != '') {
      replaceLock();
    }
  }
  async function updatePassword(value) {
    setPassword(value);
    if (isLock != '') {
      replaceLock();
    }
  }

  const [seenOnce, setOnce] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('REGULAR');
  const [defaultLoginMethod, setDefaultLoginMethod] = useState<LoginMethod>('REGULAR');
  const [qrURL, setQrURL] = useState('');
  useEffect(() => {
    if (seenOnce) return;
    setOnce(true);
    // Load default login method (persisted) once.
    window.electron.store
      .get('login.defaultMethod')
      .then((val: any) => {
        if (val === 'REGULAR' || val === 'QR' || val === 'WEBTOKEN') {
          setDefaultLoginMethod(val);
          setLoginMethod(val);
        }
      })
      .catch(() => {});
  }, [seenOnce]);

  async function handleSubmit(e) {
    e.preventDefault();
    await onSubmit();
  }

  /* useEffect(() => {
    if (!closeSteamOpen) {
      setCloseSteamOpen(window.electron.ipcRenderer.checkSteam())
    }
  }, [closeSteamOpen]); */
  useEffect(() => {
    if (loginMethod !== 'QR') {
      return;
    }
    // Preload __wrapListener calls func(...args) only (no synthetic event) — first arg is the URL string.
    window.electron.ipcRenderer.once('qrLogin:show', (...args: unknown[]) => {
      const pack = typeof args[0] === 'string' ? args[0] : '';
      setQrURL(pack || '');
    });
    window.electron.ipcRenderer
      .startQRLogin(storeRefreshToken)
      .then((responseStatus) => {
        // Notification and react
        console.log('response status', responseStatus);
        const HandleClass = new HandleLogin(responseStatus.responseStatus);
        HandleClass.relevantFunction();
        if (responseStatus.responseStatus == 'loggedIn') {
          handleSuccess(responseStatus.returnPackage as LoginCommandReturnPackage, dispatch);
        } else {
          handleError();
        }
      });
    return () => {
      window.electron.ipcRenderer.cancelQRLogin();
    };
  }, [loginMethod, storeRefreshToken]);

  return (
    <>
      <SteamCloseModal
        open={closeSteamOpen}
        setOpen={setCloseSteamOpen}
        loginWithouClosingSteam={() => onSubmit()}
        setLoadingButton={setLoadingButton}
      />
      <ConfirmModal
        open={open}
        setOpen={setOpen}
        setLoadingButton={setLoadingButton}
      />
      <div className="min-h-full flex items-center  pt-32 justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div>
            <div className="flex flex-col items-center gap-6">
              <SteamLogo />
            </div>
            <LoginTabs
              selectedTab={loginMethod}
              setSelectedTab={setLoginMethod}
            />
            <div className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
              Default: <span className="font-medium text-gray-300">{defaultLoginMethod.toLowerCase()}</span>
            </div>
            <h2 className="mt-6 text-center text-4xl font-extrabold tracking-tight text-gray-900 antialiased dark:text-dark-white [text-shadow:none]">
              {loginMethod === 'REGULAR'
                ? 'Connect to Steam'
                : loginMethod === 'QR'
                ? 'Scan QR Code'
                : 'Connect from browser'}
            </h2>
            <p className="mt-2 text-center text-base text-gray-600 dark:text-gray-300">
              {loginMethod === 'REGULAR'
                ? 'The application needs to have an active Steam connection to manage your CS2 items. You should not have any games open on the Steam account.'
                : loginMethod === 'QR'
                ? 'Scan the QR code with your Steam mobile app. You should be logged into the account you wish to connect KryoVex with.'
                : 'Open the URL by clicking on the button, or by copying it to the clipboard. You should be logged into the account you wish to connect KryoVex with. Paste the entire string below.'}
            </p>
          </div>

          <form className="mt-8 w-full mb-6" onSubmit={(e) => handleSubmit(e)}>
            <input type="hidden" name="remember" defaultValue="true" />
            {loginMethod === 'REGULAR' ? (
              <div className="mb-6">
                <div className="flex justify-center pb-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300 select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-white/20 bg-white/5"
                      checked={defaultLoginMethod === 'REGULAR'}
                      onChange={() => {
                        setDefaultLoginMethod('REGULAR');
                        window.electron.store.set('login.defaultMethod', 'REGULAR');
                      }}
                    />
                    Set Regular as default
                  </label>
                </div>
                <div className="overflow-hidden rounded-md border border-gray-300 dark:border-opacity-50">
                  <label htmlFor="email-address" className="sr-only">
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    onChange={(e) => updateUsername(e.target.value)}
                    spellCheck={false}
                    required
                    value={lockedUsername == '' ? username : lockedUsername}
                    className="relative block w-full appearance-none rounded-none border-0 border-b border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-kryo-ice-400 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-kryo-ice-400 dark:border-opacity-50 dark:bg-dark-level-one dark:text-dark-white sm:text-sm"
                    placeholder="Username"
                  />
                {!hasChosenAccountLoginKey ? (
                  <div>
                    <label htmlFor="password" className="sr-only">
                      Password
                    </label>
                    <input
                      id="password"
                      spellCheck={false}
                      name="password"
                      type="password"
                      onChange={(e) => updatePassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      value={lockedUsername == '' ? password : '~{nA?HJjb]7hB7-'}
                      className="relative block w-full appearance-none rounded-none border-0 border-b border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-kryo-ice-400 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-kryo-ice-400 dark:border-opacity-50 dark:bg-dark-level-one dark:text-dark-white sm:text-sm"
                      placeholder="Password"
                    />
                  </div>
                ) : (
                  ''
                )}
                {!hasChosenAccountLoginKey ? (
                  <div>
                    <label htmlFor="authcode" className="sr-only">
                      Steam Guard
                    </label>
                    <input
                      id="authcode"
                      name="authcode"
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                      spellCheck={false}
                      required
                      className="relative block w-full appearance-none rounded-none border-0 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-kryo-ice-400 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-kryo-ice-400 dark:bg-dark-level-one dark:text-dark-white sm:text-sm"
                      placeholder="Authcode (optional)"
                    />
                  </div>
                ) : (
                  <div className="pt-1 flex items-center">
                    <LockClosedIcon className="h-4 mr-1 w-4 dark:text-gray-500" />
                    <span className="dark:text-gray-500 sm:text-sm mt-0.5 ">
                      Password and Steam Guard code not required
                    </span>
                  </div>
                )}
                {!hasChosenAccountLoginKey ? (
                  <div className={classNames(secretEnabled ? '' : 'hidden')}>
                    <label htmlFor="secret" className="sr-only">
                      SharedSecret
                    </label>
                    <input
                      id="secret"
                      name="secret"
                      value={sharedSecret}
                      onChange={(e) => setSharedSecret(e.target.value)}
                      spellCheck={false}
                      required
                      className="relative block w-full appearance-none rounded-none border-0 border-t border-gray-300 bg-white px-3 py-2.5 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-kryo-ice-400 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-kryo-ice-400 dark:border-opacity-50 dark:bg-dark-level-one dark:text-dark-white sm:text-sm"
                      placeholder="Shared Secret (If you don't know what this is, leave it empty.)"
                    />
                  </div>
                ) : (
                  ''
                )}
                </div>
              </div>
            ) : loginMethod === 'WEBTOKEN' ? (
              <div className="mb-6">
                <div className="flex justify-center pb-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300 select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-white/20 bg-white/5"
                      checked={defaultLoginMethod === 'WEBTOKEN'}
                      onChange={() => {
                        setDefaultLoginMethod('WEBTOKEN');
                        window.electron.store.set('login.defaultMethod', 'WEBTOKEN');
                      }}
                    />
                    Set Webtoken as default
                  </label>
                </div>
                <div className="flex overflow-hidden rounded-md border border-gray-300 shadow-xs focus-within:ring-2 focus-within:ring-kryo-ice-400 focus-within:ring-offset-0 dark:border-opacity-50 dark:focus-within:ring-offset-dark-level-one">
                  <div className="relative flex min-h-[2.75rem] min-w-0 flex-1 items-stretch">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <ClipboardDocumentCheckIcon
                        className="h-5 w-5 text-gray-400"
                        aria-hidden="true"
                      />
                    </div>
                    <input
                      spellCheck={false}
                      type="text"
                      name="clientjs"
                      id="clientjs"
                      value={clientjstoken}
                      onChange={(e) => setClientjstoken(e.target.value)}
                      className="block w-full border-0 bg-dark-level-one py-2.5 pl-10 pr-3 text-dark-white placeholder-gray-500 focus:outline-none focus:ring-0 sm:text-sm"
                      placeholder="Paste data"
                    />
                  </div>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `https://steamcommunity.com/chat/clientjstoken`
                      )
                    }
                    type="button"
                    className={classNames(
                      btnDefault,
                      'inline-flex shrink-0 items-center justify-center self-stretch rounded-none border-0 border-l border-gray-300 px-3 dark:border-opacity-50'
                    )}
                  >
                    <ClipboardDocumentIcon
                      className="h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </button>
                  <Link
                    to={{
                      pathname: `https://steamcommunity.com/chat/clientjstoken`,
                    }}
                    target="_blank"
                    className={classNames(
                      btnDefault,
                      'inline-flex shrink-0 items-center justify-center self-stretch rounded-none rounded-l-none border-0 border-l border-gray-300 px-3 dark:border-opacity-50'
                    )}
                  >
                    <ArrowTopRightOnSquareIcon
                      className="h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-center pb-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300 select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-white/20 bg-white/5"
                      checked={defaultLoginMethod === 'QR'}
                      onChange={() => {
                        setDefaultLoginMethod('QR');
                        window.electron.store.set('login.defaultMethod', 'QR');
                      }}
                    />
                    Set QR as default
                  </label>
                </div>
                <div className="flex justify-center bg-white dark:bg-dark-level-one py-4 rounded-md">
                  <QRCode size={235} value={qrURL} viewBox={`0 0 235 235`} />
                </div>
                <div className="flex pt-2 items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    defaultChecked={storeRefreshToken}
                    className="h-4 w-4 text-kryo-ice-400 focus:ring-kryo-ice-400 border-gray-300 rounded"
                    onChange={() => setStoreRefreshToken(!storeRefreshToken)}
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block pl-1 text-sm text-gray-900 dark:text-dark-white"
                    >
                    Remember for later
                  </label>
                </div>
              </>
            )}
            {!hasChosenAccountLoginKey ? (
              <div
                className={classNames(
                  loginMethod === 'REGULAR' ? '' : 'hidden',
                  'mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
                )}
              >
                <div className="flex items-center gap-2">
                  {isLock == '' ? (
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      defaultChecked={storeRefreshToken}
                      className="h-4 w-4 shrink-0 rounded border-gray-300 text-kryo-ice-400 focus:ring-kryo-ice-400"
                      onChange={() => setStoreRefreshToken(!storeRefreshToken)}
                    />
                  ) : !hasChosenAccountLoginKey ? (
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={true}
                      className="pointer-events-none h-4 w-4 shrink-0 rounded border-gray-300 text-kryo-ice-400 focus:ring-kryo-ice-400 dark:text-opacity-50"
                      onChange={() => setStoreRefreshToken(!storeRefreshToken)}
                    />
                  ) : (
                    ''
                  )}

                  {isLock == '' ? (
                    <label
                      htmlFor="remember-me"
                      className="block cursor-pointer text-sm text-gray-900 dark:text-dark-white"
                    >
                      Remember for later
                    </label>
                  ) : !hasChosenAccountLoginKey ? (
                    <label
                      htmlFor="remember-me"
                      className="pointer-events-none block text-sm text-gray-900 dark:text-opacity-50 dark:text-dark-white"
                    >
                      Remember for later
                    </label>
                  ) : (
                    ''
                  )}
                </div>
                {!hasChosenAccountLoginKey ? (
                  <div className="flex items-center gap-2 sm:justify-end">
                    <input
                      id="sharedSecret"
                      name="sharedSecret"
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-gray-300 text-kryo-ice-400 focus:ring-kryo-ice-400"
                      onChange={() => setSecretEnabled(!secretEnabled)}
                    />
                    <label
                      htmlFor="sharedSecret"
                      className="block cursor-pointer text-sm text-gray-900 dark:text-dark-white"
                    >
                      Show secret field
                    </label>
                  </div>
                ) : (
                  ''
                )}
              </div>
            ) : (
              ''
            )}
            {loginMethod !== 'QR' ? (
              <div className="mt-6 w-full">
                <button
                  className={classNames(
                    btnPrimary,
                    'group relative flex w-full justify-center px-4 py-2 pl-11'
                  )}
                  type="submit"
                >
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    {getLoadingButton ? (
                      <LoadingButton />
                    ) : (
                      <LockClosedIcon
                        className="h-5 w-5 text-white/90 group-hover:text-white"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  Sign in
                </button>
              </div>
            ) : null}
          </form>
        </div>
      </div>
      <NotificationElement
        success={wasSuccess}
        titleToDisplay={titleToDisplay}
        textToDisplay={textToDisplay}
        doShow={doShow}
        setShow={() => {
          setDoShow(false);
        }}
      />
    </>
  );
}
