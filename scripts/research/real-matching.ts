/**
 * RESEARCH ONLY. Level 3 (matching) benchmark of Remarcá on REAL public Argentine price lists (docs/20 §7–§10).
 * Every catalog built here is a SYNTHETIC BENCHMARK catalog derived from a public list: no real store's catalog is used.
 * Identity ground truth = the supplier's own code string (trimmed, upper-cased, whitespace collapsed).
 *
 *   BENCH_DIR=<raw files dir> PARSE_IN_WORKER=0 npx tsx scripts/research/real-matching.ts [experiment...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { openDb, type DB } from '../../src/db/index.js';
import { signup } from '../../src/services/auth.js';
import { createSupplier, supplierFormSchema } from '../../src/services/suppliers.js';
import { confirmMapping, createImport, getImport, parseStats } from '../../src/services/imports.js';
import { readWorkbook, type Cell } from '../../src/lib/sheet.js';
import { detectColumns, extractRows, type ColumnMapping, type ExtractedRow } from '../../src/lib/detect.js';
import { normalizeCode, normalizeSearch } from '../../src/lib/match.js';
import { toCents } from '../../src/lib/money.js';

const BENCH = process.env.BENCH_DIR!;
const exact = (c: string) => c.trim().toUpperCase().replace(/\s+/g, ' ');
// The pre-fix normalization (punctuation, spaces and leading zeros ignored), kept here so the experiment
// builds the same catalog whatever the product's current normalization is.
const looseKey = (c: string) => c.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '').replace(/^0+(?=.)/, '');
const out: Record<string, unknown> = {};

interface ListSpec { id: string; file: string; sheet: string; override?: Partial<ColumnMapping> }
const LISTS: Record<string, ListSpec> = {
  camba: { id: 'camba', file: 'camba_sabana/Sabana_30_08_2026.xlsx', sheet: 'Sheet1', override: { code: 1 } }, // "Referencia interna", see docs/20 §5
  jb: { id: 'jb', file: 'jbjusto_electricidad_sep2026.xls', sheet: 'Hoja1' },
  aselec: { id: 'aselec', file: 'aselec_listado.xls', sheet: 'Hoja1' },
};

async function loadList(spec: ListSpec): Promise<{ rows: Cell[][]; mapping: ColumnMapping; items: ExtractedRow[] }> {
  const wb = await readWorkbook(basename(spec.file), readFileSync(join(BENCH, spec.file)));
  const rows = wb.sheets.find((s) => s.name === spec.sheet)!.rows;
  const mapping = { ...detectColumns(rows), ...spec.override };
  return { rows, mapping, items: extractRows(rows, mapping).items };
}

async function freshOrg() {
  const db = openDb(':memory:');
  const { orgId, userId } = await signup(db, { name: 'Bench', business: 'SYNTHETIC BENCHMARK', email: 'bench@lab.test', password: 'password123' });
  return { db, orgId, userId };
}

function addProducts(db: DB, orgId: number, products: { code: string; description: string; supplierId: number | null; supplierCode: string | null; cost: number | null }[]) {
  const ins = db.prepare(
    `INSERT OR IGNORE INTO products (org_id, code, code_norm, description, search_text, supplier_id, supplier_code, supplier_code_norm, cost_cents, price_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  let n = 0;
  db.transaction(() => {
    for (const p of products) {
      const cost = p.cost == null ? null : toCents(p.cost);
      n += ins.run(orgId, p.code, normalizeCode(p.code), p.description, normalizeSearch(`${p.code} ${p.description}`), p.supplierId, p.supplierCode, p.supplierCode ? normalizeCode(p.supplierCode) : null, cost, cost == null ? null : Math.round(cost * 1.6)).changes;
    }
  })();
  return n;
}

async function runImport(db: DB, orgId: number, userId: number, supplierId: number, spec: ListSpec, mapping: ColumnMapping) {
  const up = await createImport(db, orgId, userId, supplierId, basename(spec.file), readFileSync(join(BENCH, spec.file)));
  await confirmMapping(db, orgId, up.importId, spec.sheet, mapping);
  const rows = db
    .prepare(
      `SELECT r.row_index, r.raw_code, r.description, r.match_type, r.flags, r.decision, r.product_id, r.list_price, p.code AS p_code, p.supplier_code AS p_supplier_code, p.description AS p_description
       FROM import_rows r LEFT JOIN products p ON p.id = r.product_id WHERE r.import_id = ? ORDER BY r.row_index`,
    )
    .all(up.importId) as { row_index: number; raw_code: string; description: string; match_type: string; flags: string; decision: string; product_id: number | null; list_price: number | null; p_code: string | null; p_supplier_code: string | null; p_description: string | null }[];
  return { importId: up.importId, rows, stats: parseStats(getImport(db, orgId, up.importId)!.stats_json) };
}

/** M1 — codes that differ only in punctuation/spaces inside ONE supplier's list ("1.5.12" vs "15.12"). */
async function m1Collisions() {
  const res: Record<string, unknown> = {};
  for (const spec of Object.values(LISTS)) {
    const { mapping, items } = await loadList(spec);
    const groups = new Map<string, ExtractedRow[]>();
    for (const it of items) {
      const k = looseKey(it.code) || it.code.toUpperCase();
      groups.set(k, [...(groups.get(k) ?? []), it]);
    }
    const colliding = [...groups.values()].filter((g) => new Set(g.map((i) => exact(i.code))).size > 1);
    // SYNTHETIC BENCHMARK catalog: a store that carries only the LAST product of each colliding group
    // (so a different product appears earlier in the list), plus every 40th non-colliding product as a control.
    const collidingCodes = new Set(colliding.flatMap((g) => g.map((i) => exact(i.code))));
    const carried = colliding.map((g) => g[g.length - 1]!);
    const controls = items.filter((it, i) => i % 40 === 0 && !collidingCodes.has(exact(it.code)) && it.price != null);
    const { db, orgId, userId } = await freshOrg();
    const sid = createSupplier(db, orgId, supplierFormSchema.parse({ name: spec.id }), 1000);
    let n = 0;
    addProducts(db, orgId, [...carried, ...controls].filter((it) => it.price != null).map((it) => ({ code: `SB-${++n}`, description: it.description, supplierId: sid, supplierCode: it.code, cost: it.price! / 1.05 })));
    const { rows } = await runImport(db, orgId, userId, sid, spec, mapping);
    const matched = rows.filter((r) => r.product_id != null);
    const wrong = matched.filter((r) => exact(r.raw_code) !== exact(r.p_supplier_code ?? ''));
    const carriedSet = new Set(carried.map((c) => exact(c.code)));
    const carriedRight = matched.filter((r) => carriedSet.has(exact(r.raw_code)) && exact(r.raw_code) === exact(r.p_supplier_code ?? '')).length;
    res[spec.id] = {
      listItems: items.length,
      collidingGroups: colliding.length,
      catalog: { carriedFromCollidingGroups: carried.length, controls: controls.length },
      matchedRows: matched.length,
      wrongProduct: wrong.length,
      wrongProductAppliedByDefault: wrong.filter((r) => r.decision === 'apply').length,
      wrongSample: wrong.slice(0, 6).map((r) => `list ${r.raw_code} "${r.description.slice(0, 40)}" → product ${r.p_supplier_code} "${(r.p_description ?? '').slice(0, 40)}" [${r.decision}${r.flags}]`),
      carriedMatchedToRightRow: `${carriedRight}/${carried.length}`,
      controlsMatchedRight: matched.filter((r) => !collidingCodes.has(exact(r.raw_code)) && exact(r.raw_code) === exact(r.p_supplier_code ?? '')).length,
    };
    console.log('M1', spec.id, JSON.stringify(res[spec.id]));
  }
  out.m1 = res;
}

