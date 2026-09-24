/**
 * Locale-aware number parsing for supplier price lists.
 *
 * Argentine lists mix "1.234,56" (AR) and "1,234.56" (US) depending on who exported them,
 * and a bare "1.234" can mean one thousand two hundred thirty-four or 1.234.
 * We infer the decimal separator per column (from all its samples) and use that only to
 * break ties on genuinely ambiguous cells.
 */

export type DecimalSep = ',' | '.';

const CURRENCY_RE = /US\$|U\$S|U\$D|USD|ARS|AR\$|\$|€/gi;

/** Strips currency symbols and spaces. Returns null when the text is not a plain number. */
export function cleanNumericText(input: string): string | null {
  const t = input.replace(CURRENCY_RE, '').replace(/[\s ]/g, '');
  if (!t || !/\d/.test(t)) return null;
  if (!/^-?[\d.,]+$/.test(t)) return null;
  return t;
}

function count(haystack: string, ch: string): number {
  let n = 0;
  for (const c of haystack) if (c === ch) n++;
  return n;
}

/** Infers the decimal separator of a column from textual samples. Defaults to ',' (AR). */
export function inferDecimalSeparator(samples: Iterable<unknown>): DecimalSep {
  let comma = 0;
  let dot = 0;
  for (const raw of samples) {
    if (typeof raw !== 'string') continue;
    const t = cleanNumericText(raw);
    if (!t) continue;
    const lastComma = t.lastIndexOf(',');
    const lastDot = t.lastIndexOf('.');
    if (lastComma >= 0 && lastDot >= 0) {
      if (lastComma > lastDot) comma++;
      else dot++;
      continue;
    }
    const sep = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : null;
    if (!sep) continue;
    const digitsAfter = t.length - t.lastIndexOf(sep) - 1;
    if (count(t, sep) > 1) {
      // Repeated separator can only be a thousands separator.
      if (sep === ',') dot++;
      else comma++;
    } else if (digitsAfter !== 3) {
      if (sep === ',') comma++;
      else dot++;
    }
  }
  if (comma === dot) return ',';
  return comma > dot ? ',' : '.';
}

/**
 * Parses a cell into a number. Numeric cells pass through. `hint` is the column's decimal
 * separator and is only used for ambiguous values like "1.234".
 */
export function parseNumber(raw: unknown, hint: DecimalSep = ','): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  let t = cleanNumericText(raw);
  if (!t) return null;
  const negative = t.startsWith('-');
  if (negative) t = t.slice(1);
  if (t.includes('-')) return null;

  const hasComma = t.includes(',');
  const hasDot = t.includes('.');
  let decimal: DecimalSep | null = null;
  if (hasComma && hasDot) {
    decimal = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.';
  } else if (hasComma || hasDot) {
    const sep: DecimalSep = hasComma ? ',' : '.';
    const digitsAfter = t.length - t.lastIndexOf(sep) - 1;
    if (count(t, sep) > 1) decimal = sep === ',' ? '.' : ',';
    else if (digitsAfter === 3) decimal = hint;
    else decimal = sep;
  }

  let normalized = t;
  if (decimal) {
    const thousands = decimal === ',' ? '.' : ',';
    normalized = t.split(thousands).join('');
    if (count(normalized, decimal) > 1) return null;
    normalized = normalized.replace(decimal, '.');
  }
  if (!/^\d+(\.\d+)?$/.test(normalized) && !/^\.\d+$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}
