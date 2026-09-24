# 20 — Real-World Benchmark (public Argentine supplier price lists)

Date: 2026-09-24. Goal: **try to break Remarcá** with real, publicly downloadable Argentine price lists, measuring
import (Level 1), transformation (Level 2) and matching (Level 3).

Ground rules followed:

- No client catalogs were invented. Every catalog used in a matching test is a **SYNTHETIC BENCHMARK** catalog
  derived from a public list, and is named as such.
- None of the companies below is a Remarcá customer. They are public sources only.
- Labels: FACT (measured or read here), ESTIMATE, ASSUMPTION, UNKNOWN.
- "Correct" is always checked against an **independent** reader (Python openpyxl/xlrd/pdfplumber with per-file specs
  written after manual inspection) or against **manual labels**, never against Remarcá's own output.

Product changes made during the benchmark were limited to errors it uncovered. Each came with a regression test that
fails on the old code:

| # | Error found on real data | Commit |
|---|---|---|
| F1 | Codes differing only in punctuation or spaces were merged (`1.5.12` = `15.12`), so prices went to the wrong product | `8fbb534` |
| F2 | A code listed twice with different prices: the first price was applied by default | `c942db2` |
| F3 | A description column with the header "Artículo" was taken as the code column (0/429 usable rows) | `b33fcb1` |
| F4 | Rows in dollars inside a peso list were created as pesos, with no warning | `043005c` (guard, not per-row currency support) |
| F5 | Side-by-side "Cód \| Precio" blocks: a code was paired with the neighbour block's price | `864f1c6` |
| F6 | Rows without a code were dropped with no visible count (all 107 new products of a real list) | `6daf0c4` |

No feature was added. Numbers below are **after** these fixes unless marked "before".

---

## 1. Executive Summary

Remarcá imports all **7 supplier spreadsheet lists** correctly (48,262 product rows):

- 6 of them import with automatic detection.
- 1 (Bulonera Camba) needs the user to pick the right code column.
- Every price read matches the independent reader, except rows that the lists themselves leave without a price or
  list twice.

**PDF is the weak format.** Only **1 of 6 PDF lists** is read correctly:

- **ALMA:** 429/429, and only after fix F3.
- **Strada:** 48/52.
- **Jeluz and JB:** partial, with about 80% and 70% correct rows in manual samples, and JB loses products.
- **Roker and Bulonera Camba** (37 PDF pages) fail. Camba: 27 pages are refused and 84 correct rows come out of
  1,541 extracted.

**Transformation is where real lists stop fitting Remarcá's model.** Remarcá has one currency and one IVA rate per
supplier. Real electrical lists mix both row by row:

- **Currency:** JB has 8,207 of 21,884 rows (37.5%) in dollars. Remarcá now holds them instead of creating them
  1,535× too cheap. That is guarded, not solved.
- **IVA:** 10.5% items get a sale price 9.5% too high, silently:
  - AS: 1,450 of 11,010 rows (13.2%);
  - Cambre: 69 of 508 rows (13.6%);
  - JB: about 1,300 of 21,884 rows (≈6%).

**Matching is reliable only when both files share the same supplier code, written the same way.**

- **Same supplier, next version** (Camba old-code sheet vs current list):
  - 10,229/10,229 shared codes matched to the right product; 0 wrong.
  - 107 new and 1,217 missing detected. Truth: 107 new and 1,219 missing; 2 codes whose spelling changed were held
    for review.
- **Punctuation collisions** (fix F1): before, 288 of 288 test rows matched the wrong product and 83 were applied by
  default; after, 0.
- **Description only:** Remarcá does not match by description, so every row goes to manual review. On real data a
  naive matcher is right 1.2% of the time; a guarded one is right on 77 rows, wrong on 463 and abstains on 1,901.
- **Supplier change:** matching only works when the store's product code is the manufacturer code shared by both
  lists, and the product is not assigned to the old supplier. Then, in a labeled sample:
  - Identical codes: 164/170 CORRECT, 5 AMBIGUOUS, 1 INCORRECT.
  - Of the rows Remarcá applied by default: 92/97 correct, 4 ambiguous, 1 incorrect.
  - Codes equal only after ignoring punctuation: 20/29 INCORRECT, so they are now never auto-applied.

**Scale is not a problem** at list sizes seen here (4 vCPU, 3 runs each, 0 errors):

| Rows | First list, end to end | Next list, end to end | Peak RSS |
|---:|---:|---:|---:|
| 32,892 | 2.3 s | 2.7 s | 527 MB |
| 10,000 | 0.85 s | 1.0 s | 294 MB |

**Conclusion (precise):**

> Remarcá procesa correctamente **7/7 planillas** de proveedores reales (6 automáticas, 1 eligiendo la columna de
> código) y **1/6 listas PDF**. Lee bien los precios, pero **no puede transformar listas que mezclan moneda o IVA por
> fila** (2 de 3 fuentes de electricidad): ahora las retiene o avisa, no las resuelve.
>
> El matching es confiable **únicamente cuando existe código de proveedor idéntico** entre versiones del mismo
> proveedor (10.229/10.229, 0 errores). Entre proveedores, solo cuando el catálogo usa el código del fabricante:
> 1 incorrecto y 5 ambiguos en 170. Por descripción no es confiable y Remarcá no lo intenta.

---

## 2. Sources

