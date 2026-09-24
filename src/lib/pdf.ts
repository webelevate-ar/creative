/**
 * Extracts a table from a text-based PDF price list.
 * Text items are grouped into lines by their y position, split into cells by horizontal gaps,
 * and aligned to the most common column layout. Scanned (image-only) PDFs are rejected.
 */
import type { Cell, Workbook } from './sheet.js';
import { FileFormatError, MAX_ROWS } from './sheet.js';

const MAX_PAGES = 300;

interface Item {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
interface PdfCell {
  text: string;
  x0: number;
  x1: number;
}

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfjsPromise: Promise<PdfJs> | null = null;
async function pdfjs(): Promise<PdfJs> {
  pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL(import.meta.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
    return m;
  });
  return pdfjsPromise;
}

function linesFromItems(items: Item[]): PdfCell[][] {
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Item[][] = [];
  for (const it of items) {
    const last = lines[lines.length - 1];
    const tol = Math.max(2, it.h * 0.45);
    if (last && Math.abs(last[0]!.y - it.y) <= tol) last.push(it);
    else lines.push([it]);
  }
  return lines.map((line) => {
    line.sort((a, b) => a.x - b.x);
    const cells: PdfCell[] = [];
    for (const it of line) {
      const charW = it.str.length ? it.w / it.str.length : it.h * 0.5;
      const prev = cells[cells.length - 1];
      const gap = prev ? it.x - prev.x1 : Infinity;
      if (prev && gap <= Math.max(3, charW * 1.6)) {
        prev.text += gap > charW * 0.2 ? ` ${it.str}` : it.str;
        prev.x1 = Math.max(prev.x1, it.x + it.w);
      } else cells.push({ text: it.str, x0: it.x, x1: it.x + it.w });
    }
    return cells.map((c) => ({ ...c, text: c.text.replace(/\s+/g, ' ').trim() })).filter((c) => c.text);
  });
}

/** Aligns lines with a different number of cells to the dominant layout, by nearest column center. */
export function alignColumns(lines: PdfCell[][]): Cell[][] {
  const counts = new Map<number, number>();
  for (const l of lines) if (l.length >= 2) counts.set(l.length, (counts.get(l.length) ?? 0) + 1);
  let mode = 0;
  let modeCount = 0;
  for (const [n, c] of counts) if (c > modeCount || (c === modeCount && n > mode)) [mode, modeCount] = [n, c];
  if (!mode) return lines.map((l) => l.map((c) => c.text));
  const sums = Array.from({ length: mode }, () => ({ x0: 0, x1: 0, n: 0 }));
  for (const l of lines) {
    if (l.length !== mode) continue;
    l.forEach((c, i) => {
      sums[i]!.x0 += c.x0;
      sums[i]!.x1 += c.x1;
      sums[i]!.n++;
    });
  }
  const cols = sums.map((s) => ({ x0: s.x0 / s.n, x1: s.x1 / s.n }));
  return lines.map((l) => {
    if (l.length === mode) return l.map((c) => c.text);
    const row: (string | null)[] = Array.from({ length: mode }, () => null);
    for (const c of l) {
      // Distance to a column: 0 if the cell overlaps it, otherwise the gap between them.
      let best = 0;
      let bestD = Infinity;
      cols.forEach((col, i) => {
        const d = c.x1 < col.x0 ? col.x0 - c.x1 : c.x0 > col.x1 ? c.x0 - col.x1 : 0;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      row[best] = row[best] ? `${row[best]} ${c.text}` : c.text;
    }
    while (row.length && row[row.length - 1] == null) row.pop();
    return row;
  });
}

export async function readPdf(buf: Uint8Array): Promise<Workbook> {
  const lib = await pdfjs();
  const task = lib.getDocument({ data: new Uint8Array(buf), useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    await task.destroy();
    if (err instanceof Error && err.name === 'PasswordException') throw new FileFormatError('El PDF está protegido con contraseña.');
    throw new FileFormatError('No pudimos leer el PDF. ¿Está dañado?');
  }
  const lines: PdfCell[][] = [];
  let truncated = false;
  try {
    const pages = Math.min(doc.numPages, MAX_PAGES);
    truncated = doc.numPages > MAX_PAGES;
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const items: Item[] = [];
      for (const raw of content.items) {
        if (!('str' in raw) || !raw.str.trim()) continue;
        const t = raw.transform as number[];
        items.push({ str: raw.str, x: t[4]!, y: t[5]!, w: raw.width, h: raw.height || Math.abs(t[3]!) || 8 });
      }
      lines.push(...linesFromItems(items));
      page.cleanup();
      if (lines.length > MAX_ROWS) {
        truncated = true;
        break;
      }
    }
  } finally {
    await task.destroy();
  }
  const nonEmpty = lines.filter((l) => l.length);
  if (nonEmpty.length < 2) throw new FileFormatError('El PDF no tiene texto seleccionable (parece escaneado). Pedile al proveedor la lista en Excel o en PDF digital.');
  return { kind: 'pdf', sheets: [{ name: 'PDF', rows: alignColumns(nonEmpty).slice(0, MAX_ROWS) }], truncated };
}
