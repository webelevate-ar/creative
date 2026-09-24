import * as XLSX from 'xlsx';

export type Cell = string | number | null;
export interface SheetGrid {
  name: string;
  rows: Cell[][];
}
export interface Workbook {
  kind: 'xlsx' | 'xls' | 'ods' | 'csv' | 'pdf';
  sheets: SheetGrid[];
  /** Rows beyond the limit were dropped. */
  truncated: boolean;
}

export const MAX_ROWS = 60_000;
export const MAX_COLS = 60;
export const MAX_FILE_BYTES = 12 * 1024 * 1024;

export class FileFormatError extends Error {}

type Kind = Workbook['kind'];

export function detectKind(fileName: string, buf: Uint8Array): Kind | null {
  const head = buf.subarray(0, 8);
  const isZip = head[0] === 0x50 && head[1] === 0x4b; // PK
  const isOle = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0; // legacy .xls
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  if (isPdf) return 'pdf';
  if (isOle) return 'xls';
  if (isZip) return ext === 'ods' ? 'ods' : 'xlsx';
  if (ext === 'csv' || ext === 'txt' || ext === 'tsv') return 'csv';
  // Some systems export HTML/XML tables with a .xls extension; SheetJS reads those too.
  if (ext === 'xls') return 'xls';
  return null;
}

function trimCell(v: unknown): Cell {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 'SI' : 'NO';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s === '' ? null : s.slice(0, 500);
}

function normalizeRows(raw: unknown[][]): { rows: Cell[][]; truncated: boolean } {
  const rows: Cell[][] = [];
  let truncated = false;
  for (const r of raw) {
    if (rows.length >= MAX_ROWS) {
      truncated = true;
      break;
    }
    const cells = (Array.isArray(r) ? r : []).slice(0, MAX_COLS).map(trimCell);
    while (cells.length && cells[cells.length - 1] == null) cells.pop();
    rows.push(cells);
  }
  // Drop trailing empty rows.
  while (rows.length && rows[rows.length - 1]!.length === 0) rows.pop();
  return { rows, truncated };
}

/** Decodes CSV bytes: UTF-8 when valid, otherwise Windows-1252 (Excel "CSV" on Spanish Windows). */
export function decodeText(buf: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder('windows-1252').decode(buf);
  }
  return text.replace(/^﻿/, '');
}

export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  const candidates = [';', ',', '\t', '|'];
  let best = ';';
  let bestScore = -1;
  for (const d of candidates) {
    const counts = lines.map((l) => splitCsvLine(l, d).length);
    if (!counts.length) continue;
    const max = Math.max(...counts);
    if (max < 2) continue;
    const consistent = counts.filter((c) => c === max).length;
    const score = consistent * 10 + max;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  return parseCsv(line, delimiter)[0] ?? [];
}

/** RFC 4180-ish parser: quoted fields, escaped quotes, newlines inside quotes. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === '') inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      if (rows.length > MAX_ROWS) break;
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function readCsv(buf: Uint8Array): Workbook {
  const text = decodeText(buf);
  const delimiter = detectDelimiter(text);
  const { rows, truncated } = normalizeRows(parseCsv(text, delimiter));
  return { kind: 'csv', sheets: [{ name: 'CSV', rows }], truncated };
}

function readSpreadsheet(buf: Uint8Array, kind: Kind): Workbook {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'buffer', cellDates: false, cellFormula: false, cellHTML: false, sheetRows: MAX_ROWS + 1 });
  } catch {
    throw new FileFormatError('No pudimos leer el archivo. ¿Está dañado o protegido con contraseña?');
  }
  let truncated = false;
  const sheets: SheetGrid[] = [];
  for (const name of wb.SheetNames.slice(0, 30)) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
    const n = normalizeRows(raw);
    truncated ||= n.truncated || raw.length > MAX_ROWS;
    sheets.push({ name: String(name).slice(0, 100), rows: n.rows });
  }
  return { kind, sheets, truncated };
}

export async function readWorkbook(fileName: string, buf: Uint8Array): Promise<Workbook> {
  if (buf.byteLength === 0) throw new FileFormatError('El archivo está vacío.');
  if (buf.byteLength > MAX_FILE_BYTES) throw new FileFormatError('El archivo supera los 12 MB.');
  const kind = detectKind(fileName, buf);
  if (!kind) throw new FileFormatError('Formato no soportado. Subí un Excel (.xlsx, .xls), .ods, .csv o un PDF con texto.');
  if (kind === 'csv') return readCsv(buf);
  if (kind === 'pdf') {
    const { readPdf } = await import('./pdf.js');
    return readPdf(buf);
  }
  return readSpreadsheet(buf, kind);
}
