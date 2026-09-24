# 18 — Final Report: Remarcá

> ## Status update after the real-world benchmark (2026-09-24) — read [`20-real-world-benchmark.md`](20-real-world-benchmark.md)
> Measured on public Argentine supplier price lists: 48,262 spreadsheet rows and 42 supplier PDFs, 6 sources, checked
> against an independent reader and manual labels.
> - **Spreadsheets:** 7/7 imported correctly; 1 needs the user to pick the code column.
> - **PDFs:** 1/6 lists correct. The "PDF too" differentiator is **not supported** for real layouts.
> - **Per-row currency and IVA** exist in 2 of 3 electrical sources. Remarcá has one currency and one IVA rate per
>   supplier:
>   - dollar rows are now held instead of being created 1,535× too cheap;
>   - 10.5% IVA items are still priced 9.5% too high, silently.
> - **Matching:**
>   - reliable when the next list of the same supplier keeps its codes: 10,229/10,229, 0 wrong;
>   - across suppliers only through a shared manufacturer code: 1 incorrect and 5 ambiguous in 170;
>   - not by description.
> - **Six errors found on real data were fixed** with regression tests (20, table at the top), including code
>   collisions that applied a price to the wrong product.
>
> The verdict below and in 19 does **not** improve. The product works on clean spreadsheets with codes; the narrower
> promise for any pilot is "spreadsheets with codes, one currency". Test count is now 91 unit/integration + 13 E2E.

> ## ⚠️ Status update after the commercial red team (2026-09-24) — read [`19-commercial-red-team.md`](19-commercial-red-team.md)
> New evidence **changes the conclusions below**:
> - The core capability is **not unique**: Multilistas (AR, same vertical) already imports supplier Excel "tal como te lo manda el proveedor", recognizes columns, previews and recalculates prices.
> - **AI substitution shipped in 2026** (Tiendanube Admin MCP with Claude/ChatGPT for bulk price edits; Matrixify + Claude on supplier PDFs; Excel Agent Mode on M365 Personal/Family).
> - Adjacent tools cost **USD 7–50/month**; the only buyer survey found (CAFARA, n=47) does not rank pricing among top needs.
> - Matching is safe on codes but expensive without them; a code-collision bug that could apply wrong prices was found and fixed.
> - The "66% of ferreterías have ≤5 employees" figure was a 47-respondent survey profile, not a sector fact (corrected).
>
> **Revised verdict:** the problem is real; **Remarcá as a self-serve SaaS is not validated and its differentiation is weak.** Development is frozen.
> **Revised next step:** 1 week of screening (30 stores) + 3 weeks of paid concierge-vs-self-serve pilots, with behavioral GO / PIVOT / NO-GO criteria (19 §14–§15). The "Next 10 Actions" and "Recommended Next Experiment" at the end of this report are **superseded** by 19 §19–§20.

Date: 2026-09-24 · Branch: `claude/gallant-ramanujan-tbccbs` · Labels: FACT / ASSUMPTION / ESTIMATE / UNKNOWN.

