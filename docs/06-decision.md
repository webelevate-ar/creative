# 06 — Decision

## 1. Decision matrix (1 = bad, 5 = good). Scores are judgment calls grounded in 02–05, not facts.

| Criterion | #11 Price lists → sale prices | #12 Lista viva (distributors) | #10 Transfer verification | #13 Installer quotes | #4 Collections (reference, saturated) |
|---|---|---|---|---|---|
| Pain intensity | 4 | 3 | 5 | 3 | 4 |
| Frequency | 5 (weekly) | 4 | 5 (daily) | 3 | 4 |
| Economic impact | 4 (margin + hours) | 3 | 4 (fraud losses) | 3 | 4 |
| Ability to pay | 3 (sector squeezed) | 4 | 3 | 2 | 3 |
| Market size (AR first) | 3 | 3 | 5 | 4 | 5 |
| Competition (5 = open) | 4 | 3 | 3 | 3 | 1 |
| Distribution for this founder | 4 (walk-in, local) | 3 | 4 | 2 | 3 |
| Technical difficulty (5 = easy) | 3 | 3 | 1 (no data access) | 3 | 4 |
| Operating cost (5 = low) | 5 (no per-use AI needed) | 5 | 3 | 5 | 3 (WhatsApp API fees) |
| Margin | 5 | 5 | 4 | 5 | 4 |
| Recurrence | 5 | 5 | 5 | 3 | 5 |
| Speed to MVP | 4 | 3 | 2 | 4 | 4 |
| Speed to first customers | 4 | 3 | 3 | 2 | 3 |
| Differentiation | 4 | 3 | 2 | 2 | 1 |
| Defensibility | 3 (format library, memory) | 3 | 1 (platforms will ship it) | 2 | 1 |
| Support load (5 = low) | 3 (weird files) | 3 | 3 | 3 | 3 |
| Risk (5 = low) | 3 | 3 | 2 | 3 | 3 |
| Internationalization | 3 | 3 | 2 | 3 | 3 |
| **Total** | **69** | **60** | **57** | **53** | **57** |

## 2. Red team of #11 (tried to kill it)

| Role | Attack | Answer | Survives? |
|---|---|---|---|
| **Customer** | "My POS already imports Excel." | Only clean files. Ask them to import the supplier's raw file live; the demo is the rebuttal. If their POS truly handles it, we lose that store — fine. | Yes, conditional (Test A) |
| Customer | "I just raise everything X%." | Show per-item distribution of the last list: some +2%, some +15%. Blanket % loses margin on the +15% items. | Yes |
| Customer | "Money is tight, sales are down." | Price is below one mispriced sale; ROI framed in pesos. Still a real risk → cheap entry plan. | Partially |
| **Competitor** | ERP adds smart import; Multilistas adds export. | Neutral across systems + e-commerce; focus; supplier format library. 6–24 months of window, not forever. | Yes, with time limit |
| **CTO** | Messy files: merged cells, multi-sheet, PDFs, scanned images, 50k rows. | Deterministic parser + header scoring + manual override + remembered mapping; text PDFs supported; scanned PDFs explicitly out of MVP. | Yes (scope) |
| **CFO** | Hidden costs: onboarding each store's catalog, weird-file support. | Concierge onboarding priced into first month; export/import catalog from their POS; format library reduces cost per new store. | Yes, must watch |
| **Growth** | How do we get the first 10? | Founder walks into 40 stores in their own area with a laptop; WhatsApp outreach; ask suppliers/distributors to recommend it to their retailer clients. | Yes (untested) |
| **User** | Why stop using it? | If they only update monthly and forget → staleness alerts per supplier; if catalog drifts from POS → re-import catalog. | Yes |
| **AI strategist** | Will ChatGPT do this for free? | One-off merges yes. Repeatable, audited, deterministic math with memory and undo for non-technical staff: not by default. Risk remains. | Yes, with open risk |
| **Legal** | Supplier lists may be confidential; data protection. | Each account's data is isolated; we never share prices across accounts; only *format* templates could be shared (and only later, opt-in). Business data, not sensitive personal data (Ley 25.326 applies to users' personal data — login emails). | Yes |
| **Founder** | Low ticket × squeezed sector = slow growth. | True. It's a "small profitable business" candidate, with expansion to distributors (#12, higher ticket) and e-commerce. Decide at the Test B checkpoint, not now. | Yes, with checkpoint |

## 3. Selection

**Primary:** #11 — **Remarcá**: turns messy supplier price lists into updated costs and sale prices
for any system the store already uses.

**Alternatives kept (max 2):**
1. #12 Lista viva for distributors — same engine, higher ticket; first pivot if retail WTP is low.
2. #13 Installer/contractor quotes powered by the same supplier prices — later adjacency.

### Documented summary
- **Problem:** supplier lists arrive in heterogeneous Excel/PDF formats every few weeks; updating
  costs and sale prices is manual, slow and error-prone; delays sell stock below replacement cost.
- **User:** encargado/administrativo or owner who updates prices. **Buyer:** owner.
- **Current workflow:** open list → reformat in Excel → BUSCARV against own list → compute
  discounts/IVA/markup → type or import into POS → reprint labels. Or blanket % increase.
- **Solution:** upload list → auto-detect columns (remembered per supplier) → match to own catalog
  (learned equivalences) → compute cost with cascaded discounts, IVA, USD, freight → sale price
  via markup + rounding → review diff with anomaly flags → apply (undoable) → export for the POS /
  Tiendanube / labels.
- **Competition:** Excel, Multilistas (POS replacement), ERP import modules, consultants, generic AI.
- **Pricing:** ARS-denominated tiers ~USD 12–40/mo equivalents (see 08). WTP UNKNOWN.
- **Distribution:** founder-led walk-ins + WhatsApp; chambers (CAFARA and regional); supplier referrals.
- **Key risks:** WTP in a shrinking sector; ERPs catching up; generic AI; file diversity (see 17).
- **Critical hypotheses:** H2 (hours/week), H6 (WTP), H8 (reach), Test C (format coverage).

## 4. Keep looking for counter-evidence (rule 21)
Checkpoints that can reverse this decision are listed in 05 §3 and tracked in 17.
