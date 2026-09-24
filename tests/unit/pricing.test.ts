import { describe, expect, it } from 'vitest';
import { computeCost, computeSalePrice, DEFAULT_RULES, effectiveDiscount, marginOnPrice, parseDiscounts, roundUpTo, type PricingRules } from '../../src/lib/pricing.js';

const rules = (over: Partial<PricingRules>): PricingRules => ({ ...DEFAULT_RULES, ...over });

describe('parseDiscounts', () => {
  it('parses cascades in the ways people write them', () => {
    expect(parseDiscounts('30+10+5')).toEqual([30, 10, 5]);
    expect(parseDiscounts(' 30 % + 10% ')).toEqual([30, 10]);
    expect(parseDiscounts('12,5+5')).toEqual([12.5, 5]);
    expect(parseDiscounts('')).toEqual([]);
  });
  it('rejects invalid input', () => {
    expect(parseDiscounts('30+abc')).toBeNull();
    expect(parseDiscounts('100')).toBeNull();
    expect(parseDiscounts('-5')).toBeNull();
    expect(parseDiscounts('30++10')).toBeNull();
  });
  it('computes the effective discount', () => {
    expect(effectiveDiscount([30, 10])).toBeCloseTo(0.37);
    expect(effectiveDiscount([])).toBe(0);
  });
});

describe('computeCost', () => {
  it('applies cascaded discounts and surcharge', () => {
    // 1000 × 0.7 × 0.9 × 1.05 = 661.5
    expect(computeCost(1000, rules({ discounts: [30, 10], surchargePct: 5 }))).toBeCloseTo(661.5);
  });
  it('converts USD lists', () => {
    expect(computeCost(10, rules({ currency: 'USD', exchangeRate: 1540 }))).toBeCloseTo(15400);
  });
  it('removes IVA from IVA-included lists for net-cost businesses', () => {
    expect(computeCost(1210, rules({ listIncludesIva: true, costBasis: 'net' }))).toBeCloseTo(1000);
  });
  it('adds IVA to net lists for gross-cost businesses (monotributo)', () => {
    expect(computeCost(1000, rules({ listIncludesIva: false, costBasis: 'gross' }))).toBeCloseTo(1210);
    expect(computeCost(1000, rules({ listIncludesIva: false, costBasis: 'gross', ivaRate: 10.5 }))).toBeCloseTo(1105);
  });
  it('divides pack prices', () => {
    expect(computeCost(1200, rules({ packQty: 12 }))).toBeCloseTo(100);
  });
});

describe('computeSalePrice', () => {
  it('adds markup and IVA for net-cost businesses', () => {
    // 1000 × 1.4 × 1.21 = 1694
    expect(computeSalePrice(1000, rules({ markupPct: 40 }))).toBeCloseTo(1694);
    expect(computeSalePrice(1000, rules({ markupPct: 40, salePriceWithIva: false }))).toBeCloseTo(1400);
  });
  it('does not add IVA again for gross-cost businesses', () => {
    expect(computeSalePrice(1210, rules({ costBasis: 'gross', markupPct: 40 }))).toBeCloseTo(1694);
  });
  it('rounds up to a multiple', () => {
    expect(computeSalePrice(1000, rules({ markupPct: 40, roundTo: 50 }))).toBe(1700);
    expect(roundUpTo(1700, 50)).toBe(1700);
    expect(roundUpTo(1700.0000001, 50)).toBe(1700);
    expect(roundUpTo(12.345, 0)).toBe(12.35);
  });
});

describe('marginOnPrice', () => {
  it('is comparable across bases', () => {
    const net = rules({ costBasis: 'net', salePriceWithIva: true });
    expect(marginOnPrice(1000, 1694, net)).toBeCloseTo(0.2857, 3);
    const gross = rules({ costBasis: 'gross' });
    expect(marginOnPrice(1210, 1694, gross)).toBeCloseTo(0.2857, 3);
    expect(marginOnPrice(1000, 0, net)).toBeNull();
  });
});
