import { Fragment, useEffect, useState } from 'react';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Switch, Transition } from '@headlessui/react';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectSettings,
  setCurrencyValue,
  setDevmode,
  setFastMove,
  setSourceValue,
  setSteamLoginShow,
  setTradeUpSimulateOnly,
} from 'renderer/store/slices/settings.ts';
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/solid';
import { btnSelectTrigger } from 'renderer/components/content/shared/buttonStyles.ts';
import { classNames } from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import ColumnsDropDown from 'renderer/components/content/shared/dropdownRows.tsx';
import { DispatchIPC } from 'renderer/functionsClasses/rendererCommands/admin.tsx';
import { KRYOVEX_RELEASE_VERSION } from 'renderer/appMeta.ts';

const sources = [
  {
    id: 1,
    name: 'Steam Community Market',
    title: 'steam_listing',
    avatar: 'https://steamcommunity.com/favicon.ico',
  },
  {
    id: 2,
    name: 'Buff 163',
    title: 'buff163',
    avatar:
      'https://g.fp.ps.netease.com/market/file/59b156975e6027bce06e8f6ceTyFGdsj',
  },
  {
    id: 3,
    name: 'Skinport',
    title: 'skinport',
    avatar: 'https://skinport.com/static/favicon.ico',
  },
];
const currencyCode = [
  'AFN',
  'ALL',
  'DZD',
  'AOA',
  'ARS',
  'AMD',
  'AWG',
  'AUD',
  'AZN',
  'BSD',
  'BHD',
  'BBD',
  'BDT',
  'BZD',
  'BMD',
  'BTN',
  'BOB',
  'BAM',
  'BWP',
  'BRL',
  'BND',
  'BGN',
  'BIF',
  'XPF',
  'KHR ',
  'CAD',
  'CVE',
  'KYD',
  'CLP',
  'CLF',
  'CNY',
  'COP',
  'CDF',
  'CRC',
  'HRK',
  'CZK',
  'DKK',
  'DJF',
  'DOP',
  'XCD',
  'EGP',
  'ETB',
  'FJD',
  'GMD',
  'GBP',
  'GEL',
  'GHS',
  'GTQ',
  'GNF',
  'GYD',
  'HTG',
  'HNL',
  'HKD',
  'HUF',
  'ISK',
  'INR',
  'IDR',
  'IRR',
  'IQD',
  'ILS',
  'JMD',
  'JPY',
  'JOD',
  'KZT',
  'KES',
  'KWD',
  'KGS',
  'LAK',
  'LBP',
  'LSL',
  'LRD',
  'LYD',
  'MOP',
  'MKD',
  'MGA',
  'MWK',
  'MYR',
  'MVR',
  'MUR',
  'MXN',
  'MDL',
  'MAD',
  'MZN',
  'MMK',
  'NAD',
  'NPR',
  'ANG',
  'NZD',
  'NIO',
  'NGN',
  'NOK',
  'OMR',
  'PKR',
  'PAB',
  'PGK',
  'PYG ',
  'PHP',
  'PLN',
  'QAR',
  'RON',
  'RUB',
  'RWF',
  'SVC',
  'SAR',
  'RSD',
  'SCR',
  'SLL',
  'SGD',
  'SBD',
  'SOS',
  'ZAR',
  'KRW',
  'VES',
  'LKR',
  'SDG',
  'SRD',
  'SZL',
  'SEK',
  'CHF',
  'TJS',
  'TZS',
  'THB',
  'TOP',
  'TTD',
  'TND',
  'TRY',
  'TMT',
  'UGX',
  'UAH',
  'AED',
  'USD',
  'UYU',
  'UZS',
  'VND',
  'XOF',
  'YER',
  'ZMW',
  'ETH',
  'EUR',
  'LTC',
  'TWD',
  'PEN',
];

