/**
 * RESEARCH ONLY. Level 2 (transformation) benchmark of Remarcá on REAL public Argentine price lists (docs/20 §6).
 * Catalogs built here are SYNTHETIC BENCHMARK catalogs derived from public lists.
 *
 *   BENCH_DIR=<raw files dir> PARSE_IN_WORKER=0 npx tsx scripts/research/real-transform.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { openDb, type DB } from '../../src/db/index.js';
import { signup } from '../../src/services/auth.js';
import { createSupplier, supplierFormSchema } from '../../src/services/suppliers.js';
import { applyImport, bulkDecision, confirmMapping, createImport } from '../../src/services/imports.js';
import { readWorkbook, type Cell } from '../../src/lib/sheet.js';
import { detectColumns, type ColumnMapping } from '../../src/lib/detect.js';
import { normalizeCode, normalizeSearch } from '../../src/lib/match.js';
import { parseNumber } from '../../src/lib/numbers.js';
import { toCents } from '../../src/lib/money.js';

const BENCH = process.env.BENCH_DIR!;
const out: Record<string, unknown> = {};

async function sheet(file: string, name: string) {
  const wb = await readWorkbook(basename(file), readFileSync(join(BENCH, file)));
  return wb.sheets.find((s) => s.name === name)!.rows;
}
async function freshOrg() {
  const db = openDb(':memory:');
  const { orgId, userId } = await signup(db, { name: 'Bench', business: 'SYNTHETIC BENCHMARK', email: 'bench@lab.test', password: 'password123' });
  return { db, orgId, userId };
}
async function importFile(db: DB, orgId: number, userId: number, supplierId: number, file: string, sheetName: string, mapping: ColumnMapping) {
  const up = await createImport(db, orgId, userId, supplierId, basename(file), readFileSync(join(BENCH, file)));
  await confirmMapping(db, orgId, up.importId, sheetName, mapping);
  return up.importId;
}
/** Per-row attribute that Remarcá does not read (currency, IVA rate), keyed by exact code. */
function attr(rows: Cell[][], m: ColumnMapping, col: number) {
  const map = new Map<string, string>();
  for (let i = m.headerRow + 1; i < rows.length; i++) {
    const c = rows[i]?.[m.code!];
    if (c != null && c !== '') map.set(normalizeCode(String(c)), String(rows[i]?.[col] ?? '').trim());
  }
  return map;
}

/** T1/T2 — JB mixes pesos and dollars row by row ("$" / "U$S" / "U$SB" in column P). */
async function mixedCurrency() {
  const file = 'jbjusto_electricidad_sep2026.xls', name = 'Hoja1', rate = 1535; // rate printed in the file header ("U$S 1535")
  const rows = await sheet(file, name);
  const m = detectColumns(rows);
  const cur = attr(rows, m, 15);
  // T1: store without catalog creates its products from the first list (supplier configured in ARS, the default).
  {
    const { db, orgId, userId } = await freshOrg();
    const sid = createSupplier(db, orgId, supplierFormSchema.parse({ name: 'JB' }), 1000);
    const importId = await importFile(db, orgId, userId, sid, file, name, m);
    bulkDecision(db, orgId, importId, 'new', 'create');
    const r = applyImport(db, orgId, importId, 1_000_000);
    const created = db.prepare('SELECT supplier_code, cost_cents FROM products WHERE org_id = ?').all(orgId) as { supplier_code: string; cost_cents: number }[];
    const usd = created.filter((p) => (cur.get(normalizeCode(p.supplier_code)) ?? '').startsWith('U$S'));
    out.t1_create_from_mixed_list = { created: r.created, createdFromDollarRows: usd.length, ifCreatedCostWouldBeUnderstatedBy: `x${rate} (dollar amount stored as pesos)`, rowsFlaggedOtherCurrency: db.prepare("SELECT COUNT(*) FROM import_rows WHERE import_id = ? AND flags LIKE '% currency %'").pluck().get(importId) };
  }
  // T2: store with an existing catalog whose costs are right in pesos (SYNTHETIC BENCHMARK: previous cost = today's / 1.03).
  {
    const { db, orgId, userId } = await freshOrg();
    const sid = createSupplier(db, orgId, supplierFormSchema.parse({ name: 'JB' }), 1000);
    const ins = db.prepare('INSERT OR IGNORE INTO products (org_id, code, code_norm, description, search_text, supplier_id, supplier_code, supplier_code_norm, cost_cents, price_cents) VALUES (?,?,?,?,?,?,?,?,?,?)');
    let n = 0;
    for (let i = m.headerRow + 1; i < rows.length; i += 10) {
      const r = rows[i]!;
      const code = r[m.code!], price = parseNumber(r[m.price!], m.decimal);
      if (code == null || price == null || price <= 0) continue;
      const c = String(code).trim();
      const ars = (cur.get(normalizeCode(c)) ?? '').startsWith('U$S') ? price * rate : price;
      const cost = toCents(ars / 1.03);
      n += ins.run(orgId, `SB-${i}`, normalizeCode(`SB-${i}`), String(r[m.description!] ?? ''), normalizeSearch(c), sid, c, normalizeCode(c), cost, Math.round(cost * 1.6)).changes;
    }
    const importId = await importFile(db, orgId, userId, sid, file, name, m);
    const res = db.prepare('SELECT raw_code, decision, flags FROM import_rows WHERE import_id = ? AND product_id IS NOT NULL').all(importId) as { raw_code: string; decision: string; flags: string }[];
    const isUsd = (c: string) => (cur.get(normalizeCode(c)) ?? '').startsWith('U$S');
    const tally = (xs: typeof res) => ({ rows: xs.length, applied: xs.filter((x) => x.decision === 'apply').length, heldSuspect: xs.filter((x) => x.flags.includes(' suspect ')).length });
    out.t2_update_with_existing_catalog = { catalogProducts: n, supplierCurrency: 'ARS', dollarRows: tally(res.filter((x) => isUsd(x.raw_code))), pesoRows: tally(res.filter((x) => !isUsd(x.raw_code))) };
  }
  out.t_currency_counts = Object.fromEntries([...new Set(cur.values())].map((v) => [v || '(empty)', [...cur.values()].filter((x) => x === v).length]));
}

