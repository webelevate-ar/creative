# 21 — Business Model Simulation

Date: 2026-09-25. Question: can Remarcá create enough economic value to justify one of these?

1. An assisted service run by us.
2. A SaaS.
3. A combination of both.

How to read this document:

- Everything here is **built on the real-list benchmark** (docs/20), whose results are not changed.
- **No customer, interview or payment exists.**
- Labels:
  - **FACT:** sourced, or read in the code.
  - **OBSERVED:** measured in docs/20.
  - **ASSUMPTION:** chosen by us, unverified.
  - **ESTIMATE:** derived from other inputs.
  - **UNKNOWN.**
- The three stores are a **SYNTHETIC BUSINESS MODEL** for sensitivity analysis. They are not customers and not market
  averages.
- **Every human time is an ASSUMPTION range.** Nobody was timed.
- Prices are **mathematical scenarios, not validated prices**. Client counts are **not sales forecasts**.

Simulator: [`scripts/research/business-sim.ts`](../scripts/research/business-sim.ts). Full output:
[`scripts/research/business-sim-output.md`](../scripts/research/business-sim-output.md). Tables below come from that
output, rounded.

---

## 1. Executive Summary

**¿Qué puede hacer Remarcá hoy?** (OBSERVED, docs/20)

- Leer planillas reales de proveedores: 7/7 correctas.
- Emparejar la lista siguiente del mismo proveedor por código: 10.229/10.229, 0 errores.
- Detectar nuevos y faltantes.
- Calcular costo y precio con reglas por proveedor, marcar lo dudoso y exportar.
- Procesar 32.892 filas en 2,3–2,7 s.

**¿Qué NO puede hacer?** (OBSERVED)

- Leer la mayoría de los PDFs reales: 1/6 listas correctas.
- Convertir moneda o IVA por fila: retiene las filas en dólares; el IVA 10,5% queda mal en silencio.
- Emparejar por descripción: no es confiable y no lo intenta.
- Emparejar tras un cambio de proveedor sin código compartido: 0 coincidencias automáticas.
- Leer ZIP.
- Mostrar el cambio de descripción de un mismo código.
- Atender varios clientes con un solo usuario: 1 organización por usuario (FACT, código).

**¿Cuánto trabajo humano queda?** Escenario medio, tiempos humanos medios (ASSUMPTION), horas-persona por mes:

| | Tienda A | Tienda B | Tienda C |
|---|---:|---:|---:|
| **Con Remarcá**, entradas como se definieron | 2,9 h | 12,9 h | 98 h |
| Sin Remarcá: Excel competente, mismas entradas | 4,8 h | 22,6 h | 173 h |
| **Con Remarcá**, entradas limpias (solo planillas con código) | 1,3 h | 3,0 h | 15,6 h |
| Sin Remarcá: Excel competente, entradas limpias | 3,2 h | 6,5 h | 27 h |
| Sin Remarcá: carga manual en el sistema | 9,2 h | 26,7 h | 174 h |
| **Puesta en marcha única** (vincular productos sin código) | ≈3 h | ≈20 h | ≈93 h |

- En B y C, **84–90% de las horas que quedan** vienen de entradas que Remarcá no soporta: PDFs ilegibles o
  parciales, y listas sin código. En A, el 65% son listas sin código.
- El procesamiento de máquina es irrelevante: 3 segundos por mes para C.

**¿Qué valor económico podría generar?** Solo se puede estimar el valor del **tiempo** (ESTIMATE; ARS 11.875/h de un
administrativo). El valor de **margen protegido** es UNKNOWN (no hay datos) y no se cuantifica.

- **Contra un usuario competente de Excel** (tiempos medios):
  - SaaS: A ≈ ARS 23 k/mes, B ≈ 42 k (entradas limpias), C ≈ 140 k (limpias).
  - Servicio (el cliente delega todo salvo importar): A ≈ 34 k, B ≈ 69 k, C ≈ 293 k (limpias).
- **Contra carga manual:** A ≈ 105 k, B ≈ 311 k, C ≈ 2,05 M.
- **El valor económico existe sobre todo cuando la alternativa del comercio es cargar a mano, no Excel.** Si el
  comercio maneja bien Excel, el ahorro de un SaaS en una tienda chica (≈ 23 k) no cubre un precio de 30 k.

**¿Qué modelo testear primero?** El **servicio**, con el software como herramienta interna.

- Es el único modelo que:
  - resuelve la carga de la puesta en marcha;
  - entrega el valor más alto;
  - prueba la incógnita real: ¿pagan por el resultado?
- Solo es rentable **dentro de una zona estrecha**:
  - listas en planilla con códigos;
  - catálogos chicos o medianos;
  - precio ≥ ARS 50–75 k/mes;
  - clientes cuya alternativa es trabajo manual.
- Fuera de esa zona, pierde dinero con cualquier precio probado (≤ 100 k).
- El SaaS no debería ser el primer test (§16). El híbrido es el mismo primer test que el servicio.
- **Nada de esto es validación.**

**¿Qué evidencia falta?**

