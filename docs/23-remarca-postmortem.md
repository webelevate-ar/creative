# 23 — Remarcá Post-Mortem

Date: 2026-09-25.

**Final status: ABANDONED AS BUSINESS HYPOTHESIS — TECHNICALLY FUNCTIONAL BUT COMMERCIAL EVIDENCE INSUFFICIENT**

This document closes the Remarcá cycle. It does not propose features, pivots or ways to keep the project alive. The
code and the docs stay in the repository only because parts of them can be reused (§12).

Labels, as in every earlier doc:

| Label | Meaning |
|---|---|
| **FACT** | Sourced statement, or read in the code |
| **OBSERVED** | Measured by us |
| **ASSUMPTION** | Chosen by us, unverified |
| **ESTIMATE** | Derived from other inputs |
| **UNKNOWN** | Not known |

Every number below comes from docs/01–22, the git history or the session transcript. Nothing new was researched.

## Resumen

- **Qué hicimos.** Construimos en un día una herramienta que funciona. Lee listas de proveedores en planilla y las
  empareja por código sin errores. Calcula precios con la aritmética argentina, deja revisar y permite deshacer.
- **Qué no averiguamos antes de construir.** Si alguien le paga a un tercero por ese trabajo. En qué formato llegan
  de verdad las listas.
- **Qué mostraron las pruebas de escritorio al final:**
  - el trabajo se paga, pero como una tarea más dentro de un sueldo administrativo;
  - solo un tercio de las listas públicas son planillas con código;
  - el 64% son solo PDF.
- **La conclusión.** Remarcá automatizó la parte fácil, que Excel, los ERP y los asistentes de IA ya resuelven. La
  parte cara siguió siendo manual.
- **El error principal fue el orden.** Primero construimos y después validamos. Las pruebas que decidieron el caso
  costaron menos de una hora y ARS 0, y podían correrse el primer día.

---

## 1. ¿Qué problema intentábamos resolver?

Argentine retailers and distributors (ferreterías, electricidad, sanitarios, repuestos, librerías) receive supplier
price lists often, in inconsistent formats:

- Excel or PDF, with different columns;
- IVA included or not;
- cascaded discounts ("30+10");
- USD lists, per-pack prices;
- AR vs US decimals.

**The job:** turn each new list into updated costs and sale prices in the store's own system.

**The stakes as framed** (docs/02, docs/18): hours of staff time per list ("medio día" per list, one practitioner,
FACT). Margin lost by late or blanket updates, with CPI at 1.7–2.1% per month (FACT, Aug-2026). The margin loss was
never measured.

## 2. ¿Qué hipótesis comercial inicial teníamos?

From docs/05–08 and docs/18, before any building:

| # | Hypothesis | Status then | Status now |
|---|---|---|---|
| H1 | Stores receive lists in heterogeneous Excel/PDF formats | Supported | **Confirmed** (docs/20, 22) |
| H2 | Updating them is manual and slow | Supported (weak) | Partly: done in Excel + ERP by salaried staff (docs/22 §2) |
| H3 | Late updates cause margin loss | Supported (reasoned) | Supplier-dependent. For some suppliers a blanket % is nearly right (docs/22 §7) |
| H4 | Businesses pay for "know when supplier prices change" | Supported in adjacent US markets | Adjacent tools abroad cost USD 7–50/month (docs/19) |
| **H5** | **No neutral, POS-independent tool serves AR retailers** | "Supported" by **absence of evidence** | **False.** Multilistas has the same pitch in the same vertical (docs/19 K5). EmberPrice copied the feature set (docs/22 §8) |
| **H6** | **Small AR retailers will pay ≈ USD 15–40/month** | UNKNOWN | **Still UNKNOWN.** No payment observed after five phases |
| H7 | Owners trust a web tool with price data | UNKNOWN | UNKNOWN |
| H8 | The founder can reach stores cheaply (walk-in, WhatsApp) | ASSUMPTION | Untested |

**Product bet** (docs/06–08):

- a self-serve SaaS that sits beside the store's POS;
- plans at ARS 23k / 45k / 90k per month (USD 15 / 29 / 58);
- "PDF too" as a differentiator;
- deterministic parsing, with no AI per use, for margin.

**Target customer:** 1–20 employees, ≥ 8 suppliers sending lists monthly, ≥ 1,500 SKUs.

