# 17 — Risk Register

Probability / Impact: L = low, M = medium, H = high. Status: Open / Mitigating / Accepted / Closed.

| # | Type | Risk | P | I | Evidence | Mitigation | Status |
|---|---|---|---|---|---|---|---|
| R1 | Commercial | Retailers won't pay (sector in "worst sales drop"), or only very little | M | H | Sector news Sep-2026 (02); no WTP data (U) | Test B pre-payment; low entry price; pivot to distributors (#12) or POS-vendor partnership if WTP < USD 8/mo | Open |
| R2 | Commercial | "My POS already imports Excel" is good enough for most | M | H | Every ERP advertises import (04) | Demo with the raw file; qualify out early; target stores with messy suppliers | Open |
| R3 | Competitive | ERP vendors or Multilistas add smart import / neutral export | M | M | Wynges publishes heavily; Multilistas targets the same vertical | Speed, focus, neutrality across systems, format memory; partner rather than compete with POS vendors | Open |
| R4 | AI substitution | Generic AI assistants do one-off list merges well enough | M | M | Rapid LLM capability growth | Repeatable workflow, memory, deterministic math, undo, audit — value for non-technical staff; watch in interviews | Open |
| R5 | Technical | Real supplier files break detection (merged headers, odd PDFs, scans) | H | M | Only synthetic fixtures tested (11 §4) | Test C with 30 real files; manual mapping always available; scanned PDFs rejected with guidance | Mitigating |
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

## Kill / pivot checkpoints
- **Week 4:** <30% of qualified conversations send a file, or <2 paid pilots → rethink segment/offer (pivot candidates: distributors' "lista viva", POS-vendor white-label).
- **Month 3:** <60% of paying accounts apply lists on 2+ different days per month → retention problem; investigate before any growth spend.
