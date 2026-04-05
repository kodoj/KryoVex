import { ItemRow, ItemRowStorage } from "renderer/interfaces/items.ts"
import { Filter } from "./filters.ts"
import { OverviewOptionsLeftCharts, OverviewOptionsRightCharts } from "./overview.tsx"

// Individual
export interface MoveModalPayload {
  number: number,
  itemID: string,
  isLast: boolean
}

// Query
export interface MoveModalQuery {
  payload: {
    key: string,
    storageID: string
  }
}

// Rename modal
export interface RenameModalPayload {
  itemID: string,
  itemName: string
}

// // Prices
interface pricingSources {
  // Example: steam_listing, skinport, buff163, bitskins
  steam_listing: number
  fromBackup?: boolean;
  /** When this listing was obtained (ms); used to avoid hammering Steam while backup is recent. */
  pricedAt?: number;
}
export interface SubPrices {
  [key: string]: pricingSources
}

export interface steamListing {
  success: boolean,
  lowest_price: string,
  volume: string,
  median_price: string
}

// // Settings
export interface WalletInterface {
  hasWallet: boolean
  currency: string
  balance: number
}

export interface source {
  title: string
  avatar: string
  name: string
}
// Store
export interface InventoryFilters {
  inventoryFilter: Array<Filter>
  storageFilter: Array<Filter>
  sortValue: string
  inventoryFiltered: Array<ItemRow>
  storageFiltered: Array<ItemRow>
  searchInput: string
  sortBack: boolean
  categoryFilter: Array<string>
  rarityFilter: Array<string>
}


export interface Inventory {
  inventory: Array<ItemRow>,
  combinedInventory: Array<ItemRow>,
  storageInventory: Array<ItemRowStorage>,
  storageInventoryRaw: Array<ItemRowStorage>
  totalAccountItems: number,
  itemsLookUp: { [itemID: string]: 'storage_units'  | 'inventory'  },
  /** True while "Load storage units" is fetching all caskets — pricing waits until this clears. */
  storageBulkLoadActive: boolean,
};

export interface InventoryNew {
  inventory: Array<ItemRow>,
  combinedInventory: Array<ItemRow>,
  storageInventory: Array<ItemRowStorage>,
  storageInventoryRaw: Array<ItemRowStorage>
  totalAccountItems: number,
};

export interface ModalMove {
  moveOpen: boolean,
  notifcationOpen: boolean,
  storageIdsToClearFrom: Array<string>,
  modalPayload: MoveModalPayload,
  doCancel: Array<string>,
  query: Array<MoveModalQuery>,
  totalFailed: number
};

export interface RenameModal {
  renameOpen: boolean,
  modalPayload: RenameModalPayload
};

export interface RenameModal {
  renameOpen: boolean,
  modalPayload: RenameModalPayload
};

export interface ModalTrade {
  moveOpen: boolean,
  openResult: boolean,
  inventoryFirst: Array<string>
  rowToMatch: ItemRow | {}
}

export interface MoveFromReducer {
  hideFull: boolean,
  activeStorages: Array<string>,
  totalToMove: Array<any>,
  totalItemsToMove: number,
  searchInput: string,
  searchInputStorage: string,
  sortValue: string,
  doCancel: Boolean,
  sortBack: Boolean,
}

export interface MoveToReducer {
  doHide: boolean,
  hideFull: boolean,
  activeStorages: Array<string>,
  activeStoragesAmount: number,
  totalToMove: Array<any>,
  totalItemsToMove: number,
  searchInput: string,
  searchInputStorage: string,
  sortValue: string,
  doCancel: Boolean,
  sortBack: Boolean,
};

export interface Prices {
  prices: SubPrices;
  storageAmount: number;
  productsRequested: Array<string>;
  isFetching: boolean;
  error: string | null;
  stats: { backupPct: string };
  fetchedCount: number;
  totalItems: number;
  activeSessionId?: string;
  activeSessionScope?: 'total' | 'storage' | 'inv';
  sessionSurfaceKeysStorage: Record<string, boolean>;
  sessionSurfaceKeysInv: Record<string, boolean>;
  sessionSurfaceDoneStorage: Record<string, boolean>;
  sessionSurfaceDoneInv: Record<string, boolean>;
  seenFresh: Record<string, boolean>;
  seenBackup: Record<string, boolean>;
  seenFail: Record<string, string>;
}
export interface Overview {
  by: string
  chartleft: keyof OverviewOptionsLeftCharts
  chartRight: keyof OverviewOptionsRightCharts
}
export interface Settings {
  fastMove: boolean;
  currency: string;
  locale: string;
  steamLoginShow: boolean;
  os: string;
  devmode: boolean;
  /** When true, trade-up review closes without moving items from storage or sending a CS2 craft. */
  tradeUpSimulateOnly: boolean;
  columns: Array<string>;
  /** Per-table resizable column widths: tableId -> colKey -> px */
  columnWidths: Record<string, Record<string, number>>;
  currencyPrice: { [key: string]: number };
  source: source;
  overview: Overview;
}


export interface TradeUpActions {
  tradeUpProducts: Array<ItemRowStorage>,
  tradeUpProductsIDS: Array<string>,
  possibleOutcomes: Array<ItemRow>,
  searchInput: string,
  MinFloat: number,
  MaxFloat: number,
  collections: Array<string>,
  options: Array<string>,
};

export interface AuthReducer {
  displayName: string | null ,
  CSGOConnection: boolean,
  userProfilePicture: string | null,
  steamID: string | null,
  isLoggedIn: boolean,
  hasConnection: boolean,
  walletBalance: WalletInterface
};

export interface State {
  authReducer: AuthReducer
  inventoryReducer: Inventory
  inventoryFiltersReducer: InventoryFilters
  modalMoveReducer: ModalMove
  modalRenameReducer: RenameModal
  moveFromReducer: MoveFromReducer
  moveToReducer: MoveToReducer
  settingsReducer: Settings
  pricingReducer: Prices
  tradeUpReducer: TradeUpActions
  modalTradeReducer: ModalTrade
}
export { Filter, ItemRow, ItemRowStorage }

