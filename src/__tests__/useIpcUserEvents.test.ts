import { describe, expect, it } from '@jest/globals';

import { normalizeUserEventMessage } from '../renderer/hooks/userEventMessage.ts';

describe('normalizeUserEventMessage', () => {
  it('unwraps a single array payload coming from preload-wrapped userEvents', () => {
    expect(
      normalizeUserEventMessage([[1, 'itemAcquired', [{}, [{ item_id: '1' }]]]]),
    ).toEqual([1, 'itemAcquired', [{}, [{ item_id: '1' }]]]);
  });

  it('keeps already-flat user event messages unchanged', () => {
    expect(
      normalizeUserEventMessage([1, 'itemAcquired', [{}, [{ item_id: '1' }]]]),
    ).toEqual([1, 'itemAcquired', [{}, [{ item_id: '1' }]]]);
  });
});
