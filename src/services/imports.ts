/**
 * Supplier list import pipeline:
 *   upload → (auto or manual) column mapping → matching + pricing → review → apply → (undo)
 * Rule: the catalog is only written on apply, and every apply can be reverted.
 */
import type { DB } from '../db/index.js';
import { applySavedMapping, detectColumns, extractRows, toSavedMapping, type ColumnMapping, type Detection } from '../lib/detect.js';
import { normalizeCode, normalizeSearch } from '../lib/match.js';
import { computeCost, computeSalePrice, marginOnPrice, roundUpTo } from '../lib/pricing.js';
import { type Cell, type Workbook } from '../lib/sheet.js';
import { parseFile } from '../lib/parse.js';
import { toCents } from '../lib/money.js';
import { getSupplier, priceModeFor, rulesFor, saveSupplierMapping, type Supplier } from './suppliers.js';
import { getSettings, type OrgSettings } from './settings.js';
import { countProducts, searchText } from './products.js';

export type ImportStatus = 'uploaded' | 'review' | 'applied' | 'reverted' | 'discarded';

export interface ImportRecord {
  id: number;
  org_id: number;
  supplier_id: number;
  file_name: string;
  file_size: number;
  file_kind: string;
  sheet_name: string | null;
  mapping_json: string | null;
  rules_json: string | null;
  status: ImportStatus;
  stats_json: string;
  created_by: number | null;
  created_at: string;
  applied_at: string | null;
  reverted_at: string | null;
}

export interface ImportStats {
  total: number;
  skippedRows: number;
  matched: number;
  unmatched: number;
  changed: number;
  up: number;
  down: number;
  same: number;
  flagged: number;
  belowCost: number;
  missing: number;
  toApply: number;
  toCreate: number;
  medianChange: number | null;
  maxUp: number | null;
  maxDown: number | null;
  applied?: { updated: number; created: number; skipped: number };
  reverted?: { restored: number; deleted: number; conflicts: number };
}

export interface ImportRow {
  id: number;
  import_id: number;
  row_index: number;
  raw_code: string;
  code_norm: string;
  description: string;
  raw_price: string;
  list_price: number | null;
  pack_qty: number | null;
  product_id: number | null;
  match_type: 'link' | 'supplier_code' | 'own_code' | 'manual' | 'none';
  old_cost_cents: number | null;
  new_cost_cents: number | null;
  old_price_cents: number | null;
  new_price_cents: number | null;
  flags: string;
  decision: 'apply' | 'skip' | 'create';
}

export type RowFilter = 'all' | 'apply' | 'changed' | 'up' | 'down' | 'flagged' | 'new' | 'below_cost' | 'skip';

export class ImportError extends Error {}

// Small cache so the mapping screen does not re-parse a large workbook on every request.
const gridCache = new Map<number, Workbook>();
function cacheWorkbook(id: number, wb: Workbook) {
  gridCache.set(id, wb);
  if (gridCache.size > 8) gridCache.delete(gridCache.keys().next().value!);
}

export function parseStats(json: string | null | undefined): ImportStats {
  const base: ImportStats = {
    total: 0, skippedRows: 0, matched: 0, unmatched: 0, changed: 0, up: 0, down: 0, same: 0, flagged: 0,
    belowCost: 0, missing: 0, toApply: 0, toCreate: 0, medianChange: null, maxUp: null, maxDown: null,
  };
  try {
    return { ...base, ...(json ? (JSON.parse(json) as Partial<ImportStats>) : {}) };
  } catch {
    return base;
  }
}

export function getImport(db: DB, orgId: number, id: number): ImportRecord | null {
  return (
    (db
      .prepare(
        `SELECT id, org_id, supplier_id, file_name, file_size, file_kind, sheet_name, mapping_json, rules_json, status, stats_json, created_by, created_at, applied_at, reverted_at
         FROM imports WHERE id = ? AND org_id = ?`,
      )
      .get(id, orgId) as ImportRecord | undefined) ?? null
  );
}

export async function loadWorkbook(db: DB, imp: ImportRecord): Promise<Workbook> {
  const cached = gridCache.get(imp.id);
  if (cached) return cached;
  const row = db.prepare('SELECT file_blob FROM imports WHERE id = ? AND org_id = ?').get(imp.id, imp.org_id) as { file_blob: Buffer | null } | undefined;
  if (!row?.file_blob) throw new ImportError('El archivo original ya no está disponible.');
  const wb = await parseFile(imp.file_name, row.file_blob);
  cacheWorkbook(imp.id, wb);
  return wb;
}

export function sheetRows(wb: Workbook, sheetName: string | null): { name: string; rows: Cell[][] } {
  const sheet = wb.sheets.find((s) => s.name === sheetName) ?? wb.sheets[0];
  if (!sheet) throw new ImportError('El archivo no tiene hojas con datos.');
  return sheet;
}

