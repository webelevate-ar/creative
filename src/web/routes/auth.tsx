import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { AuthError, changePassword, checkResetToken, createPasswordReset, createSession, destroyAllSessions, destroySession, login, passwordSchema, resetPassword, signup, signupSchema } from '../../services/auth.js';
import { track } from '../../lib/events.js';
import { PublicLayout } from '../layout.js';
import { Alert, Csrf, Field } from '../ui.js';
import { SESSION_COOKIE, clientIp, formStrings, requireUser, safeNext, secureCookies, setFlash, takeFlash, zodErrors, type AppEnv, type Ctx } from '../context.js';

export const authRoutes = new Hono<AppEnv>();

function startSession(c: Ctx, userId: number, orgId: number) {
  const { token, expiresAt } = createSession(c.var.deps.db, userId, orgId);
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, secure: secureCookies(c), sameSite: 'Lax', path: '/', expires: expiresAt });
}

const SignupPage = (p: { values?: Record<string, string>; errors?: Record<string, string>; general?: string }) => (
  <PublicLayout title="Crear cuenta · Remarcá">
    <section class="narrow card">
      <h1>Probá Remarcá gratis 14 días</h1>
      <p class="muted">Sin tarjeta. Al terminar la prueba tus datos quedan disponibles para exportar.</p>
      {p.general ? <Alert kind="error">{p.general}</Alert> : null}
      <form method="post" action="/registro" class="stack" novalidate>
        <Field label="Tu nombre" name="name" error={p.errors?.name}>
          <input id="name" name="name" autocomplete="name" required maxlength={80} value={p.values?.name ?? ''} aria-invalid={p.errors?.name ? 'true' : undefined} />
        </Field>
        <Field label="Nombre del comercio" name="business" error={p.errors?.business}>
          <input id="business" name="business" autocomplete="organization" required maxlength={100} value={p.values?.business ?? ''} aria-invalid={p.errors?.business ? 'true' : undefined} />
        </Field>
        <Field label="Email" name="email" error={p.errors?.email}>
          <input id="email" name="email" type="email" autocomplete="email" required maxlength={254} value={p.values?.email ?? ''} aria-invalid={p.errors?.email ? 'true' : undefined} />
        </Field>
        <Field label="Contraseña" name="password" error={p.errors?.password} hint="Mínimo 8 caracteres.">
          <input id="password" name="password" type="password" autocomplete="new-password" required minlength={8} maxlength={200} aria-invalid={p.errors?.password ? 'true' : undefined} />
        </Field>
        <button class="btn btn--block" type="submit">
          Crear cuenta
        </button>
        <p class="small muted">
          Al crear la cuenta aceptás los <a href="/terminos">términos</a> y la <a href="/privacidad">política de privacidad</a>.
        </p>
      </form>
      <p>
        ¿Ya tenés cuenta? <a href="/ingresar">Ingresá</a>
      </p>
    </section>
  </PublicLayout>
);

authRoutes.get('/registro', (c) => (c.var.user ? c.redirect('/app') : c.html(<SignupPage />)));

authRoutes.post('/registro', async (c) => {
  const { db, limiters } = c.var.deps;
  const form = formStrings(await c.req.parseBody());
  if (!limiters.signup.take(`signup:${clientIp(c)}`)) {
    return c.html(<SignupPage values={form} general="Demasiados intentos desde tu conexión. Probá de nuevo en un rato." />, 429);
  }
  const parsed = signupSchema.safeParse(form);
  if (!parsed.success) return c.html(<SignupPage values={form} errors={zodErrors(parsed.error.issues)} />, 400);
  try {
    const { userId, orgId } = await signup(db, parsed.data);
    track(db, 'signup', orgId, userId);
    startSession(c, userId, orgId);
    setFlash(c, { kind: 'ok', text: '¡Listo! Tu cuenta está creada. Seguí los pasos para actualizar tu primera lista.' });
    return c.redirect('/app');
  } catch (err) {
    if (err instanceof AuthError) return c.html(<SignupPage values={form} errors={{ email: err.message }} />, 400);
    throw err;
  }
});

