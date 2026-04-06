import { Dialog, DialogBackdrop, Menu, MenuButton, MenuItem, MenuItems, Transition, TransitionChild } from '@headlessui/react';
import {
  ArchiveBoxIcon,
  BeakerIcon,
  Bars3CenterLeftIcon,
  XMarkIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ChevronUpDownIcon,
  ArrowUpTrayIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';
import { Fragment, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, Component } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, NavLink, Outlet, Route, HashRouter as Router, Routes, useLocation } from 'react-router-dom';
import { itemCategories } from './components/content/shared/categories.tsx';
import {
  btnIcon,
  btnNavRow,
  btnPrimary,
  btnToolbarIcon,
} from './components/content/shared/buttonStyles.ts';
import { classNames, sortDataFunction } from './components/content/shared/filters/inventoryFunctions.ts';
import kryoVexLogoUrl from './assets/kryovex-wordmark.webp';
import itemRarities from './components/content/shared/rarities.tsx';
import TitleBarWindows from './components/content/shared/titleBarWindows.tsx';
import { filterItemRows } from './functionsClasses/filters/custom.ts';
import { DispatchIPC, DispatchStore } from './functionsClasses/rendererCommands/admin.tsx';
import { Inventory, Settings } from './interfaces/states.tsx';
import { inventoryAddCategoryFilter, inventoryAddRarityFilter, selectInventoryFilters } from './store/slices/inventoryFilters.ts';
import { setFiltered } from './store/slices/inventoryFilters.ts';
import { selectModalTrade, setTradeFoundMatch } from './store/slices/modalTrade.ts';
import { selectPricing } from './store/slices/pricing.ts';
import { selectAuth, signOut } from './store/slices/auth.ts';
import { ProtectedRoute, PublicRoute } from './views/login/components/ProtectedRoutes.tsx';
import { toMoveContext } from './context/toMoveContext.tsx';
import { selectModalMove } from './store/slices/modalMove.ts';
import { selectSettings } from './store/slices/settings.ts';
import { PersistGate } from 'redux-persist/integration/react';
import { persistor } from './store/configureStore.ts';
import { useIpcPricing } from './hooks/useIpcPricing.ts';
import { useIpcPricingProgress } from './hooks/useIpcPricingProgress.ts';
import { useAccountWidePricingRequest } from './hooks/useAccountWidePricingRequest.ts';
import { useIpcUserEvents } from './hooks/useIpcUserEvents.ts';
import { KRYOVEX_RELEASE_VERSION } from './appMeta.ts';
import type { RootState } from './store/rootReducer.ts';
import type { ItemRow } from './interfaces/items.ts';

/** Stable empty list so trade-detect skips subscribing to inventory when no snapshot is active. */
const TRADE_DETECT_INV_IDLE: ItemRow[] = [];

const LoginPage = lazy(() => import('./views/login/login.tsx'));
const OverviewPage = lazy(() => import('./views/overview/overview.tsx'));
const SettingsPage = lazy(() => import('./views/settings/settings.tsx'));
const TradeupPage = lazy(() => import('./views/tradeUp/tradeUp.tsx'));
const InventoryContent = lazy(() => import('./components/content/Inventory/inventory.tsx'));
const StorageUnitsComponent = lazy(() => import('./components/content/storageUnits/from/Content.tsx'));
const ToContent = lazy(() => import('./components/content/storageUnits/to/toHolder.tsx'));
const MarketMultisellHelper = lazy(() => import('./views/market/marketMultisellHelper.tsx'));
const TradeResultModal = lazy(() => import('./components/content/shared/modals-notifcations/modalTradeResult.tsx'));

/** Warm Vite route chunks on hover so tab switches feel instant. */
const routeChunkByPath: Partial<Record<string, () => Promise<unknown>>> = {
  '/stats': () => import('./views/overview/overview.tsx'),
  '/transferfrom': () => import('./components/content/storageUnits/from/Content.tsx'),
  '/transferto': () => import('./components/content/storageUnits/to/toHolder.tsx'),
  '/inventory': () => import('./components/content/Inventory/inventory.tsx'),
  '/tradeup': () => import('./views/tradeUp/tradeUp.tsx'),
  '/settings': () => import('./views/settings/settings.tsx'),
  '/market': () => import('./views/market/marketMultisellHelper.tsx'),
};