The later phases narrowed the bet twice:

- docs/19: concierge service vs self-serve;
- docs/21: a service in a narrow zone of spreadsheets with codes.

Neither narrowing survived docs/22.

## 3. ¿Qué evidencia apoyó la hipótesis?

| Evidence | Label | Source |
|---|---|---|
| The job exists and is paid: 16 Argentine job ads in ≈ 8 days name price-list upkeep, with salaries of ARS 1.0–1.6 M/month | OBSERVED | docs/22 §2 |
| Lists are re-issued often. Neopel publishes a new PDF every business day and changes ≈ 1.2% of items per day | OBSERVED | docs/22 §7 |
| For dispersed suppliers, a blanket % misprices 11–49% of items per month and 82.5% over 18 months (Neopel) | OBSERVED | docs/22 §7 |
| Product codes are common: 73% of public lists carry one | OBSERVED | docs/22 §4 |
| Vendors recognize the pain: every ERP builds an import; Multilistas built a company on it; syncX has 921 reviews | FACT | docs/19 |
| Inflation keeps prices moving (1.7–2.1%/month CPI) | FACT | docs/02 |

**What all of this proves:** the *job* is real, frequent and sometimes costly.

**What none of it proves:** that anyone pays a *third party*, or pays for *this tool*.

## 4. ¿Qué evidencia la contradijo?

| Evidence | Label | Source |
|---|---|---|
| The core pitch already exists in AR. Multilistas: *"Subís el Excel tal como te lo manda el proveedor, el sistema reconoce las columnas…"* | FACT | docs/19 K5 |
| AI substitution shipped in 2026: Tiendanube AI connector, Matrixify + Claude on supplier PDFs, Excel agent mode, Claude for Excel on a USD 20 plan | FACT (Claude for Excel: search summary) | docs/19, 22 §8 |
| Adjacent tools cost USD 7–50/month. A full POS starts at ≈ ARS 31.5k + IVA | FACT | docs/19 |
| The only buyer survey found (CAFARA, n = 47) does not rank pricing among the top needs | FACT | docs/19 |
| The PDF differentiator fails on real layouts: 1/6 lists correct (docs/20), 2/29 PDF-only lists correct (docs/22) | OBSERVED | docs/20 §5, 22 §5 |
| 84–90% of the human hours left for medium and large stores come from inputs Remarcá does not support | ESTIMATE (ASSUMPTION times) | docs/21 §5 |
| Only 33% of 45 public lists are spreadsheets with codes, and 64% are PDF-only. The pre-registered rule (< 50%) fails | OBSERVED | docs/22 §4–§5 |
| The work is bundled into salaried roles. No priced Argentine outsourced service was found | OBSERVED | docs/22 §2 |
| For uniform suppliers a blanket % is nearly right: 95% of Cámara del Libro items and 65% of Colihue's fall within 2% of the median change | OBSERVED | docs/22 §7 |
| Willingness to pay: **0 observations** in five phases | UNKNOWN | docs/19–22 |

## 5. ¿Qué parte técnica funcionó realmente bien?

All OBSERVED, on public Argentine lists unless noted.

| Component | Result |
|---|---|
| **Spreadsheet ingestion and column detection** | 7/7 benchmark spreadsheets correct, 1 after a column choice (docs/20). 10/15 of the wider set correct with no help. **0 spreadsheet lists produced wrong rows** (docs/22) |
| **Exact code matching** | Next list of the same supplier: **10,229/10,229 right, 0 wrong** (docs/20 §7) |
| **Argentine number parsing** | AR vs US decimals inferred per column; tested (`src/lib/numbers.ts`) |
| **Price math** | Cascaded discounts, IVA net/gross, USD rate, packs, markup, rounding: pure and tested (`src/lib/pricing.ts`) |
| **"Hold, don't guess" safety** | Ambiguous cases are held for review instead of applied: punctuation-only code collisions, repeated codes with conflicting prices, mixed currency, unreadable PDF pages. Added after the benchmark found real collisions (F1–F6, docs/20) |
| **Performance** | 32,892 rows in 2.3 s (first list) / 2.7 s (next list), 527 MB peak. Worker-thread parsing, zip-bomb guard (docs/13, 20) |
| **Security and QA** | 23 adversarial HTTP tests, auth, rate limits, origin checks (docs/11–12). Suite now: **91 unit/integration + 13 E2E (1 skipped), all passing on 2026-09-25** |
| **Review → apply → undo; exports** | Catalog written only on apply; every apply reversible; CSV/XLSX exports with formula-injection protection |
| **Research tooling** | Independent file inspector, hand labels, version-diff metrics and a labelled simulator gave numbers we could trust or reject |

