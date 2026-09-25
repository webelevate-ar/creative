"""RESEARCH ONLY (docs/22 §3–§6). Prevalence counts over the hand-labelled public-list dataset.

It only counts what public-lists-dataset.json says. It says nothing about suppliers that do not publish lists
(most of them, as far as we know): every percentage is "among the lists we found", never "among suppliers".

Usage: python public_lists_stats.py [public-lists-dataset.json]
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'public-lists-dataset.json')))
CUTOFF = data['recent_cutoff']
ALL = data['suppliers']
LISTS = [s for s in ALL if s['status'] == 'obtained' and s['price_list']]


def recent(s):
    d = s.get('list_date')
    if not d:
        return None
    if len(d) == 4:
        d += '-12-31'
    elif len(d) == 7:
        d += '-31'  # month-only dates count as the last day of the month (generous)
    return d >= CUTOFF


def flags(s):
    single = s['currency'] not in ('USD', 'mixed')
    return {
        'spreadsheet': s['spreadsheet'],
        'pdf': s['pdf'],
        'pdf_only': s['pdf'] and not s['spreadsheet'],
        'no_file (web page only)': not s['spreadsheet'] and not s['pdf'],
        'code': s['code'] is True,
        'code unreadable (scan/image/encoding/password)': s['code'] is None,
        'code + price': s['code'] is True and s['price'] is True,
        'spreadsheet + code + price': s['spreadsheet'] and s['code'] is True and s['price'] is True,
        'USD or mixed currency': not single,
        'mixed ARS/USD in one list': s['currency'] == 'mixed',
        'IVA stated at all': s['iva'] != 'not_stated',
        'IVA rate differs by product': s['iva'] == 'per_product',
        'currency not stated': s['currency'] == 'not_stated',
        'hostile file (scan/image/encoded/password/>12 MB)': bool(s['hostile']),
        'recent (list or file date >= cutoff)': recent(s) is True,
        'no date found': recent(s) is None,
        'versioning evidence': bool(s['versioning_evidence']),
        'older versions downloadable': s['historical_versions'],
        'GOOD ZONE: spreadsheet + code + price + recent + single currency': s['spreadsheet'] and s['code'] is True and s['price'] is True and recent(s) is True and single,
        'GOOD ZONE + versioning evidence': s['spreadsheet'] and s['code'] is True and s['price'] is True and recent(s) is True and single and bool(s['versioning_evidence']),
        'Remarcá auto ok': s['remarca_auto'] == 'ok',
        'Remarcá auto partial': s['remarca_auto'] == 'partial',
        'Remarcá auto wrong rows': s['remarca_auto'] == 'wrong',
        'Remarcá auto zero rows': s['remarca_auto'] == 'zero',
        'Remarcá rejected (cap/password/scan)': s['remarca_auto'] == 'rejected',
    }


groups = {
    'independent (docs/22 new)': [s for s in LISTS if s['group'] == 'independent' and s['source_doc'] == 'docs22'],
    'independent (all)': [s for s in LISTS if s['group'] == 'independent'],
    'ACCME cluster (all)': [s for s in LISTS if s['group'] == 'accme'],
    'combined': LISTS,
    'combined, target sectors only': [s for s in LISTS if s['target_sector']],
}
keys = list(flags(LISTS[0]).keys())
print('| Metric | ' + ' | '.join(f'{g} (n={len(v)})' for g, v in groups.items()) + ' |')
print('|---|' + '---:|' * len(groups))
for k in keys:
    cells = []
    for v in groups.values():
        c = sum(1 for s in v if flags(s)[k])
        cells.append(f'{c} ({100 * c / len(v):.0f}%)' if v else '–')
    print(f'| {k} | ' + ' | '.join(cells) + ' |')

print()
st = {}
for s in ALL:
    st.setdefault((s['group'], s['status']), []).append(s['id'])
for (g, status), ids in sorted(st.items()):
    print(f'- {g} / {status}: {len(ids)} ({", ".join(ids)})')
not_list = [s['id'] for s in ALL if s['status'] == 'obtained' and not s['price_list']]
print(f'- obtained but not a price list: {not_list}')
good = [s['company'] for s in LISTS if flags(s)['GOOD ZONE: spreadsheet + code + price + recent + single currency']]
print(f'- good zone members: {good}')

print()
print('| Best file type | n | ' + ' | '.join(['ok', 'partial', 'wrong', 'zero', 'rejected', 'n/a']) + ' |')
print('|---|---:|' + '---:|' * 6)
for label, pred in [('has a spreadsheet', lambda s: s['spreadsheet']), ('PDF only', lambda s: s['pdf'] and not s['spreadsheet']), ('web page only', lambda s: not s['pdf'] and not s['spreadsheet'])]:
    v = [s for s in LISTS if pred(s)]
    print(f'| {label} | {len(v)} | ' + ' | '.join(str(sum(1 for s in v if s['remarca_auto'] == r)) for r in ['ok', 'partial', 'wrong', 'zero', 'rejected', 'n/a']) + ' |')
