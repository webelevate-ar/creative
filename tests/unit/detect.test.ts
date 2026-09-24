import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applySavedMapping, detectColumns, extractRows, toSavedMapping } from '../../src/lib/detect.js';
import { detectDelimiter, parseCsv, readWorkbook, zipUncompressedSize } from '../../src/lib/sheet.js';
import { looseCode, normalizeCode } from '../../src/lib/match.js';
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

  it('does not take a description column as the code because its header says "Artículo" (real PDF, docs/20 §5)', () => {
    const rows = [
      [null, 'Artículo', 'Precio'],
      ['0127280', 'RETEN BANCADA ORIG 90X110X7 306-405', '22.890,00'],
      ['0127450', 'RETEN BANCADA 90X10X7', '27.512,47'],
      ['0127490O', 'RETEN CIGUEÑAL 85X105-88 DV6', '26.993,37'],
      ['0137020', 'SOPORTE ELASTICO COLECTOR DE MOTOR DW8', '2.778,35'],
      ['0203740', 'RETEN ARBOL LEVAS ORIG ECS 39X50-92 207/307', '19.466,37'],
    ];
    expect(detectColumns(rows)).toMatchObject({ headerRow: 0, code: 0, description: 1, price: 2 });
  });
  it('pairs the code with the price on its right when blocks repeat "Cód | Precio" (docs/20 §5)', () => {
    // Shape of a real PDF page (Bulonera Camba, Hoja 4): one block per finish; "-" where a finish does not exist.
    const rows: string[][] = [['Medida', 'Cód', 'Precio', 'Cód', 'Precio']];
    const sizes = ['3/16"', '1/4"', '5/16"', '3/8"', '7/16"', '1/2"', '9/16"', '5/8"', '3/4"', '7/8"'];
    sizes.forEach((m, i) => {
      const pulida = i % 5 < 3; // some sizes have no polished version
      rows.push([m, pulida ? `12.${i + 5}` : '-', pulida ? `${14 + i},${859 + i}` : '-', `212.${i + 5}`, `${17 + i},${88 + i}`]);
    });
    const d = detectColumns(rows);
    expect(d.code).toBe(3);
    expect(d.price).toBe(4); // was 2: the price of the polished version, a plausible but wrong price
    expect(extractRows(rows, d).items[0]).toMatchObject({ code: '212.5', rawPrice: '17,88' });
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

describe('zip bomb protection', () => {
  it('reads the declared uncompressed size of a real xlsx', () => {
    const z = zipUncompressedSize(tornilloXlsx(hardwareItems(50)))!;
    expect(z.zip64).toBe(false);
    expect(z.total).toBeGreaterThan(1000);
    expect(z.total).toBeLessThan(5_000_000);
  });

  it('rejects a small file that declares a huge uncompressed size', async () => {
    const buf = Buffer.from(tornilloXlsx(hardwareItems(5)));
    // Patch the first central directory entry to claim 1 GB uncompressed.
    const cd = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    buf.writeUInt32LE(1024 * 1024 * 1024, cd + 24);
    await expect(readWorkbook('bomb.xlsx', buf)).rejects.toThrow(/demasiado grande una vez descomprimido/);
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

describe('code keys', () => {
  it('normalizeCode (exact, may auto-match) ignores case, accents, extra spaces and leading zeros of numeric codes', () => {
    expect(normalizeCode(' tor-0001 ')).toBe('TOR-0001');
    expect(normalizeCode(' 00123 ')).toBe('123');
    expect(normalizeCode(123)).toBe('123');
    expect(normalizeCode('0')).toBe('0');
    expect(normalizeCode('Ñ-12/b')).toBe('N-12/B');
    expect(normalizeCode('EGU10020B   bl')).toBe('EGU10020B BL');
  });
  it('keeps apart real codes of different products that differ only in punctuation or spaces (docs/20 §8)', () => {
    for (const [a, b] of [['1.5.12', '15.12'], ['UN2.5CCE', 'UN25CCE'], ['INT050234', 'INT 050234'], ['AL150', 'AL-150'], ['F103801', 'F/1038-01']]) {
      expect(normalizeCode(a!)).not.toBe(normalizeCode(b!));
      expect(looseCode(a!)).toBe(looseCode(b!));
    }
  });
  it('looseCode ignores punctuation, spaces and leading zeros', () => {
    expect(looseCode('tor-0001')).toBe('TOR0001');
    expect(looseCode(' 00123 ')).toBe('123');
    expect(looseCode('Ñ-12/b')).toBe('N12B');
  });
});
