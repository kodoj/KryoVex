
import { inventorySetSortStorage } from "renderer/store/inventory/inventoryActions.tsx";
import { setSort } from "renderer/store/slices/moveFrom.ts";
import { sortDataFunction } from "../../shared/filters/inventoryFunctions.ts";
import { selectInventory } from "renderer/store/slices/inventory.ts";
import { useSelector } from "react-redux";
import { selectPricing } from "renderer/store/slices/pricing.ts";
import { selectSettings } from "renderer/store/slices/settings.ts";
import { selectInventoryFilters } from "renderer/store/slices/inventoryFilters.ts";

export async function onSortChange(dispatch: Function, sortValue: string) {
    dispatch(setSort({sortValue}));
    
    const pricing = useSelector(selectPricing);
    const settings = useSelector(selectSettings);
    const inventory = useSelector(selectInventory);
    const inventoryFilters = useSelector(selectInventoryFilters);

    const storageResult = await sortDataFunction(
      sortValue,
      inventory.storageInventory,
      pricing.prices, settings?.source?.title
    );
    const storageResultFiltered = await sortDataFunction(
      sortValue,
      inventoryFilters.storageFiltered,
      pricing.prices, settings?.source?.title
    );
    dispatch(inventorySetSortStorage(storageResult, storageResultFiltered));
  }
