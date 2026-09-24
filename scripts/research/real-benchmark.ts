/**
 * RESEARCH ONLY. Level 1 (import) benchmark of Remarcá on REAL public Argentine price lists (docs/20).
 * Files are NOT committed (third-party content); fetch them with scripts/research/fetch-real-lists.sh.
 * Ground truth comes from an independent reader (Python openpyxl/xlrd/pdfplumber + per-file specs
 * written after manual inspection): see scripts/research/ground_truth.py.
 *
 *   BENCH_DIR=<raw files dir> GT_DIR=<ground truth json dir> PARSE_IN_WORKER=0 npx tsx scripts/research/real-benchmark.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { openDb } from '../../src/db/index.js';
import { signup } from '../../src/services/auth.js';
import { createSupplier, supplierFormSchema } from '../../src/services/suppliers.js';
import { confirmMapping, createImport, getImport, listRows, parseStats } from '../../src/services/imports.js';
import { readWorkbook } from '../../src/lib/sheet.js';
import { detectColumns, extractRows, type Detection } from '../../src/lib/detect.js';

const BENCH = process.env.BENCH_DIR!;
const GT = process.env.GT_DIR!;

interface GtItem { code: string | null; price: number; price2?: number | string | null; desc: string; row?: number }
interface Case { id: string; file: string; gt: string | null; sheet?: string; note: string }

const CASES: Case[] = [
  { id: 'camba_sabana', file: 'camba_sabana/Sabana_30_08_2026.xlsx', gt: 'camba_sabana', sheet: 'Sheet1', note: 'Bulonería, 2 sheets (list + old codes), hierarchical codes 1.5.12' },
  { id: 'aselec_hoja1', file: 'aselec_listado.xls', gt: 'aselec_hoja1', sheet: 'Hoja1', note: 'Electricidad distributor, legacy .xls, IVA per row' },
  { id: 'aselec_hoja2', file: 'aselec_listado.xls', gt: 'aselec_hoja2', sheet: 'Hoja2', note: 'Same file, 2nd sheet without header, data starts at column S' },
  { id: 'jb_hoja1', file: 'jbjusto_electricidad_sep2026.xls', gt: 'jb_hoja1', sheet: 'Hoja1', note: 'Electricidad, 22k rows, currency per row ($ / U$S), wide sheet' },
  { id: 'jb_sep26', file: 'jbjusto_electricidad_sep2026.xls', gt: 'jb_sep26_sidebyside', sheet: 'Electricidad Sep 26', note: 'Printed layout: 2–3 products side by side per row' },
  { id: 'alma_vth_modelo', file: 'alma_vth_20260904.xlsx', gt: 'alma_vth_modelo', sheet: 'MODELO', note: 'Autopartes grouped by car model: same code repeated' },
  { id: 'alma_vth_correlativa', file: 'alma_vth_20260904.xlsx', gt: 'alma_vth_correlativa', sheet: 'CORRELATIVA', note: 'Same supplier, sequential sheet' },
  { id: 'alma_peugeot', file: 'alma_peugeot_20260901.xls', gt: 'alma_peugeot', sheet: 'lista peugeot 01092026', note: 'Header at row 13 col D, codes with /V10 suffixes' },
  { id: 'cambre_A', file: 'accme_cambre_A.xlsx', gt: 'cambre_A', sheet: 'LISTA DE PRECIO', note: 'Manufacturer list, unlabeled pack column before price' },
  { id: 'cambre_B', file: 'accme_cambre_B.xlsx', gt: 'cambre_B', sheet: 'LISTA DE PRECIOS', note: 'Manufacturer list, U/PACK column, notes misaligned' },
  { id: 'med_2026_09', file: 'med_2026_09.xlsx', gt: 'med_2026_09', sheet: 'Sin únicas', note: 'Reference prices, NO code column, text prices "$ 34.514,49"' },
  { id: 'alma_pdf', file: 'alma_lista1.pdf', gt: 'alma_pdf', note: 'Clean text PDF, 10 pages' },
  { id: 'strada_pdf', file: 'accme_strada.pdf', gt: 'strada_pdf', note: 'Manufacturer PDF with several tables' },
  { id: 'med_2026_09_pdf', file: 'med_2026_09.pdf', gt: 'med_2026_09_pdf', note: 'Same data as med xlsx, as PDF' },
  { id: 'jb_pdf', file: 'jbjusto_lista_sep2026.pdf', gt: null, note: 'Printed layout PDF, 2–3 products per line' },
  { id: 'camba_hoja01_pdf', file: 'camba_lista/Hoja01_20260830.pdf', gt: null, note: 'Grid PDF (diameter × length matrix)' },
  { id: 'camba_hoja25_pdf', file: 'camba_lista/Hoja25_20260830.pdf', gt: null, note: 'Semi-tabular PDF with DISCONTINUADO notes' },
  { id: 'roker_pdf', file: 'accme_roker.pdf', gt: null, note: '39-page catalog-style PDF' },
  { id: 'jeluz_pdf', file: 'accme_jeluz.pdf', gt: null, note: '37-page catalog-style PDF' },
];

function loadGt(id: string): GtItem[] {
  return (JSON.parse(readFileSync(join(GT, `${id}.json`), 'utf8')) as { items: GtItem[] }).items;
}
const samePrice = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.006, Math.abs(b) * 1e-6);

/** Code identity: trimmed, upper-cased, any whitespace (incl. non-breaking) collapsed. */
const key = (c: string) => c.trim().toUpperCase().replace(/\s+/g, ' ');

