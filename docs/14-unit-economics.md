# 14 — Unit Economics

Currency: ARS unless noted. USD at 1,540 ARS (BNA, 24-Sep-2026, FACT). EUR ≈ 1,700 ARS (ASSUMPTION).
Labels: **F** = FACT (sourced), **A** = ASSUMPTION, **E** = ESTIMATE (derived), **U** = UNKNOWN.

## 1. Inputs

| Input | Value | Label | Source / reasoning |
|---|---|---|---|
| Plan prices | Básico 23,000 · Comercio 45,000 · Distribuidora 90,000 / month | Decision | 08-pricing |
| Plan mix | 40% Básico · 50% Comercio · 10% Distribuidora | A | To be replaced by pilot data |
| **ARPA** (avg revenue per account) | **40,700/mo ≈ USD 26** | E | from mix |
| Monthly logo churn | 4% | A | Typical for SMB tools; U for this product |
| Hosting | Hetzner CX23 €5.49/mo (2 vCPU, 4 GB) ≈ 9,300/mo | F ([source](https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/)) | Stock availability flagged as intermittent in Sep-2026 → have a second provider ready (≈ USD 6/mo) |
| Backups (object storage), domain, email | ≈ 6,000/mo combined up to ~100 accounts | E | Pennies of storage; domain ≈ USD 15/yr; transactional email free tier (A) |
| Payment fees | Mercado Pago link ≈ 4.99% + IVA ≈ 6%; bank transfer 0% → blended **3%** | F ([source](https://www.comparapasarelas.com/mercado-pago-comisiones)) / A (50% by transfer) | |
| Founder's tax regime | Monotributo; category K cap **ARS 126,610,838/yr** (≈ 10.55M/mo) since Aug-2026; K services quota ≈ 1.61M/mo | F ([iProfesional](https://www.iprofesional.com/impuestos/461293-monotributo-asi-quedan-las-escalas-topes-e-importes-a-pagar-desde-agosto-2026)) | Above the cap → Responsable Inscripto (IVA 21% + income tax) |
| Accountant | 100,000/mo | A | |
| Support time | 15 min/account/month after onboarding | A | Weird files are the main driver |
| Support hire | 1 administrativo ≈ 1.9M/mo fully loaded | E | CCT 130/75 Admin A basic 1.318M (F) + contributions/aguinaldo (A) |
| Onboarding (concierge) | 1.5 h founder time; charged 35,000 or included in annual | A / Decision | |
| AI/API costs | **0** | F | No LLM in the product |

## 2. Scenarios (monthly, steady state)

| | 10 accounts | 50 | 100 | 500 | 1,000 |
|---|---|---|---|---|---|
| MRR (ARS) | 407,000 | 2,035,000 | 4,070,000 | 20,350,000 | 40,700,000 |
| MRR (USD) | 264 | 1,321 | 2,643 | 13,214 | 26,429 |
| Tax regime | Monotributo | Monotributo | Monotributo | **RI required** (> K cap) | RI / company |
| Hosting + tools | 15,000 | 15,000 | 20,000 | 60,000 | 120,000 |
| Payment fees (3%) | 12,210 | 61,050 | 122,100 | 610,500 | 1,221,000 |
| Support labor | founder (2.5 h) | founder (12.5 h) | founder (25 h) | 1 hire: 1,900,000 | 2 hires: 3,800,000 |
| Accountant | 100,000 | 100,000 | 100,000 | 200,000 | 300,000 |
| Monotributo quota (E, by category) | ~60,000 | ~150,000 | ~400,000 | — | — |
| IVA if prices stay "final" (RI: price/1.21) | — | — | — | 3,531,818 | 7,063,636 |
| **Contribution before founder pay** | **~220,000** | **~1,709,000** | **~3,428,000** | **~14,048,000** | **~28,195,000** |
| Contribution (USD) | ~143 | ~1,110 | ~2,226 | ~9,122 | ~18,309 |
| Gross margin (revenue − hosting − fees − support labor) | ~93% | ~96% | ~96% | ~87% | ~87% |

All rows except MRR are **E**. Income tax at RI stage not included (depends on structure; U).

**Reading:** software costs are negligible; the business is limited by **acquisition and support time**,
not infrastructure. At ~234 accounts the founder hits the monotributo cap and must re-price
(+IVA) or absorb 21%: decide the entity/pricing before ~150 accounts.

## 3. CAC, payback, LTV (hypothetical)

| Metric | Value | Label | Basis |
|---|---|---|---|
| Founder-led CAC | ~65,000 per customer | E | 40 walk-ins + follow-ups ≈ 20 h → 3 customers (A: 7.5% visit→paid); founder time at 10,000/h (A) + transport |
| Referral/distributor CAC | ~20,000 | A | 1 free month given away |
| Paid ads CAC | U | U | Not tested; do not scale before measuring |
| Payback (founder-led) | ~1.8 months | E | 65,000 / (40,700 × 0.9) |
| LTV (4% churn, 90% margin) | ~916,000 (≈ USD 595) | E | 40,700 × 0.9 / 0.04 |
| LTV / CAC | ~14 | E | Optimistic because founder time is priced low; the real constraint is hours/week |

## 4. Break-even
- **Cash break-even** (hosting + accountant + quota): **~8–10 accounts** (E).
- **Founder replacement income** — if the founder's alternative is ≈ USD 1,600/mo (≈ 2.5M ARS, A) from web projects:
  **~75–80 accounts** (E). At the founder-led pace of ~3 new accounts/week net of churn, that is roughly
  7–9 months (E), which is why the first 90 days focus on proving conversion and retention, not scale.

## 5. Sensitivities (what moves the business)
1. **Churn** 4% → 8%: LTV halves (~458k). Retention driver = recurring supplier lists; watch "applied lists on 2+ days" (`npm run admin -- funnel`).
2. **ARPA**: if most choose Básico (23k), accounts to replace founder income rise to ~120 (E).
3. **Support minutes**: 15 → 45 min/account → a support hire needed at ~150 accounts instead of ~400 (E).
4. **Inflation vs. price adjustments**: quarterly ARS adjustments needed (terms allow it with 15 days notice).