/** M2 — Camba current list vs the "Codigos Viejos" sheet shipped in the same file (old descriptions, same codes). */
async function m2CambaOldNew() {
  const spec = LISTS.camba!;
  const wb = await readWorkbook(basename(spec.file), readFileSync(join(BENCH, spec.file)));
  const old = wb.sheets.find((s) => s.name === 'Codigos Viejos')!.rows.slice(1).filter((r) => r[0] != null);
  const { mapping, items } = await loadList(spec);
  const oldCodes = new Set(old.map((r) => exact(String(r[0]))));
  const newCodes = new Set(items.map((i) => exact(i.code)));
  const truth = { shared: [...newCodes].filter((c) => oldCodes.has(c)).length, onlyNew: [...newCodes].filter((c) => !oldCodes.has(c)).length, onlyOld: [...oldCodes].filter((c) => !newCodes.has(c)).length };
  const oldDesc = new Map(old.map((r) => [exact(String(r[0])), String(r[2] ?? '')]));
  const descChanged = items.filter((i) => oldDesc.has(exact(i.code)) && normalizeSearch(oldDesc.get(exact(i.code))!) !== normalizeSearch(i.description)).length;
  const { db, orgId, userId } = await freshOrg();
  const sid = createSupplier(db, orgId, supplierFormSchema.parse({ name: 'camba' }), 1000);
  // SYNTHETIC BENCHMARK catalog = the old sheet (store coded products with the supplier's code, old descriptions, no cost yet).
  addProducts(db, orgId, old.map((r) => ({ code: String(r[0]).trim(), description: String(r[2] ?? ''), supplierId: sid, supplierCode: String(r[0]).trim(), cost: 1000 })));
  const { rows, stats } = await runImport(db, orgId, userId, sid, spec, mapping);
  const matched = rows.filter((r) => r.product_id != null);
  const wrong = matched.filter((r) => exact(r.raw_code) !== exact(r.p_supplier_code ?? ''));
  const unmatchedButShared = rows.filter((r) => r.product_id == null && oldCodes.has(exact(r.raw_code)));
  out.m2 = {
    truth,
    descriptionsChangedForSharedCodes: descChanged,
    remarca: { matched: matched.length, wrongProduct: wrong.length, unmatched: rows.length - matched.length, missingFromList: stats.missing, flaggedDup: rows.filter((r) => r.flags.includes(' dup ')).length, checkMatch: rows.filter((r) => r.flags.includes(' check_match ')).length },
    sharedCodesNotMatched: unmatchedButShared.length,
    sharedNotMatchedSample: unmatchedButShared.slice(0, 5).map((r) => `${r.raw_code} [${r.flags.trim()}]`),
    wrongSample: wrong.slice(0, 5).map((r) => `${r.raw_code} → ${r.p_supplier_code}`),
  };
  console.log('M2', JSON.stringify(out.m2));
}

