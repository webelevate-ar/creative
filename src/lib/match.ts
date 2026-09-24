/** Code keys used to match supplier codes with the store's catalog. */

function upperNoAccents(input: string | number): string {
  return String(input)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Exact key (stored in *_code_norm columns): case, accents and repeated spaces are ignored, punctuation is kept.
 * Real supplier lists contain DIFFERENT products whose codes differ only in punctuation or spaces
 * ("1.5.12" vs "15.12", "UN2.5CCE" vs "UN25CCE", "INT050234" vs "INT 050234"; docs/20 §8), so only this key
 * may auto-match. All-digit codes drop leading zeros ("00123" typed as text vs 123 read as a number).
 */
export function normalizeCode(input: string | number): string {
  const s = upperNoAccents(input).trim().replace(/\s+/g, ' ');
  return /^\d+$/.test(s) ? s.replace(/^0+(?=.)/, '') : s;
}

/** Loose key: also ignores punctuation, spaces and leading zeros. Only used to SUGGEST a match, held for review. */
export function looseCode(input: string | number): string {
  return upperNoAccents(input)
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^0+(?=.)/, '');
}

export function normalizeSearch(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
