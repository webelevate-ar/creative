import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { z } from 'zod';
import { chrome, clientIp, formStrings, intParam, orgAccess, requireUser, secureCookies, SESSION_COOKIE, setFlash, takeFlash, type AppEnv, type Ctx } from '../context.js';
import { AppLayout, PublicLayout } from '../layout.js';
import { Alert, Csrf, Field } from '../ui.js';
import { acceptInvite, createInvite, findInvite, listMembers, listPendingInvites, removeMember, revokeInvite, seatsUsed, TeamError } from '../../services/team.js';
import { createSession, emailSchema, passwordSchema } from '../../services/auth.js';
import { formatDate } from '../../lib/money.js';

export const teamRoutes = new Hono<AppEnv>();

function TeamPage(p: { c: Ctx; inviteLink?: string; inviteEmail?: string; error?: string }) {
  const user = requireUser(p.c);
  const { db } = p.c.var.deps;
  const members = listMembers(db, user.orgId);
  const invites = listPendingInvites(db, user.orgId);
  const plan = orgAccess(p.c).plan;
  const isOwner = user.role === 'owner';
  const used = seatsUsed(db, user.orgId);
  return (
    <AppLayout title="Equipo" section="ajustes" chrome={chrome(p.c)} flash={takeFlash(p.c)}>
      {p.error ? <Alert kind="error">{p.error}</Alert> : null}
      {p.inviteLink ? (
        <section class="card">
          <h2>Invitación lista para {p.inviteEmail}</h2>
          <p>Mandale este enlace (vence en 7 días y sirve una sola vez):</p>
          <p>
            <input readonly value={p.inviteLink} aria-label="Enlace de invitación" />
          </p>
          <p>
            <a class="btn" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Te invito a usar Remarcá con nosotros: ${p.inviteLink}`)}`}>
              Enviar por WhatsApp
            </a>
          </p>
        </section>
      ) : null}
      <section class="card">
        <p class="muted">
          Usuarios: {used} de {plan.users} en tu plan {plan.name}.
        </p>
        <div class="table-wrap" tabindex={0} role="region" aria-label="Tabla (se puede desplazar)">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Último ingreso</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td>{m.role === 'owner' ? 'Titular' : 'Usuario'}</td>
                  <td>{formatDate(m.last_login_at)}</td>
                  <td class="r">
                    {isOwner && m.role !== 'owner' ? (
                      <form method="post" action={`/app/equipo/${m.id}/quitar`} data-confirm={`¿Quitar a ${m.name}?`}>
                        <Csrf token={user.csrf} />
                        <button class="linklike" type="submit">
                          Quitar
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
              {invites.map((i) => (
                <tr class="row--muted">
                  <td>Invitación pendiente</td>
                  <td>{i.email}</td>
                  <td>Usuario</td>
                  <td>vence {formatDate(i.expires_at)}</td>
                  <td class="r">
                    {isOwner ? (
                      <form method="post" action="/app/equipo/revocar">
                        <Csrf token={user.csrf} />
                        <input type="hidden" name="email" value={i.email} />
                        <button class="linklike" type="submit">
                          Cancelar
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {isOwner ? (
        <form method="post" action="/app/equipo/invitar" class="card stack narrow-left">
          <Csrf token={user.csrf} />
          <h2>Invitar a alguien</h2>
          <Field label="Email de la persona" name="email">
            <input id="email" name="email" type="email" required maxlength={254} />
          </Field>
          <button class="btn" type="submit">
            Crear invitación
          </button>
        </form>
      ) : (
        <p class="muted">Solo el titular de la cuenta puede invitar o quitar usuarios.</p>
      )}
    </AppLayout>
  );
}

teamRoutes.get('/app/equipo', (c) => c.html(<TeamPage c={c} />));

teamRoutes.post('/app/equipo/invitar', async (c) => {
  const user = requireUser(c);
  if (user.role !== 'owner') return c.html(<TeamPage c={c} error="Solo el titular puede invitar." />, 403);
  const form = formStrings(await c.req.parseBody());
  const email = emailSchema.safeParse(form.email ?? '');
  if (!email.success) return c.html(<TeamPage c={c} error="Ingresá un email válido." />, 400);
  try {
    const token = createInvite(c.var.deps.db, user.orgId, user.userId, email.data, orgAccess(c).plan.users);
    const link = `${c.var.deps.config.baseUrl}/invitacion?t=${encodeURIComponent(token)}`;
    return c.html(<TeamPage c={c} inviteLink={link} inviteEmail={email.data} />);
  } catch (err) {
    if (err instanceof TeamError) return c.html(<TeamPage c={c} error={err.message} />, 400);
    throw err;
  }
});

teamRoutes.post('/app/equipo/revocar', async (c) => {
  const user = requireUser(c);
  if (user.role !== 'owner') return c.redirect('/app/equipo');
  const form = formStrings(await c.req.parseBody());
  revokeInvite(c.var.deps.db, user.orgId, form.email ?? '');
  setFlash(c, { kind: 'ok', text: 'Invitación cancelada.' });
  return c.redirect('/app/equipo');
});

teamRoutes.post('/app/equipo/:id/quitar', (c) => {
  const user = requireUser(c);
  const id = intParam(c.req.param('id'));
  if (user.role !== 'owner' || !id) return c.notFound();
  try {
    removeMember(c.var.deps.db, user.orgId, user.userId, id);
  } catch (err) {
    if (err instanceof TeamError) {
      setFlash(c, { kind: 'error', text: err.message });
      return c.redirect('/app/equipo');
    }
    throw err;
  }
  setFlash(c, { kind: 'ok', text: 'Usuario quitado. Ya no puede ingresar.' });
  return c.redirect('/app/equipo');
});

// Public: accept an invitation.
const AcceptPage = (p: { token: string; email?: string; orgName?: string; error?: string; invalid?: boolean }) => (
  <PublicLayout title="Unirte a un equipo · Remarcá">
    <section class="narrow card">
      {p.invalid ? (
        <>
          <h1>Invitación no válida</h1>
          <Alert kind="error">El enlace venció o ya se usó. Pedile a quien te invitó uno nuevo.</Alert>
        </>
      ) : (
        <>
          <h1>Unite a {p.orgName}</h1>
          <p class="muted">Vas a ingresar como {p.email}.</p>
          {p.error ? <Alert kind="error">{p.error}</Alert> : null}
          <form method="post" action={`/invitacion?t=${encodeURIComponent(p.token)}`} class="stack">
            <Field label="Tu nombre" name="name">
              <input id="name" name="name" required maxlength={80} autocomplete="name" />
            </Field>
            <Field label="Elegí una contraseña" name="password" hint="Mínimo 8 caracteres.">
              <input id="password" name="password" type="password" required minlength={8} maxlength={200} autocomplete="new-password" />
            </Field>
            <button class="btn btn--block" type="submit">
              Crear mi usuario
            </button>
          </form>
        </>
      )}
    </section>
  </PublicLayout>
);

teamRoutes.get('/invitacion', (c) => {
  const token = c.req.query('t') ?? '';
  const inv = findInvite(c.var.deps.db, token);
  return c.html(inv ? <AcceptPage token={token} email={inv.email} orgName={inv.orgName} /> : <AcceptPage token={token} invalid />);
});

teamRoutes.post('/invitacion', async (c) => {
  const { db, limiters } = c.var.deps;
  const token = c.req.query('t') ?? '';
  const inv = findInvite(db, token);
  if (!inv) return c.html(<AcceptPage token={token} invalid />, 400);
  if (!limiters.signup.take(`signup:${clientIp(c)}`)) return c.html(<AcceptPage token={token} email={inv.email} orgName={inv.orgName} error="Demasiados intentos. Probá más tarde." />, 429);
  const form = formStrings(await c.req.parseBody());
  const parsed = z.object({ name: z.string().trim().min(2, 'Ingresá tu nombre.').max(80), password: passwordSchema }).safeParse(form);
  if (!parsed.success) return c.html(<AcceptPage token={token} email={inv.email} orgName={inv.orgName} error={parsed.error.issues[0]!.message} />, 400);
  try {
    const res = await acceptInvite(db, token, parsed.data.name, parsed.data.password);
    if (!res) return c.html(<AcceptPage token={token} invalid />, 400);
    const { token: session, expiresAt } = createSession(db, res.userId, res.orgId);
    setCookie(c, SESSION_COOKIE, session, { httpOnly: true, secure: secureCookies(c), sameSite: 'Lax', path: '/', expires: expiresAt });
    setFlash(c, { kind: 'ok', text: `Bienvenido/a a ${inv.orgName}.` });
    return c.redirect('/app');
  } catch (err) {
    if (err instanceof TeamError) return c.html(<AcceptPage token={token} email={inv.email} orgName={inv.orgName} error={err.message} />, 400);
    throw err;
  }
});
