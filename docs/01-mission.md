# 01 — Mission & Initial State

## Mission
FIND → VALIDATE → BUILD → BREAK → FIX → VERIFY → COMMERCIALIZE a software product with real
commercial potential, operable by a solo founder (autónomo, Argentina) with low capital.

Founder context (given): digital services, website building, direct sales, small businesses,
AI tools, GitHub, deployment, self-taught. Repo owner on GitHub: `webelevate-ar` (a web agency brand).

## Initial repository state (FACT, inspected 2026-09-24)
| Item | State |
|---|---|
| Files | `README.md` only (content: `# creative`) |
| Commits | 1 (`74d1df9 Initial commit`, 2026-09-24) |
| Branches | `main`, working branch `claude/gallant-ramanujan-tbccbs` |
| Stack / framework / package manager | None — greenfield |
| Tests / CI / deployment config | None |
| Docs | None |

Nothing existing was deleted or replaced.

## Cloud environment (FACT)
- Linux container, 4 vCPU, 15 GB RAM, ephemeral (anything not pushed is lost).
- Node 22.22, npm 10.9, pnpm 10.33, bun 1.3, Python 3.11.
- `psql` client present, **no Postgres server**, **no Docker daemon**.
- Chromium + Playwright preinstalled (usable for E2E / screenshots).
- Outbound HTTPS via egress proxy; web search + fetch available.
- Connectors present in session: GitHub (scoped to this repo), Vercel, Google Drive, Claude Docs.
  None of them were used to create external resources without an explicit need.

## What I cannot do from here (FACT)
- Talk to real customers, run paid ads, send WhatsApp messages from the founder's number,
  create accounts on payment providers with the founder's identity, or see the founder's machine.
- Therefore **customer validation in this session is desk research only**; real validation
  is the founder's first job (see `15-go-to-market.md` and `18-final-report.md`).

## Labels used across docs
- **FACT** — verified in this session (source linked or command run).
- **ASSUMPTION** — believed, not verified; must be tested.
- **ESTIMATE** — number derived from stated assumptions.
- **UNKNOWN** — no evidence either way.
