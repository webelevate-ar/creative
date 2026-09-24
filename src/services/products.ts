import { z } from 'zod';
import type { DB } from '../db/index.js';
import type { Cell } from '../lib/sheet.js';
import { normalizeCode, normalizeSearch } from '../lib/match.js';
import { columnDecimal, normalizeText } from '../lib/detect.js';
import { parseNumber } from '../lib/numbers.js';
import { toCents } from '../lib/money.js';
import { ensureSupplier } from './suppliers.js';

export interface Product {
  id: number;
  org_id: number;
  code: string;
  code_norm: string;
  description: string;
  supplier_id: number | null;
  supplier_code: string | null;
  supplier_code_norm: string | null;
  cost_cents: number | null;
  price_cents: number | null;
  markup_pct: number | null;
  iva_rate: number | null;
  cost_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductRow = Product & { supplier_name: string | null };

export function searchText(code: string, description: string, supplierCode: string | null): string {
  return normalizeSearch(`${code} ${description} ${supplierCode ?? ''}`);
}

export function countProducts(db: DB, orgId: number): number {
  return (db.prepare('SELECT COUNT(*) FROM products WHERE org_id = ?').pluck().get(orgId) as number) ?? 0;
}

export type ProductFilter = 'all' | 'no_supplier' | 'no_cost' | 'below_cost';

export function listProducts(
  db: DB,
  orgId: number,
  opts: { q?: string; supplierId?: number | null; filter?: ProductFilter; page?: number; pageSize?: number },
): { rows: ProductRow[]; total: number; page: number; pageSize: number } {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 50, 10), 200);
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const where = ['p.org_id = @orgId'];
  const params: Record<string, unknown> = { orgId, limit: pageSize, offset: (page - 1) * pageSize };
  const q = normalizeSearch(opts.q ?? '').slice(0, 100);
  if (q) {
    // Each word must appear; LIKE wildcards in user input are escaped.
    q.split(' ').slice(0, 6).forEach((word, i) => {
      where.push(`p.search_text LIKE @w${i} ESCAPE '\\'`);
      params[`w${i}`] = `%${word.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    });
  }
  if (opts.supplierId) {
    where.push('p.supplier_id = @supplierId');
    params.supplierId = opts.supplierId;
  }
  if (opts.filter === 'no_supplier') where.push('p.supplier_id IS NULL');
  if (opts.filter === 'no_cost') where.push('p.cost_cents IS NULL');
  if (opts.filter === 'below_cost') where.push('p.cost_cents IS NOT NULL AND p.price_cents IS NOT NULL AND p.price_cents < p.cost_cents');
  const w = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) FROM products p WHERE ${w}`).pluck().get(params) as number;
  const rows = db
    .prepare(
      `SELECT p.*, s.name AS supplier_name FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id AND s.org_id = p.org_id
       WHERE ${w} ORDER BY p.code COLLATE NOCASE LIMIT @limit OFFSET @offset`,
    )
    .all(params) as ProductRow[];
  return { rows, total, page, pageSize };
}

export function getProduct(db: DB, orgId: number, id: number): ProductRow | null {
  return (
    (db
      .prepare('SELECT p.*, s.name AS supplier_name FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id AND s.org_id = p.org_id WHERE p.id = ? AND p.org_id = ?')
      .get(id, orgId) as ProductRow | undefined) ?? null
  );
}

export function productHistory(db: DB, orgId: number, productId: number) {
  return db
    .prepare(
      `SELECT h.*, i.file_name, s.name AS supplier_name FROM price_history h
       LEFT JOIN imports i ON i.id = h.import_id AND i.org_id = h.org_id
       LEFT JOIN suppliers s ON s.id = i.supplier_id AND s.org_id = h.org_id
       WHERE h.org_id = ? AND h.product_id = ? ORDER BY h.id DESC LIMIT 50`,
    )
    .all(orgId, productId) as {
    id: number;
    kind: string;
    old_cost_cents: number | null;
    new_cost_cents: number | null;
    old_price_cents: number | null;
    new_price_cents: number | null;
    created_at: string;
    import_id: number | null;
    file_name: string | null;
    supplier_name: string | null;
  }[];
}

const money = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : parseNumber(v, ',')))
  .refine((v) => v === null || (v >= 0 && v < 1e10), 'Ingresá un importe válido (ej: 1.234,56).');
