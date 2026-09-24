import { expect, test, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { hardwareItems, nextVersion, tornilloXlsx } from '../../src/services/sample-data.js';

// Automated WCAG 2.1 A/AA checks on the main screens. Not a substitute for manual review.
async function audit(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  if (serious.length) console.log(name, JSON.stringify(serious.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target) })), null, 1));
  expect(serious, `${name}: serious a11y violations`).toEqual([]);
}

test('main screens have no serious accessibility violations', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'desktop only');
  await page.goto('/');
  await audit(page, 'landing');
  await page.goto('/registro');
  await audit(page, 'signup');
  await page.getByLabel('Tu nombre').fill('Ana');
  await page.getByLabel('Nombre del comercio').fill('Comercio A11y');
  await page.getByLabel('Email').fill(`a11y-${Date.now()}@example.com`);
  await page.getByLabel('Contraseña').fill('una-clave-segura');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await audit(page, 'dashboard');
  await page.getByRole('button', { name: 'Cargar datos de ejemplo' }).click();
  await page.goto('/app/listas/nueva');
  await audit(page, 'upload');
  await page.getByLabel('Archivo de la lista').setInputFiles({ name: 'l.xlsx', mimeType: 'application/octet-stream', buffer: tornilloXlsx(nextVersion(hardwareItems(300))) });
  await page.getByRole('button', { name: 'Subir y analizar' }).click();
  await audit(page, 'mapping');
  await page.getByRole('button', { name: 'Confirmar columnas y calcular' }).click();
  await audit(page, 'review');
  await page.goto('/app/ajustes');
  await audit(page, 'settings');
  await page.goto('/app/proveedores/nuevo');
  await audit(page, 'supplier form');
  await page.goto('/app/productos');
  await audit(page, 'products');
});
