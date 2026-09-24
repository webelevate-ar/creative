import { Hono } from 'hono';
import { chrome, formStrings, intParam, orgAccess, requireUser, setFlash, takeFlash, type AppEnv, type Ctx } from '../context.js';
import { AppLayout, ASSET_VERSION } from '../layout.js';
import { Alert, Badge, Change, Csrf, Empty, Field, Money, Pagination, Stat, pageHref } from '../ui.js';
import { ColumnSelect, PreviewTable } from './products.js';
import { statusBadge } from './dashboard.js';
import {
  applyImport,
  bulkDecision,
  confirmMapping,
  createImport,
  discardImport,
  getImport,
  ImportError,
  isRowFilter,
  linkRow,
  listImports,
  listRows,
  loadWorkbook,
  missingProducts,
  parseStats,
  recomputeImport,
  revertImport,
  setDecision,
  sheetRows,
  type ImportRecord,
  type ImportRow,
  type RowFilter,
} from '../../services/imports.js';
import { getSupplier, listSuppliers, priceModeFor } from '../../services/suppliers.js';
import { getSettings } from '../../services/settings.js';
import { listProducts } from '../../services/products.js';
import { appliedRows, buildExport, computedRows, exportFileName } from '../../services/exports.js';
import { detectColumns, type ColumnMapping, type Detection } from '../../lib/detect.js';
import { FileFormatError } from '../../lib/sheet.js';
import { changeRatio, formatDate, formatDateTime, formatInt, formatMoney, formatPct } from '../../lib/money.js';
import { track } from '../../lib/events.js';

export const listRoutes = new Hono<AppEnv>();

// ---------------------------------------------------------------------------------------------
// History & upload

