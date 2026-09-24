/**
 * RESEARCH ONLY (not product code). Adversarial matching experiment for docs/19-commercial-red-team.md.
 *
 * Question: when supplier lists and store catalogs name the same product differently, what can be matched
 * automatically, what goes wrong, and when must the user decide?
 *
 * The dataset is hand-built by us (both sides), so results show FAILURE MODES, not real-world accuracy.
 * Run: npx tsx scripts/research/matching-adversarial.ts
 */
import { openDb } from '../../src/db/index.js';
import { signup } from '../../src/services/auth.js';
import { createSupplier, supplierFormSchema } from '../../src/services/suppliers.js';
import { saveProduct, productFormSchema } from '../../src/services/products.js';
import { createImport, confirmMapping, getImport, listRows } from '../../src/services/imports.js';
import * as XLSX from 'xlsx';

interface Cat {
  key: string;
  desc: string;
  supplierCode?: string;
  ownNumeric: string;
}
interface Row {
  code: string;
  desc: string;
  truth: string | null; // catalog key, or null when the store does not carry it
  note: string;
}

// Store catalog (as a small ferretería would type it), including distractors.
const catalog: Cat[] = [
  { key: 'hex840z', desc: 'TORNILLO HEX 8X40 ZINC C/100', supplierCode: 'TH-840-Z', ownNumeric: '1001' },
  { key: 'hex850z', desc: 'TORNILLO HEX 8X50 ZINC C/100', supplierCode: 'TH-850-Z', ownNumeric: '1002' },
  { key: 'hex840n', desc: 'TORNILLO HEX 8X40 NEGRO C/100', supplierCode: 'TH-840-N', ownNumeric: '1003' },
  { key: 'phi840', desc: 'TORNILLO PHILLIPS 8X40 C/100', ownNumeric: '1004' },
  { key: 't840', desc: 'Tornillo 8x40', ownNumeric: '1005' },
  { key: 'autoperf', desc: 'AUTOPERF 8 X 1/2 P/MECHA (1000U)', supplierCode: 'AP-812M', ownNumeric: '1006' },
  { key: 'tarugo6', desc: 'TARUGO NYLON 6MM FISCHER C/100', supplierCode: '050106', ownNumeric: '1007' },
  { key: 'tarugo8', desc: 'TARUGO NYLON 8MM FISCHER C/100', supplierCode: '050108', ownNumeric: '1008' },
  { key: 'llave13b', desc: 'LLAVE COMB. 13 BAHCO', supplierCode: '111M-13', ownNumeric: '1009' },
  { key: 'llave13s', desc: 'LLAVE COMB 13MM STANLEY', ownNumeric: '1010' },
  { key: 'llave14s', desc: 'LLAVE COMB 14MM STANLEY', ownNumeric: '1011' },
  { key: 'cinta20', desc: 'CINTA AISL. 3M 20MTS NEGRA', ownNumeric: '1012' },
  { key: 'cinta10', desc: 'CINTA AISL. 3M 10MTS NEGRA', ownNumeric: '1013' },
  { key: 'cableR', desc: 'CABLE UNIP 2.5 ROJO ROLLO 100M', supplierCode: 'PIR-25R', ownNumeric: '1014' },
  { key: 'cableA', desc: 'CABLE UNIP 2.5 AZUL ROLLO 100M', supplierCode: 'PIR-25A', ownNumeric: '1015' },
  { key: 'disco', desc: 'DISCO CORTE 4 1/2 INOX TYROLIT', ownNumeric: '1016' },
  { key: 'mecha8', desc: 'MECHA P/HORMIGON 8 MM BOSCH', ownNumeric: '1017' },
  { key: 'pinza', desc: 'PINZA UNIV 200MM CROSSMASTER', ownNumeric: '1018' },
  { key: 'candado', desc: 'CANDADO TRABEX 40', ownNumeric: '1019' },
  { key: 'silT', desc: 'SILICONA FISCHER TRANSP. 280', ownNumeric: '1020' },
  { key: 'silB', desc: 'SILICONA FISCHER BLANCA 280', ownNumeric: '1021' },
  { key: 'membB', desc: 'MEMBRANA LIQ. SINTEPLAST 20 KG', ownNumeric: '1022' },
  { key: 'membR', desc: 'MEMBRANA LIQ. SINTEPLAST 20 KG ROJA', ownNumeric: '1023' },
  { key: 'cerr', desc: 'CERRADURA KALLAY 503', ownNumeric: '1024' },
  { key: 'clavo', desc: 'CLAVOS 2 PULG (KG)', ownNumeric: '1025' },
  { key: 'tef34', desc: 'CINTA TEFLON 3/4', ownNumeric: '1026' },
  { key: 'tef12', desc: 'CINTA TEFLON 1/2', ownNumeric: '1027' },
  { key: 'codo34', desc: 'CODO 90 3/4 FUSION ACQUA SYSTEM', ownNumeric: '1028' },
  { key: 'codo12', desc: 'CODO 90 1/2 FUSION ACQUA SYSTEM', ownNumeric: '1029' },
];

