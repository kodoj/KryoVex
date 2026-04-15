import items from './index.mjs';

// RUN PROGRAMS
class fetchItems {
  itemsClass = new items();
  constructor() {}

  async convertInventory(inventory) {
    const total = inventory && typeof inventory === 'object'
      ? Object.keys(inventory).length
      : 0;
    console.log(`[inventory] convertInventory:start total=${total}`);
    try {
      const responseFiltered = this.itemsClass.inventoryConverter(
        inventory,
        false
      );
      console.log(
        `[inventory] convertInventory:done total=${total} converted=${responseFiltered.length}`
      );
      return responseFiltered;
    } catch (error) {
      console.error('[inventory] convertInventory:failed', error);
      throw error;
    }
  }
  async convertStorageData(inventory) {
    const total = inventory && typeof inventory === 'object'
      ? Object.keys(inventory).length
      : 0;
    console.log(`[inventory] convertStorageData:start total=${total}`);
    try {
      const responseFiltered = this.itemsClass.inventoryConverter(
        inventory,
        true
      );
      console.log(
        `[inventory] convertStorageData:done total=${total} converted=${responseFiltered.length}`
      );
      return responseFiltered;
    } catch (error) {
      console.error('[inventory] convertStorageData:failed', error);
      throw error;
    }
  }
}

export default fetchItems;