const optionalPct = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : (parseNumber(v, ',') ?? Number.NaN)))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 1000), 'Porcentaje inválido.');

export const productFormSchema = z.object({
  code: z.string().trim().min(1, 'Ingresá el código.').max(60),
  description: z.string().trim().max(300).prefault(''),
  supplier_id: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Number(v)))
    .refine((v) => v === null || Number.isInteger(v), 'Proveedor inválido.')
    .prefault(''),
  supplier_code: z.string().trim().max(60).prefault(''),
  cost: money.prefault(''),
  price: money.prefault(''),
  markup_pct: optionalPct.prefault(''),
  iva_rate: z.enum(['', '21', '10.5', '27', '0']).prefault(''),
});

export class ProductError extends Error {}

export function saveProduct(db: DB, orgId: number, id: number | null, input: z.output<typeof productFormSchema>, maxProducts: number): number {
  return db.transaction(() => {
    if (input.supplier_id != null) {
      const ok = db.prepare('SELECT 1 FROM suppliers WHERE id = ? AND org_id = ?').get(input.supplier_id, orgId);
      if (!ok) throw new ProductError('Proveedor inválido.');
    }
    const clash = db.prepare('SELECT id FROM products WHERE org_id = ? AND code = ?').get(orgId, input.code) as { id: number } | undefined;
    if (clash && clash.id !== id) throw new ProductError('Ya existe un producto con ese código.');
    const vals = {
      org_id: orgId,
      code: input.code,
      code_norm: normalizeCode(input.code),
      description: input.description,
      search_text: searchText(input.code, input.description, input.supplier_code || null),
      supplier_id: input.supplier_id,
      supplier_code: input.supplier_code || null,
      supplier_code_norm: input.supplier_code ? normalizeCode(input.supplier_code) : null,
      cost_cents: input.cost == null ? null : toCents(input.cost),
      price_cents: input.price == null ? null : toCents(input.price),
      markup_pct: input.markup_pct,
      iva_rate: input.iva_rate === '' ? null : Number(input.iva_rate),
    };
    if (id == null) {
      if (countProducts(db, orgId) >= maxProducts) throw new ProductError(`Tu plan permite hasta ${maxProducts} productos.`);
      const r = db
        .prepare(
          `INSERT INTO products (org_id, code, code_norm, description, search_text, supplier_id, supplier_code, supplier_code_norm, cost_cents, price_cents, markup_pct, iva_rate, cost_updated_at)
           VALUES (@org_id, @code, @code_norm, @description, @search_text, @supplier_id, @supplier_code, @supplier_code_norm, @cost_cents, @price_cents, @markup_pct, @iva_rate, CASE WHEN @cost_cents IS NULL THEN NULL ELSE strftime('%Y-%m-%dT%H:%M:%fZ','now') END)`,
        )
        .run(vals);
      const newId = Number(r.lastInsertRowid);
      db.prepare("INSERT INTO price_history (org_id, product_id, kind, new_cost_cents, new_price_cents) VALUES (?, ?, 'manual', ?, ?)").run(orgId, newId, vals.cost_cents, vals.price_cents);
      return newId;
    }
    const before = db.prepare('SELECT cost_cents, price_cents FROM products WHERE id = ? AND org_id = ?').get(id, orgId) as
      | { cost_cents: number | null; price_cents: number | null }
      | undefined;
    if (!before) throw new ProductError('Producto no encontrado.');
    db.prepare(
      `UPDATE products SET code=@code, code_norm=@code_norm, description=@description, search_text=@search_text, supplier_id=@supplier_id,
       supplier_code=@supplier_code, supplier_code_norm=@supplier_code_norm, cost_cents=@cost_cents, price_cents=@price_cents,
       markup_pct=@markup_pct, iva_rate=@iva_rate, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       cost_updated_at = CASE WHEN @cost_cents IS NOT cost_cents THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') ELSE cost_updated_at END
       WHERE id=@id AND org_id=@org_id`,
    ).run({ ...vals, id });
    if (before.cost_cents !== vals.cost_cents || before.price_cents !== vals.price_cents) {
      db.prepare("INSERT INTO price_history (org_id, product_id, kind, old_cost_cents, new_cost_cents, old_price_cents, new_price_cents) VALUES (?, ?, 'manual', ?, ?, ?, ?)").run(
        orgId,
        id,
        before.cost_cents,
        vals.cost_cents,
        before.price_cents,
        vals.price_cents,
      );
    }
    return id;
  })();
}

