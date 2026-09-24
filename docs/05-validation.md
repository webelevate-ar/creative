# 05 — Validation

> Updated assessment of these hypotheses and the new experiment design: [`19-commercial-red-team.md`](19-commercial-red-team.md) §3–§4 and §14–§15.

## 1. What is validated (desk research, this session)

| Hypothesis | Status | Evidence |
|---|---|---|
| H1 Retailers/distributors receive supplier price lists in heterogeneous Excel/PDF formats, often | **Supported** | E1, E4, E5, E6, E7, E11 (02-market-research) |
| H2 Updating them is manual and slow (hours) | **Supported (weak)** | E1 ("medio día"), E7 (Excel how-to threads). No first-person AR retailer quote |
| H3 Late updates cause margin loss in 2026 Argentina | **Supported (reasoned)** | CPI 1.7–2.1%/mo, 33.5% YoY; E3 |
| H4 Businesses pay for "know when supplier prices change" | **Supported in adjacent markets** | MarginEdge USD 350/loc/mo, TRA-SER USD 1,260/user/yr (US) |
| H5 No standalone, POS-neutral tool serves AR retailers | **Supported (absence of evidence)** | Searches found only POS/ERP modules, Multilistas (POS), horizontal extractors |
| H6 Argentine small retailers will pay ~USD 15–40/mo for it | **UNKNOWN** | Only anchors (POS ≈ USD 45/mo). Must test |
| H7 Owners trust a web tool with their price data | **UNKNOWN** | — |
| H8 The founder can reach them cheaply (walk-in, WhatsApp, chambers) | **ASSUMPTION** | Founder does direct sales to SMBs; 14–15k ferreterías, dense in cities |

## 2. What I could not validate here — and how to validate it (first 2–3 weeks)

These are the founder's first tasks; the product was built so the tests use a working tool, not slides.

### Test A — Problem interviews + live demo (10–15 businesses)
- **Who:** owners/encargados of ferreterías, casas de electricidad, sanitarios, pinturerías, autopartes,
  librerías comerciales, distribuidoras. Mix of 1–5 and 6–20 employees.
- **Ask (no pitching first):** How many suppliers? How do lists arrive (Excel/PDF/WhatsApp)? How often?
  Who updates prices, how, how long? When did you last sell below cost? What system do you use?
- **Then:** "Send me the last list from your biggest supplier" → run it through Remarcá live.
- **Pass criteria:** ≥60% report ≥2 h/week on price updates; ≥50% send a real file; ≥30% ask to keep using it.
- **Kill criteria:** most say "my POS imports it fine" *and* show it working in <15 min per list.

### Test B — Concierge pilot with pre-payment (5 businesses, 4 weeks)
- Offer: first month at ARS ~15,000 (≈USD 10) paid upfront by transfer/Mercado Pago link, founder
  sets up catalog + first 3 suppliers.
- **Pass:** ≥3 of 5 pay, ≥2 renew at list price in month 2. **Kill:** <2 pay.

### Test C — Format coverage
- **Partially run with public lists instead of store files (2026-09-24): see [`20-real-world-benchmark.md`](20-real-world-benchmark.md).** Spreadsheets 7/7; PDFs 1/6. Test C with files from real stores is still pending.
- Collect 30+ real supplier files (with permission). Measure auto-detection success (header + code +
  price column correct with no manual mapping). Target ≥80% for Excel/CSV; report PDF separately.

## 3. Evidence that would make me change direction
- Retailers' POS vendors already offer a *managed* list-update service included in the fee (then the
  pain is solved for them) → pivot to distributors (#12) or to POS vendors as B2B customers.
- Most supplier lists arrive as scanned images → the OCR cost/complexity changes the economics.
- WTP below ~USD 8/mo → only viable as a feature sold through POS vendors (partner channel).