**Takeaway:** deterministic processing of *clean* tabular inputs is a solved and cheap problem. Machine time was
never the constraint: about 3 s per month for the largest synthetic store (docs/21).

## 6. ¿Qué parte técnica resultó ser un cuello de botella?

| Bottleneck | Evidence |
|---|---|
| **Real PDF layouts** | 1/6 lists correct (docs/20). 2/29 PDF-only lists correct (docs/22). Layouts that fail: 2 products per line, matrices, catalog pages, side-by-side blocks |
| **Silent wrong rows** | Borcas: 1,295 plausible rows with the pack quantity read as the price. Martini PDF: neighbour prices. Prodem: matrix mis-pairing. Before fixes, 288/288 punctuation-only code collisions matched the wrong product (docs/20) |
| **Unreadable or oversized files** | Scanned, image-only, font-encoded and password-protected PDFs. Four real public files exceed the 12 MB cap (62, 61, 18 and 15.5 MB) |
| **Per-row Argentine complexity** | Mixed ARS/USD in one list, IVA 10.5% vs 21% per product, per-product bonificación. The model is per supplier. 10.5% items are priced 9.5% too high, silently (docs/20 §6) |
| **Lists without usable codes** | 27% of public lists have no code or an unreadable one (docs/22). Description matching: 1.2% right naive; 77 right / 463 wrong / 1,901 abstained guarded (docs/20 §7) |
| **Onboarding** | Linking a store's uncoded catalog items to supplier codes: ≈ 3–93 h per store (docs/21, ASSUMPTION times) |
| **The channel is outside the product** | Lists arrive and results leave by WhatsApp or email, by hand. One organization per user: an operator needs one login per client (FACT, code) |
| **Detection edge cases on clean sheets** | Codes with spaces ("GALAXY 50/850"), a code column headed "Modelo", a legacy-ID column picked as the code (docs/20, 22) |

**The real bottleneck was human hours on the inputs the software does not handle.** That is where the value was, and
where the cost of a service would have gone.

## 7. ¿Cuál fue el error principal de nuestra hipótesis inicial?

> **Confundimos un trabajo real y frecuente con un problema por el que alguien le paga a un tercero. Y diseñamos la
> solución para las entradas limpias, cuando el trabajo caro está en las sucias.**

It came from four specific mistakes, in order of cost:

1. **Build before kill-tests.**
   - The MVP was built in the first ≈ 70 minutes. The desk tests that decided the case came after it:
     - input-format census;
     - paid-demand scan;
     - price-change dispersion.
   - Those tests took ≈ 50 minutes and ARS 0 (docs/22). They could have run on day 1.
2. **Pain was taken as demand.**
   - Every positive signal was about the job: complaints, ERP features, inflation, job ads.
   - None was about paying an outsider. The one number that mattered, H6, stayed UNKNOWN from start to finish.
3. **"No competitor" was inferred from search silence (H5).** A direct local competitor (Multilistas) and general AI
   substitutes existed.
4. **The input distribution was assumed, not measured.**
   - The product and its economics assumed mostly spreadsheets with codes, with PDF as a bonus differentiator.
   - The field turned out mostly PDF, and PDF was the part the tool could not do.
   - docs/20's first sample (5 of 8 brands with spreadsheets) reinforced the assumption. That sample was small and
     skewed.

## 8. ¿Qué aprendimos sobre mercados B2B argentinos?

1. **Back-office work is paid through salaries, not services.**
   - The task shows up as one bullet in administrative and purchasing job ads (CCT 130/75, Administrativo A ≈ ARS
     1.32 M/month, Sep-2026, FACT).
   - Outsourcing one bullet does not remove the salary. So a tool or service is an extra cost unless it avoids a
     hire (docs/22 §2).
2. **The visible buyers were not the imagined ones.** High-overlap ads came from wholesalers, a bazar mayorista, and
   mid-size companies running Tango, Bejerman or Zeus. **None came from ferreterías**, whose ads are sales and counter
   jobs (docs/22 §2).
