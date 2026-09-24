import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type DB } from '../../src/db/index.js';
import { signup } from '../../src/services/auth.js';
import { createSupplier, supplierFormSchema, updateSupplier, getSupplier } from '../../src/services/suppliers.js';
import { detectCatalogColumns, importCatalog, listProducts, saveProduct, productFormSchema } from '../../src/services/products.js';
import { applyImport, bulkDecision, confirmMapping, createImport, getImport, linkRow, listRows, parseStats, recomputeImport, revertImport, discardImport, missingProducts } from '../../src/services/imports.js';
import { readWorkbook } from '../../src/lib/sheet.js';
import { detectColumns } from '../../src/lib/detect.js';
import { catalogCsv, hardwareItems, nextVersion, tornilloXlsx } from '../../scripts/make-fixtures.js';
import { saveSettings, getSettings } from '../../src/services/settings.js';

let db: DB;
let orgId: number;
let userId: number;

const supplierForm = (over: Record<string, string> = {}) => supplierFormSchema.parse({ name: 'Distribuidora El Tornillo', ...over });

beforeEach(async () => {
  db = openDb(':memory:');
  ({ orgId, userId } = await signup(db, { name: 'Ana', business: 'Ferretería Ana', email: `ana${Math.random()}@test.com`, password: 'password123' }));
});

async function loadCatalog(items = hardwareItems(300)) {
  const wb = await readWorkbook('cat.csv', catalogCsv(items));
  const rows = wb.sheets[0]!.rows;
  const m = detectCatalogColumns(rows);
  return importCatalog(db, orgId, rows, m, { products: 30000, suppliers: 40 });
}

describe('catalog import', () => {
  it('detects columns and upserts products, creating suppliers by name', async () => {
    const wb = await readWorkbook('cat.csv', catalogCsv(hardwareItems(10)));
    const m = detectCatalogColumns(wb.sheets[0]!.rows);
    expect(m).toMatchObject({ headerRow: 0, code: 0, description: 1, supplier: 2, supplier_code: 3, cost: 4, price: 5 });
    const r1 = await loadCatalog(hardwareItems(10));
    expect(r1).toMatchObject({ created: 10, updated: 0, suppliersCreated: 1 });
    const r2 = await loadCatalog(hardwareItems(10));
    expect(r2).toMatchObject({ created: 0, updated: 10, suppliersCreated: 0 });
    const list = listProducts(db, orgId, { q: 'tornillo' });
    expect(list.total).toBeGreaterThan(0);
    expect(list.rows[0]!.supplier_name).toBe('Distribuidora El Tornillo');
  });

  it('respects the plan product limit', async () => {
    const wb = await readWorkbook('cat.csv', catalogCsv(hardwareItems(20)));
    const rows = wb.sheets[0]!.rows;
    const r = importCatalog(db, orgId, rows, detectCatalogColumns(rows), { products: 5, suppliers: 40 });
    expect(r.created).toBe(5);
    expect(r.limitReached).toBe(true);
  });
});

