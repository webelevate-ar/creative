/**
 * Finds the header row and the role of each column (code, description, price, pack) in a
 * supplier price list. Deterministic: header keywords + column content statistics.
 */
import type { Cell } from './sheet.js';
import { inferDecimalSeparator, parseNumber, type DecimalSep } from './numbers.js';

export type Role = 'code' | 'description' | 'price' | 'pack';
export const ROLES: Role[] = ['code', 'description', 'price', 'pack'];

export interface ColumnMapping {
  /** Index of the header row, or -1 when the file has no header. */
  headerRow: number;
  code: number | null;
  description: number | null;
  price: number | null;
  pack: number | null;
  decimal: DecimalSep;
}

export interface Detection extends ColumnMapping {
  confidence: 'high' | 'medium' | 'low';
  /** Numeric columns that could be the price, so the user can pick another one. */
  priceCandidates: number[];
  headers: string[];
  columnCount: number;
}

/** Remembered per supplier so the next list from the same supplier maps itself. */
export interface SavedMapping {
  headerTexts: Partial<Record<Role, string>>;
  indexes: Partial<Record<Role, number>>;
  headerRow: number;
  decimal: DecimalSep;
  sheetName?: string;
}

export function normalizeText(v: Cell | undefined): string {
  if (v == null) return '';
  return String(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PATTERNS: Record<Role, RegExp[]> = {
  code: [/^cod/, /\bcod(igo)?\b/, /\bsku\b/, /^art(\.|iculo)?$/, /\bref(erencia)?\b/, /^item$/, /^(nro|n°|nº|numero)\b/, /^id$/, /\bcodigo\b/],
  description: [/desc/, /detalle/, /producto/, /nombre/, /articulo/, /concepto/],
  price: [/precio/, /\blista\b/, /\bp\.? ?lista\b/, /costo/, /importe/, /valor/, /\bpvp\b/, /\bneto\b/, /\bunit/, /\$/, /\bprice\b/],
  pack: [/\bcant(idad)?\b/, /\bunid(ades|\.)?\b/, /bulto/, /\bpack\b/, /x ?caja/, /\bu\.? ?x\b/, /embalaje/, /\bminimo\b/],
};

function headerRoles(text: string): Set<Role> {
  const out = new Set<Role>();
  if (!text || text.length > 40) return out;
  for (const role of ROLES) if (PATTERNS[role].some((re) => re.test(text))) out.add(role);
  return out;
}

interface ColumnStats {
  nonEmpty: number;
  numeric: number;
  integer: number;
  avgLen: number;
  unique: number;
  withSpace: number;
  withDigit: number;
}

function columnStats(rows: Cell[][], col: number, decimal: DecimalSep): ColumnStats {
  let nonEmpty = 0;
  let numeric = 0;
  let integer = 0;
  let lenSum = 0;
  let withSpace = 0;
  let withDigit = 0;
  const seen = new Set<string>();
  for (const r of rows) {
    const v = r[col];
    if (v == null || v === '') continue;
    nonEmpty++;
    const s = String(v);
    lenSum += s.length;
    seen.add(s);
    if (s.includes(' ')) withSpace++;
    if (/\d/.test(s)) withDigit++;
    const n = parseNumber(v, decimal);
    if (n != null) {
      numeric++;
      if (Number.isInteger(n)) integer++;
    }
  }
  return { nonEmpty, numeric, integer, avgLen: nonEmpty ? lenSum / nonEmpty : 0, unique: seen.size, withSpace, withDigit };
}

function findHeaderRow(rows: Cell[][]): number {
  let best = -1;
  let bestScore = 0;
  const limit = Math.min(rows.length, 40);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? [];
    const roles = new Set<Role>();
    let textCells = 0;
    for (const c of row) {
      if (typeof c !== 'string') continue;
      textCells++;
      for (const r of headerRoles(normalizeText(c))) roles.add(r);
    }
    // A header needs at least two different roles and something that looks like data below it.
    if (roles.size < 2 || textCells < 2) continue;
    const hasDataBelow = rows.slice(i + 1, i + 6).some((r) => r.filter((c) => c != null).length >= 2);
    if (!hasDataBelow) continue;
    const score = roles.size * 2 + (roles.has('price') ? 1 : 0) + (roles.has('code') ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

function dataSample(rows: Cell[][], headerRow: number, size = 300): Cell[][] {
  return rows.slice(headerRow + 1).filter((r) => r.filter((c) => c != null).length >= 2).slice(0, size);
}

export function columnDecimal(rows: Cell[][], col: number): DecimalSep {
  const samples: unknown[] = [];
  for (const r of rows) {
    const v = r[col];
    if (typeof v === 'string') samples.push(v);
    if (samples.length > 400) break;
  }
  return inferDecimalSeparator(samples);
}

export function detectColumns(rows: Cell[][]): Detection {
  const headerRow = findHeaderRow(rows);
  const sample = dataSample(rows, headerRow);
  const columnCount = Math.max(0, ...rows.slice(Math.max(0, headerRow), headerRow + 50).map((r) => r.length));
  const header = headerRow >= 0 ? rows[headerRow] ?? [] : [];
  const headers = Array.from({ length: columnCount }, (_, i) => (header[i] == null ? '' : String(header[i])));
  const normHeaders = headers.map((h) => normalizeText(h));

  const decimals: DecimalSep[] = [];
  const stats: ColumnStats[] = [];
  for (let c = 0; c < columnCount; c++) {
    decimals[c] = columnDecimal(sample, c);
    stats[c] = columnStats(sample, c, decimals[c]!);
  }
  const rolesByHeader = normHeaders.map((h) => headerRoles(h));
  const taken = new Set<number>();
  const isNumericCol = (c: number) => stats[c]!.nonEmpty > 0 && stats[c]!.numeric / stats[c]!.nonEmpty >= 0.8;
  // A column titled "Precio" may have "Consultar" / "Sin stock" in some rows: accept it at 50% numeric.
  const isPriceByHeader = (c: number) => rolesByHeader[c]!.has('price') && stats[c]!.nonEmpty > 0 && stats[c]!.numeric / stats[c]!.nonEmpty >= 0.5;

  // Price: numeric column whose header says price. Prefer "lista"/"precio" over "c/iva"/"final" when several.
  const priceCandidates: number[] = [];
  for (let c = 0; c < columnCount; c++) {
    if (!isNumericCol(c) && !isPriceByHeader(c)) continue;
    const st = stats[c]!;
    const looksLikeCode = st.integer === st.numeric && st.unique === st.nonEmpty && rolesByHeader[c]!.has('code');
    if (!looksLikeCode && (rolesByHeader[c]!.has('price') || (headerRow < 0 && st.integer < st.numeric))) priceCandidates.push(c);
  }
  if (!priceCandidates.length) {
    // Fallback: numeric columns with non-integer values that are not header-marked as code/pack.
    for (let c = 0; c < columnCount; c++) {
      const st = stats[c]!;
      if (isNumericCol(c) && st.integer < st.numeric && !rolesByHeader[c]!.has('code') && !rolesByHeader[c]!.has('pack')) priceCandidates.push(c);
    }
  }
  const pricePref = (c: number) => {
    const h = normHeaders[c]!;
    let score = 0;
    if (/lista/.test(h)) score += 3;
    if (/precio|costo/.test(h)) score += 2;
    if (/c\/ ?iva|con iva|final|pvp|publico|sugerido/.test(h)) score -= 2;
    if (/bulto|caja|pack/.test(h)) score -= 1;
    return score;
  };
  const price = priceCandidates.length ? [...priceCandidates].sort((a, b) => pricePref(b) - pricePref(a) || a - b)[0]! : null;
  if (price != null) taken.add(price);

  // Code: short, mostly unique values. Header match first, then content.
  const codeScore = (c: number) => {
    const st = stats[c]!;
    if (!st.nonEmpty) return -1;
    const uniqueness = st.unique / st.nonEmpty;
    if (st.avgLen > 30 || uniqueness < 0.85) return -1;
    let s = uniqueness * 2 + (st.withDigit / st.nonEmpty) - st.withSpace / st.nonEmpty;
    // Long texts with spaces are descriptions even under a code-like header ("Artículo" printed above the
    // description column in a real PDF list, docs/20 §5).
    const descriptionLike = st.withSpace / st.nonEmpty > 0.5 && st.avgLen > 20;
    if (rolesByHeader[c]!.has('code') && !descriptionLike) s += 3;
    if (rolesByHeader[c]!.has('description') && !rolesByHeader[c]!.has('code')) s -= 2;
    return s;
  };
  let code: number | null = null;
  let bestCode = 0.5;
  for (let c = 0; c < columnCount; c++) {
    if (taken.has(c)) continue;
    const s = codeScore(c);
    if (s > bestCode) {
      bestCode = s;
      code = c;
    }
  }
  if (code != null) taken.add(code);

  // Description: the longest mostly-text column; header match gives a bonus.
  let description: number | null = null;
  let bestDesc = 0;
  for (let c = 0; c < columnCount; c++) {
    if (taken.has(c)) continue;
    const st = stats[c]!;
    if (!st.nonEmpty || st.numeric / st.nonEmpty > 0.5) continue;
    const s = st.avgLen + (st.withSpace / st.nonEmpty) * 5 + (rolesByHeader[c]!.has('description') ? 20 : 0);
    if (s > bestDesc) {
      bestDesc = s;
      description = c;
    }
  }
  if (description != null) taken.add(description);

  // Pack: integer column with a pack-like header.
  let pack: number | null = null;
  for (let c = 0; c < columnCount; c++) {
    if (taken.has(c)) continue;
    const st = stats[c]!;
    if (rolesByHeader[c]!.has('pack') && isNumericCol(c) && st.integer === st.numeric) {
      pack = c;
      break;
    }
  }

  const byHeader = code != null && price != null && rolesByHeader[code]!.has('code') && rolesByHeader[price]!.has('price');
  const confidence: Detection['confidence'] = code == null || price == null ? 'low' : byHeader && headerRow >= 0 ? 'high' : 'medium';
  return {
    headerRow,
    code,
    description,
    price,
    pack,
    decimal: price != null ? decimals[price]! : ',',
    confidence,
    priceCandidates,
    headers,
    columnCount,
  };
}

export function toSavedMapping(m: ColumnMapping, rows: Cell[][], sheetName?: string): SavedMapping {
  const header = m.headerRow >= 0 ? rows[m.headerRow] ?? [] : [];
  const headerTexts: SavedMapping['headerTexts'] = {};
  const indexes: SavedMapping['indexes'] = {};
  for (const role of ROLES) {
    const idx = m[role];
    if (idx == null) continue;
    indexes[role] = idx;
    const text = normalizeText(header[idx]);
    if (text) headerTexts[role] = text;
  }
  return { headerTexts, indexes, headerRow: m.headerRow, decimal: m.decimal, sheetName };
}

/**
 * Re-applies a supplier's saved mapping to a new file. Columns are located by header text
 * (suppliers insert/move columns), falling back to positions for header-less files.
 */
export function applySavedMapping(rows: Cell[][], saved: SavedMapping): ColumnMapping | null {
  const needed: Role[] = ['code', 'price'];
  if (saved.headerTexts.code && saved.headerTexts.price) {
    const limit = Math.min(rows.length, 40);
    for (let i = 0; i < limit; i++) {
      const norm = (rows[i] ?? []).map((c) => normalizeText(c));
      const found: Partial<Record<Role, number>> = {};
      for (const role of ROLES) {
        const text = saved.headerTexts[role];
        if (!text) continue;
        const idx = norm.indexOf(text);
        if (idx >= 0) found[role] = idx;
      }
      if (needed.every((r) => found[r] != null)) {
        const price = found.price!;
        return {
          headerRow: i,
          code: found.code ?? null,
          description: found.description ?? null,
          price,
          pack: found.pack ?? null,
          decimal: columnDecimal(dataSample(rows, i), price),
        };
      }
    }
    return null;
  }
  if (saved.headerRow < 0 && saved.indexes.code != null && saved.indexes.price != null) {
    const sample = dataSample(rows, -1);
    const price = saved.indexes.price;
    const numeric = sample.filter((r) => parseNumber(r[price], saved.decimal) != null).length;
    if (sample.length && numeric / sample.length >= 0.6) {
      return {
        headerRow: -1,
        code: saved.indexes.code,
        description: saved.indexes.description ?? null,
        price,
        pack: saved.indexes.pack ?? null,
        decimal: columnDecimal(sample, price),
      };
    }
  }
  return null;
}

export interface ExtractedRow {
  rowIndex: number;
  code: string;
  description: string;
  rawPrice: string;
  price: number | null;
  pack: number | null;
}

/** Turns grid rows into list items using a mapping. Rows without a code are skipped (section titles, notes). */
export function extractRows(rows: Cell[][], m: ColumnMapping): { items: ExtractedRow[]; skipped: number } {
  const items: ExtractedRow[] = [];
  let skipped = 0;
  if (m.code == null || m.price == null) return { items, skipped: rows.length };
  for (let i = m.headerRow + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const codeCell = r[m.code];
    const priceCell = r[m.price];
    if (codeCell == null || codeCell === '') {
      if (r.some((c) => c != null)) skipped++;
      continue;
    }
    const code = typeof codeCell === 'number' ? String(codeCell) : String(codeCell).trim();
    if (!code || code.length > 80) {
      skipped++;
      continue;
    }
    const price = parseNumber(priceCell, m.decimal);
    // Repeated header rows inside long lists: code cell equals the header text.
    if (price == null && typeof priceCell === 'string' && headerRoles(normalizeText(priceCell)).has('price')) {
      skipped++;
      continue;
    }
    // Notes and footers ("Los precios pueden variar...") have text in the code column but no price or description.
    const hasDescription = m.description != null && r[m.description] != null && r[m.description] !== '';
    if (price == null && !hasDescription) {
      skipped++;
      continue;
    }
    const packRaw = m.pack != null ? parseNumber(r[m.pack], m.decimal) : null;
    items.push({
      rowIndex: i,
      code,
      description: m.description != null && r[m.description] != null ? String(r[m.description]).slice(0, 300) : '',
      rawPrice: priceCell == null ? '' : String(priceCell).slice(0, 50),
      price,
      pack: packRaw != null && packRaw >= 1 && Number.isInteger(packRaw) ? packRaw : null,
    });
  }
  return { items, skipped };
}
