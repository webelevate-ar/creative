/**
 * RESEARCH ONLY (docs/21). Business simulator for Remarcá built on the real-list benchmark (docs/20).
 * Every input carries a label: FACT, OBSERVED (measured in docs/20), ASSUMPTION, ESTIMATE, UNKNOWN.
 * The three stores are a SYNTHETIC BUSINESS MODEL for sensitivity analysis: not customers, not market averages.
 * Human times are ASSUMPTION ranges (nothing was timed with people). No output is a sales forecast.
 *
 *   npx tsx scripts/research/business-sim.ts            # markdown tables to stdout
 *   OUT=sim.json npx tsx scripts/research/business-sim.ts
 */
import { writeFileSync } from 'node:fs';

type Label = 'FACT' | 'OBSERVED' | 'ASSUMPTION' | 'ESTIMATE' | 'UNKNOWN';
type Level = 'low' | 'mid' | 'high';
interface Range { low: number; mid: number; high: number; label: Label; unit: string; src: string }
interface Value { v: number; label: Label; unit: string; src: string }
const R = (low: number, mid: number, high: number, label: Label, unit: string, src: string): Range => ({ low, mid, high, label, unit, src });
const V = (v: number, label: Label, unit: string, src: string): Value => ({ v, label, unit, src });

// ---------------------------------------------------------------- evidence from docs/20 (OBSERVED) ----------
const OBS = {
  spreadsheetListsRead: V(7 / 7, 'OBSERVED', 'share of lists', 'docs/20 §5: 7/7 supplier spreadsheets read correctly (1 needed a column choice)'),
  pdfAuto: V(1 / 6, 'OBSERVED', 'share of PDF lists', 'docs/20 §5: 1/6 PDF lists correct'),
  pdfPartial: V(3 / 6, 'OBSERVED', 'share of PDF lists', 'docs/20 §5: 3/6 partial (Strada, JB, Jeluz): every row must be checked'),
  pdfFail: V(2 / 6, 'OBSERVED', 'share of PDF lists', 'docs/20 §5: 2/6 fail (Roker; Camba 37 pages)'),
  sameSupplierWrong: V(0 / 10229, 'OBSERVED', 'share of matches', 'docs/20 §7 M2: 10,229/10,229 right, 0 wrong (95% upper bound ≈ 3/10,229 = 0.03%)'),
  codeRespell: V(2 / 10231, 'OBSERVED', 'share of rows', 'docs/20 §7 M2: 2 code respellings (81.R.3,75 → 81.R.3.75), held for review'),
  crossSupplierAppliedNotCorrect: V(5 / 97, 'OBSERVED', 'share of auto-applied', 'docs/20 §7 M4: 1 incorrect + 4 ambiguous of 97 auto-applied (manufacturer code, supplier change)'),
  mixedCurrencyRows: V(8207 / 21884, 'OBSERVED', 'share of rows in a mixed list', 'docs/20 §6: JB 37.5% of rows in U$S'),
  perRowIvaRows: V(0.1, 'OBSERVED', 'share of rows in such a list', 'docs/20 §6: 6% (JB) – 13.2% (AS) – 13.6% (Cambre) at 10.5%'),
  listsWithCodes: V(13 / 13, 'OBSERVED', 'share of public supplier sources', 'docs/20 §2–§3: every supplier list had a code column (public sample, possibly biased)'),
  medianListRows: V(2273, 'OBSERVED', 'rows', 'docs/20 §3: median of the 7 supplier spreadsheets (113 … 21,884)'),
  secondsPerRow: V(2.68 / 32892, 'OBSERVED', 's/row', 'docs/20 §13: 32,892 rows, next list end to end 2.68 s (4 vCPU)'),
  newCodesShare: V(107 / 10341, 'OBSERVED', 'share of list rows', 'docs/20 §10: Camba 107 codes new vs the old-code map (not a month-to-month diff)'),
};