export function deleteProduct(db: DB, orgId: number, id: number): boolean {
  return db.prepare('DELETE FROM products WHERE id = ? AND org_id = ?').run(id, orgId).changes === 1;
}

// ---------------------------------------------------------------------------------------------
// Catalog import (the store's own product list exported from its POS/Excel)

export type CatalogRole = 'code' | 'description' | 'cost' | 'price' | 'supplier' | 'supplier_code';
export const CATALOG_ROLES: CatalogRole[] = ['code', 'description', 'cost', 'price', 'supplier', 'supplier_code'];
export const CATALOG_ROLE_LABELS: Record<CatalogRole, string> = {
  code: 'Código (tuyo)',
  description: 'Descripción',
  cost: 'Costo',
  price: 'Precio de venta',
  supplier: 'Proveedor (nombre)',
  supplier_code: 'Código del proveedor',
};
export type CatalogMapping = { headerRow: number } & Record<CatalogRole, number | null>;

const CATALOG_PATTERNS: [CatalogRole, RegExp][] = [
  ['supplier_code', /(cod(igo)?|art(iculo)?|ref)\.? ?(del )?prov/],
  ['supplier', /^proveedor|^prov\.?$|^marca proveedor/],
  ['cost', /costo|compra|reposicion/],
  ['price', /precio|venta|pvp|publico|final/],
  ['description', /desc|detalle|producto|nombre/],
  ['code', /^cod|codigo|sku|^art|^id$|interno/],
];

export function detectCatalogColumns(rows: Cell[][]): CatalogMapping {
  const mapping: CatalogMapping = { headerRow: -1, code: null, description: null, cost: null, price: null, supplier: null, supplier_code: null };
  const limit = Math.min(rows.length, 20);
  let best = { row: -1, hits: 0 };
  for (let i = 0; i < limit; i++) {
    const hits = new Set<CatalogRole>();
    for (const c of rows[i] ?? []) {
      const t = normalizeText(c);
      if (!t || t.length > 40) continue;
      const hit = CATALOG_PATTERNS.find(([, re]) => re.test(t));
      if (hit) hits.add(hit[0]);
    }
    if (hits.size > best.hits) best = { row: i, hits: hits.size };
  }
  if (best.hits < 2) return mapping;
  mapping.headerRow = best.row;
  (rows[best.row] ?? []).forEach((c, idx) => {
    const t = normalizeText(c);
    if (!t) return;
    const hit = CATALOG_PATTERNS.find(([, re]) => re.test(t));
    if (hit && mapping[hit[0]] == null) mapping[hit[0]] = idx;
  });
  return mapping;
}

export interface CatalogImportResult {
  created: number;
  updated: number;
  skipped: number;
  suppliersCreated: number;
  limitReached: boolean;
}

