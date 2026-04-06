import combineInventory, {
  sortDataFunction,
} from 'renderer/components/content/shared/filters/inventoryFunctions.ts';
import { ItemRow, ItemRowStorage } from 'renderer/interfaces/items.ts';
import { setFilteredStorage } from 'renderer/store/slices/inventoryFilters.ts';
import { addStorageUnitsItems } from 'renderer/store/slices/inventory.ts';
import { moveFromAddCasketToStorages } from 'renderer/store/slices/moveFrom.ts';
import { filterItemRows } from '../filters/custom.ts';

export type HandleStorageDeps = {
  settings: any;
  moveFrom: any;
  pricing: any;
  inventoryFilters: any;
  inventory: any;
  /** When true (bulk "load all storages"), skip per-casket filtered view rebuild — caller refreshes once at the end. */
  deferFilteredStorage?: boolean;
};

export class HandleStorageData {
  dispatch: Function;
  deps: HandleStorageDeps;
  constructor(dispatch: Function, deps: HandleStorageDeps) {
    this.dispatch = dispatch;
    this.deps = deps;
  }

  /** IPC + combine (+ optional sort) only — no Redux. Used to batch bulk "load all storages". */
  async loadStoragePayload(storageRow: ItemRow, skipIntermediateSort: boolean) {
    return this._getStorageUnitData(storageRow, skipIntermediateSort);
  }

  async addStorage(storageRow: ItemRow, addArray: Array<ItemRow> = []) {
    const { settings, moveFrom, pricing, inventoryFilters, inventory, deferFilteredStorage } = this.deps;

    // Adding the casket ID
    this.dispatch(moveFromAddCasketToStorages({casketID: storageRow.item_id}));

    /** Bulk "load all" skips per-casket sort; merged list is sorted when refreshing filtered storage. */
    const skipIntermediateSort = deferFilteredStorage === true;
    // Fetch the storage unit data
    let storageResult = await this._getStorageUnitData(storageRow, skipIntermediateSort);
    if (addArray.length == 0) {
      addArray = inventory?.storageInventory ?? [];
    }
    if (!deferFilteredStorage) {
      let filteredStorage = await filterItemRows(
        [...addArray, ...storageResult.combinedStorages],
        inventoryFilters.storageFilter
      );
      filteredStorage = await sortDataFunction(
        moveFrom.sortValue,
        filteredStorage,
        pricing,
        settings?.source?.title
      );

      this.dispatch(setFilteredStorage(
        {storageFilter: inventoryFilters.storageFilter, storageFiltered: filteredStorage}
      ));
    }
    this.dispatch(
      addStorageUnitsItems({
        casketID: storageRow.item_id,
        storageData: storageResult.combinedStorages,
        storageRowsRaw: storageResult.rawStorages,
      })
    );
    return storageResult.combinedStorages
  }

  // Get storage unit
  async _getStorageUnitData(storageRow: ItemRow, skipSort = false) {
    const { settings, moveFrom, pricing } = this.deps;

    const storageResult = await window.electron.ipcRenderer.getStorageUnitData(
      storageRow.item_id,
      storageRow.item_customname
    );
    if (!storageResult || storageResult[0] !== 1) {
      return { combinedStorages: [], rawStorages: [] };
    }
    const returnData: Array<ItemRowStorage> = storageResult[1] ?? [];

    let finalReturnData = (combineInventory(
      returnData,
      settings,
      {
        storage_id: storageRow.item_id,
        storage_name: storageRow.item_customname,
      }
    )) as Array<ItemRowStorage>;
    if (!skipSort) {
      finalReturnData = await sortDataFunction(
        moveFrom.sortValue,
        finalReturnData,
        pricing.prices,
        settings?.source?.title
      ) as Array<ItemRowStorage>;
    }

    const fallbackName = storageRow.item_customname ?? 'Unknown Storage';
    const casketId = storageRow.item_id;
    for (const item of finalReturnData) {
      if (item.storage_name == null || item.storage_name === '') item.storage_name = fallbackName;
      if (!item.storage_id) item.storage_id = casketId;
    }

    returnData.forEach((element) => {
      element.storage_id = storageRow.item_id;
      element.storage_name = storageRow.item_customname as string;
    });

    return {
      combinedStorages: finalReturnData,
      rawStorages: returnData,
    };
  }
}
