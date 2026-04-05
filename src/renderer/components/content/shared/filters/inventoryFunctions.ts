// src/renderer/components/content/shared/filters/inventoryFunctions.ts
import { setSort } from 'renderer/store/slices/inventoryFilters.ts';
import { itemCategories, itemSubCategories } from '../categories.tsx';
import { ItemRow, ItemRowStorage, Prices, SubPrices } from 'renderer/interfaces/states.ts';

// Type alias for clarity: assuming Inventory is a state object, but functions operate on arrays
type InventoryArray = Array<ItemRow | ItemRowStorage>; // Use this for list params/returns

// Helper to get categories and enhance items
function getCategory(toLoopThrough: InventoryArray, additionalObjectToAdd: Record<string, any> = {}): InventoryArray {
  let returnArray: InventoryArray = [];
  let itemIdsFiltered: Array<string> = [];
  for (const [, value] of Object.entries(itemCategories)) {
    let result = toLoopThrough.filter(itemRow => itemRow.item_url.includes(value.value));
    result = result.map((el) => {
      itemIdsFiltered.push(el.item_id)
      let o = { ...el }; // Modern spread for object copy
      o.category = value.name
      o.bgColorClass = value.bgColorClass
      // Major
      const majorRegex = new RegExp('(?:' + Object.keys(itemSubCategories.majors).join('|') + ')', 'g')
      const majorMatch = el.item_name.match(majorRegex);
      if (majorMatch) {
        o.major = majorMatch[0]
      }
      // Additional keys to add
      for (const [keyToAdd, valueToAdd] of Object.entries(additionalObjectToAdd)) {
        o[keyToAdd] = valueToAdd
      }
      return o;
    })
    returnArray.push(...result)
  }
  // If any items are left behind - ie doesn't fit in a category, we add it back to the array.
  if (toLoopThrough.length !== returnArray.length) {
    returnArray.push(...toLoopThrough.filter(itemRow => !itemIdsFiltered.includes(itemRow.item_id)));
  }
  return returnArray
}

// Combine inventory by grouping similar items
export default function combineInventory(thisInventory: InventoryArray, settings: any, additionalObjectToAdd: Record<string, any> = {}): InventoryArray { // Removed async (no awaits); returns array
  const seenProducts = new Set<string>(); // Use Set for faster lookups
  const newInventory: Array<ItemRow | ItemRowStorage & { combined_ids: string[]; combined_QTY: number }> = []; // Enhanced type for clarity
  for (const value of thisInventory) { // Simplified loop (no Object.entries needed for array)
    // Create a string that matches the conditions
    let wearName = value['item_wear_name'] ?? 0
    let valueConditions =
      value['item_name'] +
      (value['item_customname'] ?? '') +  // Coerce null to '' for consistency
      value['item_url'] +
      value['trade_unlock'] +
      value['item_moveable'] +
      value['item_has_stickers'] +
      wearName +
      value['stickers'];
    if (value['item_paint_wear'] !== undefined && settings.columns.includes('Float')) {
      valueConditions += value['item_paint_wear'];
    }
    // Filter the inventory
    if (!seenProducts.has(valueConditions)) {
      const matchingItems = thisInventory.filter((item) => {
        let wearName = item['item_wear_name'] ?? 0
        let itemConditions =
          item['item_name'] +
          (item['item_customname'] ?? '') +  // Coerce null to ''
          item['item_url'] +
          item['trade_unlock'] +
          item['item_moveable'] +
          item['item_has_stickers'] +
          wearName +
          item['stickers'];
        if (item['item_paint_wear'] !== undefined && settings.columns.includes('Float')) {
          itemConditions += item['item_paint_wear'];
        }
        return itemConditions === valueConditions;
      });
      // Get all ids
      const valuedList = matchingItems.map((item) => item['item_id']);
      let newDict = { ...matchingItems[0] }; // Spread for copy
      newDict['combined_ids'] = valuedList;
      newDict['combined_QTY'] = valuedList.length;
      newInventory.push(newDict);
      // Push the seen conditions to avoid duplicates
      seenProducts.add(valueConditions);
    }
  }
  return getCategory(newInventory, additionalObjectToAdd);
}

