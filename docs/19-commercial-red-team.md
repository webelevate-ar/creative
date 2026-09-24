# 19 — Commercial Red Team: trying to prove Remarcá is NOT a business

Date: 2026-09-24. Scope: desk research from the cloud container + experiments run on our own code.
**No customer was interviewed, no file from a real store was processed, no payment was received.**

Labels:
**FACT** = verified observation (a source says it verbatim, or we measured it).
**EVIDENCE** = indirect observation that bears on a hypothesis (a user post, a survey, a competitor's existence).
**ASSUMPTION** = believed, not verified. **ESTIMATE** = number derived from assumptions. **UNKNOWN** = no evidence.

---

## 1. Executive Summary

**Verdict: the problem survives; Remarcá as a self-serve SaaS does not survive this red team as positioned.
Do not build more. Move to a cheap field test that can kill it in 3–4 weeks.**

What changed since the final report (18):
1. **The core already exists in Argentina.** Multilistas (AR) says, verbatim: *"Subís el Excel tal como te lo manda el proveedor, el sistema reconoce las columnas y te muestra el resultado antes de aplicar"* and *"Cuando el proveedor actualiza la lista, tus precios se recalculan solos"* — same vertical, same channel (WhatsApp), bundled with invoicing. Our "no neutral competitor" claim was based on absence of evidence; the core capability is **not** unique.
2. **AI substitution is no longer hypothetical — it shipped in 2026.** Tiendanube's official Admin MCP lets ChatGPT/Claude *"editar productos en forma masiva: cambiar precios"* with approval; Matrixify documents *"hand Claude your supplier file as-is"* (PDFs included) to update store prices; Excel Agent Mode is available even on Microsoft 365 Personal/Family; ChatGPT for Excel is in beta.
3. **International price anchors for the adjacent job are USD 7–50/month** (syncX Stock Sync USD 7–10 with 921 reviews; Matrixify USD 20–50), below our USD 15–58 plans.
4. **Matching is the real product, and it is expensive where codes are missing.** In our adversarial test, when the store keeps supplier codes, code matching was correct 9/9 with 0 errors; when it doesn't, 23 of 26 items needed the user, and numeric code collisions produced **2 silent wrong matches applied by default** (a Bosch drill costed as a Bahco wrench). We fixed that safety bug; the onboarding cost remains.
5. **The one buyer-side signal we found is not in our favor**: in CAFARA's 2026 survey (n=47, 75% ferreterías) the top needs are digital marketing, social media, e-commerce, sales techniques and AI — pricing appears only as an open-ended mention.

What still stands: the pain is recognized across the industry (every ERP builds an import; a practitioner reports "medio día" per list; a Microsoft Q&A user calls it "extremely time-consuming and error-prone"), money is spent around it (ERPs, Multilistas, syncX), and prices in Argentina still move (1.7–2.1%/month CPI; +15% on domestic hardware items post-election, −20–25% on imports).

**Most likely viable shape (hypothesis, not proven):** the same job sold as a **done-for-you service** ("mandame la lista por WhatsApp; en 24 h tenés el archivo para tu sistema, las etiquetas y los productos que estás vendiendo bajo costo"), with Remarcá as the founder's internal tool, to stores whose POS imports a simple file but who lack the time/skills to prepare it. The next experiment tests exactly this against self-serve.

---

## 2. What We Know (FACT)

| # | Fact | Source |
|---|---|---|
| K1 | Remarcá works end to end on synthetic files: xlsx/xls/ods/csv/text-PDF, detection, matching, AR pricing, review, apply/undo, export; 83 unit/integration + 13 E2E tests pass | this repo, commands run |
| K2 | CPI Aug-2026 1.7% m/m, 33.5% y/y | [Bloomberg Línea](https://www.bloomberglinea.com/latinoamerica/argentina/cuanto-dio-la-inflacion-de-agosto-2026-en-argentina-segun-el-indec/) |
| K3 | Hardware prices moved both ways in early 2026: imported −20–25%, domestic ≈ +15% post-election (San Juan chamber) | [Diario Huarpe, 08-Jan-2026](https://www.diariohuarpe.com/nota/ferreterias-arrancan-2026-con-ventas-ajustadas-y-presion-de-costos-2026186021) |
| K4 | Grocery merchants (Posadas, Jan-2026) report a price plateau: suppliers send increases, then bonificaciones weeks later because "la gente no convalida aumentos" | [Primera Edición, 19-Jan-2026](https://www.primeraedicion.com.ar/nota/101074885/consumo-frena-aumentos-precios-posadas-comercios/) |
| K5 | Multilistas: Excel "tal como te lo manda el proveedor", column recognition, preview, backup, auto-recalculated sale prices, up to 3 sale prices, discounts per list, search across all lists, invoicing (one or several CUITs), roles, 15-day trial; price not published; PDF not mentioned | [multilistas.com.ar](https://www.multilistas.com.ar/) (fetched) |
| K6 | Líder Gestión's Excel price update requires columns `CODIGO` and `PRECIO`; matches by internal code, barcode or "otros códigos"; no discount/markup logic documented | [Wynges Academia](https://wynges.com/Academia/modulo-actualizar-precios-excel/) |
| K7 | Tango's supplier price list (Excel) carries purchase unit, **bonificación**, deviation and price per article-supplier; costs can update on invoice registration | [Tango Gestión Blog / Axoft docs](https://www.tangogestionblog.com.ar/2021/06/compras-e-importaciones-actualizacion.html?m=1) (search summary of Axoft PDFs; PDFs are scanned images) |
| K8 | AdmGlobal (POS) requires a fixed CSV layout keyed by barcode; preview; unmatched skipped | [AdmGlobal help](https://admglobal.com.ar/ayuda/centro-ayuda/actualizacion-masiva-de-precios-desde-excel/) |
| K9 | Fierro (AR, bookstores) import wizard: choose code column, match by supplier codes, specify decimal/thousand format | [Fierro KB](https://soporte.fierro.com.ar/portal/es/kb/articles/howtos-ventas-ventas-15a) |
| K10 | Contabilium ARS 122,000–245,000 + IVA/month, includes "actualización masiva de precios"; Dux from ARS 31,500–36,000 + IVA/month (search result; primary page 403) | [Contabilium](https://contabilium.com/ar/planes), [Dux (search)](https://duxsoftware.com.ar/precios) |
| K11 | syncX Stock Sync (Shopify): Free / USD 7 / USD 10 (5k–50k products, 30 feeds, markups) / USD 300; 4.7★, 921 reviews; complaints about support and billing changes | [Shopify App Store](https://apps.shopify.com/stock-sync), [reviews](https://apps.shopify.com/stock-sync/reviews?page=2) |
| K12 | Matrixify USD 20 / 50 / 200 per 30 days; tutorial: supplier PDF/Excel "as-is" → Claude maps, applies markups, builds import, pushes via MCP | [pricing](https://matrixify.app/pricing/), [tutorial](https://matrixify.app/tutorials/bulk-update-shopify-products-from-any-supplier-file-with-claude-ai-and-matrixify-mcp/) |
| K13 | Tiendanube AI connector (Claude, ChatGPT): "Editar productos en forma masiva: cambiar precios…", "Nada se ejecuta sin que vos lo apruebes" | [Tiendanube help](https://ayuda.tiendanube.com/es_ES/conectores-de-ia/como-gestionar-mi-tiendanube-con-herramientas-de-ia-sin-entrar-al-administrador) |
| K14 | Copilot agentic features in Excel are GA (22-Apr-2026) for M365 Copilot and Premium, "also available to users with Microsoft 365 Personal and Family plans" | [Microsoft blog](https://www.microsoft.com/en-us/copilot/blog/2026/04/22/copilots-agentic-capabilities-in-word-excel-and-powerpoint-are-generally-available/) |
| K15 | ChatGPT for Excel add-in beta (09-Mar-2026), US/CA/AU, Plus and above | [wwwhatsnew](https://wwwhatsnew.com/2026/03/09/chatgpt-llega-a-excel-y-suma-integraciones-financieras-que-cambia-para-los-equipos-que-viven-entre-celdas-y-mercados/) |
| K16 | CAFARA 2026 training survey: n=47 (75% ferreterías); top 5 needs: digital marketing, social media, e-commerce, sales techniques, intro to AI; pricing only in open-ended answers | [Revista Ferreteros](https://revistaferreteros.com.ar/en/encuesta-de-capacitacion-ferretera-2026/) |
| K17 | Adversarial matching test on our engine (details §8): with supplier codes 9/9 correct, 0 wrong; without them 23/26 need the user; before our fix, 2 wrong matches were applied by default; after the fix, 0 | `scripts/research/matching-adversarial.ts` |
| K18 | Wholesalers already run client portals/price tools: Debyferr (Córdoba, 1,500+ clients) offers a "Buscador de Precios" with the client's chosen margin; Dipel, JCB, Franco Mayorista, Casa Loureiro offer downloads/portals | [Debyferr (search)](https://www.debyferr.com.ar/), [search results](https://www.maaba.com.ar/) |
| K19 | Tul (Colombia/Brazil/Mexico): B2B marketplace for 8,000+ ferreterías with multi-supplier price comparison; not present in Argentina | [El Colombiano](https://www.elcolombiano.com/negocios/empresas/la-historia-de-tul-el-marketplace-de-los-ferreteros-que-sobrevivio-a-la-crisis-y-espera-vender-us-10-millones-mensuales-PN23843639), [Portafolio](https://www.portafolio.co/negocios/empresas/las-novedades-de-tul-tras-evolucionar-a-marketplace-593071) |

## 3. What We Assume (ASSUMPTION — believed, unverified)

| # | Assumption | Why it matters | Status after red team |
|---|---|---|---|
| A1 | Target stores spend ≥2 h/week updating prices from lists | Core value | Weakened: only one practitioner claim ("medio día"); buyer survey doesn't rank it |
| A2 | Their POS can import a simple file (code;price) | Remarcá's output must be usable | Partly supported (Líder, AdmGlobal, Tango, GEOMA import); prevalence among small stores UNKNOWN |
| A3 | Their catalog stores the supplier code (or uses it as own code) | Makes matching cheap after first import | **UNKNOWN and critical** (§8) |
| A4 | Monthly frequency of new lists per supplier | Justifies a subscription | Weakened by the 2026 plateau (K4); still plausible for hardware (K3) |
| A5 | Non-technical staff won't use Excel/AI to do it themselves | Protects against substitutes | Weakened by K13–K15 |
| A6 | 4% monthly churn, ARPA ≈ ARS 40,700 | Economics (14) | Untested; K11–K12 suggest lower price expectations |
| A7 | Founder can reach stores via walk-ins/WhatsApp at low cost | Distribution | Untested; cold WhatsApp has policy risk (§10) |

## 4. What We Don't Know (UNKNOWN)

1. Whether any Argentine store will pay for this — at any price — instead of its current method.
2. The share of target stores whose system holds supplier codes (A3) — decides whether onboarding is minutes or days.
3. How many supplier lists a typical store receives per month in 2026, and in which format (Excel vs PDF vs scanned).
4. Whether stores that pay want **a tool** or **the work done** for them.
5. Multilistas' price, customer count, whether it exports to other systems (a search summary says yes; not verified on a primary page), and its churn.
6. Real matching accuracy on real catalogs and lists (our dataset is synthetic and built by us).
7. How often a store sells below replacement cost and how much it loses (no data; our 02 §3.3 figure is an estimate on assumed inputs).
8. Market size of the narrow segment that remains after substitutes (§6).

---

## 5. Problem Validation

| Question | Answer | Label |
|---|---|---|
| Does updating prices from supplier lists really hurt? | Recognized as a problem by vendors (every ERP builds imports), a practitioner ("medio día" per list, errors ×1000 from decimals), a B2B user on Microsoft Q&A (*"thousands of articles… frequently updated… extremely time-consuming and error-prone"*, [link](https://learn.microsoft.com/en-us/answers/questions/1688873/using-copilot-to-compare-2-different-excel-price-l)), a Shopify merchant with daily supplier pricelists. **No Argentine store owner's own words found.** | EVIDENCE (moderate, indirect) |
| How often? | Hardware: price moves both directions in 2026 (K3); some sectors see supplier corrections weekly (K4). Per-store frequency UNKNOWN | UNKNOWN |
| How much time? | "medio día" per list (one practitioner) → 2–10 lists/week → 4–20 h/week is our earlier ESTIMATE with wide error | ESTIMATE (weak) |
| How much money is lost doing it wrong? | Mechanism is sound (selling at old cost after an increase); magnitude UNKNOWN. Note K3: failing to *lower* prices when imports drop also loses sales | UNKNOWN |
| Who does it today? | Owner or an administrativo; in larger stores an ERP implementer builds the import once | ASSUMPTION |
| With what tools? | Excel/VLOOKUP, POS import (fixed formats), ERP supplier lists (Tango), blanket % increases, supplier portals (K18), and now AI assistants (K13–K15) | EVIDENCE |
| What does it cost today? | Staff time (Admin A ≈ ARS 1.9M/month fully loaded, ESTIMATE); software bundled in POS/ERP fees (ARS 31.5k–528k/month, K10) | ESTIMATE / FACT |
| What happens if they don't automate? | They keep doing it slower, or raise everything by X% and absorb margin errors. The business keeps running — this is a **productivity/margin problem, not an existential one** | ASSUMPTION |

**Red-team conclusion:** real problem, weak urgency evidence. The only buyer-side ranking we found puts it outside the top 5 needs (K16). A productivity pain that is "annoying but survivable" is the classic profile of products people like and don't pay for.

## 6. Substitute Analysis — *why would anyone pay instead of keeping their method?*

| Substitute | Who it serves well | Where it fails | Would that user pay for Remarcá? |
|---|---|---|---|
| Excel + VLOOKUP/XLOOKUP | Owners comfortable with formulas, few suppliers | Breaks when columns move; PDFs; discount cascades by hand | Unlikely (free, known) |
| Power Query / VBA / Python | Excel power users, consultants | Needs skills; brittle per format | No |
| **AI assistants** (Copilot Agent Mode, ChatGPT for Excel, Claude/ChatGPT + Tiendanube MCP) | Anyone with M365 Personal/Family or a ChatGPT/Claude plan; Tiendanube sellers | Ad hoc each time, no memory/audit by default; staff must write prompts; offline POS not connected | **Low** — especially Tiendanube sellers (K13) |
| ERP supplier lists (Tango) | Mid-size SMBs with implementers | Needs Tango's file layout; expensive | Maybe for PDF→Excel only (small value) |
| POS fixed-format import (Líder, AdmGlobal, GEOMA) | Stores with POS and codes | Someone must build the clean file and apply discounts/margins | **Most plausible buyer** — if A1 and A3 hold |
| Multilistas | Small stores that sell from supplier lists at the counter | POS lock-in (switching cost), no PDF mentioned | Only if they refuse to switch POS |
| Supplier portals / tools (Debyferr, Dipel…) | Clients of that supplier | One supplier at a time | Partial substitute |
| Blanket % increase | Everyone in a hurry | Margin leak per item | Only if the leak is shown in their numbers |
| Human (administrativo) | Stores with staff | Cost, errors | Would pay **to replace the human hours** — points to a service |
| Consultants (custom automation) | Mid-size | ≥USD 1,500 per project | No |

**Answer to the key question:** a store pays for Remarcá only if (a) it has several messy suppliers, (b) its POS imports a simple file, (c) nobody in the store is comfortable with Excel/AI, and (d) the hours saved or the margin protected are visible to the owner. That is a **narrow, unmeasured segment**. For everyone else there is a free or already-paid alternative. **Negative signal.**

## 7. Competitor Analysis

| Name | Country | Segment | Price | Model | List import | Matching | Price update | ERP/POS integration & export | Automation | Limitations | Negative reviews | Strengths | Distribution | Size |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Multilistas** | AR | Ferreterías, electricidad, sanitarios | Not published (15-day trial) | SaaS POS + list manager | Excel as sent, column recognition, preview | Not needed: lists are the catalog (search across lists) | Auto recalculation, discounts per list, 3 sale prices, USD (search summary) | Export to ERP per search summary (**unverified**) | Recalc on upload | No PDF mentioned; requires working inside its system | None found | Same vertical & pitch; invoicing included | Web + WhatsApp | UNKNOWN |
| Tango Gestión (Axoft) | AR | Mid-market | ≈ ARS 528k/mo (vendor-biased source) | ERP + implementers | Excel supplier lists | Article-supplier relation | Bonificación per article; costs on invoice | Native | Cost update on purchases | Expensive; fixed layout | Not searched | Market standard | Partner network | Large (UNKNOWN) |
| Líder Gestión | AR | Retail SMB | From ≈ ARS 588k perpetual | License | Excel `CODIGO;PRECIO` | Internal/barcode/other codes | Price only | Native | Manual | No discounts/markups documented | — | Cheap long-term | Content marketing | UNKNOWN |
| GEOMA | AR | Ferreterías, sanitarios, repuestos | ARS 400k + 69k/mo | License + fee | Excel | Code | % by supplier/category | Native | Manual | — | — | Vertical | Local | UNKNOWN |
| AdmGlobal | AR | Retail POS | UNKNOWN | POS | Fixed CSV | Barcode | Price | Native | Manual | Rigid format | — | Preview | — | UNKNOWN |
| Contabilium | AR | SMB ERP | ARS 122k–245k + IVA | SaaS | Mass import | Code | Bulk update | Native | — | Price | — | Brand | Online | UNKNOWN |
| Dux Software | AR/MX/CL/UY | SMB | From ARS 31.5k–36k + IVA | SaaS | Price lists (details UNVERIFIED) | — | Bulk | Native, e-commerce | — | — | — | Cheap full POS | Online | UNKNOWN |
| syncX Stock Sync | Global | Shopify merchants | USD 0/7/10/300 | App | CSV/XLSX feeds, schedules | SKU | Markups, rules | Shopify | Scheduled | Shopify only; no PDFs stated | Support, billing changes | 921 reviews | App store | 921 reviews |
| Matrixify (+Claude MCP) | Global | Shopify | USD 20/50/200 | App | Any file incl. PDF via Claude | Barcode/SKU | Markups via prompt | Shopify | Conversational | Shopify only | — | AI-native | App store | UNKNOWN |
| Tiendanube Admin MCP | AR/LatAm | Tiendanube stores | Included (plan requirements UNKNOWN) | Platform feature | Via Claude/ChatGPT | By prompt | Bulk price edits with approval | Tiendanube | Conversational | Online store only | — | Distribution to 180k+ stores (secondary source) | Platform | Large |
| Excel Agent Mode / ChatGPT for Excel | Global | Anyone | Included in M365 Personal/Family; Copilot Business USD 21/user | Horizontal AI | Files the user opens | By prompt | By prompt | None | Conversational | No memory/audit; prompt skill | — | Already on the PC | Microsoft/OpenAI | Massive |
| Debyferr "Buscador de Precios" | AR (Córdoba) | Its 1,500+ clients | Free for clients | Supplier tool | N/A | N/A | Client margin | — | — | One supplier | — | Free | Supplier relationship | 1,500+ clients |
| Tul | CO/BR/MX | Ferreterías | Marketplace take | B2B marketplace | N/A | N/A | Price comparison | — | — | Not in AR | — | 8,000+ stores | Field sales | Large |

**What Remarcá does that a client cannot get elsewhere:** nothing *individually*. The **combination** — messy Excel **and PDF**, Argentine discount/IVA/USD math, change and below-cost alerts, undo, output for *any* POS, without switching systems, usable by non-technical staff — is not offered by one product we found. That is **convenience, not capability**, and it is copyable in weeks by Multilistas (add export/PDF) or by any POS (add an AI import).

**Concrete differentiation to test (not to build):**
1. **Outcome instead of software**: "you send the list, you receive the POS file + labels + alerts in 24 h" (service with software inside). Competitors sell tools; the store's real alternative is an employee's time.
2. **Multi-supplier neutrality for stores that refuse to change POS** — only valuable if A2/A3 hold.

## 8. Matching Risk

Experiment: `npx tsx scripts/research/matching-adversarial.ts` (30 supplier rows, 29 catalog items with distractors). **Hand-built by us; shows failure modes, not accuracy.**

| Scenario | Correct | Needs the user | Correctly "not carried" | Wrong | Wrong **applied by default** |
|---|---|---|---|---|---|
| Engine, store keeps supplier codes | 9 (all 9 coded items, incl. `TH-840-Z`↔`TH840Z`, `050106`↔`50106`) | 17 (uncoded items) | 4 | 0 | 0 |
| Engine, store uses own numeric codes — **before fix** | 2 (by luck) | 23 | 3 | 2 | **2** |
| Engine, own numeric codes — **after fix** | 2 | 23 | 3 | 2 | **0** (held: "Coincide solo el código: verificá") |
| Prototype description matcher (research only, not in product) | 17 | 8 (abstained) | 4 | 1 (unit ↔ box of 100) | n/a |

The user's examples:

| Supplier | Catalog | Can it be automatic? |
|---|---|---|
| `Tornillo Hexagonal 8x40 Zincado Caja 100` | `TORNILLO HEX 8X40 ZINC C/100` | By code: yes if codes exist. By description: plausible with abbreviation expansion + dimension/pack agreement — **as a suggestion to confirm**, never auto-apply (8x50 / negro / phillips variants are one token away) |
| same | `Tornillo 8x40` | **No.** Type and pack are missing; could be any 8x40, per unit or per box. Needs the user and a unit conversion |
| same | `TH 8*40 100U` | Only with a store-specific abbreviation dictionary (TH = tornillo hexagonal) learned from confirmations. User first |

Other failure modes observed: mm vs inches (115 mm = 4½"), synonyms (widia = hormigón, PPF = fusión), color/length variants, brand collisions (Bahco vs Stanley 13 mm), model renames (Kallay 503 vs 4003), discontinued/new items, **pack vs unit** (25 kg sack vs per-kg; box of 100 vs unit), and **numeric code collisions across namespaces** (fixed).

**Implications:**
- **Automatic application is only safe on code matches** (supplier code or a previously confirmed link). Description similarity may only *suggest*.
- **Unit/pack conversion per item is not modeled** (only supplier-level "price per pack"): a correct match can still produce a ×25 or ×100 price error. The "suspect" flag catches extreme ratios, not all. Documented gap — **not built** (§13).
- **Onboarding cost depends on A3.** If the catalog lacks supplier codes, the first list of each supplier needs manual linking: ESTIMATE 30–60 s per item with today's search-box UI → 3,000 items ≈ 25–50 h per store (one-time). Even with good suggestions (10–20 s/item) ≈ 8–17 h. Self-serve onboarding is not realistic in that case; a concierge must absorb it, or the product must work "lists-as-catalog" like Multilistas (which avoids matching entirely).
- Real-world accuracy: **UNKNOWN**. Test C (30 real files) remains mandatory.

Safety fix applied (the only product change in this phase, required to run any pilot safely): own-code matches whose descriptions share no meaningful word are flagged `check_match` and not applied by default. Regression test added (`tests/integration/pipeline.test.ts`, "matching safety").

## 9. Pricing Validation

| | Value | Label |
|---|---|---|
| Observed prices, same/adjacent job | syncX USD 7–10 (≤50k products); Matrixify USD 20–50; Dux ARS 31.5k+IVA (full POS); GEOMA ARS 69k; Contabilium ARS 122k–245k+IVA; Tango ≈ ARS 528k; MarginEdge USD 350/location (includes human invoice processing) | FACT |
| Observed willingness to pay for Remarcá | **None** | UNKNOWN |
| Potential economic value | Time: Admin A ≈ ARS 10k/h (ESTIMATE) × hours saved (UNKNOWN). Margin: UNKNOWN | ESTIMATE/UNKNOWN |

Scenarios:

| Scenario | Price | What must be true | Plausibility today |
|---|---|---|---|
| P1 Self-serve cheap | ARS 10–15k/mo (≈ USD 7–10, syncX level) | Near-zero support; scalable channel; ~250 accounts to replace founder income (ESTIMATE) | Low: no scalable channel found (§10) |
| P2 Current plans | ARS 23–45k/mo | ≥2–3 h/week saved **and** visible to the owner; beat "for a bit more I get a full POS" (Dux ≈ ARS 38k final) | Unproven; K10/K11 anchors push down |
| P3 Done-for-you service | ARS 60–120k/mo (N suppliers) or ARS 4–8k per list | Replaces 6–12 h/month of staff time; founder spends ≤15–20 min per list with Remarcá; store trusts an outsider with prices. Capacity: 40 customers × ~8 lists/month × 20 min ≈ 107 h/month (ESTIMATE) — near a solo founder's ceiling; an assistant is needed beyond that | **Best economics per customer**; MarginEdge shows service-backed pricing works elsewhere; UNTESTED in AR |
| P4 Distributors ("lista viva") | ARS 90–150k/mo | Distributors value publishing client lists; they don't already have portals | Weakened: many already have portals/tools (K18) |

The pilot must test price, not assume it: the service offer at a clear price vs. the self-serve price, with money paid upfront.

## 10. Distribution Analysis

**First 10 customers**

| Channel | Who buys / decides | Where | Message | Initial offer | CTA | Cost | Difficulty | Time to first customer (ESTIMATE) |
|---|---|---|---|---|---|---|---|---|
| Personal network (founder's web-agency clients and their contacts) | Owner | Existing contacts | "¿Quién actualiza los precios cuando llega una lista? Te lo hago en 24 h" | Concierge pilot | Send last list by WhatsApp | ≈0 | Low | 1–2 weeks |
| Walk-ins in own city | Owner (decides), encargado (feels the pain) | Ferreterías/electricidad/sanitarios, 10–12 h | Same, with a live demo on their file | Concierge pilot, ARS 30k 4 weeks | Send the list now | Time + transport | Medium (≈3–5 visits per qualified conversation, UNKNOWN) | 2–3 weeks |
| Warm intros from 1–2 local distributors | Owner of the retail client | Distributor's sales reps | "Tus clientes actualizan tu lista sin errores" | Free month for referred stores | Rep forwards contact | Free months | Medium | 3–6 weeks |

**First 100 customers** — this is where the case is weakest:

| Channel | Assessment |
|---|---|
| Cold WhatsApp | Business-initiated messages require prior opt-in and approved templates; "displaying a WhatsApp number alone does not count as opt-in" ([WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/), [Infobip summary](https://www.infobip.com/docs/whatsapp/compliance/user-opt-ins)); marketing templates are billed per message ([Meta pricing](https://whatsappbusiness.com/products/platform-pricing/)). Cold messages from a personal number risk reports/bans; fit with Argentina's "No Llame" rules for messaging is UNKNOWN. **Not scalable; use only for warm contacts.** |
| Paid ads (Meta) | B2B LatAm CPL USD 8–25 (vendor benchmark, [Fuelads](https://fuelads.tech/benchmarks-latam-2026)); at 5–10% lead→paid, CAC ≈ USD 80–500 vs ARPA USD 15–26 → payback 3–30 months (ESTIMATE). **Not viable at current prices.** |
| SEO/content ("actualizar lista de precios excel") | Slow, competes with ERP vendors' content (Wynges publishes heavily); search volume UNKNOWN |
| Chambers (CAFARA, regional) | Credible for talks; buyers ask for marketing/sales training (K16), not pricing tools |
| Accountants | Influence invoicing software, not pricing — weak |
| **POS vendors/resellers without good import** (Líder-like, AdmGlobal-like, local resellers) | **Most scalable path**: they own the customer, and our output feeds their import. Risk: they can build it (with AI) themselves. UNTESTED |
| Distributors with 1,000+ retail clients | Scalable if they sponsor it; but leading ones build their own tools (Debyferr) |

**Red-team conclusion:** the first 10 are reachable by the founder personally; **the path to 100 is unproven** and the only scalable channel (POS vendors) is also the most likely copier. For a service model, 30–40 customers (ESTIMATE) may be enough to replace the founder's income, which makes founder-led sales sufficient.

## 11. Retention Analysis

- **Natural frequency** = suppliers × update rate. 10 suppliers updating every 4–6 weeks → ~2 lists/week (ESTIMATE). In the 2026 plateau (K4) many suppliers may update monthly or less → ~2–3 lists/month for small stores.
- **What brings them back:** a new list arriving. Remarcá does not create the trigger; the supplier does. Stale-supplier reminders are not built.
- **The value is invisible after the first month**: time saved is felt, but margin protected is a loss that never happened. Owners rarely attribute avoided losses to a tool → churn risk (ASSUMPTION).
- **After first use**: learned links and settings create mild switching cost (exportable, weak).
- If usage is ~monthly, a **per-list or service fee** fits better than a monthly subscription; if weekly, a subscription is justified.
- The pilot must measure lists per store per week, not satisfaction.

## 12. Moat Analysis

| If tomorrow… | What remains |
|---|---|
| A POS adds smart import | Only stores on POSes that don't (shrinking) |
| Multilistas adds export/PDF | Little — they already have the vertical, the pitch and invoicing |
| ChatGPT/Claude/Gemini/Copilot do it natively (already happening, K12–K15) | Memory, audit, undo, repeatability for non-technical staff — real but thin |
| A clone appears | Nothing proprietary |
| Suppliers send standardized lists | The format problem disappears; margin/alert logic remains (small) |

Possible **future** advantages (none exists today): per-store learned links (weak, exportable); a cross-store supplier-format library (needs scale; privacy constraints); distributor/POS partnerships (real if signed); **trusted service relationships in a region** (real for a service business, not for SaaS).

**Honest conclusion: Remarcá has no moat today.** For a service business, the "moat" is the relationship and the operational cost advantage the tool gives the founder — enough for a small profitable business, not for a venture.

## 13. Product Audit (no changes made except the matching safety fix)

| Functionality | Problem it solves | Value | Necessary for validation MVP | Keep |
|---|---|---|---|---|
| Upload xlsx/xls/ods/csv | Lists arrive in these | High | Yes | Keep |
| Text-PDF parsing | Lists in PDF | High if PDFs are common (UNKNOWN) | Yes (differentiator vs Multilistas) | Keep; measure % PDF in Test C |
| Column detection + remembered mapping | Messy formats | High | Yes | Keep |
| AR/US decimal inference | ×1000 errors | High | Yes | Keep |
| Supplier rules (discounts, IVA, USD, pack, markup) | AR price math | High | Yes | Keep |
| Keep-margin mode | Preserves store's pricing | Medium | Yes | Keep (risk R17) |
| Catalog import | Needed for matching | High | Yes | Keep |
| Matching (links → supplier code → own code) | Core | High | Yes | Keep; **own-code safety fix applied** |
| Manual linking (search box) | Uncoded items | Medium | Yes, but too slow for big catalogs | Keep; suggestions are the #1 candidate *if* A3 is false and the test is GO |
| Review with 9 filter tabs, bulk actions | Control | Medium | Partly | Keep; simplify to ~4 tabs later (hard to explain) |
| Flags (suspect, below cost, big change, check_match, missing, dup) | Decision support | High ("bajo costo" is the money moment) | Yes | Keep |
| Apply (atomic) + Undo | Trust | High | Yes | Keep |
| Export configuration by column *numbers* | POS formats | Needed | Yes | Keep; UI is hard to explain (support risk) |
| Price labels | Shelf work | Unknown | No | Keep dormant; don't sell on it |
| Price history | Audit | Low–medium | No | Keep (cheap) |
| Team invites | Plans with 3/10 users | Low now | **No — premature** | Keep dormant |
| Trial / plans / read-only / limits | SaaS monetization | Low now (billing is manual) | **No — premature for a concierge test** | Keep dormant |
| Landing page | Acquisition | Low (channel is field sales) | No | Don't invest |
| Demo data | Sales demo | Medium | Yes | Keep |
| Admin CLI | Manual billing | Medium | Yes | Keep |
| Worker parsing, zip-bomb guard, security | Safety | High | Yes | Keep |

Documented, **not built**: per-item unit/pack conversion on links; description-based link suggestions; supplier-list diff mode without catalog as a first-class screen; "lists-as-catalog" search. Build any of these **only** if §15 says GO and the pilot shows it is the blocker.

## 14. Commercial Experiment (the cheapest test that can kill it)

**Phase 0 — Screening (week 1, cost ≈ 0, no selling)**
- **Who:** 30 retailers in the founder's area — ferreterías, electricidad, sanitarios, pinturerías, repuestos (+ 5 small distributors).
- **Script (10 min):** How many suppliers send lists? Format (Excel/PDF/scan)? How often in the last 3 months? Who updates prices, how, how long last time? What system? **Does each product have the supplier's code loaded, or do you use the supplier's code as yours?** Last time you found you were selling below cost? Have you tried ChatGPT/Copilot for this?
- **Output:** a sheet with one row per store (not interpretations).

**Phase 1 — Concierge vs self-serve offer (weeks 2–4)**
- **Offer (service):** *"Me mandás por WhatsApp cada lista que te llega; en 24 h te devuelvo el archivo listo para importar en tu sistema, las etiquetas y la lista de productos que estás vendiendo bajo costo. Vos solo revisás e importás."*
- **Offer (self-serve, alternative):** the same software, they do it themselves, with a 30-min setup session.
- **Client:** qualified stores from Phase 0 (≥6 suppliers with lists; a system that imports a file, or Excel; someone spends ≥1 h/week on it).
- **5-minute demo:** with their last list of their main supplier (and the previous one, or their POS export): (1) upload → columns and costs with their bonificación in 30 s; (2) what went up/down/disappeared; (3) if POS export available: **"estos N productos hoy los estás vendiendo por debajo del costo nuevo"**; (4) the file for their system. Then the offer.
- **Pilot:** 4 weeks, up to 10 suppliers, founder uses Remarcá internally; logs minutes per list.
- **Price:** ARS 30,000 for the 4 weeks, **paid upfront** (transfer or Mercado Pago link); self-serve at ARS 20,000.
- **CTA:** "Mandame la última lista ahora" → then "Transferí y arrancamos hoy".
- **Metrics:** qualification rate; file-sent rate; paid rate by offer; lists sent per store per week; % of delivered files actually imported (ask for a screenshot of the POS or re-check 5 shelf prices); founder minutes per list; renewal at list price (service ARS 60,000/mo or self-serve ARS 30,000/mo) in week 5.

## 15. Go / Pivot / No-Go Criteria (behavioral, with reasons)

Sample sizes are small (≈20–30); thresholds are **decision rules**, not statistics.

| Stage | Metric | GO | PIVOT | NO-GO | Why this threshold |
|---|---|---|---|---|---|
| Qualification | % of screened stores meeting ICP | ≥30% | 15–29% (narrow further) | <15% | Below 1 in 7 the reachable market is too thin for founder-led sales |
| Pain behavior | % of qualified who send a real list within 48 h | ≥40% | 20–39% | <20% | Sending a file costs them 30 s; if 4 of 5 won't, the pain doesn't drive action |
| Code prevalence (A3) | % of qualified whose system holds supplier codes | ≥50% | 20–49% → lists-as-catalog or service only | <20% → matching makes the tool impractical; service only | Decides onboarding cost (§8) |
| Payment | Qualified → paid pilot (either offer) | ≥15% (≥3 of 20) | 5–14% (2 of 20) | <5% (≤1 of 20) | At ~40 qualified conversations/month (ESTIMATE), 15% ≈ 6 new customers/month; with 4% monthly churn that reaches ~40 accounts (enough for a service model) in ~8 months, but ~75 SaaS accounts (14 §4) only in ~17 months (ESTIMATE). Below 5% even the service model takes years |
| Usage | Paid stores sending ≥2 lists in 4 weeks | ≥60% | 40–59% → per-list pricing | <40% | A monthly fee needs a recurring event |
| Output adoption | Delivered files actually imported/used | ≥70% | 40–69% → fix formats | <40% | If outputs aren't used, no value was delivered |
| Retention | Renewal at list price in week 5 | ≥60% | 30–59% | <30% | Economics (14) assume ~4% monthly churn; <60% after one month invalidates them |
| Service economics | Founder minutes per list | ≤20 min | 20–40 min → raise price or narrow | >40 min | At ARS 5k/list, 20 min ≈ ARS 15k/h, above the founder's ARS 10k/h opportunity cost (ASSUMPTION) |

**Decision:** GO = all first five at GO and retention ≥ PIVOT. **PIVOT** = pain and payment at PIVOT or better but model/segment/price wrong (e.g., they pay for service, not software → become a service; they don't hold codes → lists-as-catalog). **NO-GO** = file-sent <20% **or** ≤1 paid of 20 qualified **or** renewal <30%.

## 16. Evidence Against (priority)

1. Multilistas already delivers the core pitch in the same vertical and country (K5).
2. AI substitutes shipped in 2026, including in Argentina's main e-commerce platform (K12–K15).
3. Adjacent tools are priced at USD 7–50/month (K11, K12); full POS from ≈ ARS 38k final (K10).
4. The only buyer survey we found doesn't rank pricing among top needs (K16, n=47).
5. Matching without supplier codes is manual and risky; onboarding may take days per store (§8).
6. 2026 price dynamics show plateaus and corrections in some sectors (K4), lowering frequency/urgency.
7. Suppliers are digitizing (portals, price tools with client margins) (K18).
8. No scalable acquisition channel identified; paid acquisition uneconomic at current ARPA (§10).
9. Zero first-person evidence from Argentine buyers; zero payments.

## 17. Evidence For

1. Industry-wide recognition of the job (every ERP builds imports; Multilistas built a company around it) — money exists (K5–K10).
2. User voices outside Argentina describe the pain in concrete terms (Microsoft Q&A, Shopify Community).
3. syncX's 921 reviews show sustained paid demand for automating supplier price updates, albeit at low prices (K11).
4. Prices in hardware still move in both directions (K3), so re-pricing is recurring.
5. Remarcá's combination (PDF + AR math + alerts + neutral output + undo) is not offered by one product we found, and the founder already sells services to SMBs (fits a service model).
6. Technically sound: safe code matching (0 wrong on coded items; collision bug fixed), verified performance.

## 18. Remaining Risks (see 17-risk-register for the full list; new: R19–R26)
Direct competitor coverage (R19) · AI substitution now concrete (R20, raised) · price anchors (R21) · matching/onboarding cost (R22) · invisible value → churn (R23) · supplier-side digitization (R24) · lower update frequency (R25) · outreach channel policy/legal (R26).

## 19. Next Experiment
§14 Phase 0 + Phase 1: **30 screening conversations in week 1; concierge-vs-self-serve paid pilots in weeks 2–4; renewal decision in week 5.** Out-of-pocket cost ≈ 0 (transport); founder time ≈ 25–35 h (ESTIMATE). Before starting: deploy is **not** required for the concierge arm (the founder runs Remarcá locally); it is required only for the self-serve arm.

## 20. Recommendation

1. **Freeze development.** No new features until §15 produces a GO or a PIVOT that names a specific blocker.
2. **Run §14 now**, starting with Phase 0 — it can kill the idea in one week at near-zero cost (if <15% qualify or <20% send a file).
3. **Lead with the service offer**; keep self-serve as the comparison arm. The evidence (K5, K11–K15) says the software alone is being commoditized; the work and the trust are not.
4. **If NO-GO:** do not return to other SaaS ideas by default. Among the discarded options, the one whose signal did *not* weaken with AI commoditization is the pattern "AI-enabled back-office service for SMB retailers, sold through the founder's existing agency relationships" (price updates, catalog upkeep, Tiendanube/Mercado Libre listing maintenance). Other candidates keep their blockers: #10 transfer verification (no bank data access), #12 distributors' "lista viva" (distributors already build portals, K18), #13 installer quotes (fragmented buyer).
5. **If GO (service):** build only what reduces founder minutes per list (suggested links, per-item unit conversion), in that order, measured by the minutes log.

### If the hypothesis survives, precisely:
1. **Problem:** turning messy supplier lists into correct costs/prices in the store's system, repeatedly.
2. **Who has it:** retailers/distributors with ≥6 suppliers sending Excel/PDF lists and a system that imports a file.
3. **Who pays:** the owner.
4. **Why:** to recover staff hours and avoid selling below replacement cost.
5. **Alternative today:** Excel/VLOOKUP, blanket % increases, POS import with a hand-made file, or an employee.
6. **Why switch:** only if it is done *for* them (service) or is clearly faster than their Excel routine for non-technical staff.
7. **What's different:** outcome delivered in 24 h via WhatsApp, PDF included, AR math, below-cost alerts, output for their current POS, with undo.
8. **Unproven:** A1, A3, A4, willingness to pay (any price), service vs self-serve preference, real matching accuracy, retention.
9. **Next experiment:** §14.
10. **Do NOT build yet:** description matching, unit conversion, Mercado Pago billing, integrations, "lista viva", OCR, mobile, more SaaS plumbing.
