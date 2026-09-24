# 07 — Product Strategy: Remarcá

> Working name. "Remarcar" is Argentine retail slang for re-pricing goods. Trademark availability
> at INPI: **UNKNOWN** — check before spending on branding.

## One-liner
**Subís la lista del proveedor, Remarcá te dice qué cambió y te da los precios nuevos listos para tu sistema.**
(Upload the supplier's list; Remarcá shows what changed and hands you new prices ready for your system.)

## ICP (who pays)
Owner of an Argentine retail or wholesale business that:
- buys from **≥8 suppliers** that send price lists (Excel/PDF) at least monthly;
- carries **≥1,500 SKUs**;
- has 1–20 employees; one person (owner or encargado) updates prices;
- uses *some* system (POS/ERP, Excel, Tiendanube/Mercado Libre) — any.
Verticals to start: ferreterías, casas de electricidad, sanitarios, pinturerías, autopartes/motopartes,
librerías comerciales, distribuidoras/mayoristas. (Order to be decided by Test A results.)

## User (who uses it)
Encargado/administrativo or the owner, at a desktop PC in the back office, sometimes from a phone to
check what changed. Comfortable with WhatsApp and Excel basics; not with formulas.

## Job to be done
"When a supplier sends a new price list, I want my costs and sale prices updated correctly and fast,
so I never sell below what it costs me to restock and I don't lose an afternoon doing it."

## Pain
Hours of manual reformatting and lookups per list; errors (decimals, IVA, per-box prices, cascaded
discounts); delays → selling below replacement cost; no record of what changed or when.

## Current workflow
Receive list by email/WhatsApp → open in Excel → clean columns → BUSCARV against own list → compute
discounts/IVA/markup per row → type or import into POS → print labels. Or: "raise everything X%".

## Value proposition
1. **Minutes instead of hours** per list; second time the same supplier is near zero effort.
2. **No selling below replacement cost**: every change is visible with its margin impact.
3. **Fewer errors**: deterministic math for cascaded discounts, IVA, USD lists; anomaly flags.
4. **Keep your system**: exports in the format your POS/online store imports.
5. **Undo**: every applied update can be reverted.

## Differentiation (why us)
- Neutral add-on (vs Multilistas' POS replacement), built for Argentine price math.
- Remembers each supplier's format and each code equivalence (vs generic AI chats).
- Founder-led, local, in-person onboarding (vs remote ERP vendors).

## Pricing (summary — detail in 08)
14-day free trial → ARS-billed monthly plans by number of suppliers (≈USD 15 / 29 / 59).

## Distribution (summary — detail in 15)
Founder-led walk-ins and WhatsApp with a live demo on the prospect's own supplier file; chambers
and trade media; supplier/distributor referrals; POS vendor partnerships later.

## Retention
- Supplier lists keep arriving (inflation) → natural weekly/monthly usage trigger.
- Stored mappings, equivalences and price history increase switching cost over time.
- "Stale supplier" reminders (list older than N days) — NEXT.

## Product principles
1. The code decides; any AI only suggests (and there is no AI dependency in the MVP).
2. Nothing is written to the catalog without review; everything written can be undone.
3. Numbers are shown the Argentine way (`$ 1.234,56`), dates `dd/mm/aaaa`, Spanish (rioplatense) copy.
4. Works on a cheap PC and a phone. No heavy SPA frameworks where plain HTML works.