/** Picks the sheet that looks most like a price list. */
function bestSheet(wb: Workbook, preferred?: string): { name: string; rows: Cell[][]; detection: Detection } {
  let best: { name: string; rows: Cell[][]; detection: Detection; score: number } | null = null;
  for (const s of wb.sheets) {
    const detection = detectColumns(s.rows);
    const usable = detection.code != null && detection.price != null;
    const roles = [detection.code, detection.price, detection.description].filter((x) => x != null).length;
    const score = (s.name === preferred ? 1e9 : 0) + (usable ? 1e6 : 0) + (detection.headerRow >= 0 ? 1e5 : 0) + roles * 1e4 + s.rows.length;
    if (!best || score > best.score) best = { ...s, detection, score };
  }
  if (!best) throw new ImportError('El archivo no tiene hojas con datos.');
  return best;
}

export async function createImport(
  db: DB,
  orgId: number,
  userId: number,
  supplierId: number,
  fileName: string,
  buf: Buffer,
): Promise<{ importId: number; autoMapped: boolean }> {
  const supplier = getSupplier(db, orgId, supplierId);
  if (!supplier || supplier.archived) throw new ImportError('Elegí un proveedor válido.');
  const wb = await parseFile(fileName, buf); // throws FileFormatError with a friendly message
  if (!wb.sheets.some((s) => s.rows.length > 0)) throw new ImportError('No encontramos datos en el archivo.');
  const saved = supplier.mapping_json ? (JSON.parse(supplier.mapping_json) as ReturnType<typeof toSavedMapping>) : null;
  const sheet = bestSheet(wb, saved?.sheetName);
  const safeName = fileName.replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 150) || 'lista';
  const importId = Number(
    db
      .prepare('INSERT INTO imports (org_id, supplier_id, file_name, file_size, file_blob, file_kind, sheet_name, mapping_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(orgId, supplierId, safeName, buf.byteLength, buf, wb.kind, sheet.name, JSON.stringify(sheet.detection), userId).lastInsertRowid,
  );
  cacheWorkbook(importId, wb);
  if (saved) {
    const mapping = applySavedMapping(sheet.rows, saved);
    if (mapping) {
      computeRows(db, orgId, importId, sheet.name, sheet.rows, mapping);
      return { importId, autoMapped: true };
    }
  }
  return { importId, autoMapped: false };
}

/** User confirmed (or corrected) the mapping: remember it for this supplier and compute the review. */
export async function confirmMapping(db: DB, orgId: number, importId: number, sheetName: string | null, mapping: ColumnMapping): Promise<void> {
  const imp = getImport(db, orgId, importId);
  if (!imp) throw new ImportError('Importación no encontrada.');
  if (imp.status !== 'uploaded' && imp.status !== 'review') throw new ImportError('Esta lista ya fue aplicada o descartada.');
  if (mapping.code == null || mapping.price == null) throw new ImportError('Indicá qué columna tiene el código y cuál el precio.');
  if (mapping.code === mapping.price) throw new ImportError('El código y el precio no pueden ser la misma columna.');
  const wb = await loadWorkbook(db, imp);
  const sheet = sheetRows(wb, sheetName);
  computeRows(db, orgId, importId, sheet.name, sheet.rows, mapping);
  saveSupplierMapping(db, orgId, imp.supplier_id, toSavedMapping(mapping, sheet.rows, sheet.name));
}

interface ProductLite {
  id: number;
  cost_cents: number | null;
  price_cents: number | null;
  markup_pct: number | null;
  iva_rate: number | null;
  supplier_id: number | null;
  description: string;
}

const WORD_STOP = new Set(['de', 'del', 'con', 'para', 'por', 'caja', 'unidad', 'x', 'c', 'p', 'the']);
function meaningfulWords(s: string): Set<string> {
  return new Set(
    normalizeSearch(s)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !WORD_STOP.has(w)),
  );
}

/**
 * A match only through the store's OWN code (not the supplier's) is weak: supplier and store numbering are
 * different namespaces and numeric codes collide (research: docs/19 §8). If both descriptions exist and share
 * no meaningful word, the match must be confirmed by the user instead of applied.
 */
function weakOwnCodeMatch(type: ImportRow['match_type'], listDescription: string, product: ProductLite | null): boolean {
  if (type !== 'own_code' || !product || !listDescription.trim() || !product.description.trim()) return false;
  const a = meaningfulWords(listDescription);
  const b = meaningfulWords(product.description);
  if (!a.size || !b.size) return false;
  for (const w of a) if (b.has(w)) return false;
  return true;
}

/** Differences of a cent come from rounding in the store's old data, not from the supplier: not a change. */
const COST_TOLERANCE_CENTS = 1;

