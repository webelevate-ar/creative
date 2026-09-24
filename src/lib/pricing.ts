/**
 * Argentine price math: supplier list price → replacement cost → sale price.
 * Pure functions; all inputs in pesos (or list currency), outputs in pesos (float).
 * Callers convert to cents at the boundary.
 */

export type CostBasis = 'net' | 'gross';

export interface PricingRules {
  /** Cascaded discounts ("bonificaciones"), e.g. [30, 10] for "30+10". */
  discounts: number[];
  /** Freight or other surcharge on top of the discounted price, in %. */
  surchargePct: number;
  currency: 'ARS' | 'USD';
  /** ARS per USD, used when currency is USD. */
  exchangeRate: number;
  listIncludesIva: boolean;
  ivaRate: number;
  /** 'net' = costs kept without IVA (Responsable Inscripto); 'gross' = IVA is part of the cost (Monotributo). */
  costBasis: CostBasis;
  markupPct: number;
  /** When costs are net, whether the sale price shown/exported includes IVA. */
  salePriceWithIva: boolean;
  /** Round the sale price UP to a multiple of this many pesos. 0 = round to cents. */
  roundTo: number;
  /** Units per pack when the list price is per pack. 1 = price is per unit. */
  packQty: number;
}

export const DEFAULT_RULES: PricingRules = {
  discounts: [],
  surchargePct: 0,
  currency: 'ARS',
  exchangeRate: 1,
  listIncludesIva: false,
  ivaRate: 21,
  costBasis: 'net',
  markupPct: 40,
  salePriceWithIva: true,
  roundTo: 0,
  packQty: 1,
};

/**
 * Parses "30+10+5", "30 + 10", "30%+10%", "30,5+10". Empty → [].
 * Returns null when the text is not a valid cascade (each discount must be 0 ≤ d < 100).
 */
export function parseDiscounts(input: string): number[] | null {
  const t = input.trim();
  if (!t) return [];
  const parts = t.split('+').map((p) => p.replace(/%/g, '').trim().replace(',', '.'));
  const out: number[] = [];
  for (const p of parts) {
    if (!/^\d+(\.\d+)?$/.test(p)) return null;
    const d = Number(p);
    if (!(d >= 0 && d < 100)) return null;
    out.push(d);
  }
  return out;
}

export function formatDiscounts(discounts: number[]): string {
  return discounts.map((d) => String(d).replace('.', ',')).join('+');
}

/** Effective single discount of a cascade, e.g. [30,10] → 0.37. */
export function effectiveDiscount(discounts: number[]): number {
  return 1 - discounts.reduce((acc, d) => acc * (1 - d / 100), 1);
}

export function computeCost(listPrice: number, r: PricingRules): number {
  let p = listPrice;
  for (const d of r.discounts) p *= 1 - d / 100;
  p *= 1 + r.surchargePct / 100;
  if (r.currency === 'USD') p *= r.exchangeRate;
  if (r.packQty > 1) p /= r.packQty;
  const iva = 1 + r.ivaRate / 100;
  if (r.listIncludesIva && r.costBasis === 'net') p /= iva;
  if (!r.listIncludesIva && r.costBasis === 'gross') p *= iva;
  return p;
}

export function roundUpTo(value: number, multiple: number): number {
  if (!(multiple > 0)) return Math.round(value * 100) / 100;
  // Round the quotient first so float noise (1700.0000001) does not jump to the next multiple.
  return Math.ceil(Math.round((value / multiple) * 1e6) / 1e6) * multiple;
}

export function computeSalePrice(cost: number, r: PricingRules): number {
  let s = cost * (1 + r.markupPct / 100);
  if (r.costBasis === 'net' && r.salePriceWithIva) s *= 1 + r.ivaRate / 100;
  return roundUpTo(s, r.roundTo);
}

/**
 * Margin of a sale price over cost, as a fraction of the sale price net of IVA
 * (so it is comparable between net and gross bases).
 */
export function marginOnPrice(cost: number, salePrice: number, r: Pick<PricingRules, 'costBasis' | 'salePriceWithIva' | 'ivaRate'>): number | null {
  if (!(salePrice > 0)) return null;
  const priceComparable = r.costBasis === 'net' && r.salePriceWithIva ? salePrice / (1 + r.ivaRate / 100) : salePrice;
  return (priceComparable - cost) / priceComparable;
}
