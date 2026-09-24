import * as XLSX from 'xlsx';
import type { DB } from '../db/index.js';
import { centsToPlain } from '../lib/money.js';
import { EXPORT_COLUMNS, type ExportColumn, type OrgSettings } from './settings.js';

export interface ExportRow {
  code: string;
  description: string;
  supplier: string | null;
  supplier_code: string | null;
  old_cost: number | null;
  cost: number | null;
  old_price: number | null;
  price: number | null;
}

export interface ExportFile {
  body: Uint8Array;
  contentType: string;
  ext: 'csv' | 'xlsx';
}

const TEXT_COLUMNS = new Set<ExportColumn>(['code', 'description', 'supplier', 'supplier_code']);

/** Neutralizes spreadsheet formula injection in text cells (=, +, -, @, tab, CR). */
export function safeText(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

function changePct(r: ExportRow): number | null {
  if (r.old_cost == null || r.cost == null || r.old_cost === 0) return null;
  return Math.round(((r.cost - r.old_cost) / r.old_cost) * 10000) / 100;
}

function cellValue(r: ExportRow, col: ExportColumn): string | number | null {
  switch (col) {
    case 'code':
      return r.code;
    case 'description':
      return r.description;
    case 'supplier':
      return r.supplier;
    case 'supplier_code':
      return r.supplier_code;
    case 'old_cost':
      return r.old_cost;
    case 'cost':
      return r.cost;
    case 'old_price':
      return r.old_price;
    case 'price':
      return r.price;
    case 'change_pct':
      return changePct(r);
  }
}

function csvField(v: string, delimiter: string): string {
  return v.includes(delimiter) || /["\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function encodeLatin1(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out[i] = c < 256 ? c : 63; // '?'
  }
  return out;
}

export function buildExport(rows: ExportRow[], settings: OrgSettings, columns: ExportColumn[] = settings.exportColumns): ExportFile {
  if (settings.exportFormat === 'xlsx') {
    const aoa: (string | number | null)[][] = [columns.map((c) => EXPORT_COLUMNS[c])];
    for (const r of rows) {
      aoa.push(
        columns.map((c) => {
          const v = cellValue(r, c);
          if (v == null) return null;
          if (c === 'change_pct') return v;
          if (TEXT_COLUMNS.has(c)) return String(v);
          return (v as number) / 100;
        }),
      );
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Precios');
    return { body: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' };
  }
  const delimiter = settings.exportDelimiter === 'tab' ? '\t' : settings.exportDelimiter;
  const lines = [columns.map((c) => csvField(EXPORT_COLUMNS[c], delimiter)).join(delimiter)];
  for (const r of rows) {
    lines.push(
      columns
        .map((c) => {
          const v = cellValue(r, c);
          if (v == null) return '';
          if (TEXT_COLUMNS.has(c)) return csvField(safeText(String(v)), delimiter);
          if (c === 'change_pct') return String(v).replace('.', settings.exportDecimal);
          return centsToPlain(v as number, settings.exportDecimal);
        })
        .join(delimiter),
    );
  }
  const text = lines.join('\r\n') + '\r\n';
  const body = settings.exportEncoding === 'latin1' ? encodeLatin1(text) : new TextEncoder().encode('﻿' + text);
  return { body, contentType: `text/csv; charset=${settings.exportEncoding === 'latin1' ? 'windows-1252' : 'utf-8'}`, ext: 'csv' };
}

/** Products changed or created by an applied list, with the values it wrote. */
export function appliedRows(db: DB, orgId: number, importId: number): ExportRow[] {
  return db
    .prepare(
      `SELECT p.code, p.description, s.name AS supplier, p.supplier_code, h.old_cost_cents AS old_cost, h.new_cost_cents AS cost,
              h.old_price_cents AS old_price, h.new_price_cents AS price
       FROM price_history h JOIN products p ON p.id = h.product_id AND p.org_id = h.org_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id AND s.org_id = p.org_id
       WHERE h.org_id = ? AND h.import_id = ? AND h.kind IN ('update','create') ORDER BY p.code`,
    )
    .all(orgId, importId) as ExportRow[];
}

/** Every row of the supplier list with the computed cost and price (useful to publish your own list). */
export function computedRows(db: DB, orgId: number, importId: number): ExportRow[] {
  return db
    .prepare(
      `SELECT COALESCE(p.code, r.raw_code) AS code, COALESCE(NULLIF(p.description, ''), r.description) AS description, s.name AS supplier,
              r.raw_code AS supplier_code, r.old_cost_cents AS old_cost, r.new_cost_cents AS cost, r.old_price_cents AS old_price, r.new_price_cents AS price
       FROM import_rows r JOIN imports i ON i.id = r.import_id AND i.org_id = r.org_id
       JOIN suppliers s ON s.id = i.supplier_id AND s.org_id = i.org_id
       LEFT JOIN products p ON p.id = r.product_id AND p.org_id = r.org_id
       WHERE r.org_id = ? AND r.import_id = ? AND r.new_cost_cents IS NOT NULL ORDER BY r.row_index`,
    )
    .all(orgId, importId) as ExportRow[];
}

export function catalogRows(db: DB, orgId: number): ExportRow[] {
  return db
    .prepare(
      `SELECT p.code, p.description, s.name AS supplier, p.supplier_code, NULL AS old_cost, p.cost_cents AS cost, NULL AS old_price, p.price_cents AS price
       FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id AND s.org_id = p.org_id WHERE p.org_id = ? ORDER BY p.code`,
    )
    .all(orgId) as ExportRow[];
}

export function exportFileName(base: string, ext: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const clean = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return `${clean || 'precios'}-${date}.${ext}`;
}
