"""RESEARCH ONLY (docs/20). Independent ground truth for the real-list benchmark: openpyxl / xlrd / pdfplumber
plus per-file specs written after manual inspection (header row, code, description and price columns).
Usage: python ground_truth.py <raw files dir> <output dir>   (pip install openpyxl xlrd pdfplumber)
"""
import json, re, sys, os, openpyxl, xlrd, pdfplumber
R, OUT = sys.argv[1], sys.argv[2]

def rows_of(p, sheet):
    if p.endswith('.xlsx'):
        wb = openpyxl.load_workbook(p, read_only=True, data_only=True); ws = wb[sheet]
        return [list(r) for r in ws.iter_rows(values_only=True)]
    wb = xlrd.open_workbook(p); sh = wb.sheet_by_name(sheet)
    return [sh.row_values(i) for i in range(sh.nrows)]

def num(v):
    if isinstance(v, (int, float)) and not isinstance(v, bool): return float(v)
    if isinstance(v, str):
        t = v.replace('$', '').replace('\xa0', '').replace(' ', '').strip()
        if re.fullmatch(r'\d{1,3}(\.\d{3})*(,\d+)?|\d+(,\d+)?', t): return float(t.replace('.', '').replace(',', '.'))
        if re.fullmatch(r'\d+\.\d+', t): return float(t)
    return None

def code_str(v):
    if v is None: return ''
    if isinstance(v, float) and v.is_integer(): return str(int(v))
    return str(v).strip()

def tabular(p, sheet, header_row, code, desc, price, extra=None):
    rows = rows_of(p, sheet); items = []
    for i, r in enumerate(rows[header_row:], start=header_row + 1):
        r = list(r) + [None] * 60
        c = code_str(r[code]); pr = num(r[price])
        if c and pr is not None:
            it = {'row': i, 'code': c, 'desc': str(r[desc] or '').strip(), 'price': pr}
            for k, j in (extra or {}).items(): it[k] = r[j]
            items.append(it)
    return items

def save(name, meta, items):
    json.dump({'id': name, **meta, 'items': items}, open(os.path.join(OUT, name + '.json'), 'w'), ensure_ascii=False, default=str)
    codes = [i.get('code') for i in items]
    print(f'{name:28s} items={len(items):6d} distinct_codes={len(set(codes)):6d}')

save('camba_sabana', {'file': 'camba_sabana/Sabana_30_08_2026.xlsx', 'sheet': 'Sheet1'}, tabular(f'{R}/camba_sabana/Sabana_30_08_2026.xlsx', 'Sheet1', 1, 1, 2, 4, {'pack': 5, 'updated': 3, 'active': 10}))
save('aselec_hoja1', {'file': 'aselec_listado.xls', 'sheet': 'Hoja1'}, tabular(f'{R}/aselec_listado.xls', 'Hoja1', 3, 1, 0, 2, {'alt': 3, 'iva': 4, 'status': 5}))
save('aselec_hoja2', {'file': 'aselec_listado.xls', 'sheet': 'Hoja2'}, tabular(f'{R}/aselec_listado.xls', 'Hoja2', 0, 19, 18, 20, {'alt': 21, 'cur': 26}))
save('jb_hoja1', {'file': 'jbjusto_electricidad_sep2026.xls', 'sheet': 'Hoja1'}, tabular(f'{R}/jbjusto_electricidad_sep2026.xls', 'Hoja1', 7, 0, 4, 16, {'cur': 15, 'final': 22}))
save('alma_vth_modelo', {'file': 'alma_vth_20260904.xlsx', 'sheet': 'MODELO'}, tabular(f'{R}/alma_vth_20260904.xlsx', 'MODELO', 1, 0, 2, 3, {'price2': 4}))
save('alma_vth_correlativa', {'file': 'alma_vth_20260904.xlsx', 'sheet': 'CORRELATIVA'}, tabular(f'{R}/alma_vth_20260904.xlsx', 'CORRELATIVA', 3, 0, 2, 3))
save('alma_peugeot', {'file': 'alma_peugeot_20260901.xls', 'sheet': 'lista peugeot 01092026'}, tabular(f'{R}/alma_peugeot_20260901.xls', 'lista peugeot 01092026', 13, 3, 4, 5))
save('cambre_A', {'file': 'accme_cambre_A.xlsx', 'sheet': 'LISTA DE PRECIO'}, tabular(f'{R}/accme_cambre_A.xlsx', 'LISTA DE PRECIO', 10, 1, 2, 4, {'pack': 3, 'iva': 6}))
save('cambre_B', {'file': 'accme_cambre_B.xlsx', 'sheet': 'LISTA DE PRECIOS'}, tabular(f'{R}/accme_cambre_B.xlsx', 'LISTA DE PRECIOS', 10, 1, 2, 4, {'pack': 3, 'iva': 7}))