3. **Every obvious vertical already has local tools.** 4–8 per vertical (docs/18). Niche incumbents such as
   Multilistas do not rank high in search, but they exist.
4. **Suppliers control the format, and they are moving to PDF and private channels.**
   - 64% of public lists are PDF-only.
   - Some suppliers require a login, a password or email delivery.
   - Some run client portals (docs/19 K18, 22 §3).
5. **Argentine price lists carry local complexity that generic tools ignore:**
   - per-row IVA 10.5/21;
   - mixed ARS/USD;
   - cascaded bonificaciones;
   - coefficients;
   - "precio sugerido con IVA − descuentos".

   It clusters in material eléctrico (docs/22 §6).
6. **Inflation does not imply dispersion.**
   - Some suppliers raise prices almost uniformly: books, Dosos by family.
   - Others move item by item: Neopel.
   - "Prices change a lot" does not mean "a blanket % is wrong" (docs/22 §7).
7. **Stated priorities differ from our assumptions.** The only sector survey ranked marketing, social media,
   e-commerce and AI above pricing (docs/19).
8. **Local price anchors are low:**
   - a full POS from ≈ ARS 31.5k + IVA per month;
   - the sector reported falling sales (docs/02, 19).
9. **Research access:**
   - Computrabajo pages are readable with plain HTTP.
   - Workana (403) and Mercado Libre (login) are not.
   - Supplier lists often sit on Google Drive or WordPress uploads with predictable URLs (docs/22).

## 9. ¿Qué aprendimos sobre software para procesos basados en Excel/PDF/WhatsApp?

1. **Value sits in the messiest inputs.**
   - A tool that handles only clean spreadsheets competes with VLOOKUP, ERP imports and a USD 20 assistant.
   - The expensive part of the process is PDFs, scans, uncoded items and per-row exceptions.
2. **Deterministic PDF table extraction does not generalize.** Supplier PDFs are designed for print: catalogs,
   matrices, several products per line. A heuristic reader reaches a low ceiling (1/6, 2/29).
3. **Refusing beats guessing.** Silent wrong numbers are the worst failure in a pricing tool. Holds, visible skipped
   rows and "no pude leer esto" messages were the most valuable safety work.
4. **Identity (codes) decides everything downstream.**
   - Exact code matching is reliable.
   - Description matching is not.
   - Linking an uncoded catalog is the real onboarding cost, and it scales with SKUs, not with lists.
5. **Measure inputs before designing.** A 30-file census with an independent reader (docs/22) would have changed the
   design and the economics before the first line of product code.
6. **WhatsApp and email are the real interface.** Receiving and delivering files happened outside the product. A web
   app is an extra place to go, not a replacement for the channel.
7. **General AI assistants are the default substitute in 2026.**
   - Any product in this space must prove it beats "owner + Claude/ChatGPT/Copilot" on accuracy, memory, audit or
     access to data the assistant cannot reach.
   - Convenience alone did not clear that bar.
8. **Throughput is irrelevant; human minutes per unit are everything.** Seconds of compute vs hours of review and
   linking (docs/21).
9. **Real-data benchmarks find real bugs.** Six errors found on public files (F1–F6) never appeared on our synthetic
   fixtures.

## 10. ¿Qué señales deberíamos buscar en la próxima oportunidad?

Green flags. Each should be checked **before** building, with public data, in hours rather than days:

1. **Priced, outsourced demand is visible:**
   - service listings with prices;
   - agencies or freelancers paid specifically for the job;
   - dedicated roles, not a bullet in a generic role.

   docs/21 §17a's rule is a good template: ≥ 10 ads **and** ≥ 3 priced service offers.
2. **The purchase replaces a cost that disappears:** a vendor fee, a hire avoided, a fine, a chargeback, lost sales
   that can be measured. Not a slice of an existing salary.
3. **Inputs in the field are machine-readable.** Or making them readable is the core, and it can be proven on ≥ 30
   real samples on day 1.
4. **A USD 20/month general AI assistant or a built-in feature does not already solve ≥ 70% of it.** Otherwise the
   value must come from data or integration access the assistant cannot get.
5. **A competitor charges successfully**, which proves willingness to pay. The gap must be proven by its users
   (reviews, complaints), not by search silence.
6. **The founder can reach ≥ 20 qualified buyers in ≤ 2 weeks** through existing relationships, for example the
   founder's agency clients.
