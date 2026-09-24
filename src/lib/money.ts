/** Money is stored as integer cents (centavos) to avoid float drift in the database. */

const ARS = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PCT = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const INT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

export function toCents(pesos: number): number {
  return Math.round(pesos * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** "$ 1.234,56" */
export function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return '—';
  return `$ ${ARS.format(cents / 100)}`;
}

/** "+12,5 %" */
export function formatPct(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  const pct = ratio * 100;
  const sign = pct > 0.05 ? '+' : '';
  return `${sign}${PCT.format(pct)} %`;
}

export function formatInt(n: number): string {
  return INT.format(n);
}

/** Percentage change between two cent amounts, or null when there is no previous value. */
export function changeRatio(oldCents: number | null | undefined, newCents: number | null | undefined): number | null {
  if (oldCents == null || newCents == null || oldCents === 0) return null;
  return (newCents - oldCents) / oldCents;
}

/** Formats a cent amount as a plain decimal string for exports, e.g. "1234,56" or "1234.56". */
export function centsToPlain(cents: number | null | undefined, decimal: ',' | '.'): string {
  if (cents == null) return '';
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)}${decimal}${String(abs % 100).padStart(2, '0')}`;
  return negative ? `-${s}` : s;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 86_400_000);
}
