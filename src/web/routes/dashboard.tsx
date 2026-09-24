import { Hono } from 'hono';
import { z } from 'zod';
import { chrome, formStrings, orgAccess, requireUser, setFlash, takeFlash, type AppEnv } from '../context.js';
import { AppLayout } from '../layout.js';
import { Badge, Csrf, Empty, Field, Stat } from '../ui.js';
import { listSuppliers } from '../../services/suppliers.js';
import { countProducts } from '../../services/products.js';
import { listImports, parseStats } from '../../services/imports.js';
import { EXPORT_COLUMNS, getSettings, orgSettingsSchema, saveSettings, type ExportColumn } from '../../services/settings.js';
import { daysSince, formatDate, formatInt } from '../../lib/money.js';
import { PLANS } from '../../lib/plans.js';
import { track } from '../../lib/events.js';
import { parseNumber } from '../../lib/numbers.js';
import { DEMO_SUPPLIER, seedDemo } from '../../services/demo.js';
import { hardwareItems, nextVersion, tornilloXlsx } from '../../services/sample-data.js';

export const dashboardRoutes = new Hono<AppEnv>();

const STATUS_LABEL: Record<string, string> = { uploaded: 'Falta mapear', review: 'En revisión', applied: 'Aplicada', reverted: 'Deshecha', discarded: 'Descartada' };
export const statusBadge = (s: string) => (
  <Badge tone={s === 'applied' ? 'ok' : s === 'review' || s === 'uploaded' ? 'warn' : 'neutral'}>{STATUS_LABEL[s] ?? s}</Badge>
);