export function importCatalog(db: DB, orgId: number, rows: Cell[][], m: CatalogMapping, limits: { products: number; suppliers: number }): CatalogImportResult {
  if (m.code == null) throw new ProductError('Elegí qué columna tiene el código del producto.');
  const result: CatalogImportResult = { created: 0, updated: 0, skipped: 0, suppliersCreated: 0, limitReached: false };
  const dataRows = rows.slice(m.headerRow + 1);
  const costDec = m.cost != null ? columnDecimal(dataRows, m.cost) : ',';
  const priceDec = m.price != null ? columnDecimal(dataRows, m.price) : ',';
  const cell = (r: Cell[], idx: number | null) => (idx == null ? null : r[idx] ?? null);
  const str = (v: Cell) => (v == null ? '' : String(v).trim());

  db.transaction(() => {
    let count = countProducts(db, orgId);
    const suppliersBefore = db.prepare('SELECT COUNT(*) FROM suppliers WHERE org_id = ?').pluck().get(orgId) as number;
    const supplierIds = new Map<string, number | null>();
    const find = db.prepare('SELECT id, cost_cents, price_cents FROM products WHERE org_id = ? AND code = ?');
    const insert = db.prepare(
      `INSERT INTO products (org_id, code, code_norm, description, search_text, supplier_id, supplier_code, supplier_code_norm, cost_cents, price_cents, cost_updated_at)
       VALUES (@org_id, @code, @code_norm, @description, @search_text, @supplier_id, @supplier_code, @supplier_code_norm, @cost_cents, @price_cents, @now)`,
    );
    const update = db.prepare(
      `UPDATE products SET description = CASE WHEN @description = '' THEN description ELSE @description END,
         supplier_id = COALESCE(@supplier_id, supplier_id), supplier_code = COALESCE(@supplier_code, supplier_code),
         supplier_code_norm = COALESCE(@supplier_code_norm, supplier_code_norm),
         cost_cents = COALESCE(@cost_cents, cost_cents), price_cents = COALESCE(@price_cents, price_cents),
         search_text = @search_text, updated_at = @now WHERE id = @id AND org_id = @org_id`,
    );
    const history = db.prepare(
      `INSERT INTO price_history (org_id, product_id, kind, old_cost_cents, new_cost_cents, old_price_cents, new_price_cents) VALUES (?, ?, 'manual', ?, ?, ?, ?)`,
    );
    const now = new Date().toISOString();
    for (const r of dataRows) {
      const code = str(cell(r, m.code)).slice(0, 60);
      if (!code) {
        if (r.some((c) => c != null)) result.skipped++;
        continue;
      }
      const description = str(cell(r, m.description)).slice(0, 300);
      const supplierName = str(cell(r, m.supplier));
      let supplierId: number | null = null;
      if (supplierName) {
        const key = supplierName.toLowerCase();
        if (!supplierIds.has(key)) supplierIds.set(key, ensureSupplier(db, orgId, supplierName, limits.suppliers));
        supplierId = supplierIds.get(key) ?? null;
      }
      const supplierCode = str(cell(r, m.supplier_code)).slice(0, 60) || null;
      const cost = parseNumber(cell(r, m.cost), costDec);
      const price = parseNumber(cell(r, m.price), priceDec);
      const vals = {
        org_id: orgId,
        code,
        code_norm: normalizeCode(code),
        description,
        search_text: searchText(code, description, supplierCode),
        supplier_id: supplierId,
        supplier_code: supplierCode,
        supplier_code_norm: supplierCode ? normalizeCode(supplierCode) : null,
        cost_cents: cost != null && cost >= 0 ? toCents(cost) : null,
        price_cents: price != null && price >= 0 ? toCents(price) : null,
        now,
      };
      const existing = find.get(orgId, code) as { id: number; cost_cents: number | null; price_cents: number | null } | undefined;
      if (existing) {
        update.run({ ...vals, id: existing.id });
        const newCost = vals.cost_cents ?? existing.cost_cents;
        const newPrice = vals.price_cents ?? existing.price_cents;
        if (newCost !== existing.cost_cents || newPrice !== existing.price_cents) history.run(orgId, existing.id, existing.cost_cents, newCost, existing.price_cents, newPrice);
        result.updated++;
      } else {
        if (count >= limits.products) {
          result.limitReached = true;
          result.skipped++;
          continue;
        }
        const id = Number(insert.run(vals).lastInsertRowid);
        history.run(orgId, id, null, vals.cost_cents, null, vals.price_cents);
        count++;
        result.created++;
      }
    }
    const suppliersAfter = db.prepare('SELECT COUNT(*) FROM suppliers WHERE org_id = ?').pluck().get(orgId) as number;
    result.suppliersCreated = suppliersAfter - suppliersBefore;
  })();
  return result;
}