1. Disposición a pagar, a cualquier precio.
2. Si el comercio objetivo hoy usa Excel o carga a mano: decide si hay valor.
3. Qué proporción de sus listas llega en planilla con código: decide el costo del servicio.
4. Minutos humanos reales por lista y por cliente: todos los tiempos son ASSUMPTION.
5. Retención.

---

## 2. Evidence Base

| Input | Value | Label | Source |
|---|---|---|---|
| Supplier spreadsheets read correctly | 7/7 (6 automatic, 1 needs a column choice) | OBSERVED | docs/20 §5 |
| PDF lists | 1/6 correct, 3/6 partial (every row must be checked), 2/6 fail | OBSERVED (n = 6) | docs/20 §5 |
| Supplier brands in the public sample that publish a spreadsheet | 5 of 8 (Camba, AS, JB, ALMA, Cambre). 3 publish PDF only (Jeluz, Roker, Strada) | OBSERVED (public, possibly biased) | docs/20 §2 |
| Supplier lists with a code column | 13/13 public supplier lists | OBSERVED (public, possibly biased) | docs/20 §3 |
| Same-supplier code matching | 10,229/10,229 right, 0 wrong (95% upper bound ≈ 0.03%) | OBSERVED | docs/20 §7 M2 |
| Code respellings between versions | 2 in 10,231 (held for review) | OBSERVED | docs/20 §7 M2 |
| Cross-supplier matching via manufacturer code, among auto-applied | 1 incorrect + 4 ambiguous of 97 | OBSERVED | docs/20 §7 M4 |
| Description-only matching | naive 1.2% right; guarded 77 right / 463 wrong / 1,901 abstained | OBSERVED | docs/20 §7 M3 |
| Rows in another currency (mixed list) | 37.5% of JB's rows | OBSERVED | docs/20 §6 |
| Rows at 10.5% IVA (per-row IVA lists) | 6–13.6% | OBSERVED | docs/20 §6 |
| New codes, current vs old map | 1.0% (Camba) | OBSERVED (not a month-to-month diff) | docs/20 §10 |
| Throughput | 32,892 rows, 2.3 s first list / 2.7 s next list | OBSERVED | docs/20 §13 |
| Catalog import has no IVA column | per-product IVA is set one by one | FACT (code) | `src/services/products.ts` |
| One organization per user | an operator needs one login per client | FACT (code) | `src/db/migrations/001_init.sql` |
| Admin A salary, fully loaded | ARS 1.9 M/month; CCT 130/75 basic ARS 1.318 M is FACT | ESTIMATE | docs/14 |
| Store staff hour | 1.9 M / 160 h = **ARS 11,875/h** | ESTIMATE | derived |
| Hired operator, productive hour | 1.9 M / 120 h = **ARS 15,833/h** | ESTIMATE | derived (75% productive, ASSUMPTION) |
| Founder hour, opportunity cost | ARS 10,000/h | ASSUMPTION | docs/14 |
| Founder income target | USD 1,600 ≈ ARS 2.46 M/month | ASSUMPTION | docs/14 |
| Payment fees | 3% blended | ESTIMATE | docs/14 |
| Hosting + tools; accountant | ARS 15 k (≤ 100 accounts), 60 k (500); accountant 100 k | ESTIMATE / ASSUMPTION | docs/14 |
| Monotributo K cap | ARS 126.6 M/year (≈ 10.55 M/month) | FACT | docs/14 |
| Price anchors for the adjacent job | syncX USD 7–10; Matrixify USD 20–50; Dux ARS 31.5 k+IVA (full POS); Contabilium 122–245 k+IVA; MarginEdge USD 350 (includes a human service) | FACT | docs/19 K10–K12 |
| USD/ARS | 1,540 | FACT | docs/14 |
| Willingness to pay for Remarcá | **none observed** | UNKNOWN | — |
| Churn, sales cost per client | 3/5/10% monthly; 6.7/13/27 h of founder selling per new client | ASSUMPTION | docs/14 baseline 4%, 6.7 h |

## 3. Synthetic Business Scenarios

**SYNTHETIC BUSINESS MODEL.** The parameters come from the brief and from docs/20 anchors. They are **not market
averages**: no source says what share of Argentine stores look like A, B or C.

| Parameter | A — Pequeño | B — Mediano | C — Grande | Label / anchor |
|---|---|---|---|---|
| SKUs | 1,000 | 3,000 | 10,000 | Brief (ASSUMPTION) |
| Suppliers | 2 | 4 | 8 | Brief |
| Lists per supplier per month | 1 | 1 | 2 | ASSUMPTION ("frequent" = 2) |
| Share of lists in PDF | 0% | 25% | 37.5% | ASSUMPTION. C equals the public sample: 3 of 8 brands are PDF-only (OBSERVED) |
| Mixed-currency lists | 0% | 0% | 12.5% (1 of 8) | ASSUMPTION. 1 of 7 public spreadsheets (OBSERVED) |
| Per-row IVA lists | 0% | 25% | 50% | ASSUMPTION. 4 of 7 public spreadsheets (OBSERVED) |
| Catalog items carrying the supplier's code (optimistic / medium / pessimistic) | 95 / 85 / 60% | 80 / 50 / 20% | 60 / 30 / 10% | ASSUMPTION; real share UNKNOWN (docs/19 A3) |
| Store rows per month | 1,000 | 3,000 | 20,000 | Derived |
| Supplier-list rows processed per month (at the observed median list size of 2,273) | 4,546 | 9,092 | 36,368 | ESTIMATE |

