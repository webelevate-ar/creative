import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Config } from '../config.js';
import type { DB } from '../db/index.js';
import type { Mailer } from '../lib/mailer.js';
import type { SessionUser } from '../services/auth.js';
import { accessState } from '../lib/plans.js';
import type { AppChrome, Flash } from './layout.js';
import type { RateLimiter } from '../lib/ratelimit.js';

export interface Deps {
  db: DB;
  config: Config;
  mailer: Mailer;
  limiters: { login: RateLimiter; signup: RateLimiter; reset: RateLimiter; upload: RateLimiter };
}

export type AppEnv = {
  Variables: {
    deps: Deps;
    user: SessionUser | null;
    nonce: string;
  };
};

export type Ctx = Context<AppEnv>;

export const SESSION_COOKIE = 'rm_session';
const FLASH_COOKIE = 'rm_flash';

export function secureCookies(c: Ctx): boolean {
  return c.var.deps.config.env === 'production';
}

export function setFlash(c: Ctx, flash: Flash): void {
  setCookie(c, FLASH_COOKIE, encodeURIComponent(JSON.stringify(flash)).slice(0, 1500), {
    httpOnly: true,
    sameSite: 'Lax',
    secure: secureCookies(c),
    path: '/',
    maxAge: 60,
  });
}

export function takeFlash(c: Ctx): Flash | null {
  const raw = getCookie(c, FLASH_COOKIE);
  if (!raw) return null;
  deleteCookie(c, FLASH_COOKIE, { path: '/' });
  try {
    const f = JSON.parse(decodeURIComponent(raw)) as Flash;
    if (typeof f?.text !== 'string' || !['ok', 'info', 'warn', 'error'].includes(f.kind)) return null;
    return { kind: f.kind, text: f.text.slice(0, 500) };
  } catch {
    return null;
  }
}

export function requireUser(c: Ctx): SessionUser {
  const u = c.var.user;
  if (!u) throw new Error('requireUser called without a session');
  return u;
}

export function orgAccess(c: Ctx) {
  const user = requireUser(c);
  const org = c.var.deps.db.prepare('SELECT name, plan, trial_ends_at, paid_until FROM orgs WHERE id = ?').get(user.orgId) as {
    name: string;
    plan: string;
    trial_ends_at: string;
    paid_until: string | null;
  };
  return { org, ...accessState(org) };
}

export function chrome(c: Ctx): AppChrome {
  const user = requireUser(c);
  const a = orgAccess(c);
  return { user, orgName: a.org.name, active: a.active, planName: a.plan.name, daysLeft: a.daysLeft, isTrial: a.plan.id === 'trial' };
}

/** Parses a positive integer route/query parameter; returns null when invalid. */
export function intParam(v: string | undefined | null): number | null {
  if (!v || !/^\d{1,12}$/.test(v)) return null;
  const n = Number(v);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}

/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
export function safeNext(v: string | undefined | null, fallback = '/app'): string {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return fallback;
  return v.slice(0, 300);
}

export type FormData = Record<string, string>;

/** Flattens a parsed body into strings, dropping files and arrays. */
export function formStrings(body: Record<string, unknown>): FormData {
  const out: FormData = {};
  for (const [k, v] of Object.entries(body)) if (typeof v === 'string') out[k] = v.slice(0, 5000);
  return out;
}

export function zodErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? '_');
    out[k] ??= i.message;
  }
  return out;
}

export function clientIp(c: Ctx): string {
  // Behind a reverse proxy set TRUST_PROXY=1 so X-Forwarded-For is honored.
  if (process.env.TRUST_PROXY === '1') {
    const xff = c.req.header('x-forwarded-for');
    if (xff) return xff.split(',')[0]!.trim().slice(0, 64);
  }
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return env?.incoming?.socket?.remoteAddress ?? 'unknown';
}
