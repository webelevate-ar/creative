import { z } from 'zod';
import type { DB } from '../db/index.js';

export const EXPORT_COLUMNS = {
  code: 'Código',
  description: 'Descripción',
  supplier: 'Proveedor',
  supplier_code: 'Cód. proveedor',
  old_cost: 'Costo anterior',
  cost: 'Costo',
  old_price: 'Precio anterior',
  price: 'Precio',
  change_pct: 'Variación %',
} as const;
export type ExportColumn = keyof typeof EXPORT_COLUMNS;
const exportColumnKeys = Object.keys(EXPORT_COLUMNS) as [ExportColumn, ...ExportColumn[]];

export const orgSettingsSchema = z.object({
  costBasis: z.enum(['net', 'gross']).default('net'),
  salePriceWithIva: z.boolean().default(true),
  priceMode: z.enum(['keep_margin', 'markup']).default('keep_margin'),
  defaultMarkupPct: z.number().min(0).max(1000).default(40),
  roundTo: z.number().min(0).max(100_000).default(0),
  bigChangePct: z.number().min(1).max(500).default(20),
  staleDays: z.number().int().min(1).max(365).default(30),
  exportFormat: z.enum(['csv', 'xlsx']).default('csv'),
  exportDelimiter: z.enum([';', ',', 'tab']).default(';'),
  exportDecimal: z.enum([',', '.']).default(','),
  exportEncoding: z.enum(['utf8bom', 'latin1']).default('utf8bom'),
  exportColumns: z.array(z.enum(exportColumnKeys)).min(1).max(12).default(['code', 'description', 'cost', 'price']),
});
export type OrgSettings = z.infer<typeof orgSettingsSchema>;

export function parseSettings(json: string | null | undefined): OrgSettings {
  let raw: unknown = {};
  try {
    raw = json ? JSON.parse(json) : {};
  } catch {
    raw = {};
  }
  const parsed = orgSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : orgSettingsSchema.parse({});
}

export function getSettings(db: DB, orgId: number): OrgSettings {
  const row = db.prepare('SELECT settings_json FROM orgs WHERE id = ?').get(orgId) as { settings_json: string } | undefined;
  return parseSettings(row?.settings_json);
}

export function saveSettings(db: DB, orgId: number, settings: OrgSettings): void {
  db.prepare('UPDATE orgs SET settings_json = ? WHERE id = ?').run(JSON.stringify(orgSettingsSchema.parse(settings)), orgId);
}
