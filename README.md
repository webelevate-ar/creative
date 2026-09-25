# Remarcá

> **Status (2026-09-25): ABANDONED AS BUSINESS HYPOTHESIS — TECHNICALLY FUNCTIONAL BUT COMMERCIAL EVIDENCE
> INSUFFICIENT.** Kept for its reusable components. Read [`docs/23-remarca-postmortem.md`](docs/23-remarca-postmortem.md)
> first (reusable assets: §12; do not reuse: §13).

**Subís la lista del proveedor, Remarcá te dice qué cambió y te da los precios nuevos listos para tu sistema.**

Web app for Argentine retailers and distributors that receive supplier price lists (Excel, CSV, PDF) in
changing formats. It detects the columns, matches the items to the store's catalog, applies Argentine
price math (cascaded discounts, IVA, USD lists, packs, margins, rounding), flags what matters
(big increases, probable list errors, **items sold below the new cost**), and — after review — updates
costs and prices, exports a file for the store's POS and prints shelf labels. Every update can be undone.

Why this product, the research behind it, and why it was abandoned: see [`docs/`](docs/) — start with
[`docs/23-remarca-postmortem.md`](docs/23-remarca-postmortem.md), then [`docs/18-final-report.md`](docs/18-final-report.md).

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000  (SQLite at ./data/remarca.sqlite)
```

Create an account, click **"Cargar datos de ejemplo"** on the dashboard, download the sample list and upload it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with reload (tsx) |
| `npm run build && npm start` | Production build (`dist/`) and start |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run test:e2e` | Playwright end-to-end + accessibility (Chromium, desktop + mobile) |
| `npm run typecheck` | TypeScript |
| `npm run admin -- <cmd>` | Founder admin: `list`, `set-plan`, `extend-trial`, `reset-link`, `funnel`, `delete-org` |
| `npx tsx scripts/bench.ts` | Performance benchmark with large lists |
| `npm run fixtures` | Regenerate the sample supplier files in `tests/fixtures/` |

## Stack

Node 22 · TypeScript · Hono (server-rendered JSX) · SQLite (better-sqlite3, WAL) · SheetJS · pdf.js (in worker
threads) · Zod · Vitest · Playwright. No front-end framework, no third-party trackers, no AI dependency.
Details and trade-offs: [`docs/09-architecture.md`](docs/09-architecture.md).

## Deploy (single small VPS)

1. Node 22 on the server; a persistent directory for the database.
2. `npm ci && npm run build`
3. Environment: copy `.env.example` values (at least `NODE_ENV`, `BASE_URL`, `DATABASE_PATH`, `TRUST_PROXY`).
4. Run `node dist/server.js` under systemd (or pm2), behind Caddy for TLS:
   ```
   remarca.example.com {
     reverse_proxy localhost:3000
   }
   ```
5. **Backups before the first customer**: Litestream replication of `DATABASE_PATH`, or a cron job with
   `sqlite3 remarca.sqlite ".backup /backups/remarca-$(date +%F).sqlite"` copied off the server.

Only the production build, headers and health check were verified in the development container; the
VPS/TLS/backup steps above were not executed from there (see `docs/18-final-report.md`).

## Repository layout

```
src/lib/        pure domain: number parsing, pricing math, column detection, matching, file readers
src/services/   business logic: auth, suppliers, products, imports (upload→apply→undo), exports, team
src/web/        HTTP routes and server-rendered pages
src/db/         SQLite connection and SQL migrations
tests/          unit, integration (incl. adversarial HTTP) and e2e
docs/           research, decision, strategy, QA, security, economics, GTM, roadmap, risks, final report, red team, real-list benchmark, business simulation, public validation, post-mortem
```