# Side-by-side layout: every (code, description, price) triple in a row.
def side_by_side(p, sheet):
    items = []
    for i, r in enumerate(rows_of(p, sheet), start=1):
        r = list(r)
        for j in range(len(r)):
            c = code_str(r[j])
            if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9\-\+/\.]{2,18}', c) or not re.search(r'\d', c): continue
            if j + 1 >= len(r) or not isinstance(r[j + 1], str) or not re.search(r'[A-Za-z]', r[j + 1] or ''): continue
            for k in range(j + 2, min(j + 5, len(r))):
                pr = num(r[k])
                if pr is not None and pr > 10:
                    items.append({'row': i, 'col': j, 'code': c, 'desc': r[j + 1].strip(), 'price': pr}); break
    return items
save('jb_sep26_sidebyside', {'file': 'jbjusto_electricidad_sep2026.xls', 'sheet': 'Electricidad Sep 26', 'approximate': True}, side_by_side(f'{R}/jbjusto_electricidad_sep2026.xls', 'Electricidad Sep 26'))

# Medicines: no code; identifier = composite description.
def meds(p):
    rows = rows_of(p, 'Sin únicas'); items = []
    for i, r in enumerate(rows[4:], start=5):
        pr = num(r[6]) if len(r) > 6 else None
        if pr is not None and r[0]:
            items.append({'row': i, 'code': None, 'desc': ' '.join(code_str(x) for x in r[:6] if x not in (None, '')), 'price': pr})
    return items
save('med_2026_08', {'file': 'med_2026_08.xlsx', 'sheet': 'Sin únicas'}, meds(f'{R}/med_2026_08.xlsx'))
save('med_2026_09', {'file': 'med_2026_09.xlsx', 'sheet': 'Sin únicas'}, meds(f'{R}/med_2026_09.xlsx'))

# PDFs
def pdf_lines(p):
    with pdfplumber.open(p) as pdf:
        for pn, page in enumerate(pdf.pages, start=1):
            for line in (page.extract_text() or '').split('\n'): yield pn, line.strip()
items = []
for pn, l in pdf_lines(f'{R}/alma_lista1.pdf'):
    m = re.fullmatch(r'(\S+)\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})', l)
    if m and re.search(r'\d', m.group(1)): items.append({'page': pn, 'code': m.group(1), 'desc': m.group(2), 'price': num(m.group(3))})
save('alma_pdf', {'file': 'alma_lista1.pdf'}, items)
items = []
for pn, l in pdf_lines(f'{R}/accme_strada.pdf'):
    m = re.match(r'(\S+)\s+(.+?)\s+\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$', l)
    if m and re.search(r'\d', m.group(1)): items.append({'page': pn, 'code': m.group(1), 'desc': m.group(2), 'price': num(m.group(3))})
save('strada_pdf', {'file': 'accme_strada.pdf'}, items)
items = []
for pn, l in pdf_lines(f'{R}/med_2026_09.pdf'):
    m = re.match(r'(.+?)\s+\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})$', l)
    if m: items.append({'page': pn, 'code': None, 'desc': m.group(1), 'price': num(m.group(2))})
save('med_2026_09_pdf', {'file': 'med_2026_09.pdf'}, items)