export function filterInventory(
  combinedInventory: InventoryArray, // Changed to array type (fixes spread iterator error)
  filtersData: string[], // Assumed array of filter strings; adjust if object
  sortData: string, // Assumed sortValue type
  prices: Prices | SubPrices,
  pricingSource: string
): Promise<InventoryArray> { // Return array promise (fixes assignment error)
  let filteredInventory: InventoryArray = [...combinedInventory]; // Copy to avoid mutating original (now iterable as array)
  // First Categories (command '2')
  for (const value of filtersData) { // Simplified loop
    let command = value.substring(0, 1);
    let valued = value.substring(1);
    // Second filter
    if (command === '2') {
      filteredInventory = filteredInventory.filter((item) => item.item_url.includes(valued)); // Simplified includes
    }
  }
  // First and third check
  for (const value of filtersData) {
    let command = value.substring(0, 1);
    let valued = value.substring(1);
    let secondValued = valued.slice(0, -1);
    // First filter (command '1')
    if (command === '1') {
      filteredInventory = filteredInventory.filter((item) => {
        if (valued === 'trade_unlock' && item[`${valued}`] != null) {
          return true;
        }
        if (valued === 'item_customname' && item[`${valued}`] != null) {
          return true;
        }
        return item[`${valued}`] === true;
      });
    }
    if (command === '3') {
      filteredInventory = filteredInventory.filter((item) => {
        if (secondValued === 'trade_unlock' && item[`${secondValued}`] == null) {
          return true;
        }
        if (valued === 'econ/tools/casket') {
          return !item.item_url.includes(valued);
        }
        return false;
      });
    }
    if (command === '4') {
      filteredInventory = filteredInventory.filter((item) => {
        if (valued === 'econ/tools/casket') {
          return item.item_url.includes(valued);
        }
        return false;
      });
    }
  }
  return sortDataFunction(
    sortData,
    filteredInventory,
    prices,
    pricingSource
  );
}

export function classNames(...classes: (string | undefined | null | false)[]): string { // Enhanced type for robustness
  return classes.filter(Boolean).join(' ');
}

// Sort change handler (dispatch action)
export function onSortChange(dispatch: Function, sortValue: string) { // Removed async (no awaits)
  dispatch(setSort({ sortValue })); // Payload as object for RTK
}

type SortOffThreadTarget = {
  kind: 'number' | 'string';
  keys: Array<number> | Array<string>;
  tie: string[];
  ids: string[];
};

let __sortWorker: Worker | null = null;
let __sortWorkerNextId = 1;
const __sortWorkerPending = new Map<number, { resolve: (v: number[]) => void; reject: (e: any) => void }>();

function getSortWorker(): Worker {
  if (__sortWorker) return __sortWorker;
  __sortWorker = new Worker(new URL('../../../../workers/sortWorker.ts', import.meta.url), { type: 'module' });
  __sortWorker.onmessage = (ev: MessageEvent<any>) => {
    const id = ev?.data?.id;
    const indices = ev?.data?.indices;
    const pending = typeof id === 'number' ? __sortWorkerPending.get(id) : undefined;
    if (!pending) return;
    __sortWorkerPending.delete(id);
    pending.resolve(Array.isArray(indices) ? indices : []);
  };
  __sortWorker.onerror = (err) => {
    // Fail all pending
    for (const [, p] of __sortWorkerPending) p.reject(err);
    __sortWorkerPending.clear();
  };
  return __sortWorker;
}

function normalizedNameKey(row: any): string {
  return String(row?.item_name ?? '').replace(/★/g, '').replace(/\s+/g, '').toLowerCase();
}

function priceKey(row: any, prices: any): number {
  const key =
    String(row?.item_name ?? '').replaceAll('(Holo/Foil)', '(Holo-Foil)') +
    (row?.item_wear_name ? ` (${row.item_wear_name})` : '');
  const unit = Number(prices?.[key]?.steam_listing ?? 0);
  const qty = Number(row?.combined_QTY ?? 1);
  return unit * qty;
}