/** T3 — AS lists the IVA rate per row (21 or 10.5); Remarcá applies the supplier's single rate. */
async function ivaPerRow() {
  const file = 'aselec_listado.xls', name = 'Hoja1';
  const rows = await sheet(file, name);
  const m = detectColumns(rows);
  const iva = attr(rows, m, 4);
  const { db, orgId, userId } = await freshOrg();
  const sid = createSupplier(db, orgId, supplierFormSchema.parse({ name: 'AS', iva_rate: '21', list_includes_iva: '0' }), 1000);
  const importId = await importFile(db, orgId, userId, sid, file, name, m);
  bulkDecision(db, orgId, importId, 'new', 'create');
  applyImport(db, orgId, importId, 1_000_000);
  const created = db.prepare('SELECT supplier_code, cost_cents, price_cents, iva_rate FROM products WHERE org_id = ?').all(orgId) as { supplier_code: string; cost_cents: number; price_cents: number; iva_rate: number | null }[];
  const reduced = created.filter((p) => Number(iva.get(normalizeCode(p.supplier_code))) === 10.5);
  const ratio = reduced.length ? reduced.map((p) => p.price_cents / p.cost_cents) : [];
  const full = created.filter((p) => Number(iva.get(normalizeCode(p.supplier_code))) === 21).map((p) => p.price_cents / p.cost_cents);
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? null;
  out.t3_iva_per_row = {
    created: created.length,
    rowsAt10_5: reduced.length,
    productIvaRateSet: created.filter((p) => p.iva_rate != null).length,
    medianPriceOverCost_10_5rows: median(ratio),
    medianPriceOverCost_21rows: median(full),
    note: 'same ratio for both groups = the 10.5% items got 21% IVA in the sale price (overstated by 1.21/1.105 - 1 = 9.5%)',
  };
}

/** T4 — placeholder prices in Camba (0 and 1). */
async function placeholders() {
  const file = 'camba_sabana/Sabana_30_08_2026.xlsx', name = 'Sheet1';
  const rows = await sheet(file, name);
  const m = { ...detectColumns(rows), code: 1 };
  const { db, orgId, userId } = await freshOrg();
  const sid = createSupplier(db, orgId, supplierFormSchema.parse({ name: 'Camba' }), 1000);
  const importId = await importFile(db, orgId, userId, sid, file, name, m);
  const q = (w: string) => db.prepare(`SELECT COUNT(*) FROM import_rows WHERE import_id = ? AND ${w}`).pluck().get(importId) as number;
  bulkDecision(db, orgId, importId, 'new', 'create');
  const willCreateAtOne = q("decision = 'create' AND list_price > 0 AND list_price <= 1");
  out.t4_placeholder_prices = { zeroPriceRows: q('list_price = 0'), zeroHeldAsNoPrice: q("list_price = 0 AND flags LIKE '% no_price %'"), oneOrLessRows: q('list_price > 0 AND list_price <= 1'), createdAtOnePesoIfBulkCreate: willCreateAtOne };
}

/** T5 — text prices ("$ 34.514,49") in the public medicines reference list. */
async function textPrices() {
  const rows = await sheet('med_2026_09.xlsx', 'Sin únicas');
  const cells = rows.slice(4).map((r) => r[6]).filter((c) => c != null && c !== '');
  const text = cells.filter((c) => typeof c === 'string') as string[];
  const parsed = text.map((t) => parseNumber(t, ','));
  const check = text.map((t, i) => Math.abs(Number(t.replace(/[$\s.]/g, '').replace(',', '.')) - (parsed[i] ?? NaN)) < 0.001);
  out.t5_text_prices = { cells: cells.length, textCells: text.length, parsed: parsed.filter((p) => p != null).length, equalToIndependentParse: check.filter(Boolean).length, sample: text.slice(0, 3) };
}

/** T6 — pack columns detected on real lists and what Remarcá does with them by default. */
async function packs() {
  const res: Record<string, unknown> = {};
  for (const [id, file, name] of [
    ['camba', 'camba_sabana/Sabana_30_08_2026.xlsx', 'Sheet1'],
    ['cambre_A', 'accme_cambre_A.xlsx', 'LISTA DE PRECIO'],
    ['cambre_B', 'accme_cambre_B.xlsx', 'LISTA DE PRECIOS'],
    ['strada_pdf', 'accme_strada.pdf', 'PDF'],
  ] as const) {
    const rows = await sheet(file, name);
    const d = detectColumns(rows);
    res[id] = { packColumn: d.pack == null ? null : `${d.pack}:${d.headers[d.pack]}`, priceHeader: d.price == null ? null : d.headers[d.price], dividedByDefault: false };
  }
  out.t6_packs = res;
}

for (const f of [mixedCurrency, ivaPerRow, placeholders, textPrices, packs]) {
  await f();
  console.log(f.name, 'done');
}
console.log(JSON.stringify(out, null, 1));
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 2));
