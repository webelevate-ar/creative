import { Hono } from 'hono';
import { chrome, formStrings, intParam, orgAccess, requireUser, setFlash, takeFlash, zodErrors, type AppEnv } from '../context.js';
import { AppLayout } from '../layout.js';
import { Alert, Change, Csrf, Empty, Field, Money, Pagination } from '../ui.js';
import {
  CATALOG_ROLES,
  CATALOG_ROLE_LABELS,
  deleteProduct,
  detectCatalogColumns,
  getProduct,
  importCatalog,
  listProducts,
  ProductError,
  productFormSchema,
  productHistory,
  saveProduct,
  type CatalogMapping,
  type ProductFilter,
} from '../../services/products.js';
import { listSuppliers } from '../../services/suppliers.js';
import { buildExport, catalogRows, exportFileName } from '../../services/exports.js';
import { getSettings } from '../../services/settings.js';
import { changeRatio, formatDate, formatDateTime, formatInt } from '../../lib/money.js';
import { FileFormatError, type Cell } from '../../lib/sheet.js';
import { parseFile } from '../../lib/parse.js';
import { track } from '../../lib/events.js';
import { ImportError } from '../../services/imports.js';

export const productRoutes = new Hono<AppEnv>();

const FILTERS: { key: ProductFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'below_cost', label: 'Precio debajo del costo' },
  { key: 'no_supplier', label: 'Sin proveedor' },
  { key: 'no_cost', label: 'Sin costo' },
];

