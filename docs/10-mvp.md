# 10 — MVP

Each feature answers: *does it increase the ability to solve the problem, or to win/retain customers?*

## MUST HAVE — built and tested
| Feature | Why | Status |
|---|---|---|
| Upload supplier lists: .xlsx, .xls (legacy), .ods, .csv (UTF-8/Windows-1252, `;`/`,`/tab), text PDF | The lists arrive in all of these | ✅ unit + E2E |
| Automatic header/column detection; manual override; sheet selection | Messy formats are the core pain | ✅ |
| Remembered per-supplier mapping, robust to moved columns | "Second time is zero effort" (retention) | ✅ |
| AR/US decimal inference per column | `1.234,56` vs `1,234.56` errors ×1000 | ✅ |
| Supplier rules: cascaded discounts, surcharge, IVA incl./excl., IVA rate, USD + rate, price per pack, markup, price mode | Argentine price math | ✅ |
| Org settings: IVA condition (net/gross), sale price with IVA, keep-margin vs markup, default markup, rounding | Different business types | ✅ |
| Catalog import from the store's own export (with supplier + supplier code) | Matching needs a catalog | ✅ |
| Matching: learned links → supplier code → own code | Accuracy | ✅ |
| Review: stats, filters, search, per-row & bulk decisions, manual linking, recompute | "Nothing is written without review" | ✅ |
| Flags: suspect (decimal error), big changes, **selling below cost today**, no price, duplicates, new, missing items | Decision support = value beyond Excel | ✅ |
| Apply (atomic, double-submit safe) + Undo (conflict-aware) | Trust | ✅ |
| Export for the POS (CSV/XLSX, columns, separator, decimals, encoding) | Neutral add-on positioning | ✅ |
| Price labels (A4, 3×7) | Shelf work after re-pricing | ✅ |
| Price history per product | Audit, "when did it change" | ✅ |
| Auth (signup, login, logout, reset, change password), tenant isolation | Serious product | ✅ |
| Team invites by one-time link (WhatsApp-friendly), seat limits, owner/member roles | Plans include 3/10 users | ✅ |
| Trial (14 d) → read-only; plan limits; manual activation CLI | Monetization | ✅ |
| Demo data + downloadable sample list | Activation without own files | ✅ |
| Landing page with honest content and pricing | Acquisition | ✅ |

## SHOULD HAVE — next, if pilots confirm
- Mercado Pago subscription billing (when >15 paying customers make manual billing painful).
- "Stale supplier" email/WhatsApp reminder (setting exists; delivery not built).
- Blob retention job; per-account data export as a zip (products export already exists).
- Description-based suggestions when linking (today: search box).

## LATER
- LLM fallback for column mapping of unusual files (headers only).
- OCR for scanned PDFs (cost & accuracy to be measured first).
- Direct integrations: Tiendanube/Mercado Libre price updates via API; popular AR POS formats as presets.
- "Lista viva" for distributors: publish an always-current price list link for their clients.
- Cross-supplier comparison ("who sells it cheapest").
- Shared supplier *format* library (opt-in; never prices).

## DO NOT BUILD (without new evidence)
- A POS, invoicing (ARCA), stock management, ordering, CRM — each is a crowded market and would destroy the neutral positioning.
- Native mobile apps — the web app works on phones.
- Multi-currency beyond ARS/USD; multi-country tax logic.
- Public API — no customer has asked for it.