/** M3 — what a naive description matcher (NOT in the product) would do on real old→new descriptions. */
async function m3DescriptionBaseline() {
  const spec = LISTS.camba!;
  const wb = await readWorkbook(basename(spec.file), readFileSync(join(BENCH, spec.file)));
  const old = wb.sheets.find((s) => s.name === 'Codigos Viejos')!.rows.slice(1).filter((r) => r[0] != null);
  const { items } = await loadList(spec);
  const tok = (s: string) => new Set(normalizeSearch(s).replace(/(\d)\s*x\s*(\d)/g, '$1x$2').split(/[^a-z0-9/.]+/).filter((w) => w.length >= 1));
  const newIdx = items.map((i) => ({ code: exact(i.code), t: tok(i.description) }));
  const inverted = new Map<string, number[]>();
  newIdx.forEach((n, i) => n.t.forEach((w) => inverted.set(w, [...(inverted.get(w) ?? []), i])));
  const newSet = new Set(newIdx.map((n) => n.code));
  // Only rows whose description changed (identical descriptions are trivial).
  const sample = old.filter((r) => newSet.has(exact(String(r[0])))).filter((r) => {
    const n = items.find((i) => exact(i.code) === exact(String(r[0])));
    return n && normalizeSearch(n.description) !== normalizeSearch(String(r[2] ?? ''));
  });
  // (a) naive: best token Jaccard. (b) guarded: candidate must contain every token with a digit (sizes, grades)
  // of the old description, and the best score must be unique; otherwise abstain (manual review).
  const digits = (t: Set<string>) => [...t].filter((w) => /\d/.test(w));
  const naive = { right: 0, wrong: 0, wrongSameFamily: 0, ties: 0 };
  const guarded = { right: 0, wrong: 0, abstained: 0 };
  const examples: string[] = [];
  for (const r of sample) {
    const t = tok(String(r[2] ?? ''));
    const score = new Map<number, number>();
    for (const w of t) for (const i of inverted.get(w) ?? []) score.set(i, (score.get(i) ?? 0) + 1);
    const ranked = [...score].map(([i, s]) => ({ i, j: s / (t.size + newIdx[i]!.t.size - s) })).sort((a, b) => b.j - a.j);
    const truthCode = exact(String(r[0]));
    const best = ranked[0];
    if (!best) naive.wrong++;
    else {
      if (ranked[1] && ranked[1].j === best.j) naive.ties++;
      if (newIdx[best.i]!.code === truthCode) naive.right++;
      else {
        naive.wrong++;
        if (newIdx[best.i]!.code.split('.')[0] === truthCode.split('.')[0]) naive.wrongSameFamily++;
        if (examples.length < 6) examples.push(`old "${String(r[2]).slice(0, 40)}" (${truthCode}) → ${newIdx[best.i]!.code} "${items[best.i]!.description.slice(0, 40)}"`);
      }
    }
    const need = digits(t);
    const ok = ranked.filter((c) => need.every((w) => newIdx[c.i]!.t.has(w)));
    if (!ok.length || (ok[1] && ok[1].j === ok[0]!.j)) guarded.abstained++;
    else if (newIdx[ok[0]!.i]!.code === truthCode) guarded.right++;
    else guarded.wrong++;
  }
  out.m3 = { evaluated: sample.length, naive, guarded, naiveWrongExamples: examples };
  console.log('M3', JSON.stringify(out.m3));
}

