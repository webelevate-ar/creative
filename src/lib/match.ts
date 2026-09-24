/** Code normalization used to match supplier codes with the store's catalog. */

export function normalizeCode(input: string | number): string {
  const s = String(input)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]/g, '');
  return s.replace(/^0+(?=.)/, '');
}

export function normalizeSearch(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
