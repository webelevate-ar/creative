import type { Child, FC, PropsWithChildren } from 'hono/jsx';
import { formatMoney, formatPct } from '../lib/money.js';

export const Csrf: FC<{ token: string }> = ({ token }) => <input type="hidden" name="_csrf" value={token} />;

export const Field: FC<
  PropsWithChildren<{ label: string; name: string; error?: string | undefined; hint?: Child; id?: string }>
> = ({ label, name, error, hint, id, children }) => (
  <div class={`field${error ? ' field--error' : ''}`}>
    <label for={id ?? name}>{label}</label>
    {children}
    {hint ? <p class="field__hint">{hint}</p> : null}
    {error ? (
      <p class="field__error" id={`${id ?? name}-error`} role="alert">
        {error}
      </p>
    ) : null}
  </div>
);

export const Alert: FC<PropsWithChildren<{ kind?: 'info' | 'ok' | 'warn' | 'error' }>> = ({ kind = 'info', children }) => (
  <div class={`alert alert--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    {children}
  </div>
);

export const Badge: FC<PropsWithChildren<{ tone?: 'neutral' | 'up' | 'down' | 'warn' | 'ok' | 'info' }>> = ({ tone = 'neutral', children }) => (
  <span class={`badge badge--${tone}`}>{children}</span>
);

export const Money: FC<{ cents: number | null | undefined }> = ({ cents }) => <span class="num">{formatMoney(cents)}</span>;

export const Change: FC<{ ratio: number | null | undefined }> = ({ ratio }) => {
  if (ratio == null) return <span class="muted">—</span>;
  const tone = ratio > 0.0005 ? 'up' : ratio < -0.0005 ? 'down' : 'same';
  return <span class={`change change--${tone} num`}>{formatPct(ratio)}</span>;
};

export const Stat: FC<{ label: string; value: Child; tone?: string; href?: string | undefined }> = ({ label, value, tone, href }) => {
  const inner = (
    <>
      <span class="stat__value">{value}</span>
      <span class="stat__label">{label}</span>
    </>
  );
  return href ? (
    <a class={`stat${tone ? ` stat--${tone}` : ''}`} href={href}>
      {inner}
    </a>
  ) : (
    <div class={`stat${tone ? ` stat--${tone}` : ''}`}>{inner}</div>
  );
};

export const Empty: FC<PropsWithChildren<{ title: string }>> = ({ title, children }) => (
  <div class="empty">
    <h3>{title}</h3>
    {children}
  </div>
);

export function pageHref(base: string, params: Record<string, string | number | undefined | null>, page: number): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '' && k !== 'page') q.set(k, String(v));
  if (page > 1) q.set('page', String(page));
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export const Pagination: FC<{ base: string; params: Record<string, string | number | undefined | null>; page: number; pageSize: number; total: number }> = ({
  base,
  params,
  page,
  pageSize,
  total,
}) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav class="pagination" aria-label="Paginación">
      {page > 1 ? <a href={pageHref(base, params, page - 1)}>← Anterior</a> : <span class="muted">← Anterior</span>}
      <span>
        Página {page} de {pages}
      </span>
      {page < pages ? <a href={pageHref(base, params, page + 1)}>Siguiente →</a> : <span class="muted">Siguiente →</span>}
    </nav>
  );
};
