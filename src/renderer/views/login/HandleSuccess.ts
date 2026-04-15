import combineInventory, { sortDataFunction } from "@/components/content/shared/filters/inventoryFunctions.ts";
import { filterItemRows } from "@/functionsClasses/filters/custom.ts";
import { DispatchIPC, DispatchStore } from "@/functionsClasses/rendererCommands/admin.tsx";
import { SignInActionPackage } from "renderer/interfaces/store/authReducerActionsInterfaces.tsx";
import { createCSGOImage } from "@/functionsClasses/createCSGOImage.ts";
import { store } from "@/store/configureStore.ts";
import { getURL } from "@/store/helpers/userStatusHelper.ts";
import { setFiltered } from "@/store/slices/inventoryFilters.ts";
import { setInventory as setInventoryAction } from "@/store/slices/inventory.ts";
import { signIn } from "@/store/slices/auth.ts";
import type { AppDispatch } from "@/store/configureStore.ts";
import type { LoginCommandReturnPackage } from "shared/Interfaces-tsx/store.ts";

async function getProfilePicture(steamID: string): Promise<string> {
  try {
    const profilePicture = await getURL(steamID);
    return profilePicture as string;
  } catch (error) {
    return createCSGOImage("econ/characters/customplayer_tm_separatist");
  }
}

export async function handleSuccess(returnSuccessPackage: LoginCommandReturnPackage, dispatch: AppDispatch) {
  const StoreClass = new DispatchStore(dispatch);
  const IPCClass = new DispatchIPC(dispatch);
  const state = store.getState();
  const inventoryFilters = state.inventoryFilters;
  const settings = state.settings;
  const pricing = state.pricing;

  StoreClass.run(StoreClass.buildingObject.source);
  StoreClass.run(StoreClass.buildingObject.locale);
  IPCClass.run(IPCClass.buildingObject.currency);

  const signInPackage: SignInActionPackage = {
    userProfilePicture: await getProfilePicture(returnSuccessPackage.steamID),
    displayName: returnSuccessPackage.displayName,
    CSGOConnection: returnSuccessPackage.haveGCSession,
    steamID: returnSuccessPackage.steamID,
    wallet: returnSuccessPackage.walletToSend
  };
  window.electron.ipcRenderer.debugLog('handleSuccess:login-package', {
    steamID: returnSuccessPackage.steamID,
    displayName: returnSuccessPackage.displayName,
    haveGCSession: returnSuccessPackage.haveGCSession,
    inventoryCount: returnSuccessPackage.cs2Inventory?.length ?? -1,
  });
  dispatch(signIn(signInPackage));

  window.electron.ipcRenderer.debugLog('handleSuccess:combine-start', {
    rawCount: returnSuccessPackage.cs2Inventory?.length ?? -1,
    firstItemName: returnSuccessPackage.cs2Inventory?.[0]?.item_name ?? null,
    firstItemUrl: returnSuccessPackage.cs2Inventory?.[0]?.item_url ?? null,
  });
  let combinedInventory;
  try {
    combinedInventory = await combineInventory(returnSuccessPackage.cs2Inventory, settings);
  } catch (error) {
    window.electron.ipcRenderer.debugLog('handleSuccess:combine-error', {
      message: error instanceof Error ? error.message : String(error),
      firstBrokenItem: returnSuccessPackage.cs2Inventory?.find((item) => !item?.item_url || !item?.item_name)?.item_id ?? null,
    });
    throw error;
  }
  window.electron.ipcRenderer.debugLog('handleSuccess:combined-inventory', {
    rawCount: returnSuccessPackage.cs2Inventory?.length ?? -1,
    combinedCount: combinedInventory?.length ?? -1,
  });
  dispatch(setInventoryAction({ inventory: returnSuccessPackage.cs2Inventory, combinedInventory }));
  if (returnSuccessPackage.cs2Inventory.length === 0) {
    console.warn('Inventory empty—triggering refresh');
    window.electron.ipcRenderer.debugLog('handleSuccess:inventory-empty-refresh', {
      inventoryCount: 0,
    });
    window.electron.ipcRenderer.refreshInventory();
  }

  let filteredInv;
  try {
    filteredInv = await filterItemRows(combinedInventory, inventoryFilters.inventoryFilter);
    filteredInv = await sortDataFunction(inventoryFilters.sortValue, filteredInv, pricing.prices, settings?.source?.title);
  } catch (error) {
    window.electron.ipcRenderer.debugLog('handleSuccess:filter-error', {
      message: error instanceof Error ? error.message : String(error),
      combinedCount: combinedInventory?.length ?? -1,
    });
    throw error;
  }
  window.electron.ipcRenderer.debugLog('handleSuccess:filtered-inventory', {
    filterCount: inventoryFilters.inventoryFilter?.length ?? -1,
    filteredCount: filteredInv?.length ?? -1,
    sortValue: inventoryFilters.sortValue,
  });
  dispatch(setFiltered({ inventoryFilter: inventoryFilters.inventoryFilter, sortValue: inventoryFilters.sortValue, inventoryFiltered: filteredInv }));
}
