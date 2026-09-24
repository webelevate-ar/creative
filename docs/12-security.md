# 12 — Security

Scope: only our own application, tested locally in this container. No external system was probed.

## 1. Controls implemented

| Threat | Control | Verified by |
|---|---|---|
| Credential theft | scrypt (N=2^15, r=8, p=1, 16-byte salt), timing-safe compare, dummy hash for unknown emails | tests/http: same message + timing path |
| Session hijack | 256-bit random tokens; only SHA-256 stored; HttpOnly, SameSite=Lax, Secure in prod; 30-day expiry; logout deletes server-side; password change/reset kill sessions | tests/http |
| CSRF | Per-session token on every authenticated POST + Origin/Referer same-host check on all POSTs (incl. anonymous login/signup) | tests/http |
| IDOR / broken access control | Every query scoped by session `org_id`; ids parsed strictly; cross-org product ids rejected on link/assign; owner-only team actions | tests/http (10 GET + 10 POST attack paths) |
| XSS | JSX auto-escaping, no raw HTML; strict CSP (`script-src 'self'`, no inline) | tests/http |
| Clickjacking | `frame-ancestors 'none'`, `X-Frame-Options: DENY` | tests/http |
| Open redirect | `next`/`volver` only accept same-site relative paths; import back-links restricted to the same import | tests/http |
| Injection | Parameterized SQL everywhere; LIKE wildcards escaped; filters whitelisted | code review |
| Spreadsheet formula injection (CSV export) | Text cells starting with `= + - @ \t \r` prefixed with `'` | tests/http |
| Malicious uploads | 12 MB body limit (413), magic-byte type detection, zip-bomb check, row/col caps, SheetJS 0.20.3 (fixes CVE-2023-30533, CVE-2024-22363), parsing in worker threads with heap cap and timeout, filenames sanitized | unit + manual |
| Brute force / abuse | Login 10/15 min per IP and per email; signup 10/h per IP; reset 5/h; uploads 60/h per account | tests/http |
| Information leakage | Generic 500 page, stack traces only in server logs; reset flow answers identically for unknown emails; reset tokens not logged in production | tests/http + code review |
| Path traversal | Static files served from an in-memory whitelist of 3 names | tests/http |
| Transport | HSTS in production; TLS terminated by reverse proxy (deployment) | prod smoke test (header) |
| Dependencies | `npm audit`: **0 vulnerabilities** (2026-09-24) | command run |
| Secrets | None in the repo; configuration via env vars (`.env.example`); `.env` git-ignored | review |

## 2. Adversarial tests performed (as a malicious user)
Modified ids in URLs and forms, posted to other accounts' imports/rows/suppliers/products, linked rows to
another account's product, assigned products to another account's supplier, uploaded to another account's
supplier, searched for other accounts' products, replayed apply concurrently, reused reset/invite tokens,
posted cross-origin with a valid CSRF token, used `//evil.com` and `/\evil.com` redirects, injected
`<script>`/`<img onerror>` in names, `=HYPERLINK()` in product codes, uploaded zip bombs, corrupt and oversized files,
malformed ids (`abc`, `-1`, 20-digit, `1e5`). **All blocked** (see tests/integration/http.test.ts).

## 3. Residual risks / not done
| Risk | Severity | Note / mitigation plan |
|---|---|---|
| No 2FA | Medium | Business data, not money movement. Add TOTP when a customer asks or at 100 accounts |
| In-memory rate limiter resets on restart and is per-instance | Low | Single instance by design; move to SQLite/Redis if scaled |
| `TRUST_PROXY` misconfiguration → all users share one IP for rate limits | Medium | Deployment checklist item |
| Email enumeration via signup ("ya existe una cuenta") | Low | Accepted UX trade-off; rate limited |
| Uploaded files stored in DB indefinitely | Low/Privacy | Retention job (NEXT); discard deletes blob |
| No automated backups configured (no host yet) | High (operational) | Litestream or cron `.backup` is launch-blocking — see 16 NOW |
| pdf.js and SheetJS parse hostile input | Medium | Isolated worker, heap cap, timeout; keep dependencies updated (monthly `npm audit`) |
| No WAF/DDoS protection | Low (at this scale) | Put Cloudflare in front if abused |
| Legal pages written without a lawyer | Medium (legal) | Review before charging (see 17) |