The **"clean inputs" variant** is used throughout: every list is a spreadsheet with codes, in one currency. It
isolates what the benchmark shows Remarcá does well from what it cannot do.

## 4. Workflow Without Remarcá

**Baseline 1 — competent Excel user.** Uses VLOOKUP and keeps a code map, built once, the same effort as Remarcá's
links. Minutes per list (ASSUMPTION low / mid / high):

| Task | Low | Mid | High |
|---|---:|---:|---:|
| Descargar la lista | 1 | 3 | 10 |
| Abrir el archivo | 1 | 2 | 5 |
| Identificar columnas | 2 | 5 | 15 |
| Comparar precios (BUSCARV) | 5 | 15 | 40 |
| Detectar productos nuevos | 3 | 10 | 30 |
| Detectar productos eliminados | 3 | 10 | 30 |
| Aplicar IVA | 2 | 5 | 15 |
| Aplicar bonificaciones | 2 | 5 | 15 |
| Calcular margen | 3 | 10 | 25 |
| Revisar errores | 5 | 15 | 40 |
| Exportar | 1 | 5 | 10 |
| Importar al sistema | 2 | 5 | 15 |
| **Total per list** | **30** | **90** | **250** |

Notes on this baseline:

- The only outside anchor is one practitioner's "medio día" per list (docs/02 E1, weak evidence). It is close to the
  high end.
- Plus, per row (ASSUMPTION): 30/60/120 s to type a price from a PDF or from a list without codes, and 30/60/120 s to
  decide on each new product.
- Excel handles **per-row IVA and currency with one formula**, which Remarcá cannot (docs/20 §11).

**Baseline 2 — no spreadsheet skills.** Every price is updated by hand in the POS: 15/30/60 s per row, plus
10/20/40 min per list (ASSUMPTION).

## 5. Workflow With Remarcá

| | What | Evidence |
|---|---|---|
| **Automatic** | Read spreadsheets; detect columns (6/7); match coded rows exactly; detect new and missing; supplier-level IVA, discounts, USD and margin; flags; export | OBSERVED (docs/20) |
| **Human review** | Per list: receive, upload, check columns, read the summary, export (5/15/30 min). Held rows: flags, respellings, repeated codes (10/20/40 s each). New products (30/60/120 s). Rows of partially read PDFs (3/6 of PDFs): check each row | Capability OBSERVED; times ASSUMPTION |
| **Not supported** (should not be automatic today) | Unreadable PDFs (2/6): type every row. Lists without codes: type or link every time. Other-currency rows: split the file (10/20/40 min per list). Per-row IVA: set each 10.5% product once. ZIP: unzip first | OBSERVED limits (docs/20 §6, §14) |
| **One-time onboarding** | Setup 30/60/120 min. Link each uncoded catalog item 20/45/60 s (docs/19 ESTIMATE 30–60 s). Set IVA on 10.5% items 15/30/60 s | ASSUMPTION |

**Rows per month by route** (medium matching case):

| Store | Automatic | Review | Manual | Unsupported (split) | New products | Onboarding (once) |
|---|---:|---:|---:|---:|---:|---:|
| A | 85.5% | 4.5% | 10% | 0% | 10 | 2.9 h |
| B | 67.7% | 16.1% | 16.2% | 0% | 24 | 20.4 h |
| C | 56.0% | 21.7% | 19.4% | 2.9% | 138 | 92.7 h |

**Where the remaining human hours go** (operator view, medium case, mid times):

| Component | A | B | C |
|---|---:|---:|---:|
| Per-list mechanics | 0.5 h (19%) | 1.0 h (8%) | 4.0 h (4%) |
| Review of held rows | 0.3 h (10%) | 0.6 h (5%) | 3.3 h (3%) |
| Checking partially read PDFs | — | 2.1 h (17%) | 20.8 h (22%) |
| Typing unreadable PDFs | — | 4.2 h (34%) | 41.7 h (44%) |
| Typing lists without codes | 1.7 h (65%) | 4.0 h (32%) | 22.9 h (24%) |
| New products | 0.2 h (6%) | 0.4 h (3%) | 2.3 h (2%) |
| Mixed-currency split | — | — | 0.7 h (1%) |

**Reading:** what Remarcá automates is already cheap. What remains expensive is exactly what the benchmark shows it
cannot do: PDFs and lists without codes. In A, "lists without codes" is 65% of the remainder, and it rests on an
ASSUMPTION (10% of lists) that the public sample contradicts (0 of 13).

**Human hours per month on the store side** (medium matching; low / mid / high times):

