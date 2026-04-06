async function setCollections(currencyClass) {
  let collections = require('./backup/collections.json');

  const directory = {};
  for (const [key, value] of Object.entries(collections)) {
    // @ts-ignore
    const keys = Object.keys(value);
    keys.forEach((element) => {
      directory[element] = key;
    });
  }
  currencyClass.setCollections(collections, directory);
}

class tradeUps {
  collections = {};
  seenRates = {};
  directory = {};
  rarityLevels = {
    'Factory New': 0.07,
    'Minimal Wear': 0.15,
    'Field-Tested': 0.38,
    'Well-Worn': 0.45,
    'Battle-Scarred': 1,
  };

  constructor() {
    setCollections(this);
  }

  // Setup backup
  setCollections(converter, dir) {
    this.collections = converter;
    this.directory = dir;
  }

  // Get rarity
  getRarity(min_wear, max_wear, averageFloat) {
    let c = (max_wear - min_wear) * averageFloat
    for (const [key, value] of Object.entries(this.rarityLevels)) {
      // @ts-ignore
      let chance = (value - min_wear) / (max_wear - min_wear);
      if (chance > averageFloat) {
        return [key, c + parseFloat(min_wear)];
      }
    }
    return ['Battle-Scarred', c + parseFloat(min_wear)];
  }

  // Get possible outcomes
  getPossible(collection, quality) {
    let i = 1;
    while (true) {
      let listOfPossibilites = [];
      for (const [key, value] of Object.entries(this.collections[collection])) {
        // @ts-ignore
        if (value.best_quality == quality + i) {
          // @ts-ignore
          listOfPossibilites.push(key);
        }
      }

      if (listOfPossibilites.length > 0 || i + quality > 15) {
        return listOfPossibilites;
      }
      i++;
    }
  }

  getTradeUp(arrayOfItems: Array<any>) {
    return new Promise((resolve) => {
      arrayOfItems.forEach((element) => {
        let itemName = element.item_name.replace('StatTrak™ ', '')
        let collection = this.directory[itemName];
        element['tradeUpConfirmed'] = false;

        if (collection != undefined) {
          let possible =
            this.collections?.[collection][itemName]?.trade_up;
          element['tradeUpConfirmed'] = possible;
          element['collection'] = collection
        }
      });

      resolve(arrayOfItems);
    });
  }

  // Generate outcome
  getPotentitalOutcome(arrayOfItems) {
    return new Promise((resolve) => {
      try {
        if (!Array.isArray(arrayOfItems) || arrayOfItems.length === 0) {
          resolve([]);
          return;
        }

        const finalResult: any[] = [];
        let average = 0;
        const possibleSkins: string[] = [];
        const seenSkins: string[] = [];
        const firstName = String(arrayOfItems[0]?.item_name ?? '');
        const isStattrak = firstName.includes('StatTrak™');

        for (const element of arrayOfItems) {
          let itemName = String(element?.item_name ?? '');
          if (isStattrak) {
            itemName = itemName.replace('StatTrak™ ', '');
          }
          const collection = (this.directory as Record<string, string>)[itemName];
          const collObj =
            collection != null ? (this.collections as Record<string, Record<string, any>>)[collection] : undefined;
          const itemEntry = collObj?.[itemName] as { best_quality?: string | number } | undefined;
          if (collection == null || itemEntry?.best_quality == null) {
            console.warn('[tradeUp] Item not in collections backup, skipping outcomes:', itemName);
            resolve([]);
            return;
          }

          const possible = this.getPossible(collection, parseInt(String(itemEntry.best_quality), 10));
          for (const skin of possible) {
            if (!seenSkins.includes(skin)) {
              seenSkins.push(skin);
            }
          }
          possibleSkins.push(...possible);
          average += Number(element?.item_paint_wear) || 0;
        }

        average = average / arrayOfItems.length;

        if (seenSkins.length === 0 || possibleSkins.length === 0) {
          resolve([]);
          return;
        }

        for (const skinName of seenSkins) {
          const coll = (this.directory as Record<string, string>)[skinName];
          const relevantObject =
            coll != null ? (this.collections as Record<string, Record<string, any>>)[coll]?.[skinName] : null;
          if (!relevantObject) continue;

          const matchCount = possibleSkins.filter((item) => item === skinName).length;
          if (matchCount === 0) continue;

          const skinRarity = this.getRarity(
            relevantObject['min-wear'],
            relevantObject['max-wear'],
            average
          );
          let floatChance = skinRarity[1];
          // @ts-ignore
          const wearLabel = skinRarity[0];
          const percentageChance = 100 / (possibleSkins.length / matchCount);

          let item_name: any = skinName;
          if (isStattrak) {
            item_name = 'StatTrak™ ' + skinName;
          }
          finalResult.push({
            item_name,
            item_wear_name: wearLabel,
            percentage: percentageChance.toFixed(2),
            image: relevantObject['imageURL'],
            float_chance: floatChance,
          });
        }

        resolve(finalResult);
      } catch (e) {
        console.error('[tradeUp] getPotentitalOutcome failed:', e);
        resolve([]);
      }
    });
  }
}
export { tradeUps };