function priceItem(listPrice: number | null, packQty: number | null, product: ProductLite | null, supplier: Supplier, settings: OrgSettings) {
  if (listPrice == null || !(listPrice > 0)) return { newCost: null, newPrice: null };
  const rules = rulesFor(supplier, settings, product, packQty);
  const cost = computeCost(listPrice, rules);
  const newCost = toCents(cost);
  if (product?.cost_cents != null && product.price_cents != null && Math.abs(newCost - product.cost_cents) <= COST_TOLERANCE_CENTS) {
    // Same cost: keep the current price as is (do not re-round or re-markup an unchanged item).
    return { newCost: product.cost_cents, newPrice: product.price_cents };
  }
  let newPrice: number;
  if (product && priceModeFor(supplier, settings) === 'keep_margin' && product.cost_cents && product.price_cents && product.cost_cents > 0) {
    newPrice = toCents(roundUpTo((product.price_cents / 100) * (newCost / product.cost_cents), settings.roundTo));
  } else {
    newPrice = toCents(computeSalePrice(cost, rules));
  }
  return { newCost, newPrice };
}

function flagsFor(
  row: { newCost: number | null; newPrice: number | null },
  product: ProductLite | null,
  dup: boolean,
  supplier: Supplier,
  settings: OrgSettings,
  weakMatch = false,
): string[] {
  const flags: string[] = [];
  if (weakMatch) flags.push('check_match');
  if (row.newCost == null) flags.push('no_price');
  if (dup) flags.push('dup');
  if (!product) {
    flags.push('new');
    return flags;
  }
  if (row.newCost != null && product.cost_cents && product.cost_cents > 0) {
    const ratio = row.newCost / product.cost_cents;
    if (ratio >= 5 || ratio <= 0.2) flags.push('suspect');
    else if (ratio - 1 >= settings.bigChangePct / 100) flags.push('up_big');
    else if (ratio - 1 <= -settings.bigChangePct / 100) flags.push('down_big');
  }
  if (row.newCost != null && product.price_cents != null) {
    const rules = rulesFor(supplier, settings, product);
    const margin = marginOnPrice(row.newCost / 100, product.price_cents / 100, rules);
    if (margin != null && margin < 0) flags.push('below_cost');
  }
  return flags;
}

function defaultDecision(product: ProductLite | null, flags: string[], newCost: number | null, newPrice: number | null): ImportRow['decision'] {
  if (!product || newCost == null) return 'skip';
  if (flags.includes('suspect') || flags.includes('dup') || flags.includes('check_match')) return 'skip';
  return newCost !== product.cost_cents || newPrice !== product.price_cents ? 'apply' : 'skip';
}

function loadMatchers(db: DB, orgId: number, supplierId: number) {
  const links = new Map<string, number>();
  for (const r of db.prepare('SELECT supplier_code_norm, product_id FROM code_links WHERE org_id = ? AND supplier_id = ?').all(orgId, supplierId) as { supplier_code_norm: string; product_id: number }[])
    links.set(r.supplier_code_norm, r.product_id);
  const bySupplierCode = new Map<string, number>();
  for (const r of db
    .prepare('SELECT supplier_code_norm, id FROM products WHERE org_id = ? AND supplier_id = ? AND supplier_code_norm IS NOT NULL')
    .all(orgId, supplierId) as { supplier_code_norm: string; id: number }[])
    if (!bySupplierCode.has(r.supplier_code_norm)) bySupplierCode.set(r.supplier_code_norm, r.id);
  const byOwnCode = new Map<string, number>();
  for (const r of db
    .prepare('SELECT code_norm, id FROM products WHERE org_id = ? AND (supplier_id IS NULL OR supplier_id = ?)')
    .all(orgId, supplierId) as { code_norm: string; id: number }[])
    if (!byOwnCode.has(r.code_norm)) byOwnCode.set(r.code_norm, r.id);
  const products = new Map<number, ProductLite | null>();
  const getProduct = db.prepare('SELECT id, cost_cents, price_cents, markup_pct, iva_rate, supplier_id, description FROM products WHERE id = ? AND org_id = ?');
  const product = (id: number): ProductLite | null => {
    if (!products.has(id)) products.set(id, (getProduct.get(id, orgId) as ProductLite | undefined) ?? null);
    return products.get(id) ?? null;
  };
  return {
    match(codeNorm: string): { productId: number | null; type: ImportRow['match_type'] } {
      const l = links.get(codeNorm);
      if (l != null) return { productId: l, type: 'link' };
      const s = bySupplierCode.get(codeNorm);
      if (s != null) return { productId: s, type: 'supplier_code' };
      const o = byOwnCode.get(codeNorm);
      if (o != null) return { productId: o, type: 'own_code' };
      return { productId: null, type: 'none' };
    },
    product,
  };
}

