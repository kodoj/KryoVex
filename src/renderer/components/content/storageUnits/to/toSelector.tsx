import { Menu, Transition, Switch, MenuItems, MenuItem } from '@headlessui/react';
import { EllipsisVerticalIcon, ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { Fragment, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { setRenameModal } from 'renderer/store/slices/modalRename.ts';
import {
  moveToAddTo,
  moveToSetFull,
  moveToSetHide,
  moveToSetSearchStorage,
  selectMoveTo,
} from 'renderer/store/slices/moveTo.ts';
import { IMAGE_FALLBACK_DATA_URI } from 'renderer/functionsClasses/createCSGOImage.ts';
import { markImageError, useCs2Image } from 'renderer/hooks/useCs2Image.ts';
import EmptyComponent from '../../shared/emptyState.tsx';
import { btnPrimary } from '../../shared/buttonStyles.ts';
import { classNames } from '../../shared/filters/inventoryFunctions.ts';
import RenameModal from '../../shared/modals-notifcations/modalRename.tsx';
import { selectInventory } from 'renderer/store/slices/inventory.ts';

function StorageUnitImg({
  srcKey,
  active,
}: {
  srcKey: string;
  active: boolean;
}) {
  const src = useCs2Image(srcKey, { fallback: IMAGE_FALLBACK_DATA_URI });
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
        img.src = IMAGE_FALLBACK_DATA_URI;
      }}
    />
  );
}


function content() {
  const dispatch = useDispatch();

  const inventory = useSelector(selectInventory);
  const toSelector = useSelector(selectMoveTo);

  // Clear all filters

  // This will return and convert a specific units data
  async function getStorageData(storageID: any, casketVolume: any) {
    dispatch(moveToAddTo({casketID: storageID, casketVolume}));
    // dispatch(moveToClearAll());
  }

  // Get the inventory
  async function refreshInventory() {
    window.electron.ipcRenderer.refreshInventory();
  }

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

  let inventoryToUse = inventory.inventory;

  const storageRows = useMemo(() => {
    const search = (toSelector.searchInputStorage || '').toLowerCase();
    const hideEmpty = toSelector.doHide;
    const hideFull = toSelector.hideFull;
    return inventoryToUse
      .filter((row) => {
        if (!row.item_url?.includes('casket')) return false;
        if (row.item_storage_total == 0 && hideEmpty) return false;
        if (search && !row?.item_customname?.toLowerCase()?.includes(search)) return false;
        if (row.item_storage_total == 1000 && hideFull) return false;
        return true;
      })
      .sort((a, b) => {
        const aName = a.item_customname ?? '0000';
        const bName = b.item_customname ?? '0000';
        return sortRun(aName, bName);
      });
  }, [
    inventoryToUse,
    toSelector.searchInputStorage,
    toSelector.doHide,
    toSelector.hideFull,
  ]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 dark:bg-dark-level-one">
      <RenameModal />
      <div className="border-gray-200 px-4 py-4 sm:flex sm:items-center sm:justify-between ">

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="shrink-0 text-xs font-medium uppercase tracking-wide text-gray-500">
          Storage units
        </h2>
        <label htmlFor="search-storage-to" className="sr-only">
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
                id="search-storage-to"
                value={toSelector.searchInputStorage}
                className="block w-full pb-0.5  focus:outline-none dark:text-dark-white pl-9 sm:text-sm border-gray-300 h-7 dark:bg-dark-level-one dark:rounded-none dark:bg-dark-level-one"
                placeholder="Search storages"
                spellCheck="false"
                onChange={(e) =>
                  dispatch(moveToSetSearchStorage({searchField: e.target.value}))
                }
              />
            </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-0 sm:ml-6">
          <Link
            to=""
            type="button"
            className={classNames(btnPrimary, 'order-1 shrink-0 px-3 py-2 sm:order-0')}
            onClick={() => refreshInventory()}
          >
            <ArrowPathIcon className="h-4 w-4 text-gray-500 dark:text-dark-white" aria-hidden="true" />
          </Link>
          <span className="shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide dark:text-dark-white">
            Hide empty
          </span>
          <Switch
            checked={toSelector.doHide}
            onChange={() => dispatch(moveToSetHide())}
            className={classNames(
              toSelector.doHide ? 'bg-kryo-navy-800 dark:bg-kryo-navy-900 ring-1 ring-inset ring-kryo-ice-400/25' : 'bg-gray-200 dark:bg-dark-level-four',
              'relative inline-flex shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none'
            )}
          >
            <span
              className={classNames(
                toSelector.doHide ? 'translate-x-5' : 'translate-x-0',
                'pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200'
              )}
            >
              <span
                className={classNames(
                  toSelector.doHide
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
                  toSelector.doHide
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
          <span className="shrink-0 text-gray-500 text-xs font-medium uppercase tracking-wide dark:text-dark-white">
            Hide full
          </span>
          <Switch
            checked={toSelector.hideFull}
            onChange={() => dispatch(moveToSetFull())}
            className={classNames(
              toSelector.hideFull ? 'bg-kryo-navy-800 dark:bg-kryo-navy-900 ring-1 ring-inset ring-kryo-ice-400/25' : 'bg-gray-200 dark:bg-dark-level-four',
              'relative inline-flex shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none'
            )}
          >
            <span
              className={classNames(
                toSelector.hideFull ? 'translate-x-5' : 'translate-x-0',
                'pointer-events-none relative inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200'
              )}
            >
              <span
                className={classNames(
                  toSelector.hideFull
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
                  toSelector.hideFull
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
                  'pointer-events-auto relative col-span-1 flex shadow-xs rounded-md'
                )}
              >
                <Link
                  to=""
                  className={classNames(
                    project.item_customname != null ? '' : 'pointer-events-none'
                  )}
                  onClick={() =>
                    getStorageData(project.item_id, project.item_storage_total)
                  }
                  key={project.item_id}
                >
                  <div
                    className={classNames(
                      toSelector.activeStorages.includes(project.item_id)
                          ? 'border-green-300 '
                          : 'border-gray-200 ',
                      'shrink-0 h-full flex items-center justify-center min-w-12 px-2 py-1.5 dark:border-opacity-50 text-white border-t border-l border-b rounded-l-md dark:bg-dark-level-two overflow-hidden'
                    )}
                  >
                    <StorageUnitImg
                      srcKey={project.item_url}
                      active={toSelector.activeStorages.includes(project.item_id)}
                    />
                  </div>
                </Link>
                <div
                  className={classNames(
                    toSelector.activeStorages.includes(project.item_id)
                      ? 'border-green-300'
                      : 'border-gray-200',
                    'min-w-0 flex-1 dark:bg-dark-level-two dark:border-opacity-50 flex items-stretch justify-between gap-1 border-t border-r border-b bg-white rounded-r-md'
                  )}
                >
                  <Link
                    to=""
                    onClick={() =>
                      getStorageData(
                        project.item_id,
                        project.item_storage_total
                      )
                    }
                    className={classNames(
                      project.item_customname != null
                        ? ''
                        : 'pointer-events-none',
                      'min-w-0 flex-1 overflow-hidden py-0.5 pl-1 pr-0'
                    )}
                    key={project.item_id}
                  >
                    <div className="text-base leading-tight dark:text-dark-white">
                      {project.item_customname != null ? (
                        <div className="truncate">{project.item_customname}</div>
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
                      <p className="mt-0.5 text-xs sm:text-sm text-gray-500 leading-snug break-words dark:text-gray-400">
                        {project.item_storage_total} Items
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
