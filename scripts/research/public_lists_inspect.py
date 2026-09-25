"""RESEARCH ONLY (docs/22). Independent inspection of public price lists: for each downloaded file, report
format, readability, header candidates, sample rows and textual signals (currency, IVA, dates, code-like tokens).
It does NOT decide the dataset labels by itself: every label in docs/22 was checked by reading this output.

Usage: python public_lists_inspect.py <raw dir> <out.json>     (pip install openpyxl xlrd pdfplumber)
"""
import json, os, re, sys, subprocess
import openpyxl, xlrd, pdfplumber

RAW, OUT = sys.argv[1], sys.argv[2]
CODE = re.compile(r'\b(c[oó]d(igo)?|art[ií]culo|art\.?|ref(erencia)?|sku|item)\b', re.I)
PRICE = re.compile(r'\b(precio|p\.?\s?lista|importe|valor|pvp|neto|costo|\$)', re.I)
DESC = re.compile(r'\b(descrip|detalle|producto|nombre|art[ií]culo)', re.I)
USD = re.compile(r'(u\$s|us\$|usd|d[oó]lar)', re.I)
IVA = re.compile(r'\biva\b|i\.v\.a', re.I)
IVA_RATE = re.compile(r'\b(10[,.]5|21|27)\s?%', re.I)
DATE = re.compile(r'(\b\d{1,2}[/.-]\d{1,2}[/.-](20)?\d{2}\b|vigencia|actualiz|v[aá]lid[ao]|(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(de\s+)?20\d\d)', re.I)
MONEY = re.compile(r'\$?\s?\d{1,3}(\.\d{3})*,\d{2}\b|\$\s?\d+')


def kind(path):
    return subprocess.run(['file', '-b', path], capture_output=True, text=True).stdout


def cell(v):
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def sheets(path):
    k = kind(path)
    if 'Encrypted' in k:
        raise ValueError('encrypted (password-protected) workbook')
    if 'Excel 2007' in k or path.endswith('.xlsx'):
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        for ws in wb.worksheets:
            yield ws.title, [[cell(c) for c in r] for r in ws.iter_rows(values_only=True, max_row=4000)]
    else:
        wb = xlrd.open_workbook(path)
        for sh in wb.sheets():
            yield sh.name, [[cell(c) for c in sh.row_values(i)] for i in range(min(sh.nrows, 4000))]


def signals(text):
    return {
        'usd': len(USD.findall(text)), 'iva': len(IVA.findall(text)), 'iva_rates': sorted(set(m.group(1) for m in IVA_RATE.finditer(text))),
        'dates': sorted(set(m.group(0).lower() for m in DATE.finditer(text)))[:6], 'money_tokens': len(MONEY.findall(text)),
    }


def inspect_sheet(name, rows):
    best, best_score = -1, 0
    for i, r in enumerate(rows[:40]):
        joined = ' | '.join(c for c in r if c)
        score = bool(CODE.search(joined)) + bool(PRICE.search(joined)) + bool(DESC.search(joined))
        if score > best_score and sum(1 for c in r if c) >= 2:
            best, best_score = i, score
    header = [c for c in rows[best]] if best >= 0 else []
    data = [r for r in rows[best + 1:] if sum(1 for c in r if c) >= 2]
    text = '\n'.join(' '.join(r) for r in rows[:300])
    return {
        'sheet': name, 'rows': len(rows), 'data_rows': len(data), 'header_row': best, 'header': [h for h in header if h][:14],
        'header_has_code': bool(CODE.search(' '.join(header))), 'header_has_price': bool(PRICE.search(' '.join(header))), 'header_has_desc': bool(DESC.search(' '.join(header))),
        'sample': [[c for c in r if c][:10] for r in data[:3]], 'signals': signals(text),
    }


def inspect_pdf(path, max_pages=6):
    out = {'pages': 0, 'text_pages': 0, 'lines_sample': [], 'signals': {}}
    try:
        with pdfplumber.open(path) as pdf:
            out['pages'] = len(pdf.pages)
            texts = []
            for p in pdf.pages[:max_pages]:
                t = p.extract_text() or ''
                if t.strip():
                    out['text_pages'] += 1
                texts.append(t)
            text = '\n'.join(texts)
            lines = [l for l in text.split('\n') if l.strip()]
            out['lines_sample'] = lines[:14]
            out['priced_lines'] = sum(1 for l in lines if MONEY.search(l))
            out['code_header'] = bool(CODE.search(text[:4000]))
            out['signals'] = signals(text)
    except Exception as e:  # encrypted or damaged
        out['error'] = str(e)[:120]
    return out


def inspect_html(path):
    s = open(path, encoding='utf8', errors='ignore').read()
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', s, re.S | re.I)
    cells = [[re.sub(r'<[^>]+>|\s+', ' ', c).strip() for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S | re.I)] for r in rows]
    cells = [c for c in cells if any(c)]
    text = re.sub(r'<[^>]+>', ' ', s)
    return {'table_rows': len(cells), 'sample': cells[:5], 'signals': signals(text)}


results = {}
for f in sorted(os.listdir(RAW)):
    p = os.path.join(RAW, f)
    if f.endswith('.headers') or os.path.isdir(p):
        continue
    k = kind(p)
    r = {'file': f, 'bytes': os.path.getsize(p), 'type': k[:60]}
    try:
        if 'PDF' in k:
            r['pdf'] = inspect_pdf(p)
        elif 'Excel' in k or 'Composite Document' in k or 'CDFV2' in k:
            r['sheets'] = [inspect_sheet(n, rows) for n, rows in sheets(p)]
        elif 'HTML' in k and os.path.getsize(p) > 5000:
            r['html'] = inspect_html(p)
        else:
            r['unusable'] = k[:60]
    except Exception as e:
        r['error'] = str(e)[:160]
    results[f] = r
json.dump(results, open(OUT, 'w'), ensure_ascii=False, indent=1, default=str)
print(len(results), 'files inspected')