function compare(extracted: { code: string; price: number | null }[], gt: GtItem[]) {
  const byCode = new Map<string, GtItem[]>();
  for (const g of gt) if (g.code) byCode.set(key(g.code), [...(byCode.get(key(g.code)) ?? []), g]);
  let ok = 0, okOtherPriceColumn = 0, priceMismatch = 0, phantom = 0, noPrice = 0;
  const mismatches: string[] = [], phantoms: string[] = [];
  const found = new Set<string>();
  for (const e of extracted) {
    const k = key(e.code);
    const gs = byCode.get(k);
    if (!gs) { phantom++; if (phantoms.length < 5) phantoms.push(`${e.code}=${e.price}`); continue; }
    if (e.price == null) { noPrice++; continue; }
    if (gs.some((g) => samePrice(e.price!, g.price))) { ok++; found.add(k); }
    else if (gs.some((g) => g.price2 != null && samePrice(e.price!, Number(g.price2)))) { okOtherPriceColumn++; found.add(k); }
    else { priceMismatch++; if (mismatches.length < 5) mismatches.push(`${e.code}: read ${e.price} vs ${gs[0]!.price}`); }
  }
  const gtCodes = new Set(gt.map((g) => g.code).filter(Boolean).map((c) => key(c!)));
  const missed = [...gtCodes].filter((c) => !found.has(c));
  return { ok, okOtherPriceColumn, priceMismatch, phantom, noPrice, gtDistinct: gtCodes.size, missedDistinct: missed.length, missedSample: missed.slice(0, 5), mismatches, phantoms };
}

const colName = (d: Detection, i: number | null) => (i == null ? '—' : `${i}:${(d.headers[i] ?? '').slice(0, 18) || '(no header)'}`);

async function main() {
  const results: Record<string, unknown>[] = [];
  const db = openDb(':memory:');
  const { orgId, userId } = await signup(db, { name: 'Bench', business: 'SYNTHETIC BENCHMARK', email: 'bench@lab.test', password: 'password123' });
  for (const c of CASES) {
    const path = join(BENCH, c.file);
    const buf = readFileSync(path);
    const t0 = performance.now();
    const r: Record<string, unknown> = { id: c.id, file: c.file, note: c.note };
    try {
      // (a) Product path: upload → auto sheet → accept detected columns → compute.
      const sid = createSupplier(db, orgId, supplierFormSchema.parse({ name: `S-${c.id}` }), 1000);
      const up = await createImport(db, orgId, userId, sid, basename(c.file), buf);
      const imp = getImport(db, orgId, up.importId)!;
      const det = JSON.parse(imp.mapping_json!) as Detection;
      r.autoSheet = imp.sheet_name;
      r.detection = { headerRow: det.headerRow, code: colName(det, det.code), description: colName(det, det.description), price: colName(det, det.price), pack: colName(det, det.pack), decimal: det.decimal, confidence: det.confidence };
      let productItems: { code: string; price: number | null }[] = [];
      try {
        await confirmMapping(db, orgId, up.importId, imp.sheet_name, det);
        productItems = listRows(db, orgId, up.importId, { pageSize: 500 }).total
          ? (db.prepare('SELECT raw_code AS code, list_price AS price FROM import_rows WHERE import_id = ?').all(up.importId) as { code: string; price: number | null }[])
          : [];
        r.productStats = parseStats(getImport(db, orgId, up.importId)!.stats_json);
      } catch (err) {
        r.productError = (err as Error).message;
      }
      r.productExtracted = productItems.length;
      // (b) User picks the right sheet and accepts the detected columns there.
      if (c.sheet) {
        const wb = await readWorkbook(basename(c.file), buf);
        const sheet = wb.sheets.find((s) => s.name === c.sheet)!;
        const d2 = detectColumns(sheet.rows);
        const { items, skipped } = extractRows(sheet.rows, d2);
        r.sheetDetection = { sheet: c.sheet, headerRow: d2.headerRow, code: colName(d2, d2.code), description: colName(d2, d2.description), price: colName(d2, d2.price), pack: colName(d2, d2.pack), confidence: d2.confidence };
        r.sheetExtracted = items.length;
        r.sheetSkipped = skipped;
        if (c.gt) r.sheetVsGt = compare(items.map((i) => ({ code: i.code, price: i.price })), loadGt(c.gt));
      }
      if (c.gt) {
        const gt = loadGt(c.gt);
        r.gtItems = gt.length;
        r.productVsGt = compare(productItems, gt);
      } else {
        r.gtItems = 'UNKNOWN (no reliable independent ground truth)';
        r.productSample = productItems.slice(0, 8);
      }
    } catch (err) {
      r.error = (err as Error).message;
    }
    r.ms = Math.round(performance.now() - t0);
    results.push(r);
    console.log(JSON.stringify(r));
  }
  writeFileSync(process.env.OUT ?? '/dev/null', JSON.stringify(results, null, 2));
}

main();
