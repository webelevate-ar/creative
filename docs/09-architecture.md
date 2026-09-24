# 09 — Architecture

Guiding rule: the simplest architecture that is serious — one process, one database file, server-rendered
HTML — with boundaries that allow growing later (Postgres, queue, integrations) without rewrites.

## 1. Overview

```
Browser (HTML forms + ~40 lines of progressive-enhancement JS)
   │  HTTPS (reverse proxy: Caddy/Nginx, TLS)
   ▼
Node 22 process ─ Hono app (server-rendered JSX)
   ├─ middleware: security headers/CSP → body limits → session → CSRF/origin → auth gate → plan gate
   ├─ web/routes/*        (HTTP + HTML only; no business rules)
   ├─ services/*          (auth, suppliers, products, imports, exports, settings, demo)
   ├─ lib/*               (pure domain: numbers, pricing, detect, match, money, plans)
   ├─ lib/parse.ts ──► worker threads (SheetJS / pdf.js) — memory cap 768 MB, 30 s timeout, max 2 at once
   └─ better-sqlite3 (WAL) ──► data/remarca.sqlite  (backups: Litestream or nightly .backup)
```

## 2. Decisions and why

| Decision | Choice | Why | Trade-off / exit |
|---|---|---|---|
| Runtime | Node 22 + TypeScript | Founder already knows JS; one language end to end | — |
| Web framework | Hono + server-side JSX | Tiny, fast, typed; HTML works on old PCs and slow phones; forms work without JS; smaller attack surface than an SPA + JSON API | Rich interactions need more JS later; islands can be added per page |
| Database | SQLite (better-sqlite3, WAL) | Zero ops, single file backup, synchronous transactions make "apply" and "undo" atomic and simple; fast enough (see 13) | Single writer & single host. Exit: schema is plain SQL, portable to Postgres; all queries are in services/ |
| File parsing | SheetJS 0.20.3 (xlsx/xls/ods), own CSV parser, pdf.js 6 | `.xls` (BIFF8) still common in AR suppliers; own CSV parser to control encoding (Windows-1252) and decimals | pdf.js is memory hungry → isolated in worker threads |
| AI/LLM | **None in the MVP** | Deterministic detection covered all test formats; zero per-use cost; no data leaves the server; not a "wrapper" | Optional LLM fallback for column mapping only (headers, never prices) is in 16-roadmap LATER |
| Money | Integer cents in DB; floats only inside pure functions | No drift in stored values | — |
| Auth | Email + password (scrypt N=2^15), opaque session tokens stored as SHA-256, per-session CSRF token | No third-party auth dependency; works for non-technical users | No 2FA yet (LATER) |
| Email | Resend HTTP API when `RESEND_API_KEY` is set; otherwise not sent (logged redacted in prod) | Only password reset needs email in MVP | Founder can generate reset links with the admin CLI |
| Billing | Manual (transfer / Mercado Pago link) + `npm run admin -- set-plan` | First 10–50 customers don't justify a billing integration; plan limits are enforced in code | Mercado Pago subscriptions = NEXT |
| Analytics | First-party `events` table + `admin funnel` | Privacy, no CSP exceptions, answers the activation questions we have | No dashboards; SQL/CLI only |
| Hosting | Any Linux VPS/container with a persistent disk (1 vCPU, 1–2 GB RAM) | SQLite needs a disk; serverless (e.g. Vercel functions) is a poor fit for 12 MB uploads + local DB | See §5 |

## 3. Data model (src/db/migrations/001_init.sql)

- `orgs` (account = one business; plan, trial, settings JSON) ← `users` (email unique) ← `sessions`, `password_resets`
- `suppliers` (pricing rules + remembered column mapping)
- `products` (own code, supplier + supplier code, cost/price cents, overrides)
- `code_links` (learned "supplier code X = my product Y")
- `imports` (uploaded file blob, mapping, rules snapshot, status, stats) → `import_rows` (per list row: match, old/new cost & price, flags, decision)
- `price_history` (every change with origin: list update/create, manual, revert) — powers undo and product history
- `catalog_uploads` (temporary), `events` (analytics)

**Tenant isolation:** every business table has `org_id`; every query filters by the `org_id` of the
session (never from request input). Lookups by id are always `WHERE id = ? AND org_id = ?`.

## 4. Import pipeline (the core)

1. **Upload** → size/type/magic-byte check → zip-bomb check → parse in worker → pick best sheet.
2. **Mapping** → if the supplier has a remembered mapping, re-locate columns by header text (suppliers
   move columns) → else detect (header keywords + column statistics) and ask the user to confirm.
3. **Extract** → skip notes/section/footers, repeated headers; parse numbers with per-column decimal inference.
4. **Match** → learned link → supplier code → own code (normalized: case, punctuation, leading zeros).
5. **Price** → `computeCost` (cascaded discounts, surcharge, USD, pack, IVA basis) → sale price
   (keep current margin ratio, or markup) → round up. Cost differences ≤ 1 cent are "no change".
6. **Flag** → suspect (×5 / ÷5), big up/down, below cost today, no price, duplicate, new, missing.
7. **Review** → per-row / bulk decisions, manual linking, recompute after rule edits.
8. **Apply** → one SQLite transaction, status check inside (idempotent vs double submit), history rows.
9. **Undo** → restores products whose values are still exactly what the import wrote and have no later history; others are reported as conflicts.
10. **Outputs** → export (configurable CSV/XLSX), labels (A4 3×7), full computed list.

## 5. Deployment (target)

- `npm ci && npm run build && NODE_ENV=production BASE_URL=https://... DATABASE_PATH=/data/remarca.sqlite node dist/server.js`
- Reverse proxy with TLS (Caddy: 2 lines of config). Set `TRUST_PROXY=1` behind it so rate limits see real IPs.
- Backups: Litestream to S3-compatible storage (continuous) **or** cron `sqlite3 remarca.sqlite ".backup ..."`.
- Env vars: see `.env.example`. **Verified in this session:** production build starts, serves HTTPS headers (HSTS), health check, static files.
  **Not verified here:** an actual VPS, TLS proxy, Litestream, Resend (no accounts/credentials in this environment).

## 6. Known architectural limits
- Single instance (in-memory rate limiter, SQLite). Fine for hundreds of accounts; move to Postgres + shared limiter before running >1 instance.
- Original uploaded files are stored in the DB (≤12 MB each). Add a retention job (e.g. drop blobs of applied imports after 90 days) — NEXT.