| Store | Manual in POS | Excel | With Remarcá (incl. POS import) | Saved vs Excel | Saved vs manual |
|---|---|---|---|---|---|
| A | 4.6 / 9.2 / 18.3 | 1.9 / 4.8 / 12.0 | 1.4 / 2.9 / 5.8 | 0.5 / 1.9 / 6.2 | 3.2 / 6.2 / 12.5 |
| B | 13.4 / 26.7 / 53.5 | 10.3 / 22.6 / 50.0 | 6.3 / 12.9 / 25.7 | 4.1 / 9.8 / 24.2 | 7.1 / 13.9 / 27.7 |
| C | 87 / 174 / 349 | 82 / 173 / 364 | 49 / 98 / 197 | 34 / 75 / 168 | 39 / 76 / 152 |

## 6. SaaS Model

The store uses Remarcá itself. It keeps its own review hours (§5) and does its own onboarding.

**Our cost per account** (support at the founder's cost; setup amortized at 5% churn):

| Price (scenario) | Support 15 min | Support 45 min | Support 90 min |
|---|---:|---:|---:|
| ARS 15 k | +12 k | +7 k | −1 k |
| ARS 30 k | +26 k | +21 k | +14 k |
| ARS 50 k | +46 k | +41 k | +33 k |

**Break-even:**

- **Cash** (hosting + accountant): 3–8 accounts.
- **Founder income target:** the table shows the accounts needed. It includes selling, onboarding and hires
  (ASSUMPTION).

| Price | Churn 3% | Churn 5% | Churn 10% |
|---|---|---|---|
| ARS 30 k (6.7 / 13 / 27 h of selling per client) | 89 / 89 / 225 | 89 / 159 / >2,000 | 225 / >2,000 / >2,000 |
| ARS 50 k | 54 / 54 / 54 | 54 / 54 / 54 | 54 / 54 / >2,000 |
| ARS 15 k (45 min support) | never within 1,000 (central case) | | |

**MRR and cash at scale** (central case: 45 min support, 5% churn, 13 h of selling per client). Cash is after hired
staff, before paying the founder.

| Price | 10 accounts | 50 | 100 | 500 |
|---|---|---|---|---|
| 30 k | MRR 300 k · cash 176 k | 1.5 M · 1.34 M | 3 M · 0.9 M (1 hire) | 15 M · 2.9 M (6 hires; above the monotributo cap) |
| 50 k | 500 k · 370 k | 2.5 M · 2.31 M | 5 M · 2.84 M (1 hire) | 25 M · 12.6 M (6 hires; above the cap) |

What these numbers leave out:

- **Whether the store gets its money's worth:**
  - Against its own Excel routine, a SaaS saves A about **ARS 23 k/month** of staff time, which is below a 30 k
    price.
  - It saves B about 42 k and C about 140 k (clean inputs).
  - And only if staff time is really paid, and freed for other work (ASSUMPTION).
- **Onboarding is on the store:** 3 h (A), 20 h (B) and 93 h (C) of linking before the second list pays off
  (medium case). docs/19 R22 predicted this; a self-serve store is unlikely to do it (ASSUMPTION).
- **Anchors** (FACT): adjacent SaaS costs USD 7–50 (≈ ARS 11–77 k); a full POS costs from ≈ ARS 38 k final.

## 7. Service Model

Flow: "Proveedor → lista → (cliente la reenvía) → Remarcá → revisión humana → archivo → cliente importa".

Our hours per client-month are the operator's hours from §5 plus 15/30/60 min of messaging (ASSUMPTION) plus
onboarding amortized over the expected lifetime.

**The rule that decides profitability:** the price must pay for the human hours.

| Price (scenario) | Max h/client-month at founder cost | at hired cost | Clients per full-time operator at that limit |
|---|---:|---:|---:|
| ARS 15 k | 1.5 | 0.9 | 131 |
| ARS 30 k | 2.9 | 1.8 | 65 |
| ARS 50 k | 4.9 | 3.1 | 39 |
| ARS 75 k | 7.3 | 4.6 | 26 |
| ARS 100 k | 9.7 | 6.1 | 20 |

**Hours each store actually needs** (optimistic / medium / pessimistic: matching case with low / mid / high times):

| Store | Inputs as defined: h/client-month | Break-even price, founder / hired (medium) | Clean inputs: h/client-month | Break-even, clean, medium |
|---|---|---|---|---|
| A | 0.6 / **3.2** / 14.6 | 33 k / 53 k | 0.6 / **1.6** / 5.1 | 16 k / 26 k |
| B | 4.1 / **13.7** / 46.6 | 141 k / 224 k | 1.1 / **3.9** / 13.2 | 40 k / 63 k |
| C | 36 / **101** / 310 | 1.04 M / 1.65 M | 4.8 / **18** / 70 | 186 k / 295 k |

**Capacity of one full-time operator** (120 productive h, medium case):

- Clean inputs: A 76 clients, B 31, C 7.
- As defined: A 37, B 9, C 1.

**When the service stops being profitable:** as soon as a client needs more hours than the table above allows.

- At ARS 50 k with a hired operator, that is about **3 hours per client-month**.
- In the medium case that holds for A, and for B only with clean inputs.
- B with a PDF supplier and C are **unprofitable at every tested price (≤ 100 k)**.

**At scale** (central case; cash after hires, before the founder):

| Inputs, store, price | 10 | 50 | 100 | 500 | Clients for the founder target |
|---|---|---|---|---|---|
| Clean, A, 50 k | 370 k | 2.31 M | 2.84 M (1 hire) | 6.9 M (9 hires, above the cap) | 93 |
| Clean, A, 75 k | 613 k | 3.52 M | 5.26 M | 19.0 M (above the cap) | 36 |
| Clean, B, 75 k | 613 k | 1.62 M | 1.46 M | 1.9 M | 639 (thin margin per hire) |
| Clean, B, 100 k | 855 k | 2.84 M | 3.89 M | 14.0 M | 47 |
| As defined, B, 100 k | −1.05 M | −4.8 M | −11.3 M | −64 M | never |
| As defined, C, any price ≤ 100 k | negative | negative | negative | negative | never |

## 8. Hybrid Model

Operator hours per client-month (medium case):

| Store / inputs | Stage 1: service | Stage 2: client uploads and exports, we handle exceptions | Stage 3: self-serve (support) | Moves to the client in stage 2 | Stays human until features that do not exist are built |
|---|---:|---:|---:|---:|---:|
| A clean | 1.4 | 0.7 | 0.75 | 0.7 h | 0 |
| B clean | 2.8 | 1.6 | 0.75 | 1.3 h | 0 |
| C clean | 13.4 | 9.2 | 0.75 | 4.3 h | 0 |
| B as defined | 12.7 | 11.5 | 0.75 | 1.3 h | **10.2 h** |
| C as defined | 96 | 92 | 0.75 | 4.3 h | **86 h** |

What can be automated, and when:

- **Now** (by moving work to the client): per-list mechanics, 0.7–4.3 h per client-month. It is small because
  Remarcá already automates it.
- **Only with features that do not exist** (NOT YET):
  - reading real PDF layouts;
  - per-row currency and IVA;
  - link suggestions for uncoded items;
  - a description diff.

  These are where the hours are for B and C.
- **Consequence:** the hybrid's stage 1 **is** the service. Stage 2 saves little. Stage 3 moves the burden to the
  client, and with it every unsupported input. The path from service to software depends on building those
  features, which docs/19 forbids before a GO.

## 9. Matching Sensitivity

Starting point (OBSERVED): same-supplier code matches 10,229/10,229, and cross-supplier 1 + 4 of 97 auto-applied rows
not correct. No "future precision" is assumed.

What changes between the three cases (ASSUMPTION):

- the share of catalog items with the supplier's code;
- the share of lists without codes: 0 / 10 / 30%, against 0 of 13 observed publicly;
- the share of rows held for review: 2 / 5 / 15%;
- new products: 0.5 / 1 / 3% per list.

| Store | Monthly h with Remarcá: optimistic / medium / pessimistic | Onboarding h (once) | Saved vs Excel h/month |
|---|---|---|---|
| A | 1.0 / 2.9 / 6.9 | 1.6 / 2.9 / 6.0 | 2.1 / 1.9 / 1.6 |
| B | 8.4 / 12.9 / 22.4 | 9.1 / 20.4 / 31.6 | 10.3 / 9.8 / 8.6 |
| C | 72 / 98 / 153 | 55 / 93 / 118 | 78 / 75 / 66 |

Reading:

- **Matching quality itself is not the weak link:** coded matches are exact and safe.
- **What costs is what has no code, or no readable file.** That is an input-quality question, and its answer is
  **UNKNOWN** for real stores.
- **Expected wrong auto-applied prices:** the observed rate is 0/10,229. At its 95% upper bound (0.03%) that is at
  most ≈ 0.3 per month for A, 0.6 for B and 3.4 for C (≈ 11,000 automatic rows). Cross-supplier matching is different: about 5% of auto-applied rows need checking, but
  it only happens on a supplier change.

## 10. Unit Economics

Medium matching, mid times, clean-inputs figures in parentheses:

| | A | B | C |
|---|---|---|---|
| SKUs / suppliers / lists per month | 1,000 / 2 / 2 | 3,000 / 4 / 4 | 10,000 / 8 / 16 |
| Store rows per month | 1,000 | 3,000 | 20,000 |
| Automatic / review / manual / unsupported rows | 855 / 45 / 100 / 0 | 2,031 / 483 / 486 / 0 | 11,200 / 4,340 / 3,880 / 580 |
| Human h per month with Remarcá (store side, incl. POS import) | 2.9 (1.3) | 12.9 (3.0) | 98 (15.6) |
| Human h per month, competent Excel | 4.8 (3.2) | 22.6 (6.5) | 173 (27) |
| Service: our cost per client at hired cost | ARS 51 k (25 k) | 217 k (62 k) | 1.6 M (285 k) |
| Service: price scenario that covers it | 75–100 k (30–50 k) | none ≤ 100 k (75–100 k) | none ≤ 100 k (none) |
| Service: clients per operator | 37 (76) | 9 (31) | 1 (7) |
| SaaS: our cost per account | ≈ ARS 9 k (45 min support) | same | same |
| SaaS: time value to the store vs Excel | 23 k (22 k) | 116 k (42 k) | 884 k (140 k) |
| Service: time value to the store vs Excel / vs manual | 53 k / 105 k (34 k / 105 k) | 261 k / 309 k (69 k / 311 k) | 2.0 M / 2.0 M (293 k / 2.05 M) |
| Clients for the founder target | service at 75 k: 36 (clean). SaaS at 50 k: 54 | service at 100 k, clean: 47 | service: never at ≤ 100 k |

**The number that matters most:** for clean inputs, the service's time value against a competent Excel user is barely
above our cost:

| Store | Value to the store | Our cost (hired) |
|---|---:|---:|
| A | 34 k | 26 k |
| B | 69 k | 63 k |
| C | 293 k | 295 k |

Against manual POS updating, the room is wide: A 105 k, B 311 k. **The service has economic room only when the
client's alternative is manual work** (ESTIMATE on ASSUMPTION times).

## 11. Capacity Analysis

- **One founder** (120 productive h/month, also selling):
  - Clean A-type: ≈ 76 clients at most, fewer after selling time.
  - Clean B-type: ≈ 31.
  - As-defined B-type: 9.
- **Revenue ceiling per full-time operator** (medium, clean):

  | | At 50 k | At 75 k |
  |---|---:|---:|
  | A | 76 × 50 k × 0.97 ≈ 3.7 M/month | — |
  | B | 1.5 M | 2.3 M |

  A hired operator costs 1.9 M/month (ESTIMATE). **B-type service is only positive per hire at ≥ 75 k.**
- **SaaS:** our capacity is not the limit (45 min per account). The limits are selling hours and the client's own
  hours.
- **Processing:** 3 CPU-seconds per month for C. Infrastructure is not a constraint at 500 clients (docs/14: ≈ ARS
  60 k/month).

## 12. Bottleneck Analysis

Share of human hours at 100 clients (store B, central case):

| Model | Recurring work | Onboarding | Selling | Machine |
|---|---|---|---|---|
| Service, B as defined | 88% | 7% | 4.5% | ≈ 0 |
| Service, B clean | 63% | 23% | 14% | ≈ 0 |
| SaaS | 52% (support) | 3% | 45% | ≈ 0 |

| Candidate | Verdict | Why |
|---|---|---|
| Processing / infrastructure | **Not a bottleneck** | Seconds per month; ARS 15–60 k of hosting (OBSERVED, ESTIMATE) |
| Matching | **Not on coded inputs** (10,229/10,229); **yes on uncoded catalogs** (onboarding 20–93 h) | OBSERVED + ASSUMPTION |
| Human review | **Service bottleneck**, driven by input quality: PDFs and lists without codes are 84–90% of remaining hours in B/C (65% in A) | §5 |
| Support | Minor for SaaS at 15–45 min per account; 90 min makes a 15 k price unprofitable | §6 |
| Price | **Binding for the service:** it must be ≥ hours × ≈ 16 k/h. Anchors (USD 7–50 SaaS) push the other way | §7, FACT anchors |
| Acquisition / distribution | **Binding for SaaS:** 45% of our hours are selling. At 10% churn and 13 h per sale, 30 k never pays the founder. No scalable channel found (docs/19 §10) | §6 |
| Retention | Unknown, and it multiplies acquisition cost; value is invisible (docs/19 R23) | UNKNOWN |
| **Willingness to pay** | **The real limit.** It decides every row above, and no observation exists | UNKNOWN |

**Conclusion:**

- The first-order bottleneck is **not technical**. It is willingness to pay, and then, per model:
  - **service:** human hours per client, driven by input quality;
  - **SaaS:** acquisition, plus onboarding on the client.
- Only one of these depends on the product: input quality, meaning PDFs and codes. It is exactly the part the
  benchmark shows is weak.

## 13. Willingness-to-Pay Unknowns

| Unknown | Why it decides | Current state |
|---|---|---|
| Any payment at any price | Every model | UNKNOWN (0 observations) |
| Excel-competent vs manual stores | Value to the store differs 3–5× (§10) | UNKNOWN |
| Share of a store's lists that are clean spreadsheets with codes | Service cost differs 3–6× (§7) | UNKNOWN for stores; 5 of 8 public brands publish spreadsheets (OBSERVED, biased) |
| Whether saved staff time is cash | If hours are not cut or reused, the value is only convenience | UNKNOWN |
| Margin protected by timely updates | Could dominate the time value; unmeasured | UNKNOWN |
| Price the store compares against | POS (≈ ARS 38 k), Multilistas (unpublished), an employee (≈ 1.9 M) | FACT anchors; buyer's reference UNKNOWN |
| Retention and lists per month | Monthly fee vs per-list fee | UNKNOWN (docs/19 §11) |
| Trust to send price lists and receive files from an outsider | Service premise | UNKNOWN |

## 14. Competitive Substitutes

For each model: the claim, then the attempt to destroy it.

**SaaS.** *"El cliente pagaría porque Remarcá le ahorra horas en cada lista y le avisa qué vende bajo costo."*

| Alternative | Does it destroy the claim? |
|---|---|
| Excel | **Mostly, for competent users.** Saves ≈ 23 k/month for A, below a 30 k price. Excel also handles per-row IVA and currency, which Remarcá does not |
| ERP/POS import | **Partly.** Their POS imports a clean file (Líder, Tango, AdmGlobal: FACT); the missing step (preparing it) is what Remarcá does. Multilistas does the whole flow inside a POS (FACT) |
| ChatGPT/Claude/Copilot | **Partly to strongly.** Documented as able to map supplier files and apply markups (Matrixify + Claude, Tiendanube MCP, Excel Agent: FACT). Accuracy on these lists is UNKNOWN |
| Hire an employee | No: 1.9 M/month vs 30–50 k |
| Ask the supplier for a prepared file | **Partly.** Many already publish spreadsheets with codes (5 of 8 public brands); some run portals with client margins (docs/19 K18) |
| Not updating / blanket % | Free; the loss is invisible (UNKNOWN size) |

**Verdict: weak.** It survives only for stores that are not comfortable with Excel/AI **and** do their own
onboarding. That combination is unlikely (ASSUMPTION).

**Service.** *"El cliente pagaría porque le devolvemos el archivo listo para importar sin que dedique tiempo ni
aprenda nada."*

| Alternative | Does it destroy the claim? |
|---|---|
| Excel | Only if the owner or staff already does it quickly. For manual stores the value is ≈ 105–311 k/month (A–B, ESTIMATE) against a 50–100 k price |
| ERP/POS import | No, the service feeds it |
| AI assistant | Partly: a motivated owner can do it with AI; a busy one delegates. This is the service's opening |
| Hire an employee | No: a fraction of 1.9 M, with no hiring |
| Supplier's prepared file | Partly: it reduces our cost (clean inputs) more than it removes the need |
| Blanket % | Same as SaaS |

**Verdict: survives on paper** for stores whose alternative is manual work. It is weak where the store is
Excel-competent: the value of 34–69 k is barely above our cost.

**Hybrid.** Same claim as the service at first. Later, "cuesta menos que el servicio". Destroyed by the same
alternatives as SaaS once the client does the work. **Verdict: only as strong as the service in stage 1.**

## 15. Minimum Commercial Product

To sell the service. No features are added. Tags: NECESSARY / USEFUL / NOT YET.

| Item | Status today | Tag |
|---|---|---|
| Receive the file (WhatsApp/email) | Outside the product, manual | NECESSARY (exists as a process) |
| Process it (read, detect, compute) | Exists | NECESSARY |
| Review (flags, holds) | Exists | NECESSARY |
| Detect changes, new and missing | Exists | NECESSARY |
| Generate the output for the POS, labels | Exists (CSV/XLSX export) | NECESSARY |
| Deliver the result | Outside the product, manual | NECESSARY (process) |
| One isolated account per client | Exists (one organization per client) | NECESSARY |
| A minutes log per list and per client | A spreadsheet | NECESSARY: it replaces this document's ASSUMPTION times |
| Backup of client data | Manual copy of the SQLite file | NECESSARY (docs/17 R7) |
| Written service terms and privacy note | Not written | NECESSARY (not code) |
| Charging (transfer / Mercado Pago link) | Outside the product | NECESSARY (process) |
| Operator console across clients (today: one login per client) | Missing | USEFUL beyond ~10 clients |
| Link suggestions for uncoded items | Missing | USEFUL (cuts onboarding; build only after GO) |
| Per-row currency / IVA | Missing (guarded) | USEFUL for electrical stores; NOT YET |
| Real PDF layouts | Missing | USEFUL; NOT YET (biggest lever on service hours) |
| ZIP upload, clearer ZIP message | Missing | USEFUL |
| Description diff for the same code | Missing | USEFUL |
| Self-serve billing, plans, team invites, landing investment, integrations, OCR, description matching, mobile | Partly exists (dormant) | NOT YET |

## 16. Final Decision Framework

No arbitrary score. The evidence, per option:

- **Option 1 — SaaS merits commercial validation. Not as the first test.**
  - For us, the economics close at 54–159 accounts: 30–50 k, 3–5% churn, ≤ 13 h of selling per client.
  - But:
    - the store's time value against its own Excel routine is below a 30 k price for small stores;
    - onboarding falls on the store (3–93 h);
    - substitutes are strong (§14);
    - no scalable channel exists (docs/19 §10).
  - Keep it as the cheap comparison arm of the service test. It costs nothing, since the software exists.
- **Option 2 — Service merits commercial validation, in a narrow zone.**
  - The zone:
    - lists that are spreadsheets with codes;
    - ≤ ~3,000 SKUs;
    - ≤ ~4–6 suppliers;
    - a price of ≥ ARS 50–75 k/month;
    - stores whose alternative is manual work.
  - Outside it (PDF-heavy suppliers, large catalogs, Excel-competent owners) it loses money or offers little value.
  - Even inside it, one founder serves ≈ 30–76 clients. That is a small business, not a scalable one (ESTIMATE).
- **Option 3 — Service + software merits validation only as Option 2 plus a measured path.**
  - Its stage 1 is the service.
  - Stage 2 saves 0.7–4.3 h per client-month, a small gain.
  - The hours that matter need NOT YET features.
  - **Options 2 and 3 are the same first experiment.** They diverge later, on whether paying clients would take over
    the mechanics at a lower price. That is UNKNOWN, and it is measurable in the same pilot by offering a
    self-serve price at renewal.
- **Option 4 — The hypothesis does not justify more investment. Not yet shown.**
  - The remaining test costs almost nothing in money.
  - It becomes the answer if the pre-registered thresholds below fail.
  - Otherwise, pure SaaS is already the weakest option.

**Decision: validate the service** (Option 2, which is also stage 1 of Option 3) in the narrow zone, with the SaaS
price as a comparison arm. **Do not build.** What would decide between 2 and 3 is §17's store experiment:

- whether clients pay for the outcome;
- the real minutes per client;
- whether any client takes the self-serve price at renewal.

## 17. Cheapest Next Experiment

### 17a. Without contacting stores (public data, simulation, product analysis)

Goal: move specific inputs from ASSUMPTION or UNKNOWN to **EVIDENCE**, at about 1 day of desk work and ARS 0.

1. **Revealed payment for the job** (the closest public proxy for willingness to pay).
   - **Collect:** 30 days of Argentine job postings on public job boards that list "actualizar listas de precios de
     proveedores" (or similar) among the duties, with salary where shown. Also collect public service offers and
     prices for list updating: freelance marketplaces, POS/ERP resellers offering it as a paid add-on.
   - **Decision rule, fixed now:**
     - ≥ 10 postings in 30 days **and** ≥ 3 priced service offers → **EVIDENCE that stores already pay for this
       job**, with a price anchor for the service.
     - ≈ 0 of both → **negative evidence**; it weighs toward Option 4.
   - **Limit:** evidence of payment for the *job*, not for Remarcá.
2. **Input-quality census.**
   - **Collect:** 30 more Argentine supplier websites (ferretería, electricidad, bulonería, sanitarios). For each:
     spreadsheet vs PDF-only, code column, mixed currency, per-row IVA.
   - **Output:** turns §3's format assumptions into OBSERVED shares (public side). They decide service cost (§7).
   - **Rule:**
     - < 50% of suppliers publish a spreadsheet with codes → the service's profitable zone is too small; weighs
       toward Option 4.
     - ≥ 70% → the clean zone is common.
3. **Stakes measurement** (from 2026-10-24).
   - **Collect:** the six docs/20 sources again. Measure, per list, the share of items whose price changed and the
     **dispersion** of the changes.
   - **Rule:**
     - Within-supplier dispersion is small (interquartile range < 2 percentage points) → a blanket % update is almost
       as good; the value is only time; weighs against.
     - Large dispersion → per-item updating protects margin; that supports the value claim, still without
       measuring willingness to pay.

These cannot prove willingness to pay. Together, they can **kill** the idea: no paid demand for the job, or no
clean inputs. They can also narrow the store test.

### 17b. When stores can be contacted

docs/19 §14 (Phase 0 screening, Phase 1 paid pilot), with the simulation's changes:

- **Screening adds two questions:**
  - "¿Cómo actualizás hoy: Excel, a mano en el sistema, o subís todo un %?"
  - "¿Cuántas de tus listas llegan en Excel con código?"
- **Qualify only the profitable zone:** spreadsheets with codes, ≤ ~3,000 SKUs, a manual or blanket-% method today.
- **Offer arms** (paid upfront, 4 weeks):
  - service at ARS 50 k;
  - service at ARS 75 k;
  - self-serve at ARS 30 k.

  These are test prices, not validated ones.
- **Measure:**
  - the operator's minutes per list and per client (this replaces every ASSUMPTION time in §4–§7);
  - lists per month;
  - files imported;
  - renewal;
  - whether any service client takes the self-serve price at renewal (Option 2 vs 3).
- **Thresholds:**
  - docs/19 §15, plus **measured human time per client ≤ price ÷ ARS 16 k/h** (≈ 3.1 h at 50 k with a hired
    operator, 4.9 h at founder cost).
  - Otherwise the service is unprofitable at that price.

## 18. What We Still Don't Know

- **Willingness to pay** for any model, at any price: the decisive unknown.
- **Real human minutes** per list, per review row, per link and per client. All ASSUMPTION here. This document's
  numbers move 2–4× across the low/high ranges.
- **Whether target stores update with Excel, by hand, or not at all.** Value differs 3–5×.
- **The share of a store's lists** that are spreadsheets with codes, in one currency.
- **How many catalogs carry supplier codes** (docs/19 A3): it drives onboarding (3–93 h).
- **Margin lost by late or blanket updates.** It could dominate the time value; no data.
- **Churn, lists per month, and whether saved time becomes cash.**
- **Representativeness:** the three synthetic stores and the public lists may not resemble real buyers.
- **How competitors perform on the same files** (docs/20 §12).
