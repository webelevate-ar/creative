/**
 * Deterministic sample supplier data. Used by the in-app demo ("datos de ejemplo") and by tests.
 */
import * as XLSX from 'xlsx';

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const HARDWARE = ['Tornillo autoperforante', 'Tarugo nylon', 'Mecha acero rápido', 'Llave combinada', 'Pinza universal', 'Cinta aisladora', 'Martillo galponero', 'Destornillador philips', 'Bisagra munición', 'Candado bronce'];
const SIZES = ['6mm', '8mm', '10mm', '1/2"', '3/4"', '8x1/2', '10x3/4', 'N°8', 'N°10', '40mm'];

export interface FixtureItem { code: string; description: string; price: number; pack: number }

export function hardwareItems(n: number, seed = 1): FixtureItem[] {
  const r = rng(seed);
  const items: FixtureItem[] = [];
  for (let i = 0; i < n; i++) {
    const base = HARDWARE[i % HARDWARE.length]!;
    const size = SIZES[Math.floor(r() * SIZES.length)]!;
    items.push({
      code: `TOR-${String(i + 1).padStart(4, '0')}`,
      description: `${base} ${size} (x${[1, 10, 50, 100][i % 4]})`,
      price: Math.round((500 + r() * 90000) * 100) / 100,
      pack: [1, 6, 10, 12][i % 4]!,
    });
  }
  return items;
}

/** Same items, prices raised by a per-item factor; a few removed, a few new. */
export function nextVersion(items: FixtureItem[], seed = 2): FixtureItem[] {
  const r = rng(seed);
  const out = items
    .filter((_, i) => i % 50 !== 49)
    .map((it, i) => ({ ...it, price: Math.round(it.price * (i % 17 === 0 ? 1.18 : i % 5 === 0 ? 1 : 1 + 0.03 + r() * 0.07) * 100) / 100 }));
  out.push({ code: 'TOR-9001', description: 'Escalera aluminio 5 escalones', price: 98500, pack: 1 });
  out.push({ code: 'TOR-9002', description: 'Carretilla reforzada 90L', price: 145000, pack: 1 });
  return out;
}

/** XLSX with letterhead rows, category rows, two price columns and a repeated header mid-list. */
export function tornilloXlsx(items: FixtureItem[], title = 'Lista N° 45 - Vigencia 15/09/2026'): Buffer {
  const aoa: (string | number | null)[][] = [
    ['DISTRIBUIDORA EL TORNILLO S.A.'],
    [title],
    ['Precios expresados SIN IVA. Consulte bonificaciones.'],
    [],
    ['Código', 'Descripción', 'Unid. x caja', 'Precio Lista', 'Precio c/IVA'],
  ];
  items.forEach((it, i) => {
    if (i % 40 === 0) aoa.push([null, `RUBRO ${Math.floor(i / 40) + 1}`]);
    if (i === 120) aoa.push(['Código', 'Descripción', 'Unid. x caja', 'Precio Lista', 'Precio c/IVA']);
    aoa.push([it.code, it.description, it.pack, it.price, Math.round(it.price * 1.21 * 100) / 100]);
  });
  aoa.push([]);
  aoa.push(['Los precios pueden variar sin previo aviso.']);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Lista');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

