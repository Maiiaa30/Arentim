import { describe, it, expect } from 'vitest';
import { formatAmount, formatTostoes, formatTos, formatDelta, GROUP_SEP } from './format';

describe('formatAmount', () => {
  it('groups thousands with a thin space', () => {
    expect(formatAmount(5000)).toBe(`5${GROUP_SEP}000`);
    expect(formatAmount(1250)).toBe(`1${GROUP_SEP}250`);
    expect(formatAmount(999)).toBe('999');
    expect(formatAmount(1000000)).toBe(`1${GROUP_SEP}000${GROUP_SEP}000`);
  });
});

describe('formatTos', () => {
  it('appends the compact tós suffix', () => {
    expect(formatTos(12500)).toBe(`12${GROUP_SEP}500 tós`);
    expect(formatTos(0)).toBe('0 tós');
  });
});

describe('formatTostoes', () => {
  it('uses the singular for exactly one', () => {
    expect(formatTostoes(1)).toBe('1 Tostão');
  });

  it('uses the plural otherwise', () => {
    expect(formatTostoes(0)).toBe('0 Tostões');
    expect(formatTostoes(5000)).toBe(`5${GROUP_SEP}000 Tostões`);
  });
});

describe('formatDelta', () => {
  it('prefixes a sign for non-zero deltas', () => {
    expect(formatDelta(150)).toBe('+150');
    expect(formatDelta(-80)).toBe('−80');
    expect(formatDelta(0)).toBe('0');
  });
});
