import { z } from 'zod';
import type { DB } from '../db/index.js';
import { parseDiscounts, type PricingRules } from '../lib/pricing.js';
import { parseNumber } from '../lib/numbers.js';
import type { SavedMapping } from '../lib/detect.js';
import type { OrgSettings } from './settings.js';

export interface Supplier {
  id: number;
  org_id: number;
  name: string;
  currency: 'ARS' | 'USD';
  exchange_rate: number;
  list_includes_iva: number;
  iva_rate: number;
  discounts: string;
  surcharge_pct: number;
  markup_pct: number | null;
  price_mode: 'keep_margin' | 'markup' | null;
  price_per_pack: number;
  mapping_json: string | null;
  last_list_at: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

/** Form numbers are typed the Argentine way ("1.540", "12,5"); parseNumber handles both conventions. */
const optionalNumber = (min: number, max: number, message = `Debe ser un número entre ${min} y ${max}.`) =>
  z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : (parseNumber(v, ',') ?? Number.NaN)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), message);

const requiredNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .transform((v) => parseNumber(v === '' ? '0' : v, ',') ?? Number.NaN)
    .refine((v) => Number.isFinite(v) && v >= min && v <= max, message);

export const supplierFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Ingresá el nombre del proveedor.').max(100),
    currency: z.enum(['ARS', 'USD']).default('ARS'),
    exchange_rate: optionalNumber(0.0001, 1_000_000, 'Ingresá la cotización del dólar (ej: 1540).').prefault(''),
    list_includes_iva: z.enum(['0', '1']).default('0'),
    iva_rate: z.enum(['21', '10.5', '27', '0']).default('21'),
    discounts: z
      .string()
      .trim()
      .max(60)
      .default('')
      .refine((v) => parseDiscounts(v) !== null, 'Las bonificaciones se escriben así: 30+10+5'),
    surcharge_pct: requiredNumber(0, 500, 'El recargo debe estar entre 0 y 500 %.').prefault('0'),
    markup_pct: optionalNumber(0, 1000).prefault(''),
    price_mode: z.enum(['', 'keep_margin', 'markup']).default(''),
    price_per_pack: z.enum(['0', '1']).default('0'),
  })
  .refine((v) => v.currency === 'ARS' || (v.exchange_rate ?? 0) > 1, { message: 'Para listas en dólares ingresá la cotización (ej: 1540).', path: ['exchange_rate'] });
export type SupplierForm = z.input<typeof supplierFormSchema>;

export class LimitError extends Error {}

export function listSuppliers(db: DB, orgId: number): (Supplier & { product_count: number; last_import_id: number | null })[] {
  return db
    .prepare(
      `SELECT s.*,
        (SELECT COUNT(*) FROM products p WHERE p.org_id = s.org_id AND p.supplier_id = s.id) AS product_count,
        (SELECT i.id FROM imports i WHERE i.org_id = s.org_id AND i.supplier_id = s.id ORDER BY i.id DESC LIMIT 1) AS last_import_id
       FROM suppliers s WHERE s.org_id = ? AND s.archived = 0 ORDER BY s.name COLLATE NOCASE`,
    )
    .all(orgId) as (Supplier & { product_count: number; last_import_id: number | null })[];
}

export function getSupplier(db: DB, orgId: number, id: number): Supplier | null {
  return (db.prepare('SELECT * FROM suppliers WHERE id = ? AND org_id = ?').get(id, orgId) as Supplier | undefined) ?? null;
}

export function countSuppliers(db: DB, orgId: number): number {
  return (db.prepare('SELECT COUNT(*) FROM suppliers WHERE org_id = ? AND archived = 0').pluck().get(orgId) as number) ?? 0;
}

function values(v: z.output<typeof supplierFormSchema>) {
  return {
    name: v.name,
    currency: v.currency,
    exchange_rate: v.currency === 'USD' ? (v.exchange_rate ?? 1) : 1,
    list_includes_iva: Number(v.list_includes_iva),
    iva_rate: Number(v.iva_rate),
    discounts: v.discounts,
    surcharge_pct: v.surcharge_pct,
    markup_pct: v.markup_pct,
    price_mode: v.price_mode || null,
    price_per_pack: Number(v.price_per_pack),
  };
}

