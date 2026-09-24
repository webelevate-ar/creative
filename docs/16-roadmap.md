# 16 — Roadmap

## NOW (next 2–3 weeks) — launch-blocking or validation-critical
| # | Item | Why | Owner |
|---|---|---|---|
| 1 | Buy domain; deploy to a VPS (Hetzner/DO) with Caddy TLS; `TRUST_PROXY=1` | Nothing sells from localhost | Founder (commands in README) |
| 2 | **Backups**: Litestream (or nightly `.backup` off-server) + a restore drill | Customer price data; top operational risk | Founder |
| 3 | Resend account + domain DNS (SPF/DKIM) for password resets | Account recovery | Founder |
| 4 | Fill `LEGAL_ENTITY`, `CONTACT_*`; quick legal review of Términos/Privacidad | Trust and consumer law | Founder + lawyer |
| 5 | Check "Remarcá" at INPI (trademark) before printing anything | Naming risk | Founder |
| 6 | Test A: 15 interviews with live demo on their files | Validate pain + format coverage | Founder |
| 7 | Test C: collect 30 real supplier files; fix every parsing failure (add them as fixtures) | Real-world robustness | Founder + dev |
| 8 | Test B: 5 paid pilots (ARS 15,000 month 1) | Validate willingness to pay | Founder |
| 9 | Uptime monitor on `/health` (free tier) and error log review | Detect outages | Founder |

## NEXT (if ≥5 paying and ≥60% month-2 retention)
- Presets for the export format of the 3 POS systems most used by pilots (from interviews).
- "Stale supplier" reminder by email/WhatsApp link (setting already exists).
- Mercado Pago subscriptions (preapproval) once manual billing takes >2 h/month.
- Retention job for uploaded files; full account export (zip).
- Suggestions when linking unmatched rows (description similarity), with explicit confirmation.
- Distributors: "lista viva" — publish the computed list as an always-current link/PDF for their clients (the upsell for the Distribuidora plan).

## LATER (with traction and evidence)
- Tiendanube / Mercado Libre price sync via API (for stores that also sell online).
- Optional LLM fallback for column mapping of unusual files (headers only; never prices; opt-in).
- OCR for scanned PDFs, only if pilots show it is frequent (measure first).
- Cross-supplier comparison ("¿quién me lo vende más barato?").
- Opt-in shared library of supplier *formats* (never prices) to make first uploads zero-effort.
- Other LatAm markets with frequent price changes; English/Portuguese UI.
- 2FA, audit log per user.

## DO NOT BUILD YET
- POS, invoicing (ARCA), stock, ordering, CRM, marketplace — crowded markets, and they break the neutral positioning.
- Native mobile apps.
- Paid acquisition infrastructure (ads, funnels) before the founder-led funnel converts.
- Enterprise features (SSO, custom contracts, on-prem).
- Any "AI assistant/chat" feature — no evidence it solves the job better than the deterministic pipeline.
