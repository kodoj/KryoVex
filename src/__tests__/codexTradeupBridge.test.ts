import { describe, expect, it } from '@jest/globals';
import { buildCraftPayload, summarizeCodexTradeupAudit } from '../main/helpers/codexTradeupBridge.ts';

describe('codexTradeupBridge', () => {
  it('returns the expected rarity mapping and asset ids', () => {
    expect(buildCraftPayload(['11', '12', '13'], 2)).toEqual({
      assetIds: ['11', '12', '13'],
      rarity: 2,
      rarityHex: '02000A00',
    });
  });

  it('does not change payload mapping for supported rarities', () => {
    expect(buildCraftPayload(['21'], 4)).toEqual({
      assetIds: ['21'],
      rarity: 4,
      rarityHex: '04000A00',
    });
  });

  it('summarizes audit data for terminal logging', () => {
    expect(
      summarizeCodexTradeupAudit({
        assetIds: ['1', '2', '3'],
        rarity: 2,
        accepted: true,
        dryRun: true,
        reason: 'simulate_only',
      }),
    ).toEqual({
      assetCount: 3,
      rarity: 2,
      accepted: true,
      dryRun: true,
      reason: 'simulate_only',
      firstAssetId: '1',
      lastAssetId: '3',
    });
  });
});
