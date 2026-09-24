/**
 * RESEARCH ONLY. Scale test with REAL rows (docs/20 §13): code/description/price rows taken from the public
 * JB (21,884) and AS (11,010) lists, written as XLSX files of 100 / 1,000 / 10,000 / 32,894 rows.
 * Measures the product path: upload+parse (worker thread, as in production) → map+compute → create all → re-import (update).
 *
 *   PREPARE=1 BENCH_DIR=<raw files dir> SCALE_DIR=<tmp dir> npx tsx scripts/research/real-scale.ts
 *   for n in 100 1000 10000 32892; do N=$n SCALE_DIR=<tmp dir> npx tsx scripts/research/real-scale.ts; done
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import { openDb } from '../../src/db/index.js';
import { signup } from '../../src/services/auth.js';
import { createSupplier, supplierFormSchema } from '../../src/services/suppliers.js';
import { applyImport, bulkDecision, confirmMapping, createImport, getImport } from '../../src/services/imports.js';
import { readWorkbook, type Cell } from '../../src/lib/sheet.js';
import { detectColumns, extractRows } from '../../src/lib/detect.js';

const BENCH = process.env.BENCH_DIR!;
const REPEAT = Number(process.env.REPEAT ?? 3);

async function realRows(): Promise<Cell[][]> {
  const out: Cell[][] = [];
  for (const [file, sheet] of [['jbjusto_electricidad_sep2026.xls', 'Hoja1'], ['aselec_listado.xls', 'Hoja1']] as const) {
    const wb = await readWorkbook(file, readFileSync(join(BENCH, file)));
    const rows = wb.sheets.find((s) => s.name === sheet)!.rows;
    const d = detectColumns(rows);
    for (const it of extractRows(rows, d).items) if (it.price != null) out.push([`${file.slice(0, 2).toUpperCase()}-${it.code}`, it.description, it.price]);
  }
  return out;
}

function xlsx(rows: Cell[][]): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Código', 'Descripción', 'Precio'], ...rows]), 'Lista');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

async function measure<T>(fn: () => Promise<T> | T): Promise<{ value: T; ms: number; cpuMs: number; peakRssMb: number }> {
  let peak = process.memoryUsage().rss;
  const timer = setInterval(() => (peak = Math.max(peak, process.memoryUsage().rss)), 20);
  const cpu0 = process.cpuUsage();
  const t0 = performance.now();
  const value = await fn();
  const ms = performance.now() - t0;
  const cpu = process.cpuUsage(cpu0);
  clearInterval(timer);
  peak = Math.max(peak, process.memoryUsage().rss);
  return { value, ms: Math.round(ms), cpuMs: Math.round((cpu.user + cpu.system) / 1000), peakRssMb: Math.round(peak / 1048576) };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const DIR = process.env.SCALE_DIR!;

if (process.env.PREPARE) {
  // Step 1 (separate process): write the files, so reading the 10 MB source lists does not pollute the measurements.
  const all = await realRows();
  for (const n of [100, 1000, 10000, all.length]) {
    const rows = all.slice(0, n);
    writeFileSync(join(DIR, `scale-${n}-v1.xlsx`), xlsx(rows));
    // Next version of the same list: every price +4% (SYNTHETIC BENCHMARK change on real rows).
    writeFileSync(join(DIR, `scale-${n}-v2.xlsx`), xlsx(rows.map((r) => [r[0]!, r[1]!, Math.round(Number(r[2]) * 1.04 * 100) / 100])));
  }
  console.log('prepared', all.length);
} else {
  // Step 2: one size per process (N=...), REPEAT runs, medians.
  const n = Number(process.env.N);
  const buf1 = readFileSync(join(DIR, `scale-${n}-v1.xlsx`));
  const buf2 = readFileSync(join(DIR, `scale-${n}-v2.xlsx`));
  const baselineRssMb = Math.round(process.memoryUsage().rss / 1048576);
  const runs: Record<string, number>[] = [];
  let exceptions = 0;
  for (let rep = 0; rep < REPEAT; rep++) {
    try {
      const db = openDb(':memory:');
      const { orgId, userId } = await signup(db, { name: 'Bench', business: 'SYNTHETIC BENCHMARK', email: `b${rep}@lab.test`, password: 'password123' });
      const sid = createSupplier(db, orgId, supplierFormSchema.parse({ name: 'Scale' }), 1000);
      const up = await measure(() => createImport(db, orgId, userId, sid, 'lista.xlsx', buf1));
      const map = await measure(() => confirmMapping(db, orgId, up.value.importId, 'Lista', JSON.parse(getImport(db, orgId, up.value.importId)!.mapping_json!)));
      const create = await measure(() => {
        bulkDecision(db, orgId, up.value.importId, 'new', 'create');
        return applyImport(db, orgId, up.value.importId, 1_000_000);
      });
      const up2 = await measure(() => createImport(db, orgId, userId, sid, 'lista2.xlsx', buf2));
      const map2 = await measure(() => confirmMapping(db, orgId, up2.value.importId, 'Lista', JSON.parse(getImport(db, orgId, up2.value.importId)!.mapping_json!)));
      const apply2 = await measure(() => applyImport(db, orgId, up2.value.importId, 1_000_000));
      const q = (w: string) => db.prepare(`SELECT COUNT(*) FROM import_rows WHERE import_id = ? AND ${w}`).pluck().get(up2.value.importId) as number;
      runs.push({
        uploadParseMs: up.ms, mapComputeMs: map.ms, createAllMs: create.ms, reuploadParseMs: up2.ms, recomputeMs: map2.ms, applyUpdatesMs: apply2.ms,
        totalFirstListMs: up.ms + map.ms + create.ms, totalNextListMs: up2.ms + map2.ms + apply2.ms,
        cpuMs: up.cpuMs + map.cpuMs + create.cpuMs + up2.cpuMs + map2.cpuMs + apply2.cpuMs,
        peakRssMb: Math.max(up.peakRssMb, map.peakRssMb, create.peakRssMb, up2.peakRssMb, map2.peakRssMb, apply2.peakRssMb),
        created: create.value.created, updated: apply2.value.updated,
        notUpdatedWithinCentTolerance: q("product_id IS NOT NULL AND decision = 'skip' AND flags NOT LIKE '% dup %'"),
        duplicateCodeRows: q("flags LIKE '% dup %'"),
      });
      db.close();
    } catch (err) {
      exceptions++;
      console.error(n, (err as Error).message);
    }
  }
  const keys = Object.keys(runs[0] ?? {});
  const r = { rows: n, fileKb: Math.round(buf1.length / 1024), repeats: REPEAT, exceptions, baselineRssMb, ...Object.fromEntries(keys.map((k) => [k, median(runs.map((x) => x[k]!))])), rssAfterMb: Math.round(process.memoryUsage().rss / 1048576) };
  console.log(JSON.stringify(r));
}