listRoutes.get('/', (c) => {
  const user = requireUser(c);
  const imports = listImports(c.var.deps.db, user.orgId, { limit: 200 });
  return c.html(
    <AppLayout
      title="Listas de proveedores"
      section="listas"
      chrome={chrome(c)}
      flash={takeFlash(c)}
      actions={
        <a class="btn" href="/app/listas/nueva">
          Subir lista
        </a>
      }
    >
      {imports.length === 0 ? (
        <Empty title="Todavía no subiste listas">
          <p>Subí la última lista que te mandó un proveedor (Excel, CSV o PDF) y mirá qué cambió.</p>
          <p>
            <a class="btn" href="/app/listas/nueva">
              Subir la primera
            </a>
          </p>
        </Empty>
      ) : (
        <div class="card table-wrap" tabindex={0} role="region" aria-label="Tabla (se puede desplazar)">
          <table>
            <thead>
              <tr>
                <th>Subida</th>
                <th>Proveedor</th>
                <th>Archivo</th>
                <th>Estado</th>
                <th class="r">Productos</th>
                <th class="r">Variación mediana</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((i) => {
                const st = parseStats(i.stats_json);
                return (
                  <tr>
                    <td>{formatDateTime(i.created_at)}</td>
                    <td>{i.supplier_name}</td>
                    <td>
                      <a href={`/app/listas/${i.id}`}>{i.file_name}</a>
                    </td>
                    <td>{statusBadge(i.status)}</td>
                    <td class="r num">{formatInt(st.total)}</td>
                    <td class="r">
                      <Change ratio={st.medianChange} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>,
  );
});

listRoutes.get('/nueva', (c) => {
  const user = requireUser(c);
  const suppliers = listSuppliers(c.var.deps.db, user.orgId);
  const pre = intParam(c.req.query('proveedor'));
  return c.html(
    <AppLayout title="Subir lista de proveedor" section="listas" chrome={chrome(c)} flash={takeFlash(c)}>
      {suppliers.length === 0 ? (
        <Empty title="Primero creá el proveedor">
          <p>Así Remarcá guarda sus bonificaciones, si la lista trae IVA o está en dólares, y recuerda el formato de su archivo.</p>
          <p>
            <a class="btn" href="/app/proveedores/nuevo">
              Crear proveedor
            </a>
          </p>
        </Empty>
      ) : (
        <form method="post" action="/app/listas" enctype="multipart/form-data" class="card stack narrow-left" data-busy="Leyendo la lista…">
          <Csrf token={user.csrf} />
          <Field label="Proveedor" name="supplier_id">
            <select id="supplier_id" name="supplier_id" required>
              {suppliers.map((s) => (
                <option value={String(s.id)} selected={s.id === pre ? true : undefined}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Archivo de la lista" name="file" hint="Excel (.xlsx, .xls), .ods, CSV o PDF con texto. Máximo 12 MB. Los PDF escaneados (foto) no se pueden leer.">
            <input id="file" name="file" type="file" required accept=".xlsx,.xls,.ods,.csv,.txt,.pdf" />
          </Field>
          <button class="btn" type="submit">
            Subir y analizar
          </button>
          <p class="small muted">Nada cambia en tus precios hasta que revises y confirmes.</p>
        </form>
      )}
    </AppLayout>,
  );
});

listRoutes.post('/', async (c) => {
  const user = requireUser(c);
  const { db, limiters } = c.var.deps;
  if (!limiters.upload.take(`upload:${user.orgId}`)) {
    setFlash(c, { kind: 'error', text: 'Subiste muchos archivos en poco tiempo. Esperá un rato y probá de nuevo.' });
    return c.redirect('/app/listas/nueva');
  }
  const body = await c.req.parseBody();
  const supplierId = intParam(typeof body.supplier_id === 'string' ? body.supplier_id : null);
  const file = body.file;
  const back = `/app/listas/nueva${supplierId ? `?proveedor=${supplierId}` : ''}`;
  if (!supplierId) {
    setFlash(c, { kind: 'error', text: 'Elegí el proveedor.' });
    return c.redirect(back);
  }
  if (!(file instanceof File) || file.size === 0) {
    setFlash(c, { kind: 'error', text: 'Elegí el archivo de la lista.' });
    return c.redirect(back);
  }
  try {
    const { importId, autoMapped } = await createImport(db, user.orgId, user.userId, supplierId, file.name, Buffer.from(await file.arrayBuffer()));
    track(db, 'list_uploaded', user.orgId, user.userId, { autoMapped, size: file.size, kind: file.name.split('.').pop()?.toLowerCase() });
    if (autoMapped) setFlash(c, { kind: 'ok', text: 'Reconocimos el formato de este proveedor. Revisá los cambios.' });
    return c.redirect(`/app/listas/${importId}`);
  } catch (err) {
    if (err instanceof FileFormatError || err instanceof ImportError) {
      setFlash(c, { kind: 'error', text: err.message });
      return c.redirect(back);
    }
    throw err;
  }
});

// ---------------------------------------------------------------------------------------------
// Import detail

function loadImport(c: Ctx): ImportRecord | null {
  const id = intParam(c.req.param('id'));
  return id ? getImport(c.var.deps.db, requireUser(c).orgId, id) : null;
}

const LIST_NUM = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
function listPriceText(price: number | null, currency: 'ARS' | 'USD', raw: string): string {
  if (price == null) return raw || '—';
  return `${currency === 'USD' ? 'US$' : '$'} ${LIST_NUM.format(price)}`;
}

const FLAG_LABEL: Record<string, { text: string; tone: 'up' | 'down' | 'warn' | 'info' | 'neutral'; title: string }> = {
  suspect: { text: '¿Error en la lista?', tone: 'warn', title: 'El costo cambia más de 5 veces: posible error de decimales, de unidad o de código.' },
  check_match: { text: 'Coincide solo el código: verificá', tone: 'warn', title: 'El código coincide con uno tuyo pero las descripciones no se parecen. No se aplica salvo que lo confirmes.' },
  up_big: { text: 'Subió mucho', tone: 'up', title: 'Supera el umbral de cambio grande de tus ajustes.' },
  down_big: { text: 'Bajó mucho', tone: 'down', title: 'Supera el umbral de cambio grande de tus ajustes.' },
  below_cost: { text: 'Hoy lo vendés bajo costo', tone: 'warn', title: 'Tu precio actual no cubre el costo nuevo.' },
  no_price: { text: 'Sin precio', tone: 'neutral', title: 'La fila no tiene un precio válido.' },
  dup: { text: 'Código repetido', tone: 'neutral', title: 'El código aparece más de una vez en la lista; se usa la primera.' },
  new: { text: 'No está en tu catálogo', tone: 'info', title: 'Podés vincularlo a un producto tuyo o crearlo.' },
};

const Flags = ({ flags }: { flags: string }) => (
  <>
    {flags
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((f) => {
        const l = FLAG_LABEL[f];
        return l ? (
          <span class={`badge badge--${l.tone}`} title={l.title}>
            {l.text}
          </span>
        ) : null;
      })}
  </>
);

const FILTER_TABS: { key: RowFilter; label: string }[] = [
  { key: 'apply', label: 'A aplicar' },
  { key: 'changed', label: 'Con cambios' },
  { key: 'up', label: 'Suben' },
  { key: 'down', label: 'Bajan' },
  { key: 'below_cost', label: 'Bajo costo' },
  { key: 'flagged', label: 'Alertas' },
  { key: 'new', label: 'Nuevos' },
  { key: 'skip', label: 'No se aplican' },
  { key: 'all', label: 'Todos' },
];

listRoutes.get('/:id', async (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const imp = loadImport(c);
  if (!imp) return c.notFound();
  const supplier = getSupplier(db, user.orgId, imp.supplier_id)!;
  const flash = takeFlash(c);
  const ch = chrome(c);

  if (imp.status === 'uploaded') {
    let sheet: { name: string; rows: import('../../lib/sheet.js').Cell[][] };
    let sheetNames: string[] = [];
    try {
      const wb = await loadWorkbook(db, imp);
      sheetNames = wb.sheets.map((s) => s.name);
      sheet = sheetRows(wb, c.req.query('hoja') ?? imp.sheet_name);
    } catch (err) {
      if (err instanceof ImportError || err instanceof FileFormatError) {
        return c.html(
          <AppLayout title="Lista" section="listas" chrome={ch}>
            <Alert kind="error">{err.message}</Alert>
          </AppLayout>,
        );
      }
      throw err;
    }
    const d: Detection = sheet.name === imp.sheet_name && imp.mapping_json ? (JSON.parse(imp.mapping_json) as Detection) : detectColumns(sheet.rows);
    const header = d.headerRow >= 0 ? sheet.rows[d.headerRow] ?? [] : [];
    const cols = Math.min(30, Math.max(0, ...sheet.rows.slice(0, 60).map((r) => r.length)));
    const highlight: Record<number, string> = {};
    if (d.code != null) highlight[d.code] = 'Código';
    if (d.description != null) highlight[d.description] = 'Descripción';
    if (d.price != null) highlight[d.price] = 'Precio';
    if (d.pack != null) highlight[d.pack] = 'Unid. bulto';
    return c.html(
      <AppLayout title={`Lista de ${supplier.name}`} section="listas" chrome={ch} flash={flash}>
        <section class="card stack">
          <p>
            <strong>{imp.file_name}</strong> · primera vez que subís una lista de este proveedor (o cambió su formato). Confirmá qué hay en cada columna; la próxima
            vez se lee sola.
          </p>
          {d.confidence === 'low' ? (
            <Alert kind="warn">No pudimos identificar todas las columnas. Elegí al menos el código y el precio.</Alert>
          ) : (
            <Alert kind="info">Marcamos las columnas que detectamos. Revisá que estén bien.</Alert>
          )}
          {sheetNames.length > 1 ? (
            <form method="get" class="row">
              <Field label="Hoja del archivo" name="hoja">
                <select id="hoja" name="hoja" data-autosubmit>
                  {sheetNames.map((n) => (
                    <option value={n} selected={n === sheet.name ? true : undefined}>
                      {n}
                    </option>
                  ))}
                </select>
              </Field>
              <button class="btn btn--secondary" type="submit">
                Ver hoja
              </button>
            </form>
          ) : null}
          <PreviewTable rows={sheet.rows} headerRow={d.headerRow} highlight={highlight} />
          <form method="post" action={`/app/listas/${imp.id}/mapeo`} class="stack" data-busy="Calculando precios…">
            <Csrf token={user.csrf} />
            <input type="hidden" name="sheet" value={sheet.name} />
            <div class="grid3">
              <Field label="Fila de títulos" name="header_row" hint="0 = sin fila de títulos.">
                <input id="header_row" name="header_row" inputmode="numeric" value={String(d.headerRow + 1)} />
              </Field>
              <ColumnSelect name="code" label="Código del proveedor" value={d.code} cols={cols} headers={header} required />
              <ColumnSelect name="price" label="Precio" value={d.price} cols={cols} headers={header} required />
              <ColumnSelect name="description" label="Descripción" value={d.description} cols={cols} headers={header} />
              <ColumnSelect name="pack" label="Unidades por bulto" value={d.pack} cols={cols} headers={header} />
              <Field label="Decimales del precio" name="decimal">
                <select id="decimal" name="decimal">
                  <option value="," selected={d.decimal === ',' ? true : undefined}>
                    Coma (1.234,56)
                  </option>
                  <option value="." selected={d.decimal === '.' ? true : undefined}>
                    Punto (1,234.56)
                  </option>
                </select>
              </Field>
            </div>
            {d.priceCandidates.length > 1 ? (
              <p class="small muted">
                Hay varias columnas de precio ({d.priceCandidates.map((i) => String(header[i] ?? `col. ${i + 1}`)).join(', ')}). Elegí la que corresponde a las reglas del
                proveedor (con o sin IVA).
              </p>
            ) : null}
            <div class="row">
              <button class="btn" type="submit">
                Confirmar columnas y calcular
              </button>
            </div>
          </form>
          <form method="post" action={`/app/listas/${imp.id}/descartar`} data-confirm="¿Descartar esta lista?">
            <Csrf token={user.csrf} />
            <button class="linklike" type="submit">
              Descartar esta lista
            </button>
          </form>
        </section>
      </AppLayout>,
    );
  }

  const stats = parseStats(imp.stats_json);
  const settings = getSettings(db, user.orgId);
  const filterQ = c.req.query('ver') ?? (imp.status === 'review' ? 'apply' : 'apply');
  const filter: RowFilter = isRowFilter(filterQ) ? filterQ : 'apply';
  const q = (c.req.query('q') ?? '').slice(0, 80);
  const page = intParam(c.req.query('page')) ?? 1;
  const rows = listRows(db, user.orgId, imp.id, { filter, q, page, pageSize: 50 });
  const base = `/app/listas/${imp.id}`;
  const params = { ver: filter, q };
  const here = pageHref(base, params, page);
  const review = imp.status === 'review';
  const rulesText = [
    supplier.discounts ? `bonificación ${supplier.discounts}` : 'sin bonificación',
    supplier.surcharge_pct ? `recargo ${String(supplier.surcharge_pct).replace('.', ',')} %` : null,
    supplier.list_includes_iva ? 'lista con IVA' : 'lista sin IVA',
    supplier.currency === 'USD' ? `en USD × ${formatInt(supplier.exchange_rate)}` : null,
    priceModeFor(supplier, settings) === 'keep_margin' ? 'mantiene tu margen' : `margen ${supplier.markup_pct ?? settings.defaultMarkupPct} %`,
    settings.roundTo ? `redondeo a $ ${formatInt(settings.roundTo)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const systematic = stats.medianChange != null && Math.abs(stats.medianChange) > 0.15 && stats.matched >= 5;

  return c.html(
    <AppLayout
      title={`Lista de ${supplier.name}`}
      section="listas"
      chrome={ch}
      flash={flash}
      actions={
        review ? (
          <form method="post" action={`${base}/aplicar`} data-confirm={`Se van a actualizar ${stats.toApply} productos${stats.toCreate ? ` y crear ${stats.toCreate}` : ''}. ¿Confirmás?`} data-busy="Aplicando…">
            <Csrf token={user.csrf} />
            <button class="btn" type="submit" disabled={stats.toApply + stats.toCreate === 0 ? true : undefined}>
              Aplicar {formatInt(stats.toApply + stats.toCreate)} cambios
            </button>
          </form>
        ) : null
      }
    >
      <p class="muted">
        {imp.file_name} · subida el {formatDateTime(imp.created_at)} · {statusBadge(imp.status)}
        {imp.applied_at ? ` · aplicada el ${formatDateTime(imp.applied_at)}` : ''}
      </p>

      {imp.status === 'applied' && stats.applied ? (
        <section class="card applied">
          <h2>
            Listo: {formatInt(stats.applied.updated)} productos actualizados{stats.applied.created ? ` y ${formatInt(stats.applied.created)} creados` : ''}.
          </h2>
          <p>Ahora pasá los precios nuevos a tu sistema:</p>
          <div class="row wrap">
            <a class="btn" href={`${base}/exportar?tipo=aplicados`}>
              Descargar archivo para tu sistema ({settings.exportFormat.toUpperCase()})
            </a>
            <a class="btn btn--secondary" href={`${base}/etiquetas`}>
              Imprimir etiquetas
            </a>
            <a class="btn btn--secondary" href={`${base}/exportar?tipo=calculada`}>
              Lista completa calculada
            </a>
          </div>
          <form method="post" action={`${base}/deshacer`} data-confirm="Se van a restaurar los costos y precios anteriores de los productos que nadie modificó después. ¿Deshacer?">
            <Csrf token={user.csrf} />
            <button class="linklike" type="submit">
              Deshacer esta actualización
            </button>
          </form>
        </section>
      ) : null}
      {imp.status === 'reverted' && stats.reverted ? (
        <Alert kind="info">
          Deshecha: {stats.reverted.restored} productos restaurados, {stats.reverted.deleted} borrados
          {stats.reverted.conflicts ? `, ${stats.reverted.conflicts} no se tocaron porque cambiaron después` : ''}.
        </Alert>
      ) : null}
      {imp.status === 'discarded' ? <Alert kind="info">Esta lista fue descartada.</Alert> : null}

      {imp.status !== 'discarded' ? (
        <>
          <section class="stats">
            <Stat label="productos en la lista" value={formatInt(stats.total)} href={pageHref(base, { ver: 'all' }, 1)} />
            <Stat label="suben" value={formatInt(stats.up)} tone="up" href={pageHref(base, { ver: 'up' }, 1)} />
            <Stat label="bajan" value={formatInt(stats.down)} tone="down" href={pageHref(base, { ver: 'down' }, 1)} />
            <Stat label="variación mediana" value={stats.medianChange == null ? '—' : formatPct(stats.medianChange)} />
            <Stat label="hoy vendés bajo costo" value={formatInt(stats.belowCost)} tone={stats.belowCost ? 'bad' : undefined} href={pageHref(base, { ver: 'below_cost' }, 1)} />
            <Stat label="no están en tu catálogo" value={formatInt(stats.unmatched)} href={pageHref(base, { ver: 'new' }, 1)} />
            <Stat label="tuyos que faltan en la lista" value={formatInt(stats.missing)} href={`${base}/faltantes`} />
          </section>

          {review ? (
            <section class="card rules">
              <p>
                <strong>Reglas de {supplier.name}:</strong> {rulesText}. <a href={`/app/proveedores/${supplier.id}?volver=${encodeURIComponent(base)}`}>Editar reglas</a>
              </p>
              {systematic ? (
                <Alert kind="warn">
                  La mayoría de los productos cambia {formatPct(stats.medianChange)}. Si no esperabas un aumento así, revisá las reglas del proveedor (bonificaciones, IVA,
                  dólar) o la columna de precio elegida.
                </Alert>
              ) : null}
              {stats.matched === 0 && stats.unmatched > 0 ? (
                <Alert kind="warn">
                  <p>
                    Ningún producto de esta lista está en tu catálogo todavía. Si ya cargaste tus productos con el código del proveedor, revisá que la columna de código
                    sea la correcta.
                  </p>
                  <p>
                    <strong>¿Primera lista de este proveedor?</strong> Creá tus productos a partir de ella (con tu margen general). Desde la próxima lista, Remarcá te
                    muestra qué cambió y cuánto.
                  </p>
                  <BulkButton base={base} csrf={user.csrf} filter="new" decision="create" label={`Crear los ${formatInt(stats.unmatched)} productos desde esta lista`} back={pageHref(base, { ver: 'apply' }, 1)} />
                </Alert>
              ) : null}
            </section>
          ) : null}

          <section class="card">
            <nav class="tabs" aria-label="Filtrar filas">
              {FILTER_TABS.map((t) => (
                <a href={pageHref(base, { ver: t.key, q }, 1)} aria-current={t.key === filter ? 'page' : undefined}>
                  {t.label}
                </a>
              ))}
            </nav>
            <form method="get" action={base} class="row">
              <input type="hidden" name="ver" value={filter} />
              <input name="q" type="search" value={q} placeholder="Buscar código o descripción" aria-label="Buscar en la lista" />
              <button class="btn btn--secondary" type="submit">
                Buscar
              </button>
            </form>
            {review && rows.total > 0 ? (
              <div class="bulk row wrap">
                <span class="muted">Para las {formatInt(rows.total)} filas de este filtro:</span>
                {filter === 'new' ? (
                  <BulkButton base={base} csrf={user.csrf} filter={filter} decision="create" label="Crear todos como productos nuevos" back={here} />
                ) : (
                  <BulkButton base={base} csrf={user.csrf} filter={filter} decision="apply" label="Aplicar todos" back={here} />
                )}
                <BulkButton base={base} csrf={user.csrf} filter={filter} decision="skip" label="No aplicar ninguno" back={here} />
              </div>
            ) : null}
            {rows.total === 0 ? (
              <p class="muted">No hay filas en este filtro.</p>
            ) : (
              <div class="table-wrap" tabindex={0} role="region" aria-label="Tabla (se puede desplazar)">
                <table class="review">
                  <thead>
                    <tr>
                      <th>Código prov.</th>
                      <th>Descripción</th>
                      <th class="r">Costo</th>
                      <th class="r">Var.</th>
                      <th class="r">Precio de venta</th>
                      <th>{review ? 'Alertas y acción' : 'Alertas y estado'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.rows.map((r) => (
                      <tr class={r.decision === 'skip' ? 'row--muted' : ''}>
                        <td data-label="Código">
                          <code>{r.raw_code}</code>
                          {r.product_code && r.product_code !== r.raw_code ? <div class="small muted">Tuyo: {r.product_code}</div> : null}
                        </td>
                        <td data-label="Descripción">
                          {r.description || r.product_description}
                          <div class="small muted">Lista: {listPriceText(r.list_price, supplier.currency, r.raw_price)}</div>
                        </td>
                        <td class="r" data-label="Costo">
                          <Money cents={r.new_cost_cents} />
                          <div class="small muted">
                            antes <Money cents={r.old_cost_cents} />
                          </div>
                        </td>
                        <td class="r" data-label="Variación">
                          <Change ratio={changeRatio(r.old_cost_cents, r.new_cost_cents)} />
                        </td>
                        <td class="r" data-label="Precio">
                          <span class="strong">
                            <Money cents={r.new_price_cents} />
                          </span>
                          <div class="small muted">
                            antes <Money cents={r.old_price_cents} />
                          </div>
                        </td>
                        <td data-label={review ? 'Acción' : 'Estado'}>
                          <div class="flags">
                            <Flags flags={r.flags} />
                          </div>
                          {review ? <RowAction base={base} csrf={user.csrf} row={r} back={here} /> : <DecisionText row={r} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination base={base} params={params} page={rows.page} pageSize={rows.pageSize} total={rows.total} />
          </section>

          {review ? (
            <section class="card row wrap between">
              <form method="post" action={`${base}/recalcular`}>
                <Csrf token={user.csrf} />
                <button class="btn btn--secondary" type="submit">
                  Recalcular con los ajustes actuales
                </button>
              </form>
              <form method="post" action={`${base}/descartar`} data-confirm="¿Descartar esta lista? No se cambia ningún precio.">
                <Csrf token={user.csrf} />
                <button class="btn btn--danger" type="submit">
                  Descartar lista
                </button>
              </form>
            </section>
          ) : null}
        </>
      ) : null}
    </AppLayout>,
  );
});

const BulkButton = (p: { base: string; csrf: string; filter: RowFilter; decision: 'apply' | 'skip' | 'create'; label: string; back: string }) => (
  <form method="post" action={`${p.base}/masivo`}>
    <Csrf token={p.csrf} />
    <input type="hidden" name="filter" value={p.filter} />
    <input type="hidden" name="decision" value={p.decision} />
    <input type="hidden" name="volver" value={p.back} />
    <button class="btn btn--small btn--secondary" type="submit">
      {p.label}
    </button>
  </form>
);

const DecisionText = ({ row }: { row: ImportRow }) =>
  row.decision === 'apply' ? <Badge tone="ok">Aplicado</Badge> : row.decision === 'create' ? <Badge tone="ok">Creado</Badge> : <span class="muted">No aplicado</span>;

const RowAction = (p: { base: string; csrf: string; row: ImportRow; back: string }) => {
  const r = p.row;
  const canApply = r.product_id != null && r.new_cost_cents != null;
  const canCreate = r.product_id == null && r.new_cost_cents != null && !r.flags.includes(' dup ');
  return (
    <div class="rowaction">
      <form method="post" action={`${p.base}/fila/${r.id}`} class="inline">
        <Csrf token={p.csrf} />
        <input type="hidden" name="volver" value={p.back} />
        <select name="decision" aria-label={`Acción para ${r.raw_code}`} data-autosubmit>
          {canApply ? (
            <option value="apply" selected={r.decision === 'apply' ? true : undefined}>
              Aplicar
            </option>
          ) : null}
          {canCreate ? (
            <option value="create" selected={r.decision === 'create' ? true : undefined}>
              Crear producto
            </option>
          ) : null}
          <option value="skip" selected={r.decision === 'skip' ? true : undefined}>
            No aplicar
          </option>
        </select>
        <button class="btn btn--small btn--secondary nojs" type="submit">
          OK
        </button>
      </form>
      {r.product_id == null && !r.flags.includes(' dup ') ? (
        <a class="small" href={`${p.base}/vincular/${r.id}?volver=${encodeURIComponent(p.back)}`}>
          Vincular a un producto
        </a>
      ) : null}
    </div>
  );
};

function backTo(c: Ctx, imp: ImportRecord, raw: string | undefined): string {
  const base = `/app/listas/${imp.id}`;
  return raw && (raw === base || raw.startsWith(`${base}?`)) ? raw : base;
}

async function handle(c: Ctx, imp: ImportRecord, fn: () => void | Promise<void>, back: string) {
  try {
    await fn();
  } catch (err) {
    if (err instanceof ImportError) {
      setFlash(c, { kind: 'error', text: err.message });
      return c.redirect(back);
    }
    throw err;
  }
  return null;
}

listRoutes.post('/:id/mapeo', async (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const imp = loadImport(c);
  if (!imp) return c.notFound();
  const form = formStrings(await c.req.parseBody());
  const col = (k: string) => (form[k] && /^\d{1,2}$/.test(form[k]!) ? Number(form[k]) : null);
  const headerRow = /^\d{1,3}$/.test(form.header_row ?? '') ? Number(form.header_row) - 1 : -1;
  const mapping: ColumnMapping = {
    headerRow: Math.max(-1, headerRow),
    code: col('code'),
    price: col('price'),
    description: col('description'),
    pack: col('pack'),
    decimal: form.decimal === '.' ? '.' : ',',
  };
  const err = await handle(c, imp, () => confirmMapping(db, user.orgId, imp.id, form.sheet ?? null, mapping), `/app/listas/${imp.id}`);
  if (err) return err;
  track(db, 'list_mapped', user.orgId, user.userId);
  return c.redirect(`/app/listas/${imp.id}`);
});

listRoutes.post('/:id/fila/:rowId', async (c) => {
  const user = requireUser(c);
  const imp = loadImport(c);
  const rowId = intParam(c.req.param('rowId'));
  if (!imp || !rowId) return c.notFound();
  const form = formStrings(await c.req.parseBody());
  const decision = form.decision;
  const back = backTo(c, imp, form.volver);
  if (decision !== 'apply' && decision !== 'skip' && decision !== 'create') return c.redirect(back);
  const err = await handle(c, imp, () => setDecision(c.var.deps.db, user.orgId, imp.id, rowId, decision), back);
  return err ?? c.redirect(back);
});

listRoutes.post('/:id/masivo', async (c) => {
  const user = requireUser(c);
  const imp = loadImport(c);
  if (!imp) return c.notFound();
  const form = formStrings(await c.req.parseBody());
  const back = backTo(c, imp, form.volver);
  const filter = form.filter ?? '';
  const decision = form.decision;
  if (!isRowFilter(filter) || (decision !== 'apply' && decision !== 'skip' && decision !== 'create')) return c.redirect(back);
  let n = 0;
  const err = await handle(c, imp, () => void (n = bulkDecision(c.var.deps.db, user.orgId, imp.id, filter, decision)), back);
  if (err) return err;
  setFlash(c, { kind: 'ok', text: `${formatInt(n)} filas actualizadas.` });
  return c.redirect(back);
});

listRoutes.post('/:id/recalcular', async (c) => {
  const user = requireUser(c);
  const imp = loadImport(c);
  if (!imp) return c.notFound();
  const err = await handle(c, imp, () => void recomputeImport(c.var.deps.db, user.orgId, imp.id), `/app/listas/${imp.id}`);
  if (err) return err;
  setFlash(c, { kind: 'ok', text: 'Lista recalculada con las reglas y ajustes actuales.' });
  return c.redirect(`/app/listas/${imp.id}`);
});

listRoutes.post('/:id/aplicar', async (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const imp = loadImport(c);
  if (!imp) return c.notFound();
  let res: ReturnType<typeof applyImport> | null = null;
  const err = await handle(c, imp, () => void (res = applyImport(db, user.orgId, imp.id, orgAccess(c).plan.products)), `/app/listas/${imp.id}`);
  if (err) return err;
  const r = res!;
  track(db, 'list_applied', user.orgId, user.userId, { updated: r.updated, created: r.created });
  setFlash(c, {
    kind: r.limitReached ? 'warn' : 'ok',
    text: `${
      r.updated ? `Precios actualizados: ${formatInt(r.updated)} productos${r.created ? `, ${formatInt(r.created)} creados` : ''}.` : `Se crearon ${formatInt(r.created)} productos.`
    }${r.limitReached ? ' Algunos no se crearon por el límite de tu plan.' : ''}`,
  });
  return c.redirect(`/app/listas/${imp.id}`);
});

listRoutes.post('/:id/deshacer', async (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const imp = loadImport(c);
  if (!imp) return c.notFound();
  let res: ReturnType<typeof revertImport> | null = null;
  const err = await handle(c, imp, () => void (res = revertImport(db, user.orgId, imp.id)), `/app/listas/${imp.id}`);
  if (err) return err;
  const r = res!;
  track(db, 'list_reverted', user.orgId, user.userId, { ...r });
  setFlash(c, { kind: r.conflicts ? 'warn' : 'ok', text: `Deshecho. ${r.restored} productos restaurados${r.deleted ? `, ${r.deleted} borrados` : ''}${r.conflicts ? `; ${r.conflicts} no se tocaron porque cambiaron después` : ''}.` });
  return c.redirect(`/app/listas/${imp.id}`);
});

listRoutes.post('/:id/descartar', async (c) => {
  const user = requireUser(c);
  const imp = loadImport(c);
  if (!imp) return c.notFound();
  const err = await handle(c, imp, () => discardImport(c.var.deps.db, user.orgId, imp.id), `/app/listas/${imp.id}`);
  if (err) return err;
  track(c.var.deps.db, 'list_discarded', user.orgId, user.userId);
  setFlash(c, { kind: 'ok', text: 'Lista descartada. No se cambió ningún precio.' });
  return c.redirect('/app/listas');
});

// ---------------------------------------------------------------------------------------------
// Manual linking

listRoutes.get('/:id/vincular/:rowId', (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const imp = loadImport(c);
  const rowId = intParam(c.req.param('rowId'));
  if (!imp || !rowId) return c.notFound();
  const row = db.prepare('SELECT * FROM import_rows WHERE id = ? AND import_id = ? AND org_id = ?').get(rowId, imp.id, user.orgId) as ImportRow | undefined;
  if (!row) return c.notFound();
  const back = backTo(c, imp, c.req.query('volver'));
  const q = (c.req.query('q') ?? row.description.split(' ').slice(0, 3).join(' ')).slice(0, 100);
  const results = q ? listProducts(db, user.orgId, { q, pageSize: 20 }).rows : [];
  return c.html(
    <AppLayout title="Vincular producto" section="listas" chrome={chrome(c)} flash={takeFlash(c)}>
      <section class="card stack">
        <p>
          En la lista: <code>{row.raw_code}</code> — {row.description} — {row.raw_price}
        </p>
        <p class="muted">Elegí cuál de tus productos es. Remarcá lo recuerda para las próximas listas de este proveedor.</p>
        <form method="get" class="row">
          <input type="hidden" name="volver" value={back} />
          <input name="q" type="search" value={q} aria-label="Buscar producto" placeholder="Buscar por código o descripción" />
          <button class="btn btn--secondary" type="submit">
            Buscar
          </button>
        </form>
        {results.length === 0 ? (
          <p class="muted">Sin resultados. Probá con otra palabra.</p>
        ) : (
          <div class="table-wrap" tabindex={0} role="region" aria-label="Tabla (se puede desplazar)">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Proveedor</th>
                  <th class="r">Costo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {results.map((p) => (
                  <tr>
                    <td>{p.code}</td>
                    <td>{p.description}</td>
                    <td>{p.supplier_name ?? '—'}</td>
                    <td class="r">
                      <Money cents={p.cost_cents} />
                    </td>
                    <td class="r">
                      <form method="post" action={`/app/listas/${imp.id}/vincular/${row.id}`}>
                        <Csrf token={user.csrf} />
                        <input type="hidden" name="product_id" value={String(p.id)} />
                        <input type="hidden" name="volver" value={back} />
                        <button class="btn btn--small" type="submit">
                          Es este
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p>
          <a href={back}>← Volver a la lista</a>
        </p>
      </section>
    </AppLayout>,
  );
});

listRoutes.post('/:id/vincular/:rowId', async (c) => {
  const user = requireUser(c);
  const imp = loadImport(c);
  const rowId = intParam(c.req.param('rowId'));
  if (!imp || !rowId) return c.notFound();
  const form = formStrings(await c.req.parseBody());
  const productId = intParam(form.product_id);
  const back = backTo(c, imp, form.volver);
  if (!productId) return c.redirect(back);
  const err = await handle(c, imp, () => linkRow(c.var.deps.db, user.orgId, imp.id, rowId, productId), back);
  if (err) return err;
  setFlash(c, { kind: 'ok', text: 'Vinculado. Se recordará para las próximas listas.' });
  return c.redirect(back);
});

// ---------------------------------------------------------------------------------------------
// Outputs

listRoutes.get('/:id/exportar', (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const imp = loadImport(c);
  if (!imp) return c.notFound();
  const tipo = c.req.query('tipo') === 'calculada' ? 'calculada' : 'aplicados';
  if (tipo === 'aplicados' && imp.status !== 'applied') {
    setFlash(c, { kind: 'info', text: 'El archivo para tu sistema se genera después de aplicar la lista.' });
    return c.redirect(`/app/listas/${imp.id}`);
  }
  const settings = getSettings(db, user.orgId);
  const supplier = getSupplier(db, user.orgId, imp.supplier_id)!;
  const rows = tipo === 'aplicados' ? appliedRows(db, user.orgId, imp.id) : computedRows(db, user.orgId, imp.id);
  const file =
    tipo === 'aplicados'
      ? buildExport(rows, settings)
      : buildExport(rows, settings, ['code', 'description', 'supplier_code', 'old_cost', 'cost', 'change_pct', 'old_price', 'price']);
  track(db, 'export_downloaded', user.orgId, user.userId, { kind: tipo, rows: rows.length });
  c.header('Content-Type', file.contentType);
  c.header('Content-Disposition', `attachment; filename="${exportFileName(`${supplier.name}-${tipo}`, file.ext)}"`);
  return c.body(file.body as Uint8Array<ArrayBuffer>);
});

listRoutes.get('/:id/faltantes', (c) => {
  const user = requireUser(c);
  const imp = loadImport(c);
  if (!imp) return c.notFound();
  const missing = missingProducts(c.var.deps.db, user.orgId, imp.id, 500);
  return c.html(
    <AppLayout title="Productos que no vinieron en la lista" section="listas" chrome={chrome(c)}>
      <p class="muted">
        Son productos tuyos asignados a este proveedor que no aparecen en esta lista: pueden estar discontinuados, sin stock o con otro código. Sus precios no se
        tocaron.
      </p>
      {missing.length === 0 ? (
        <p>No falta ninguno.</p>
      ) : (
        <div class="card table-wrap" tabindex={0} role="region" aria-label="Tabla (se puede desplazar)">
          <table>
            <thead>
              <tr>
                <th>Tu código</th>
                <th>Código prov.</th>
                <th>Descripción</th>
                <th class="r">Costo</th>
                <th class="r">Precio</th>
              </tr>
            </thead>
            <tbody>
              {missing.map((p) => (
                <tr>
                  <td>
                    <a href={`/app/productos/${p.id}`}>{p.code}</a>
                  </td>
                  <td>{p.supplier_code ?? '—'}</td>
                  <td>{p.description}</td>
                  <td class="r">
                    <Money cents={p.cost_cents} />
                  </td>
                  <td class="r">
                    <Money cents={p.price_cents} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p>
        <a href={`/app/listas/${imp.id}`}>← Volver a la lista</a>
      </p>
    </AppLayout>,
  );
});

listRoutes.get('/:id/etiquetas', (c) => {
  const user = requireUser(c);
  const { db } = c.var.deps;
  const imp = loadImport(c);
  if (!imp) return c.notFound();
  const rows = imp.status === 'applied' ? appliedRows(db, user.orgId, imp.id) : [];
  track(db, 'labels_printed', user.orgId, user.userId, { rows: rows.length });
  const today = formatDate(new Date().toISOString());
  return c.html(
    <html lang="es-AR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Etiquetas · Remarcá</title>
        <link rel="stylesheet" href={`/static/styles.css?v=${ASSET_VERSION}`} />
        <script src={`/static/app.js?v=${ASSET_VERSION}`} defer></script>
      </head>
      <body class="labels-page">
        <div class="labels-toolbar noprint">
          <a href={`/app/listas/${imp.id}`}>← Volver</a>
          <span>{rows.length} etiquetas</span>
          <button class="btn" type="button" data-print>
            Imprimir
          </button>
        </div>
        {rows.length === 0 ? <p class="noprint">Las etiquetas se generan con los productos de una lista aplicada.</p> : null}
        <div class="labels">
          {rows.map((r) => (
            <div class="label">
              <div class="label__desc">{r.description || r.code}</div>
              <div class="label__price">{formatMoney(r.price)}</div>
              <div class="label__meta">
                <span>{r.code}</span>
                <span>{today}</span>
              </div>
            </div>
          ))}
        </div>
      </body>
    </html>,
  );
});
