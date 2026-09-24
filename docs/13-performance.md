# 13 — Performance

Measured in this container (4 vCPU, Node 22) with `npx tsx scripts/bench.ts` and a worker check script.
Numbers are FACT for this machine; a 1-vCPU VPS will be slower (ESTIMATE: 1.5–3×).

## 1. Results

| Operation | Size | Time | Notes |
|---|---|---|---|
| Parse xlsx | 5,000 rows (1.0 MB) | 215 ms | |
| Parse xlsx | 30,000 rows (6.2 MB) | 765 ms | |
| Parse xlsx | 55,000 rows (11.4 MB, near the 12 MB limit) | 1,345 ms | detect 52 ms |
| Parse text PDF | 300 pages, 14,700 lines | 3,589 ms | RSS spike ~730 MB in-process → moved to worker |
| Catalog import | 30,000 products | 2,450 ms | one transaction |
| Match + price | 30k list vs 30k catalog | 645 ms | |
| Review page queries | 2 filtered pages of 50 | 15 ms | |
| Stats refresh | 30k rows | 56 ms | |
| Apply | 23,866 updates | 388 ms | one transaction + history |
| Product search | 30k products, 2 words | 16 ms | LIKE on normalized text |
| 3 PDFs parsed in parallel (worker threads) | 3 × 3 pages | 549 ms | **max event-loop lag 4 ms**; RSS 175 MB |

## 2. What was changed because of the measurements
- **Parsing moved to worker threads** (before: 1.3–3.6 s blocking every other request; after: 4 ms max lag).
  Workers have a 768 MB heap cap, 30 s timeout and max 2 concurrent → bounded memory on small servers.
- Review page size reduced from 100 to 50 rows (HTML size and mobile rendering).
- Parsed workbooks cached (8 entries) so the mapping screen does not re-parse on every view.

## 3. Front-end
- No framework, no web fonts, one CSS file (~15 KB) and one JS file (~1.5 KB), both cached.
- Pages are server-rendered HTML; landing is a single request + 2 static files.
- No images except an inline SVG favicon.

## 4. Not optimized on purpose
- Product search uses `LIKE`; FTS5 only if catalogs >150k or search gets slow.
- No CDN/caching layer; unnecessary at this scale.
- Stats recomputed after each decision change (56 ms at 30k rows) — acceptable.

## 5. Capacity estimate (ESTIMATE)
A 1 vCPU / 2 GB VPS should serve a few hundred accounts: usage is bursty (a list upload every few days
per account) and each heavy operation is 1–3 s of CPU in a worker. The first bottleneck will be two
simultaneous large PDF uploads (queued by design), not the database.