// ---------------------------------------------------------------- economics inputs --------------------------
const ECO = {
  usdArs: V(1540, 'FACT', 'ARS/USD', 'BNA 24-Sep-2026 (docs/02, docs/14)'),
  fees: V(0.03, 'ESTIMATE', 'share of revenue', 'docs/14: Mercado Pago ≈6% / transfer 0%, 50/50 blend (A)'),
  hostingSmall: V(15000, 'ESTIMATE', 'ARS/month', 'docs/14: hosting+tools up to 100 accounts'),
  hostingLarge: V(60000, 'ESTIMATE', 'ARS/month', 'docs/14: hosting+tools at 500 accounts'),
  accountant: V(100000, 'ASSUMPTION', 'ARS/month', 'docs/14'),
  monotributoCapMonthly: V(126610838 / 12, 'FACT', 'ARS/month', 'docs/14: category K cap ARS 126.6M/yr'),
  adminMonthlyLoaded: V(1900000, 'ESTIMATE', 'ARS/month', 'docs/14: CCT 130/75 Admin A basic 1.318M (FACT) + contributions (A)'),
  paidHoursPerMonth: V(160, 'ASSUMPTION', 'h/month', '40 h/week'),
  productiveShare: V(0.75, 'ASSUMPTION', 'share', 'breaks, admin, context switches'),
  founderHourCost: V(10000, 'ASSUMPTION', 'ARS/h', 'docs/14 founder opportunity cost'),
  founderIncomeTarget: V(1600 * 1540, 'ASSUMPTION', 'ARS/month', 'docs/14: founder alternative ≈ USD 1,600/month from web projects'),
  founderHoursAvailable: V(120, 'ASSUMPTION', 'h/month', 'one full-time person, productive hours'),
};
const clientHourValue = ECO.adminMonthlyLoaded.v / ECO.paidHoursPerMonth.v; // ESTIMATE: what an hour of staff time costs the store
const hiredProductiveHourCost = ECO.adminMonthlyLoaded.v / (ECO.paidHoursPerMonth.v * ECO.productiveShare.v);

const SENS = {
  churn: R(0.03, 0.05, 0.1, 'ASSUMPTION', 'monthly logo churn', 'docs/14 used 4%; no retention data (UNKNOWN)'),
  salesHoursPerClient: R(6.7, 13, 27, 'ASSUMPTION', 'founder h per new paying client', 'docs/14 ESTIMATE 20 h → 3 clients (6.7 h); higher values if conversion is lower'),
  saasSupportMin: R(15, 45, 90, 'ASSUMPTION', 'min per account-month', 'docs/14 base 15; docs/17 R11'),
  serviceCommsMin: R(15, 30, 60, 'ASSUMPTION', 'min per client-month', 'WhatsApp back-and-forth, delivery, questions'),
};

// ---------------------------------------------------------------- human times (all ASSUMPTION) --------------
const T = {
  listRemarca: R(5, 15, 30, 'ASSUMPTION', 'min per list', 'receive, upload, check columns, read summary, export (docs/19 uses ≤20 min as a GO threshold, not a measure)'),
  splitCurrency: R(10, 20, 40, 'ASSUMPTION', 'min per mixed-currency list', 'manual workaround: split the file by currency (docs/20 §6, F4)'),
  review: R(10, 20, 40, 'ASSUMPTION', 's per held row', 'read flag, compare, decide'),
  manual: R(30, 60, 120, 'ASSUMPTION', 's per manual row', 'find the item, read the price in the list/PDF, type it'),
  newProduct: R(30, 60, 120, 'ASSUMPTION', 's per new product', 'decide whether to carry it; create or skip'),
  clientImport: R(5, 10, 20, 'ASSUMPTION', 'min per list', 'import the delivered file into the POS (client side, every model)'),
  setup: R(30, 60, 120, 'ASSUMPTION', 'min per client', 'catalog import, suppliers, rules, export format (docs/14: 1.5 h)'),
  link: R(20, 45, 60, 'ASSUMPTION', 's per uncoded catalog item', 'docs/19 §8 ESTIMATE 30–60 s with today’s search-box UI'),
  ivaItem: R(15, 30, 60, 'ASSUMPTION', 's per 10.5% item', 'set the product IVA one by one (catalog import has no IVA column: FACT, code)'),
  // Without Remarcá — competent Excel user with VLOOKUP and a mapping sheet (same one-time mapping as Remarcá's links)
  excelTasks: {
    'Descargar la lista': [1, 3, 10],
    'Abrir el archivo': [1, 2, 5],
    'Identificar columnas': [2, 5, 15],
    'Comparar precios (BUSCARV)': [5, 15, 40],
    'Detectar productos nuevos': [3, 10, 30],
    'Detectar productos eliminados': [3, 10, 30],
    'Aplicar IVA': [2, 5, 15],
    'Aplicar bonificaciones': [2, 5, 15],
    'Calcular margen': [3, 10, 25],
    'Revisar errores': [5, 15, 40],
    'Exportar': [1, 5, 10],
    'Importar al sistema': [2, 5, 15],
  } as Record<string, [number, number, number]>,
  // Without Remarcá — no spreadsheet skills: update each price in the POS by hand
  manualListOverhead: R(10, 20, 40, 'ASSUMPTION', 'min per list', 'read the list, work out IVA/discount factors'),
  manualPosRow: R(15, 30, 60, 'ASSUMPTION', 's per row', 'find the product in the POS and type the new price'),
};
const excelListMin = (lv: Level) => Object.values(T.excelTasks).reduce((a, t) => a + t[lv === 'low' ? 0 : lv === 'mid' ? 1 : 2], 0);

