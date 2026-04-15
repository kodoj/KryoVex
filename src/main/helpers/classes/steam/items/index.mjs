import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse } from '@node-steam/vdf';
import axios from 'axios';
import electron from 'electron';

const { app } = electron;

// Updated to CS2 repo paths
const itemsLink =
  'https://raw.githubusercontent.com/SteamDatabase/GameTracking-CS2/master/game/csgo/pak01_dir/scripts/items/items_game.txt';
const translationsLink =
  'https://raw.githubusercontent.com/SteamDatabase/GameTracking-CS2/master/game/csgo/pak01_dir/resource/csgo_english.txt';

// Only persist backups when Electron exposes a writable userData path.
const userDataPath =
  typeof app?.getPath === 'function' ? app.getPath('userData') : null;
const backupDir = userDataPath
  ? join(userDataPath, 'kryovex/backup/itemsBackupFiles')
  : null;
if (backupDir && !existsSync(backupDir)) {
  mkdirSync(backupDir, { recursive: true });
}

function fileCatcher(endNote) {
  return `${csgo_install_directory}${endNote}`;
}

async function fileGetError(items) {
  if (!backupDir) {
    return;
  }
  try {
    const csgoEnglishData = readFileSync(join(backupDir, 'csgo_english.json'), 'utf8');
    const csgoEnglish = JSON.parse(csgoEnglishData);
    items.setTranslations(csgoEnglish, 'Error');

    const itemsGameData = readFileSync(join(backupDir, 'items_game.json'), 'utf8');
    const itemsGame = JSON.parse(itemsGameData);
    items.setCSGOItems(itemsGame);
  } catch (err) {
    console.log('No backup files found or error loading backups:', err);
    // Do not set anything; remain empty if no backups
  }
}

async function getTranslations(items) {
  try {
    const returnValue = await axios.get(translationsLink).then((response) => {
      const finalDict = {};
      const data = response.data;
      var ks = data.split(/\n/);
      ks.forEach(function (value) {
        // Iterate hits
        var test = value.match(/"(.*?)"/g);
        if (test && test[1]) {
          finalDict[test[0].replaceAll('"', '').toLowerCase()] = test[1];
        }
      });

      return finalDict;
    });
    returnValue['stickerkit_cs20_boost_holo'];
    items.setTranslations(returnValue, 'normal');
  } catch (err) {
    console.log('Error occurred during translation parsing:', err);
    await fileGetError(items);
  }
}

function updateItemsLoop(jsonData, keyToRun) {
  const returnDict = {};
  for (const [key, value] of Object.entries(jsonData['items_game'])) {
    if (key == keyToRun) {
      for (const [subKey, subValue] of Object.entries(value)) {
        returnDict[subKey] = subValue;
      }
    }
  }
  return returnDict;
}

async function updateItems(items) {
  try {
    const returnValue = await axios.get(itemsLink).then((response) => {
      const dict_to_write = {
        items: {},
        paint_kits: {},
        prefabs: {},
        sticker_kits: {},
        casket_icons: {},
      };
      const data = response.data;
      const jsonData = parse(data);
      dict_to_write['items'] = updateItemsLoop(jsonData, 'items');
      dict_to_write['paint_kits'] = updateItemsLoop(jsonData, 'paint_kits');
      dict_to_write['prefabs'] = updateItemsLoop(jsonData, 'prefabs');
      dict_to_write['sticker_kits'] = updateItemsLoop(jsonData, 'sticker_kits');
      dict_to_write['music_kits'] = updateItemsLoop(
        jsonData,
        'music_definitions'
      );
      dict_to_write['graffiti_tints'] = updateItemsLoop(
        jsonData,
        'graffiti_tints'
      );

      dict_to_write['casket_icons'] = updateItemsLoop(
        jsonData,
        'alternate_icons2'
      )['casket_icons'];

      return dict_to_write;
    });
    // Validate data (updated for CS2; add more if new keys fail)
    returnValue['items'][1209];
    items.setCSGOItems(returnValue);
  } catch (err) {
    console.log('Error occurred during items parsing:', err);
    await fileGetError(items);
  }
}

