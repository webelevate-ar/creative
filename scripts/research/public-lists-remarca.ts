/**
 * RESEARCH ONLY (docs/22). Runs Remarcá's automatic sheet/column detection on every downloaded public list and
 * prints what it would extract (no ground truth: samples are checked by hand in docs/22 §3).
 *
 *   RAW_DIR=<dir> PARSE_IN_WORKER=0 npx tsx scripts/research/public-lists-remarca.ts > out.json
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readWorkbook } from '../../src/lib/sheet.js';
import { detectColumns, extractRows } from '../../src/lib/detect.js';

const RAW = process.env.RAW_DIR!;
const out: Record<string, unknown>[] = [];
for (const f of readdirSync(RAW).sort()) {
  if (f.endsWith('.headers') || f.endsWith('.bin') || f.endsWith('.html') || statSync(join(RAW, f)).size < 5000) continue;
  const r: Record<string, unknown> = { file: f };
  try {
    const wb = await readWorkbook(f, readFileSync(join(RAW, f)));
    // Same choice as the product: the sheet with a usable detection and the most rows.
    let best: { name: string; items: number; d: ReturnType<typeof detectColumns>; sample: unknown[] } | null = null;
    for (const s of wb.sheets) {
      const d = detectColumns(s.rows);
      const { items } = extractRows(s.rows, d);
      const priced = items.filter((i) => i.price != null);
      if (!best || priced.length > best.items) best = { name: s.name, items: priced.length, d, sample: priced.slice(0, 3).map((i) => [i.code, i.description.slice(0, 40), i.rawPrice]) };
    }
    if (best) {
      r.sheet = best.name;
      r.code = best.d.code == null ? null : `${best.d.code}:${best.d.headers[best.d.code] ?? ''}`;
      r.price = best.d.price == null ? null : `${best.d.price}:${best.d.headers[best.d.price] ?? ''}`;
      r.pricedRows = best.items;
      r.sample = best.sample;
    }
  } catch (err) {
    r.error = (err as Error).message.slice(0, 120);
  }
  out.push(r);
  console.error(JSON.stringify(r));
}
console.log(JSON.stringify(out, null, 1));