// Supplier list rows. Supplier codes are numeric for some suppliers — and may collide with the store's own numbering.
const list: Row[] = [
  { code: 'TH840Z', desc: 'Tornillo Hexagonal 8x40 Zincado Caja 100', truth: 'hex840z', note: 'code punctuation differs' },
  { code: 'TH850Z', desc: 'Tornillo Hexagonal 8x50 Zincado Caja 100', truth: 'hex850z', note: 'near-duplicate size' },
  { code: 'TH840N', desc: 'Tornillo Hexagonal 8x40 Negro Caja 100', truth: 'hex840n', note: 'color variant' },
  { code: 'AP812M', desc: 'Tornillo Autoperforante 8x1/2 Punta Mecha x 1000', truth: 'autoperf', note: 'abbreviations' },
  { code: '50106', desc: 'Tarugo Fischer S6 x 100', truth: 'tarugo6', note: 'leading zero lost + model S6 = 6mm' },
  { code: '50108', desc: 'Tarugo Fischer S8 x 100', truth: 'tarugo8', note: 'leading zero lost + model S8 = 8mm' },
  { code: '111M-13', desc: 'Llave Combinada 13mm Bahco 111M-13', truth: 'llave13b', note: 'exact code' },
  { code: '87-073', desc: 'Llave Combinada 13mm Stanley 87-073', truth: 'llave13s', note: 'no code in catalog; brand must not cross' },
  { code: '1600-20', desc: 'Cinta Aisladora 3M Temflex 1600 19mm x 20m Negra', truth: 'cinta20', note: 'length variant' },
  { code: '1600-10', desc: 'Cinta Aisladora 3M Temflex 1600 19mm x 10m Negra', truth: 'cinta10', note: 'length variant' },
  { code: 'PIR-25R', desc: 'Cable Unipolar 2,5mm Rojo x 100m Pirelli', truth: 'cableR', note: 'decimal comma' },
  { code: 'PIR-25A', desc: 'Cable Unipolar 2,5mm Azul x 100m Pirelli', truth: 'cableA', note: 'color variant' },
  { code: '1016', desc: 'Disco de Corte 115x1mm Tyrolit Inox', truth: 'disco', note: 'mm vs inches; code 1016 collides with own code 1016 (same item by luck)' },
  { code: '1009', desc: 'Mecha Widia 8mm Bosch', truth: 'mecha8', note: 'synonym widia=hormigón; code 1009 COLLIDES with own code of Bahco wrench' },
  { code: 'CM-8', desc: 'Pinza Universal 8" Crossmaster', truth: 'pinza', note: '8" = 200mm' },
  { code: 'TB40', desc: 'Candado Bronce 40mm Trabex', truth: 'candado', note: 'word order' },
  { code: 'SF280T', desc: 'Silicona Acética Transparente 280ml Fischer', truth: 'silT', note: 'color variant' },
  { code: 'SF280B', desc: 'Silicona Acética Blanca 280ml Fischer', truth: 'silB', note: 'color variant' },
  { code: 'MLS20B', desc: 'Membrana Líquida 20kg Blanca Sinteplast', truth: 'membB', note: 'catalog omits the default color' },
  { code: 'ESC7', desc: 'Escalera Aluminio 7 escalones', truth: null, note: 'store does not carry it' },
  { code: 'DWE4010', desc: 'Amoladora Angular 115mm 850W Dewalt DWE4010', truth: null, note: 'new product' },
  { code: 'K4003', desc: 'Cerradura Kallay 4003 Doble Paleta', truth: null, note: 'different model than catalog 503' },
  { code: 'CPP2', desc: 'Clavo Punta París 2" x Kg', truth: 'clavo', note: 'same unit' },
  { code: 'CPP2-25', desc: 'Clavo Punta París 2" x 25Kg', truth: 'clavo', note: 'SAME product, 25 kg sack vs per kg: price must be divided by 25' },
  { code: 'TF34', desc: 'Teflon 3/4 x 10m', truth: 'tef34', note: 'fraction' },
  { code: 'TF12', desc: 'Teflon 1/2 x 10m', truth: 'tef12', note: 'fraction variant' },
  { code: 'PPF-C34', desc: 'Codo PPF 3/4 x 90° Acqua System', truth: 'codo34', note: 'PPF = fusión' },
  { code: 'PPF-C12', desc: 'Codo PPF 1/2 x 90° Acqua System', truth: 'codo12', note: 'fraction variant' },
  { code: '1005', desc: 'Tornillo Hexagonal 8x40 Zincado x Unidad', truth: 't840', note: 'unit vs box; code collides with own code 1005 (right item by luck)' },
  { code: '1012', desc: 'Precinto Plástico 200mm x 100', truth: null, note: 'code 1012 COLLIDES with own code of 3M tape' },
];