describe('supplier list pipeline', () => {
  it('upload → map → review → apply → next list auto-maps → undo', async () => {
    await loadCatalog();
    const supplier = db.prepare('SELECT id FROM suppliers WHERE org_id = ?').get(orgId) as { id: number };
    // Catalog cost = list × 0.7 (see fixture). Configure the supplier accordingly: 30% bonificación.
    updateSupplier(db, orgId, supplier.id, supplierForm({ discounts: '30' }));

    const v1 = hardwareItems(300);
    const up1 = await createImport(db, orgId, userId, supplier.id, 'lista45.xlsx', tornilloXlsx(v1));
    expect(up1.autoMapped).toBe(false);
    const imp1 = getImport(db, orgId, up1.importId)!;
    const det = JSON.parse(imp1.mapping_json!);
    await confirmMapping(db, orgId, up1.importId, imp1.sheet_name, det);
    let stats = parseStats(getImport(db, orgId, up1.importId)!.stats_json);
    expect(stats.total).toBe(300);
    expect(stats.matched).toBe(300); // matched by supplier code from the catalog
    expect(stats.changed).toBe(0); // same prices as the catalog → nothing to do
    expect(stats.toApply).toBe(0);
    applyImport(db, orgId, up1.importId, 30000);

    // Second list from the same supplier: mapping is remembered, prices went up.
    const v2 = nextVersion(v1);
    const up2 = await createImport(db, orgId, userId, supplier.id, 'lista46.xlsx', tornilloXlsx(v2, 'Lista N° 46'));
    expect(up2.autoMapped).toBe(true);
    stats = parseStats(getImport(db, orgId, up2.importId)!.stats_json);
    expect(stats.total).toBe(v2.length);
    expect(stats.unmatched).toBe(2); // two new products
    expect(stats.missing).toBe(6); // every 50th item was dropped from the list
    expect(stats.up).toBeGreaterThan(200);
    expect(stats.medianChange!).toBeGreaterThan(0.03);
    expect(missingProducts(db, orgId, up2.importId)).toHaveLength(6);

    // Keep-margin mode: price moves by the same ratio as cost.
    const { rows } = listRows(db, orgId, up2.importId, { filter: 'up', pageSize: 10 });
    const r0 = rows[0]!;
    expect(r0.new_price_cents! / r0.old_price_cents!).toBeCloseTo(r0.new_cost_cents! / r0.old_cost_cents!, 2);

    // Choose to create the new products too.
    expect(bulkDecision(db, orgId, up2.importId, 'new', 'create')).toBe(2);
    const before = db.prepare('SELECT cost_cents, price_cents FROM products WHERE id = ?').get(r0.product_id) as { cost_cents: number; price_cents: number };
    const res = applyImport(db, orgId, up2.importId, 30000);
    expect(res.created).toBe(2);
    expect(res.updated).toBe(stats.toApply);
    const after = db.prepare('SELECT cost_cents, price_cents FROM products WHERE id = ?').get(r0.product_id) as { cost_cents: number; price_cents: number };
    expect(after.cost_cents).toBe(r0.new_cost_cents);

    // Double submit: second apply is rejected, nothing is written twice.
    expect(() => applyImport(db, orgId, up2.importId, 30000)).toThrow(/ya fue aplicada/);

    // Undo restores exactly the previous values and removes created products.
    const rev = revertImport(db, orgId, up2.importId);
    expect(rev.conflicts).toBe(0);
    expect(rev.deleted).toBe(2);
    const restored = db.prepare('SELECT cost_cents, price_cents FROM products WHERE id = ?').get(r0.product_id) as { cost_cents: number; price_cents: number };
    expect(restored).toEqual(before);
    expect(() => revertImport(db, orgId, up2.importId)).toThrow();
  });

  it('undo leaves products edited afterwards untouched (conflict)', async () => {
    await loadCatalog(hardwareItems(20));
    const supplier = db.prepare('SELECT id FROM suppliers WHERE org_id = ?').get(orgId) as { id: number };
    updateSupplier(db, orgId, supplier.id, supplierForm({ discounts: '30' }));
    const up = await createImport(db, orgId, userId, supplier.id, 'l.xlsx', tornilloXlsx(nextVersion(hardwareItems(20))));
    const imp = getImport(db, orgId, up.importId)!;
    await confirmMapping(db, orgId, up.importId, imp.sheet_name, JSON.parse(imp.mapping_json!));
    applyImport(db, orgId, up.importId, 30000);
    const changed = db.prepare("SELECT product_id FROM price_history WHERE import_id = ? AND kind = 'update' LIMIT 1").get(up.importId) as { product_id: number };
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(changed.product_id) as { code: string; description: string };
    saveProduct(db, orgId, changed.product_id, productFormSchema.parse({ code: p.code, description: p.description, cost: '1,00', price: '2,00' }), 30000);
    const rev = revertImport(db, orgId, up.importId);
    expect(rev.conflicts).toBe(1);
    const still = db.prepare('SELECT cost_cents FROM products WHERE id = ?').get(changed.product_id) as { cost_cents: number };
    expect(still.cost_cents).toBe(100);
  });

  it('flags suspicious changes (decimal errors) and below-cost prices, and skips them by default', async () => {
    await loadCatalog(hardwareItems(10));
    const supplier = db.prepare('SELECT id FROM suppliers WHERE org_id = ?').get(orgId) as { id: number };
    updateSupplier(db, orgId, supplier.id, supplierForm({ discounts: '30' }));
    const items = hardwareItems(10).map((it, i) => ({ ...it, price: i === 0 ? it.price * 1000 : i === 1 ? it.price * 2.5 : it.price }));
    const up = await createImport(db, orgId, userId, supplier.id, 'l.xlsx', tornilloXlsx(items));
    const imp = getImport(db, orgId, up.importId)!;
    await confirmMapping(db, orgId, up.importId, imp.sheet_name, JSON.parse(imp.mapping_json!));
    const rows = listRows(db, orgId, up.importId, {}).rows;
    expect(rows[0]!.flags).toContain('suspect');
    expect(rows[0]!.decision).toBe('skip');
    expect(rows[1]!.flags).toContain('up_big');
    expect(rows[1]!.flags).toContain('below_cost'); // current price no longer covers the new cost
    expect(rows[1]!.decision).toBe('apply');
  });

  it('recomputes when supplier rules change, and links unmatched rows manually (remembered next time)', async () => {
    await loadCatalog(hardwareItems(5));
    const supplier = db.prepare('SELECT id FROM suppliers WHERE org_id = ?').get(orgId) as { id: number };
    // List uses different codes than the catalog → nothing matches.
    const items = hardwareItems(5).map((it) => ({ ...it, code: it.code.replace('TOR-', 'X') }));
    const up = await createImport(db, orgId, userId, supplier.id, 'l.xlsx', tornilloXlsx(items));
    const imp = getImport(db, orgId, up.importId)!;
    await confirmMapping(db, orgId, up.importId, imp.sheet_name, JSON.parse(imp.mapping_json!));
    expect(parseStats(getImport(db, orgId, up.importId)!.stats_json).unmatched).toBe(5);
    const row = listRows(db, orgId, up.importId, {}).rows[0]!;
    const target = listProducts(db, orgId, { q: 'TOR-0001' }).rows[0]!;
    linkRow(db, orgId, up.importId, row.id, target.id);
    const linked = listRows(db, orgId, up.importId, {}).rows[0]!;
    expect(linked.match_type).toBe('manual');
    // Without the 30% discount configured the cost looks +42.9% → big change.
    expect(linked.flags).toContain('up_big');
    updateSupplier(db, orgId, supplier.id, supplierForm({ discounts: '30' }));
    recomputeImport(db, orgId, up.importId);
    const again = listRows(db, orgId, up.importId, {}).rows[0]!;
    expect(again.new_cost_cents).toBe(again.old_cost_cents);
    applyImport(db, orgId, up.importId, 30000);
    // Next list: X0001 matches via the learned link.
    const up2 = await createImport(db, orgId, userId, supplier.id, 'l2.xlsx', tornilloXlsx(items));
    expect(up2.autoMapped).toBe(true);
    const r = listRows(db, orgId, up2.importId, {}).rows.find((x) => x.raw_code === 'X0001')!;
    expect(r.match_type).toBe('link');
    expect(r.product_id).toBe(target.id);
  });

  it('USD lists, IVA-included lists and monotributo cost basis', async () => {
    saveSettings(db, orgId, { ...getSettings(db, orgId), costBasis: 'gross', priceMode: 'markup', defaultMarkupPct: 50, roundTo: 10 });
    const sid = createSupplier(db, orgId, supplierForm({ name: 'Importadora', currency: 'USD', exchange_rate: '1500', list_includes_iva: '0', iva_rate: '10.5' }), 40);
    saveProduct(db, orgId, null, productFormSchema.parse({ code: 'A1', description: 'Taladro', supplier_id: String(sid), supplier_code: 'IMP-1' }), 30000);
    const xlsx = tornilloXlsx([{ code: 'IMP-1', description: 'Taladro', price: 100, pack: 1 }]);
    const up = await createImport(db, orgId, userId, sid, 'usd.xlsx', xlsx);
    const imp = getImport(db, orgId, up.importId)!;
    await confirmMapping(db, orgId, up.importId, imp.sheet_name, JSON.parse(imp.mapping_json!));
    const row = listRows(db, orgId, up.importId, {}).rows[0]!;
    // 100 USD × 1500 = 150.000 + 10,5% IVA (monotributo) = 165.750 → ×1,5 = 248.625 → round up to 10 = 248.630
    expect(row.new_cost_cents).toBe(16_575_000);
    expect(row.new_price_cents).toBe(24_863_000);
  });

  it('discard removes the file and rows; supplier archive keeps products', async () => {
    const sid = createSupplier(db, orgId, supplierForm(), 40);
    const up = await createImport(db, orgId, userId, sid, 'l.xlsx', tornilloXlsx(hardwareItems(5)));
    discardImport(db, orgId, up.importId);
    expect(getImport(db, orgId, up.importId)!.status).toBe('discarded');
    expect(db.prepare('SELECT file_blob FROM imports WHERE id = ?').pluck().get(up.importId)).toBeNull();
    expect(() => discardImport(db, orgId, up.importId)).toThrow();
    expect(getSupplier(db, orgId, sid)).not.toBeNull();
  });

  it('enforces the supplier plan limit', () => {
    createSupplier(db, orgId, supplierForm({ name: 'A' }), 2);
    createSupplier(db, orgId, supplierForm({ name: 'B' }), 2);
    expect(() => createSupplier(db, orgId, supplierForm({ name: 'C' }), 2)).toThrow(/hasta 2/);
    expect(() => createSupplier(db, orgId, supplierForm({ name: 'a' }), 10)).toThrow(/Ya tenés/);
  });

  it('handles a 40,000-row list in reasonable time', async () => {
    const items = hardwareItems(40_000, 3);
    await loadCatalog(items.slice(0, 20_000));
    const supplier = db.prepare('SELECT id FROM suppliers WHERE org_id = ?').get(orgId) as { id: number };
    const t0 = performance.now();
    const up = await createImport(db, orgId, userId, supplier.id, 'big.xlsx', tornilloXlsx(items));
    const imp = getImport(db, orgId, up.importId)!;
    const rows = (await readWorkbook('big.xlsx', tornilloXlsx(items))).sheets[0]!.rows;
    await confirmMapping(db, orgId, up.importId, imp.sheet_name, detectColumns(rows));
    const stats = parseStats(getImport(db, orgId, up.importId)!.stats_json);
    applyImport(db, orgId, up.importId, 150_000);
    const ms = performance.now() - t0;
    expect(stats.total).toBe(40_000);
    expect(stats.matched).toBe(20_000);
    expect(ms).toBeLessThan(15_000);
    console.log(`40k-row list: upload+map+apply in ${Math.round(ms)} ms`);
  }, 30_000);
});

describe('supplier form parsing (AR number formats)', () => {
  it('accepts an empty exchange rate for peso lists and "1.540" as one thousand five hundred forty', () => {
    const ars = supplierFormSchema.parse({ name: 'X', currency: 'ARS', exchange_rate: '' });
    expect(ars.exchange_rate).toBeNull();
    const usd = supplierFormSchema.parse({ name: 'Y', currency: 'USD', exchange_rate: '1.540' });
    expect(usd.exchange_rate).toBe(1540);
    expect(supplierFormSchema.parse({ name: 'Z', surcharge_pct: '2,5', markup_pct: '35' })).toMatchObject({ surcharge_pct: 2.5, markup_pct: 35 });
    expect(supplierFormSchema.safeParse({ name: 'W', currency: 'USD', exchange_rate: '' }).success).toBe(false);
    expect(supplierFormSchema.safeParse({ name: 'W', markup_pct: 'abc' }).success).toBe(false);
  });
});
