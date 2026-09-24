import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { hardwareItems, nextVersion, tornilloXlsx } from '../../src/services/sample-data.js';

const shot = async (page: Page, name: string, fullPage = false) => {
  const project = test.info().project.name;
  await page.screenshot({ path: `docs/screenshots/${project}-${name}.png`, fullPage });
};

async function signup(page: Page, email: string) {
  await page.goto('/registro');
  await page.getByLabel('Tu nombre').fill('Ana Pérez');
  await page.getByLabel('Nombre del comercio').fill('Ferretería La Esquina');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill('una-clave-segura');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

test('landing explains the product without fake social proof', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu proveedor aumentó');
  await expect(page.getByText('Ejemplo con datos ficticios')).toBeVisible();
  await expect(page.locator('#precios')).toContainText('Comercio');
  // No horizontal page scroll at this viewport.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await shot(page, 'landing', true);
});

test('signup validation shows field errors', async ({ page }) => {
  await page.goto('/registro');
  await page.getByLabel('Tu nombre').fill('A');
  await page.getByLabel('Email').fill('no-es-email');
  await page.getByLabel('Contraseña').fill('123');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Ingresá tu nombre.')).toBeVisible();
  await expect(page.getByText('Ingresá un email válido.')).toBeVisible();
  await expect(page.getByText('al menos 8 caracteres')).toBeVisible();
});

test('full flow: demo data → upload list → map → review → apply → export → labels → undo', async ({ page }) => {
  const email = `e2e-${test.info().project.name}-${Date.now()}@example.com`;
  await signup(page, email);
  await expect(page.getByRole('heading', { name: 'Primeros pasos' })).toBeVisible();
  await shot(page, 'dashboard-empty');

  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await expect(page.getByText('Cargamos 300 productos de ejemplo')).toBeVisible();

  // Upload the "new list" from the demo supplier.
  await page.goto('/app/listas/nueva');
  await page.getByLabel('Proveedor').selectOption({ label: 'Ejemplo: Distribuidora El Tornillo' });
  await page.getByLabel('Archivo de la lista').setInputFiles({
    name: 'lista-el-tornillo.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: tornilloXlsx(nextVersion(hardwareItems(300)), 'Lista N° 46'),
  });
  await page.getByRole('button', { name: 'Subir y analizar' }).click();

  // First list of this supplier → confirm the detected columns.
  await expect(page.getByText('Confirmá qué hay en cada columna')).toBeVisible();
  await expect(page.getByLabel('Código del proveedor *')).toHaveValue('0');
  await expect(page.getByLabel('Precio *')).toHaveValue('3');
  await shot(page, 'mapping');
  await page.getByRole('button', { name: 'Confirmar columnas y calcular' }).click();

  // Review.
  await expect(page.getByText('productos en la lista')).toBeVisible();
  const toApply = page.getByRole('button', { name: /Aplicar \d+ cambios/ });
  await expect(toApply).toBeEnabled();
  await expect(page.locator('.stat--bad')).toBeVisible(); // some products are sold below the new cost
  await shot(page, 'review');
  await page.locator('table.review').scrollIntoViewIfNeeded();
  await shot(page, 'review-table');

  // Look at the new products and create them.
  await page.getByRole('link', { name: 'Nuevos' }).click();
  await expect(page.getByText('TOR-9001')).toBeVisible();
  await page.getByRole('button', { name: 'Crear todos como productos nuevos' }).click();
  await expect(page.getByText('2 filas actualizadas.')).toBeVisible();

  // Apply (confirm dialog).
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /Aplicar \d+ cambios/ }).click();
  await expect(page.getByText(/Precios actualizados: \d+ productos, 2 creados/)).toBeVisible();
  await shot(page, 'applied');

  // Export for the POS.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: /Descargar archivo para tu sistema/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  const csv = readFileSync((await download.path())!, 'utf8');
  expect(csv).toContain('Código;Descripción;Costo;Precio');

  // Labels.
  await page.getByRole('link', { name: 'Imprimir etiquetas' }).click();
  await expect(page.locator('.label').first()).toBeVisible();
  await shot(page, 'labels');
  await page.goBack();

  // Undo.
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Deshacer esta actualización' }).click();
  await expect(page.getByText(/Deshecho\. \d+ productos restaurados, 2 borrados/)).toBeVisible();

  // Second upload of the same supplier: format is remembered.
  await page.goto('/app/listas/nueva');
  await page.getByLabel('Proveedor').selectOption({ label: 'Ejemplo: Distribuidora El Tornillo' });
  await page.getByLabel('Archivo de la lista').setInputFiles({ name: 'otra.xlsx', mimeType: 'application/octet-stream', buffer: tornilloXlsx(nextVersion(hardwareItems(300))) });
  await page.getByRole('button', { name: 'Subir y analizar' }).click();
  await expect(page.getByText('Reconocimos el formato de este proveedor')).toBeVisible();

  // Product page shows history.
  await page.goto('/app/productos?q=EJ0001');
  await page.getByRole('link', { name: 'EJ0001' }).click();
  await expect(page.getByRole('heading', { name: 'Historial de precios' })).toBeVisible();
  await expect(page.getByText('Lista de proveedor').first()).toBeVisible();
  await shot(page, 'product');

  // Dashboard after use.
  await page.goto('/app');
  await shot(page, 'dashboard');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('supplier form validates discounts and USD rate', async ({ page }) => {
  await signup(page, `e2e-sup-${test.info().project.name}-${Date.now()}@example.com`);
  await page.goto('/app/proveedores/nuevo');
  await page.getByLabel('Nombre del proveedor').fill('Importadora Sur');
  await page.getByLabel('Bonificaciones sobre la lista').fill('30+abc');
  await page.getByLabel('Moneda de la lista').selectOption('USD');
  await page.getByRole('button', { name: 'Crear proveedor' }).click();
  await expect(page.getByText('Las bonificaciones se escriben así: 30+10+5')).toBeVisible();
  await page.getByLabel('Bonificaciones sobre la lista').fill('30+10');
  await page.getByLabel('Cotización del dólar (si la lista está en USD)').fill('1540');
  await page.getByRole('button', { name: 'Crear proveedor' }).click();
  await expect(page).toHaveURL(/\/app\/listas\/nueva\?proveedor=\d+/);
  await expect(page.getByText('Proveedor "Importadora Sur" creado')).toBeVisible();
});

