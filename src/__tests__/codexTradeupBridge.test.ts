import { buildCraftPayload } from '../main/helpers/codexTradeupBridge.ts';

describe('codexTradeupBridge', () => {
  it('returns the expected rarity mapping and asset ids', () => {
    expect(buildCraftPayload(['11', '12', '13'], 2)).toEqual({
      assetIds: ['11', '12', '13'],
      rarity: 2,
      rarityHex: '02000A00',
    });
  });
});
