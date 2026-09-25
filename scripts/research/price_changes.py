"""RESEARCH ONLY (docs/22 §7). Compares versions of the SAME public price list to test:
"if almost every product rises by about the same %, a blanket increase is enough and Remarcá has little value".

Sources (public, not committed; see public-lists-sources.json and docs/22 §2):
  - Neopel (papelera / embalaje mayorista): one PDF per business day, Mar-2025 … 24-Sep-2026 (88 versions found).
  - Ediciones Colihue (editorial): AR list Apr-2025 (PDF) vs Sep-2026 (CSV); Venezuela list Nov-2025 vs Sep-2026 (CSV).
  - Cámara Argentina del Libro public list: "PVP ANT" vs "PVP NVO" columns in one file (2023).

Metrics per comparison (products present in both versions, keyed by the supplier's code):
  share changed; distribution of the change; share within ±2 percentage points of the median change
  ("a blanket increase at the median would be almost right"); share whose blanket error exceeds 5% / 10%;
  new and removed codes.

Usage: python price_changes.py <ver dir> <raw dir> <out.json>   (pip install pypdfium2 xlrd)
"""
import csv, io, json, os, re, statistics, sys
import pypdfium2 as pdfium
import xlrd

VER, RAW, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
ROW = re.compile(r'^([A-Z0-9][A-Z0-9\-\./\*]+)\s+(.+?)\s+(\d{1,3}(?:,\d{3})*\.\d{2})\s+(\d{1,3}(?:,\d{3})*\.\d{2})$')


def pdf_lines(path):
    pdf = pdfium.PdfDocument(path)
    for i in range(len(pdf)):
        for line in pdf[i].get_textpage().get_text_range().replace('\r', '').split('\n'):
            if line.strip():
                yield line.strip()


def neopel(path):
    """code -> net price (the list also prints the IVA-included price, 21% in 2,789 of 2,790 rows)."""
    out = {}
    for line in pdf_lines(path):
        m = ROW.match(line)
        if m:
            out[m.group(1)] = float(m.group(3).replace(',', ''))
    return out


def ar_number(s):
    s = s.strip().replace('$', '').replace(' ', '')
    if not s:
        return None
    try:
        return float(s.replace('.', '').replace(',', '.'))
    except ValueError:
        return None


def colihue_csv(path, price_col_hint='PVP'):
    text = open(path, encoding='utf-8', errors='ignore').read()
    rows = list(csv.reader(io.StringIO(text)))
    head_i = next(i for i, r in enumerate(rows) if r and r[0].strip() == 'Orden')
    head = rows[head_i]
    bar = next(i for i, h in enumerate(head) if 'Barras' in h)
    price = max(i for i, h in enumerate(head) if price_col_hint.lower() in h.lower())
    out = {}
    for r in rows[head_i + 1:]:
        if len(r) > max(bar, price) and re.fullmatch(r'97[89]\d{10}', r[bar].strip()):
            p = ar_number(r[price])
            if p:
                out[r[bar].strip()] = p
    return out, head[price]


def colihue_pdf(path):
    out = {}
    for line in pdf_lines(path):
        m = re.search(r'\b(97[89]\d{10})\b.*?\s(\d{1,3}(?:\.\d{3})+|\d{3,6})\s*$', line)
        if m:
            out[m.group(1)] = ar_number(m.group(2))
    return out


def cal_xls(path):
    sh = xlrd.open_workbook(path).sheet_by_index(0)
    head = [str(c) for c in sh.row_values(0)]
    code, new, old = head.index('codigobarras'), head.index('PVP NVO'), head.index('PVP ANT')
    a, b = {}, {}
    for i in range(1, sh.nrows):
        r = sh.row_values(i)
        k = str(r[code]).split('.')[0]
        if isinstance(r[old], float) and isinstance(r[new], float) and r[old] > 0 and r[new] > 0:
            a[k], b[k] = r[old], r[new]
    return a, b