// ---------------------------------------------------------------- SYNTHETIC BUSINESS MODEL stores -----------
type Match = 'opt' | 'mid' | 'pess';
interface Store {
  id: 'A' | 'B' | 'C';
  name: string;
  skus: number;
  suppliers: number;
  listsPerSupplierMonth: number;
  pdfListShare: number;
  mixedCurrencyListShare: number;
  perRowIvaListShare: number;
  codeCoverage: Record<Match, number>;
}
const STORES: Store[] = [
  { id: 'A', name: 'Pequeño', skus: 1000, suppliers: 2, listsPerSupplierMonth: 1, pdfListShare: 0, mixedCurrencyListShare: 0, perRowIvaListShare: 0, codeCoverage: { opt: 0.95, mid: 0.85, pess: 0.6 } },
  { id: 'B', name: 'Mediano', skus: 3000, suppliers: 4, listsPerSupplierMonth: 1, pdfListShare: 0.25, mixedCurrencyListShare: 0, perRowIvaListShare: 0.25, codeCoverage: { opt: 0.8, mid: 0.5, pess: 0.2 } },
  { id: 'C', name: 'Grande', skus: 10000, suppliers: 8, listsPerSupplierMonth: 2, pdfListShare: 0.375, mixedCurrencyListShare: 0.125, perRowIvaListShare: 0.5, codeCoverage: { opt: 0.6, mid: 0.3, pess: 0.1 } },
];
/** What the benchmark shows Remarcá does well: spreadsheets, every list with codes, one currency. */
const clean = (s: Store): Store => ({ ...s, pdfListShare: 0, mixedCurrencyListShare: 0 });
// Matching sensitivity (all ASSUMPTION except the OBSERVED anchors noted in the doc).
const MATCH: Record<Match, { listsWithoutCodes: number; flagged: number; newShare: number }> = {
  opt: { listsWithoutCodes: 0, flagged: 0.02, newShare: 0.005 },
  mid: { listsWithoutCodes: 0.1, flagged: 0.05, newShare: 0.01 },
  pess: { listsWithoutCodes: 0.3, flagged: 0.15, newShare: 0.03 },
};

interface Workload {
  breakdown: Record<string, number>;
  lists: number;
  storeRows: number;
  listRowsProcessed: number;
  machineSeconds: number;
  rows: { automatic: number; review: number; manual: number; unsupported: number; newProducts: number };
  hours: {
    remarcaOperator: number; // everything a person does with Remarcá except the POS import
    remarcaReviewOnly: number; // review + manual + unsupported + new products (no per-list mechanics)
    clientImport: number;
    excel: number;
    manualPos: number;
    onboardingRemarca: number;
    onboardingExcelMapping: number;
  };
}