test('bad file shows a friendly error and nothing breaks', async ({ page }) => {
  await signup(page, `e2e-bad-${test.info().project.name}-${Date.now()}@example.com`);
  await page.goto('/app/proveedores/nuevo');
  await page.getByLabel('Nombre del proveedor').fill('Proveedor X');
  await page.getByRole('button', { name: 'Crear proveedor' }).click();
  await page.getByLabel('Archivo de la lista').setInputFiles({ name: 'foto.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) });
  await page.getByRole('button', { name: 'Subir y analizar' }).click();
  await expect(page.getByText('Formato no soportado')).toBeVisible();
  await page.getByLabel('Archivo de la lista').setInputFiles({ name: 'rota.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK\u0003\u0004 esto no es un excel') });
  await page.getByRole('button', { name: 'Subir y analizar' }).click();
  await expect(page.getByText('No pudimos leer el archivo')).toBeVisible();
});

test('no catalog yet: create products from the first list, then the next list shows changes', async ({ page }) => {
  await signup(page, `e2e-nocat-${test.info().project.name}-${Date.now()}@example.com`);
  await page.goto('/app/proveedores/nuevo');
  await page.getByLabel('Nombre del proveedor').fill('Distribuidora Nueva');
  await page.getByRole('button', { name: 'Crear proveedor' }).click();
  const v1 = hardwareItems(40, 21);
  await page.getByLabel('Archivo de la lista').setInputFiles({ name: 'anterior.xlsx', mimeType: 'application/octet-stream', buffer: tornilloXlsx(v1) });
  await page.getByRole('button', { name: 'Subir y analizar' }).click();
  await page.getByRole('button', { name: 'Confirmar columnas y calcular' }).click();
  await page.getByRole('button', { name: 'Crear los 40 productos desde esta lista' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Aplicar 40 cambios' }).click();
  await expect(page.getByText('Se crearon 40 productos.')).toBeVisible();
  await page.goto('/app/listas/nueva');
  await page.getByLabel('Archivo de la lista').setInputFiles({ name: 'nueva.xlsx', mimeType: 'application/octet-stream', buffer: tornilloXlsx(nextVersion(v1)) });
  await page.getByRole('button', { name: 'Subir y analizar' }).click();
  await expect(page.getByText('Reconocimos el formato de este proveedor')).toBeVisible();
  await expect(page.locator('.stat--up .stat__value')).not.toHaveText('0');
});