function buildOffThreadTarget(
  sortValue: string,
  inventory: InventoryArray,
  prices: any
): SortOffThreadTarget {
  const ids = inventory.map((r: any) => String(r?.item_id ?? ''));
  const tie = inventory.map((r: any) => normalizedNameKey(r));

  switch (sortValue) {
    case 'QTY':
      return { kind: 'number', keys: inventory.map((r: any) => Number(r?.combined_QTY ?? 0)), tie, ids };
    case 'Price':
      return { kind: 'number', keys: inventory.map((r: any) => priceKey(r, prices)), tie, ids };
    case 'wearValue':
      return { kind: 'number', keys: inventory.map((r: any) => Number(r?.item_paint_wear ?? Number.NaN)), tie, ids };
    case 'Rarity':
      return { kind: 'number', keys: inventory.map((r: any) => Number(r?.rarity ?? 99)), tie, ids };
    case 'Stickers':
      return { kind: 'number', keys: inventory.map((r: any) => Number(r?.stickers?.length ?? 0)), tie, ids };
    case 'tradehold': {
      const now = Date.now();
      return {
        kind: 'number',
        keys: inventory.map((r: any) => {
          const t = r?.trade_unlock?.getTime?.();
          return Number.isFinite(t) ? (t - now) : 0;
        }),
        tie,
        ids,
      };
    }
    case 'StorageName':
      return { kind: 'string', keys: inventory.map((r: any) => String((r as any)?.storage_name ?? '').toLowerCase()), tie, ids };
    case 'Collection':
      return { kind: 'string', keys: inventory.map((r: any) => String(r?.collection ?? '').toLowerCase()), tie, ids };
    case 'Product name':
      return { kind: 'string', keys: inventory.map((r: any) => String(r?.item_name ?? '').toLowerCase()), tie, ids };
    case 'Category':
      return { kind: 'string', keys: inventory.map((r: any) => String(r?.category ?? '').toLowerCase()), tie, ids };
    default:
      return { kind: 'string', keys: tie, tie, ids };
  }
}

export async function sortDataFunctionOffThread(
  sortValue: string,
  inventory: InventoryArray,
  prices: Prices | SubPrices,
  _pricingSource: string
): Promise<InventoryArray> {
  // pricingSource currently not needed (we use steam_listing), keep signature aligned.
  const worker = getSortWorker();
  const id = __sortWorkerNextId++;
  const target = buildOffThreadTarget(sortValue, inventory, prices as any);
  const payload: any = { id, kind: target.kind, keys: target.keys, tie: target.tie, ids: target.ids };
  const indices = await new Promise<number[]>((resolve, reject) => {
    __sortWorkerPending.set(id, { resolve, reject });
    worker.postMessage(payload);
  });
  const out: InventoryArray = [];
  for (const i of indices) out.push(inventory[i]);
  return out;
}

