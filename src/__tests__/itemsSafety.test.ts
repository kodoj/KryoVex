import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';

const itemsModuleUrl = pathToFileURL(
  resolve(__dirname, '../main/helpers/classes/steam/items/index.mjs'),
).href;

function runItemsSnippet(snippet: string) {
  const script = `
    import Items from ${JSON.stringify(itemsModuleUrl)};
    ${snippet}
  `;

  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: resolve(__dirname, '..', '..'),
    encoding: 'utf8',
  }).trim();
  const resultLine = output
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.startsWith('__RESULT__'));

  if (!resultLine) {
    throw new Error(`Result marker not found in output: ${output}`);
  }

  return resultLine.slice('__RESULT__'.length);
}

describe('items safety guards', () => {
  it('itemProcessorCanBeMoved does not throw when item_url is missing', () => {
    const output = runItemsSnippet(`
      const fakeThis = {
        get_def_index: () => ({ item_name: '#test_item' }),
        asSafeString: (value) => typeof value === 'string' ? value : '',
      };

      const result = Items.prototype.itemProcessorCanBeMoved.call(
        fakeThis,
        { item_origin: 0 },
        { def_index: 1, flags: 0 },
      );

      console.log('__RESULT__' + JSON.stringify(result));
    `);

    expect(JSON.parse(output)).toBe(true);
  });

  it('itemProcessorHasStickersApplied does not throw when item_url is missing', () => {
    const output = runItemsSnippet(`
      const fakeThis = {
        asSafeString: (value) => typeof value === 'string' ? value : '',
      };

      const result = Items.prototype.itemProcessorHasStickersApplied.call(
        fakeThis,
        { item_url: undefined },
        { stickers: [] },
      );

      console.log('__RESULT__' + JSON.stringify(result));
    `);

    expect(typeof JSON.parse(output)).toBe('boolean');
  });

  it('inventoryConverter skips malformed items instead of aborting the whole inventory', () => {
    const output = runItemsSnippet(`
      const items = new Items();
      items.translation = {};
      items.csgoItems = {
        items: {},
        paint_kits: {},
        prefabs: {},
        sticker_kits: {},
        music_kits: {},
        graffiti_tints: {},
        casket_icons: {},
      };

      const result = items.inventoryConverter({
        broken: {
          id: '1',
          def_index: 999999,
          stickers: [{ slot: 0, sticker_id: 1 }],
          attribute: [{ def_index: 140 }],
          graffiti_tint: 77,
        },
      });

      console.log('__RESULT__' + JSON.stringify(result));
    `);

    expect(JSON.parse(output)).toEqual([]);
  });
});