// ------------------------------------------------------------------------------------------
// Prototype description matcher (heuristic, research only)
const ABBR: Record<string, string> = {
  hex: 'hexagonal', th: 'tornillo hexagonal', comb: 'combinada', aisl: 'aisladora', unip: 'unipolar', univ: 'universal',
  liq: 'liquida', transp: 'transparente', autoperf: 'tornillo autoperforante', widia: 'hormigon', ppf: 'fusion', zinc: 'zincado',
};
const STOP = new Set(['de', 'x', 'p', 'para', 'caja', 'c', 'rollo', 'mts', 'm', 'mm', 'u', 'ml', 'kg', 'punta', 'por', 'unidad', 'y']);
function tokens(s: string): { words: Set<string>; nums: Set<string> } {
  let t = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  t = t.replace(/(\d),(\d)/g, '$1.$2').replace(/\*/g, 'x').replace(/(\d)\s*x\s*(\d)/g, '$1x$2').replace(/[()/.,"°-]/g, (m) => (m === '/' || m === '.' ? m : ' '));
  const words = new Set<string>();
  const nums = new Set<string>();
  for (let w of t.split(/\s+/)) {
    w = w.replace(/^\.+|\.+$/g, '');
    if (!w) continue;
    const exp = ABBR[w];
    if (exp) {
      exp.split(' ').forEach((x) => words.add(x));
      continue;
    }
    if (/^\d+(x\d+)?(\.\d+)?(\/\d+)?[a-z]*$/.test(w)) {
      nums.add(w.replace(/(mm|m|kg|ml|mts|u|w)$/, ''));
      continue;
    }
    if (!STOP.has(w) && w.length > 1) words.add(w);
  }
  return { words, nums };
}
function score(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  const inter = [...A.words].filter((w) => B.words.has(w)).length;
  const union = new Set([...A.words, ...B.words]).size || 1;
  let s = inter / union;
  const numConflict = [...B.nums].some((n) => !A.nums.has(n)) && B.nums.size > 0;
  const numMatch = [...B.nums].filter((n) => A.nums.has(n)).length;
  if (numConflict) s -= 0.3;
  s += 0.15 * numMatch;
  return s;
}
function describeMatch(desc: string): { key: string | null; best: number; second: number } {
  const scored = catalog.map((c) => ({ key: c.key, s: score(desc, c.desc) })).sort((x, y) => y.s - x.s);
  const best = scored[0]!;
  const second = scored[1]!;
  // Abstain unless clearly above threshold and ahead of the runner-up.
  if (best.s < 0.45 || best.s - second.s < 0.1) return { key: null, best: best.s, second: second.s };
  return { key: best.key, best: best.s, second: second.s };
}

// ------------------------------------------------------------------------------------------
async function runEngine(scenario: 'supplier_codes' | 'own_numeric_codes') {
  const db = openDb(':memory:');
  const { orgId, userId } = await signup(db, { name: 'Lab', business: 'Lab', email: `${scenario}@lab.test`, password: 'password123' });
  const sid = createSupplier(db, orgId, supplierFormSchema.parse({ name: 'Proveedor' }), 40);
  const idByKey = new Map<string, number>();
  for (const c of catalog) {
    const id = saveProduct(
      db,
      orgId,
      null,
      productFormSchema.parse({
        code: scenario === 'supplier_codes' ? `P-${c.key}` : c.ownNumeric,
        description: c.desc,
        supplier_id: scenario === 'supplier_codes' && c.supplierCode ? String(sid) : '',
        supplier_code: scenario === 'supplier_codes' ? c.supplierCode ?? '' : '',
        cost: '100',
        price: '200',
      }),
      1000,
    );
    idByKey.set(c.key, id);
  }
  const keyById = new Map([...idByKey].map(([k, v]) => [v, k]));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Código', 'Descripción', 'Precio'], ...list.map((r) => [r.code, r.desc, 120])]), 'Lista');
  const up = await createImport(db, orgId, userId, sid, 'l.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);
  const imp = getImport(db, orgId, up.importId)!;
  await confirmMapping(db, orgId, up.importId, imp.sheet_name, JSON.parse(imp.mapping_json!));
  const rows = listRows(db, orgId, up.importId, { pageSize: 500 }).rows;
  const out = { correct: 0, wrong: [] as string[], unmatched: 0, correctNone: 0, wrongApplied: 0 };
  for (const r of rows) {
    const truth = list.find((l) => l.code === r.raw_code)!;
    const got = r.product_id != null ? keyById.get(r.product_id)! : null;
    if (got === null && truth.truth === null) out.correctNone++;
    else if (got === null) out.unmatched++;
    else if (got === truth.truth) out.correct++;
    else {
      if (r.decision === 'apply') out.wrongApplied++;
      out.wrong.push(`${r.raw_code} "${truth.desc}" → matched ${got} (${r.match_type}, default decision: ${r.decision}${r.flags.trim() ? `, flags: ${r.flags.trim()}` : ''}) — ${truth.note}`);
    }
  }
  return out;
}

async function main() {
  const carried = list.filter((r) => r.truth !== null).length;
  console.log(`Dataset: ${list.length} supplier rows (${carried} carried by the store, ${list.length - carried} not), ${catalog.length} catalog items.\n`);
  for (const scenario of ['supplier_codes', 'own_numeric_codes'] as const) {
    const r = await runEngine(scenario);
    console.log(`[Remarcá engine, ${scenario}] correct=${r.correct} unmatched(needs user)=${r.unmatched} correctly-none=${r.correctNone} WRONG=${r.wrong.length} (applied by default: ${r.wrongApplied})`);
    r.wrong.forEach((w) => console.log('   WRONG:', w));
  }
  let correct = 0;
  let abstain = 0;
  let correctNone = 0;
  const wrong: string[] = [];
  for (const r of list) {
    const m = describeMatch(r.desc);
    if (m.key === null && r.truth === null) correctNone++;
    else if (m.key === null) abstain++;
    else if (m.key === r.truth) correct++;
    else wrong.push(`"${r.desc}" → ${m.key} (score ${m.best.toFixed(2)} vs ${m.second.toFixed(2)}) — truth ${r.truth ?? 'none'}; ${r.note}`);
  }
  console.log(`\n[Prototype description matcher] correct=${correct} abstained(needs user)=${abstain} correctly-none=${correctNone} WRONG=${wrong.length}`);
  wrong.forEach((w) => console.log('   WRONG:', w));
  const packRisk = list.filter((r) => /25Kg|x Unidad/.test(r.desc)).map((r) => r.code);
  console.log(`\nUnit/pack conversion needed even when the match is right: ${packRisk.join(', ')} (not modeled per item in Remarcá today).`);
}

main();
