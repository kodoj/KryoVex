import items from './index.mjs';

// RUN PROGRAMS
class fetchItems {
  itemsClass = new items();
  constructor() {}

  async convertInventory(inventory) {
    const responseFiltered = this.itemsClass.inventoryConverter(
      inventory,
      false
    );
    return responseFiltered;
  }
  async convertStorageData(inventory) {
    const responseFiltered = this.itemsClass.inventoryConverter(
      inventory,
      true
    );
    return responseFiltered;
  }
}

export default fetchItems;