export function computeRows(db: DB, orgId: number, importId: number, sheetName: string, rows: Cell[][], mapping: ColumnMapping): ImportStats {
  const imp = getImport(db, orgId, importId);
  if (!imp) throw new ImportError('Importación no encontrada.');
  const supplier = getSupplier(db, orgId, imp.supplier_id);
  if (!supplier) throw new ImportError('Proveedor no encontrado.');
  const settings = getSettings(db, orgId);
  const { items, skipped } = extractRows(rows, mapping);
  if (!items.length) throw new ImportError('No encontramos productos con esas columnas. Revisá cuál es el código y cuál el precio.');
  const matchers = loadMatchers(db, orgId, supplier.id);
  const seen = new Set<string>();

  db.transaction(() => {
    db.prepare('DELETE FROM import_rows WHERE import_id = ? AND org_id = ?').run(importId, orgId);
    const insert = db.prepare(
      `INSERT INTO import_rows (import_id, org_id, row_index, raw_code, code_norm, description, raw_price, list_price, pack_qty, product_id, match_type,
        old_cost_cents, new_cost_cents, old_price_cents, new_price_cents, flags, decision)
       VALUES (@import_id, @org_id, @row_index, @raw_code, @code_norm, @description, @raw_price, @list_price, @pack_qty, @product_id, @match_type,
        @old_cost_cents, @new_cost_cents, @old_price_cents, @new_price_cents, @flags, @decision)`,
    );
    for (const it of items) {
      const codeNorm = normalizeCode(it.code) || it.code.toUpperCase();
      const dup = seen.has(codeNorm);
      seen.add(codeNorm);
      const m = dup ? { productId: null, type: 'none' as const } : matchers.match(codeNorm);
      const product = m.productId != null ? matchers.product(m.productId) : null;
      const priced = priceItem(it.price, it.pack, product, supplier, settings);
      const flags = flagsFor(priced, product, dup, supplier, settings, weakOwnCodeMatch(m.type, it.description, product));
      insert.run({
        import_id: importId,
        org_id: orgId,
        row_index: it.rowIndex,
        raw_code: it.code,
        code_norm: codeNorm,
        description: it.description,
        raw_price: it.rawPrice,
        list_price: it.price,
        pack_qty: it.pack,
        product_id: product?.id ?? null,
        match_type: product ? m.type : 'none',
        old_cost_cents: product?.cost_cents ?? null,
        new_cost_cents: priced.newCost,
        old_price_cents: product?.price_cents ?? null,
        new_price_cents: priced.newPrice,
        flags: flags.length ? ` ${flags.join(' ')} ` : '',
        decision: defaultDecision(product, flags, priced.newCost, priced.newPrice),
      });
    }
    db.prepare("UPDATE imports SET sheet_name = ?, mapping_json = ?, rules_json = ?, status = 'review' WHERE id = ? AND org_id = ?").run(
      sheetName,
      JSON.stringify(mapping),
      JSON.stringify(rulesFor(supplier, settings)),
      importId,
      orgId,
    );
  })();
  return refreshStats(db, orgId, importId, skipped);
}

/** Re-prices existing rows (after the user edits supplier rules or settings) keeping manual links and choices. */
export function recomputeImport(db: DB, orgId: number, importId: number): ImportStats {
  const imp = getImport(db, orgId, importId);
  if (!imp || imp.status !== 'review') throw new ImportError('Solo se puede recalcular una lista en revisión.');
  const supplier = getSupplier(db, orgId, imp.supplier_id)!;
  const settings = getSettings(db, orgId);
  const matchers = loadMatchers(db, orgId, supplier.id);
  const rows = db.prepare('SELECT * FROM import_rows WHERE import_id = ? AND org_id = ?').all(importId, orgId) as ImportRow[];
  db.transaction(() => {
    const upd = db.prepare(
      `UPDATE import_rows SET old_cost_cents=@old_cost_cents, new_cost_cents=@new_cost_cents, old_price_cents=@old_price_cents,
       new_price_cents=@new_price_cents, flags=@flags, decision=@decision WHERE id=@id AND org_id=@org_id`,
    );
    for (const r of rows) {
      const product = r.product_id != null ? matchers.product(r.product_id) : null;
      const priced = priceItem(r.list_price, r.pack_qty, product, supplier, settings);
      const flags = flagsFor(priced, product, r.flags.includes(' dup '), supplier, settings, weakOwnCodeMatch(r.match_type, r.description, product));
      const decision = r.decision === 'create' && !product ? 'create' : defaultDecision(product, flags, priced.newCost, priced.newPrice);
      upd.run({
        id: r.id,
        org_id: orgId,
        old_cost_cents: product?.cost_cents ?? null,
        new_cost_cents: priced.newCost,
        old_price_cents: product?.price_cents ?? null,
        new_price_cents: priced.newPrice,
        flags: flags.length ? ` ${flags.join(' ')} ` : '',
        decision,
      });
    }
    db.prepare('UPDATE imports SET rules_json = ? WHERE id = ? AND org_id = ?').run(JSON.stringify(rulesFor(supplier, settings)), importId, orgId);
  })();
  return refreshStats(db, orgId, importId);
}