7. **Money per event is measurable from public data:** price per error, fine, lost sale or hour.
8. **Payment can be tested before code:** a pre-sale, deposit, paid pilot or letter of intent.

## 11. ¿Qué señales deberíamos considerar red flags y descartar inmediatamente?

Discard, or stop and re-scope, when any of these appears:

1. **"Nobody does this"** rests on search results alone.
2. **The job only appears inside salaried role descriptions**, with no outsourced market and no priced offers.
3. **The differentiator is the hardest technical part**, and it has not been demonstrated on real inputs. For
   Remarcá: "PDF too".
4. **Unit economics close only in a "narrow zone"** that cannot be identified from outside, or that a census shows is
   a minority (Remarcá: 18%).
5. **A free or included feature covers most of the value:** Excel formulas, POS import, Tiendanube bulk edit, a
   general AI assistant.
6. **Global analogs sell at USD 7–50/month.** That is the ceiling for a SaaS, whatever the local pain.
7. **The buyer must switch systems, or trust an outsider with sensitive commercial data** with no prior relationship.
8. **Sector surveys do not rank the problem** among the buyers' top needs.
9. **After several desk checks, all positive evidence is about pain and none is about payment.**
10. **The distribution plan is untested** (walk-ins, cold WhatsApp) and the founder has no warm list in the segment.
11. **The idea is adjacent to Remarcá and appeals because code already exists.** Examples: distributor "lista viva",
    catalog upkeep, price monitoring. That is sunk-cost reasoning; screen it like any new idea.

## 12. ¿Qué partes del código, arquitectura o investigación podrían reutilizarse en otro producto?

All of these are in the repository, tested where noted, and independent of the Remarcá business. Stack: Node 22,
TypeScript, Hono server-rendered JSX, SQLite (better-sqlite3), SheetJS, pdf.js, Zod, Vitest, Playwright.

**Code: domain-neutral (reuse as is)**

| Asset | Path | What it gives |
|---|---|---|
| AR/US number parsing | `src/lib/numbers.ts` (+ `tests/unit/numbers.test.ts`) | Decimal-separator inference, "1.234,56" vs "1,234.56", currency text cleanup |
| Money in cents | `src/lib/money.ts` | Integer centavos, es-AR formatting, change ratios |
| Safe spreadsheet reading | `src/lib/sheet.ts` | XLSX/XLS/ODS/CSV via SheetJS, with row/column/byte caps and a zip-bomb guard (`MAX_UNZIPPED_BYTES`) |
| Worker-thread parsing | `src/lib/parse.ts`, `parse-worker.ts` | Parse untrusted files off the event loop, with a concurrency cap |
| SaaS skeleton | `src/lib/security.ts`, `ratelimit.ts`, `src/services/auth.ts`, `team.ts`, `src/web/context.ts`, `src/db/index.ts` + `migrations/` | Password hashing, sessions, origin checks, rate limits, organizations with invites, SQLite migrations |
| Plans, trial and manual billing admin | `src/lib/plans.ts`, `scripts/admin.ts` | Plan limits in one place; CLI for set-plan, extend-trial, reset-link, funnel |
| Mailer | `src/lib/mailer.ts` | Memory mailer for tests; Resend in production |
| First-party events | `src/lib/events.ts` | Minimal activation/retention events, no third-party trackers |
| Safe exports | `src/services/exports.ts` (`safeText`) | CSV/XLSX export with formula-injection protection |
| Test harness | `tests/integration/http.test.ts`, `tests/e2e/*`, `playwright.config.ts` | Adversarial HTTP tests; desktop + mobile E2E with an accessibility check |

**Code: patterns worth copying (re-implement for the new domain; do not import)**

| Pattern | Where | Why |
|---|---|---|
| Upload → map → review → apply → **undo** | `src/services/imports.ts` | Bulk changes that a non-technical user can review and revert |
| "Hold, don't guess" flags | `src/services/imports.ts` (`flagsFor`, held rows) | Ambiguity becomes a visible decision, not a silent error |
| Header + content-statistics column detection | `src/lib/detect.ts` | Deterministic mapping of messy tables. The keywords are price-list-specific |
| Exact vs loose keys | `src/lib/match.ts` | Loose matches become suggestions, never automatic |
| Argentine price math | `src/lib/pricing.ts` (+ tests) | Reusable in any AR commerce product: cascaded discounts, IVA net/gross, USD rate, markup, rounding |