const LoginPage = (p: { email?: string; next?: string; error?: string; flash?: ReturnType<typeof takeFlash> }) => (
  <PublicLayout title="Ingresar · Remarcá" flash={p.flash ?? null}>
    <section class="narrow card">
      <h1>Ingresar</h1>
      {p.error ? <Alert kind="error">{p.error}</Alert> : null}
      <form method="post" action={`/ingresar${p.next ? `?next=${encodeURIComponent(p.next)}` : ''}`} class="stack">
        <Field label="Email" name="email">
          <input id="email" name="email" type="email" autocomplete="email" required maxlength={254} value={p.email ?? ''} />
        </Field>
        <Field label="Contraseña" name="password">
          <input id="password" name="password" type="password" autocomplete="current-password" required maxlength={200} />
        </Field>
        <button class="btn btn--block" type="submit">
          Ingresar
        </button>
      </form>
      <p>
        <a href="/recuperar">Olvidé mi contraseña</a> · <a href="/registro">Crear cuenta</a>
      </p>
    </section>
  </PublicLayout>
);

authRoutes.get('/ingresar', (c) => {
  if (c.var.user) return c.redirect(safeNext(c.req.query('next')));
  return c.html(<LoginPage next={safeNext(c.req.query('next'), '')} flash={takeFlash(c)} />);
});

authRoutes.post('/ingresar', async (c) => {
  const { db, limiters } = c.var.deps;
  const form = formStrings(await c.req.parseBody());
  const email = (form.email ?? '').trim().toLowerCase().slice(0, 254);
  const next = safeNext(c.req.query('next'));
  const ipOk = limiters.login.take(`login-ip:${clientIp(c)}`);
  const emailOk = limiters.login.take(`login-email:${email}`);
  if (!ipOk || !emailOk) return c.html(<LoginPage email={email} next={next} error="Demasiados intentos. Esperá 15 minutos y probá de nuevo." />, 429);
  const res = await login(db, email, form.password ?? '');
  if (!res) return c.html(<LoginPage email={email} next={next} error="Email o contraseña incorrectos." />, 401);
  limiters.login.reset(`login-email:${email}`);
  track(db, 'login', res.orgId, res.userId);
  startSession(c, res.userId, res.orgId);
  return c.redirect(next);
});

authRoutes.post('/salir', (c) => {
  const user = c.var.user;
  if (user) destroySession(c.var.deps.db, user.tokenHash);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.redirect('/');
});

const ForgotPage = (p: { sent?: boolean; error?: string }) => (
  <PublicLayout title="Recuperar contraseña · Remarcá">
    <section class="narrow card">
      <h1>Recuperar contraseña</h1>
      {p.sent ? (
        <Alert kind="ok">Si el email tiene una cuenta, te mandamos un enlace para crear una contraseña nueva. Vence en 1 hora.</Alert>
      ) : (
        <>
          {p.error ? <Alert kind="error">{p.error}</Alert> : null}
          <form method="post" action="/recuperar" class="stack">
            <Field label="Email de tu cuenta" name="email">
              <input id="email" name="email" type="email" autocomplete="email" required maxlength={254} />
            </Field>
            <button class="btn btn--block" type="submit">
              Enviar enlace
            </button>
          </form>
        </>
      )}
      <p>
        <a href="/ingresar">Volver a ingresar</a>
      </p>
    </section>
  </PublicLayout>
);

authRoutes.get('/recuperar', (c) => c.html(<ForgotPage />));

