import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from './config.js';
import type { DB } from './db/index.js';
import type { Mailer } from './lib/mailer.js';
import { RateLimiter } from './lib/ratelimit.js';
import { safeEqual } from './lib/security.js';
import { getSession } from './services/auth.js';
import { SESSION_COOKIE, formStrings, orgAccess, setFlash, type AppEnv, type Deps } from './web/context.js';
import { ErrorPage } from './web/layout.js';
import { publicRoutes } from './web/routes/public.js';
import { authRoutes } from './web/routes/auth.js';
import { dashboardRoutes } from './web/routes/dashboard.js';
import { supplierRoutes } from './web/routes/suppliers.js';
import { productRoutes } from './web/routes/products.js';
import { listRoutes } from './web/routes/lists.js';
import { teamRoutes } from './web/routes/team.js';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), 'public');
const STATIC_FILES: Record<string, string> = {
  'styles.css': 'text/css; charset=utf-8',
  'app.js': 'text/javascript; charset=utf-8',
  'favicon.svg': 'image/svg+xml',
};
const staticCache = new Map<string, Uint8Array>();
function staticFile(name: string): Uint8Array | null {
  if (!(name in STATIC_FILES)) return null;
  let buf = staticCache.get(name);
  if (!buf) {
    buf = readFileSync(join(PUBLIC_DIR, name));
    staticCache.set(name, buf);
  }
  return buf;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UPLOAD_PATHS = ['/app/listas', '/app/productos/importar'];
/** POSTs still allowed when the plan is inactive (read-only mode). */
const INACTIVE_ALLOWED = [/^\/app\/cuenta\//, /^\/app\/plan/, /^\/app\/ajustes$/];

export function createApp(input: { db: DB; config: Config; mailer: Mailer; limiters?: Deps['limiters'] }) {
  const deps: Deps = {
    db: input.db,
    config: input.config,
    mailer: input.mailer,
    limiters: input.limiters ?? {
      login: new RateLimiter(input.config.loginLimitPer15m, 15 * 60_000),
      signup: new RateLimiter(input.config.signupLimitPerHour, 60 * 60_000),
      reset: new RateLimiter(5, 60 * 60_000),
      upload: new RateLimiter(60, 60 * 60_000),
    },
  };
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('deps', deps);
    c.set('user', null);
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'same-origin');
    c.header('X-Frame-Options', 'DENY');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    c.header('Cross-Origin-Opener-Policy', 'same-origin');
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
    );
    if (deps.config.env === 'production') c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (c.req.path.startsWith('/app') || c.req.path.startsWith('/restablecer')) c.header('Cache-Control', 'no-store');
  });

  app.get('/static/:file', (c) => {
    const name = c.req.param('file');
    const buf = staticFile(name);
    if (!buf) return c.notFound();
    c.header('Content-Type', STATIC_FILES[name]!);
    c.header('Cache-Control', deps.config.env === 'production' ? 'public, max-age=86400' : 'no-cache');
    return c.body(buf as Uint8Array<ArrayBuffer>);
  });

  // Upload endpoints accept files up to 12 MB (+ multipart overhead); everything else is small.
  app.use('*', async (c, next) => {
    if (!MUTATING.has(c.req.method)) return next();
    const isUpload = UPLOAD_PATHS.includes(c.req.path);
    return bodyLimit({
      maxSize: isUpload ? 13 * 1024 * 1024 : 256 * 1024,
      onError: (cc) => cc.html(<ErrorPage status={413} message="El archivo es demasiado grande. El máximo es 12 MB." />, 413),
    })(c, next);
  });

  // Session.
  app.use('*', async (c, next) => {
    c.set('user', getSession(deps.db, getCookie(c, SESSION_COOKIE)));
    await next();
  });

  // CSRF: same-origin check for every mutation + per-session token for authenticated ones.
  app.use('*', async (c, next) => {
    if (!MUTATING.has(c.req.method)) return next();
    const source = c.req.header('origin') ?? c.req.header('referer');
    if (source && source !== 'null') {
      let host = '';
      try {
        host = new URL(source).host;
      } catch {
        host = '';
      }
      const allowed = new Set([c.req.header('host') ?? '', new URL(deps.config.baseUrl).host]);
      if (!allowed.has(host)) return c.html(<ErrorPage status={403} message="Solicitud rechazada por seguridad (origen no válido)." />, 403);
    }
    const user = c.var.user;
    if (user) {
      let token = c.req.header('x-csrf-token') ?? '';
      if (!token) {
        const ct = c.req.header('content-type') ?? '';
        if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
          token = formStrings(await c.req.parseBody())._csrf ?? '';
        }
      }
      if (!token || !safeEqual(token, user.csrf)) {
        return c.html(<ErrorPage status={403} message="Tu sesión se actualizó. Volvé atrás, recargá la página e intentá de nuevo." />, 403);
      }
    }
    return next();
  });

  // Authenticated area.
  app.use('/app/*', async (c, next) => {
    if (!c.var.user) {
      const next_ = encodeURIComponent(c.req.path + (c.req.url.includes('?') ? `?${c.req.url.split('?')[1]}` : ''));
      return c.redirect(`/ingresar?next=${next_}`);
    }
    if (MUTATING.has(c.req.method) && !INACTIVE_ALLOWED.some((re) => re.test(c.req.path))) {
      if (!orgAccess(c).active) {
        setFlash(c, { kind: 'warn', text: 'Tu cuenta está en modo solo lectura. Activá un plan para seguir actualizando precios.' });
        return c.redirect('/app/plan');
      }
    }
    return next();
  });
  app.get('/app', async (c, next) => (c.var.user ? next() : c.redirect('/ingresar')));

  app.route('/', publicRoutes);
  app.route('/', authRoutes);
  app.route('/', teamRoutes);
  app.route('/app', dashboardRoutes);
  app.route('/app/proveedores', supplierRoutes);
  app.route('/app/productos', productRoutes);
  app.route('/app/listas', listRoutes);

  app.notFound((c) => c.html(<ErrorPage status={404} message="La página que buscás no existe o no tenés acceso." />, 404));
  app.onError((err, c) => {
    console.error(`[error] ${c.req.method} ${c.req.path}`, err);
    return c.html(<ErrorPage status={500} message="Tuvimos un problema procesando tu pedido. Probá de nuevo; si sigue pasando, escribinos." />, 500);
  });
  return app;
}
