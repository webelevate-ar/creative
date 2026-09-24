# 08 — Pricing

## 1. Three different things (do not confuse)

| Concept | What we know | Label |
|---|---|---|
| **Existing prices** (what alternatives cost) | Ferretería POS GEOMA: ARS 69,000/mo server + 35,000/mo per extra PC + ARS 400,000 setup (≈USD 45/mo at 1,540). Xubio top plan up to ARS 231,400/mo + IVA. Tango ~ARS 528,000/mo. Líder Gestión from ~ARS 588,000 perpetual. US analogs: MarginEdge USD 350/location/mo; TRA-SER USD 1,260/user/yr. Excel: free. | FACT (sourced in 04) |
| **Willingness to pay** (what an AR retailer would pay for Remarcá) | No evidence. | **UNKNOWN** — Test B (05) measures it with real pre-payments |
| **Value** (economic value created) | Time: an "Administrativo A" (Empleados de Comercio) earns ARS 1,317,965/mo basic in Sep-2026 ([El Destape](https://www.eldestapeweb.com/economia/escala-salarial-empleados-comercio-202691142014)) → fully loaded ≈ ARS 1.8–2.0M/mo ≈ ARS 9,500–10,500/h (ESTIMATE: +35–45% contributions & aguinaldo, ~190 h/mo). Saving 3 h/week ≈ ARS 120,000/mo. Margin leak avoided: see 02 §3.3 (ARS hundreds of thousands/mo for a mid store — ESTIMATE). | ESTIMATE |

A price of ARS 45,000/mo is ~1/3 of the time value alone for a store saving 3 h/week (ESTIMATE),
before counting margin protection. That ratio is what the pilot must confirm.

## 2. Pricing model
- **Value metric: number of active suppliers.** Each supplier is a recurring source of work and
  value; it is easy to understand ("¿cuántos proveedores te mandan listas?").
- **Secondary limits:** products and users (protect infra/support; rarely binding).
- **Currency:** billed in ARS, reference-priced in USD, adjusted quarterly (standard practice in AR SaaS).
- **No free tier** at launch: each account can generate support (weird files) and the ICP is a business.
  Instead: **14-day full trial, no card**. After the trial the account becomes **read-only** (data stays
  exportable — no hostage-taking).
- **Onboarding (optional, one-time):** founder imports the catalog and configures the first 5 suppliers.
  Paid, because it is real work and it filters out non-serious leads; waived on annual plans.

## 3. Plans (launch hypothesis)

| Plan | Active suppliers | Products | Users | Monthly (ARS) | ≈USD | Annual |
|---|---|---|---|---|---|---|
| **Prueba** (14 days) | 40 | 30,000 | 3 | 0 | 0 | — |
| **Básico** | 10 | 5,000 | 1 | 23,000 | 15 | 10 months price |
| **Comercio** | 40 | 30,000 | 3 | 45,000 | 29 | 10 months price |
| **Distribuidora** | 150 | 150,000 | 10 | 90,000 | 58 | 10 months price |
| Onboarding asistido | — | — | — | 35,000 once | 23 | included |

Implemented in code as limits in `src/lib/plans.ts` (single source of truth). Billing is **manual** for
the first customers (transfer / Mercado Pago payment link) and the founder activates the plan with
`npm run admin -- set-plan <email> <plan> <months>`. Automated Mercado Pago subscriptions are NEXT
(see 16) — not built without paying customers.

## 4. Pricing experiments
1. Pilot (Test B): offer Comercio at ARS 15,000 for month 1 (paid upfront), then list price. Measure
   conversion and month-2 renewal.
2. Price anchoring at demo: show the ARS amount of the margin leak found in *their own* last list, then price.
3. If ≥80% of pilots choose Básico and hit the 10-supplier limit → limits are right. If nobody hits it →
   lower Comercio or raise Básico limit.
4. Distributors: test ARS 90,000 vs 150,000 with the "lista viva" feature (NEXT) as the upsell.