export function refreshStats(db: DB, orgId: number, importId: number, skippedRows?: number): ImportStats {
  const imp = getImport(db, orgId, importId)!;
  const prev = parseStats(imp.stats_json);
  const agg = db
    .prepare(
      `SELECT COUNT(*) total,
        SUM(product_id IS NOT NULL) matched,
        SUM(product_id IS NULL) unmatched,
        SUM(product_id IS NOT NULL AND new_cost_cents IS NOT NULL AND new_cost_cents IS NOT old_cost_cents) changed,
        SUM(product_id IS NOT NULL AND new_cost_cents > old_cost_cents) up,
        SUM(product_id IS NOT NULL AND new_cost_cents < old_cost_cents) down,
        SUM(product_id IS NOT NULL AND new_cost_cents = old_cost_cents) same,
        SUM(flags LIKE '% suspect %' OR flags LIKE '% no_price %' OR flags LIKE '% dup %' OR flags LIKE '% check_match %') flagged,
        SUM(flags LIKE '% below_cost %') below_cost,
        SUM(decision = 'apply') to_apply,
        SUM(decision = 'create') to_create
       FROM import_rows WHERE import_id = ? AND org_id = ?`,
    )
    .get(importId, orgId) as Record<string, number | null>;
  const changes = (
    db
      .prepare(
        `SELECT (CAST(new_cost_cents AS REAL) / old_cost_cents) - 1 AS c FROM import_rows
         WHERE import_id = ? AND org_id = ? AND product_id IS NOT NULL AND old_cost_cents > 0 AND new_cost_cents IS NOT NULL AND flags NOT LIKE '% suspect %'
         ORDER BY c`,
      )
      .pluck()
      .all(importId, orgId) as number[]
  ).filter((c) => Number.isFinite(c));
  const missing = db
    .prepare(
      `SELECT COUNT(*) FROM products WHERE org_id = ? AND supplier_id = ?
       AND id NOT IN (SELECT product_id FROM import_rows WHERE import_id = ? AND org_id = ? AND product_id IS NOT NULL)`,
    )
    .pluck()
    .get(orgId, imp.supplier_id, importId, orgId) as number;
  const n = (k: string) => Number(agg[k] ?? 0);
  const stats: ImportStats = {
    ...prev,
    total: n('total'),
    skippedRows: skippedRows ?? prev.skippedRows,
    matched: n('matched'),
    unmatched: n('unmatched'),
    changed: n('changed'),
    up: n('up'),
    down: n('down'),
    same: n('same'),
    flagged: n('flagged'),
    belowCost: n('below_cost'),
    missing,
    toApply: n('to_apply'),
    toCreate: n('to_create'),
    medianChange: changes.length ? changes[Math.floor(changes.length / 2)]! : null,
    maxUp: changes.length ? Math.max(0, changes[changes.length - 1]!) : null,
    maxDown: changes.length ? Math.min(0, changes[0]!) : null,
  };
  db.prepare('UPDATE imports SET stats_json = ? WHERE id = ? AND org_id = ?').run(JSON.stringify(stats), importId, orgId);
  return stats;
}

const FILTER_SQL: Record<RowFilter, string> = {
  all: '1=1',
  apply: "decision IN ('apply','create')",
  changed: 'product_id IS NOT NULL AND new_cost_cents IS NOT old_cost_cents',
  up: 'product_id IS NOT NULL AND new_cost_cents > old_cost_cents',
  down: 'product_id IS NOT NULL AND new_cost_cents < old_cost_cents',
  flagged: "(flags LIKE '% suspect %' OR flags LIKE '% no_price %' OR flags LIKE '% dup %' OR flags LIKE '% up_big %' OR flags LIKE '% down_big %' OR flags LIKE '% check_match %')",
  new: 'product_id IS NULL',
  below_cost: "flags LIKE '% below_cost %'",
  skip: "decision = 'skip'",
};
export const ROW_FILTERS = Object.keys(FILTER_SQL) as RowFilter[];

export function isRowFilter(v: string): v is RowFilter {
  return v in FILTER_SQL;
}