/** M4 — supplier change: a store coded by manufacturer code (AS "Cód.Alter") switches to another distributor (JB). */
async function m4SupplierChange() {
  const as = await loadList(LISTS.aselec!);
  const asRows = as.rows;
  const altCol = 3; // "Cód.Alter" (manufacturer / alternative code)
  const asItems = as.items.map((it) => ({ ...it, alt: String(asRows[it.rowIndex]?.[altCol] ?? '').trim() })).filter((it) => it.alt.length >= 3 && it.price != null);
  const jb = await loadList(LISTS.jb!);
  const jbByExact = new Map(jb.items.map((i) => [exact(i.code), i]));
  const truthPairs = asItems.filter((i) => jbByExact.has(exact(i.alt)));
  const res: Record<string, unknown> = { asItemsWithAltCode: asItems.length, altEqualsJbCodeExact: truthPairs.length };
  for (const variant of ['products_assigned_to_old_supplier', 'products_without_supplier', 'supplier_code_is_distributor_code'] as const) {
    const { db, orgId, userId } = await freshOrg();
    const asSid = createSupplier(db, orgId, supplierFormSchema.parse({ name: 'AS (old supplier)' }), 1000);
    const jbSid = createSupplier(db, orgId, supplierFormSchema.parse({ name: 'JB (new supplier)' }), 1000);
    const seenAlt = new Set<string>();
    addProducts(
      db,
      orgId,
      asItems
        .filter((i) => !seenAlt.has(exact(i.alt)) && seenAlt.add(exact(i.alt)))
        .map((i) =>
          variant === 'supplier_code_is_distributor_code'
            ? { code: `SB-${i.code}`, description: i.description, supplierId: asSid, supplierCode: i.code, cost: i.price! }
            : { code: i.alt, description: i.description, supplierId: variant === 'products_assigned_to_old_supplier' ? asSid : null, supplierCode: variant === 'products_assigned_to_old_supplier' ? i.code : null, cost: i.price! },
        ),
    );
    const { rows } = await runImport(db, orgId, userId, jbSid, LISTS.jb!, jb.mapping);
    const matched = rows.filter((r) => r.product_id != null);
    const exactSame = matched.filter((r) => exact(r.raw_code) === exact(r.p_code ?? ''));
    const looseOnly = matched.filter((r) => exact(r.raw_code) !== exact(r.p_code ?? ''));
    res[variant] = {
      matched: matched.length,
      matchedByIdenticalCode: exactSame.length,
      matchedOnlyAfterNormalization: looseOnly.length,
      looseOnlySample: looseOnly.slice(0, 8).map((r) => `JB ${r.raw_code} "${r.description.slice(0, 38)}" → ${r.p_code} "${(r.p_description ?? '').slice(0, 38)}" [${r.decision}${r.flags}]`),
      appliedByDefault: matched.filter((r) => r.decision === 'apply').length,
      checkMatch: matched.filter((r) => r.flags.includes(' check_match ')).length,
    };
    console.log('M4', variant, JSON.stringify(res[variant]));
    if (variant === 'products_without_supplier') res.goldStandard = scoreGold(rows);
  }
  // Pairs for manual labeling (gold standard): every pair where the codes are equal, exactly or after normalization.
  const jbByLoose = new Map<string, typeof jb.items>();
  for (const i of jb.items) jbByLoose.set(looseKey(i.code), [...(jbByLoose.get(looseKey(i.code)) ?? []), i]);
  const pairs = asItems.flatMap((a) => (jbByLoose.get(looseKey(a.alt)) ?? []).map((j) => ({ as: a.code, alt: a.alt, jb: j.code, exact: exact(a.alt) === exact(j.code), asDesc: a.description, jbDesc: j.description, asPrice: a.price, jbPrice: j.price })));
  if (process.env.PAIRS_OUT) writeFileSync(process.env.PAIRS_OUT, JSON.stringify(pairs, null, 1));
  res.pairsForLabeling = pairs.length;
  out.m4 = res;
}

