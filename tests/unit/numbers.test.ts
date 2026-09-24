import { describe, expect, it } from 'vitest';
import { inferDecimalSeparator, parseNumber } from '../../src/lib/numbers.js';
import { centsToPlain, changeRatio, formatMoney, formatPct, toCents } from '../../src/lib/money.js';

describe('parseNumber', () => {
  it.each([
    ['1.234,56', ',', 1234.56],
    ['1,234.56', ',', 1234.56],
    ['$ 1.234,56', ',', 1234.56],
    ['US$ 12,50', ',', 12.5],
    ['12,5', '.', 12.5],
    ['12.5', ',', 12.5],
    ['1.234', ',', 1234],
    ['1.234', '.', 1.234],
    ['1,234', ',', 1.234],
    ['1,234', '.', 1234],
    ['1.234.567', ',', 1234567],
    ['1,234,567.89', ',', 1234567.89],
    ['-45,10', ',', -45.1],
    ['0,99', ',', 0.99],
    ['  98 500,00 ', ',', 98500],
  ])('%s (hint %s) → %s', (raw, hint, expected) => {
    expect(parseNumber(raw, hint as ',' | '.')).toBeCloseTo(expected, 6);
  });

  it('passes numbers through and rejects junk', () => {
    expect(parseNumber(45.5)).toBe(45.5);
    expect(parseNumber(Number.NaN)).toBeNull();
    expect(parseNumber('consultar')).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber('1.2.3,4,5')).toBeNull();
    expect(parseNumber('12-34')).toBeNull();
  });
});

describe('inferDecimalSeparator', () => {
  it('detects AR columns', () => {
    expect(inferDecimalSeparator(['1.234,56', '99,90', '1.000'])).toBe(',');
  });
  it('detects US columns', () => {
    expect(inferDecimalSeparator(['1,234.56', '99.90', '1,000'])).toBe('.');
  });
  it('uses the unambiguous cells to resolve "1.234"', () => {
    expect(inferDecimalSeparator(['1.234', '5.500', '12.75'])).toBe('.');
    expect(inferDecimalSeparator(['1.234', '5.500', '12,75'])).toBe(',');
  });
  it('defaults to AR when nothing is conclusive', () => {
    expect(inferDecimalSeparator(['1.234', 500])).toBe(',');
  });
});

describe('money helpers', () => {
  it('formats in es-AR', () => {
    expect(formatMoney(123456)).toBe('$ 1.234,56');
    expect(formatMoney(null)).toBe('—');
    expect(formatPct(0.125)).toBe('+12,5 %');
    expect(formatPct(-0.05)).toBe('-5,0 %');
  });
  it('rounds cents and computes change', () => {
    expect(toCents(10.005)).toBe(1001);
    expect(changeRatio(1000, 1100)).toBeCloseTo(0.1);
    expect(changeRatio(0, 1100)).toBeNull();
    expect(centsToPlain(123456, ',')).toBe('1234,56');
    expect(centsToPlain(-5, '.')).toBe('-0.05');
  });
});