class items {
  translation = {};
  csgoItems = {};
  constructor() {
    // Do not load backups initially; fetch first
    getTranslations(this);
    updateItems(this);
  }

  setCSGOItems(value) {
    this.csgoItems = value;
    // Save fresh parsed data as backup on success
    if (backupDir) {
      writeFileSync(join(backupDir, 'items_game.json'), JSON.stringify(value, null, 2));
    }
  }
  setTranslations(value, commandFrom) {
    console.log(commandFrom);
    this.translation = value;
    // Save fresh parsed data as backup on success
    if (backupDir) {
      writeFileSync(join(backupDir, 'csgo_english.json'), JSON.stringify(value, null, 2));
    }
  }
  handleError(callback, args) {
    try {
      return callback.apply(this, args);
    } catch (err) {
      console.log(`[inventory] handleError:${callback?.name || 'anonymous'}`, err);
      return '';
    }
  }

  asSafeString(value) {
    return typeof value === 'string' ? value : '';
  }

  logInventoryIssue(stage, storageRow, extra = {}) {
    try {
      console.warn(`[inventory] ${stage}`, {
        itemId: storageRow?.id,
        defIndex: storageRow?.def_index,
        paintIndex: storageRow?.paint_index,
        rarity: storageRow?.rarity,
        quality: storageRow?.quality,
        origin: storageRow?.origin,
        keys: Object.keys(storageRow || {}),
        ...extra,
      });
    } catch (err) {
      console.warn(`[inventory] ${stage}:failed_to_log`, err);
    }
  }

