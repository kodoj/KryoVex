
import { ItemRow, ItemRowStorage } from "renderer/interfaces/items.ts";
import { filterItemRows } from "renderer/functionsClasses/filters/custom.ts";
import { sortDataFunction } from "renderer/components/content/shared/filters/inventoryFunctions.ts";
import { setFilteredStorage } from "renderer/store/slices/inventoryFilters.ts";
import { setStorageBulkLoadActive } from "renderer/store/slices/inventory.ts";
import { store } from "renderer/store/configureStore.ts";
import {
  HandleStorageData,
  type HandleStorageDeps,
} from "./storageUnitsClass.tsx";

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
      const StorageClass = new HandleStorageData(dispatch, {
        ...deps,
        deferFilteredStorage: true,
      });
      for (const project of returnValue) {
        if (alreadyActive.has(project.item_id)) continue;
        await StorageClass.addStorage(project as ItemRowStorage, []);
      }
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