dashboardRoutes.get('/', (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const settings = getSettings(db, user.orgId);
  const suppliers = listSuppliers(db, user.orgId);
  const products = countProducts(db, user.orgId);
  const imports = listImports(db, user.orgId, { limit: 6 });
  const applied = db.prepare("SELECT COUNT(*) FROM imports WHERE org_id = ? AND status = 'applied'").pluck().get(user.orgId) as number;
  const belowCost = db
    .prepare('SELECT COUNT(*) FROM products WHERE org_id = ? AND cost_cents IS NOT NULL AND price_cents IS NOT NULL AND price_cents < cost_cents')
    .pluck()
    .get(user.orgId) as number;
  const pending = imports.filter((i) => i.status === 'review' || i.status === 'uploaded');
  const onboarding = applied === 0;
  const hasDemo = suppliers.some((s) => s.name === DEMO_SUPPLIER);
  const settingsDone = db.prepare("SELECT 1 FROM events WHERE org_id = ? AND name = 'settings_saved' LIMIT 1").get(user.orgId) != null;

  return c.html(
    <AppLayout
      title="Inicio"
      section="home"
      chrome={chrome(c)}
      flash={takeFlash(c)}
      actions={
        <a class="btn" href="/app/listas/nueva">
          Subir lista de proveedor
        </a>
      }
    >
      {onboarding ? (
        <section class="card onboarding">
          <h2>Primeros pasos</h2>
          <ol class="steps">
            <li class={settingsDone ? 'done' : ''}>
              <strong>Contanos cómo calculás tus precios</strong> — si sos responsable inscripto o monotributista, tu margen y redondeo. <a href="/app/ajustes">Ajustes</a>
            </li>
            <li class={products > 0 ? 'done' : ''}>
              <strong>Cargá tus productos</strong> — exportá la lista de tu sistema (Excel o CSV) y subila. <a href="/app/productos/importar">Importar productos</a>
            </li>
            <li class={suppliers.length > 0 ? 'done' : ''}>
              <strong>Creá tus proveedores</strong> con sus bonificaciones (ej: 30+10), IVA y si la lista viene en dólares. <a href="/app/proveedores/nuevo">Nuevo proveedor</a>
            </li>
            <li>
              <strong>Subí la última lista de un proveedor</strong> y revisá qué cambió antes de aplicar. <a href="/app/listas/nueva">Subir lista</a>
            </li>
          </ol>
          <div class="demo-box">
            <p>
              <strong>¿Querés verlo andar antes de cargar tus datos?</strong> Cargamos un proveedor y 300 productos de ejemplo; después subís la "lista nueva" de ejemplo y ves los cambios.
            </p>
            {hasDemo ? (
              <p>
                <a class="btn btn--secondary" href="/app/ejemplo/lista-nueva.xlsx">
                  1. Descargar lista nueva de ejemplo
                </a>{' '}
                <a class="btn" href="/app/listas/nueva">
                  2. Subirla
                </a>
              </p>
            ) : (
              <form method="post" action="/app/ejemplo">
                <Csrf token={user.csrf} />
                <button class="btn btn--secondary" type="submit">
                  Cargar datos de ejemplo
                </button>
              </form>
            )}
          </div>
        </section>
      ) : null}

      <section class="stats">
        <Stat label="productos" value={formatInt(products)} href="/app/productos" />
        <Stat label="proveedores" value={formatInt(suppliers.length)} href="/app/proveedores" />
        <Stat label="listas aplicadas" value={formatInt(applied)} href="/app/listas" />
        <Stat label="productos vendidos debajo del costo" value={formatInt(belowCost)} tone={belowCost > 0 ? 'bad' : undefined} href="/app/productos?filtro=below_cost" />
      </section>

      {pending.length ? (
        <section class="card">
          <h2>Listas pendientes de revisar</h2>
          <ul class="plain">
            {pending.map((i) => (
              <li>
                <a href={`/app/listas/${i.id}`}>{i.supplier_name}</a> · {i.file_name} · {statusBadge(i.status)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section class="card">
        <div class="card__head">
          <h2>Proveedores</h2>
          <a href="/app/proveedores/nuevo">+ Nuevo proveedor</a>
        </div>
        {suppliers.length === 0 ? (
          <Empty title="Todavía no tenés proveedores">
            <p>Creá uno por cada distribuidora o fábrica que te manda listas de precios.</p>
          </Empty>
        ) : (
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Última lista aplicada</th>
                  <th class="r">Productos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => {
                  const days = daysSince(s.last_list_at);
                  return (
                    <tr>
                      <td>
                        <a href={`/app/proveedores/${s.id}`}>{s.name}</a>
                      </td>
                      <td>
                        {s.last_list_at ? formatDate(s.last_list_at) : <span class="muted">Nunca</span>}{' '}
                        {days != null && days > settings.staleDays ? <Badge tone="warn">hace {days} días</Badge> : null}
                      </td>
                      <td class="r num">{formatInt(s.product_count)}</td>
                      <td class="r">
                        <a href={`/app/listas/nueva?proveedor=${s.id}`}>Subir lista</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {imports.length ? (
        <section class="card">
          <div class="card__head">
            <h2>Últimas listas</h2>
            <a href="/app/listas">Ver todas</a>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Archivo</th>
                  <th>Estado</th>
                  <th class="r">Cambios</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((i) => {
                  const st = parseStats(i.stats_json);
                  return (
                    <tr>
                      <td>{formatDate(i.created_at)}</td>
                      <td>{i.supplier_name}</td>
                      <td>
                        <a href={`/app/listas/${i.id}`}>{i.file_name}</a>
                      </td>
                      <td>{statusBadge(i.status)}</td>
                      <td class="r num">{st.applied ? `${st.applied.updated + st.applied.created} aplicados` : `${st.changed} con cambios`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </AppLayout>,
  );
});

dashboardRoutes.post('/ejemplo', (c) => {
  const user = requireUser(c);
  const r = seedDemo(c.var.deps.db, user.orgId);
  setFlash(c, { kind: 'ok', text: r.products ? `Cargamos ${r.products} productos de ejemplo. Ahora descargá la lista nueva de ejemplo y subila.` : 'Los datos de ejemplo ya estaban cargados.' });
  return c.redirect('/app');
});

dashboardRoutes.get('/ejemplo/lista-nueva.xlsx', (c) => {
  const buf = tornilloXlsx(nextVersion(hardwareItems(300)), 'Lista N° 46 - Vigencia 01/10/2026');
  c.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  c.header('Content-Disposition', 'attachment; filename="ejemplo-lista-el-tornillo.xlsx"');
  return c.body(new Uint8Array(buf));
});

// ---------------------------------------------------------------------------------------------
// Plan & account

dashboardRoutes.get('/plan', (c) => {
  const user = requireUser(c);
  const a = orgAccess(c);
  const { config } = c.var.deps;
  const wa = config.contactWhatsapp
    ? `https://wa.me/${config.contactWhatsapp}?text=${encodeURIComponent(`Hola, quiero activar Remarcá para ${a.org.name} (${user.email}).`)}`
    : null;
  return c.html(
    <AppLayout title="Plan" section="" chrome={chrome(c)} flash={takeFlash(c)}>
      <section class="card">
        <p>
          Plan actual: <strong>{a.plan.name}</strong>
          {a.plan.id === 'trial'
            ? a.active
              ? ` · te quedan ${a.daysLeft} días de prueba`
              : ' · la prueba terminó'
            : a.active
              ? ` · activo hasta ${formatDate(a.org.paid_until)}`
              : ' · vencido'}
        </p>
      </section>
      <section class="plans">
        {(['basico', 'comercio', 'distribuidora'] as const).map((id) => {
          const p = PLANS[id];
          return (
            <div class={`card plan${id === 'comercio' ? ' plan--featured' : ''}`}>
              <h2>{p.name}</h2>
              <p class="plan__price">
                $ {formatInt(p.monthlyArs)} <span>/ mes</span>
              </p>
              <ul class="plain">
                <li>Hasta {formatInt(p.suppliers)} proveedores</li>
                <li>Hasta {formatInt(p.products)} productos</li>
                <li>
                  {p.users} usuario{p.users > 1 ? 's' : ''}
                </li>
              </ul>
            </div>
          );
        })}
      </section>
      <section class="card">
        <h2>Cómo activar</h2>
        <p>
          Por ahora la activación es personal: te pasamos un link de pago de Mercado Pago o los datos para transferir, y activamos el plan en el día. Pagando el año
          completo tenés 2 meses sin cargo y la puesta en marcha asistida incluida.
        </p>
        <p>
          {wa ? (
            <a class="btn" href={wa} rel="noopener noreferrer" target="_blank">
              Escribinos por WhatsApp
            </a>
          ) : null}{' '}
          <a class="btn btn--secondary" href={`mailto:${config.contactEmail}?subject=${encodeURIComponent('Activar Remarcá')}`}>
            Escribinos por email
          </a>
        </p>
      </section>
    </AppLayout>,
  );
});

dashboardRoutes.get('/cuenta', (c) => {
  const user = requireUser(c);
  return c.html(
    <AppLayout title="Tu cuenta" section="" chrome={chrome(c)} flash={takeFlash(c)}>
      <section class="card narrow-left">
        <p>
          <strong>{user.name}</strong> · {user.email}
        </p>
        <h2>Cambiar contraseña</h2>
        <form method="post" action="/app/cuenta/password" class="stack">
          <Csrf token={user.csrf} />
          <Field label="Contraseña actual" name="current_password">
            <input id="current_password" name="current_password" type="password" autocomplete="current-password" required maxlength={200} />
          </Field>
          <Field label="Contraseña nueva" name="new_password" hint="Mínimo 8 caracteres.">
            <input id="new_password" name="new_password" type="password" autocomplete="new-password" required minlength={8} maxlength={200} />
          </Field>
          <button class="btn" type="submit">
            Cambiar contraseña
          </button>
        </form>
      </section>
    </AppLayout>,
  );
});

// ---------------------------------------------------------------------------------------------
// Settings

const settingsForm = z.object({
  org_name: z.string().trim().min(2, 'Ingresá el nombre del comercio.').max(100),
  costBasis: z.enum(['net', 'gross']),
  salePriceWithIva: z.enum(['0', '1']),
  priceMode: z.enum(['keep_margin', 'markup']),
  defaultMarkupPct: z.string().trim().transform((v) => parseNumber(v, ',') ?? Number.NaN).refine((v) => Number.isFinite(v) && v >= 0 && v <= 1000, 'El margen debe estar entre 0 y 1000 %.'),
  roundTo: z.enum(['0', '1', '5', '10', '50', '100', '500', '1000']),
  bigChangePct: z.string().trim().transform((v) => parseNumber(v, ',') ?? Number.NaN).refine((v) => Number.isFinite(v) && v >= 1 && v <= 500, 'Entre 1 y 500 %.'),
  staleDays: z.string().trim().transform((v) => Number(v)).refine((v) => Number.isInteger(v) && v >= 1 && v <= 365, 'Entre 1 y 365 días.'),
  exportFormat: z.enum(['csv', 'xlsx']),
  exportDelimiter: z.enum([';', ',', 'tab']),
  exportDecimal: z.enum([',', '.']),
  exportEncoding: z.enum(['utf8bom', 'latin1']),
  exportColumns: z.string().trim().max(200),
});

const COLUMN_KEYS = Object.keys(EXPORT_COLUMNS) as ExportColumn[];

function SettingsPage(p: { c: Parameters<typeof chrome>[0]; errors?: Record<string, string> }) {
  const user = requireUser(p.c);
  const { db } = p.c.var.deps;
  const s = getSettings(db, user.orgId);
  const orgName = db.prepare('SELECT name FROM orgs WHERE id = ?').pluck().get(user.orgId) as string;
  const e = p.errors ?? {};
  const sel = (a: string | number | boolean, b: string | number | boolean) => (String(a) === String(b) ? true : undefined);
  return (
    <AppLayout title="Ajustes" section="ajustes" chrome={chrome(p.c)} flash={takeFlash(p.c)}>
      <form method="post" action="/app/ajustes" class="card stack settings">
        <Csrf token={user.csrf} />
        <h2>Tu comercio</h2>
        <Field label="Nombre" name="org_name" error={e.org_name}>
          <input id="org_name" name="org_name" required maxlength={100} value={orgName} />
        </Field>
        <h2>Cómo calculás los precios</h2>
        <Field label="Condición frente al IVA" name="costBasis" hint="Define si tus costos se guardan sin IVA (lo recuperás) o con IVA (es parte de tu costo).">
          <select id="costBasis" name="costBasis">
            <option value="net" selected={sel(s.costBasis, 'net')}>
              Responsable inscripto — costos sin IVA
            </option>
            <option value="gross" selected={sel(s.costBasis, 'gross')}>
              Monotributista / exento — costos con IVA
            </option>
          </select>
        </Field>
        <Field label="Tus precios de venta" name="salePriceWithIva" hint="Solo aplica a responsables inscriptos.">
          <select id="salePriceWithIva" name="salePriceWithIva">
            <option value="1" selected={sel(s.salePriceWithIva, true)}>
              Incluyen IVA (precio al público)
            </option>
            <option value="0" selected={sel(s.salePriceWithIva, false)}>
              Sin IVA
            </option>
          </select>
        </Field>
        <Field label="Cuando cambia el costo" name="priceMode">
          <select id="priceMode" name="priceMode">
            <option value="keep_margin" selected={sel(s.priceMode, 'keep_margin')}>
              Mantener el margen actual de cada producto (recomendado)
            </option>
            <option value="markup" selected={sel(s.priceMode, 'markup')}>
              Recalcular con el margen del proveedor / general
            </option>
          </select>
        </Field>
        <Field label="Margen general (%)" name="defaultMarkupPct" error={e.defaultMarkupPct} hint="Se usa para productos nuevos o cuando elegís recalcular. Cada proveedor o producto puede tener el suyo.">
          <input id="defaultMarkupPct" name="defaultMarkupPct" inputmode="decimal" value={String(s.defaultMarkupPct).replace('.', ',')} />
        </Field>
        <Field label="Redondear precios de venta hacia arriba a" name="roundTo">
          <select id="roundTo" name="roundTo">
            {[0, 1, 5, 10, 50, 100, 500, 1000].map((v) => (
              <option value={String(v)} selected={sel(s.roundTo, v)}>
                {v === 0 ? 'No redondear (centavos)' : `Múltiplos de $ ${formatInt(v)}`}
              </option>
            ))}
          </select>
        </Field>
        <h2>Alertas</h2>
        <Field label="Marcar como cambio grande si el costo varía más de (%)" name="bigChangePct" error={e.bigChangePct}>
          <input id="bigChangePct" name="bigChangePct" inputmode="decimal" value={String(s.bigChangePct)} />
        </Field>
        <Field label="Avisar si un proveedor no actualiza su lista en (días)" name="staleDays" error={e.staleDays}>
          <input id="staleDays" name="staleDays" inputmode="numeric" value={String(s.staleDays)} />
        </Field>
        <h2>Archivo para tu sistema</h2>
        <p class="muted">Configurá el archivo que descargás para importar en tu sistema de gestión, tienda online o planilla.</p>
        <div class="grid2">
          <Field label="Formato" name="exportFormat">
            <select id="exportFormat" name="exportFormat">
              <option value="csv" selected={sel(s.exportFormat, 'csv')}>
                CSV
              </option>
              <option value="xlsx" selected={sel(s.exportFormat, 'xlsx')}>
                Excel (.xlsx)
              </option>
            </select>
          </Field>
          <Field label="Separador (CSV)" name="exportDelimiter">
            <select id="exportDelimiter" name="exportDelimiter">
              <option value=";" selected={sel(s.exportDelimiter, ';')}>
                Punto y coma ( ; )
              </option>
              <option value="," selected={sel(s.exportDelimiter, ',')}>
                Coma ( , )
              </option>
              <option value="tab" selected={sel(s.exportDelimiter, 'tab')}>
                Tabulación
              </option>
            </select>
          </Field>
          <Field label="Decimales (CSV)" name="exportDecimal">
            <select id="exportDecimal" name="exportDecimal">
              <option value="," selected={sel(s.exportDecimal, ',')}>
                Coma: 1234,56
              </option>
              <option value="." selected={sel(s.exportDecimal, '.')}>
                Punto: 1234.56
              </option>
            </select>
          </Field>
          <Field label="Codificación (CSV)" name="exportEncoding" hint="Si ves caracteres raros (Ã±) en tu sistema, probá Windows.">
            <select id="exportEncoding" name="exportEncoding">
              <option value="utf8bom" selected={sel(s.exportEncoding, 'utf8bom')}>
                UTF-8 (recomendado)
              </option>
              <option value="latin1" selected={sel(s.exportEncoding, 'latin1')}>
                Windows / ANSI
              </option>
            </select>
          </Field>
        </div>
        <fieldset class="field">
          <legend>Columnas, en este orden</legend>
          <p class="field__hint">Escribí los números separados por coma. Disponibles: {COLUMN_KEYS.map((k, i) => `${i + 1}=${EXPORT_COLUMNS[k]}`).join(' · ')}</p>
          <input
            id="exportColumns"
            name="exportColumns"
            aria-label="Columnas del archivo"
            value={s.exportColumns.map((k) => COLUMN_KEYS.indexOf(k) + 1).join(',')}
            aria-invalid={e.exportColumns ? 'true' : undefined}
          />
          {e.exportColumns ? <p class="field__error">{e.exportColumns}</p> : null}
        </fieldset>
        <button class="btn" type="submit">
          Guardar ajustes
        </button>
      </form>
    </AppLayout>
  );
}

dashboardRoutes.get('/ajustes', (c) => c.html(<SettingsPage c={c} />));

dashboardRoutes.post('/ajustes', async (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const parsed = settingsForm.safeParse(formStrings(await c.req.parseBody()));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0])] ??= i.message;
    return c.html(<SettingsPage c={c} errors={errors} />, 400);
  }
  const v = parsed.data;
  const cols = v.exportColumns
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((n) => COLUMN_KEYS[Number(n) - 1]);
  if (!cols.length || cols.some((k) => !k) || cols.length > 12) return c.html(<SettingsPage c={c} errors={{ exportColumns: 'Usá números del 1 al 9 separados por coma, ej: 1,2,6,8' }} />, 400);
  const current = getSettings(db, user.orgId);
  saveSettings(
    db,
    user.orgId,
    orgSettingsSchema.parse({
      ...current,
      costBasis: v.costBasis,
      salePriceWithIva: v.salePriceWithIva === '1',
      priceMode: v.priceMode,
      defaultMarkupPct: v.defaultMarkupPct,
      roundTo: Number(v.roundTo),
      bigChangePct: v.bigChangePct,
      staleDays: v.staleDays,
      exportFormat: v.exportFormat,
      exportDelimiter: v.exportDelimiter,
      exportDecimal: v.exportDecimal,
      exportEncoding: v.exportEncoding,
      exportColumns: cols as ExportColumn[],
    }),
  );
  db.prepare('UPDATE orgs SET name = ? WHERE id = ?').run(v.org_name, user.orgId);
  track(db, 'settings_saved', user.orgId, user.userId);
  setFlash(c, { kind: 'ok', text: 'Ajustes guardados. Las listas en revisión se recalculan al abrirlas con "Recalcular".' });
  return c.redirect('/app/ajustes');
});