## Executive Summary
After scanning 56 opportunities, we found that most "obvious" Argentine vertical SaaS markets are already saturated
in 2026 (4–8 local tools each). The strongest open gap we found is a **neutral tool that turns messy supplier
price lists into updated costs and sale prices** for retailers and distributors, without replacing their POS.
We built it: **Remarcá**, a working web product (upload Excel/CSV/PDF → automatic column detection → matching to
the store's catalog → Argentine price math → review with alerts → apply → export for the POS / labels → undo).
It passed 82 unit/integration tests (including 23 adversarial security tests) and 13 browser end-to-end tests,
with performance measured and hardened. **What is not proven: that retailers will pay.** Market validation
could only be done from desk research here; the next step is 15 live demos with real supplier files and 5 paid pilots.

## Problem
Retailers with many suppliers (ferreterías, electricidad, sanitarios, pinturerías, repuestos, librerías, distribuidoras)
receive price lists every 2–6 weeks in inconsistent Excel/PDF formats (different columns, IVA included or not, cascaded
discounts "30+10", USD lists, per-box prices, AR vs US decimals). Updating costs and prices is manual (Excel + VLOOKUP)
or approximated ("raise everything 8%"). With CPI at 1.7–2.1%/month and 33.5% YoY (FACT, Aug-2026), late or blanket
updates mean **selling below replacement cost**. Practitioner evidence: "medio día" per list update (FACT, 02 E1).

## Customer
- **Buyer:** owner of a retail/wholesale SMB (1–20 employees) with ≥8 suppliers sending lists monthly and ≥1,500 SKUs.
- **User:** the owner or an encargado/administrativo in the back office.
- Argentina first: 14–15k ferreterías alone (FACT); other verticals UNKNOWN in number.

## Market
Argentina as the entry market because inflation makes the job frequent; the underlying problem (multi-format supplier
lists) exists wherever SMBs buy from many small suppliers (FACT: Shopify community thread; US analogs). Adjacent
proof of willingness to pay abroad: MarginEdge USD 350/location/month for invoice price-change alerts, TRA-SER
USD 1,260/user/year for pricing data (FACT). Argentine WTP for our tool: **UNKNOWN**.

## Evidence
See 02 §3 (E1–E11). Strongest: practitioner write-up of the exact pain; every AR ferretería/autopartes ERP advertises
list import (the job is universal); a competitor (Multilistas) built its whole POS around it; US products monetize the
adjacent job. Weakest: no first-person quotes from Argentine retailers (their communities are in Facebook/WhatsApp,
not reachable from here).

## Competition
Excel/VLOOKUP and "blanket %" (dominant substitutes), Multilistas (POS replacement), ERP import modules (need clean
files), consultants, horizontal PDF extractors, generic AI chats, and an emerging "POS with AI" (unverified).
Our angle: **neutral add-on** that feeds any system, PDF included, with AR price math, memory of each supplier's format,
decision support ("hoy lo vendés bajo costo"), and undo. Window is real but time-limited (04 §5).

## Product
Remarcá — "Subís la lista del proveedor, Remarcá te dice qué cambió y te da los precios nuevos listos para tu sistema."
Spanish (rioplatense) UI, server-rendered, works on old PCs and phones. Screenshots: `docs/screenshots/`.

## MVP (built — details in 10)
Multi-format upload (xlsx, legacy xls, ods, csv in UTF-8/Windows-1252, text PDF) · header/column detection with
AR/US decimal inference · remembered per-supplier mapping (robust to moved columns) · supplier rules (cascaded discounts,
surcharge, IVA, USD, packs, markup, keep-margin) · catalog import · matching (learned links, supplier code, own code) ·
review with filters, bulk and per-row decisions, manual linking, alerts (suspect ×5, big changes, below cost, missing,
duplicates, no price) · atomic apply and conflict-aware undo · configurable export for the POS · A4 labels · price
history · demo data · trial/plans/read-only · team invites · landing, terms, privacy · admin CLI.

## Architecture
Node 22 + TypeScript, Hono server-side JSX, SQLite (WAL), parsing in worker threads, no front-end framework, no AI
dependency, no third-party trackers. One small VPS. See 09.

## Pricing
Monthly in ARS by number of suppliers: Básico 23,000 (10) · Comercio 45,000 (40) · Distribuidora 90,000 (150);
14-day trial, read-only after; paid onboarding or free with annual. Manual billing at first. See 08.

## Unit Economics (ESTIMATES — see 14)
ARPA ≈ ARS 40,700 (≈ USD 26). Gross margin 87–96%; no AI/API costs. Cash break-even ≈ 8–10 accounts; replacing a
USD 1,600/month founder income ≈ 75–80 accounts; monotributo cap reached at ≈ 234 accounts (plan the tax move early).
Founder-led CAC ≈ ARS 65,000, payback ≈ 1.8 months, LTV ≈ ARS 916,000 at 4% churn (ASSUMPTION).

## Go-To-Market (see 15)
Founder-led walk-ins (40/week) + WhatsApp (100/week) in their own area, existing network, 3 distributor partnerships,
weekly how-to videos. The hook is a live demo on the prospect's own list; the CTA is "mandame la última lista de tu
proveedor". Pilot offer: first month ARS 15,000 with setup included. Key metric: **% of conversations that send a file**.

## QA (see 11)
82 unit/integration tests + 13 E2E (desktop + mobile) + axe-core WCAG 2.1 AA audit on 8 screens, all passing.
15 real bugs found by testing/review and fixed (e.g., 1.540 parsed as 1.54 in USD rates, footer rows as products,
action column off-screen, "Consultar" prices breaking detection, first-list demo showing no value).

## Security (see 12)
Hashed session tokens, scrypt, CSRF tokens + origin checks, strict CSP, per-account isolation verified by IDOR tests
on 20 attack paths, XSS/redirect/traversal/formula-injection tests, rate limits, zip-bomb guard, worker isolation for
parsers, `npm audit` 0 vulnerabilities. Residual: no 2FA, backups not yet configured (no host), legal review pending.

## Performance (see 13)
30k-row list vs 30k catalog: parse 0.8 s, match+price 0.65 s, apply 0.39 s, review queries 15 ms. Parsing moved to
workers: max event-loop lag 4 ms during parallel PDF parsing (before: seconds; ~730 MB spikes).

## Risks (see 17)
Top: willingness to pay in a squeezed sector (R1), "my POS already imports" (R2), incumbents adding AI import (R3),
real-world file diversity (R5), wrong prices applied (R6, mitigated by review/alerts/undo), backups (R7, launch-blocking),
founder time for distribution (R10).

## Current State
- Code complete for the MVP and pushed to `claude/gallant-ramanujan-tbccbs` (not merged, no PR opened).
- Runs locally (`npm run dev`) and as a production build (`npm run build && npm start`) — both verified here.
- **Not deployed**: no domain, server, TLS, backups or email provider were created (they need the founder's accounts
  and payment details; creating them from here would have spent money and published a service without approval).

## What Was Built
~7,300 lines of TypeScript/TSX/CSS/SQL in `src/`, ~1,200 lines of tests in `tests/`, 18 documents in `docs/`, sample data generator,
benchmark script, admin CLI, README, `.env.example`.

## What Was Tested (FACT, commands run in this session)
`npm run typecheck` ✔ · `npm test` → 82/82 ✔ (83/83 after the red-team safety fix) · `npm run test:e2e` → 13 passed, 1 skipped ✔ · `npm audit` → 0 ✔ ·
production build smoke test ✔ · benchmark ✔ · admin CLI on a copy of E2E data ✔.

## Known Limitations
- Only synthetic supplier files tested (modelled on reported formats); real files will surface new cases.
- Scanned (image) PDFs are rejected; no OCR.
- Export formats not validated against specific POS importers (Tango, etc.).
- Only Chromium tested (no Safari/Firefox); label printing not tested on physical sheets.
- Single-instance design (SQLite, in-memory rate limits); no 2FA; manual billing; emails need a Resend key.
- Legal texts not reviewed by a lawyer; trademark not checked.

## Business Hypotheses (to validate, in order)
1. H2 — Target stores spend ≥2 h/week updating prices from lists (Test A).
2. Test C — ≥80% of real Excel/CSV lists auto-detect correctly; PDFs measured separately.
3. H6 — ≥3 of 5 qualified stores pay ARS 15,000 upfront for month 1; ≥2 renew at list price (Test B).
4. H8 — Founder can get ≥1 received file per 2 hours of outreach.
5. Retention — ≥60% of paying accounts apply lists on 2+ different days per month.

## Next 10 Actions *(superseded by 19 §19–§20: screening and concierge test first; deploy only for the self-serve arm)*
1. Register the domain; deploy on a VPS with Caddy (README §Deploy); set `TRUST_PROXY=1`.
2. Configure backups (Litestream or nightly `.backup` off-server) and do one restore drill.
3. Create a Resend account and DNS records; set `RESEND_API_KEY`, `CONTACT_WHATSAPP`, `LEGAL_ENTITY`.
4. Lawyer review of Términos/Privacidad; INPI search for "Remarcá".
5. Prepare a phone/laptop demo account with the sample data; rehearse the 3-minute two-list demo (15 §3).
6. Week 1: 40 walk-ins + 100 WhatsApps in your area; ask every qualified store for its last supplier list(s).
7. Save every real file (with permission) as a test fixture; fix each parsing failure the same week.
8. Offer 5 paid pilots (ARS 15,000, setup included); onboard each personally; log support minutes.
9. Pitch 3 local distributors on forwarding Remarcá to their retailer clients.
10. Every Friday: `npm run admin -- funnel` + the funnel sheet; apply the week-4 kill/pivot rule (17).

## Recommended Next Experiment *(superseded by 19 §14)*
**"Tu lista, tus números, en 3 minutos" — 15 in-person demos in 2 weeks.** For each qualified store, process their own
supplier list(s) live (two versions if no catalog), then offer the ARS 15,000 pilot. Success = ≥30% of conversations
send a file and ≥3 stores pay. Failure (<2 paying) triggers the pivot review: distributors ("lista viva") or a
white-label deal with a local POS vendor.

---
*This report separates what was verified (tests, measurements, sourced facts) from assumptions and estimates. No customers,
testimonials or metrics were invented. The product works; the business is not yet validated.*