function prefetchRouteChunk(pathname: string) {
  const loader = routeChunkByPath[pathname];
  if (loader) void loader();
}

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-dark-level-one text-sm text-gray-500">
      Loading…
    </div>
  );
}

// Navigation menu items
const navigation = [
  { name: 'Overview', href: '/stats', icon: ChartBarIcon, current: false },
  { name: 'Transfer | From', href: '/transferfrom', icon: ArrowDownTrayIcon, current: false },
  { name: 'Transfer | To', href: '/transferto', icon: ArrowUpTrayIcon, current: false },
  { name: 'Inventory', href: '/inventory', icon: ArchiveBoxIcon, current: false },
  { name: 'Trade up', href: '/tradeup', icon: BeakerIcon, current: false },
  { name: 'Market link', href: '/market', icon: BuildingStorefrontIcon, current: false },
];

// Error boundary component
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  state: Readonly<{ hasError: boolean; error: Error | null }> = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error: error instanceof Error ? error : new Error(String(error)) };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col justify-center items-center h-screen bg-dark-level-one">
          <p className="text-dark-white mb-4">An error occurred. Please reload the app.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={classNames(btnPrimary, 'px-4 py-2')}
          >
            Reload
          </button>
          <p className="text-sm text-gray-500 mt-2">{this.state.error?.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [getToMoveContext, setToMoveContext] = useState({ fromStorage: {} });
  const toMoveValue = useMemo(() => ({ getToMoveContext, setToMoveContext }), [getToMoveContext, setToMoveContext]);

  // Redux selectors
  const userDetails = useSelector(selectAuth);
  const modalData = useSelector(selectModalMove);
  const settingsData = useSelector(selectSettings);
  const tradeUpData = useSelector(selectModalTrade);
  const inventoryRowsForTradeDetect = useSelector((s: RootState) =>
    tradeUpData.inventoryFirst.length === 0 ? TRADE_DETECT_INV_IDLE : s.inventory.inventory
  );
  const inventoryFilters = useSelector(selectInventoryFilters);
  const pricingDetails = useSelector(selectPricing);
  const dispatch = useDispatch();

  function closeSidebarOnNavigate() {
    setSidebarOpen(false);
  }

  // Initialize store and IPC classes
  const StoreClass = useMemo(() => new DispatchStore(dispatch), [dispatch]);
  const IPCClass = useMemo(() => new DispatchIPC(dispatch), [dispatch]);

  // Filter inventory data (stable ref for IPC path — avoids extra listener churn)
  const handleFilterData = useCallback(
    async (combinedInventory: Inventory['combinedInventory']) => {
      if (inventoryFilters.inventoryFilter.length > 0 || inventoryFilters.sortValue !== 'Default') {
        let filteredInv = await filterItemRows(combinedInventory, inventoryFilters.inventoryFilter);
        filteredInv = await sortDataFunction(
          inventoryFilters.sortValue,
          filteredInv,
          pricingDetails.prices,
          settingsData.source?.title
        );
        dispatch(
          setFiltered({
            inventoryFilter: inventoryFilters.inventoryFilter,
            sortValue: inventoryFilters.sortValue,
            inventoryFiltered: filteredInv,
          })
        );
      }
    },
    [dispatch, inventoryFilters.inventoryFilter, inventoryFilters.sortValue, pricingDetails.prices, settingsData]
  );

  // Set initial settings on first login
  async function setFirstTimeSettings() {
    if (settingsData.currencyPrice[settingsData.currency] === undefined) {
      IPCClass.run(IPCClass.buildingObject.currency);
    }
    if (settingsData.os === '') {
      StoreClass.run(StoreClass.buildingObject.os);
      StoreClass.run(StoreClass.buildingObject.columns);
      StoreClass.run(StoreClass.buildingObject.devmode);
      StoreClass.run(StoreClass.buildingObject.fastmove);
      StoreClass.run(StoreClass.buildingObject.tradeUpSimulateOnly);
      StoreClass.run(StoreClass.buildingObject.source);
      StoreClass.run(StoreClass.buildingObject.locale);
      StoreClass.run(StoreClass.buildingObject.steamLoginShow);
    }
  }

  // Mount state
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Keep settings fresh
  const settingsRef = useRef<Settings>(settingsData);
  useEffect(() => {
    settingsRef.current = settingsData;
  }, [settingsData]);

  // Initialize settings on login
  useEffect(() => {
    if (isMounted.current && userDetails.isLoggedIn) {
      setFirstTimeSettings();
    }
  }, [userDetails.isLoggedIn]);

  // IPC user events listener
  useIpcUserEvents(settingsRef, modalData, handleFilterData);

  // Trigger initial inventory refresh on login
  useEffect(() => {
    if (userDetails.isLoggedIn) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Triggering initial refreshInventory, Time:', new Date().toISOString());
      }
      window.electron.ipcRenderer.refreshInventory();
    }
  }, [userDetails.isLoggedIn]);

  // Warm Market link chunk after login so first open is not blocked on download/parse alone.
  useEffect(() => {
    if (!userDetails.isLoggedIn) return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) void import('./views/market/marketMultisellHelper.tsx');
    };
    const id =
      typeof requestIdleCallback !== 'undefined'
        ? requestIdleCallback(run, { timeout: 5000 })
        : window.setTimeout(run, 3000);
    return () => {
      cancelled = true;
      if (typeof requestIdleCallback !== 'undefined') {
        cancelIdleCallback(id as number);
      } else {
        window.clearTimeout(id as number);
      }
    };
  }, [userDetails.isLoggedIn]);

  // Pricing listener
  useIpcPricing();

  // Pricing progress listener
  useIpcPricingProgress();

  // Single account-wide price queue (inv + storage) — see hook docstring
  useAccountWidePricingRequest();

  // Logout handler
  async function logOut() {
    window.electron.ipcRenderer.logUserOut();
    dispatch(signOut());
  }

  // Retry connection handler
  async function retryConnection() {
    window.electron.ipcRenderer.retryConnection();
  }

  // After a real trade-up, detect the new inventory asset (not present before craft).
  useEffect(() => {
    if (tradeUpData.inventoryFirst.length === 0) return;
    const pre = new Set(tradeUpData.inventoryFirst);
    const newcomers = inventoryRowsForTradeDetect.filter((el) => !pre.has(el.item_id));
    if (newcomers.length === 0) return;
    dispatch(setTradeFoundMatch({ matchRow: newcomers[0] }));
  }, [tradeUpData.inventoryFirst, inventoryRowsForTradeDetect, dispatch]);

  // JSX
  const isWin =
    settingsData.os === 'win32' ||
    (typeof navigator !== 'undefined' &&
      ((navigator as any).userAgentData?.platform === 'Windows' ||
        navigator.platform === 'Win32' ||
        navigator.userAgent.includes('Windows')));

  return (
    <ErrorBoundary>
      <Suspense fallback={null}>
        <TradeResultModal />
      </Suspense>
      {isWin ? <TitleBarWindows /> : null}
      <div
        className={classNames(
          isWin ? 'pt-7' : '',
          'flex min-h-0 flex-1 flex-col overflow-hidden dark:bg-dark-level-one'
        )}
      >
        {/* Mobile Sidebar */}
        <Transition show={sidebarOpen} as={Fragment}>
          <Dialog
            as="div"
            className="fixed inset-0 flex z-40 dark:bg-dark-level-two lg:hidden"
            onClose={setSidebarOpen}
          >
            <TransitionChild
              as={Fragment}
              enter="transition-opacity ease-linear duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity ease-linear duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <DialogBackdrop className="fixed inset-0 bg-gray-600 bg-opacity-75" />
            </TransitionChild>
            <TransitionChild
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <div className="relative flex min-h-0 flex-1 flex-col max-w-xs w-full pt-4 pb-3 bg-white dark:bg-dark-level-two">
                <TransitionChild
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute top-0 right-0 -mr-12 pt-2">
                    <button
                      type="button"
                      className={classNames(btnIcon, 'ml-1 h-10 w-10 rounded-full')}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </TransitionChild>
                <div className={classNames(isWin ? 'pt-4' : '', 'mt-2 min-h-0 flex-1 overflow-y-auto')}>
                  <nav className="px-2">
                    <div className="space-y-0.5">
                      {navigation.map((item) => (
                        <NavLink
                          key={item.name}
                          to={item.href}
                          onMouseEnter={() => prefetchRouteChunk(item.href)}
                          className={({ isActive }) =>
                            classNames(
                              isActive
                                ? 'bg-gray-100 text-gray-900 dark:bg-kryo-navy-900 dark:text-dark-white dark:shadow-[inset_0_0_0_1px_rgba(14,58,92,0.45)]'
                                : 'text-gray-600 dark:text-gray-200 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-kryo-navy-800 dark:hover:ring-1 dark:hover:ring-inset dark:hover:ring-kryo-navy-600/50 dark:hover:text-dark-white',
                              userDetails.isLoggedIn ? '' : 'pointer-events-none',
                              'group flex items-center px-2 py-1.5 dark:text-dark-white text-base leading-5 font-semibold rounded-md'
                            )
                          }
                          onClick={closeSidebarOnNavigate}
                        >
                          {({ isActive }) => (
                            <>
                              <item.icon
                                className={classNames(
                                  isActive
                                    ? 'text-gray-500 dark:text-opacity-60'
                                    : 'text-gray-400 group-hover:text-gray-500',
                                  'mr-2.5 shrink-0 h-6 w-6 dark:text-dark-white'
                                )}
                                aria-hidden="true"
                              />
                              {item.name}
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                    <div className="mt-4">
                      <h3
                        className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                        id="mobile-teams-headline"
                      >
                        Teams
                      </h3>
                      <div
                        className="mt-1 space-y-1"
                        role="group"
                        aria-labelledby="mobile-teams-headline"
                      >
                        {itemCategories.map((team) => (
                          <a
                            key={team.name}
                            href={team.href}
                            className="group flex items-center px-3 py-2 text-base leading-5 font-medium text-gray-600 dark:text-gray-200 rounded-md hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-kryo-navy-800 dark:hover:ring-1 dark:hover:ring-inset dark:hover:ring-kryo-navy-600/50 dark:hover:text-dark-white"
                          >
                            <span
                              className={classNames(
                                team.bgColorClass,
                                'w-2.5 h-2.5 mr-4 rounded-full'
                              )}
                              aria-hidden="true"
                            />
                            <span className="truncate">{team.name}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  </nav>
                </div>
                <div className="frost-sep-t shrink-0 border-t-0 px-4 py-3">
                  <img
                    src={kryoVexLogoUrl}
                    alt="KryoVex"
                    className="mx-auto w-full max-w-[12rem] h-auto object-contain object-center"
                  />
                </div>
              </div>
            </TransitionChild>
            <div className="shrink-0 w-14" aria-hidden="true" />
          </Dialog>
        </Transition>

        {/* Desktop Sidebar */}
        <div className="frost-sep-v hidden lg:flex lg:min-h-0 lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r-0 lg:pt-3 lg:pb-2 lg:bg-gray-100 dark:bg-dark-level-two">
          <div
            className={classNames(
              isWin ? 'pt-4' : '',
              'mt-2 min-h-0 flex-1 flex flex-col overflow-y-auto'
            )}
          >
            <Menu
              as="div"
              className={classNames(
                userDetails.isLoggedIn ? '' : 'pointer-events-none',
                'px-3 relative inline-block text-left'
              )}
            >
              <div>
                <MenuButton className="group w-full bg-gray-100 dark:bg-dark-level-two rounded-md px-3 py-2 text-left text-gray-700 hover:bg-gray-200 dark:hover:bg-dark-level-three focus:outline-none focus:ring-offset-2 focus:ring-offset-gray-100">
                  <span className="flex w-full justify-between items-center">
                    <span className="flex min-w-0 items-center justify-between space-x-2.5 antialiased">
                      {userDetails.userProfilePicture == null ? (
                        <svg
                          className="w-9 h-9 rounded-full shrink-0 text-gray-300"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      ) : (
                        <img
                          className={classNames(
                            userDetails.CSGOConnection ? 'border-2 border-solid border-green-400' : 'border-2 border-solid border-red-400',
                            'w-9 h-9 bg-gray-300 rounded-full shrink-0'
                          )}
                          src={userDetails.userProfilePicture}
                          alt=""
                        />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[15px] font-semibold leading-tight tracking-tight text-gray-900 dark:text-zinc-100">
                          {userDetails.displayName}
                        </span>
                        <span
                          className={classNames(
                            userDetails.CSGOConnection ? 'text-green-400' : 'text-red-400',
                            'text-[13px] font-semibold leading-tight'
                          )}
                        >
                          {userDetails.CSGOConnection ? 'Connected' : 'Not connected'}
                        </span>
                        {userDetails.walletBalance?.balance !== 0 && userDetails.walletBalance != null ? (
                          <span className="text-[13px] font-medium tabular-nums leading-tight text-gray-700 dark:text-gray-300">
                            {new Intl.NumberFormat(settingsData.locale, {
                              style: 'currency',
                              currency: userDetails.walletBalance?.currency || settingsData.currency,
                            }).format(userDetails.walletBalance?.balance || 0)}
                          </span>
                        ) : null}
                      </span>
                      <ChevronUpDownIcon
                        className="shrink-0 h-4 w-4 text-gray-400 group-hover:text-gray-500"
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                  </MenuButton>
                </div>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <MenuItems className="z-10 mx-3 origin-top absolute right-0 left-0 mt-1 rounded-md shadow-lg bg-white dark:bg-dark-level-four ring-1 ring-black ring-opacity-5 divide-y divide-gray-200 dark:divide-opacity-50 focus:outline-none">
                    <div className="py-1">
                      <MenuItem>
                        {({ focus }) => (
                          <Link
                            to="/settings"
                            className={classNames(
                              focus ? 'bg-gray-100 text-gray-900 dark:bg-dark-level-three dark:text-dark-white' : 'text-gray-700 dark:text-dark-white',
                              'block px-4 py-2 text-sm'
                            )}
                          >
                            Settings
                          </Link>
                        )}
                      </MenuItem>
                    </div>
                    <div className="py-1">
                      <MenuItem>
                        {({ focus }) => (
                          <Link
                            to=""
                            onClick={() => logOut()}
                            className={classNames(
                              focus ? 'bg-gray-100 text-gray-900 dark:bg-dark-level-three dark:text-dark-white' : 'text-gray-700 dark:text-dark-white',
                              'block px-4 py-2 text-sm'
                            )}
                          >
                            Logout
                          </Link>
                        )}
                      </MenuItem>
                    </div>
                  </MenuItems>
                </Transition>
              </Menu>
              {userDetails.CSGOConnection === false && userDetails.isLoggedIn === true ? (
                <div className="px-3 mt-3">
                  <button
                    type="button"
                    onClick={() => retryConnection()}
                    className={classNames(btnPrimary, 'w-full justify-start px-3 py-1.5 text-sm')}
                  >
                    <ArrowPathIcon className="mr-2 h-4 w-4 shrink-0 text-dark-white" aria-hidden="true" />
                    <span className="text-dark-white">Retry connection</span>
                  </button>
                </div>
              ) : null}
              <nav className="px-3 mt-3">
                <div className="space-y-0.5">
                  {navigation.map((item) => (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      title={item.name}
                      onMouseEnter={() => prefetchRouteChunk(item.href)}
                      className={({ isActive }) =>
                        classNames(
                          isActive
                            ? 'bg-gray-100 text-gray-900 dark:bg-kryo-navy-900 dark:text-dark-white dark:shadow-[inset_0_0_0_1px_rgba(14,58,92,0.45)]'
                            : 'text-gray-600 dark:text-gray-200 hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-kryo-navy-800 dark:hover:ring-1 dark:hover:ring-inset dark:hover:ring-kryo-navy-600/50 dark:hover:text-dark-white',
                          userDetails.isLoggedIn ? '' : 'pointer-events-none',
                          'group flex items-center px-2 py-1.5 dark:text-dark-white text-base leading-5 font-semibold rounded-md'
                        )
                      }
                      onClick={closeSidebarOnNavigate}
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            className={classNames(
                              isActive
                                ? 'text-gray-500 dark:text-opacity-60'
                                : 'text-gray-400 group-hover:text-gray-500',
                              'mr-2.5 shrink-0 h-6 w-6 dark:text-dark-white'
                            )}
                            aria-hidden="true"
                          />
                          {item.name}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
                {!location.pathname.includes('/tradeup') ? (
                  <div className="mt-3 pb-0.5">
                    <h3
                      className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      id="desktop-teams-headline"
                    >
                      Storage categories
                    </h3>
                    <div
                      className="mt-1 space-y-0.5"
                      role="group"
                      aria-labelledby="desktop-teams-headline"
                    >
                      {itemCategories.map((team) => (
                        <div
                          key={team.name}
                          className={classNames(
                            inventoryFilters.categoryFilter?.includes(team.bgColorClass)
                              ? 'bg-gray-200 dark:bg-dark-level-three'
                              : '',
                            'w-full'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => dispatch(inventoryAddCategoryFilter(team.bgColorClass))}
                            className={classNames(
                              userDetails.isLoggedIn === false ? 'pointer-events-none' : '',
                              btnNavRow
                            )}
                          >
                            <span
                              className={classNames(
                                team.bgColorClass,
                                'w-2.5 h-2.5 mr-4 rounded-full'
                              )}
                              aria-hidden="true"
                            />
                            <span className="truncate">{team.name}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <h3
                      className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      id="desktop-teams-headline"
                    >
                      Rarity
                    </h3>
                    <div
                      className="mt-1 space-y-0.5"
                      role="group"
                      aria-labelledby="desktop-teams-headline"
                    >
                      {itemRarities.map((rarity) => (
                        <div
                          key={rarity.value}
                          className={classNames(
                            inventoryFilters.rarityFilter?.includes(rarity.bgColorClass)
                              ? 'bg-gray-200 dark:bg-dark-level-three'
                              : '',
                            'w-full'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => dispatch(inventoryAddRarityFilter(rarity.bgColorClass))}
                            className={classNames(
                              userDetails.isLoggedIn === false ? 'pointer-events-none' : '',
                              btnNavRow
                            )}
                          >
                            <span
                              className={classNames(
                                rarity.bgColorClass,
                                'w-2.5 h-2.5 mr-4 rounded-full'
                              )}
                              aria-hidden="true"
                            />
                            <span className="truncate">{rarity.value}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </nav>
          </div>
          <div className="frost-sep-t shrink-0 border-t-0 px-4 pt-2 pb-1.5">
            <img
              src={kryoVexLogoUrl}
              alt="KryoVex"
              className="mx-auto w-full max-w-[11rem] h-auto object-contain object-center"
              decoding="async"
              fetchPriority="low"
            />
            <div className="mt-2 flex justify-center">
              <span className="text-xs tabular-nums text-gray-500">v{KRYOVEX_RELEASE_VERSION}</span>
            </div>
          </div>
        </div>

          {/* Main Content */}
          <div className="flex min-h-0 flex-1 flex-col min-w-0 overflow-hidden lg:pl-64">
            <div className="frost-sep-b sticky top-0 z-10 flex h-16 shrink-0 border-b-0 bg-white dark:bg-dark-level-two lg:hidden">
              <button
                type="button"
                className={classNames(btnToolbarIcon, 'frost-sep-r relative border-r-0 lg:hidden')}
                onClick={() => setSidebarOpen(true)}
              >
                <span className="sr-only">Open sidebar</span>
                <Bars3CenterLeftIcon className="h-6 w-6" aria-hidden="true" />
              </button>
              <div className="flex-1 flex justify-between px-4 sm:px-6 lg:px-8">
                <div className="flex-1 items-center justify-end flex">
                  <div className="px-3">
                    {userDetails.CSGOConnection === false && userDetails.isLoggedIn === true ? (
                      <button
                        type="button"
                        onClick={() => retryConnection()}
                        className={classNames(btnPrimary, 'w-full justify-start px-4 py-2')}
                      >
                        <ArrowPathIcon className="mr-2 h-4 w-4 shrink-0 text-dark-white" aria-hidden="true" />
                        <span className="text-dark-white">Retry connection</span>
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center">
                  <Menu
                    as="div"
                    className={classNames(
                      userDetails.isLoggedIn ? '' : 'pointer-events-none',
                      'ml-3 relative'
                    )}
                  >
                    <div>
                      <MenuButton className="max-w-xs bg-white dark:bg-dark-level-two flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2">
                        <span className="sr-only">Open user menu</span>
                        {userDetails.userProfilePicture == null ? (
                          <svg
                            className="w-10 h-10 rounded-full shrink-0 text-gray-300"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        ) : (
                          <img
                            className={classNames(
                              userDetails.CSGOConnection ? 'border-2 border-solid border-green-400' : 'border-4 border-solid border-red-400',
                              'w-10 h-10 bg-gray-300 rounded-full shrink-0'
                            )}
                            src={userDetails.userProfilePicture}
                            alt=""
                          />
                        )}
                      </MenuButton>
                    </div>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <MenuItems className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-dark-level-four ring-1 ring-black ring-opacity-5 divide-y divide-gray-200 dark:divide-gray-800 focus:outline-none">
                        <div className="py-1">
                          <MenuItem>
                            {({ focus }) => (
                              <Link
                                to=""
                                onClick={() => logOut()}
                                className={classNames(
                                  focus ? 'bg-gray-100 text-gray-900 dark:bg-dark-level-three dark:text-dark-white' : 'text-gray-700 dark:text-dark-white',
                                  'block px-4 py-2 text-sm'
                                )}
                              >
                                Logout
                              </Link>
                            )}
                          </MenuItem>
                        </div>
                      </MenuItems>
                    </Transition>
                  </Menu>
                </div>
              </div>
            </div>
            <main className="min-h-0 flex-1 min-w-0 overflow-y-auto overscroll-y-contain dark:bg-dark-level-one">
              <toMoveContext.Provider value={toMoveValue}>
                <Outlet />
              </toMoveContext.Provider>
            </main>
          </div>
        </div>
      </ErrorBoundary>
    );
}

function DefaultRedirect() {
  const isLoggedIn = useSelector(selectAuth).isLoggedIn;
  if (process.env.NODE_ENV === 'development') {
    console.log('DefaultRedirect: isLoggedIn?', isLoggedIn);
  }
  return isLoggedIn ? <Navigate to="/stats" replace /> : <Navigate to="/signin" replace />;
}

export default function App() {
  return (
    <PersistGate loading={<RouteFallback />} persistor={persistor}>
      <Router>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<AppContent />}>
              <Route index element={<DefaultRedirect />} />
              <Route path="/signin" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/transferfrom" element={<ProtectedRoute><StorageUnitsComponent /></ProtectedRoute>} />
              <Route path="/transferto" element={<ProtectedRoute><ToContent /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute><InventoryContent /></ProtectedRoute>} />
              <Route path="/tradeup" element={<ProtectedRoute><TradeupPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/stats" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
              <Route path="/market" element={<ProtectedRoute><MarketMultisellHelper /></ProtectedRoute>} />
              <Route path="*" element={<DefaultRedirect />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </PersistGate>
  );
}