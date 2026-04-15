import { describe, expect, it } from '@jest/globals';

import { AUTO_PRICING_ENABLED, isAutoPricingEnabled } from '../renderer/pricing/autoPricing.ts';

describe('auto pricing', () => {
  it('is disabled in this fork', () => {
    expect(AUTO_PRICING_ENABLED).toBe(false);
    expect(isAutoPricingEnabled()).toBe(false);
  });
});
