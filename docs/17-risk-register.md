# 17 — Risk Register

Probability / Impact: L = low, M = medium, H = high. Status: Open / Mitigating / Accepted / Closed.

| # | Type | Risk | P | I | Evidence | Mitigation | Status |
|---|---|---|---|---|---|---|---|
| R1 | Commercial | Retailers won't pay (sector in "worst sales drop"), or only very little | M | H | Sector news Sep-2026 (02); no WTP data (U) | Test B pre-payment; low entry price; pivot to distributors (#12) or POS-vendor partnership if WTP < USD 8/mo | Open |
| R2 | Commercial | "My POS already imports Excel" is good enough for most | M | H | Every ERP advertises import (04) | Demo with the raw file; qualify out early; target stores with messy suppliers | Open |
| R3 | Competitive | ERP vendors or Multilistas add smart import / neutral export | **H** | **H** | **Updated (19 K5):** Multilistas already does as-sent Excel import with column recognition, preview and auto-recalculated prices; export to ERP reported (unverified) | Don't compete on the tool; test service positioning (19 §14); partner rather than compete with POS vendors | Open (raised) |
| R4 | AI substitution | Generic AI assistants do list merges and price updates | **H** | **H** | **Updated (19 K12–K15):** Tiendanube Admin MCP (bulk price edits via Claude/ChatGPT), Matrixify+Claude on supplier PDFs, Excel Agent Mode on M365 Personal/Family, ChatGPT for Excel | Sell the outcome (service) rather than the tool; measure in screening how many already use AI for this | Open (raised) |
| R5 | Technical | Real supplier files break detection (merged headers, odd PDFs, scans) | H | M | Only synthetic fixtures tested (11 §4) | Test C with 30 real files; manual mapping always available; scanned PDFs rejected with guidance | Mitigating |
| R5b | Technical/Safety | Wrong product matched → wrong cost applied (numeric code collisions across namespaces) | M | H | **19 §8:** 2 wrong matches applied by default before fix | Fixed: own-code matches without shared words are held (`check_match`); auto-apply only on code/link matches; regression test | Mitigated |
| R6 | Technical | Wrong prices applied (bad rules, wrong column) → customer loses money | M | H | Inherent | Review before apply, anomaly flags, systematic-shift warning, undo, terms clarify responsibility | Mitigating |
| R7 | Operational | Data loss (no backups yet, single server) | M | H | No host provisioned | Backups are NOW #2, restore drill; WAL mode | Open (launch-blocking) |
| R8 | Security | Account takeover / cross-account data exposure | L | H | 23 adversarial HTTP tests pass (12) | Keep tests in CI; add 2FA later; monthly `npm audit` | Mitigating |
| R9 | Security | Hostile file exploits parser / exhausts memory | L | M | Zip-bomb + worker caps implemented | Keep SheetJS/pdf.js updated; worker isolation | Mitigating |
| R10 | Distribution | Founder can't sustain walk-in volume; CAC in time too high | M | H | Solo founder | Measure file-received per hour; distributor referrals; content; decide at week 4 | Open |
| R11 | Support | Weird files → support load kills margins | M | M | Assumed 15 min/account/month (14) | Track support minutes per account; fix root causes as fixtures; charge onboarding | Open |
| R12 | Economic | Inflation erodes ARS prices; FX jumps change USD-based value | M | M | 33.5% YoY CPI (02) | Quarterly price adjustments (terms), annual plans | Accepted |
| R13 | Regulatory/tax | Founder exceeds monotributo cap (~234 accounts) → IVA 21% | M (if success) | M | Cap ARS 126.6M/yr (14) | Plan entity/pricing before ~150 accounts; accountant | Open |
| R14 | Legal | Terms/privacy written without a lawyer; consumer-law details; trademark "Remarcá" unverified | M | M | — | Lawyer review + INPI search before charging (16 NOW) | Open |
| R15 | Legal/Trust | Suppliers consider their price lists confidential | L | M | Plausible | Data isolated per account; never shared; state it clearly (landing FAQ) | Mitigating |
| R16 | Platform | Hosting plan unavailable (Hetzner stock notices Sep-2026) | M | L | Search result (14) | Any Linux VPS works; documented generic deploy | Accepted |
| R17 | Product | Keep-margin mode propagates bad historic prices (a product priced below cost stays below cost) | M | M | By design | "Bajo costo" flag + filter; option to recalc with markup per supplier | Mitigating |
| R18 | Founder | Opportunity cost vs. web-agency income; slow ramp (7–9 months to replace income, E) | M | M | 14 §4 | Part-time cadence; kill/pivot checkpoints at week 4 and month 3 | Open |

| R19 | Competitive | A same-country, same-vertical product (Multilistas) already sells the core pitch, bundled with invoicing | H | H | 19 K5 | Differentiate by outcome (service), PDF, no POS switch; measure in screening whether stores know/use it | Open |
| R20 | Pricing | Adjacent tools priced at USD 7–50/month; full POS from ≈ ARS 38k final → our ARS 23–90k plans may be unsellable as a tool | H | H | 19 K10–K12 | Test price with upfront payment; service pricing tied to staff hours | Open |
| R21 | Market | ICP narrower than assumed: only stores with a file-importing POS, several messy suppliers and no in-house Excel/AI skill | H | H | 19 §6 | Screening measures qualification rate; NO-GO if <15% | Open |
| R22 | Product/Onboarding | Stores without supplier codes need manual linking of most items (≈25–50 h for 3,000 items with today's UI, ESTIMATE) | M (UNKNOWN prevalence) | H | 19 §8 (23/26 unmatched in synthetic test) | Screening asks about codes; concierge absorbs onboarding; build suggestions only after GO | Open |
| R23 | Retention | Value is invisible (avoided losses) and usage may be monthly → churn | M | H | 19 §11 | Measure lists/week and renewal; consider per-list pricing | Open |
| R24 | Market | Suppliers digitize (portals, price tools with client margin), shrinking the pain per supplier | M | M | 19 K18 (Debyferr, Dipel, JCB…) | Target stores whose key suppliers don't | Open |
| R25 | Market | 2026 price plateaus/corrections reduce update frequency and urgency | M | M | 19 K4, K3 | Measure real frequency in screening | Open |
| R26 | Distribution/Legal | Cold WhatsApp outreach violates platform opt-in rules; scaling channel unproven; paid ads uneconomic at ARPA USD 15–26 | H | M | 19 §10 | Warm contacts, walk-ins, partners only | Open |
| R27 | Evidence quality | A "sector fact" (66% ≤5 employees) was a 47-respondent survey profile | — | L | Found in red team | Corrected in 02/15; keep FACT vs EVIDENCE separation | Closed |

## Kill / pivot checkpoints
**Superseded by the behavioral criteria in [19 §15](19-commercial-red-team.md)** (qualification, file-sent, code prevalence, payment, usage, output adoption, renewal, minutes per list).