export function listRows(
  db: DB,
  orgId: number,
  importId: number,
  opts: { filter?: RowFilter; q?: string; page?: number; pageSize?: number },
): { rows: (ImportRow & { product_code: string | null; product_description: string | null })[]; total: number; page: number; pageSize: number } {
  const pageSize = Math.min(Math.max(opts.pageSize ?? 100, 10), 500);
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const where = [`r.import_id = @importId`, `r.org_id = @orgId`, FILTER_SQL[opts.filter ?? 'all'].replace(/\b(decision|product_id|new_cost_cents|old_cost_cents|flags)\b/g, 'r.$1')];
  const params: Record<string, unknown> = { importId, orgId, limit: pageSize, offset: (page - 1) * pageSize };
  const q = normalizeSearch(opts.q ?? '').slice(0, 80);
  if (q) {
    where.push(`(lower(r.raw_code) LIKE @q ESCAPE '\\' OR lower(r.description) LIKE @q ESCAPE '\\')`);
    params.q = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  }
  const w = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) FROM import_rows r WHERE ${w}`).pluck().get(params) as number;
  const rows = db
    .prepare(
      `SELECT r.*, p.code AS product_code, p.description AS product_description FROM import_rows r
       LEFT JOIN products p ON p.id = r.product_id AND p.org_id = r.org_id
       WHERE ${w} ORDER BY r.row_index LIMIT @limit OFFSET @offset`,
    )
    .all(params) as (ImportRow & { product_code: string | null; product_description: string | null })[];
  return { rows, total, page, pageSize };
}

function requireReview(db: DB, orgId: number, importId: number): ImportRecord {
  const imp = getImport(db, orgId, importId);
  if (!imp) throw new ImportError('Importación no encontrada.');
  if (imp.status !== 'review') throw new ImportError('Esta lista ya no está en revisión.');
  return imp;
}

export function setDecision(db: DB, orgId: number, importId: number, rowId: number, decision: ImportRow['decision']): void {
  requireReview(db, orgId, importId);
  const row = db.prepare('SELECT product_id, new_cost_cents FROM import_rows WHERE id = ? AND import_id = ? AND org_id = ?').get(rowId, importId, orgId) as
    | { product_id: number | null; new_cost_cents: number | null }
    | undefined;
  if (!row) throw new ImportError('Fila no encontrada.');
  if (decision === 'apply' && (row.product_id == null || row.new_cost_cents == null)) throw new ImportError('Esta fila no tiene un producto asociado o un precio válido.');
  if (decision === 'create' && (row.product_id != null || row.new_cost_cents == null)) throw new ImportError('Solo se pueden crear productos nuevos con precio.');
  db.prepare('UPDATE import_rows SET decision = ? WHERE id = ? AND org_id = ?').run(decision, rowId, orgId);
  refreshStats(db, orgId, importId);
}

/** Bulk decision for all rows matching a filter (only rows where the decision is valid). */
export function bulkDecision(db: DB, orgId: number, importId: number, filter: RowFilter, decision: ImportRow['decision']): number {
  requireReview(db, orgId, importId);
  const cond = FILTER_SQL[filter];
  let validity = '1=1';
  if (decision === 'apply') validity = "product_id IS NOT NULL AND new_cost_cents IS NOT NULL AND flags NOT LIKE '% dup %'";
  if (decision === 'create') validity = "product_id IS NULL AND new_cost_cents IS NOT NULL AND flags NOT LIKE '% dup %'";
  const r = db.prepare(`UPDATE import_rows SET decision = ? WHERE import_id = ? AND org_id = ? AND (${cond}) AND ${validity}`).run(decision, importId, orgId);
  refreshStats(db, orgId, importId);
  return r.changes;
}

/** Manually links a list row to an existing product; remembered for next lists of this supplier on apply. */
export function linkRow(db: DB, orgId: number, importId: number, rowId: number, productId: number): void {
  const imp = requireReview(db, orgId, importId);
  const product = db.prepare('SELECT id, cost_cents, price_cents, markup_pct, iva_rate, supplier_id, description FROM products WHERE id = ? AND org_id = ?').get(productId, orgId) as
    | ProductLite
    | undefined;
  if (!product) throw new ImportError('Producto no encontrado.');
  const row = db.prepare('SELECT * FROM import_rows WHERE id = ? AND import_id = ? AND org_id = ?').get(rowId, importId, orgId) as ImportRow | undefined;
  if (!row) throw new ImportError('Fila no encontrada.');
  const supplier = getSupplier(db, orgId, imp.supplier_id)!;
  const settings = getSettings(db, orgId);
  const priced = priceItem(row.list_price, row.pack_qty, product, supplier, settings);
  const flags = flagsFor(priced, product, row.flags.includes(' dup '), supplier, settings);
  db.prepare(
    `UPDATE import_rows SET product_id = ?, match_type = 'manual', old_cost_cents = ?, new_cost_cents = ?, old_price_cents = ?, new_price_cents = ?, flags = ?, decision = ?
     WHERE id = ? AND org_id = ?`,
  ).run(
    product.id,
    product.cost_cents,
    priced.newCost,
    product.price_cents,
    priced.newPrice,
    flags.length ? ` ${flags.join(' ')} ` : '',
    defaultDecision(product, flags, priced.newCost, priced.newPrice),
    rowId,
    orgId,
  );
  refreshStats(db, orgId, importId);
}

export interface ApplyResult {
  updated: number;
  created: number;
  skipped: number;
  limitReached: boolean;
}

export function applyImport(db: DB, orgId: number, importId: number, maxProducts: number): ApplyResult {
  const result: ApplyResult = { updated: 0, created: 0, skipped: 0, limitReached: false };
  db.transaction(() => {
    // Status check inside the transaction: a double submit applies only once.
    const imp = getImport(db, orgId, importId);
    if (!imp) throw new ImportError('Importación no encontrada.');
    if (imp.status !== 'review') throw new ImportError('Esta lista ya fue aplicada o descartada.');
    const now = new Date().toISOString();
    const rows = db.prepare("SELECT * FROM import_rows WHERE import_id = ? AND org_id = ? AND decision IN ('apply','create') ORDER BY row_index").all(importId, orgId) as ImportRow[];
    const getP = db.prepare('SELECT id, cost_cents, price_cents, supplier_id, supplier_code FROM products WHERE id = ? AND org_id = ?');
    const updP = db.prepare(
      `UPDATE products SET cost_cents = @cost, price_cents = @price, cost_updated_at = @now, updated_at = @now,
         supplier_id = COALESCE(supplier_id, @supplier_id),
         supplier_code = COALESCE(supplier_code, @supplier_code),
         supplier_code_norm = COALESCE(supplier_code_norm, @supplier_code_norm)
       WHERE id = @id AND org_id = @org_id`,
    );
    const hist = db.prepare(
      `INSERT INTO price_history (org_id, product_id, import_id, kind, old_cost_cents, new_cost_cents, old_price_cents, new_price_cents, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const link = db.prepare('INSERT OR REPLACE INTO code_links (org_id, supplier_id, supplier_code_norm, product_id) VALUES (?, ?, ?, ?)');
    const codeTaken = db.prepare('SELECT 1 FROM products WHERE org_id = ? AND code = ?');
    const insP = db.prepare(
      `INSERT INTO products (org_id, code, code_norm, description, search_text, supplier_id, supplier_code, supplier_code_norm, cost_cents, price_cents, cost_updated_at)
       VALUES (@org_id, @code, @code_norm, @description, @search_text, @supplier_id, @supplier_code, @supplier_code_norm, @cost, @price, @now)`,
    );
    const setRowProduct = db.prepare('UPDATE import_rows SET product_id = ? WHERE id = ? AND org_id = ?');
    let productCount = countProducts(db, orgId);
    for (const r of rows) {
      if (r.new_cost_cents == null || r.new_price_cents == null) {
        result.skipped++;
        continue;
      }
      if (r.decision === 'apply' && r.product_id != null) {
        const p = getP.get(r.product_id, orgId) as { id: number; cost_cents: number | null; price_cents: number | null } | undefined;
        if (!p) {
          result.skipped++;
          continue;
        }
        updP.run({ cost: r.new_cost_cents, price: r.new_price_cents, now, supplier_id: imp.supplier_id, supplier_code: r.raw_code, supplier_code_norm: r.code_norm, id: p.id, org_id: orgId });
        hist.run(orgId, p.id, importId, 'update', p.cost_cents, r.new_cost_cents, p.price_cents, r.new_price_cents, now);
        result.updated++;
      } else if (r.decision === 'create' && r.product_id == null) {
        if (productCount >= maxProducts) {
          result.limitReached = true;
          result.skipped++;
          continue;
        }
        const code = r.raw_code.slice(0, 60);
        if (codeTaken.get(orgId, code)) {
          result.skipped++;
          continue;
        }
        const id = Number(
          insP.run({
            org_id: orgId,
            code,
            code_norm: normalizeCode(code),
            description: r.description,
            search_text: searchText(code, r.description, r.raw_code),
            supplier_id: imp.supplier_id,
            supplier_code: r.raw_code,
            supplier_code_norm: r.code_norm,
            cost: r.new_cost_cents,
            price: r.new_price_cents,
            now,
          }).lastInsertRowid,
        );
        setRowProduct.run(id, r.id, orgId);
        hist.run(orgId, id, importId, 'create', null, r.new_cost_cents, null, r.new_price_cents, now);
        productCount++;
        result.created++;
      } else result.skipped++;
    }
    // Remember manual links even for rows whose price did not change, so the next list matches them.
    const manual = db.prepare("SELECT code_norm, product_id FROM import_rows WHERE import_id = ? AND org_id = ? AND match_type = 'manual' AND product_id IS NOT NULL").all(importId, orgId) as {
      code_norm: string;
      product_id: number;
    }[];
    for (const m of manual) link.run(orgId, imp.supplier_id, m.code_norm, m.product_id);
    const stats = parseStats(imp.stats_json);
    stats.applied = { updated: result.updated, created: result.created, skipped: result.skipped };
    db.prepare("UPDATE imports SET status = 'applied', applied_at = ?, stats_json = ? WHERE id = ? AND org_id = ?").run(now, JSON.stringify(stats), importId, orgId);
    db.prepare('UPDATE suppliers SET last_list_at = ? WHERE id = ? AND org_id = ?').run(now, imp.supplier_id, orgId);
  })();
  return result;
}

