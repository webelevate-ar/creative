import type { DB } from '../db/index.js';

/** Product analytics events we actually use to measure activation and retention (docs/11). */
export type EventName =
  | 'signup'
  | 'login'
  | 'settings_saved'
  | 'supplier_created'
  | 'catalog_imported'
  | 'list_uploaded'
  | 'list_mapped'
  | 'list_applied'
  | 'list_reverted'
  | 'list_discarded'
  | 'export_downloaded'
  | 'labels_printed'
  | 'plan_blocked';

export function track(db: DB, name: EventName, orgId: number | null, userId: number | null, props: Record<string, unknown> = {}): void {
  try {
    db.prepare('INSERT INTO events (org_id, user_id, name, props_json) VALUES (?, ?, ?, ?)').run(orgId, userId, name, JSON.stringify(props));
  } catch (err) {
    // Analytics must never break the product.
    console.error('[events] failed to record', name, err);
  }
}