/** Remarcá's outcome on each manually labeled pair (scripts/research/gold/as-jb-labels.json). */
function scoreGold(rows: { raw_code: string; p_code: string | null; decision: string; flags: string }[]) {
  const gold = JSON.parse(readFileSync(new URL('./gold/as-jb-labels.json', import.meta.url), 'utf8')) as { pairs: { as_alt_code: string; jb_code: string; codes: string; label: string }[] };
  const tally: Record<string, Record<string, number>> = {};
  for (const g of gold.pairs) {
    const r = rows.find((x) => x.raw_code === g.jb_code && x.p_code === g.as_alt_code);
    const outcome = !r ? 'not_matched' : r.decision === 'apply' ? 'applied_by_default' : r.flags.includes(' check_match ') ? 'held_check_match' : `held_${r.flags.trim().split(' ')[0] || 'no_change'}`;
    const key = `${g.codes}:${g.label}`;
    tally[key] = { ...(tally[key] ?? {}), [outcome]: (tally[key]?.[outcome] ?? 0) + 1 };
  }
  console.log('GOLD', JSON.stringify(tally));
  return tally;
}

const EXPERIMENTS: Record<string, () => Promise<void>> = { m1: m1Collisions, m2: m2CambaOldNew, m3: m3DescriptionBaseline, m4: m4SupplierChange };
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(EXPERIMENTS);
for (const w of wanted) await EXPERIMENTS[w]!();
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 2));