export interface RevertResult {
  restored: number;
  deleted: number;
  conflicts: number;
}

/**
 * Undo an applied list. A product is only restored if nobody changed it after this import
 * (its current cost and price still equal what this import wrote); otherwise it is a conflict and left alone.
 */
export function revertImport(db: DB, orgId: number, importId: number): RevertResult {
  const result: RevertResult = { restored: 0, deleted: 0, conflicts: 0 };
  db.transaction(() => {
    const imp = getImport(db, orgId, importId);
    if (!imp) throw new ImportError('Importación no encontrada.');
    if (imp.status !== 'applied') throw new ImportError('Solo se puede deshacer una lista aplicada.');
    const now = new Date().toISOString();
    const hist = db
      .prepare("SELECT * FROM price_history WHERE import_id = ? AND org_id = ? AND kind IN ('update','create') ORDER BY id DESC")
      .all(importId, orgId) as { id: number; product_id: number; kind: string; old_cost_cents: number | null; new_cost_cents: number | null; old_price_cents: number | null; new_price_cents: number | null }[];
    const getP = db.prepare('SELECT cost_cents, price_cents FROM products WHERE id = ? AND org_id = ?');
    const laterChanges = db.prepare('SELECT COUNT(*) FROM price_history WHERE org_id = ? AND product_id = ? AND id > ?').pluck();
    for (const h of hist) {
      const p = getP.get(h.product_id, orgId) as { cost_cents: number | null; price_cents: number | null } | undefined;
      if (!p) continue;
      const untouched = p.cost_cents === h.new_cost_cents && p.price_cents === h.new_price_cents && (laterChanges.get(orgId, h.product_id, h.id) as number) === 0;
      if (!untouched) {
        result.conflicts++;
        continue;
      }
      if (h.kind === 'create') {
        db.prepare('DELETE FROM products WHERE id = ? AND org_id = ?').run(h.product_id, orgId);
        result.deleted++;
      } else {
        db.prepare('UPDATE products SET cost_cents = ?, price_cents = ?, updated_at = ? WHERE id = ? AND org_id = ?').run(h.old_cost_cents, h.old_price_cents, now, h.product_id, orgId);
        db.prepare("INSERT INTO price_history (org_id, product_id, import_id, kind, old_cost_cents, new_cost_cents, old_price_cents, new_price_cents, created_at) VALUES (?, ?, ?, 'revert', ?, ?, ?, ?, ?)").run(
          orgId,
          h.product_id,
          importId,
          h.new_cost_cents,
          h.old_cost_cents,
          h.new_price_cents,
          h.old_price_cents,
          now,
        );
        result.restored++;
      }
    }
    const stats = parseStats(imp.stats_json);
    stats.reverted = result;
    db.prepare("UPDATE imports SET status = 'reverted', reverted_at = ?, stats_json = ? WHERE id = ? AND org_id = ?").run(now, JSON.stringify(stats), importId, orgId);
  })();
  return result;
}