export default function settingsPage() {
  const dispatch = useDispatch();
  const settingsData = useSelector(selectSettings);

  // Steam Login Show
  const [showSteamLogin, setShowSteamLogin] = useState(settingsData.steamLoginShow);
  useEffect(() => {
    (async () => {
      const value = await window.electron.store.get('steamLogin');
      setShowSteamLogin(!value);
    })();
  }, []);
  async function updateShowSteamLogin() {
    const value = await window.electron.store.get('steamLogin');
    const correctValue = !value;
    setShowSteamLogin(correctValue);
    await window.electron.store.set('steamLogin', correctValue);
    dispatch(setSteamLoginShow(correctValue));
  }

  // Fastmove
  const [fastMoveStatus, setFastMoveStatus] = useState(settingsData.fastMove);
  useEffect(() => {
    (async () => {
      const value = await window.electron.store.get('fastmove');
      setFastMoveStatus(!value);
    })();
  }, []);
  async function updateFastMove() {
    const value = await window.electron.store.get('fastmove');
    const correctValue = !value;
    setFastMoveStatus(correctValue);
    await window.electron.store.set('fastmove', correctValue);
    dispatch(setFastMove(correctValue));
  }

  const [tradeUpSimulateOnly, setTradeUpSimulateOnlyState] = useState(
    settingsData.tradeUpSimulateOnly ?? true
  );
  useEffect(() => {
    (async () => {
      const v = await window.electron.store.get('tradeUpSimulateOnly');
      if (typeof v === 'boolean') {
        setTradeUpSimulateOnlyState(v);
        dispatch(setTradeUpSimulateOnly(v));
      }
    })();
  }, [dispatch]);
  async function updateTradeUpSimulateOnly() {
    const next = !tradeUpSimulateOnly;
    setTradeUpSimulateOnlyState(next);
    await window.electron.store.set('tradeUpSimulateOnly', next);
    dispatch(setTradeUpSimulateOnly(next));
  }

  // Dev mode
  const [devModeStatus, setDevModeStatus] = useState(settingsData.devmode);
  useEffect(() => {
    (async () => {
      const value = await window.electron.store.get('devmode.value');
      setDevModeStatus(!value);
    })();
  }, []);
  async function updateDevMode() {
    const value = await window.electron.store.get('devmode.value');
    const correctValue = !value;
    setDevModeStatus(correctValue);
    await window.electron.store.set('devmode.value', correctValue);
    dispatch(setDevmode(correctValue));
  }

  // Pricing - currency
  async function updateCurrency(valueToSet: string) {
    setCurrency(valueToSet);
    dispatch(setCurrencyValue(valueToSet));
    await window.electron.store.set('pricing.currency', valueToSet);
    const IPCClass = new DispatchIPC(dispatch);
    IPCClass.run(IPCClass.buildingObject.currency);
  }
  const [currency, setCurrency] = useState(settingsData.currency);

  // Pricing - source
  async function updateSource(valueToSet: any) {
    setSource(valueToSet);
    dispatch(setSourceValue(valueToSet));
    await window.electron.store.set('pricing.source', valueToSet);
    window.electron.ipcRenderer.refreshInventory();
  }
  const [source, setSource] = useState(settingsData.source);

  const [electronAppVersion, setElectronAppVersion] = useState<string | null>(null);
  useEffect(() => {
    void window.electron.ipcRenderer.getAppVersion().then((v: string) => {
      if (v) setElectronAppVersion(v.startsWith('v') ? v : `v${v}`);
    });
  }, []);

  return (
    <div>
      {/*
        This example requires updating your template:
        ```
        <html class="h-full bg-white">
        <body class="h-full">
        ```
      */}
      <div>
        {/* Page title & actions */}
        <div className="frost-sep-b border-b-0 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-medium leading-6 text-gray-900 sm:truncate dark:text-dark-white">
              Settings
            </h1>
          </div>
        </div>

        {/* Content area */}
        <div className="">
          <div className="max-w-4xl mx-auto flex flex-col md:px-8 xl:px-0">
            <main className="flex-1">
              <div className="relative max-w-4xl mx-auto md:px-8 xl:px-0">
                <div className="pb-16">
                  <div className="px-4 sm:px-6 md:px-0">
                    <div className="py-6">
                      {/* Description list with inline editing */}
                      <div className="divide-y divide-gray-200">
                        <div className="">
                        <h3 className="text-lg pt-5 leading-6 font-medium text-gray-900 dark:text-dark-white">
                                General settings
                              </h3>
                              <p className="max-w-2xl text-sm text-gray-500">
                                Toggles the general application settings
                              </p>
                          <dl className="divide-y divide-gray-200 dark:divide-opacity-50">

                            
                          <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                            <dt className="text-sm font-medium text-gray-900 dark:text-dark-white">
                                Show close popup <br />
                                <span className="text-gray-400">
                                  {' '}
                                  Shows a popup when you login and steam is open to close it.
                                </span>
                              </dt>
                             
                              <dd className="mt-1 flex text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                <span className="grow"></span>
                                <span className="flex items-center ml-4 shrink-0">
                                  <Switch
                                     checked={showSteamLogin}
                                    onChange={() => updateShowSteamLogin()}
                                    className={classNames(
                                      showSteamLogin
                                        ? 'bg-kryo-navy-800 dark:bg-kryo-navy-900 ring-1 ring-inset ring-kryo-ice-400/25'
                                        : 'bg-gray-200 dark:bg-dark-level-four',
                                      'relative inline-flex mr-3 shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none'
                                    )}
                                  >
                                    <span
                                      className={classNames(
                                        showSteamLogin
                                          ? 'translate-x-5'
                                          : 'translate-x-0',
                                        'pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200'
                                      )}
                                    >
                                      <span
                                        className={classNames(
                                          showSteamLogin
                                            ? 'opacity-0 ease-out duration-100'
                                            : 'opacity-100 ease-in duration-200',
                                          'absolute inset-0 h-full w-full flex items-center justify-center transition-opacity'
                                        )}
                                        aria-hidden="true"
                                      >
                                        <svg
                                          className="h-3 w-3 text-gray-400"
                                          fill="none"
                                          viewBox="0 0 12 12"
                                        >
                                          <path
                                            d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </span>
                                      <span
                                        className={classNames(
                                          fastMoveStatus
                                            ? 'opacity-100 ease-in duration-200'
                                            : 'opacity-0 ease-out duration-100',
                                          'absolute inset-0 h-full w-full flex items-center justify-center transition-opacity'
                                        )}
                                        aria-hidden="true"
                                      >
                                        <svg
                                          className="h-3 w-3 text-kryo-ice-400"
                                          fill="currentColor"
                                          viewBox="0 0 12 12"
                                        >
                                          <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                                        </svg>
                                      </span>
                                    </span>
                                  </Switch>
                                </span>
                              </dd>
                            </div>
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                              <dt className="text-sm font-medium text-gray-900 dark:text-dark-white">
                                Simulate trade-ups only <br />
                                <span className="text-gray-400">
                                  When on, the trade-up review will not pull items from storage or send a craft
                                  to CS2. Recommended unless you are intentionally completing a contract.
                                </span>
                              </dt>
                              <dd className="mt-1 flex text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                <span className="grow" />
                                <span className="ml-4 flex shrink-0 items-center">
                                  <Switch
                                    checked={tradeUpSimulateOnly}
                                    onChange={() => void updateTradeUpSimulateOnly()}
                                    className={classNames(
                                      tradeUpSimulateOnly
                                        ? 'bg-kryo-navy-800 dark:bg-kryo-navy-900 ring-1 ring-inset ring-kryo-ice-400/25'
                                        : 'bg-gray-200 dark:bg-dark-level-four',
                                      'relative mr-3 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none'
                                    )}
                                  >
                                    <span
                                      className={classNames(
                                        tradeUpSimulateOnly ? 'translate-x-5' : 'translate-x-0',
                                        'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                                      )}
                                    >
                                      <span
                                        className={classNames(
                                          tradeUpSimulateOnly
                                            ? 'opacity-0 ease-out duration-100'
                                            : 'opacity-100 ease-in duration-200',
                                          'absolute inset-0 flex h-full w-full items-center justify-center transition-opacity'
                                        )}
                                        aria-hidden="true"
                                      >
                                        <svg
                                          className="h-3 w-3 text-gray-400"
                                          fill="none"
                                          viewBox="0 0 12 12"
                                        >
                                          <path
                                            d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </span>
                                      <span
                                        className={classNames(
                                          tradeUpSimulateOnly
                                            ? 'opacity-100 ease-in duration-200'
                                            : 'opacity-0 ease-out duration-100',
                                          'absolute inset-0 flex h-full w-full items-center justify-center transition-opacity'
                                        )}
                                        aria-hidden="true"
                                      >
                                        <svg
                                          className="h-3 w-3 text-kryo-ice-400"
                                          fill="currentColor"
                                          viewBox="0 0 12 12"
                                        >
                                          <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                                        </svg>
                                      </span>
                                    </span>
                                  </Switch>
                                </span>
                              </dd>
                            </div>
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                            
                              <dt className="text-sm font-medium text-gray-900 dark:text-dark-white">
                                Fastmove <br />
                                <span className="text-gray-400">
                                  {' '}
                                  Increases the speed, moving might fail more often.
                                </span>
                              </dt>
                              <dd className="mt-1 flex text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                <span className="grow"></span>
                                <span className="flex items-center ml-4 shrink-0">
                                  <Switch
                                    checked={fastMoveStatus}
                                    onChange={() => updateFastMove()}
                                    className={classNames(
                                      fastMoveStatus
                                        ? 'bg-kryo-navy-800 dark:bg-kryo-navy-900 ring-1 ring-inset ring-kryo-ice-400/25'
                                        : 'bg-gray-200 dark:bg-dark-level-four',
                                      'relative inline-flex mr-3 shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none'
                                    )}
                                  >
                                    <span
                                      className={classNames(
                                        fastMoveStatus
                                          ? 'translate-x-5'
                                          : 'translate-x-0',
                                        'pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200'
                                      )}
                                    >
                                      <span
                                        className={classNames(
                                          fastMoveStatus
                                            ? 'opacity-0 ease-out duration-100'
                                            : 'opacity-100 ease-in duration-200',
                                          'absolute inset-0 h-full w-full flex items-center justify-center transition-opacity'
                                        )}
                                        aria-hidden="true"
                                      >
                                        <svg
                                          className="h-3 w-3 text-gray-400"
                                          fill="none"
                                          viewBox="0 0 12 12"
                                        >
                                          <path
                                            d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </span>
                                      <span
                                        className={classNames(
                                          fastMoveStatus
                                            ? 'opacity-100 ease-in duration-200'
                                            : 'opacity-0 ease-out duration-100',
                                          'absolute inset-0 h-full w-full flex items-center justify-center transition-opacity'
                                        )}
                                        aria-hidden="true"
                                      >
                                        <svg
                                          className="h-3 w-3 text-kryo-ice-400"
                                          fill="currentColor"
                                          viewBox="0 0 12 12"
                                        >
                                          <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                                        </svg>
                                      </span>
                                    </span>
                                  </Switch>
                                </span>
                              </dd>
                            </div>
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">

                              <dt className="text-sm font-medium text-gray-900 dark:text-dark-white">
                                Dev mode <br />
                                <span className="text-gray-400">
                                  {' '}
                                  Gives addtional dev features
                                </span>
                              </dt>
                              <dd className="mt-1 flex text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                <span className="grow"></span>
                                <span className="flex items-center ml-4 shrink-0">
                                  <Switch
                                    checked={devModeStatus}
                                    onChange={() => updateDevMode()}
                                    className={classNames(
                                      devModeStatus
                                        ? 'bg-kryo-navy-800 dark:bg-kryo-navy-900 ring-1 ring-inset ring-kryo-ice-400/25'
                                        : 'bg-gray-200 dark:bg-dark-level-four',
                                      'relative inline-flex mr-3 shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none'
                                    )}
                                  >
                                    <span
                                      className={classNames(
                                        devModeStatus
                                          ? 'translate-x-5'
                                          : 'translate-x-0',
                                        'pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200'
                                      )}
                                    >
                                      <span
                                        className={classNames(
                                          devModeStatus
                                            ? 'opacity-0 ease-out duration-100'
                                            : 'opacity-100 ease-in duration-200',
                                          'absolute inset-0 h-full w-full flex items-center justify-center transition-opacity'
                                        )}
                                        aria-hidden="true"
                                      >
                                        <svg
                                          className="h-3 w-3 text-gray-400"
                                          fill="none"
                                          viewBox="0 0 12 12"
                                        >
                                          <path
                                            d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </span>
                                      <span
                                        className={classNames(
                                          devModeStatus
                                            ? 'opacity-100 ease-in duration-200'
                                            : 'opacity-0 ease-out duration-100',
                                          'absolute inset-0 h-full w-full flex items-center justify-center transition-opacity'
                                        )}
                                        aria-hidden="true"
                                      >
                                        <svg
                                          className="h-3 w-3 text-kryo-ice-400"
                                          fill="currentColor"
                                          viewBox="0 0 12 12"
                                        >
                                          <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                                        </svg>
                                      </span>
                                    </span>
                                  </Switch>
                                </span>
                              </dd>
                            </div>
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">

                              <dt className="text-sm font-medium text-gray-900 dark:text-dark-white">
                              Columns <br />
                                <span className="text-gray-400">
                                  {' '}
                                  Select which columns to display
                                </span>
                              </dt>
                              <dd className="mt-1 flex text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                <span className="grow"></span>
                                <span className="flex items-center ml-4 shrink-0">
                                  <ColumnsDropDown />
                                </span>
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </div>

                      <div className="mt-10 divide-y divide-gray-200">
                        <div className="space-y-1">
                          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-dark-white">
                            Pricing
                          </h3>
                          <p className="max-w-2xl text-sm text-gray-500">
                            Set the pricing variables
                          </p>
                          <dl className="divide-y divide-gray-200 dark:divide-opacity-50">
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                              <dt className="text-sm font-medium text-gray-900 dark:text-dark-white">
                                Source <br />
                                <span className="text-gray-400">
                                  {' '}
                                  Select your pricing source
                                </span>
                              </dt>
                              <dd className="mt-1 flex text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                <span className="grow"></span>
                                <span className="flex items-center ml-4 shrink-0">
                                  <Listbox
                                    value={source}
                                    onChange={(e) => updateSource(e)}
                                  >
                                    {({ open }) => (
                                      <div>
                                        <div className="mt-1 relative">
                                          <ListboxButton className={btnSelectTrigger}>
                                            <span className="flex items-center">
                                              <img
                                                src={source?.avatar}
                                                alt=""
                                                className="shrink-0 h-6 w-6 rounded-full"
                                              />
                                              <span className="ml-3 block truncate">
                                                {source?.name}
                                              </span>
                                            </span>
                                            <span className="ml-3 absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                              <ChevronUpDownIcon
                                                className="h-5 w-5 text-gray-400"
                                                aria-hidden="true"
                                              />
                                            </span>
                                          </ListboxButton>

                                          <Transition
                                            show={open}
                                            as={Fragment}
                                            leave="transition ease-in duration-100"
                                            leaveFrom="opacity-100"
                                            leaveTo="opacity-0"
                                          >
                                            <ListboxOptions className="absolute z-10 mt-1 w-full bg-white dark:bg-dark-level-three shadow-lg max-h-56 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                              {sources.map((person) => (
                                                <ListboxOption
                                                  key={person.id}
                                                  className={({ active }) =>
                                                    classNames(
                                                      active
                                                        ? 'text-white bg-kryo-navy-800 dark:bg-kryo-navy-900 ring-1 ring-inset ring-kryo-ice-400/30'
                                                        : 'text-gray-900 dark:text-dark-white',
                                                      'cursor-default select-none relative py-2 pl-3 pr-9'
                                                    )
                                                  }
                                                  value={person}
                                                >
                                                  {({ selected, active }) => (
                                                    <div>
                                                      <div className="flex items-center">
                                                        <img
                                                          src={person.avatar}
                                                          alt=""
                                                          className="shrink-0 h-6 w-6 rounded-full"
                                                        />
                                                        <span
                                                          className={classNames(
                                                            selected
                                                              ? 'font-semibold'
                                                              : 'font-normal',
                                                            'ml-3 block truncate'
                                                          )}
                                                        >
                                                          {person.name}
                                                        </span>
                                                      </div>

                                                      {selected ? (
                                                        <span
                                                          className={classNames(
                                                            active
                                                              ? 'text-white'
                                                              : 'text-kryo-ice-400',
                                                            'absolute inset-y-0 right-0 flex items-center pr-4'
                                                          )}
                                                        >
                                                          <CheckIcon
                                                            className="h-5 w-5"
                                                            aria-hidden="true"
                                                          />
                                                        </span>
                                                      ) : null}
                                                    </div>
                                                  )}
                                                </ListboxOption>
                                              ))}
                                            </ListboxOptions>
                                          </Transition>
                                        </div>
                                      </div>
                                    )}
                                  </Listbox>
                                </span>
                              </dd>
                            </div>
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4">
                              <dt className="text-sm font-medium text-gray-900 dark:text-dark-white">
                                Currency <br />
                                <span className="text-gray-400">
                                  {' '}
                                  Prices will be converted into this currency
                                </span>
                              </dt>
                              <dd className="mt-1 flex text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                <span className="grow"></span>
                                <span className="flex items-center ml-4 shrink-0">
                                  <div>
                                    <select
                                      id="location"
                                      name="location"
                                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-kryo-ice-400 focus:border-kryo-ice-400 sm:text-sm rounded-md dark:bg-dark-level-one dark:text-dark-white"
                                      value={currency}
                                      onChange={(e) =>
                                        updateCurrency(e.target.value)
                                      }
                                    >
                                      {currencyCode.sort().map((code) => (
                                        <option key={code}>{code}</option>
                                      ))}
                                    </select>
                                  </div>
                                </span>
                              </dd>
                            </div>
                          </dl>
                          <p className="mt-10 border-t border-gray-200 pt-5 text-[11px] leading-relaxed text-gray-500 dark:border-opacity-50">
                            <span className="sr-only">Version details</span>
                            Release{' '}
                            <span className="font-mono text-gray-600 dark:text-gray-400">v{KRYOVEX_RELEASE_VERSION}</span>
                            {electronAppVersion ? (
                              <>
                                <span className="mx-1.5 text-gray-400">·</span>
                                <span
                                  className="text-gray-500"
                                  title="Version reported by the installed Electron application (installer / bundle)"
                                >
                                  Bundle <span className="font-mono text-gray-600 dark:text-gray-400">{electronAppVersion}</span>
                                </span>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