**Research tooling and method**

| Asset | Path | Reuse |
|---|---|---|
| Independent file inspector | `scripts/research/public_lists_inspect.py` | Format, header, sample, currency/IVA/date signals for any folder of Excel/PDF files |
| Version-diff metrics | `scripts/research/price_changes.py` (`compare`) | Share changed, dispersion, blanket error, new/removed. Any versioned list |
| Labelled dataset → prevalence tables | `scripts/research/public-lists-dataset.json` + `public_lists_stats.py` | Template for input censuses |
| Labelled business simulator | `scripts/research/business-sim.ts` | Service vs SaaS vs hybrid structure, with every value tagged FACT/OBSERVED/ASSUMPTION/ESTIMATE. **Reuse the structure, not the values** |
| Gold labels and matching experiments | `scripts/research/gold/`, `real-matching.ts`, `matching-adversarial.ts` | How to measure matching accuracy with labels |
| Method | docs/19–22 | Evidence labels; pre-registered decision rules; red-team tables; public-data kill tests (docs/22) |
| Reference data (expires quickly) | docs/22, `paid-work-evidence.json`, `public-lists-sources.json` | 45 Argentine supplier lists with format labels; CCT 130/75 wage anchor (Sep-2026); substitute prices. Dated 2026-09-25 |

## 13. ¿Qué partes NO deberíamos reutilizar simplemente por haberlas construido?

| Do not reuse | Why |
|---|---|
| The product, its UI and flows (lists review, dashboard, labels, supplier rules screens) | Built for a hypothesis that failed. Reusing them pulls the next idea toward the same problem |
| `src/lib/pdf.ts` as a "PDF solution" | Proven inadequate on real supplier layouts (1/6, 2/29). Do not base a new product on heuristic PDF table extraction |
| `src/lib/detect.ts` keyword lists and thresholds | Tuned to Argentine price lists; overfitting risk elsewhere. Only the pattern transfers |
| Pricing plans and limits (`plans.ts` values), docs/08 pricing, docs/14 economics, docs/15 GTM | Based on UNKNOWN willingness to pay; never tested |
| The simulator's parameter values (docs/21) | Every human time is an ASSUMPTION |
| docs/02–06 market-size and "gap" claims | H5 was absence of evidence and turned out false |
| The 56-opportunity list (docs/03) and its scores, as a shortlist | Scored by judgment, before AI commoditization and before the red flags in §11. Re-screen from zero; do not pick the runner-up by inertia |
| Remarcá-adjacent ideas ("lista viva", catalog upkeep, price monitoring for stores) | Same buyers, same inputs, same evidence gap. Sunk-cost risk |
| Single-process assumptions (in-memory rate limiter, one SQLite file, one org per user) | Fine for an MVP; not an architecture to carry forward |

## 14. ¿Cuánto tiempo/créditos aproximadamente consumió esta investigación y construcción?

**Time.** OBSERVED from git commits and session transcript timestamps (UTC).

| Phase | Wall-clock | Output |
|---|---|---|
| P1 Research (56 opportunities), decision, MVP, QA, docs 01–18 | 18:13 → 19:24, 24 Sep (≈ 70 min) | Product + 18 docs |
| P2 Commercial red team | ≈ 16 min | docs/19 |
| P3 Real-list benchmark + 6 fixes | ≈ 56 min | docs/20, F1–F6 |
| P4 Business simulation | ≈ 15 min | docs/21 |
| P5 Public market validation | ≈ 50 min | docs/22 |
| P6 Post-mortem | ≈ 20 min | this document |
| **Total active** | **≈ 4 h** over ≈ 17 h elapsed (24 Sep 18:10 → 25 Sep ≈ 11:15 UTC) | 16 commits |

**Compute.** OBSERVED from the session transcript, whole project to date:

- ≈ 500 model calls;
- ≈ 1.0 M output tokens;
- ≈ 192 M cached input tokens read;
- ≈ 2.3 M written to cache;
- ≈ 690 tool calls: ≈ 375 shell, 115 web searches, 38 web fetches, ≈ 80 file writes and others.

**Cost.** ESTIMATE, at Claude Opus 5.5 API list prices: USD 4 per million input tokens, 20 per million output,
0.20 per million cache reads; cache writes assumed at 2× input for the 1-hour cache.