export function discardImport(db: DB, orgId: number, importId: number): void {
  const r = db
    .prepare("UPDATE imports SET status = 'discarded', file_blob = NULL WHERE id = ? AND org_id = ? AND status IN ('uploaded','review')")
    .run(importId, orgId);
  if (r.changes !== 1) throw new ImportError('Esta lista no se puede descartar.');
  db.prepare('DELETE FROM import_rows WHERE import_id = ? AND org_id = ?').run(importId, orgId);
  gridCache.delete(importId);
}

export function listImports(db: DB, orgId: number, opts: { supplierId?: number; limit?: number } = {}) {
  const params: unknown[] = [orgId];
  let where = 'i.org_id = ?';
  if (opts.supplierId) {
    where += ' AND i.supplier_id = ?';
    params.push(opts.supplierId);
  }
  params.push(Math.min(opts.limit ?? 50, 200));
  return db
    .prepare(
      `SELECT i.id, i.file_name, i.status, i.stats_json, i.created_at, i.applied_at, i.supplier_id, s.name AS supplier_name
       FROM imports i JOIN suppliers s ON s.id = i.supplier_id AND s.org_id = i.org_id WHERE ${where} ORDER BY i.id DESC LIMIT ?`,
    )
    .all(...params) as { id: number; file_name: string; status: ImportStatus; stats_json: string; created_at: string; applied_at: string | null; supplier_id: number; supplier_name: string }[];
}

/** Products of the supplier that were not in this list (discontinued or renamed codes). */
export function missingProducts(db: DB, orgId: number, importId: number, limit = 200) {
  const imp = getImport(db, orgId, importId);
  if (!imp) return [];
  return db
    .prepare(
      `SELECT id, code, description, supplier_code, cost_cents, price_cents FROM products WHERE org_id = ? AND supplier_id = ?
       AND id NOT IN (SELECT product_id FROM import_rows WHERE import_id = ? AND org_id = ? AND product_id IS NOT NULL)
       ORDER BY code LIMIT ?`,
    )
    .all(orgId, imp.supplier_id, importId, orgId, limit) as { id: number; code: string; description: string; supplier_code: string | null; cost_cents: number | null; price_cents: number | null }[];
}