function workload(s: Store, m: Match, lv: Level, cleanInputs = false): Workload {
  const mt = cleanInputs ? { ...MATCH[m], listsWithoutCodes: 0 } : MATCH[m];
  if (cleanInputs) s = clean(s);
  const lists = s.suppliers * s.listsPerSupplierMonth;
  const perList = s.skus / s.suppliers;
  const storeRows = s.skus * s.listsPerSupplierMonth;
  const rows = { automatic: 0, review: 0, manual: 0, unsupported: 0, newProducts: 0 };
  const pdfLists = lists * s.pdfListShare;
  const sheetLists = lists - pdfLists;
  // Spreadsheet lists: read 7/7 (OBSERVED). Rows of lists without codes are manual; rows in another currency are unsupported.
  const route = (n: number, listCount: number) => {
    const noCode = listCount * mt.listsWithoutCodes * n;
    rows.manual += noCode;
    const coded = listCount * (1 - mt.listsWithoutCodes) * n;
    const otherCurrency = coded * s.mixedCurrencyListShare * OBS.mixedCurrencyRows.v;
    rows.unsupported += otherCurrency;
    const matchable = coded - otherCurrency;
    const held = matchable * (mt.flagged + OBS.codeRespell.v);
    rows.review += held;
    rows.automatic += matchable - held;
    rows.newProducts += listCount * n * mt.newShare;
  };
  route(perList, sheetLists);
  // PDF lists: OBSERVED list outcomes — correct lists behave like spreadsheets, partial lists are checked row by row, failed lists are typed.
  route(perList, pdfLists * OBS.pdfAuto.v);
  rows.review += pdfLists * OBS.pdfPartial.v * perList;
  rows.manual += pdfLists * OBS.pdfFail.v * perList;

  const t = (r: Range) => r[lv];
  // Unsupported rows (other currency) are not typed one by one: the file is split by currency (per-list workaround).
  const splitH = (lists * s.mixedCurrencyListShare * t(T.splitCurrency)) / 60;
  const pdfPartialRows = pdfLists * OBS.pdfPartial.v * perList;
  const pdfFailRows = pdfLists * OBS.pdfFail.v * perList;
  const breakdown: Record<string, number> = {
    'Per-list mechanics (upload, check, export)': (lists * t(T.listRemarca)) / 60,
    'Review of held rows (flags, respellings)': ((rows.review - pdfPartialRows) * t(T.review)) / 3600,
    'Checking rows of partially read PDFs': (pdfPartialRows * t(T.review)) / 3600,
    'Typing rows of unreadable PDFs': (pdfFailRows * t(T.manual)) / 3600,
    'Typing rows of lists without codes': ((rows.manual - pdfFailRows) * t(T.manual)) / 3600,
    'New products (decide, create)': (rows.newProducts * t(T.newProduct)) / 3600,
    'Mixed-currency workaround (split file)': splitH,
  };
  const remarcaOperator = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const remarcaReviewOnly = remarcaOperator - breakdown['Per-list mechanics (upload, check, export)']!;
  const clientImport = (lists * t(T.clientImport)) / 60;
  // Excel baseline: same automatic matching on coded rows (VLOOKUP), more per-list overhead, PDFs typed, same new-product decisions.
  const excelManualRows = sheetLists * mt.listsWithoutCodes * perList + pdfLists * perList;
  const excel = (lists * excelListMin(lv)) / 60 + (excelManualRows * t(T.manual) + rows.newProducts * t(T.newProduct)) / 3600 + splitH;
  const manualPos = (lists * t(T.manualListOverhead)) / 60 + (storeRows * t(T.manualPosRow) + rows.newProducts * t(T.newProduct)) / 3600;
  const uncoded = s.skus * (1 - s.codeCoverage[m]);
  const ivaItems = s.skus * s.perRowIvaListShare * OBS.perRowIvaRows.v;
  const onboardingRemarca = t(T.setup) / 60 + (uncoded * t(T.link) + ivaItems * t(T.ivaItem)) / 3600;
  const onboardingExcelMapping = (uncoded * t(T.link)) / 3600; // a competent Excel user builds the same code map once
  const listRowsProcessed = lists * OBS.medianListRows.v;
  return {
    breakdown,
    lists,
    storeRows,
    listRowsProcessed,
    machineSeconds: listRowsProcessed * OBS.secondsPerRow.v,
    rows,
    hours: { remarcaOperator, remarcaReviewOnly, clientImport, excel, manualPos, onboardingRemarca, onboardingExcelMapping },
  };
}

// ---------------------------------------------------------------- business models ---------------------------
const PRICES = [15000, 30000, 50000, 75000, 100000]; // ARS/month — mathematical scenarios requested, NOT validated prices
const CLIENTS = [10, 50, 100, 500];

function fixedCosts(n: number) {
  const hosting = n <= 100 ? ECO.hostingSmall.v : ECO.hostingLarge.v;
  const accountant = n <= 100 ? ECO.accountant.v : 2 * ECO.accountant.v;
  return hosting + accountant;
}

/** Staff cost when the founder's hours are exceeded (founder hours are not paid cash; they are the opportunity cost). */
function staffing(hours: number) {
  const extra = Math.max(0, hours - ECO.founderHoursAvailable.v);
  return { hires: Math.ceil(extra / (ECO.paidHoursPerMonth.v * ECO.productiveShare.v)), cost: Math.ceil(extra / (ECO.paidHoursPerMonth.v * ECO.productiveShare.v)) * ECO.adminMonthlyLoaded.v };
}

interface ScaleRow { model: string; store: string; price: number; clients: number; revenue: number; hours: { recurring: number; onboarding: number; sales: number; total: number }; hires: number; cash: number; overCap: boolean; founderTargetMet: boolean }

