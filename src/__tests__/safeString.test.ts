import { describe, expect, it } from '@jest/globals';

import { safeIncludes, safeMatch, safeString } from '../renderer/utils/safeString.ts';

describe('safeString helpers', () => {
  it('returns an empty string for non-string values', () => {
    expect(safeString(undefined)).toBe('');
    expect(safeString(null)).toBe('');
    expect(safeString(123)).toBe('');
  });

  it('does not throw on includes for non-string values', () => {
    expect(safeIncludes(undefined, 'abc')).toBe(false);
    expect(safeIncludes(null, 'abc')).toBe(false);
  });

  it('does not throw on match for non-string values', () => {
    expect(safeMatch(undefined, /foo/)).toBeNull();
    expect(safeMatch(null, /foo/)).toBeNull();
  });
});
