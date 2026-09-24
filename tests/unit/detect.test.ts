import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applySavedMapping, detectColumns, extractRows, toSavedMapping } from '../../src/lib/detect.js';
import { detectDelimiter, parseCsv, readWorkbook } from '../../src/lib/sheet.js';
import { normalizeCode } from '../../src/lib/match.js';
import { hardwareItems, headerlessXlsx, mayoristaPdf, nextVersion, simplePdf, tornilloXlsx } from '../../scripts/make-fixtures.js';

const fx = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name));

describe('readWorkbook + detectColumns on realistic supplier files', () => {
  it('XLSX with letterhead, category rows, repeated header and two price columns', async () => {
    const wb = await readWorkbook('lista.xlsx', tornilloXlsx(hardwareItems(300)));
    const rows = wb.sheets[0]!.rows;
    const d = detectColumns(rows);
    expect(d.headerRow).toBe(4);
    expect(d.code).toBe(0);
    expect(d.description).toBe(1);
    expect(d.price).toBe(3); // "Precio Lista" preferred over "Precio c/IVA"
    expect(d.pack).toBe(2);
    expect(d.priceCandidates).toContain(4);
    expect(d.confidence).toBe('high');
    const { items, skipped } = extractRows(rows, d);
    expect(items).toHaveLength(300);
    expect(skipped).toBeGreaterThan(0); // category rows, repeated header, footer
    expect(items[0]).toMatchObject({ code: 'TOR-0001', pack: 1 });
    expect(items.every((i) => i.price != null && i.price > 0)).toBe(true);
  });

  it('Windows-1252 CSV with ";" and "$ 1.234,56" text prices', async () => {
    const wb = await readWorkbook('electro.csv', fx('electro-sur.csv'));
    const rows = wb.sheets[0]!.rows;
    expect(String(rows[1]![1])).toMatch(/Tornillo/);
    const d = detectColumns(rows);
    expect(d).toMatchObject({ headerRow: 0, code: 0, description: 1, price: 2, decimal: ',' });
    const { items } = extractRows(rows, d);
    expect(items).toHaveLength(120);
    expect(items[0]!.code).toBe('000001');
    expect(items[0]!.price).toBeGreaterThan(500);
    expect(items.some((i) => i.description.includes('N°'))).toBe(true); // latin1 decoded
  });

  it('legacy .xls with US-formatted text prices', async () => {
    const wb = await readWorkbook('sanitarios.xls', fx('sanitarios-del-plata.xls'));
    expect(wb.kind).toBe('xls');
    const rows = wb.sheets[0]!.rows;
    const d = detectColumns(rows);
    expect(d).toMatchObject({ headerRow: 0, code: 0, description: 1, price: 3, decimal: '.' });
    const { items } = extractRows(rows, d);
    expect(items).toHaveLength(80);
    const expected = hardwareItems(80, 9)[0]!.price / 1000;
    expect(items[0]!.price).toBeCloseTo(Number(expected.toFixed(2)), 2);
  });

  it('header-less file detected by content', async () => {
    const wb = await readWorkbook('x.xlsx', headerlessXlsx(hardwareItems(60, 11)));
    const d = detectColumns(wb.sheets[0]!.rows);
    expect(d).toMatchObject({ headerRow: -1, code: 0, description: 1, price: 2 });
    expect(d.confidence).toBe('medium');
    expect(extractRows(wb.sheets[0]!.rows, d).items).toHaveLength(60);
  });

  it('re-applies a saved mapping when the supplier moves columns', async () => {
    const v1 = (await readWorkbook('a.xlsx', tornilloXlsx(hardwareItems(50)))).sheets[0]!.rows;
    const saved = toSavedMapping(detectColumns(v1), v1);
    // Supplier adds a column at the start and two letterhead rows.
    const moved = [['NUEVO MEMBRETE'], [], ...v1.map((r) => ['x', ...r])];
    const m = applySavedMapping(moved, saved);
    expect(m).toMatchObject({ headerRow: 6, code: 1, description: 2, price: 4, pack: 3 });
  });

  it('text PDF: multi-page, repeated headers, right-aligned AR prices', async () => {
    const items = hardwareItems(100, 13);
    const wb = await readWorkbook('lista.pdf', mayoristaPdf(items));
    expect(wb.kind).toBe('pdf');
    const rows = wb.sheets[0]!.rows;
    const d = detectColumns(rows);
    expect(d).toMatchObject({ code: 0, description: 1, price: 2, decimal: ',' });
    const { items: got } = extractRows(rows, d);
    expect(got).toHaveLength(100);
    got.forEach((g, i) => {
      expect(g.code).toBe(items[i]!.code);
      expect(g.price).toBeCloseTo(items[i]!.price, 2);
    });
  });

  it('rejects image-only (scanned) PDFs with guidance', async () => {
    await expect(readWorkbook('scan.pdf', simplePdf([[]]))).rejects.toThrow(/escaneado/);
    await expect(readWorkbook('bad.pdf', Buffer.from('%PDF-1.4 garbage'))).rejects.toThrow(/PDF/);
  });

  it('rejects unsupported and empty files with a friendly error', async () => {
    await expect(readWorkbook('a.docx', Buffer.from('hello'))).rejects.toThrow(/Formato no soportado/);
    await expect(readWorkbook('a.csv', Buffer.alloc(0))).rejects.toThrow(/vacío/);
    await expect(readWorkbook('a.xlsx', Buffer.from('PK\u0003\u0004garbage'))).rejects.toThrow(/No pudimos leer/);
  });

  it('keeps working when a version adds and removes items', async () => {
    const v2 = nextVersion(hardwareItems(300));
    const rows = (await readWorkbook('v2.xlsx', tornilloXlsx(v2))).sheets[0]!.rows;
    const { items } = extractRows(rows, detectColumns(rows));
    expect(items).toHaveLength(v2.length);
    expect(items.find((i) => i.code === 'TOR-9001')).toBeTruthy();
  });
});

describe('csv helpers', () => {
  it('parses quoted fields and detects delimiters', () => {
    expect(parseCsv('a;"b;c";"d ""e"""\n1;2;3', ';')).toEqual([['a', 'b;c', 'd "e"'], ['1', '2', '3']]);
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a;b;c\n1,5;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\n1\t2')).toBe('\t');
  });
});

describe('normalizeCode', () => {
  it('ignores case, punctuation, spaces and leading zeros', () => {
    expect(normalizeCode('tor-0001')).toBe('TOR0001');
    expect(normalizeCode(' 00123 ')).toBe('123');
    expect(normalizeCode(123)).toBe('123');
    expect(normalizeCode('0')).toBe('0');
    expect(normalizeCode('Ñ-12/b')).toBe('N12B');
  });
});