export function createSupplier(db: DB, orgId: number, input: z.output<typeof supplierFormSchema>, maxSuppliers: number): number {
  return db.transaction(() => {
    if (countSuppliers(db, orgId) >= maxSuppliers) throw new LimitError(`Tu plan permite hasta ${maxSuppliers} proveedores.`);
    const existing = db.prepare('SELECT id, archived FROM suppliers WHERE org_id = ? AND name = ? COLLATE NOCASE').get(orgId, input.name) as
      | { id: number; archived: number }
      | undefined;
    if (existing && !existing.archived) throw new LimitError('Ya tenés un proveedor con ese nombre.');
    const v = values(input);
    if (existing) {
      db.prepare(
        `UPDATE suppliers SET archived = 0, currency=@currency, exchange_rate=@exchange_rate, list_includes_iva=@list_includes_iva, iva_rate=@iva_rate,
         discounts=@discounts, surcharge_pct=@surcharge_pct, markup_pct=@markup_pct, price_mode=@price_mode, price_per_pack=@price_per_pack,
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=@id AND org_id=@org_id`,
      ).run({ ...v, id: existing.id, org_id: orgId });
      return existing.id;
    }
    const r = db
      .prepare(
        `INSERT INTO suppliers (org_id, name, currency, exchange_rate, list_includes_iva, iva_rate, discounts, surcharge_pct, markup_pct, price_mode, price_per_pack)
         VALUES (@org_id, @name, @currency, @exchange_rate, @list_includes_iva, @iva_rate, @discounts, @surcharge_pct, @markup_pct, @price_mode, @price_per_pack)`,
      )
      .run({ ...v, org_id: orgId });
    return Number(r.lastInsertRowid);
  })();
}

export function updateSupplier(db: DB, orgId: number, id: number, input: z.output<typeof supplierFormSchema>): void {
  const clash = db.prepare('SELECT id FROM suppliers WHERE org_id = ? AND name = ? COLLATE NOCASE AND id != ? AND archived = 0').get(orgId, input.name, id);
  if (clash) throw new LimitError('Ya tenés un proveedor con ese nombre.');
  const r = db
    .prepare(
      `UPDATE suppliers SET name=@name, currency=@currency, exchange_rate=@exchange_rate, list_includes_iva=@list_includes_iva, iva_rate=@iva_rate,
       discounts=@discounts, surcharge_pct=@surcharge_pct, markup_pct=@markup_pct, price_mode=@price_mode, price_per_pack=@price_per_pack,
       updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=@id AND org_id=@org_id`,
    )
    .run({ ...values(input), id, org_id: orgId });
  if (r.changes !== 1) throw new LimitError('Proveedor no encontrado.');
}

/** Archive instead of delete: products keep their history. Name becomes reusable. */
export function archiveSupplier(db: DB, orgId: number, id: number): boolean {
  return db.prepare('UPDATE suppliers SET archived = 1 WHERE id = ? AND org_id = ?').run(id, orgId).changes === 1;
}

/** Finds or creates a supplier by name (used by catalog import). Respects the plan limit. */
export function ensureSupplier(db: DB, orgId: number, name: string, maxSuppliers: number): number | null {
  const clean = name.trim().slice(0, 100);
  if (!clean) return null;
  const row = db.prepare('SELECT id, archived FROM suppliers WHERE org_id = ? AND name = ? COLLATE NOCASE').get(orgId, clean) as
    | { id: number; archived: number }
    | undefined;
  if (row && !row.archived) return row.id;
  if (countSuppliers(db, orgId) >= maxSuppliers) return null;
  if (row) {
    db.prepare('UPDATE suppliers SET archived = 0 WHERE id = ?').run(row.id);
    return row.id;
  }
  return Number(db.prepare('INSERT INTO suppliers (org_id, name) VALUES (?, ?)').run(orgId, clean).lastInsertRowid);
}

export function saveSupplierMapping(db: DB, orgId: number, id: number, mapping: SavedMapping): void {
  db.prepare('UPDATE suppliers SET mapping_json = ? WHERE id = ? AND org_id = ?').run(JSON.stringify(mapping), id, orgId);
}

export function savedMapping(s: Supplier): SavedMapping | null {
  if (!s.mapping_json) return null;
  try {
    return JSON.parse(s.mapping_json) as SavedMapping;
  } catch {
    return null;
  }
}

/** Pricing rules for a product from this supplier; product overrides win over supplier, supplier over org. */
export function rulesFor(
  s: Supplier,
  settings: OrgSettings,
  product?: { markup_pct: number | null; iva_rate: number | null } | null,
  packQty?: number | null,
): PricingRules {
  return {
    discounts: parseDiscounts(s.discounts) ?? [],
    surchargePct: s.surcharge_pct,
    currency: s.currency,
    exchangeRate: s.exchange_rate,
    listIncludesIva: s.list_includes_iva === 1,
    ivaRate: product?.iva_rate ?? s.iva_rate,
    costBasis: settings.costBasis,
    markupPct: product?.markup_pct ?? s.markup_pct ?? settings.defaultMarkupPct,
    salePriceWithIva: settings.salePriceWithIva,
    roundTo: settings.roundTo,
    packQty: s.price_per_pack === 1 && packQty && packQty > 1 ? packQty : 1,
  };
}

export function priceModeFor(s: Supplier, settings: OrgSettings): 'keep_margin' | 'markup' {
  return s.price_mode ?? settings.priceMode;
}