function scale(model: 'saas' | 'service' | 'hybrid2', s: Store, price: number, n: number, m: Match, lv: Level, churnLv: Level, salesLv: Level, supportLv: Level, cleanInputs = false): ScaleRow {
  const w = workload(s, m, lv, cleanInputs);
  const churn = SENS.churn[churnLv];
  const newPerMonth = n * churn;
  const recurringPerClient =
    model === 'service'
      ? w.hours.remarcaOperator + SENS.serviceCommsMin[lv] / 60
      : model === 'hybrid2'
        ? w.hours.remarcaReviewOnly + SENS.serviceCommsMin[lv] / 120
        : SENS.saasSupportMin[supportLv] / 60;
  const onboardingPerClient = model === 'saas' ? T.setup[lv] / 60 : w.hours.onboardingRemarca;
  const hours = { recurring: n * recurringPerClient, onboarding: newPerMonth * onboardingPerClient, sales: newPerMonth * SENS.salesHoursPerClient[salesLv], total: 0 };
  hours.total = hours.recurring + hours.onboarding + hours.sales;
  const revenue = n * price;
  const st = staffing(hours.total);
  const cash = revenue * (1 - ECO.fees.v) - fixedCosts(n) - st.cost;
  return { model, store: s.id, price, clients: n, revenue, hours, hires: st.hires, cash, overCap: revenue > ECO.monotributoCapMonthly.v, founderTargetMet: cash >= ECO.founderIncomeTarget.v };
}