All retrieved on 2026-09-24 from the cloud container. The manifest is
[`scripts/research/real-sources.json`](../scripts/research/real-sources.json): URLs, Last-Modified, bytes and SHA-256.
Third-party files are **not committed**; [`scripts/research/fetch-real-lists.sh`](../scripts/research/fetch-real-lists.sh)
downloads them and checks the hashes.

| Source (primary page) | Sector | Files used | List date / Last-Modified |
|---|---|---|---|
| Bulonera Camba — [buloneracamba.com.ar/bulones/listas-de-precios](https://buloneracamba.com.ar/bulones/listas-de-precios/) | Bulonería | "Sábana" XLSX (list + "Codigos Viejos" sheet); ZIP with 37 PDF pages | 30-08-2026 / 2026-09-02 |
| AS Electricidad — [aselectricidad.com.ar/lista-de-precios](https://aselectricidad.com.ar/lista-de-precios/) | Electricidad (distributor) | `ListadoPrecios.xls` | 2026-09-22 |
| Electricidad Juan B. Justo — [electricidadjuanbjusto.com.ar/es/lista-de-precios](https://www.electricidadjuanbjusto.com.ar/es/lista-de-precios) | Electricidad | XLS (tabular sheet + printed layout sheet); PDF | Sep-2026 / 2026-09-21 |
| ALMA Repuestos — [almarepuestos.com.ar/listas](https://almarepuestos.com.ar/listas/) | Autopartes | VTH XLSX (MODELO + CORRELATIVA); Peugeot XLS; PDF | 04-09-2026, 01-09-2026; PDF 2026-02-03 |
| Manufacturers linked from ACCME — [accmelec.com.ar/lista-de-precios](https://accmelec.com.ar/lista-de-precios/) | Material eléctrico (Cambre, Jeluz, Roker, Strada) | 2 Cambre sheets (Google Sheets export); Jeluz, Roker, Strada PDFs | UNKNOWN (no date on exports) |
| Ministerio de Salud — [precios de referencia 2026](https://www.argentina.gob.ar/salud/informes-y-seguimiento-de-precios/precios-de-referencia/ano-2026) | **Control** (no product codes; not a supplier list) | Aug and Sep XLSX; Sep PDF | 2026-08-03, 2026-09-02 |

**Excluded** (not public from here, or not available):

- Digilio: Dropbox returned an HTML page.
- Dfer: login required.
- Madeva: HTTP 400.
- A second AS file: HTTP 404.
- Previous monthly versions of JB and Camba: the guessed URLs return error pages.
- Wayback Machine: unreachable from this environment.

**Consequence:** except for Camba's old-code sheet and the two medicine months, **no old/new versions of the same list
could be obtained** (see §18–§19).

How to reproduce:

```sh
scripts/research/fetch-real-lists.sh /tmp/raw
python scripts/research/ground_truth.py /tmp/raw /tmp/gt
BENCH_DIR=/tmp/raw GT_DIR=/tmp/gt PARSE_IN_WORKER=0 npx tsx scripts/research/real-benchmark.ts   # Level 1
BENCH_DIR=/tmp/raw PARSE_IN_WORKER=0 npx tsx scripts/research/real-transform.ts                  # Level 2
BENCH_DIR=/tmp/raw PARSE_IN_WORKER=0 npx tsx scripts/research/real-matching.ts                   # Level 3
PREPARE=1 BENCH_DIR=/tmp/raw SCALE_DIR=/tmp/scale npx tsx scripts/research/real-scale.ts          # §13
```

Manual labels: [`scripts/research/gold/`](../scripts/research/gold/).

## 3. Dataset Inventory

"Products" means rows with a code and a numeric price, per the independent reader (FACT).

| File (sheet) | Products | Structure | Columns used | Currency | IVA | Units / packs | Notes |
|---|---:|---|---|---|---|---|---|
| Camba Sábana (Sheet1) | 10,341 (10,336 distinct codes) | Header row 1, 11 columns | Referencia interna, Nombre, Precio de venta | ARS | not stated | "Cant.1" = pack sizes (1–6,000); price is per unit | "Codigo ID" = legacy integer ID, `#N/A` for 113 rows; 72 prices ≤ $1 (5 are $0); prices with up to 13 decimals |
| Camba Sábana ("Codigos Viejos") | 11,448 codes | Code, legacy int ID, **old description** | — | — | — | — | Used as the old-version gold standard (§7, §10) |
| Camba PDFs (37 pages) | UNKNOWN (not tabular) | Matrices (diameter × length), side-by-side "Cód \| Precio" blocks per finish | — | ARS | — | Pack per row | Page dates differ from the ZIP date (e.g. 09/08/2026) |
| AS Electricidad (Hoja1) | 11,010 (11,008 distinct) | Header row 4; notes above | Código, Descripción, Precio Lista | ARS | **Per row: 21% (9,560) / 10.5% (1,450)** | — | "Cód.Alter" = manufacturer code; status column ("Nuevo", "Baja $", "*") |
| AS Electricidad (Hoja2) | 50 | No header, data from column S | — | — | — | — | A different small list |
| JB Juan B. Justo (Hoja1) | 21,884 | Header row 6, 42 columns, prices at column Q | Código, Descripción, Precio | **Per row: $ (13,677) / U$S (8,072) / U$SB (135)** | Pr.Final = Precio × 1.21, or × 1.105 in ≈1,300 rows | "Unidad" | Header prints 2 rates (U$S 1535, U$SB 1550) and "Lista publico"; codes with non-breaking spaces |
| JB ("Electricidad Sep 26") | ≈465 (approximate reader) | Printed layout, 2–3 products per row | — | mixed | — | — | Same data as Hoja1 |
| ALMA VTH (CORRELATIVA) | 2,273 | Title + header row 4 | Codigo, Descripcion, Precio | ARS | not stated | — | "Cod.OEM" column |
| ALMA VTH (MODELO) | 4,946 (2,269 distinct) | Grouped by car model; codes repeat | Codigo, Descripcion, **Precio and PRECIO** | ARS | not stated | — | "Precio" = 0.5494 × "PRECIO" for all rows; "PRECIO" equals CORRELATIVA |
| ALMA Peugeot | 2,246 | Header row 14, table starts at column D | codigo, descripcion, **precio_sin_iva** | ARS | explicitly net | — | Codes with suffixes (`/V10`) |
| Cambre A | 395 (+2 codes without price) | Header row 11 | CÓDIGO, DESCRIPCIÓN, PRECIO | ARS | column marks "10.5%" on 45 rows | Unlabeled pack column (1–30) | — |
| Cambre B | 113 (+4 without price) | Header row 11 | CÓDIGO, DESCRIPCIÓN, PRECIO | ARS | "10.5%" on 24 rows | "U/ PACK" column | Notes columns misaligned |
| ALMA PDF | 429 | Text PDF, 10 pages; "Artículo" printed above the descriptions | — | ARS | — | — | Uncommon characters (Ã‘) |
| Strada PDF | 52 | Several tables; side notes next to prices | Código, Medida, Precio × m | ARS | — | **Price per metre, sold by roll (25 m)** | — |
| JB PDF | UNKNOWN | 2 products per line; size/price tables | — | ARS | — | — | — |
| Jeluz PDF | UNKNOWN | Catalogue pages; colour in its own column | — | ARS | — | Pack quantity column | — |
| Roker PDF | UNKNOWN | Catalogue pages | — | — | — | — | — |
| Medicines (control) | 162 per month | Composite description, no code | — | ARS, text "$ 34.514,49" | — | — | Control for description-only lists |

## 4. File Formats

| Format | Files | Notes |
|---|---:|---|
| XLS (BIFF, legacy) | 3 (AS 9.3 MB, JB 10.0 MB, ALMA Peugeot) | JB is at 80% of the 12 MiB upload cap |
| XLSX | 5 (Camba, ALMA VTH, Cambre A/B, medicines ×2 as control) | Two are Google Sheets exports |
| ZIP of XLSX / PDFs | 2 (Camba) | **Remarcá does not accept ZIP.** It answers with a misleading "¿Está dañado o protegido con contraseña?" (FACT, tested); the user must unzip first |
| Text PDF | 42 supplier PDFs (37 Camba + ALMA, Strada, JB, Jeluz, Roker) + 1 control | No scanned PDF was found among these sources |
| Multi-sheet workbooks | 4 (Camba, AS, JB, ALMA VTH) | In 2 of them the right sheet is not the one Remarcá picks for a given purpose (AS Hoja2, JB printed sheet) |

## 5. Import Results (Level 1)

Product path: upload, then automatic sheet and column detection accepted as proposed, then row computation. Compared
row by row with the independent reader. Times are in-process on the benchmark machine.

| Case | Remarcá's automatic result | Correct code + price | Outcome |
|---|---|---:|---|
| Camba Sábana | Right sheet. Code column = "Codigo ID" (legacy integer ID) instead of "Referencia interna" (the supplier's code). **113 rows skipped** (`#N/A` IDs = the 107 newest products + 6 without code); since F6 the review shows "113 filas no se leyeron" | By row: 10,234/10,234 prices right. With "Referencia interna" chosen: 10,338/10,341 (3 codes listed twice with different prices, held by F2) | **Correct after a manual column choice** |
| AS Hoja1 | Auto | 11,008/11,010 (2 rows without price, flagged) | Correct |
| AS Hoja2 | Auto picks Hoja1; the user must choose Hoja2 | 50/50 on Hoja2 (header-less detection) | Correct after a sheet choice |
| JB Hoja1 | Auto | 21,884/21,884 | Correct import (currency: §6) |
| JB printed sheet | 10 garbage rows | 0/465 | **Fail** (the same data is in Hoja1) |
| ALMA VTH | Auto picks CORRELATIVA | 2,273/2,273 | Correct |
| ALMA VTH MODELO | Code not detected (codes repeat per car model): refused | — | Safe refusal; ambiguous second price (§9) |
| ALMA Peugeot | Auto (header on row 14) | 2,246/2,246 | Correct |
| Cambre A / B | Auto | 395/395 and 113/113 (+2 and +4 rows without price, flagged) | Correct |
| ALMA PDF | Auto | **429/429** (before F3: **0/429**, code and description swapped) | Correct |
| Strada PDF | Auto | 48/52: 3 prices merged with side text ("646,03 Bajo en Ignífugo") are flagged "Sin precio", 1 product lost (price on another line), 2 sub-header rows | Partial (no silent errors found) |
| JB PDF | 250 rows | Manual sample 14/20 correct. 6/20 are size/price pairs from cable tables read as code/price; only one of the two products per line is read | Partial, **loses products** |
| Jeluz PDF | 543 rows | Manual sample 16/20 correct. 66 rows got the code "20" (a quantity) and are held as repeated codes (F2); colour (the distinguishing attribute) is not in the description | Partial |
| Roker PDF | Refused ("Indicá qué columna tiene el código y cuál el precio") | — | Fail (safe) |
| Camba PDFs (37) | 27 refused; 10 produce 1,541 rows | Against the same-date Sábana: **84 correct** (before F5: 0). 6 wrong but plausible, 76 wrong and implausible, the rest carry codes that do not exist (unmatchable). Hoja25 sample: 0/20 usable | **Fail** |
| Medicines XLSX / PDF (control) | Refused: no code column | — | Safe refusal; description-only lists are unsupported |

**Summary (FACT):**

- **Spreadsheet lists:** 7/7 correct. 6 are automatic; Camba needs a column choice.
- **Secondary sheets:** 1 needs a sheet choice (AS Hoja2), 1 fails (JB printed layout) and 1 is refused (ALMA MODELO).
- **PDF lists:**
  - 1/6 correct (ALMA);
  - 3/6 partial (Strada, JB, Jeluz);
  - 2/6 fail (Roker; Camba's 37 pages).
- **Silent row loss before F6:** Camba's 113 rows, including all new products.

Timing per file (FACT): 36 ms (Cambre B) to 4.6 s (AS, 11k rows, legacy XLS).

## 6. Transformation Results (Level 2)

Script: `scripts/research/real-transform.ts`.

| Case (real data) | What the list does | What Remarcá does | Effect (measured) |
|---|---|---|---|
| **Currency per row** (JB) | 8,207 of 21,884 rows in U$S/U$SB and the rest in $; 2 exchange rates printed | One currency per supplier | **Before F4:** creating the catalog from the list stored 8,207 dollar amounts as pesos (1,535× too cheap), with no warning. **After:** 0 created and 8,207 rows held ("Otra moneda"). Updating an existing catalog: 816/816 dollar rows held; 1,359/1,363 peso rows applied. **The dollar rows cannot be processed** unless the file is split |
| **IVA per row** (AS, Cambre, JB) | 10.5% items mixed with 21%: 13.2% of AS rows, 13.6% of Cambre, ≈6% of JB | One IVA rate per supplier (per-product override only by editing the product) | AS: 1,450 products created with a sale price **9.5% too high** (median price/cost equal for 10.5% and 21% rows). **Silent. OPEN** |
| Two price columns (ALMA MODELO) | "Precio" = 0.5494 × "PRECIO" | Picks CORRELATIVA's single price, which equals "PRECIO" | Which one is the store's cost is **AMBIGUOUS** (discount? price before markup?) |
| Explicit net price (ALMA Peugeot) | Header "precio_sin_iva" | Uses it; the supplier setting "incluye IVA" must be left off | Correct if configured correctly |
| Pack columns | Camba "Cant.1" (min. pack), Cambre B "U/ PACK" | Detected as pack; not applied unless "precio por bulto" is enabled | Camba prices are per unit, so the default is right. Cambre: per unit or per pack is **UNKNOWN** |
| Unit of measure | Strada "Precio × m", sold by 25 m roll | No multiplier (only a pack divisor) | The store must know; the roll price is **not** computed |
| Placeholder prices | Camba: 5 × $0, 67 × ≤ $1 | $0 is flagged "Sin precio"; $1 is taken as real | With an existing cost: flagged "¿Error en la lista?" (ratio ≤ 0.2). **Bulk-creating from the list creates 66 products at ≤ $1** |
| "Consultar" / missing price | AS 2, Cambre 6, Strada 3 | Flagged "Sin precio", not applied | Correct |
| Text prices | "$ 34.514,49" (medicines) | `parseNumber` | 162/162 equal to an independent parse |
| Float noise | Camba: 9,713 prices with > 2 decimals (19.24790999…) | Rounded to cents; 1-cent tolerance | Correct |
| Discounts / bonificaciones | **No list states one** | Cascaded discounts per supplier (unit-tested) | **UNKNOWN on real data** |
| Margins / rounding | Not in lists | Markup/keep-margin and round-up (unit-tested) | Not exercised by the lists |

## 7. Matching Results (Level 3)

Script: `scripts/research/real-matching.ts`. Identity ground truth is the supplier's own code string (trimmed,
upper-cased).

**M1 — Punctuation collisions inside one real list.** SYNTHETIC BENCHMARK catalog:

- the store carries only one product of each pair of codes that differ only in punctuation;
- the other product appears earlier in the list;
- plus controls taken from every 40th row.

| List | Colliding pairs | Before F1: wrong product (applied by default) | After F1 | Controls right |
|---|---:|---|---|---|
| Camba | 193 | **193 (62)** | 0 (193/193 right) | 252/252 |
| JB | 93 | **93 (20)** | 0 (93/93) | 541/541 |
| AS | 2 | **2 (1)** | 0 (2/2) | 276/276 |

**M2 — Same supplier, old vs new description** (Camba "Codigos Viejos" vs the current list). SYNTHETIC BENCHMARK
catalog = the old sheet: 11,448 products, old descriptions, coded by the supplier's code.

- **Truth:** 10,229 shared codes, 107 new, 1,219 only in the old sheet; 2,445 shared codes changed their description.
- **Remarcá:**
  - 10,231 matched: all 10,229 shared codes to the right product, 0 wrong. The 2 extra rows are "81.R.3.75" vs
    "81.R.3,75", matched loosely and **held for review**.
  - 110 unmatched: 105 new plus 5 second occurrences of repeated codes.
  - 1,217 "tuyos que faltan en la lista".
- **Manual labels on 100 random changed descriptions**
  ([gold file](../scripts/research/gold/camba-description-change-labels.json)):
  - **84 CORRECT:** same product, text rewritten. 95% CI 75.6–89.9%.
  - **16 AMBIGUOUS:** a specification in the text changed — thread standard (USS→BSW, WTH→UNC), finish, head size,
    or one length (1/2×8 → 1/2×7.1/2).
  - 0 INCORRECT (95% CI 0–3.7%).

  **Remarcá applies all of them by default and does not show the old description next to the new one.**

**M3 — Description only** (what a matcher Remarcá does *not* have would do on the same 2,441 changed descriptions):

- **Naive** (best token overlap): 30 right (1.2%). 2,140 wrong picks were a sibling in the same family (another
  length); 2,292 had a tie at the top.
- **Guarded** (every size or grade token must match; abstain on ties): 77 right, **463 wrong**, 1,901 abstained.
  Precision is 14% when it answers.

**M4 — Supplier change: AS (old) → JB (new)** through the manufacturer code. AS "Cód.Alter" equals a JB code for
1,254 of 10,820 AS items.

| Store catalog variant (SYNTHETIC BENCHMARK) | Matched | Applied by default | Held |
|---|---:|---:|---:|
| Own code = manufacturer code, products assigned to AS (supplier code = AS code) | **0** | 0 | — |
| Own code derived from AS's code, products assigned to AS | **0** | 0 | — |
| Own code = manufacturer code, products **not** assigned to a supplier | 1,272 (1,249 identical + 23 loose) | 741 | 145 "Coincidencia dudosa", plus the dollar rows held |

Remarcá matches across suppliers only through the store's own code, and only for products without a supplier or
of the same supplier (by design).

**Manual gold standard** ([gold file](../scripts/research/gold/as-jb-labels.json)): 170 random identical-code pairs
plus all 29 loose pairs, labeled by reading both descriptions (non-expert reviewer).

| Codes | CORRECT | AMBIGUOUS | INCORRECT |
|---|---:|---:|---:|
| Identical (170) | 164 (96.5%, CI 92.5–98.4) | 5 (2.9%) | 1 (0.6%, CI 0.1–3.3) |
| Equal only ignoring punctuation (29) | 7 | 2 | **20 (69%)** |

What Remarcá did with them (final code):

| Codes and label | Applied by default | Held |
|---|---:|---:|
| Identical, CORRECT (164) | 92 | 16 "Coincidencia dudosa"; 56 in dollars |
| Identical, AMBIGUOUS (5) | 4 | 1 |
| Identical, INCORRECT (1) | 1 | 0 |
| Loose (29) | 0 | 23 held; 6 not matched because ambiguous |

**Precision among auto-applied rows in the sample:**

- 92/97 = 94.8% correct (CI 88.5–97.8);
- 1 incorrect: code "B21", a generic short code used by two brands;
- 4 ambiguous.

## 8. False Positive Analysis

Real families found in the lists. Codes shown are the suppliers' own.

| Family | Real example | Remarcá now |
|---|---|---|
| Punctuation only | `1.5.12` bolt 3/16×1/2 ($19) vs `15.12` self-locking nut 1/2 ($151) — Camba, 193 pairs | Different products (F1) |
| Decimal point in a size | `UN2.5CCE` cable 2.5 mm² ($832) vs `UN25CCE` cable 25 mm² ($8,861) — JB | Different (F1) |
| Decimal point in a current range | `3SR8-13-2.5` relay 1.6–2.5 A vs `3SR8-13-25` relay 17–25 A — AS vs JB | Loose only: held |
| Space only | `INT050234` emergency stop vs `INT 050234` thermal relay — AS | Different (F1) |
| Hyphen only | `AL150` photocell vs `AL-150` aluminium terminal; `F103801` (BAW fuse) vs `F/1038-01` (Zoloda fuse) — JB | Different (F1) |
| Generic short codes across brands | `B21`, `C-03`/`C03` (water heater vs ring terminal), `A02`, `E-04`, `FT 32`/`FT-32` | Identical `B21` **was applied** (1 in 170). Loose ones held |
| Words as codes | `VERDE`, `COLORADO` used as codes for 6 mm and 25 mm ferrules (AS alt codes = JB codes) | Correct in the sample; fragile by nature |
| Same code, two products in one list | `105.5` = "VARILLA WHIT 2" ($762) and "VARILLA WHIT 3/16" ($1) — Camba | Both held (F2) |
| Same code, contradicting descriptions across suppliers | `KL04105N` "acople recto" vs "codo interno"; `CR8802-37-56` floor vs table lamp | **Applied by default** (identical code): 4 of 5 ambiguous were applied |
| Sizes and lengths (the requested bolt families) | Old "3/16x1/2" → the naive description matcher picked "3/16x2.1/4" (M3) | Remarcá never matches by description, so it cannot happen |
| Price of a sibling product (PDF blocks) | `212.5` (bichromated) read with `12.5`'s price (polished), 13% lower — Camba PDF | Paired with the right price (F5); 6 plausible wrong prices remain in Camba PDFs |

The requested "Tornillo 8x40 / 8x50 / x100 / x200, Mecha 10mm HSS/SDS, Cable 2.5 mm 100 m/200 m" families all exist
in these lists as different codes. Remarcá matches only by code, so they collide only through the code shapes above.

**Net (FACT):** 0 wrong auto-applied matches remain in M1–M2. In M4 1 in 97 auto-applied rows was wrong and 4 in 97
were ambiguous, all with **identical** codes: no normalization can prevent those.

## 9. Ambiguous Cases

1. **Two prices, no explanation:** ALMA MODELO "Precio" vs "PRECIO" (factor 0.5494).
2. **Currency and IVA per row:** JB and AS.
3. **Which code column to use:** Camba "Codigo ID" vs "Referencia interna". Both headers look like codes; the first
   is a legacy ID, missing for new products.
4. **Same code, text changed:**
   - 16% of Camba's changed descriptions change a specification (§7 M2);
   - 5 in 170 cross-supplier pairs contradict each other (§7 M4).
5. **Code spelling changed between versions:** Camba `81.R.3,75` → `81.R.3.75`. Probably the same cotter pin, since
   the descriptions agree; held for review.
6. **The supplier's own files disagree:** Camba PDF `110.32` at $1,845.34 vs Sábana at $2,050.26 on the same date.
7. **Unit:** Cambre's unlabeled pack column; Strada's price per metre.
8. **"Lista publico":** JB labels its list as a public list. Whether it is a store's cost is **UNKNOWN**.

## 10. New/Discontinued Products

- **Camba** (current list vs old-code sheet):
  - **New:** 107 in truth; 105 flagged "No está en tu catálogo", plus 2 whose spelling changed, held.
  - **Only in the old sheet:** 1,219 in truth; 1,217 reported "faltan en la lista".
  - **With the auto-detected column** (before F6), the 107 new products were among the 113 silently skipped rows, so
    **Remarcá would have reported 0 new products**. Now the review states how many rows were not read, but the
    detection still picks "Codigo ID".
- **"Discontinued" is not proven:**
  - The old sheet is a code map, not a previous price list, so whether the 1,219 are discontinued is **UNKNOWN**.
  - AS marks discontinued items in a status column ("Baja $": 16 rows); JB and Camba PDFs print "DISCONTINUADO" in
    some places. Remarcá reads none of these markers.
- **No consecutive versions** of the same list were available for any other source (§2).

## 11. Excel Comparison

No human was timed. Human times are **UNKNOWN**. Remarcá's machine times are measured (§13).

| Task | Excel by hand (BUSCARV/VLOOKUP) | Remarcá on these files | Human time |
|---|---|---|---|
| Import | Opens every XLS/XLSX here. PDFs need copy-paste or conversion; ZIPs must be unzipped | 7/7 spreadsheets; 1/6 PDF lists; ZIP not accepted | UNKNOWN |
| Detect columns | A person reads the header: trivial for a human, including "Artículo" over descriptions and repeated blocks | Automatic on 6/7; Camba needs a choice; F3 and F5 were bugs | UNKNOWN |
| Compare prices | VLOOKUP by code plus a % column; punctuation collisions only if the person strips punctuation | Automatic, exact code; collisions handled (F1) | UNKNOWN |
| Detect new | `#N/A` from VLOOKUP | Automatic (§10) | UNKNOWN |
| Apply margin | One formula | Rules per supplier and keep-margin mode | UNKNOWN |
| Apply IVA | **One formula can read the IVA column row by row** | One rate per supplier (§6): **Excel is better here** | — |
| Currency per row | **One formula with the currency column** | Held, not converted: **Excel is better here** | — |
| Review changes | Filters and conditional formatting | Review screen with flags: big changes, below cost, suspect, duplicate, dubious match | UNKNOWN |
| Export | Save as CSV | Export for the POS, labels, undo | UNKNOWN |

## 12. Competitor Comparison

Public sources only. Statuses:

- **CONFIRMED:** stated on the vendor's own page or documentation.
- **NOT CONFIRMED:** not found in the sources read. **This does not mean the product lacks it.**
- **UNKNOWN:** no usable source.

| Capability | Remarcá (measured here) | Multilistas | Líder Gestión | Tango (Axoft) |
|---|---|---|---|---|
| Excel as sent by the supplier | Yes (7/7) | **CONFIRMED** ("Subís el Excel tal como te lo manda el proveedor, el sistema reconoce las columnas") | NOT CONFIRMED: requires columns `CODIGO` and `PRECIO` | **CONFIRMED with a fixed layout** (column A code, B description, H unit, "Sinónimo" column) |
| PDF | 1/6 lists correct | NOT CONFIRMED | NOT CONFIRMED | NOT CONFIRMED |
| Preview before applying | Yes | **CONFIRMED** ("te muestra el resultado antes de aplicar") | NOT CONFIRMED | **CONFIRMED** (grid with previous values and colours) |
| Matching by supplier code | Yes, exact | UNKNOWN (lists are searched, not matched: "Un solo buscador para todos tus proveedores") | **CONFIRMED** (código, código de barras, otros códigos) | **CONFIRMED** ("Sinónimo" vs article codes; manual linking of the rest) |
| Unmatched rows shown for manual linking | Yes | UNKNOWN | NOT CONFIRMED | **CONFIRMED** |
| Discounts / bonificación | Per supplier, cascaded (not exercised by real lists) | **CONFIRMED** ("descuentos por lista") | NOT CONFIRMED | **CONFIRMED** (bonificación per article-supplier) |
| Currency per row | **No** (held) | NOT CONFIRMED | NOT CONFIRMED | UNKNOWN |
| IVA per row | **No** | NOT CONFIRMED | NOT CONFIRMED | UNKNOWN |
| Purchase unit / pack | Pack divisor per supplier | NOT CONFIRMED | NOT CONFIRMED | **CONFIRMED** (purchase unit vs stock unit) |
| Automatic backup / undo | Undo per list | **CONFIRMED** ("copia de seguridad automática") | NOT CONFIRMED | UNKNOWN |
| Export to another system | Yes | NOT CONFIRMED | n/a (it is the POS) | n/a (it is the ERP) |

Sources, all fetched 2026-09-24:

- [multilistas.com.ar](https://www.multilistas.com.ar/): home page.
- [Wynges Academia — Actualizar precios Excel](https://wynges.com/Academia/modulo-actualizar-precios-excel/)
  (Líder Gestión).
- [Axoft — Compras, Administrador de Precios, Importar Listas (PDF)](https://www.axoft.com/img/asistencia/compras/Compras_Administrador-de-Precios-Importar-Listas.pdf):
  Last-Modified **2011-06-22**, so it may be outdated.

None of the competitors could be run on these files. How they would score is **UNKNOWN**.

## 13. Performance

Setup (script `real-scale.ts`):

- **Rows:** real code/description/price rows from JB and AS, written as XLSX. Version 2 = every price +4%
  (SYNTHETIC BENCHMARK change on real rows).
- **Path:** the product path with parsing in a worker thread, as in production.
- **Runs:** one process per size, 3 runs each, medians.
- **Machine:** 4 vCPU, 16 GB, Node 22.

| Rows | File | First list: upload+parse / compute / create all | Total | Next list: upload+parse / compute / apply | Total | CPU (both lists) | Peak RSS (baseline ≈120 MB) | Errors |
|---:|---:|---|---:|---|---:|---:|---:|---:|
| 100 | 30 KB | 250 / 4 / 4 ms | 0.26 s | 224 / 4 / 4 ms | 0.23 s | 0.7 s | 170 MB | 0 |
| 1,000 | 174 KB | 256 / 19 / 23 ms | 0.30 s | 283 / 20 / 14 ms | 0.31 s | 0.9 s | 185 MB | 0 |
| 10,000 | 1.7 MB | 466 / 156 / 227 ms | 0.85 s | 665 / 201 / 121 ms | 1.00 s | 2.2 s | 294 MB | 0 |
| 32,892 | 5.6 MB | 849 / 521 / 863 ms | 2.27 s | 1,532 / 726 / 458 ms | 2.68 s | 5.6 s | 527 MB | 0 |

Other observations:

- **Real legacy XLS files:** AS (9.3 MB, 11k rows) 4.6 s; JB (10 MB, 22k rows) 3.9 s in-process.
- **Upload cap:** the 12 MiB cap is **close**, since JB's file is at 80% of it. A slightly larger legacy XLS would be
  rejected (**risk**).
- **Rows not updated at +4%:** 391 of the 32,892 rows. These are prices of a few cents, where +4% is within the
  1-cent tolerance (by design).
- **Rows not created:** 6, all repeated codes.
- **Concurrency** (several stores uploading at once on a small VPS): not tested, **UNKNOWN**.

## 14. Failure Cases

| # | Failure | Where | Severity | Status |
|---|---|---|---|---|
| 1 | Wrong product through punctuation-only code collisions | Camba 193, JB 93, AS 2 pairs | Critical: wrong price applied | **Fixed (F1)** |
| 2 | Dollar rows stored as pesos when creating the catalog | JB 8,207 rows | Critical: silent | **Guarded (F4)**; conversion not supported |
| 3 | Sibling product's price paired with a code | Camba PDF blocks (61 rows on one page) | Critical: plausible, not flagged | **Fixed (F5)**; 6 plausible wrong prices remain in Camba PDFs |
| 4 | Code and description swapped under an "Artículo" header | ALMA PDF (429 rows) | High | **Fixed (F3)** |
| 5 | Repeated code with different prices: the first price applied | Camba 3 codes | High | **Fixed (F2)** |
| 6 | New products silently dropped (wrong code column) | Camba 113 rows | High | **Visible now (F6)**; the detection still picks "Codigo ID" |
| 7 | IVA 10.5% items priced with 21% | AS 1,450, Cambre 69, JB ≈1,300 | Medium: over-pricing 9.5%, silent | **OPEN** |
| 8 | PDF layouts with 2–3 products per line, matrices or catalogues | JB, Camba ×37, Roker, Jeluz | High for the PDF pitch | **OPEN** (refused or partial) |
| 9 | Placeholder $1 prices created as real | Camba 66 rows | Medium (only when bulk-creating) | OPEN |
| 10 | Description changes of the same code applied without showing them | Camba 2,445 codes; 16% change a spec | Medium | OPEN (no feature added) |
| 11 | Identical code, different or contradicting product across suppliers | 1 incorrect + 4 ambiguous auto-applied in 97 | Medium | OPEN (cannot be detected by code) |
| 12 | ZIP not accepted, with a misleading "damaged file" message | Camba | Low | OPEN |
| 13 | Printed/side-by-side sheet in a workbook | JB | Low (a tabular sheet exists) | OPEN |

## 15. What Remarcá Does Well

- **Reads real spreadsheets exactly:**
  - 48,262 rows from 7 lists with 0 wrong prices (3 codes the list repeats with different prices are held);
  - letterheads, headers on row 4–14, 42-column sheets, legacy XLS, non-breaking spaces, 13-decimal floats,
    "$ 34.514,49" text, and priceless rows flagged.
- **Matches the same supplier's next list by code:** 10,229/10,229 with 0 wrong, regardless of description rewrites.
- **Finds new and missing products** when the right code column is used.
- **Refuses instead of guessing** when there is no code column:
  - the medicines control;
  - ALMA MODELO;
  - 27 Camba pages;
  - Roker.
- **Holds, rather than applies**, the dangerous cases:
  - implausible price ratios;
  - loose code matches;
  - repeated codes with conflicting prices;
  - rows in another currency.
- **Is fast enough:** 33k rows in under 3 s per list.

## 16. What Remarcá Does Poorly

- **PDF:** 1 in 6 lists correct. The "PDF too" differentiator (docs/04, docs/19 §12) is **not supported** by this
  evidence for real Argentine layouts (blocks, matrices, catalogues).
- **Per-row currency and IVA:** they exist in 2 of 3 electrical sources. Remarcá's per-supplier model cannot represent
  them. This is not a detail: it decides whether electrical stores can use it at all.
- **Code column choice when a list has two code-like columns** (Camba), and **secondary sheets** (JB printed layout,
  ALMA MODELO).
- **Supplier change:**
  - 0 automatic matches unless the store's own code is the manufacturer code and products are not tied to a supplier;
  - otherwise everything is manual.
- **Description-only lists:** not supported; building a reliable description matcher looks hard (M3).
- **Shows no description diff** when a code's text changes (§7 M2).

## 17. Commercial Implications

These update docs/19 and docs/17; they are evidence, not customer validation.

1. **Technical risk R5 moves from "unknown" to measured.**
   - Spreadsheets with supplier codes: supported.
   - PDFs: largely unsupported.
   - Mixed currency/IVA: unsupported but now safe.
   - Pitch "subí la lista como te llega" is honest **only for spreadsheets**.
2. **Segment fit differs by vertical** (ASSUMPTION: the public lists are representative of the lists stores get):
   - **Bulonería and autopartes** (Camba Sábana, ALMA): fit well.
   - **Electricidad** (JB, AS, Cambre): mixes currency and IVA per row. Remarcá needs per-row currency/IVA support
     before it can be sold to electrical stores. Build only after GO (docs/19 §15).
3. **The onboarding risk (docs/19 R22) is confirmed by M4.**
   - Without shared codes, every product must be linked by hand.
   - A store that changes supplier gets **0** automatic matches.
   - Description matching is not a shortcut (M3).
4. **Excel beats Remarcá** on per-row IVA/currency with a single formula (§11). Remarcá's advantages are:
   - collision-safe code matching;
   - review flags, undo and export;
   - speed on large lists.

   Those are **convenience and safety**, not a capability Excel lacks. This is consistent with docs/19's conclusion.
5. **Against Multilistas**, the only clearly public head-to-head point was "Excel as sent + preview", which both have.
   Remarcá's PDF advantage is weak (point 1). Nothing here changes docs/19's **NO-GO for building without
   behavioural validation**.
6. **What a paying test should promise:**
   - "spreadsheets with codes, one currency";
   - PDFs and mixed-currency lists "on request" (concierge).

   This is a narrower promise than the landing page's.

## 18. Remaining Unknowns

- **Representativeness:** are public lists downloaded from websites like the files stores receive by WhatsApp or
  email? Private lists could be messier (scans, photos) or cleaner. UNKNOWN.
- **Version-to-version behaviour:** real price-change distributions and code renames across months. Only Camba's
  old-code sheet is available. UNKNOWN.
- **Store catalogs:**
  - how many stores keep supplier codes;
  - in which namespace;
  - how clean they are.

  UNKNOWN (docs/19 A3).
- **Whether JB's "Lista publico" is a cost** for any store. UNKNOWN.
- **Human time** per task in Excel and in Remarcá. UNKNOWN (not measured with people).
- **Competitors' actual results on these same files.** UNKNOWN.
- **The share of PDFs among the lists stores receive.** UNKNOWN; it decides whether failure #8 matters.
- **Concurrency and memory** on the target VPS under simultaneous uploads. UNKNOWN.
- **Label quality:** the gold labels come from one non-expert reviewer. Ambiguous cases may be real errors or
  harmless rewrites.

## 19. Recommended Next Experiment

**Re-download the same six sources after their next monthly update** and run a true version-to-version benchmark.
Observed cadence: Camba 30-08, AS 22-09, JB 20-09, ALMA 01/04-09. Suggested date: from 2026-10-24.

- **Cost:** about 1 hour of machine time. `fetch-real-lists.sh` reports which hashes changed.
- **What it measures:**
  - the real distribution of price changes;
  - code renames and punctuation changes;
  - new and discontinued items confirmed by two consecutive lists;
  - Remarcá's precision on its core job (next list of the same supplier), which this benchmark could only
    approximate with Camba's old-code sheet.
- **Success criteria, fixed now to avoid moving the goalposts:**
  - 0 wrong auto-applied matches;
  - more than 99% of shared codes matched;
  - every code rename either held or unmatched, never applied to another product.

**In parallel**, the behavioural screening of docs/19 §14 remains the decisive test. This benchmark can say whether
the product works on files; it cannot say whether anyone will pay.

When the screening happens, ask each store for **one real list and its catalog export**, with permission. Run them
through the same scripts. Report separately:

- spreadsheet lists vs PDF lists;
- single-currency lists vs mixed-currency lists.