| Phase | ≈ USD |
|---|---:|
| P1 | 21 |
| P2 | 8 |
| P3 | 24 |
| P4 | 5 |
| P5 | 16 |
| P6 | ≈ 3 |
| **Total** | **≈ 76** |

- The subscription's own credit accounting is not visible from the session: **UNKNOWN**.
- Cache reads are about half the estimate. Context size × number of calls drove the cost more than output did.
- **Money spent outside Claude: ARS 0.**
- **Founder hours in sales: 0.**
- **Stores contacted: 0.**

**Artifacts:**

| Artifact | Size |
|---|---|
| Product code (`src/`) | 7,493 lines |
| Tests | 1,325 lines; 91 unit/integration + 13 E2E |
| Research scripts | 1,829 lines, plus 5,303 lines of labels, manifests and outputs |
| Docs | 23 documents, ≈ 45,000 words |

## 15. ¿Cuál fue el retorno de aprendizaje de todo el proceso?

**What the ≈ USD 76 and ≈ 4 hours bought:**

1. **A clear, evidence-based "no".** It came before any founder time, money or customer promise was spent. That is the
   main return.
2. **Technical truths that desk research could not give.**
   - Clean spreadsheets are easy.
   - Real PDFs are not.
   - Code matching is safe; description matching is not.
   - Onboarding cost scales with uncoded SKUs.
   - Silent errors hide in real files, not in fixtures.
3. **Reusable parts** (§12). A tested SaaS skeleton, Argentine number and price utilities, safe file ingestion, a
   review/undo pattern and research tooling.
4. **A validation method.** Evidence labels, pre-registered kill rules, real-data benchmarks, a labelled simulator and
   public-data kill tests. These carry over to any next idea.

**What it cost that it did not need to** (hindsight, ESTIMATE):

- The decisive evidence came from P5: ≈ 50 min, ≈ USD 16.
- Its two central checks needed no product at all:
  - the input census;
  - the paid-demand scan.
- Run first, they would very likely have stopped or reshaped the idea before P1–P4, which took ≈ 2.6 h and cost
  ≈ USD 58.
- Some of that spend would still have been worth it for the reusable parts. **Most of it bought certainty about a
  product that did not need to exist.**

**The lesson to carry forward, in one line:**

> **Primero la evidencia de que alguien le paga a un tercero por el trabajo, y un censo de las entradas reales.
> Después el código.**

**Day-0 checklist for the next opportunity.** Public data only; roughly 1–2 hours; before any build. Derived from
§10–§11.

1. ≥ 3 priced outsourced offers or dedicated roles for the job?
2. Whose cost disappears if they buy, and how much?
3. A census of ≥ 30 real inputs: what share can be processed automatically?
4. Does a USD 20 assistant or a built-in feature already do ≥ 70% of it?
5. Who charges for it today, and what do their users complain about?
6. Can the founder reach 20 buyers in 2 weeks?
7. Pre-register the kill thresholds before looking at the answers.

---

## Repository state (final)

- **No further commits on Remarcá after this one.** No more market research on it.
- The code, docs and research scripts stay, for reuse (§12).
- **Reproduce** (verified on 2026-09-25):

  | Command | Result |
  |---|---|
  | `npm install` | Node 22 |
  | `npm test` | 91 passed |
  | `npm run typecheck` | Clean |
  | `npm run build` | OK |
  | `npm run test:e2e` | 13 passed, 1 skipped |

  - The E2E run rewrites the tracked PNGs in `docs/screenshots/`. Restore them with `git checkout docs/screenshots`.
  - `python scripts/research/public_lists_stats.py` reproduces docs/22 §4–§6 from the committed labels.
  - `npx tsx scripts/research/business-sim.ts` reproduces docs/21. It is identical to
    `business-sim-output.md` apart from that file's header.
  - Re-running the file-based research needs the third-party files, which are not committed:
    - docs/20: `scripts/research/fetch-real-lists.sh` (SHA-256 checked);
    - docs/22: the URLs in `scripts/research/public-lists-sources.json`.

    Suppliers replace their files, so results can drift.

**ABANDONED AS BUSINESS HYPOTHESIS — TECHNICALLY FUNCTIONAL BUT COMMERCIAL EVIDENCE INSUFFICIENT**
