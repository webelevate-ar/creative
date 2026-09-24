/**
 * Performance benchmark: large supplier lists end to end (parse → detect → compute → apply) and
 * the review page query. Run: npx tsx scripts/bench.ts
 */
import { openDb } from '../src/db/index.js';
import { signup } from '../src/services/auth.js';
import { hardwareItems, nextVersion, tornilloXlsx } from '../src/services/sample-data.js';
import { mayoristaPdf, catalogCsv } from './make-fixtures.js';
import { readWorkbook } from '../src/lib/sheet.js';
import { detectColumns } from '../src/lib/detect.js';
import { detectCatalogColumns, importCatalog, listProducts } from '../src/services/products.js';
import { applyImport, confirmMapping, createImport, getImport, listRows, refreshStats } from '../src/services/imports.js';

const t = () => performance.now();
const ms = (a: number) => `${Math.round(t() - a)} ms`;
const mb = () => `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB RSS`;

async function main() {
  const db = openDb(':memory:');
  const { orgId, userId } = await signup(db, { name: 'Bench', business: 'Bench', email: 'b@b.com', password: 'password123' });

  for (const n of [5_000, 30_000, 55_000]) {
    const items = hardwareItems(n, 5);
    const xlsx = tornilloXlsx(items);
    let a = t();
    const wb = await readWorkbook('x.xlsx', xlsx);
    const parse = ms(a);
    a = t();
    const d = detectColumns(wb.sheets[0]!.rows);
    const detect = ms(a);
    console.log(`xlsx ${n} rows (${(xlsx.byteLength / 1024 / 1024).toFixed(1)} MB): parse ${parse}, detect ${detect}, ${mb()}`);
    void d;
  }

  const pdfItems = hardwareItems(13_500, 6); // ~300 pages
  const pdf = mayoristaPdf(pdfItems);
  let a = t();
  const pwb = await readWorkbook('x.pdf', pdf);
  console.log(`pdf ${Math.ceil(pdfItems.length / 45)} pages (${(pdf.byteLength / 1024 / 1024).toFixed(1)} MB): parse ${ms(a)}, rows ${pwb.sheets[0]!.rows.length}, ${mb()}`);

  // Catalog of 30k products, then a 30k list against it.
  const base = hardwareItems(30_000, 8);
  a = t();
  const cat = (await readWorkbook('c.csv', catalogCsv(base))).sheets[0]!.rows;
  const r = importCatalog(db, orgId, cat, detectCatalogColumns(cat), { products: 150_000, suppliers: 150 });
  console.log(`catalog import 30k: ${ms(a)} (${r.created} created)`);
  const supplierId = db.prepare('SELECT id FROM suppliers WHERE org_id = ?').pluck().get(orgId) as number;
  db.prepare("UPDATE suppliers SET discounts = '30' WHERE id = ?").run(supplierId);

  const list = tornilloXlsx(nextVersion(base));
  a = t();
  const up = await createImport(db, orgId, userId, supplierId, 'l.xlsx', list);
  const imp = getImport(db, orgId, up.importId)!;
  const upload = ms(a);
  a = t();
  await confirmMapping(db, orgId, up.importId, imp.sheet_name, JSON.parse(imp.mapping_json!));
  const compute = ms(a);
  a = t();
  listRows(db, orgId, up.importId, { filter: 'apply', page: 1, pageSize: 50 });
  listRows(db, orgId, up.importId, { filter: 'below_cost', page: 1, pageSize: 50 });
  const review = ms(a);
  a = t();
  refreshStats(db, orgId, up.importId);
  const stats = ms(a);
  a = t();
  const res = applyImport(db, orgId, up.importId, 150_000);
  const apply = ms(a);
  a = t();
  listProducts(db, orgId, { q: 'tornillo 10mm', page: 3 });
  const search = ms(a);
  console.log(`list 30k vs catalog 30k: upload+parse ${upload}, match+price ${compute}, review page queries ${review}, stats ${stats}, apply ${apply} (${res.updated} updated), product search ${search}, ${mb()}`);
}

main();
