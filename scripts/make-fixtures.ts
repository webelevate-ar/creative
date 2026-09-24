/**
 * Generates realistic, messy supplier price lists used by tests and demos.
 * Deterministic (seeded) so tests are stable. Run: npm run fixtures
 */
import * as XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hardwareItems, nextVersion, tornilloXlsx, type FixtureItem } from '../src/services/sample-data.js';

export { hardwareItems, nextVersion, tornilloXlsx, type FixtureItem };

export const FIXTURE_DIR = join(process.cwd(), 'tests', 'fixtures');

function arNumber(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function usNumber(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Windows-1252 CSV with ';' and AR-formatted text prices with "$ " — typical Excel export on Spanish Windows. */
export function electroCsv(items: FixtureItem[]): Buffer {
  const lines = ['Art.;Detalle;Precio', ...items.map((it) => `${it.code.replace('TOR-', '00')};${/[";]/.test(it.description) ? `"${it.description.replace(/"/g, '""')}"` : it.description};$ ${arNumber(it.price)}`)];
  const text = lines.join('\r\n');
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    bytes[i] = c < 256 ? c : 63;
  }
  return Buffer.from(bytes);
}

/** Legacy .xls (BIFF8) with US-formatted text prices and a brand column. */
export function sanitariosXls(items: FixtureItem[]): Buffer {
  const aoa: (string | number | null)[][] = [['COD ART', 'DESCRIPCION', 'MARCA', 'PRECIO U$S']];
  items.forEach((it, i) => aoa.push([it.code.replace('TOR-', 'SP'), it.description, ['FV', 'Ferrum', 'Roca'][i % 3]!, usNumber(it.price / 1000)]));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Hoja1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'biff8' }) as Buffer;
}

/** No header row at all: code, description, price as numbers. */
export function headerlessXlsx(items: FixtureItem[]): Buffer {
  const aoa = items.map((it) => [it.code, it.description, it.price]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** Store catalog as exported from a POS: own code, supplier, supplier code, cost, price. */
export function catalogCsv(items: FixtureItem[], supplier = 'Distribuidora El Tornillo'): Buffer {
  const lines = ['Código;Descripción;Proveedor;Cód. Proveedor;Costo;Precio Venta'];
  items.forEach((it, i) => {
    const cost = it.price * 0.7;
    lines.push(`P${String(i + 1).padStart(5, '0')};${it.description};${supplier};${it.code};${arNumber(cost)};${arNumber(cost * 1.4 * 1.21)}`);
  });
  return Buffer.from(lines.join('\n'), 'utf-8');
}

/** Minimal text PDF writer (Helvetica, WinAnsi) — enough to emulate supplier PDF price lists. */
export function simplePdf(pages: { x: number; y: number; text: string; size?: number }[][]): Buffer {
  const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const objects: string[] = [];
  const fontId = 3 + pages.length * 2;
  const kids: string[] = [];
  pages.forEach((texts, i) => {
    const pageId = 3 + i * 2;
    const contentId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    const stream = texts.map((t) => `BT /F1 ${t.size ?? 9} Tf ${t.x.toFixed(2)} ${t.y.toFixed(2)} Td (${esc(t.text)}) Tj ET`).join('\n');
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  });
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(out, 'latin1');
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** Width of a string in Helvetica at `size` (digits and punctuation are exact; letters approximate). */
function helvWidth(text: string, size: number): number {
  let w = 0;
  for (const c of text) w += /\d/.test(c) ? 0.556 : /[.,]/.test(c) ? 0.278 : c === ' ' ? 0.278 : c === '$' ? 0.556 : 0.52;
  return w * size;
}

/** Multi-page PDF list: title, repeated header per page, right-aligned AR prices, page footer. */
export function mayoristaPdf(items: FixtureItem[]): Buffer {
  const perPage = 45;
  const pages: { x: number; y: number; text: string; size?: number }[][] = [];
  for (let p = 0; p * perPage < items.length; p++) {
    const t: { x: number; y: number; text: string; size?: number }[] = [
      { x: 40, y: 800, text: 'MAYORISTA LOS ANDES - LISTA DE PRECIOS', size: 12 },
      { x: 40, y: 784, text: 'Precios con IVA incluido. Vigencia: 20/09/2026' },
      { x: 40, y: 760, text: 'Código' },
      { x: 120, y: 760, text: 'Descripción' },
      { x: 510, y: 760, text: 'Precio' },
    ];
    items.slice(p * perPage, (p + 1) * perPage).forEach((it, i) => {
      const y = 744 - i * 15;
      const price = `$ ${arNumber(it.price)}`;
      t.push({ x: 40, y, text: it.code }, { x: 120, y, text: it.description }, { x: 545 - helvWidth(price, 9), y, text: price });
    });
    t.push({ x: 280, y: 30, text: `Página ${p + 1}` });
    pages.push(t);
  }
  return simplePdf(pages);
}

if (process.argv[1] && process.argv[1].endsWith('make-fixtures.ts')) {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const v1 = hardwareItems(300);
  const v2 = nextVersion(v1);
  writeFileSync(join(FIXTURE_DIR, 'el-tornillo-v1.xlsx'), tornilloXlsx(v1));
  writeFileSync(join(FIXTURE_DIR, 'el-tornillo-v2.xlsx'), tornilloXlsx(v2, 'Lista N° 46 - Vigencia 01/10/2026'));
  writeFileSync(join(FIXTURE_DIR, 'electro-sur.csv'), electroCsv(hardwareItems(120, 7)));
  writeFileSync(join(FIXTURE_DIR, 'sanitarios-del-plata.xls'), sanitariosXls(hardwareItems(80, 9)));
  writeFileSync(join(FIXTURE_DIR, 'sin-encabezado.xlsx'), headerlessXlsx(hardwareItems(60, 11)));
  writeFileSync(join(FIXTURE_DIR, 'catalogo-comercio.csv'), catalogCsv(v1));
  writeFileSync(join(FIXTURE_DIR, 'mayorista-los-andes.pdf'), mayoristaPdf(hardwareItems(100, 13)));
  console.log('Fixtures written to', FIXTURE_DIR);
}
