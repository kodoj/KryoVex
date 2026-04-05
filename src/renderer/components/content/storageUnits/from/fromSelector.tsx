import { Menu, Transition, Switch, MenuItem, MenuItems } from '@headlessui/react';
import {
  CheckIcon,
  EllipsisVerticalIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import { Fragment, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { HandleStorageData } from 'renderer/functionsClasses/storageUnits/storageUnitsClass.tsx';
import { getAllStorages } from 'renderer/functionsClasses/storageUnits/storageUnitsFunctions.tsx';
import { ItemRowStorage } from 'renderer/interfaces/items.ts';
import { clearAllStorageUnits, clearStorageUnitItems } from 'renderer/store/slices/inventory.ts';
import { setRenameModal } from 'renderer/store/slices/modalRename.ts';
import {
  moveFromAddCasketToStorages,
  moveFromRemoveCasket,
  moveFromReset,
  moveFromSetFull,
  moveFromsetSearchFieldStorage,
  selectMoveFrom,
} from 'renderer/store/slices/moveFrom.ts';
import { LoadingButton } from '../../shared/animations.tsx';
import EmptyComponent from '../../shared/emptyState.tsx';
import { btnDefault, btnPrimary } from '../../shared/buttonStyles.ts';
import { classNames } from '../../shared/filters/inventoryFunctions.ts';
import RenameModal from '../../shared/modals-notifcations/modalRename.tsx';
import { useCs2Image } from 'renderer/hooks/useCs2Image.ts';
import { markImageError } from 'renderer/hooks/useCs2Image.ts';
import { selectInventory } from 'renderer/store/slices/inventory.ts';
import { moveFromClearAll, selectInventoryFilters } from 'renderer/store/slices/inventoryFilters.ts';
import { selectPricing } from 'renderer/store/slices/pricing.ts';
import { selectSettings } from 'renderer/store/slices/settings.ts';
import { ConvertPrices } from 'renderer/functionsClasses/prices.ts';

const STORAGE_UNIT_ICON_FALLBACK =
  // Simple inline SVG “crate/casket” placeholder to avoid broken UI when upstream tracker paths 404.
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#111827"/>
      <stop offset="1" stop-color="#0b1220"/>
    </linearGradient>
  </defs>
  <rect x="6" y="10" width="76" height="68" rx="10" fill="url(#g)" stroke="#334155" stroke-width="3"/>
  <path d="M16 30h56" stroke="#334155" stroke-width="3" stroke-linecap="round"/>
  <path d="M16 58h56" stroke="#334155" stroke-width="3" stroke-linecap="round"/>
  <rect x="38" y="38" width="12" height="12" rx="3" fill="#1f2937" stroke="#64748b" stroke-width="2"/>
  <path d="M22 22l10 10M66 22L56 32M22 66l10-10M66 66L56 56" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/>
</svg>`);

function StorageUnitImg({
  srcKey,
  active,
}: {
  srcKey: string;
  active: boolean;
}) {
  const src = useCs2Image(srcKey, { fallback: STORAGE_UNIT_ICON_FALLBACK });
  return (
    <img
      className={classNames(
        active ? '' : 'opacity-50 dark:opacity-40',
        'max-w-none h-11 w-11 object-cover'
      )}
      src={src}
      onError={(e) => {
        const img = e.currentTarget;
        markImageError(srcKey);
        img.onerror = null;
        img.src = STORAGE_UNIT_ICON_FALLBACK;
      }}
    />
  );
}

function content() {
  const dispatch = useDispatch();
  const [getLoadingButton, setLoadingButton] = useState(false);
  const [storageLoading, setStorageLoading] = useState(false);

  const fromReducer = useSelector(selectMoveFrom);
  const inventory = useSelector(selectInventory);
  const fromSelector = useSelector(selectMoveFrom);
  const pricesResult = useSelector(selectPricing);
  const settingsData = useSelector(selectSettings);
  const inventoryFilters = useSelector(selectInventoryFilters);

  // Clear all filters

  async function setLoadingSetStorage(valueToSet: boolean) {
    setLoadingButton(valueToSet);
    setStorageLoading(valueToSet);
  }

  // This will return and convert a specific units data
  async function getStorageData(storageRow: ItemRowStorage) {
    if (storageLoading == true) {
      return;
    }
    setLoadingSetStorage(true);
    if (fromSelector.activeStorages.includes(storageRow.item_id)) {
      dispatch(moveFromAddCasketToStorages({casketID: storageRow.item_id}));
      dispatch(clearStorageUnitItems({casketID: storageRow.item_id}));
      dispatch(moveFromRemoveCasket({casketID: storageRow.item_id}));
      setLoadingSetStorage(false);
    } else {
      new HandleStorageData(dispatch, {
        inventory,
        moveFrom: fromSelector,
        settings: settingsData,
        pricing: pricesResult,
        inventoryFilters,
      } as any)
        .addStorage(storageRow)
        .then(() => {
          setLoadingSetStorage(false);
        });
    }
  }

  // Get the inventory
  async function refreshInventory() {
    window.electron.ipcRenderer.refreshInventory();
  }

  // Get all storage unit data
  async function getAllStor() {
    setLoadingSetStorage(true)
    getAllStorages(dispatch, {
      inventory,
      moveFrom: fromSelector,
      settings: settingsData,
      pricing: pricesResult,
      inventoryFilters,
    } as any).then(() => {
      setLoadingSetStorage(false)
    })
  }

  /** Clear Transfer From: loaded caskets, items table, move queue, and storage filters (same as initial page state). */
  function unMarkAllStorages() {
    dispatch(moveFromReset());
    dispatch(clearAllStorageUnits());
    dispatch(moveFromClearAll());
  }

  // Get prices for storage units
  const totalDict = useMemo(() => {
    const out: Record<string, number> = {};
    const PricingClass = new ConvertPrices(settingsData, pricesResult);
    for (const projectRow of inventory.storageInventory) {
      const sid = projectRow.storage_id;
      out[sid] ||= 0;
      const itemPrice = PricingClass.getPrice(projectRow as any, true);
      out[sid] += (projectRow.combined_QTY ?? 0) * (itemPrice || 0);
    }
    return out;
  }, [
    inventory.storageInventory,
    pricesResult.prices,
    settingsData.currency,
    settingsData.currencyPrice,
    settingsData?.source?.title,
  ]);

  // Sort run
  function sortRun(valueOne, ValueTwo, useNaN = false) {
    if (valueOne < ValueTwo) {
      return -1;
    }
    if (valueOne > ValueTwo) {
      return 1;
    }

    if (useNaN && isNaN(valueOne)) {
      return -1;
    }
    return 0;
  }

  const inventoryToUse = inventory.inventory;

  const storageRows = useMemo(() => {
    const search = (fromSelector.searchInputStorage || '').toLowerCase();
    const hideFull = fromReducer.hideFull;
    return inventoryToUse
      .filter((row) => {
        if (!row.item_url.includes('casket')) return false;
        if (row.item_storage_total == 0) return false;
        if (search && !row?.item_customname?.toLowerCase()?.includes(search)) return false;
        if (row.item_storage_total == 1000 && hideFull) return false;
        return true;
      })
      .sort((a, b) => {
        const aName = a.item_customname ?? '0000';
        const bName = b.item_customname ?? '0000';
        return sortRun(aName, bName);
      });
  }, [inventoryToUse, fromSelector.searchInputStorage, fromReducer.hideFull]);

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <RenameModal />
      <div className="border-gray-200 px-4 py-4 sm:flex sm:items-center sm:justify-between ">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="shrink-0 text-xs font-medium uppercase tracking-wide text-gray-500">
            Storage units
          </h2>
          <label htmlFor="search-storage-from" className="sr-only">
            Search storages
          </label>
          <div className="relative min-w-[10rem] max-w-md flex-1 rounded-md border-l-2 border-gray-200 focus:outline-none dark:border-opacity-50">
            <div
              className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
              aria-hidden="true"
            >
              <MagnifyingGlassIcon
                className="mr-3 h-4 w-4 text-gray-400"
                aria-hidden="true"
              />
            </div>
            <input
              type="text"
              name="search"
              id="search-storage-from"
              value={fromSelector.searchInputStorage}
              className="block w-full pb-0.5  focus:outline-none dark:text-dark-white pl-9 sm:text-sm border-gray-300 h-7 dark:bg-dark-level-one dark:rounded-none dark:bg-dark-level-one"
              placeholder="Search storages"
              spellCheck="false"
              onChange={(e) =>
                dispatch(moveFromsetSearchFieldStorage({searchField: e.target.value}))
              }
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-0 sm:ml-6">
          <button
            type="button"
            onClick={() => getAllStor()}
            disabled={getLoadingButton || storageLoading}
            title="Load all storage units that match the search and Hide full filter (fetch contents into the table below)"
            aria-label="Load all filtered storage units"
            className={classNames(btnPrimary, 'order-1 shrink-0 gap-2 px-3 py-2 sm:order-0')}
          >
            <CheckIcon
              className="h-4 w-4 shrink-0 text-gray-700 dark:text-dark-white"
              aria-hidden="true"
            />
            <span className="hidden md:inline">Load all</span>
          </button>
          <button
            type="button"
            onClick={() => unMarkAllStorages()}
            title="Clear all loaded storage units, the item list, and any quantities queued to move"
            aria-label="Clear all loaded storage units and move queue"
            className={classNames(btnDefault, 'order-1 shrink-0 gap-2 px-3 py-2 sm:order-0')}
          >
            <XMarkIcon
              className="h-4 w-4 shrink-0 text-gray-700 dark:text-dark-white"
              aria-hidden="true"
            />
            <span className="hidden md:inline">Clear all</span>
          </button>

          <button
            type="button"
            className={classNames(btnPrimary, 'order-last shrink-0 px-3 py-2')}
            onClick={() => refreshInventory()}
            title="Refresh Steam inventory"
            aria-label="Refresh inventory"
          >
            {getLoadingButton ? (
              <LoadingButton />
            ) : (
              <ArrowPathIcon
                className="h-4 w-4 text-gray-500 dark:text-dark-white"
                aria-hidden="true"
              />
            )}
          </button>
          <span className="shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide dark:text-dark-white">
            Hide full
          </span>
          <Switch
            checked={fromReducer.hideFull}
            onChange={() => dispatch(moveFromSetFull())}
            className={classNames(
              fromReducer.hideFull
                ? 'bg-kryo-navy-800 dark:bg-kryo-navy-900 ring-1 ring-inset ring-kryo-ice-400/25'
                : 'bg-gray-200 dark:bg-dark-level-four',
              'relative inline-flex shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none'
            )}
          >
            <span
              className={classNames(
                fromReducer.hideFull ? 'translate-x-5' : 'translate-x-0',
                'pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white  shadow transform ring-0 transition ease-in-out duration-200'
              )}
            >
              <span
                className={classNames(
                  fromReducer.hideFull
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
                  fromReducer.hideFull
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
        </div>
      </div>
      {storageRows.length != 0 ? (
        <ul
          role="list"
          className="mx-auto mt-3 grid w-full max-w-full justify-center gap-2 [grid-template-columns:repeat(auto-fill,minmax(12.5rem,1fr))]"
        >
          {storageRows.map((project) => (
              <li
                key={project.item_id}
                className={classNames(
                  getLoadingButton
                    ? 'pointer-events-none	'
                    : 'pointer-events-auto',
                  'relative col-span-1  flex shadow-xs rounded-md'
                )}
              >
                <Link
                  to=""
                  className={classNames(
                    project.item_customname != null ? '' : 'pointer-events-none'
                  )}
                  onClick={() => getStorageData(project as ItemRowStorage)}
                  key={project.item_id}
                >
                  <div
                    className={classNames(
                      fromSelector.activeStorages.includes(project.item_id)
                        ? 'border-green-300 '
                        : 'border-gray-200 ',
                      'shrink-0 h-full flex items-center justify-center min-w-12 px-2 py-1.5 dark:border-opacity-50 text-white border-t border-l border-b rounded-l-md dark:bg-dark-level-two overflow-hidden'
                    )}
                  >
                    <StorageUnitImg
                      srcKey={project.item_url}
                      active={fromSelector.activeStorages.includes(project.item_id)}
                    />
                  </div>
                </Link>
                <div
                  className={classNames(
                    fromSelector.activeStorages.includes(project.item_id)
                      ? 'border-green-300'
                      : 'border-gray-200',
                    'flex-1 dark:bg-dark-level-two dark:border-opacity-50 flex items-center justify-between gap-0 border-t border-r border-b bg-white rounded-r-md truncate min-w-0'
                  )}
                >
                  <Link
                    to=""
                    onClick={() => getStorageData(project as ItemRowStorage)}
                    className={classNames(
                      project.item_customname != null
                        ? ''
                        : 'pointer-events-none'
                    )}
                    key={project.item_id}
                  >
                    <div className="min-w-0 flex-1 px-1 py-px text-sm leading-tight dark:text-dark-white truncate sm:text-base">
                      {project.item_customname != null ? (
                        project.item_customname
                      ) : (
                        <Link
                          to=""
                          onClick={() =>
                            dispatch(
                              setRenameModal(
                                {
                                  itemID: project.item_id,
                                  itemName: project.item_customname !== null
                                  ? project.item_customname
                                  : project.item_name
                                }
                              )
                            )
                          }
                          className={classNames(
                            'block text-base text-blue-800 pointer-events-auto	'
                          )}
                        >
                          {' '}
                          Activate me
                        </Link>
                      )}
                      <p className="mt-0.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-snug break-words">
                        {project.item_storage_total} Items
                        {totalDict[project.item_id] != undefined
                          ? ' | ' +
                            new Intl.NumberFormat(settingsData.locale, {
                              style: 'currency',
                              currency: settingsData.currency,
                              minimumFractionDigits: 0,
                            }).format(Number(totalDict[project.item_id].toFixed(0)))
                          : project.storage_id}
                      </p>
                    </div>
                  </Link>
                  <Menu as="div" className="relative shrink-0 self-center pr-0.5">
                    <Menu.Button className="h-7 w-7 inline-flex items-center justify-center text-gray-400 rounded hover:text-gray-500">
                      <span className="sr-only">Open options</span>
                      <EllipsisVerticalIcon
                        className="w-3 h-3"
                        aria-hidden="true"
                      />
                    </Menu.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <MenuItems className="z-10 mx-3 origin-top-right absolute right-7 top-3 w-48 mt-1 rounded-md shadow-lg bg-white dark:bg-dark-level-three ring-1 ring-black ring-opacity-5 divide-y divide-gray-200 dark:divide-gray-800 focus:outline-none">
                        <div className="py-1">
                          <MenuItem>
                            {({ active }) => (
                              <Link
                                to=""
                                onClick={() =>
                                  dispatch(
                                    setRenameModal(
                                      {
                                        itemID: project.item_id,
                                        itemName: project.item_customname !== null
                                        ? project.item_customname
                                        : project.item_name
                                      }
                                    )
                                  )
                                }
                                className={classNames(
                                  active
                                    ? 'bg-gray-100 text-gray-900 dark:bg-dark-level-four'
                                    : 'text-gray-700 dark:text-dark-white',
                                  'block px-4 py-2 text-sm dark:text-dark-white'
                                )}
                              >
                                {' '}
                                Rename
                              </Link>
                            )}
                          </MenuItem>
                        </div>
                      </MenuItems>
                    </Transition>
                  </Menu>
                </div>
              </li>
          ))}
        </ul>
      ) : (
        <EmptyComponent />
      )}
    </div>
  );
}

export default function StorageSelectorContent() {
  return content();
}
