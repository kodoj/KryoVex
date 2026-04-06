
import { ItemRow, ItemRowStorage } from "renderer/interfaces/items.ts";
import { filterItemRows } from "renderer/functionsClasses/filters/custom.ts";
import { sortDataFunction } from "renderer/components/content/shared/filters/inventoryFunctions.ts";
import { setFilteredStorage } from "renderer/store/slices/inventoryFilters.ts";
import {
  addStorageUnitsItemsBulk,
  setStorageBulkLoadActive,
  setStorageBulkLoadProgress,
} from "renderer/store/slices/inventory.ts";
import { moveFromAppendCaskets } from "renderer/store/slices/moveFrom.ts";
import { store } from "renderer/store/configureStore.ts";
import {
  HandleStorageData,
  type HandleStorageDeps,
} from "./storageUnitsClass.tsx";

/**
 * How many caskets to merge per `addStorageUnitsItemsBulk` dispatch.
 * Higher = fewer full-array scans (faster) but storage row counts jump in bigger steps.
 * `storageBulkLoadProgress` still updates every casket so Overview can show smooth status + spinners.
 */
const STORAGE_BULK_FLUSH_STRIDE = 3;

function sorting(valueOne: string | number, valueTwo: string | number) {
  if (valueOne < valueTwo) {
    return -1;
  }
  if (valueOne > valueTwo) {
    return 1;
  }
  return 0;
}
class Sort {
  itemArray: Array<ItemRow | ItemRowStorage>
  constructor(itemArray: Array<ItemRow | ItemRowStorage>) {
    this.itemArray = itemArray
  }

  async item_customname() {
    return this.itemArray.sort(function(a, b) {
      return sorting(a.item_customname || '0000', b.item_customname || '0000')
    })

  }
}

export async function getAllStorages(
  dispatch: Function,
  deps: Omit<HandleStorageDeps, "deferFilteredStorage">
) {
  const { inventory, moveFrom } = deps;
  // Filter the storage inventory
  const storageSearch = (moveFrom.searchInputStorage || '').toLowerCase();
  const casketResults = inventory.inventory.filter(function (row) {
    if (!row.item_url.includes('casket')) {
      return false; // skip
    }
    if (row.item_storage_total == 0) {
      return false; // skip
    }
    if (
      storageSearch !== '' &&
      !row?.item_customname?.toLowerCase()?.includes(storageSearch)
    ) {
      return false; // skip
    }
    if (row.item_storage_total == 1000 && moveFrom.hideFull) {
      return false; // skip
    }
    return true;
  });

  async function sendArrayAddStorage(returnValue: Array<ItemRow | ItemRowStorage>) {
    dispatch(setStorageBulkLoadActive(true));
    try {
      const alreadyActive = new Set(moveFrom.activeStorages);
      const toLoadQueue = returnValue.filter((p) => !alreadyActive.has(p.item_id));
      const totalPlan = toLoadQueue.length;
      if (totalPlan > 0) {
        dispatch(setStorageBulkLoadProgress({ done: 0, total: totalPlan }));
      }

      const StorageClass = new HandleStorageData(dispatch, {
        ...deps,
        deferFilteredStorage: true,
      });
      const pendingFlush: Array<{
        casketID: string;
        storageData: ItemRowStorage[];
        storageRowsRaw: ItemRowStorage[];
      }> = [];

      const flushPending = () => {
        if (pendingFlush.length === 0) return;
        dispatch(moveFromAppendCaskets({ casketIDs: pendingFlush.map((b) => b.casketID) }));
        dispatch(addStorageUnitsItemsBulk([...pendingFlush]));
        pendingFlush.length = 0;
      };

      let done = 0;
      for (const project of toLoadQueue) {
        const result = await StorageClass.loadStoragePayload(project as ItemRow, true);
        done += 1;
        dispatch(setStorageBulkLoadProgress({ done, total: totalPlan }));
        pendingFlush.push({
          casketID: project.item_id,
          storageData: result.combinedStorages,
          storageRowsRaw: result.rawStorages,
        });
        if (pendingFlush.length >= STORAGE_BULK_FLUSH_STRIDE) {
          flushPending();
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
        }
      }
      flushPending();
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const st = store.getState();
      const merged = st.inventory.storageInventory;
      let filteredStorage = await filterItemRows(merged as any, st.inventoryFilters.storageFilter);
      filteredStorage = await sortDataFunction(
        st.moveFrom.sortValue,
        filteredStorage,
        st.pricing as any,
        st.settings?.source?.title
      );
      dispatch(
        setFilteredStorage({
          storageFilter: st.inventoryFilters.storageFilter,
          storageFiltered: filteredStorage,
        })
      );
    } finally {
      dispatch(setStorageBulkLoadActive(false));
    }
  }

  // Handle storage data
  let SortingClass = new Sort(casketResults)
  return SortingClass.item_customname().then((returnValue) => {
    return sendArrayAddStorage(returnValue)
  })



}