productRoutes.get('/', (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const q = (c.req.query('q') ?? '').slice(0, 100);
  const filterRaw = c.req.query('filtro') ?? 'all';
  const filter = (FILTERS.find((f) => f.key === filterRaw)?.key ?? 'all') as ProductFilter;
  const supplierId = intParam(c.req.query('proveedor'));
  const page = intParam(c.req.query('page')) ?? 1;
  const res = listProducts(db, user.orgId, { q, filter, supplierId, page, pageSize: 50 });
  const suppliers = listSuppliers(db, user.orgId);
  const params = { q, filtro: filter === 'all' ? '' : filter, proveedor: supplierId ?? '' };
  return c.html(
    <AppLayout
      title="Productos"
      section="productos"
      chrome={chrome(c)}
      flash={takeFlash(c)}
      actions={
        <>
          <a class="btn btn--secondary" href="/app/productos/importar">
            Importar desde Excel/CSV
          </a>{' '}
          <a class="btn btn--secondary" href="/app/productos/exportar">
            Exportar
          </a>{' '}
          <a class="btn" href="/app/productos/nuevo">
            Nuevo
          </a>
        </>
      }
    >
      <form method="get" action="/app/productos" class="filters card">
        <Field label="Buscar" name="q">
          <input id="q" name="q" type="search" value={q} placeholder="Código o descripción" />
        </Field>
        <Field label="Proveedor" name="proveedor">
          <select id="proveedor" name="proveedor">
            <option value="">Todos</option>
            {suppliers.map((s) => (
              <option value={String(s.id)} selected={s.id === supplierId ? true : undefined}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mostrar" name="filtro">
          <select id="filtro" name="filtro">
            {FILTERS.map((f) => (
              <option value={f.key} selected={f.key === filter ? true : undefined}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <button class="btn btn--secondary" type="submit">
          Filtrar
        </button>
      </form>
      {res.total === 0 ? (
        <Empty title={q || filter !== 'all' || supplierId ? 'No hay productos con ese filtro' : 'Todavía no cargaste productos'}>
          {q || filter !== 'all' || supplierId ? null : (
            <p>
              Importá la lista de productos de tu sistema (Excel o CSV) o creálos a partir de la lista de un proveedor. <a href="/app/productos/importar">Importar productos</a>
            </p>
          )}
        </Empty>
      ) : (
        <div class="card">
          <p class="muted">{formatInt(res.total)} productos</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Proveedor</th>
                  <th class="r">Costo</th>
                  <th class="r">Precio</th>
                  <th>Costo actualizado</th>
                </tr>
              </thead>
              <tbody>
                {res.rows.map((p) => (
                  <tr class={p.cost_cents != null && p.price_cents != null && p.price_cents < p.cost_cents ? 'row--bad' : ''}>
                    <td>
                      <a href={`/app/productos/${p.id}`}>{p.code}</a>
                    </td>
                    <td>{p.description}</td>
                    <td>{p.supplier_name ?? <span class="muted">—</span>}</td>
                    <td class="r">
                      <Money cents={p.cost_cents} />
                    </td>
                    <td class="r">
                      <Money cents={p.price_cents} />
                    </td>
                    <td>{formatDate(p.cost_updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination base="/app/productos" params={params} page={res.page} pageSize={res.pageSize} total={res.total} />
        </div>
      )}
    </AppLayout>,
  );
});

type PV = Record<string, string>;
const ProductForm = (p: { action: string; v: PV; errors: Record<string, string>; csrf: string; suppliers: { id: number; name: string }[]; submit: string }) => (
  <form method="post" action={p.action} class="card stack">
    <Csrf token={p.csrf} />
    <div class="grid2">
      <Field label="Código (el tuyo)" name="code" error={p.errors.code}>
        <input id="code" name="code" required maxlength={60} value={p.v.code ?? ''} />
      </Field>
      <Field label="Descripción" name="description" error={p.errors.description}>
        <input id="description" name="description" maxlength={300} value={p.v.description ?? ''} />
      </Field>
      <Field label="Proveedor" name="supplier_id" error={p.errors.supplier_id}>
        <select id="supplier_id" name="supplier_id">
          <option value="">Sin proveedor</option>
          {p.suppliers.map((s) => (
            <option value={String(s.id)} selected={String(s.id) === p.v.supplier_id ? true : undefined}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Código del proveedor" name="supplier_code" error={p.errors.supplier_code} hint="El que figura en la lista del proveedor.">
        <input id="supplier_code" name="supplier_code" maxlength={60} value={p.v.supplier_code ?? ''} />
      </Field>
      <Field label="Costo ($)" name="cost" error={p.errors.cost}>
        <input id="cost" name="cost" inputmode="decimal" value={p.v.cost ?? ''} placeholder="1.234,56" />
      </Field>
      <Field label="Precio de venta ($)" name="price" error={p.errors.price}>
        <input id="price" name="price" inputmode="decimal" value={p.v.price ?? ''} placeholder="1.999,00" />
      </Field>
      <Field label="Margen propio (%)" name="markup_pct" error={p.errors.markup_pct} hint="Vacío = el del proveedor o el general.">
        <input id="markup_pct" name="markup_pct" inputmode="decimal" value={p.v.markup_pct ?? ''} />
      </Field>
      <Field label="IVA propio" name="iva_rate" hint="Vacío = el del proveedor.">
        <select id="iva_rate" name="iva_rate">
          {['', '21', '10.5', '27', '0'].map((r) => (
            <option value={r} selected={r === (p.v.iva_rate ?? '') ? true : undefined}>
              {r === '' ? 'Como el proveedor' : `${r.replace('.', ',')} %`}
            </option>
          ))}
        </select>
      </Field>
    </div>
    <button class="btn" type="submit">
      {p.submit}
    </button>
  </form>
);

const centsToInput = (c: number | null) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));

productRoutes.get('/nuevo', (c) => {
  const user = requireUser(c);
  return c.html(
    <AppLayout title="Nuevo producto" section="productos" chrome={chrome(c)}>
      <ProductForm action="/app/productos" v={{}} errors={{}} csrf={user.csrf} suppliers={listSuppliers(c.var.deps.db, user.orgId)} submit="Crear producto" />
    </AppLayout>,
  );
});

productRoutes.post('/', async (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const form = formStrings(await c.req.parseBody());
  const render = (errors: Record<string, string>) =>
    c.html(
      <AppLayout title="Nuevo producto" section="productos" chrome={chrome(c)}>
        <ProductForm action="/app/productos" v={form} errors={errors} csrf={user.csrf} suppliers={listSuppliers(db, user.orgId)} submit="Crear producto" />
      </AppLayout>,
      400,
    );
  const parsed = productFormSchema.safeParse(form);
  if (!parsed.success) return render(zodErrors(parsed.error.issues));
  try {
    const id = saveProduct(db, user.orgId, null, parsed.data, orgAccess(c).plan.products);
    setFlash(c, { kind: 'ok', text: 'Producto creado.' });
    return c.redirect(`/app/productos/${id}`);
  } catch (err) {
    if (err instanceof ProductError) return render({ code: err.message });
    throw err;
  }
});

// ---------------------------------------------------------------------------------------------
// Catalog import & export (declared before /:id so they are not captured by it)

productRoutes.get('/exportar', (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const settings = getSettings(db, user.orgId);
  const file = buildExport(catalogRows(db, user.orgId), settings, ['code', 'description', 'supplier', 'supplier_code', 'cost', 'price']);
  track(db, 'export_downloaded', user.orgId, user.userId, { kind: 'catalog' });
  c.header('Content-Type', file.contentType);
  c.header('Content-Disposition', `attachment; filename="${exportFileName('productos', file.ext)}"`);
  return c.body(file.body as Uint8Array<ArrayBuffer>);
});

productRoutes.get('/importar', (c) => {
  const user = requireUser(c);
  return c.html(
    <AppLayout title="Importar productos" section="productos" chrome={chrome(c)} flash={takeFlash(c)}>
      <section class="card stack">
        <p>
          Exportá desde tu sistema de gestión (o armá en Excel) la lista de tus productos. Lo ideal es que tenga estas columnas — solo el <strong>código</strong> es
          obligatorio:
        </p>
        <p class="muted">Código · Descripción · Costo · Precio de venta · Proveedor · Código del proveedor</p>
        <p class="muted">
          Si un código ya existe, se actualiza. El <em>código del proveedor</em> es lo que permite reconocer tus productos en sus listas; si no lo tenés, Remarcá te
          ayuda a vincularlos la primera vez.
        </p>
        <form method="post" action="/app/productos/importar" enctype="multipart/form-data" class="stack">
          <Csrf token={user.csrf} />
          <Field label="Archivo (.xlsx, .xls, .ods o .csv — máx. 12 MB)" name="file">
            <input id="file" name="file" type="file" required accept=".xlsx,.xls,.ods,.csv,.txt" />
          </Field>
          <button class="btn" type="submit">
            Subir y revisar columnas
          </button>
        </form>
      </section>
    </AppLayout>,
  );
});

productRoutes.post('/importar', async (c) => {
  const user = requireUser(c);
  const { db, limiters } = c.var.deps;
  if (!limiters.upload.take(`upload:${user.orgId}`)) {
    setFlash(c, { kind: 'error', text: 'Subiste muchos archivos en poco tiempo. Esperá un rato.' });
    return c.redirect('/app/productos/importar');
  }
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File) || file.size === 0) {
    setFlash(c, { kind: 'error', text: 'Elegí un archivo para subir.' });
    return c.redirect('/app/productos/importar');
  }
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const wb = await parseFile(file.name, buf);
    if (wb.kind === 'pdf') throw new FileFormatError('Para tus productos usá Excel o CSV (el PDF es para listas de proveedores).');
  } catch (err) {
    if (err instanceof FileFormatError) {
      setFlash(c, { kind: 'error', text: err.message });
      return c.redirect('/app/productos/importar');
    }
    throw err;
  }
  db.prepare("DELETE FROM catalog_uploads WHERE org_id = ? AND created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')").run(user.orgId);
  const id = Number(db.prepare('INSERT INTO catalog_uploads (org_id, file_name, file_blob) VALUES (?, ?, ?)').run(user.orgId, file.name.slice(0, 150), buf).lastInsertRowid);
  return c.redirect(`/app/productos/importar/${id}`);
});

async function loadCatalogUpload(c: Parameters<typeof requireUser>[0]) {
  const user = requireUser(c);
  const id = intParam(c.req.param('id'));
  if (!id) return null;
  const row = c.var.deps.db.prepare('SELECT id, file_name, file_blob FROM catalog_uploads WHERE id = ? AND org_id = ?').get(id, user.orgId) as
    | { id: number; file_name: string; file_blob: Buffer }
    | undefined;
  if (!row) return null;
  const wb = await parseFile(row.file_name, row.file_blob);
  const sheetName = c.req.query('hoja');
  const sheet = wb.sheets.find((s) => s.name === sheetName) ?? wb.sheets.reduce((a, b) => (b.rows.length > a.rows.length ? b : a));
  return { row, wb, sheet };
}

const colLabel = (i: number) => {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

export const PreviewTable = (p: { rows: Cell[][]; headerRow: number; highlight?: Record<number, string> }) => {
  const start = Math.max(0, p.headerRow);
  const slice = p.rows.slice(start, start + 12);
  const cols = Math.min(30, Math.max(0, ...slice.map((r) => r.length)));
  return (
    <div class="table-wrap preview">
      <table>
        <thead>
          <tr>
            <th class="muted">Fila</th>
            {Array.from({ length: cols }, (_, i) => (
              <th class={p.highlight?.[i] ? 'hl' : ''}>
                {colLabel(i)}
                {p.highlight?.[i] ? <span class="hl__tag">{p.highlight[i]}</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slice.map((r, idx) => (
            <tr class={start + idx === p.headerRow ? 'row--header' : ''}>
              <td class="muted">{start + idx + 1}</td>
              {Array.from({ length: cols }, (_, i) => (
                <td class={p.highlight?.[i] ? 'hl' : ''}>{r[i] == null ? '' : String(r[i]).slice(0, 60)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const ColumnSelect = (p: { name: string; label: string; value: number | null; cols: number; headers: Cell[]; required?: boolean }) => (
  <Field label={p.label + (p.required ? ' *' : '')} name={p.name}>
    <select id={p.name} name={p.name}>
      <option value="">{p.required ? 'Elegí una columna' : 'No está en el archivo'}</option>
      {Array.from({ length: p.cols }, (_, i) => (
        <option value={String(i)} selected={p.value === i ? true : undefined}>
          {colLabel(i)}
          {p.headers[i] != null ? ` — ${String(p.headers[i]).slice(0, 40)}` : ''}
        </option>
      ))}
    </select>
  </Field>
);

productRoutes.get('/importar/:id', async (c) => {
  const user = requireUser(c);
  const loaded = await loadCatalogUpload(c);
  if (!loaded) return c.notFound();
  const { row, wb, sheet } = loaded;
  const m = detectCatalogColumns(sheet.rows);
  const header = m.headerRow >= 0 ? sheet.rows[m.headerRow] ?? [] : [];
  const cols = Math.min(30, Math.max(0, ...sheet.rows.slice(0, 50).map((r) => r.length)));
  const highlight: Record<number, string> = {};
  for (const r of CATALOG_ROLES) if (m[r] != null) highlight[m[r]!] = CATALOG_ROLE_LABELS[r];
  return c.html(
    <AppLayout title="Importar productos" section="productos" chrome={chrome(c)} flash={takeFlash(c)}>
      <section class="card stack">
        <p>
          Archivo: <strong>{row.file_name}</strong> · {formatInt(sheet.rows.length)} filas
        </p>
        {wb.sheets.length > 1 ? (
          <form method="get" class="row">
            <Field label="Hoja" name="hoja">
              <select id="hoja" name="hoja" data-autosubmit>
                {wb.sheets.map((s) => (
                  <option value={s.name} selected={s.name === sheet.name ? true : undefined}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <button class="btn btn--secondary" type="submit">
              Cambiar hoja
            </button>
          </form>
        ) : null}
        <PreviewTable rows={sheet.rows} headerRow={m.headerRow} highlight={highlight} />
        <form method="post" action={`/app/productos/importar/${row.id}?hoja=${encodeURIComponent(sheet.name)}`} class="stack">
          <Csrf token={user.csrf} />
          <Field label="¿En qué fila están los títulos?" name="header_row" hint="0 = el archivo no tiene fila de títulos.">
            <input id="header_row" name="header_row" inputmode="numeric" value={String(m.headerRow + 1)} />
          </Field>
          <div class="grid3">
            {CATALOG_ROLES.map((r) => (
              <ColumnSelect name={r} label={CATALOG_ROLE_LABELS[r]} value={m[r]} cols={cols} headers={header} required={r === 'code'} />
            ))}
          </div>
          <button class="btn" type="submit">
            Importar productos
          </button>
        </form>
      </section>
    </AppLayout>,
  );
});

productRoutes.post('/importar/:id', async (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const loaded = await loadCatalogUpload(c);
  if (!loaded) return c.notFound();
  const form = formStrings(await c.req.parseBody());
  const col = (k: string) => (form[k] && /^\d{1,2}$/.test(form[k]!) ? Number(form[k]) : null);
  const headerRow = /^\d{1,3}$/.test(form.header_row ?? '') ? Number(form.header_row) - 1 : -1;
  const mapping: CatalogMapping = { headerRow: Math.max(-1, headerRow), code: col('code'), description: col('description'), cost: col('cost'), price: col('price'), supplier: col('supplier'), supplier_code: col('supplier_code') };
  const plan = orgAccess(c).plan;
  try {
    const r = importCatalog(db, user.orgId, loaded.sheet.rows, mapping, { products: plan.products, suppliers: plan.suppliers });
    db.prepare('DELETE FROM catalog_uploads WHERE id = ? AND org_id = ?').run(loaded.row.id, user.orgId);
    track(db, 'catalog_imported', user.orgId, user.userId, { created: r.created, updated: r.updated });
    const parts = [`${formatInt(r.created)} productos nuevos`, `${formatInt(r.updated)} actualizados`];
    if (r.suppliersCreated) parts.push(`${r.suppliersCreated} proveedores creados`);
    if (r.skipped) parts.push(`${formatInt(r.skipped)} filas salteadas`);
    setFlash(c, { kind: r.limitReached ? 'warn' : 'ok', text: `Importación lista: ${parts.join(', ')}.${r.limitReached ? ' Llegaste al límite de productos de tu plan.' : ''}` });
    return c.redirect('/app/productos');
  } catch (err) {
    if (err instanceof ProductError || err instanceof ImportError) {
      setFlash(c, { kind: 'error', text: err.message });
      return c.redirect(`/app/productos/importar/${loaded.row.id}`);
    }
    throw err;
  }
});

// ---------------------------------------------------------------------------------------------

productRoutes.get('/:id', (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const id = intParam(c.req.param('id'));
  const p = id ? getProduct(db, user.orgId, id) : null;
  if (!p) return c.notFound();
  const history = productHistory(db, user.orgId, p.id);
  const v: PV = {
    code: p.code,
    description: p.description,
    supplier_id: p.supplier_id == null ? '' : String(p.supplier_id),
    supplier_code: p.supplier_code ?? '',
    cost: centsToInput(p.cost_cents),
    price: centsToInput(p.price_cents),
    markup_pct: p.markup_pct == null ? '' : String(p.markup_pct).replace('.', ','),
    iva_rate: p.iva_rate == null ? '' : String(p.iva_rate),
  };
  const KIND: Record<string, string> = { update: 'Lista de proveedor', create: 'Creado desde lista', manual: 'Edición manual', revert: 'Deshecho' };
  return c.html(
    <AppLayout title={p.code} section="productos" chrome={chrome(c)} flash={takeFlash(c)}>
      {p.cost_cents != null && p.price_cents != null && p.price_cents < p.cost_cents ? <Alert kind="warn">El precio de venta es menor que el costo.</Alert> : null}
      <ProductForm action={`/app/productos/${p.id}`} v={v} errors={{}} csrf={user.csrf} suppliers={listSuppliers(db, user.orgId)} submit="Guardar" />
      <section class="card">
        <h2>Historial de precios</h2>
        {history.length === 0 ? (
          <p class="muted">Sin cambios registrados.</p>
        ) : (
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Origen</th>
                  <th class="r">Costo</th>
                  <th class="r">Var.</th>
                  <th class="r">Precio</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr>
                    <td>{formatDateTime(h.created_at)}</td>
                    <td>
                      {KIND[h.kind] ?? h.kind}
                      {h.import_id ? (
                        <>
                          {' '}
                          · <a href={`/app/listas/${h.import_id}`}>{h.supplier_name ?? h.file_name}</a>
                        </>
                      ) : null}
                    </td>
                    <td class="r">
                      <Money cents={h.new_cost_cents} />
                    </td>
                    <td class="r">
                      <Change ratio={changeRatio(h.old_cost_cents, h.new_cost_cents)} />
                    </td>
                    <td class="r">
                      <Money cents={h.new_price_cents} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section class="card danger-zone">
        <form method="post" action={`/app/productos/${p.id}/borrar`} data-confirm={`¿Borrar el producto ${p.code}? Se pierde su historial.`}>
          <Csrf token={user.csrf} />
          <button class="btn btn--danger" type="submit">
            Borrar producto
          </button>
        </form>
      </section>
    </AppLayout>,
  );
});

productRoutes.post('/:id', async (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const id = intParam(c.req.param('id'));
  const p = id ? getProduct(db, user.orgId, id) : null;
  if (!p) return c.notFound();
  const form = formStrings(await c.req.parseBody());
  const render = (errors: Record<string, string>) =>
    c.html(
      <AppLayout title={p.code} section="productos" chrome={chrome(c)}>
        <ProductForm action={`/app/productos/${p.id}`} v={form} errors={errors} csrf={user.csrf} suppliers={listSuppliers(db, user.orgId)} submit="Guardar" />
      </AppLayout>,
      400,
    );
  const parsed = productFormSchema.safeParse(form);
  if (!parsed.success) return render(zodErrors(parsed.error.issues));
  try {
    saveProduct(db, user.orgId, p.id, parsed.data, orgAccess(c).plan.products);
  } catch (err) {
    if (err instanceof ProductError) return render({ code: err.message });
    throw err;
  }
  setFlash(c, { kind: 'ok', text: 'Producto guardado.' });
  return c.redirect(`/app/productos/${p.id}`);
});

productRoutes.post('/:id/borrar', (c) => {
  const user = requireUser(c);
  const id = intParam(c.req.param('id'));
  if (!id || !deleteProduct(c.var.deps.db, user.orgId, id)) return c.notFound();
  setFlash(c, { kind: 'ok', text: 'Producto borrado.' });
  return c.redirect('/app/productos');
});
