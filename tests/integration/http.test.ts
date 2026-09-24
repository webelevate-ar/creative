/**
 * HTTP-level tests against the real app: auth, authorization (IDOR), CSRF, XSS, redirects,
 * rate limits, plan gating and double submits. These are the adversarial checks from docs/12-security.md.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { openDb, type DB } from '../../src/db/index.js';
import { MemoryMailer } from '../../src/lib/mailer.js';
import { hardwareItems, nextVersion, tornilloXlsx } from '../../src/services/sample-data.js';

const config = loadConfig({ NODE_ENV: 'test', BASE_URL: 'http://localhost:3000' } as NodeJS.ProcessEnv);
const ORIGIN = 'http://localhost:3000';

let db: DB;
let mailer: MemoryMailer;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDb(':memory:');
  mailer = new MemoryMailer('none');
  app = createApp({ db, config, mailer });
});

class Agent {
  cookies = new Map<string, string>();
  csrf = '';
  async req(path: string, init: { method?: string; form?: Record<string, string> | FormData; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { ...(init.headers ?? {}) };
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    let body: BodyInit | undefined;
    if (init.form instanceof FormData) body = init.form;
    else if (init.form) {
      body = new URLSearchParams(init.form).toString();
      headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    if (init.method === 'POST' && !('origin' in headers)) headers.origin = ORIGIN;
    const res = await app.request(path, { method: init.method ?? 'GET', headers, body });
    for (const sc of res.headers.getSetCookie()) {
      const [pair] = sc.split(';');
      const [k, v] = pair!.split('=');
      if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(sc) || v === '') this.cookies.delete(k!);
      else this.cookies.set(k!, v!);
    }
    return res;
  }
  async post(path: string, form: Record<string, string> = {}, headers: Record<string, string> = {}) {
    return this.req(path, { method: 'POST', form: { _csrf: this.csrf, ...form }, headers });
  }
  async refreshCsrf() {
    const html = await (await this.req('/app/cuenta')).text();
    this.csrf = /name="_csrf" value="([^"]+)"/.exec(html)?.[1] ?? '';
  }
  async signup(email: string, business = 'Comercio') {
    const res = await this.req('/registro', { method: 'POST', form: { name: 'Test', business, email, password: 'password123' } });
    expect(res.status).toBe(302);
    await this.refreshCsrf();
    return res;
  }
  async upload(supplierId: number, buf: Buffer, name = 'lista.xlsx') {
    const fd = new FormData();
    fd.set('_csrf', this.csrf);
    fd.set('supplier_id', String(supplierId));
    fd.set('file', new File([new Uint8Array(buf)], name));
    return this.req('/app/listas', { method: 'POST', form: fd });
  }
}

function orgOf(email: string): number {
  return db.prepare('SELECT org_id FROM users WHERE email = ?').pluck().get(email) as number;
}

async function setupStoreWithAppliedList(a: Agent, email: string) {
  await a.signup(email);
  await a.post('/app/ejemplo');
  const orgId = orgOf(email);
  const supplierId = db.prepare('SELECT id FROM suppliers WHERE org_id = ?').pluck().get(orgId) as number;
  const up = await a.upload(supplierId, tornilloXlsx(nextVersion(hardwareItems(300))));
  const importId = Number(/\/app\/listas\/(\d+)/.exec(up.headers.get('location') ?? '')![1]);
  const imp = db.prepare('SELECT mapping_json FROM imports WHERE id = ?').get(importId) as { mapping_json: string };
  const m = JSON.parse(imp.mapping_json);
  const map = await a.post(`/app/listas/${importId}/mapeo`, { sheet: 'Lista', header_row: String(m.headerRow + 1), code: String(m.code), price: String(m.price), description: String(m.description), pack: '', decimal: ',' });
  expect(map.headers.get('location')).toBe(`/app/listas/${importId}`);
  const productId = db.prepare('SELECT id FROM products WHERE org_id = ? LIMIT 1').pluck().get(orgId) as number;
  return { orgId, supplierId, importId, productId };
}

describe('authentication', () => {
  it('redirects anonymous users away from the app, keeping a safe next', async () => {
    const a = new Agent();
    const res = await a.req('/app/productos?q=x');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/ingresar?next=%2Fapp%2Fproductos%3Fq%3Dx');
  });

  it('signup sets an HttpOnly SameSite session cookie and logs in', async () => {
    const a = new Agent();
    const res = await a.signup('ana@test.com');
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith('rm_session='))!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect((await a.req('/app')).status).toBe(200);
    // The raw token is never stored: only its hash.
    const token = a.cookies.get('rm_session')!;
    expect(db.prepare('SELECT COUNT(*) FROM sessions WHERE token_hash = ?').pluck().get(token)).toBe(0);
  });

  it('rejects duplicate emails (case-insensitive) without leaking other data', async () => {
    const a = new Agent();
    await a.signup('dup@test.com');
    const b = new Agent();
    const res = await b.req('/registro', { method: 'POST', form: { name: 'Xavier', business: 'Otro comercio', email: 'DUP@test.com', password: 'password123' } });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Ya existe una cuenta');
  });

  it('login gives the same answer for unknown email and wrong password, and rate limits', async () => {
    const a = new Agent();
    await a.signup('rl@test.com');
    const b = new Agent();
    const r1 = await (await b.req('/ingresar', { method: 'POST', form: { email: 'nobody@test.com', password: 'x' } })).text();
    const r2 = await (await b.req('/ingresar', { method: 'POST', form: { email: 'rl@test.com', password: 'wrong-password' } })).text();
    expect(r1).toContain('Email o contraseña incorrectos.');
    expect(r2).toContain('Email o contraseña incorrectos.');
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await b.req('/ingresar', { method: 'POST', form: { email: 'rl@test.com', password: 'wrong' } })).status;
    expect(last).toBe(429);
  });

  it('never redirects off-site after login', async () => {
    const a = new Agent();
    await a.signup('redir@test.com');
    await a.post('/salir');
    for (const next of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
      const res = await a.req(`/ingresar?next=${encodeURIComponent(next)}`, { method: 'POST', form: { email: 'redir@test.com', password: 'password123' } });
      expect(res.headers.get('location')).toBe('/app');
      await a.refreshCsrf();
      await a.post('/salir');
    }
  });

  it('logout destroys the server-side session', async () => {
    const a = new Agent();
    await a.signup('out@test.com');
    const token = a.cookies.get('rm_session')!;
    await a.post('/salir');
    const b = new Agent();
    b.cookies.set('rm_session', token);
    expect((await b.req('/app')).status).toBe(302);
  });

  it('expired sessions are rejected', async () => {
    const a = new Agent();
    await a.signup('exp@test.com');
    db.prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    expect((await a.req('/app')).status).toBe(302);
  });

  it('password reset: same response for unknown emails, single-use token, kills sessions', async () => {
    const a = new Agent();
    await a.signup('reset@test.com');
    const anon = new Agent();
    const unknown = await (await anon.req('/recuperar', { method: 'POST', form: { email: 'nobody@test.com' } })).text();
    const known = await (await anon.req('/recuperar', { method: 'POST', form: { email: 'reset@test.com' } })).text();
    expect(unknown).toContain('Si el email tiene una cuenta');
    expect(known).toContain('Si el email tiene una cuenta');
    expect(mailer.sent).toHaveLength(1);
    const token = decodeURIComponent(/t=([^\s]+)/.exec(mailer.sent[0]!.text)![1]!);
    const ok = await anon.req(`/restablecer?t=${encodeURIComponent(token)}`, { method: 'POST', form: { password: 'nueva-clave-123' } });
    expect(ok.headers.get('location')).toBe('/ingresar');
    const again = await anon.req(`/restablecer?t=${encodeURIComponent(token)}`, { method: 'POST', form: { password: 'otra-clave-123' } });
    expect(again.status).toBe(400);
    expect((await a.req('/app')).status).toBe(302); // old session killed
    const login = await anon.req('/ingresar', { method: 'POST', form: { email: 'reset@test.com', password: 'nueva-clave-123' } });
    expect(login.headers.get('location')).toBe('/app');
  });
});

describe('CSRF and origin checks', () => {
  it('rejects authenticated posts without or with a wrong token', async () => {
    const a = new Agent();
    await a.signup('csrf@test.com');
    const noToken = await a.req('/app/proveedores', { method: 'POST', form: { name: 'X' } });
    expect(noToken.status).toBe(403);
    const wrong = await a.req('/app/proveedores', { method: 'POST', form: { _csrf: 'nope', name: 'X' } });
    expect(wrong.status).toBe(403);
    expect(db.prepare('SELECT COUNT(*) FROM suppliers').pluck().get()).toBe(0);
    const ok = await a.post('/app/proveedores', { name: 'X' });
    expect(ok.status).toBe(302);
  });

  it('rejects cross-origin posts even with a valid token, and anonymous cross-origin logins', async () => {
    const a = new Agent();
    await a.signup('origin@test.com');
    const res = await a.post('/app/proveedores', { name: 'X' }, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    const anon = new Agent();
    const login = await anon.req('/ingresar', { method: 'POST', form: { email: 'origin@test.com', password: 'password123' }, headers: { origin: 'https://evil.example' } });
    expect(login.status).toBe(403);
  });
});

describe('authorization between accounts (IDOR)', () => {
  it('another account cannot read or modify imports, rows, suppliers or products', async () => {
    const owner = new Agent();
    const { importId, supplierId, productId, orgId } = await setupStoreWithAppliedList(owner, 'owner@test.com');
    const rowId = db.prepare('SELECT id FROM import_rows WHERE import_id = ? LIMIT 1').pluck().get(importId) as number;
    const attacker = new Agent();
    await attacker.signup('attacker@test.com');
    const attackerOrg = orgOf('attacker@test.com');
    const attackerProduct = Number(
      db
        .prepare("INSERT INTO products (org_id, code, code_norm, description, search_text) VALUES (?, 'ATK', 'ATK', 'x', 'atk x')")
        .run(attackerOrg).lastInsertRowid,
    );

    for (const path of [
      `/app/listas/${importId}`,
      `/app/listas/${importId}/exportar?tipo=calculada`,
      `/app/listas/${importId}/etiquetas`,
      `/app/listas/${importId}/faltantes`,
      `/app/listas/${importId}/vincular/${rowId}`,
      `/app/proveedores/${supplierId}`,
      `/app/productos/${productId}`,
    ]) {
      const res = await attacker.req(path);
      expect(res.status, path).toBe(404);
    }
    for (const [path, form] of [
      [`/app/listas/${importId}/aplicar`, {}],
      [`/app/listas/${importId}/descartar`, {}],
      [`/app/listas/${importId}/recalcular`, {}],
      [`/app/listas/${importId}/fila/${rowId}`, { decision: 'skip' }],
      [`/app/listas/${importId}/masivo`, { filter: 'all', decision: 'skip' }],
      [`/app/listas/${importId}/vincular/${rowId}`, { product_id: String(attackerProduct) }],
      [`/app/proveedores/${supplierId}`, { name: 'hacked' }],
      [`/app/proveedores/${supplierId}/archivar`, {}],
      [`/app/productos/${productId}`, { code: 'hacked' }],
      [`/app/productos/${productId}/borrar`, {}],
    ] as const) {
      const res = await attacker.post(path, form);
      expect(res.status, path).toBe(404);
    }
    // Nothing changed for the owner.
    expect(db.prepare('SELECT status FROM imports WHERE id = ?').pluck().get(importId)).toBe('review');
    expect(db.prepare('SELECT name FROM suppliers WHERE id = ?').pluck().get(supplierId)).not.toBe('hacked');
    expect(db.prepare('SELECT COUNT(*) FROM products WHERE id = ? AND org_id = ?').pluck().get(productId, orgId)).toBe(1);

    // The owner cannot link a row to the attacker's product either (cross-org product id).
    const link = await owner.post(`/app/listas/${importId}/vincular/${rowId}`, { product_id: String(attackerProduct) });
    expect(link.status).toBe(302);
    expect(db.prepare('SELECT product_id FROM import_rows WHERE id = ?').pluck().get(rowId)).not.toBe(attackerProduct);

    // Uploading a list to someone else's supplier is refused.
    const up = await attacker.upload(supplierId, tornilloXlsx(hardwareItems(3)));
    expect(up.headers.get('location')).toMatch(/\/app\/listas\/nueva/);
    expect(db.prepare('SELECT COUNT(*) FROM imports WHERE org_id = ?').pluck().get(attackerOrg)).toBe(0);

    // Product search never returns other accounts' products.
    const search = await (await attacker.req('/app/productos?q=Tornillo')).text();
    expect(search).not.toContain('EJ0001');
  });

  it('assigning a product to another account supplier is refused', async () => {
    const owner = new Agent();
    const { supplierId } = await setupStoreWithAppliedList(owner, 'o2@test.com');
    const attacker = new Agent();
    await attacker.signup('a2@test.com');
    const res = await attacker.post('/app/productos', { code: 'X1', supplier_id: String(supplierId) });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Proveedor inválido');
  });
});

describe('input handling', () => {
  it('escapes user content (stored XSS)', async () => {
    const a = new Agent();
    await a.signup('xss@test.com', '<img src=x onerror=alert(1)>');
    await a.post('/app/proveedores', { name: '<script>alert(1)</script>' });
    const html = await (await a.req('/app/proveedores')).text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    const home = await (await a.req('/app')).text();
    expect(home).not.toContain('<img src=x');
  });

  it('malformed or huge ids are 404, not 500', async () => {
    const a = new Agent();
    await a.signup('ids@test.com');
    for (const p of ['/app/listas/abc', '/app/listas/-1', '/app/listas/99999999999999999999', '/app/productos/1e5', '/app/proveedores/0']) {
      expect((await a.req(p)).status, p).toBe(404);
    }
  });

  it('static files cannot be used for path traversal', async () => {
    const a = new Agent();
    for (const p of ['/static/..%2f..%2fpackage.json', '/static/%2e%2e%2fdb%2findex.ts', '/static/..%5c..%5cpackage.json', '/static/app.ts']) {
      expect((await a.req(p)).status, p).toBe(404);
    }
    expect((await a.req('/static/styles.css')).status).toBe(200);
  });

  it('rejects oversized uploads with 413', async () => {
    const a = new Agent();
    await a.signup('big@test.com');
    await a.post('/app/proveedores', { name: 'P' });
    const sid = db.prepare('SELECT id FROM suppliers LIMIT 1').pluck().get() as number;
    const res = await a.upload(sid, Buffer.alloc(14 * 1024 * 1024, 65), 'big.csv');
    expect(res.status).toBe(413);
  });

  it('neutralizes spreadsheet formulas in exported text', async () => {
    const a = new Agent();
    await a.signup('formula@test.com');
    await a.post('/app/productos', { code: '=HYPERLINK("http://evil","x")', description: '+cmd|calc', cost: '10', price: '20' });
    const csv = await (await a.req('/app/productos/exportar')).text();
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csv).toContain("'+cmd|calc");
  });

  it('sends security headers', async () => {
    const res = await new Agent().req('/');
    expect(res.headers.get('content-security-policy')).toContain("script-src 'self'");
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('business rules over HTTP', () => {
  it('double submit of apply only applies once', async () => {
    const a = new Agent();
    const { importId } = await setupStoreWithAppliedList(a, 'double@test.com');
    const [r1, r2] = await Promise.all([a.post(`/app/listas/${importId}/aplicar`), a.post(`/app/listas/${importId}/aplicar`)]);
    expect([r1.status, r2.status]).toEqual([302, 302]);
    const updates = db.prepare("SELECT COUNT(*) FROM price_history WHERE import_id = ? AND kind = 'update'").pluck().get(importId) as number;
    const applyRows = db.prepare("SELECT COUNT(*) FROM import_rows WHERE import_id = ? AND decision = 'apply'").pluck().get(importId) as number;
    expect(updates).toBe(applyRows);
  });

  it('expired trial is read-only: views and exports work, uploads and edits redirect to the plan page', async () => {
    const a = new Agent();
    const { importId, supplierId, orgId } = await setupStoreWithAppliedList(a, 'expired@test.com');
    db.prepare("UPDATE orgs SET trial_ends_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(orgId);
    expect((await a.req(`/app/listas/${importId}`)).status).toBe(200);
    expect((await a.req('/app/productos/exportar')).status).toBe(200);
    const apply = await a.post(`/app/listas/${importId}/aplicar`);
    expect(apply.headers.get('location')).toBe('/app/plan');
    const up = await a.upload(supplierId, tornilloXlsx(hardwareItems(3)));
    expect(up.headers.get('location')).toBe('/app/plan');
    expect(db.prepare('SELECT status FROM imports WHERE id = ?').pluck().get(importId)).toBe('review');
    // Settings and password change still allowed.
    expect((await a.post('/app/cuenta/password', { current_password: 'x', new_password: 'yyyyyyyy' })).headers.get('location')).toBe('/app/cuenta');
  });

  it('paid plan limits are enforced server-side', async () => {
    const a = new Agent();
    await a.signup('limits@test.com');
    const orgId = orgOf('limits@test.com');
    db.prepare("UPDATE orgs SET plan = 'basico', paid_until = '2099-01-01T00:00:00.000Z' WHERE id = ?").run(orgId);
    for (let i = 0; i < 10; i++) expect((await a.post('/app/proveedores', { name: `P${i}` })).status).toBe(302);
    const res = await a.post('/app/proveedores', { name: 'P10' });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('hasta 10 proveedores');
  });
});

describe('team invitations', () => {
  it('owner invites by link, invitee joins the same account, seats are enforced, members cannot manage the team', async () => {
    const owner = new Agent();
    await owner.signup('boss@test.com');
    const res = await owner.post('/app/equipo/invitar', { email: 'Empleado@test.com' });
    const html = await res.text();
    const link = /value="(http:\/\/localhost:3000\/invitacion\?t=[^"]+)"/.exec(html)![1]!;
    const path = link.replace('http://localhost:3000', '').replace(/&amp;/g, '&');
    const emp = new Agent();
    expect(await (await emp.req(path)).text()).toContain('Unite a Comercio');
    const join = await emp.req(path, { method: 'POST', form: { name: 'Empleado', password: 'password123' } });
    expect(join.headers.get('location')).toBe('/app');
    expect(orgOf('empleado@test.com')).toBe(orgOf('boss@test.com'));
    // Link is single use.
    expect((await new Agent().req(path, { method: 'POST', form: { name: 'Otro', password: 'password123' } })).status).toBe(400);
    // Member cannot invite or remove.
    await emp.refreshCsrf();
    expect((await emp.post('/app/equipo/invitar', { email: 'x@test.com' })).status).toBe(403);
    const bossId = db.prepare('SELECT id FROM users WHERE email = ?').pluck().get('boss@test.com') as number;
    expect((await emp.post(`/app/equipo/${bossId}/quitar`)).status).toBe(404);
    // Trial allows 3 users: 2 used + 1 invite OK, the next is refused.
    expect(await (await owner.post('/app/equipo/invitar', { email: 'tres@test.com' })).text()).toContain('Invitación lista');
    expect(await (await owner.post('/app/equipo/invitar', { email: 'cuatro@test.com' })).text()).toContain('hasta 3 usuarios');
    // Owner removes the member → their session stops working.
    const empId = db.prepare('SELECT id FROM users WHERE email = ?').pluck().get('empleado@test.com') as number;
    await owner.post(`/app/equipo/${empId}/quitar`);
    expect((await emp.req('/app')).status).toBe(302);
  });

  it('an owner of another account cannot remove my users', async () => {
    const a = new Agent();
    await a.signup('a-owner@test.com');
    const b = new Agent();
    await b.signup('b-owner@test.com');
    const aId = db.prepare('SELECT id FROM users WHERE email = ?').pluck().get('a-owner@test.com') as number;
    const r = await b.post(`/app/equipo/${aId}/quitar`);
    expect(r.headers.get('location')).toBe('/app/equipo');
    expect(db.prepare('SELECT COUNT(*) FROM users WHERE id = ?').pluck().get(aId)).toBe(1);
  });
});