authRoutes.post('/recuperar', async (c) => {
  const { db, limiters, mailer, config } = c.var.deps;
  const form = formStrings(await c.req.parseBody());
  const email = (form.email ?? '').trim().toLowerCase().slice(0, 254);
  if (!limiters.reset.take(`reset-ip:${clientIp(c)}`) || !limiters.reset.take(`reset-email:${email}`)) {
    return c.html(<ForgotPage error="Demasiados pedidos. Probá de nuevo en un rato." />, 429);
  }
  const reset = createPasswordReset(db, email);
  if (reset) {
    const link = `${config.baseUrl}/restablecer?t=${encodeURIComponent(reset.token)}`;
    try {
      await mailer.send({
        to: reset.email,
        subject: 'Crear una contraseña nueva en Remarcá',
        text: `Hola,\n\nPara crear una contraseña nueva entrá a este enlace (vence en 1 hora):\n${link}\n\nSi no lo pediste, ignorá este email.\n\nRemarcá`,
      });
    } catch (err) {
      console.error('[mail] reset email failed', err);
    }
  }
  // Same answer whether or not the email exists.
  return c.html(<ForgotPage sent />);
});

const ResetPage = (p: { token: string; error?: string; invalid?: boolean }) => (
  <PublicLayout title="Nueva contraseña · Remarcá">
    <section class="narrow card">
      <h1>Crear contraseña nueva</h1>
      {p.invalid ? (
        <>
          <Alert kind="error">El enlace no es válido o ya venció.</Alert>
          <p>
            <a href="/recuperar">Pedir un enlace nuevo</a>
          </p>
        </>
      ) : (
        <form method="post" action={`/restablecer?t=${encodeURIComponent(p.token)}`} class="stack">
          {p.error ? <Alert kind="error">{p.error}</Alert> : null}
          <Field label="Contraseña nueva" name="password" hint="Mínimo 8 caracteres.">
            <input id="password" name="password" type="password" autocomplete="new-password" required minlength={8} maxlength={200} />
          </Field>
          <button class="btn btn--block" type="submit">
            Guardar contraseña
          </button>
        </form>
      )}
    </section>
  </PublicLayout>
);

authRoutes.get('/restablecer', (c) => {
  const token = c.req.query('t') ?? '';
  return c.html(<ResetPage token={token} invalid={checkResetToken(c.var.deps.db, token) == null} />);
});

authRoutes.post('/restablecer', async (c) => {
  const token = c.req.query('t') ?? '';
  const form = formStrings(await c.req.parseBody());
  const parsed = passwordSchema.safeParse(form.password ?? '');
  if (!parsed.success) return c.html(<ResetPage token={token} error={parsed.error.issues[0]!.message} />, 400);
  const ok = await resetPassword(c.var.deps.db, token, parsed.data);
  if (!ok) return c.html(<ResetPage token={token} invalid />, 400);
  setFlash(c, { kind: 'ok', text: 'Contraseña actualizada. Ya podés ingresar.' });
  return c.redirect('/ingresar');
});

// Change password (inside the app, but lives with auth).
authRoutes.post('/app/cuenta/password', async (c) => {
  const user = requireUser(c);
  const { db, limiters } = c.var.deps;
  const form = formStrings(await c.req.parseBody());
  if (!limiters.login.take(`pwchange:${user.userId}`)) {
    setFlash(c, { kind: 'error', text: 'Demasiados intentos. Probá más tarde.' });
    return c.redirect('/app/cuenta');
  }
  const parsed = passwordSchema.safeParse(form.new_password ?? '');
  if (!parsed.success) {
    setFlash(c, { kind: 'error', text: parsed.error.issues[0]!.message });
    return c.redirect('/app/cuenta');
  }
  if (!(await changePassword(db, user.userId, form.current_password ?? '', parsed.data))) {
    setFlash(c, { kind: 'error', text: 'La contraseña actual no es correcta.' });
    return c.redirect('/app/cuenta');
  }
  destroyAllSessions(db, user.userId);
  startSession(c, user.userId, user.orgId);
  setFlash(c, { kind: 'ok', text: 'Contraseña actualizada. Cerramos las demás sesiones abiertas.' });
  return c.redirect('/app/cuenta');
});