  inventoryConverter(inventoryResult, isCasket = false) {
    var returnList = [];
    if (typeof inventoryResult === 'object' && inventoryResult !== null) {
      returnList;
    } else {
      console.log('Inventory is not an object or null');
      return returnList;
    }

    console.log('[inventory] inventoryConverter:start', {
      total: Object.keys(inventoryResult).length,
      isCasket,
      translationCount: Object.keys(this.translation || {}).length,
      itemDefinitionCount: Object.keys(this.csgoItems?.items || {}).length,
    });

    let skippedMissingDefIndex = 0;
    let itemErrorCount = 0;

    for (const [key, value] of Object.entries(inventoryResult)) {
      try {

      
      if (value['def_index'] == undefined) {
        skippedMissingDefIndex += 1;
        this.logInventoryIssue('skip_missing_def_index', value, { loopKey: key });
        continue;
      }
      if (!this.get_def_index(value['def_index'])) {
        itemErrorCount += 1;
        this.logInventoryIssue('skip_unknown_def_index', value, { loopKey: key });
        continue;
      }
      const freeRewardStatusBytes = getAttributeValueBytes(value, 277);
      if (freeRewardStatusBytes && freeRewardStatusBytes.readUInt32LE(0) === 1) {
        continue;
        
      }
      let musicIndexBytes = getAttributeValueBytes(value, 166);
      if (musicIndexBytes) {
        value.music_index = musicIndexBytes.readUInt32LE(0);
      }
      let graffitiTint = getAttributeValueBytes(value, 233);
      if (graffitiTint) {
        value.graffiti_tint = graffitiTint.readUInt32LE(0);
      }
      if (
        (value['casket_id'] !== undefined && isCasket == false) ||
        ['17293822569110896676', '17293822569102708641'].includes(value['id'])
      ) {
        continue;
      }

      const returnDict = {};
      // URL
      let imageURL = this.handleError(this.itemProcessorImageUrl, [value]);

      const iconMatch = getAttributeValueBytes(value, 70)?.readUInt32LE(0);
      if (
        value['def_index'] == 1201 &&
        iconMatch &&
        this.csgoItems['casket_icons']?.[iconMatch]?.icon_path
      ) {
        imageURL = this.csgoItems['casket_icons']?.[iconMatch]?.icon_path;
      }
      // Check names
      returnDict['item_name'] = this.handleError(this.itemProcessorName, [
        value,
        imageURL,
      ]);
      if (returnDict['item_name'] == '') {
        this.logInventoryIssue('empty_item_name', value, { imageURL });
      }
      returnDict['item_customname'] = value['custom_name'];
      returnDict['item_url'] = imageURL;
      returnDict['item_id'] = value['id'];
      returnDict['position'] = 9999;
      if (value['position'] != null) {
        returnDict['position'] = value['position'];
      }

      // Check tradable after value
      if (value['tradable_after'] !== undefined) {
        const tradable_after_date = new Date(value['tradable_after']);
        const todaysDate = new Date();
        const itemName = this.asSafeString(returnDict['item_name']);
        if (
          tradable_after_date >= todaysDate &&
          itemName.includes('Key') == false
        ) {
          returnDict['trade_unlock'] = tradable_after_date;
        }
      }

      if (value['casket_contained_item_count'] !== undefined) {
        returnDict['item_storage_total'] = value['casket_contained_item_count'];
      }

      // Check paint_wear value
      if (value['paint_wear'] !== undefined) {
        returnDict['item_wear_name'] = this.handleError(getSkinWearName, [
          value['paint_wear'],
        ]);
        returnDict['item_paint_wear'] = value['paint_wear'];
      }

      // Trade restrictions (maybe?)
      returnDict['item_origin'] = value['origin'];

      returnDict['item_moveable'] = this.handleError(
        this.itemProcessorCanBeMoved,
        [returnDict, value]
      );

      returnDict['item_has_stickers'] = this.handleError(
        this.itemProcessorHasStickersApplied,
        [returnDict, value]
      );
      let equipped = this.handleError(this.itemProcessorisEquipped, [value]);
      returnDict['equipped_ct'] = equipped[0];
      returnDict['equipped_t'] = equipped[1];
      returnDict['def_index'] = value['def_index'];

      if (returnDict['item_has_stickers']) {
        const stickerList = [];
        for (const [stickersKey, stickersValue] of Object.entries(
          value['stickers']
        )) {
          stickerList.push(
            this.handleError(this.stickersProcessData, [stickersValue])
          );
        }
        returnDict['stickers'] = stickerList;
      } else {
        returnDict['stickers'] = [];
      }

      const itemName = this.asSafeString(returnDict['item_name']);
      const itemUrl = this.asSafeString(returnDict['item_url']);
      if (
        value?.rarity == 6 ||
        value?.quality == 3 ||
        itemName.includes('Souvenir') ||
        !itemUrl.includes('econ/default_generated')
      ) {
        returnDict['tradeUp'] = false;
      } else {
        returnDict['rarity'] = value.rarity;
        returnDict['rarityName'] = this.handleError(
          this.itemProcessorGetRarityName,
          [value.rarity]
        );
        returnDict['tradeUp'] = true;
      }
      returnDict['stattrak'] = false;
      if (this.isStatTrak(value)) {
        returnDict['stattrak'] = true;
        returnDict['item_name'] = 'StatTrak™ ' + returnDict['item_name'];
      }
      // Star
      if (value['quality'] == 3) {
        returnDict['item_name'] = '★ ' + returnDict['item_name'];
        returnDict['item_moveable'] = true;
      }

      // Promotional pin fix
      if (returnDict['item_name']?.includes('Pin') && value['origin'] == 5) {
        returnDict['item_moveable'] = false;
      }

      // Promotional music kit fix
      if (value['music_index'] != undefined && value['origin'] == 0) {
        returnDict['item_moveable'] = false;
      }
      returnList.push(returnDict);
      } catch (err) {
        itemErrorCount += 1;
        this.logInventoryIssue('item_conversion_failed', value, {
          loopKey: key,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    console.log('[inventory] inventoryConverter:done', {
      total: Object.keys(inventoryResult).length,
      converted: returnList.length,
      skippedMissingDefIndex,
      itemErrorCount,
      isCasket,
    });
    return returnList;
  }

  itemProcessorGetRarityName(rarity) {
    const rarityDict = {
      1: 'Consumer Grade',
      2: 'Industrial Grade',
      3: 'Mil-Spec',
      4: 'Restricted',
      5: 'Classified',
      6: 'Covert',
    };
    return rarityDict[rarity];
  }

  itemProcessorHasStickersApplied(returnDict, storageRow) {
    const itemUrl = this.asSafeString(returnDict['item_url']);
    if (
      itemUrl.includes('econ/characters') ||
      itemUrl.includes('econ/default_generated') ||
      itemUrl.includes('weapons/base_weapons')
    ) {
      if (storageRow['stickers'] !== undefined) {
        return true;
      }
    }
    return false;
  }

  itemProcessorisEquipped(storageRow) {
    // 2 = CT
    // 3 = T
    let CT = false;
    let T = false;

    for (const [key, value] of Object.entries(storageRow?.equipped_state)) {
      if (value?.new_class == 2) {
        T = true;
      }
      if (value?.new_class == 3) {
        CT = true;
      }
    }
    return [CT, T];
  }

  isStatTrak(storageRow) {
    if (storageRow['attribute'] !== undefined) {
      for (const [, value] of Object.entries(storageRow['attribute'])) {
        if (value['def_index'] == 80) {
          return true;
        }
      }
    }
    return false;
  }

  itemProcessorName(storageRow, imageURL) {
    const defIndexresult = this.get_def_index(storageRow['def_index']) || {};
    const safeImageURL = this.asSafeString(imageURL);
    let baseOne = '';
    let baseTwo = '';
    let baseThree = '';
    let finalName = '';

    // Check if CSGO Case Key
    if (safeImageURL == 'econ/tools/weapon_case_key') {
      return 'CS:GO Case Key';
    }

    // Music kit check
    if (storageRow['music_index'] !== undefined) {
      const musicKitIndex = storageRow['music_index'];
      const musicKitResult = this.getMusicKits(musicKitIndex) || {};
      let nameToUse =
        'Music Kit | ' + this.getTranslation(musicKitResult['loc_name']);

      return nameToUse;
    }

    // Main checks
    // Get first string
    if (defIndexresult['item_name'] !== undefined) {
      baseOne = this.getTranslation(defIndexresult['item_name']);
    } else if (defIndexresult['prefab'] !== undefined) {
      const prefabResult = this.getPrefab(defIndexresult['prefab']) || {};
      const baseSkinName = prefabResult['item_name'];
      baseOne = this.getTranslation(baseSkinName);
    }

    // Get second string
    if (
      storageRow['stickers'] !== undefined &&
      safeImageURL.includes('econ/characters/') == false
    ) {
      const relevantStickerData = storageRow['stickers'][0];
      if (
        relevantStickerData?.['slot'] == 0 &&
        this.asSafeString(baseOne).includes('Coin') == false
      ) {
        const stickerDefIndex = this.getStickerDetails(
          relevantStickerData['sticker_id']
        ) || {};
        baseTwo = this.getTranslation(stickerDefIndex['item_name']);
      }
    }
    if (storageRow['paint_index'] !== undefined) {
      const skinPatternName = this.getPaintDetails(storageRow['paint_index']) || {};
      baseTwo = this.getTranslation(skinPatternName['description_tag']);
    }

    // Get third string (wear name)
    if (storageRow['paint_wear'] !== undefined) {
      baseThree = getSkinWearName(storageRow['paint_wear']) || '';
    }

    if (baseOne) {
      finalName = baseOne;
      if (baseTwo) {
        finalName = `${baseOne} | ${baseTwo}`;
        if (baseThree) {
          finalName = `${baseOne} | ${baseTwo}`;
        }
      }
    }

    if (storageRow['attribute'] !== undefined) {
      for (const [, value] of Object.entries(storageRow['attribute'])) {
        if (
          value['def_index'] == 140 &&
          this.asSafeString(finalName).includes('Souvenir') == false
        ) {
          finalName = 'Souvenir ' + finalName;
        }
      }
    }

    // Graffiti kit check
    if (storageRow['graffiti_tint'] !== undefined) {
      const graffitiKitIndex = storageRow['graffiti_tint'];
      const graffitiKitName = this.getGraffitiKitName(graffitiKitIndex);
      const graffitiKitResult = typeof graffitiKitName === 'string'
        ? capitalizeWords(graffitiKitName.replaceAll('_', ' '))
        : '';
      if (graffitiKitResult) {
        finalName = finalName + ' (' + graffitiKitResult + ')';
        finalName = finalName.replace('Swat', 'SWAT');
      }
    }

    return finalName;
  }

  itemProcessorImageUrl(storageRow) {
    const defIndexresult = this.get_def_index(storageRow['def_index']) || {};

    // Prefer Steam-provided icon URLs when present (CS2 inventory payloads often include these).
    // These are already the correct CDN identifiers and avoid having to map `image_inventory`.
    // Typical shapes:
    // - icon_url_large: "i0CoZ81Ui0m-..." (hash-like, no slashes)
    // - icon_url: same
    // - sometimes "economy/image/<...>" tail
    const iconUrlLarge =
      storageRow?.icon_url_large ??
      storageRow?.iconUrlLarge ??
      storageRow?.description?.icon_url_large ??
      storageRow?.description?.iconUrlLarge;
    const iconUrl =
      storageRow?.icon_url ??
      storageRow?.iconUrl ??
      storageRow?.description?.icon_url ??
      storageRow?.description?.iconUrl;
    if (typeof iconUrlLarge === 'string' && iconUrlLarge.trim()) return iconUrlLarge.trim();
    if (typeof iconUrl === 'string' && iconUrl.trim()) return iconUrl.trim();

    // Heuristic fallback: some libraries nest/rename fields. Try to find any "*icon*url*" string.
    try {
      for (const [k, v] of Object.entries(storageRow ?? {})) {
        if (typeof v !== 'string') continue;
        const key = String(k).toLowerCase();
        if (key.includes('icon') && key.includes('url') && v.trim()) return v.trim();
      }
      // One level deep (common: { description: { icon_url: ... } })
      for (const [k, v] of Object.entries(storageRow ?? {})) {
        if (!v || typeof v !== 'object') continue;
        for (const [kk, vv] of Object.entries(v)) {
          if (typeof vv !== 'string') continue;
          const key = `${k}.${kk}`.toLowerCase();
          if (key.includes('icon') && key.includes('url') && vv.trim()) return vv.trim();
        }
      }
    } catch {
      // ignore
    }

    // Music kit check
    if (storageRow['music_index'] !== undefined) {
      const musicKitIndex = storageRow['music_index'];
      const localMusicKits = this.getMusicKits(musicKitIndex) || {};
      return localMusicKits['image_inventory'];
    }

    // Rest of check

    // Check if it should use the full image_inventory
    if (defIndexresult['image_inventory'] !== undefined) {
      var imageInventory = defIndexresult['image_inventory'];
    }

    // Get second string
    if (storageRow['stickers'] !== undefined && imageInventory == undefined) {
      var relevantStickerData = storageRow['stickers'][0];
      if (relevantStickerData['slot'] == 0) {
        var stickerDefIndex = this.getStickerDetails(
          relevantStickerData['sticker_id']
        );
        if (stickerDefIndex['patch_material'] !== undefined) {
          var imageInventory = `econ/patches/${stickerDefIndex['patch_material']}`;
        } else if (stickerDefIndex['sticker_material'] !== undefined) {
          var imageInventory = `econ/stickers/${stickerDefIndex['sticker_material']}`;
        }
      }
    }
    // Weapons and knifes
    if (storageRow['paint_index'] !== undefined) {
      var skinPatternName = this.getPaintDetails(storageRow['paint_index']);
      var imageInventory = `econ/default_generated/${defIndexresult['name']}_${skinPatternName['name']}_light_large`;
    } else if (defIndexresult['baseitem'] == 1) {
      var imageInventory = `econ/weapons/base_weapons/${defIndexresult['name']}`;
    }

    return imageInventory;
  }
  itemProcessorCanBeMoved(returnDict, storageRow) {
    const defIndexresult = this.get_def_index(storageRow['def_index']) || {};
    const itemUrl = this.asSafeString(returnDict['item_url']);
    if (defIndexresult['prefab'] !== undefined) {
      if (defIndexresult['prefab'] == 'collectible_untradable') {
        return false;
      }
    }
    if (defIndexresult['item_name'] !== undefined) {
      if (
        itemUrl.includes('econ/status_icons/') &&
        returnDict['item_origin'] == 0
      ) {
        return false;
      }
      if (itemUrl.includes('econ/status_icons/service_medal_')) {
        return false;
      }

      if (storageRow['def_index'] == 987) {
        return false;
      }

      if (itemUrl.includes('plusstars')) {
        return false;
      }
    }

    // If characters
    if (defIndexresult['attributes'] !== undefined) {
      for (const [key, value] of Object.entries(defIndexresult['attributes'])) {
        if (key == 'cannot trade' && value == 1) {
          return false;
        }
      }
    }
    if (
      itemUrl.includes('crate_key') &&
      storageRow['flags'] == 10
    ) {
      return false;
    }
    if (itemUrl.includes('weapons/base_weapons')) {
      return false;
    }
    return true;
  }
  stickersProcessData(relevantStickerData) {
    // Get second string
    var stickerDefIndex = this.getStickerDetails(
      relevantStickerData['sticker_id']
    );
    if (stickerDefIndex['patch_material'] !== undefined) {
      var imageInventory = `econ/patches/${stickerDefIndex['patch_material']}`;
      var stickerType = 'Patch';
    } else if (stickerDefIndex['sticker_material'] !== undefined) {
      var imageInventory = `econ/stickers/${stickerDefIndex['sticker_material']}`;
      var stickerType = 'Sticker';
    }
    const stickerDict = {
      sticker_name: this.getTranslation(stickerDefIndex['item_name']),
      sticker_url: imageInventory,
      sticker_type: stickerType,
    };
    return stickerDict;
  }

  get_def_index(def_index) {
    return this.csgoItems?.['items']?.[def_index];
  }

  getTranslation(csgoString) {
    if (typeof csgoString !== 'string' || !csgoString.trim()) {
      return '';
    }
    let stringFormatted = csgoString.replace('#', '').toLowerCase();
    const translated = this.translation?.[stringFormatted];
    if (typeof translated !== 'string') {
      return '';
    }
    return translated.replaceAll('"', '');
  }
  getPrefab(prefab) {
    return this.csgoItems?.['prefabs']?.[prefab?.toString?.()];
  }

  getPaintDetails(paintIndex) {
    return this.csgoItems?.['paint_kits']?.[paintIndex];
  }

  getMusicKits(musicIndex) {
    return this.csgoItems?.['music_kits']?.[musicIndex];
  }

  getGraffitiKitName(graffitiID) {
    for (const [key, value] of Object.entries(
      this.csgoItems?.['graffiti_tints'] || {}
    )) {
      if (value.id == graffitiID) {
        return key;
      }
    }
  }

  getStickerDetails(stickerID) {
    return this.csgoItems?.['sticker_kits']?.[stickerID];
  }

  checkIfAttributeIsThere(item, attribDefIndex) {
    let attrib = (item.attribute || []).find(
      (attrib) => attrib.def_index == attribDefIndex
    );
    return attrib ? true : false;
  }
}

function getSkinWearName(paintWear) {
  const skinWearValues = [0.07, 0.15, 0.38, 0.45, 1];
  const skinWearNames = [
    'Factory New',
    'Minimal Wear',
    'Field-Tested',
    'Well-Worn',
    'Battle-Scarred',
  ];

  for (const [key, value] of Object.entries(skinWearValues)) {
    if (paintWear > value) {
      continue;
    }
    return skinWearNames[key];
  }
}

function getAttributeValueBytes(item, attribDefIndex) {
  let attrib = (item.attribute || []).find(
    (attrib) => attrib.def_index == attribDefIndex
  );
  return attrib ? attrib.value_bytes : null;
}

function capitalizeWords(string) {
  return string.replace(/(?:^|\s)\S/g, function (a) {
    return a.toUpperCase();
  });
}
export default items;