// Unified sort function (merged sortDataFunction and sortDataFunctionTwo; removed duplication)
export function sortDataFunctionSync(
  sortValue: string,
  inventory: InventoryArray,
  prices: Prices | SubPrices,
  _pricingSource: string
): InventoryArray {
  function sortRun(valueOne: string | number | null | undefined, valueTwo: string | number | null | undefined, useNaN = false): number { // Added null to param types
    if (valueOne == null) valueOne = -90000000000; // Handle null as low value
    if (valueTwo == null) valueTwo = -90000000000;
    if (valueOne < valueTwo) return -1;
    if (valueOne > valueTwo) return 1;
    if (useNaN && isNaN(valueOne as number)) return -1;
    return 0;
  }

  function sortRunAlt(valueOne: number, valueTwo: number): number {
    if (isNaN(valueOne)) valueOne = -90000000000;
    if (isNaN(valueTwo)) valueTwo = -90000000000;
    if (valueOne < valueTwo) return -1;
    if (valueOne > valueTwo) return 1;
    return 0;
  }

  const sortedInventory: InventoryArray = [...inventory];

  // Precompute a normalized name once per item to avoid expensive string ops inside sort comparators.
  const nameKeyById = new Map<string, string>();
  for (const item of sortedInventory) {
    const id = String(item.item_id ?? '');
    if (!nameKeyById.has(id)) {
      nameKeyById.set(
        id,
        String(item.item_name ?? '').replace(/★/g, '').replace(/\s+/g, '')
      );
    }
  }

  // Single-sort strategy: primary comparator based on sortValue, stable-ish tie-break on normalized name.
  function byName(a: any, b: any) {
    return sortRun(nameKeyById.get(String(a.item_id)) ?? '', nameKeyById.get(String(b.item_id)) ?? '');
  }

  // Special case: Storages
  if (sortValue === 'Storages') {
    sortedInventory.sort((a, b) => {
      const c = sortRun(a.item_customname ?? '', b.item_customname ?? '');
      return c !== 0 ? c : byName(a, b);
    });
    return sortedInventory;
  }

  switch (sortValue) {
    case 'Default':
      sortedInventory.sort((a, b) => {
        const c = sortRun(a.item_id, b.item_id);
        return c !== 0 ? c : byName(a, b);
      });
      break;
    case 'Product name':
      sortedInventory.sort((a, b) => {
        const aName = String(a.item_name ?? '').toLowerCase();
        const bName = String(b.item_name ?? '').toLowerCase();
        const c = sortRun(aName, bName, true);
        return c !== 0 ? c : byName(a, b);
      });
      break;
    case 'Category':
      sortedInventory.sort((a, b) => {
        const c = sortRun(a.category, b.category);
        return c !== 0 ? c : byName(a, b);
      });
      break;
    case 'QTY':
      sortedInventory.sort((a, b) => {
        // combined_QTY can arrive as string; force numeric compare.
        const aQty = Number(a.combined_QTY ?? 0);
        const bQty = Number(b.combined_QTY ?? 0);
        const c = sortRunAlt(aQty, bQty);
        return c !== 0 ? c : byName(a, b);
      });
      break;
    case 'Price':
      sortedInventory.sort((a, b) => {
        // Pricing keys are normalized by `_getName` (and Redux stores `steam_listing`).
        const aKey =
          String(a.item_name ?? '').replaceAll('(Holo/Foil)', '(Holo-Foil)') +
          (a.item_wear_name ? ` (${a.item_wear_name})` : '');
        const bKey =
          String(b.item_name ?? '').replaceAll('(Holo/Foil)', '(Holo-Foil)') +
          (b.item_wear_name ? ` (${b.item_wear_name})` : '');
        const aUnit = (prices[aKey]?.steam_listing ?? 0);
        const bUnit = (prices[bKey]?.steam_listing ?? 0);
        const aVal = aUnit * (a.combined_QTY ?? 1);
        const bVal = bUnit * (b.combined_QTY ?? 1);
        const c = sortRunAlt(aVal, bVal);
        return c !== 0 ? c : byName(a, b);
      });
      break;
    case 'Stickers':
      sortedInventory.sort((a, b) => {
        const c = sortRunAlt(Number(a?.stickers?.length ?? 0), Number(b?.stickers?.length ?? 0));
        return c !== 0 ? c : byName(a, b);
      });
      break;
    case 'wearValue':
      sortedInventory.sort((a, b) => {
        const c = sortRunAlt(Number(a.item_paint_wear ?? Number.NaN), Number(b.item_paint_wear ?? Number.NaN));
        return c !== 0 ? c : byName(a, b);
      });
      break;
    case 'Collection':
      sortedInventory.sort((a, b) => {
        if (b == null) return -1; // Null check
        const c = sortRun(a.collection?.toLowerCase(), b.collection?.toLowerCase(), true);
        return c !== 0 ? c : byName(a, b);
      });
      break;
    case 'Rarity':
      sortedInventory.sort((a, b) => {
        let valueAToTest = a.rarity ?? 99;
        let valueBToTest = b.rarity ?? 99;
        const c = sortRunAlt(Number(valueAToTest), Number(valueBToTest));
        return c !== 0 ? c : byName(a, b);
      });
      break;
    case 'StorageName':
      sortedInventory.sort((a, b) => {
        const c = sortRun((a as ItemRowStorage)?.storage_name ?? '', (b as ItemRowStorage)?.storage_name ?? '');
        return c !== 0 ? c : byName(a, b);
      }); // Cast to ItemRowStorage and handle undefined as ''
      break;
    case 'tradehold':
      const now = new Date();
      sortedInventory.sort((a, b) => sortRun(
        //@ts-ignore
        (a?.trade_unlock?.getTime() ?? 0) - now.getTime(),
        //@ts-ignore
        (b?.trade_unlock?.getTime() ?? 0) - now.getTime(),
        true
      ));
      break;
    default:
      // No sort
  }

  return sortedInventory;
}

// Backwards-compatible async wrapper (many call sites `await` this).
export async function sortDataFunction(
  sortValue: string,
  inventory: InventoryArray,
  prices: Prices | SubPrices,
  pricingSource: string
): Promise<InventoryArray> {
  return sortDataFunctionSync(sortValue, inventory, prices, pricingSource);
}

// Removed sortDataFunctionTwo (merged into sortDataFunction)