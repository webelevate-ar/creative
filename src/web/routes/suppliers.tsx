import { Hono } from 'hono';
import { chrome, formStrings, intParam, orgAccess, requireUser, safeNext, setFlash, takeFlash, zodErrors, type AppEnv, type Ctx } from '../context.js';
import { AppLayout } from '../layout.js';
import { Badge, Csrf, Empty, Field } from '../ui.js';
import { archiveSupplier, createSupplier, getSupplier, LimitError, listSuppliers, savedMapping, supplierFormSchema, updateSupplier, type Supplier } from '../../services/suppliers.js';
import { getImport, listImports, parseStats, recomputeImport } from '../../services/imports.js';
import { formatDate, formatInt } from '../../lib/money.js';
import { effectiveDiscount, parseDiscounts } from '../../lib/pricing.js';
import { track } from '../../lib/events.js';
import { statusBadge } from './dashboard.js';

export const supplierRoutes = new Hono<AppEnv>();

supplierRoutes.get('/', (c) => {
  const user = requireUser(c);
  const suppliers = listSuppliers(c.var.deps.db, user.orgId);
  return c.html(
    <AppLayout
      title="Proveedores"
      section="proveedores"
      chrome={chrome(c)}
      flash={takeFlash(c)}
      actions={
        <a class="btn" href="/app/proveedores/nuevo">
          Nuevo proveedor
        </a>
      }
    >
      {suppliers.length === 0 ? (
        <Empty title="Todavía no cargaste proveedores">
          <p>Cada proveedor guarda sus reglas (bonificaciones, IVA, dólar) y recuerda el formato de su lista.</p>
          <p>
            <a class="btn" href="/app/proveedores/nuevo">
              Crear el primero
            </a>
          </p>
        </Empty>
      ) : (
        <div class="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Bonificación</th>
                <th>Moneda</th>
                <th>IVA en lista</th>
                <th class="r">Productos</th>
                <th>Última lista</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr>
                  <td>
                    <a href={`/app/proveedores/${s.id}`}>{s.name}</a>
                  </td>
                  <td>{s.discounts || <span class="muted">—</span>}</td>
                  <td>{s.currency === 'USD' ? `USD × ${formatInt(s.exchange_rate)}` : 'Pesos'}</td>
                  <td>{s.list_includes_iva ? 'Incluido' : 'Sin IVA'}</td>
                  <td class="r num">{formatInt(s.product_count)}</td>
                  <td>{s.last_list_at ? formatDate(s.last_list_at) : <span class="muted">Nunca</span>}</td>
                  <td class="r">
                    <a href={`/app/listas/nueva?proveedor=${s.id}`}>Subir lista</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>,
  );
});

type FormValues = Record<string, string>;

function valuesFrom(s: Supplier | null): FormValues {
  if (!s) return { name: '', currency: 'ARS', exchange_rate: '', list_includes_iva: '0', iva_rate: '21', discounts: '', surcharge_pct: '0', markup_pct: '', price_mode: '', price_per_pack: '0' };
  return {
    name: s.name,
    currency: s.currency,
    exchange_rate: s.currency === 'USD' ? String(s.exchange_rate).replace('.', ',') : '',
    list_includes_iva: String(s.list_includes_iva),
    iva_rate: String(s.iva_rate),
    discounts: s.discounts,
    surcharge_pct: String(s.surcharge_pct).replace('.', ','),
    markup_pct: s.markup_pct == null ? '' : String(s.markup_pct).replace('.', ','),
    price_mode: s.price_mode ?? '',
    price_per_pack: String(s.price_per_pack),
  };
}

const SupplierForm = (p: { action: string; v: FormValues; errors: Record<string, string>; csrf: string; submit: string; back?: string | undefined }) => {
  const sel = (k: string, val: string) => (p.v[k] === val ? true : undefined);
  const disc = parseDiscounts(p.v.discounts ?? '');
  return (
    <form method="post" action={p.action + (p.back ? `?volver=${encodeURIComponent(p.back)}` : '')} class="card stack">
      <Csrf token={p.csrf} />
      <Field label="Nombre del proveedor" name="name" error={p.errors.name}>
        <input id="name" name="name" required maxlength={100} value={p.v.name} />
      </Field>
      <div class="grid2">
        <Field
          label="Bonificaciones sobre la lista"
          name="discounts"
          error={p.errors.discounts}
          hint={disc && disc.length ? `Equivale a ${(effectiveDiscount(disc) * 100).toFixed(1).replace('.', ',')} % de descuento total.` : 'En cascada, como te las da el proveedor. Ej: 30+10+5'}
        >
          <input id="discounts" name="discounts" maxlength={60} placeholder="30+10" value={p.v.discounts} />
        </Field>
        <Field label="Recargo / flete (%)" name="surcharge_pct" error={p.errors.surcharge_pct} hint="Se suma después de las bonificaciones.">
          <input id="surcharge_pct" name="surcharge_pct" inputmode="decimal" value={p.v.surcharge_pct} />
        </Field>
        <Field label="Los precios de la lista…" name="list_includes_iva">
          <select id="list_includes_iva" name="list_includes_iva">
            <option value="0" selected={sel('list_includes_iva', '0')}>
              No incluyen IVA
            </option>
            <option value="1" selected={sel('list_includes_iva', '1')}>
              Incluyen IVA
            </option>
          </select>
        </Field>
        <Field label="Alícuota de IVA" name="iva_rate">
          <select id="iva_rate" name="iva_rate">
            {['21', '10.5', '27', '0'].map((r) => (
              <option value={r} selected={sel('iva_rate', r)}>
                {r.replace('.', ',')} %
              </option>
            ))}
          </select>
        </Field>
        <Field label="Moneda de la lista" name="currency">
          <select id="currency" name="currency">
            <option value="ARS" selected={sel('currency', 'ARS')}>
              Pesos
            </option>
            <option value="USD" selected={sel('currency', 'USD')}>
              Dólares
            </option>
          </select>
        </Field>
        <Field label="Cotización del dólar (si la lista está en USD)" name="exchange_rate" error={p.errors.exchange_rate} hint="La que te toma el proveedor. Ej: 1540">
          <input id="exchange_rate" name="exchange_rate" inputmode="decimal" value={p.v.exchange_rate} />
        </Field>
        <Field label="Margen para este proveedor (%)" name="markup_pct" error={p.errors.markup_pct} hint="Vacío = usar el margen general de Ajustes.">
          <input id="markup_pct" name="markup_pct" inputmode="decimal" value={p.v.markup_pct} />
        </Field>
        <Field label="Cuando cambia el costo" name="price_mode">
          <select id="price_mode" name="price_mode">
            <option value="" selected={sel('price_mode', '')}>
              Como en Ajustes
            </option>
            <option value="keep_margin" selected={sel('price_mode', 'keep_margin')}>
              Mantener el margen actual de cada producto
            </option>
            <option value="markup" selected={sel('price_mode', 'markup')}>
              Recalcular con el margen de este proveedor
            </option>
          </select>
        </Field>
        <Field label="¿El precio es por bulto/caja?" name="price_per_pack" hint="Si elegís Sí, se divide por la columna de unidades por bulto de la lista.">
          <select id="price_per_pack" name="price_per_pack">
            <option value="0" selected={sel('price_per_pack', '0')}>
              No, es por unidad
            </option>
            <option value="1" selected={sel('price_per_pack', '1')}>
              Sí, dividir por unidades del bulto
            </option>
          </select>
        </Field>
      </div>
      <div class="row">
        <button class="btn" type="submit">
          {p.submit}
        </button>
        {p.back ? <a href={p.back}>Cancelar</a> : null}
      </div>
    </form>
  );
};

supplierRoutes.get('/nuevo', (c) => {
  const user = requireUser(c);
  return c.html(
    <AppLayout title="Nuevo proveedor" section="proveedores" chrome={chrome(c)} flash={takeFlash(c)}>
      <SupplierForm action="/app/proveedores" v={valuesFrom(null)} errors={{}} csrf={user.csrf} submit="Crear proveedor" />
    </AppLayout>,
  );
});

supplierRoutes.post('/', async (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const form = formStrings(await c.req.parseBody());
  const render = (errors: Record<string, string>, status: 400 | 402) =>
    c.html(
      <AppLayout title="Nuevo proveedor" section="proveedores" chrome={chrome(c)}>
        <SupplierForm action="/app/proveedores" v={{ ...valuesFrom(null), ...form }} errors={errors} csrf={user.csrf} submit="Crear proveedor" />
      </AppLayout>,
      status,
    );
  const parsed = supplierFormSchema.safeParse(form);
  if (!parsed.success) return render(zodErrors(parsed.error.issues), 400);
  try {
    const id = createSupplier(db, user.orgId, parsed.data, orgAccess(c).plan.suppliers);
    track(db, 'supplier_created', user.orgId, user.userId);
    setFlash(c, { kind: 'ok', text: `Proveedor "${parsed.data.name}" creado. Ahora subí su última lista.` });
    return c.redirect(`/app/listas/nueva?proveedor=${id}`);
  } catch (err) {
    if (err instanceof LimitError) return render({ name: err.message }, 400);
    throw err;
  }
});

function loadSupplier(c: Ctx): Supplier | null {
  const id = intParam(c.req.param('id'));
  if (!id) return null;
  const s = getSupplier(c.var.deps.db, requireUser(c).orgId, id);
  return s && !s.archived ? s : null;
}

supplierRoutes.get('/:id', (c) => {
  const user = requireUser(c);
  const s = loadSupplier(c);
  if (!s) return c.notFound();
  const back = c.req.query('volver') ? safeNext(c.req.query('volver')) : undefined;
  const imports = listImports(c.var.deps.db, user.orgId, { supplierId: s.id, limit: 20 });
  const mapping = savedMapping(s);
  return c.html(
    <AppLayout
      title={s.name}
      section="proveedores"
      chrome={chrome(c)}
      flash={takeFlash(c)}
      actions={
        <a class="btn" href={`/app/listas/nueva?proveedor=${s.id}`}>
          Subir lista
        </a>
      }
    >
      {back ? <p class="muted">Al guardar se recalcula la lista que estabas revisando.</p> : null}
      <SupplierForm action={`/app/proveedores/${s.id}`} v={valuesFrom(s)} errors={{}} csrf={user.csrf} submit="Guardar cambios" back={back} />
      <section class="card">
        <h2>Formato de su lista</h2>
        {mapping ? (
          <p>
            Remarcá recuerda las columnas de este proveedor
            {mapping.headerTexts.code ? (
              <>
                {' '}
                (código: <code>{mapping.headerTexts.code}</code>, precio: <code>{mapping.headerTexts.price}</code>)
              </>
            ) : null}
            . La próxima lista se lee sola.
          </p>
        ) : (
          <p class="muted">Todavía no subiste ninguna lista de este proveedor.</p>
        )}
      </section>
      <section class="card">
        <h2>Listas de este proveedor</h2>
        {imports.length === 0 ? (
          <p class="muted">Sin listas todavía.</p>
        ) : (
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Archivo</th>
                  <th>Estado</th>
                  <th class="r">Variación mediana</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((i) => {
                  const st = parseStats(i.stats_json);
                  return (
                    <tr>
                      <td>{formatDate(i.created_at)}</td>
                      <td>
                        <a href={`/app/listas/${i.id}`}>{i.file_name}</a>
                      </td>
                      <td>{statusBadge(i.status)}</td>
                      <td class="r num">{st.medianChange == null ? '—' : `${(st.medianChange * 100).toFixed(1).replace('.', ',')} %`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section class="card danger-zone">
        <h2>Archivar proveedor</h2>
        <p class="muted">Deja de aparecer en tus listas. Sus productos y su historial se conservan.</p>
        <form method="post" action={`/app/proveedores/${s.id}/archivar`} data-confirm={`¿Archivar ${s.name}?`}>
          <Csrf token={user.csrf} />
          <button type="submit" class="btn btn--danger">
            Archivar
          </button>
        </form>
      </section>
      {s.archived ? <Badge>Archivado</Badge> : null}
    </AppLayout>,
  );
});

supplierRoutes.post('/:id', async (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const s = loadSupplier(c);
  if (!s) return c.notFound();
  const back = c.req.query('volver') ? safeNext(c.req.query('volver')) : undefined;
  const form = formStrings(await c.req.parseBody());
  const parsed = supplierFormSchema.safeParse(form);
  const render = (errors: Record<string, string>) =>
    c.html(
      <AppLayout title={s.name} section="proveedores" chrome={chrome(c)}>
        <SupplierForm action={`/app/proveedores/${s.id}`} v={{ ...valuesFrom(s), ...form }} errors={errors} csrf={user.csrf} submit="Guardar cambios" back={back} />
      </AppLayout>,
      400,
    );
  if (!parsed.success) return render(zodErrors(parsed.error.issues));
  try {
    updateSupplier(db, user.orgId, s.id, parsed.data);
  } catch (err) {
    if (err instanceof LimitError) return render({ name: err.message });
    throw err;
  }
  const m = back?.match(/^\/app\/listas\/(\d+)/);
  if (m) {
    const imp = getImport(db, user.orgId, Number(m[1]));
    if (imp && imp.status === 'review' && imp.supplier_id === s.id) recomputeImport(db, user.orgId, imp.id);
    setFlash(c, { kind: 'ok', text: 'Reglas guardadas y lista recalculada.' });
    return c.redirect(`/app/listas/${m[1]}`);
  }
  setFlash(c, { kind: 'ok', text: 'Proveedor actualizado.' });
  return c.redirect(`/app/proveedores/${s.id}`);
});

supplierRoutes.post('/:id/archivar', (c) => {
  const user = requireUser(c);
  const s = loadSupplier(c);
  if (!s) return c.notFound();
  archiveSupplier(c.var.deps.db, user.orgId, s.id);
  setFlash(c, { kind: 'ok', text: `${s.name} fue archivado.` });
  return c.redirect('/app/proveedores');
});