def compare(a, b, label):
    shared = [k for k in a if k in b and a[k] and b[k]]
    ratios = [b[k] / a[k] for k in shared]
    changed = [r for r in ratios if abs(r - 1) > 1e-9]
    res = {'label': label, 'old_codes': len(a), 'new_codes': len(b), 'shared': len(shared), 'new': len(set(b) - set(a)), 'removed': len(set(a) - set(b))}
    if not ratios:
        return res
    med = statistics.median(ratios)
    qs = statistics.quantiles(ratios, n=20) if len(ratios) >= 20 else [min(ratios)] * 19
    dev = [r / med - 1 for r in ratios]
    res.update({
        'share_changed': len(changed) / len(ratios),
        'median_change_pct': (med - 1) * 100,
        'p05_pct': (qs[0] - 1) * 100, 'p25_pct': (qs[4] - 1) * 100, 'p75_pct': (qs[14] - 1) * 100, 'p95_pct': (qs[18] - 1) * 100,
        'within_2pp_of_median': sum(1 for d in dev if abs(d) <= 0.02) / len(dev),
        'blanket_error_over_5pct': sum(1 for d in dev if abs(d) > 0.05) / len(dev),
        'blanket_error_over_10pct': sum(1 for d in dev if abs(d) > 0.10) / len(dev),
        'decreased': sum(1 for r in ratios if r < 1 - 1e-9) / len(ratios),
    })
    return res


results = {}
# --- Neopel daily series
nd = os.path.join(VER, 'neopel')
series = {}
for f in sorted(os.listdir(nd)):
    if f.endswith('.pdf'):
        series[f[:-4]] = neopel(os.path.join(nd, f))
dates = sorted(series)
results['neopel_versions'] = {d: len(series[d]) for d in dates}
# consecutive business-day versions
steps = [compare(series[d0], series[d1], f'{d0}→{d1}') for d0, d1 in zip(dates, dates[1:])]
daily = [s for s in steps if s['label'][:7] >= '2026-06' and 'share_changed' in s]
results['neopel_daily_summary'] = {
    'pairs': len(daily),
    'pairs_with_any_change': sum(1 for s in daily if s['share_changed'] > 0),
    'median_share_changed_per_update': statistics.median(s['share_changed'] for s in daily),
    'max_share_changed_per_update': max(s['share_changed'] for s in daily),
    'updates_changing_over_20pct_of_items': [s['label'] for s in daily if s['share_changed'] > 0.2],
}
results['neopel_daily_steps'] = steps
# monthly (first version of each month) and long spans
firsts = {}
for d in dates:
    firsts.setdefault(d[:7], d)
fm = sorted(firsts.values())
results['neopel_monthly'] = [compare(series[a], series[b], f'{a}→{b}') for a, b in zip(fm, fm[1:])]
results['neopel_spans'] = [compare(series[a], series[b], f'{a}→{b}') for a, b in [(dates[0], dates[-1]), ('2026-06-01', '2026-09-24'), ('2026-08-28', '2026-09-24')] if a in series and b in series]
# per-product number of price changes Jun–Sep 2026 (business-day series)
jun = [d for d in dates if d >= '2026-06-01']
counts = {}
for d0, d1 in zip(jun, jun[1:]):
    for k in series[d0]:
        if k in series[d1] and abs(series[d1][k] / series[d0][k] - 1) > 1e-9:
            counts[k] = counts.get(k, 0) + 1
tracked = [k for k in series[jun[0]] if all(k in series[d] for d in jun)]
dist = {}
for k in tracked:
    c = counts.get(k, 0)
    dist[c] = dist.get(c, 0) + 1
results['neopel_changes_per_product_jun_sep'] = {'tracked_products': len(tracked), 'distribution': dict(sorted(dist.items()))}

# --- Colihue
ar_old = colihue_pdf(os.path.join(VER, 'colihue_202504.pdf'))
ar_new, col = colihue_csv(os.path.join(VER, 'colihue_202609.csv'))
results['colihue_ar'] = compare(ar_old, ar_new, f'AR Apr-2025 (PDF) → Sep-2026 (CSV, column "{col}")')
ve_old, c1 = colihue_csv(os.path.join(VER, 'colihue_ve_202511.csv'))
ve_new, c2 = colihue_csv(os.path.join(VER, 'colihue_ve_202609.csv'))
results['colihue_ve'] = compare(ve_old, ve_new, f'Venezuela Nov-2025 → Sep-2026 (columns "{c1}" / "{c2}")')
# --- Cámara Argentina del Libro: two price columns in one file
a, b = cal_xls(os.path.join(RAW, 'ellibro.xls'))
results['cal_old_vs_new_column'] = compare(a, b, 'PVP ANT → PVP NVO (same file, 2023)')

json.dump(results, open(OUT, 'w'), indent=1, default=str)
keep = {k: v for k, v in results.items() if k not in ('neopel_daily_steps', 'neopel_versions')}
print(json.dumps(keep, indent=1, default=lambda x: round(x, 4) if isinstance(x, float) else str(x))[:9000])