// ---------------------------------------------------------------- output ------------------------------------
const f0 = (x: number) => Math.round(x).toLocaleString('es-AR');
const f1 = (x: number) => x.toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const pct = (x: number) => `${(x * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;
const k = (x: number) => (Math.abs(x) >= 1e6 ? `${(x / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 2 })} M` : `${f0(x / 1000)} k`);
const out: Record<string, unknown> = {};
const lines: string[] = [];
const table = (head: string[], body: (string | number)[][]) => {
  lines.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...body.map((r) => `| ${r.join(' | ')} |`), '');
};

lines.push('### Derived constants', '');
table(['Constant', 'Value', 'Label'], [
  ['Store staff hour (Admin A fully loaded / 160 h)', `ARS ${f0(clientHourValue)}`, 'ESTIMATE'],
  ['Hired operator, productive hour (1.9 M / 120 h)', `ARS ${f0(hiredProductiveHourCost)}`, 'ESTIMATE'],
  ['Founder hour (opportunity cost)', `ARS ${f0(ECO.founderHourCost.v)}`, 'ASSUMPTION'],
  ['Founder income target', `ARS ${f0(ECO.founderIncomeTarget.v)}/month`, 'ASSUMPTION'],
  ['Monotributo K cap', `ARS ${f0(ECO.monotributoCapMonthly.v)}/month`, 'FACT'],
  ['Excel per-list time (sum of tasks) low/mid/high', `${excelListMin('low')} / ${excelListMin('mid')} / ${excelListMin('high')} min`, 'ASSUMPTION'],
]);

// 1. Workload per store × matching sensitivity (mid human times)
lines.push('### Workload per store and matching case (mid human times)', '');
const wl: unknown[] = [];
const wlRows: (string | number)[][] = [];
for (const s of STORES)
  for (const m of ['opt', 'mid', 'pess'] as Match[]) {
    const w = workload(s, m, 'mid');
    wl.push({ store: s.id, match: m, ...w });
    const tot = w.rows.automatic + w.rows.review + w.rows.manual + w.rows.unsupported;
    wlRows.push([s.id, m, w.lists, f0(w.storeRows), f0(w.listRowsProcessed), f1(w.machineSeconds), pct(w.rows.automatic / tot), pct(w.rows.review / tot), pct(w.rows.manual / tot), pct(w.rows.unsupported / tot), f0(w.rows.newProducts), f1(w.hours.onboardingRemarca)]);
  }
out.workload = wl;
table(['Store', 'Match', 'Lists/mo', 'Store rows/mo', 'List rows processed/mo', 'Machine s/mo', 'Automatic', 'Review', 'Manual', 'Unsupported', 'New products/mo', 'Onboarding h (once)'], wlRows);

lines.push('### Human hours per month (store side), by human-time level (mid matching)', '');
const hrRows: (string | number)[][] = [];
for (const cl of [false, true])
for (const s of STORES)
  for (const lv of ['low', 'mid', 'high'] as Level[]) {
    const w = workload(s, 'mid', lv, cl);
    const withR = w.hours.remarcaOperator + w.hours.clientImport;
    hrRows.push([s.id, cl ? 'clean' : 'as defined', lv, f1(w.hours.manualPos), f1(w.hours.excel), f1(withR), f1(w.hours.remarcaReviewOnly), f1(w.hours.excel - withR), f1(w.hours.manualPos - withR), `ARS ${k((w.hours.excel - withR) * clientHourValue)}`, `ARS ${k((w.hours.manualPos - withR) * clientHourValue)}`]);
  }
table(['Store', 'Inputs', 'Times', 'Manual in POS h', 'Excel h', 'With Remarcá h (incl. POS import)', 'of which review/manual h', 'Saved vs Excel h', 'Saved vs manual h', 'Value of time saved vs Excel', 'vs manual'], hrRows);

lines.push('### Matching sensitivity: human hours with Remarcá (mid times)', '');
const msRows: (string | number)[][] = [];
for (const s of STORES) {
  const r = (['opt', 'mid', 'pess'] as Match[]).map((m) => workload(s, m, 'mid'));
  msRows.push([s.id, ...r.map((w) => f1(w.hours.remarcaOperator + w.hours.clientImport)), ...r.map((w) => f1(w.hours.onboardingRemarca)), ...r.map((w) => f1(w.hours.excel - w.hours.remarcaOperator - w.hours.clientImport))]);
}
table(['Store', 'Monthly h opt', 'mid', 'pess', 'Onboarding h opt', 'mid', 'pess', 'Saved vs Excel h opt', 'mid', 'pess'], msRows);

lines.push('### Where the human hours go with Remarcá (operator view, mid matching, mid times)', '');
{
  const keys = Object.keys(workload(STORES[0]!, 'mid', 'mid').breakdown);
  table(['Component', ...STORES.map((s) => `${s.id} h/mo`), ...STORES.map((s) => `${s.id} share`)], keys.map((key) => {
    const ws = STORES.map((s) => workload(s, 'mid', 'mid'));
    return [key, ...ws.map((w) => f1(w.breakdown[key]!)), ...ws.map((w) => pct(w.breakdown[key]! / w.hours.remarcaOperator))];
  }));
}

// 2. Service unit economics
const serviceUnit = (s: Store, m: Match, lv: Level, cleanInputs: boolean) => {
  const w = workload(s, m, lv, cleanInputs);
  const h = w.hours.remarcaOperator + SENS.serviceCommsMin[lv] / 60;
  const onboardAmort = w.hours.onboardingRemarca * SENS.churn.mid; // spread over the expected lifetime (1/churn months)
  const total = h + onboardAmort;
  return { w, h, onboardAmort, total, beFounder: (total * ECO.founderHourCost.v) / (1 - ECO.fees.v), beHired: (total * hiredProductiveHourCost) / (1 - ECO.fees.v), perOperator: ECO.founderHoursAvailable.v / total };
};
const svc: unknown[] = [];
for (const cleanInputs of [false, true]) {
  lines.push(cleanInputs ? '### Service unit economics — CLEAN INPUTS variant (spreadsheets only, every list with codes, one currency)' : '### Service unit economics — scenario as defined (PDF share, lists without codes, mixed currency)', '');
  const rows: (string | number)[][] = [];
  for (const s of STORES)
    for (const [m, lv] of [['opt', 'low'], ['mid', 'mid'], ['pess', 'high']] as [Match, Level][]) {
      const u = serviceUnit(s, m, lv, cleanInputs);
      svc.push({ store: s.id, clean: cleanInputs, case: `${m}/${lv}`, hoursPerClient: u.total, beFounder: u.beFounder, beHired: u.beHired, perOperator: u.perOperator });
      rows.push([s.id, `${m}/${lv}`, f1(u.h), f1(u.onboardAmort), f1(u.total), f0(u.perOperator), `ARS ${k(u.beFounder)}`, `ARS ${k(u.beHired)}`, ...PRICES.map((p) => `${f0((p * (1 - ECO.fees.v) - u.total * hiredProductiveHourCost) / 1000)} k`)]);
    }
  table(['Store', 'Case (match/times)', 'Operator h/mo', 'Onboarding h/mo (amortized)', 'Total h/client-mo', 'Clients per full-time operator', 'Break-even price at founder h', 'Break-even at hired h', ...PRICES.map((p) => `Margin/client @${f0(p / 1000)}k (hired h)`)], rows);
}
out.service = svc;

lines.push('### Service: maximum human hours per client-month that each price can pay', '');
table(['Price', 'Max h at founder cost (ARS 10k/h)', 'Max h at hired cost', 'Clients per operator at that limit'], PRICES.map((p) => {
  const hF = (p * (1 - ECO.fees.v)) / ECO.founderHourCost.v;
  const hH = (p * (1 - ECO.fees.v)) / hiredProductiveHourCost;
  return [`${f0(p / 1000)} k`, f1(hF), f1(hH), f0(ECO.founderHoursAvailable.v / hH)];
}));

// 3. SaaS unit economics (store-independent for us; the store's own hours stay with the store)
lines.push('### SaaS: our cost per account and accounts needed', '');
const saasRows: (string | number)[][] = [];
for (const supLv of ['low', 'mid', 'high'] as Level[])
  for (const p of PRICES) {
    const supportH = SENS.saasSupportMin[supLv] / 60;
    const setupAmort = (T.setup.mid / 60) * SENS.churn.mid;
    const contrib = p * (1 - ECO.fees.v) - (supportH + setupAmort) * ECO.founderHourCost.v;
    const cashBE = Math.ceil((ECO.hostingSmall.v + ECO.accountant.v) / (p * (1 - ECO.fees.v)));
    const founderBE = contrib > 0 ? String(Math.ceil((ECO.founderIncomeTarget.v + ECO.hostingSmall.v + ECO.accountant.v) / contrib)) : 'never';
    saasRows.push([`${SENS.saasSupportMin[supLv]} min`, `${f0(p / 1000)} k`, `${f0(contrib / 1000)} k`, cashBE, founderBE]);
  }
table(['Support per account-month', 'Price', 'Contribution per account (support at founder cost)', 'Cash break-even accounts', 'Accounts to reach the founder income target'], saasRows);

lines.push('### SaaS sensitivity: accounts to reach the founder income target, and selling hours per month at that size', '');
{
  const rowsS: (string | number)[][] = [];
  for (const p of [30000, 50000])
    for (const ch of ['low', 'mid', 'high'] as Level[])
      for (const sl of ['low', 'mid', 'high'] as Level[]) {
        let need: ScaleRow | null = null;
        for (let n = 1; n <= 2000 && !need; n++) {
          const r = scale('saas', STORES[0]!, p, n, 'mid', 'mid', ch, sl, 'mid');
          if (r.founderTargetMet) need = r;
        }
        rowsS.push([`${f0(p / 1000)} k`, pct(SENS.churn[ch]), `${SENS.salesHoursPerClient[sl]} h`, need ? need.clients : '> 2,000', need ? f0(need.clients * SENS.churn[ch]) : '—', need ? f0(need.hours.sales) : '—', need ? need.hires : '—']);
      }
  table(['Price', 'Monthly churn', 'Selling h per new client', 'Accounts needed', 'New accounts needed every month', 'Selling h/month', 'Hires'], rowsS);
}

// 4. Scale grid: cash after hired staff (before founder pay) for 10 / 50 / 100 / 500 clients
const cell = (r: ScaleRow) => `${k(r.cash)} (${f0(r.hours.total)} h, ${r.hires} hires)${r.overCap ? ' ⚑' : ''}`;
const sc: ScaleRow[] = [];
const grid = (title: string, rowsSpec: { model: 'saas' | 'service' | 'hybrid2'; s: Store; p: number; clean: boolean }[]) => {
  lines.push(title, '');
  table(['Model', 'Store', 'Inputs', 'Price', ...CLIENTS.map((n) => `${n} clients`), 'Clients for founder target'], rowsSpec.map(({ model, s, p, clean: cl }) => {
    const rs = CLIENTS.map((n) => scale(model, s, p, n, 'mid', 'mid', 'mid', 'mid', 'mid', cl));
    sc.push(...rs);
    let need = 'not within 1,000';
    for (let n = 1; n <= 1000; n++) if (scale(model, s, p, n, 'mid', 'mid', 'mid', 'mid', 'mid', cl).founderTargetMet) { need = String(n); break; }
    return [model, model === 'saas' ? 'any' : s.id, model === 'saas' ? '—' : cl ? 'clean' : 'as defined', `${f0(p / 1000)} k`, ...rs.map(cell), need];
  }));
};
grid('### Scale — service (central case: mid matching, mid times, 5% churn, 13 h of selling per new client). Cell = cash after hired staff, before paying the founder (total human h, hires). ⚑ = above the monotributo cap', [
  ...STORES.flatMap((s) => [50000, 100000].map((p) => ({ model: 'service' as const, s, p, clean: false }))),
  ...STORES.flatMap((s) => [30000, 50000, 75000, 100000].map((p) => ({ model: 'service' as const, s, p, clean: true }))),
]);
grid('### Scale — hybrid stage 2 (client uploads and exports; we handle exceptions)', STORES.flatMap((s) => [30000, 50000].map((p) => ({ model: 'hybrid2' as const, s, p, clean: true }))));
grid('### Scale — SaaS (45 min support per account-month; the store keeps its own review hours)', [15000, 30000, 50000].map((p) => ({ model: 'saas' as const, s: STORES[0]!, p, clean: false })));
out.scale = sc;

// 5. Value to the store vs price (time only; margin protection is UNKNOWN)
lines.push('### Value of staff time saved per month vs price (mid matching; store time at ESTIMATE ARS/h)', '');
table(['Store', 'Inputs', 'Times', 'SaaS: h saved vs Excel', 'SaaS: value', 'Service: h saved vs Excel', 'Service: value', 'Service: h saved vs manual POS', 'Service: value'], STORES.flatMap((s) =>
  ([false, true] as const).flatMap((cl) => (['low', 'mid', 'high'] as Level[]).map((lv) => {
    const w = workload(s, 'mid', lv, cl);
    const saas = w.hours.excel - (w.hours.remarcaOperator + w.hours.clientImport);
    const serviceVsExcel = w.hours.excel - w.hours.clientImport;
    const serviceVsManual = w.hours.manualPos - w.hours.clientImport;
    return [s.id, cl ? 'clean' : 'as defined', lv, f1(saas), `ARS ${k(saas * clientHourValue)}`, f1(serviceVsExcel), `ARS ${k(serviceVsExcel * clientHourValue)}`, f1(serviceVsManual), `ARS ${k(serviceVsManual * clientHourValue)}`];
  }))));

// 6. Hybrid stages
lines.push('### Hybrid stages: operator hours per client-month (mid matching, mid times)', '');
table(['Store', 'Inputs', 'Stage 1 service', 'Stage 2 semi-automated', 'Stage 3 self-serve (support 45 min)', 'Moves to the client in stage 2', 'Stays human (needs features that do not exist)'], STORES.flatMap((s) => ([false, true] as const).map((cl) => {
  const w = workload(s, 'mid', 'mid', cl);
  const st1 = w.hours.remarcaOperator + SENS.serviceCommsMin.mid / 60;
  const st2 = w.hours.remarcaReviewOnly + SENS.serviceCommsMin.mid / 120;
  const hard = w.breakdown['Checking rows of partially read PDFs']! + w.breakdown['Typing rows of unreadable PDFs']! + w.breakdown['Typing rows of lists without codes']! + w.breakdown['Mixed-currency workaround (split file)']!;
  return [s.id, cl ? 'clean' : 'as defined', f1(st1), f1(st2), f1(SENS.saasSupportMin.mid / 60), `${f1(st1 - st2)} h`, `${f1(hard)} h`];
})));

// 7. Bottleneck: hours by activity (store B, mid case)
lines.push('### Where the hours go at scale (store B, central case)', '');
const bn: (string | number)[][] = [];
for (const [model, cl] of [['service', false], ['service', true], ['saas', false]] as const)
  for (const n of [100, 500]) {
    const r = scale(model, STORES[1]!, model === 'saas' ? 30000 : 50000, n, 'mid', 'mid', 'mid', 'mid', 'mid', cl);
    const machineH = (n * workload(STORES[1]!, 'mid', 'mid', cl).machineSeconds) / 3600;
    bn.push([model, model === 'saas' ? '—' : cl ? 'clean' : 'as defined', n, f0(r.hours.recurring), f0(r.hours.onboarding), f0(r.hours.sales), f1(machineH), pct(r.hours.sales / r.hours.total)]);
  }
table(['Model', 'Inputs', 'Clients', 'Recurring human h/mo', 'Onboarding h/mo', 'Selling h/mo (replacing 5% churn)', 'Machine h/mo', 'Selling share of human h'], bn);

console.log(lines.join('\n'));
out.inputs = { OBS, ECO, SENS, T: { ...T, excelListMin: { low: excelListMin('low'), mid: excelListMin('mid'), high: excelListMin('high') } }, STORES, MATCH, PRICES, CLIENTS, clientHourValue, hiredProductiveHourCost };
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 2));
