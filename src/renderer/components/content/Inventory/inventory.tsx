import InventoryFilters from './filterHeader.tsx';
import InventoryRowsComponent from './inventoryRows.tsx';
import { useState } from 'react';
import { LoadingButton } from '../shared/animations.tsx';
import { ArrowPathIcon } from '@heroicons/react/24/solid';
import { btnPrimary } from '../shared/buttonStyles.ts';
import { classNames } from '../shared/filters/inventoryFunctions.ts';

export default function content() {
  const [getLoadingButton, setLoadingButton] = useState(false);
  setLoadingButton;

  // Get the inventory
  async function refreshInventory() {
    window.electron.ipcRenderer.refreshInventory();
  }

  return (
    <>
      {/* Page title & actions */}
      <div className="frost-sep-b border-b-0 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-medium leading-6 text-gray-900 dark:text-dark-white  sm:truncate">
            Inventory
          </h1>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 sm:mt-0 sm:ml-4">
          <button
            type="button"
            onClick={() => refreshInventory()}
            className={classNames(btnPrimary, 'order-1 ml-3 px-4 py-2 sm:order-0 sm:ml-0')}
            title="Refresh CS2 inventory from Steam"
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
        </div>
      </div>
      {/* Pinned projects */}
      <InventoryFilters />

      {/* Projects list (only on smallest breakpoint) */}
      <div className="mt-10 sm:hidden">
        <div className="px-4 sm:px-6">
          <h2 className="text-gray-500 text-xs font-medium uppercase tracking-wide">
            Storages
          </h2>
        </div>
      </div>

      {/* Projects table (small breakpoint and up) — block + full width so scroll clientWidth ≠ table width (window-fit works) */}
      <div className="frost-sep-b hidden w-full min-w-0 border-b-0 bg-dark-level-one px-2 py-3 sm:block sm:px-3">
        <InventoryRowsComponent />
      </div>
    </>
  );
}