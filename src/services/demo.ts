/**
 * Sample data so a new account can see the whole flow in 2 minutes without its own files:
 * a supplier with 30% bonificación and a 300-product catalog. The user then uploads the sample
 * "new list" (downloadable from the dashboard) and sees real changes.
 */
import type { DB } from '../db/index.js';
import { hardwareItems } from './sample-data.js';
import { normalizeCode } from '../lib/match.js';
import { toCents } from '../lib/money.js';
import { searchText } from './products.js';

export const DEMO_SUPPLIER = 'Ejemplo: Distribuidora El Tornillo';

export function seedDemo(db: DB, orgId: number): { supplierId: number; products: number } {
  return db.transaction(() => {
    const existing = db.prepare('SELECT id FROM suppliers WHERE org_id = ? AND name = ?').get(orgId, DEMO_SUPPLIER) as { id: number } | undefined;
    if (existing) return { supplierId: existing.id, products: 0 };
    const supplierId = Number(
      db.prepare("INSERT INTO suppliers (org_id, name, discounts, list_includes_iva, iva_rate) VALUES (?, ?, '30', 0, 21)").run(orgId, DEMO_SUPPLIER).lastInsertRowid,
    );
    const ins = db.prepare(
      `INSERT OR IGNORE INTO products (org_id, code, code_norm, description, search_text, supplier_id, supplier_code, supplier_code_norm, cost_cents, price_cents, cost_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const now = new Date().toISOString();
    let n = 0;
    hardwareItems(300).forEach((it, i) => {
      const code = `EJ${String(i + 1).padStart(4, '0')}`;
      const cost = toCents(it.price * 0.7);
      // Some products were priced with a thin margin, as happens in real stores.
      const price = toCents((cost / 100) * (i % 23 === 0 ? 1.08 : 1.4) * 1.21);
      const r = ins.run(orgId, code, normalizeCode(code), it.description, searchText(code, it.description, it.code), supplierId, it.code, normalizeCode(it.code), cost, price, now);
      n += r.changes;
    });
    return { supplierId, products: n };
  })();
}
