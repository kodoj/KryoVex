
import { ItemRow } from "renderer/interfaces/items.ts";
import { InventoryFilters, MoveFromReducer, MoveToReducer } from "renderer/interfaces/states.ts";


export function searchFilter(itemsArray: Array<ItemRow>, inventoryFilters: InventoryFilters, chosenReducer: InventoryFilters  | MoveFromReducer  | MoveToReducer | undefined): Array<ItemRow> {
  const list = Array.isArray(itemsArray) ? itemsArray : [];
  let searchString: string = ''
  if (chosenReducer != undefined) {
    searchString = chosenReducer.searchInput
  }
  return list.filter(function (row) {

        if (
          inventoryFilters.categoryFilter.length != 0 ) {
           if (!inventoryFilters.categoryFilter?.includes(row.bgColorClass as string)) {
             return false
           }
          }
        if (
          row.item_name
            ?.toLowerCase()
            .trim()
            .includes(searchString?.toLowerCase().trim())
        ) {
          return true; // skip
        }
        if (
          row.item_wear_name
            ?.toLowerCase()
            .trim()
            .includes(searchString?.toLowerCase().trim())
        ) {
          return true; // skip
        }
        if (
          row.item_customname
            ?.toLowerCase()
            .trim()
            .includes(searchString?.toLowerCase().trim())
        ) {
          return true; // skip
        }
        if (searchString == undefined || searchString == '' ) {
          return true; // skip
        }
        return false;
      });
}
