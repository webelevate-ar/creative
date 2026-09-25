# 22 — Market Validation from Public Evidence

Date: 2026-09-25. Question: **is there enough public evidence to justify spending more Claude credits on Remarcá, or
should the hypothesis be dropped?**

How to read this document:

- Everything comes from the **public web**, read on 2026-09-24/25. **No store, supplier, employer or freelancer was
  contacted.**
- **No customer, interview or payment exists.**
- Labels:
  - **FACT:** a sourced statement, read on a primary page.
  - **OBSERVED:** measured by us on public files or pages.
  - **ASSUMPTION:** chosen by us, unverified.
  - **ESTIMATE:** derived from other inputs.
  - **UNKNOWN.**
- **OBSERVED PUBLIC DATA** (what we counted) is kept apart from **MARKET-WIDE UNKNOWN** (what it would mean for all
  Argentine suppliers and stores). The 45 lists are the ones a web search found. **They are not a representative
  sample**, and no percentage here is a market share.
- A job posting is evidence that **the work is paid**. It is not evidence that anyone would pay for Remarcá.
- No product code was changed. Only research scripts and data files were added.

Data and scripts (third-party files are not committed):

| File | Content |
|---|---|
| [`scripts/research/public-lists-sources.json`](../scripts/research/public-lists-sources.json) | URLs of every list and every older version used |
| [`scripts/research/public-lists-dataset.json`](../scripts/research/public-lists-dataset.json) | One hand-labelled record per supplier (Experiments 2–3) |
| [`scripts/research/public_lists_inspect.py`](../scripts/research/public_lists_inspect.py) | Independent reader: format, headers, samples, currency/IVA/date signals |
| [`scripts/research/public-lists-remarca.ts`](../scripts/research/public-lists-remarca.ts) | What Remarcá's automatic detection extracts from each file |
| [`scripts/research/public_lists_stats.py`](../scripts/research/public_lists_stats.py) | Prevalence tables (§4–§6) |
| [`scripts/research/price_changes.py`](../scripts/research/price_changes.py) | Version-to-version price changes (§7) |
| [`scripts/research/paid-work-evidence.json`](../scripts/research/paid-work-evidence.json) | Job postings, freelance projects and service offers (§2) |

---

## 1. Executive Summary

**Respuesta a la pregunta final: no.** La evidencia pública **no** justifica gastar más créditos de Claude en
Remarcá. Tampoco la mata del todo. Lo que falta saber no se averigua con más código ni con más investigación de
escritorio:

- si alguien paga;
- en qué formato llegan las listas que los comercios reciben en privado.

**Recomendación: dejar de invertir créditos en Remarcá** y usarlos para buscar otra oportunidad. La única prueba que
queda cuesta tiempo del fundador, no créditos (§15). Es opcional y tiene fecha límite.

docs/21 §17a fijó **antes** de mirar los datos tres reglas para estas pruebas. Resultado:

| Prueba | Regla fijada en 21 §17a | Resultado observado | Veredicto |
|---|---|---|---|
| 1. ¿Ya se paga por este trabajo? | ≥ 10 avisos en 30 días **y** ≥ 3 ofertas de servicio con precio → evidencia de pago | **Avisos:** 16 en una sola foto de ≈ 8 días (6 hablan claramente de listas de proveedores). **Servicios con precio para actualizar listas en Argentina:** 0 verificados | **Cumple a medias.** El trabajo se paga dentro de un sueldo administrativo. No se ve un mercado de servicio tercerizado |
| 2. Calidad de las listas | < 50% en planilla con códigos → la zona rentable es demasiado chica y pesa hacia abandonar | **33%** (15/45). 34% en los rubros objetivo. 43% entre proveedores que publican su propia lista | **Falla** |
| 3. Dispersión de aumentos | Rango intercuartil < 2 pp → un aumento general alcanza y el valor es solo tiempo | CAL 0,07 pp; Colihue 3,6–6 pp, con error > 5% en solo 6–10% de los ítems; Neopel 0–21 pp por mes y 51 pp en 18 meses | **Depende del proveedor** |

Ninguna de las tres apoya la hipótesis con claridad. La tercera la apoya solo para proveedores como Neopel. La
segunda la contradice según su propia regla.

**¿Se paga por este trabajo?** Sí, pero como una tarea más dentro de un puesto (OBSERVED, §2):

- 16 avisos de Computrabajo mencionan listas de precios.
- Sueldos publicados: ARS 1,0–1,6 M por mes.
- Escala CCT 130/75 de septiembre 2026: Administrativo A ≈ ARS 1,32 M (FACT).
- Ningún aviso es un puesto dedicado a las listas, ni pide un servicio externo.
- En los ≈ 20 avisos de ferreterías, ninguno menciona listas. Son puestos de venta.

**¿Qué tan grande es la zona "buena"?** Entre las 45 listas públicas (OBSERVED, §4–§5):

- planilla + código + precio + fecha reciente + una sola moneda: **8 (18%)**;
- además con señales de que se reedita: **4 (9%)**;
- solo en PDF: **29 (64%)**. Remarcá lee bien **2 de esas 29**.

**¿Alcanza con un aumento general?** Depende del proveedor (OBSERVED, §7):

- Cámara del Libro y Colihue suben casi parejo: un porcentaje general erra por más de 5% en solo 4–10% de los
  productos. Dosos declara aumentos parejos por familia.
- Neopel no sube parejo. Mes a mes, un aumento general erra por más de 5% en **11–49%** de los productos. En 18 meses,
  en el **82%**.

**Sustitutos** (§8; FACT, salvo Claude for Excel, que sale de resúmenes de búsqueda): son más baratos y mejoran
rápido.

- Claude for Excel viene incluido en el plan Pro (USD 20) desde enero 2026.
- Multilistas ya cubre el mismo rubro en Argentina.
- EmberPrice hace lo mismo que Remarcá para WooCommerce, desde julio 2026.
- Tiendanube documenta cómo subir todos los precios un porcentaje.

**Red team** (§13). La hipótesis «un servicio con Remarcá puede ser un negocio pequeño pero rentable» **no sobrevive
tal como está**. Sobreviviría solo si se cumplen cinco condiciones (§13.1). La principal: que las listas que los
comercios reciben en privado sean casi todas planillas con código. Los datos públicos no muestran eso, y esa
condición solo se mide hablando con comercios.

---

## 2. Paid Work Evidence

### 2.1 Job postings (Computrabajo Argentina)

**Method (OBSERVED):**

- Three public search pages were fetched once on 2026-09-25: *listas de precios*, *actualización de precios* and
  *ferreterías*.
- Every offer linked from them was fetched: **56 unique offers**.
- Each was searched for price-list duties.
- Dates are Computrabajo's "actualizada" labels (17–25 Sep 2026). **This is one snapshot, not the 30 days the rule
  asked for.**

**Result:**

- **16 of 56** offers mention price-list work.
- **0 of the ≈ 20 ferretería offers** mention it. Those are sales, warehouse and counter jobs.
- In **all 16**, the price-list duty is one bullet among several: invoicing, orders, suppliers, stock, collections.

| # | Role (location) | Employer as described | Salary as published | Quote | Side | Overlap |
|---|---|---|---|---|---|---|
| 1 | Administrativo/a de Compras (Resistencia) | "importante empresa" commercial / industrial | $3.000 (placeholder) | "Mantener actualizada la base de datos de proveedores y listas de precios." | Supplier lists | High |
| 2 | Administrativo/a Comercial y Contable (Parque Patricios) | Bazar, mayorista y minorista | **ARS 1.600.000** | "Gestionar la relación con proveedores: pedidos, listas de precios…"; "Actualizar precios de venta." | Supplier lists → sale prices | **High** |
| 3 | Comprador/a – Seguridad Electrónica (Flores) | Seguridad electrónica | — | "Actualización de listas de precios en control de stock" | Supplier lists → stock system | High |
| 4 | Responsable Compras, mayorista química/limpieza (Morón) | Mayorista | ARS 1.000.000 | "Mantener actualizada la información de proveedores, listas de precios y condiciones comerciales." | Supplier lists | High |
| 5 | Comprador – Industrial (Lomas del Mirador) | Fábrica de químicos de limpieza | — | "Mantener actualizados los registros, listas de precios y bases de proveedores." (Tango) | Supplier lists (purchasing) | Medium |
| 6 | Auxiliar de compras part time (Monserrat) | Cadena hotelera | — | "Gestión y actualización de proveedores y precios en el sistema de gestión." | Supplier prices | Medium |
| 7 | Administrativo/a Contable (Villa Martelli) | Droguería | ARS 1.500.000 | "Administrar listas de precios y colaborar en el análisis de costos y márgenes." | Ambiguous | Medium |
| 8 | Asistente Administrativo de Logística (San Justo) | Autopartista | ARS 1.350.000 | "Carga de precios." (Tango) | Ambiguous | Medium |
| 9 | Asistente Comercial (Agronomía) | "importante empresa" | — | "Carga y actualización de listas de precios, promociones, productos y condiciones comerciales." | Ambiguous | Medium |
| 10–16 | Ventas/facturación (farma ×2, Bejerman), analistas comerciales ×2, administrativo de ventas (fábrica), marketing, auxiliar técnico | Manufacturers / industry | — | "Actualizar listas de precios según indicaciones de la Gerencia de Ventas", "Controlar listas de precios, descuentos…", "Creación de flyers… listas de precios" | Own sales list / design / quotes | Low / none |

Full list with URLs: [`paid-work-evidence.json`](../scripts/research/paid-work-evidence.json).

**Tools named** (OBSERVED): Excel in 11 of the 16 ("Excel avanzado", "BUSCARV/BUSCARX"). Also Tango (2), Bejerman (2),
Zeus (1) and a generic ERP or "sistema de gestión". **PDF: 0 mentions. Product codes: 0 mentions.**

### 2.2 Freelance projects and service offers

| Source | Date | Country | Task | Pay | Overlap | Verified? |
|---|---|---|---|---|---|---|
| Freelancer.com "Vendor Price List Excel Macros" | ≈ 2012 | UNKNOWN | One macro per vendor: vendor price sheet "in their own format" → website inventory format; 100+ vendors | USD 30–250 per vendor macro | **High** (same job) but old | Primary page |
| Freelancer.com "Website Price List Data Entry" | ≈ Dec 2025, completed | UNKNOWN (AUD) | Copy ≈ 2,000 prices from its own website into Excel | AUD 250–750 | Low (one-off) | Primary page |
| Freelancer.com (3 more projects) | UNKNOWN | UNKNOWN | Supplier cost + markup report; InDesign catalog price update (1,300 items); Excel data entry | USD 15–25/h (one of them) | Medium | Search summary |
| Workana "Actualización de precios" and a Mexican supplier price comparison template | UNKNOWN | Spanish-speaking | Request supplier lists and keep prices updated | UNKNOWN | High | **HTTP 403**; search summary |
| Mercado Libre service listing | UNKNOWN | AR | Load products into Tiendanube / Empretienda | ARS 1,200 / product (800 above 50); advanced 1,800 | Low (initial loading) | Login wall; search summary |
| Fiverr (2 gigs) | UNKNOWN | International | Update barcode prices into Shopify; bulk CSV import | USD 15 and 25 | Medium | Search summary |
| Mi Asistencia Virtual; Tienda Negocio | UNKNOWN | AR | Catalog loading/updating for Tiendanube, MercadoShop, Wix, WooCommerce; bulk loading | Not published | Medium / low | Search summary |

**Wage anchor (FACT, [Perfil, 2026-09-03](https://www.perfil.com/noticias/economia/dia-ferretero-cuanto-cobran-empleados-sector-segun-escala-septiembre-a35.phtml)):**

- CCT 130/75, September 2026, Administrativo A: ARS 1,196,632 basic + 120,000 non-remunerative = **ARS 1,316,635**.
- Administrativo F: ARS 1,373,514.
- The salaries published in §2.1 (ARS 1.0–1.6 M) are in the same range.

### 2.3 What this does and does not show

- **FACT / OBSERVED:** companies pay people who, among other duties, keep supplier price lists and system prices
  current. The job exists in Argentina now, is done in Excel plus an ERP, and is named in job ads.
- **OBSERVED:** the payment is **bundled into a salaried role**. Nobody hires just for this. We found no Argentine
  offer of an outsourced "we update your price lists" service with a published price.
- **Not shown:**
  - that any employer would move this duty to an outside service;
  - that doing so would save money;
  - anything about Remarcá.

  The salary pays for the other bullets too. Removing one duty does not remove the salary (ASSUMPTION, but
  consistent with every posting).
- The employers in the four high-overlap postings are a bazar (mayorista y minorista), a cleaning-products
  wholesaler, an electronic-security company and an unnamed company in Resistencia. **None is a small store.**

---

## 3. 30+ Supplier Dataset

**Composition (OBSERVED):**

| Group | Lists obtained | Not usable |
|---|---:|---|
| Independent suppliers, new in docs/22 | 19 price lists + 1 catalog without prices (Repuestos Omar) | 3 unavailable (404 / no list); 2 excluded (Peru, Colombia) |
| Manufacturers republished by ACCME (electrical distributor), new in docs/22 | 18 | 5 dead links (HTTP 400/404/410) |
| docs/20 sources (4 independent + 4 via ACCME) | 8 | — |
| **Total price lists analysed** | **45** (37 new) | — |
| Not public | — | 7: login or password (Fercor, Dfer, Saniferr, Distribuidora del Oeste), "por email" (Transcaden), "contacte a su vendedor" (Rodamientos Caroya), broken Dropbox (Digilio) |

**Why this is not a representative sample:**

- The lists were found by searching for "lista de precios" pages. Suppliers that publish nothing are invisible to
  this method.
- The 7 behind a login, a password or "por email" show that some suppliers keep their lists private.
- One page (ACCME) contributes 22 of the 45 lists, all from one sector.
- Food and book lists entered because they appeared in the search; they are outside the target sectors. §4 also
  shows target sectors only.

**New suppliers (docs/22):**

| Supplier | Sector | Files | Code | Currency | IVA | Date | Versioning evidence | Remarcá automatic |
|---|---|---|---|---|---|---|---|---|
| [Neopel](https://neopel.com.ar/lista-de-precios/) | Papelera / embalaje | XLS + PDF | Yes | Not stated | Net and gross columns (21%) | 24-09-2026 | **A PDF every business day**; 88 older ones downloadable; XLS #14 → #17 | OK (XLS 3,087; PDF 2,790) |
| [Dosos](https://dosos.com.ar/listas-para-descargar/) | Sanitarios | 7 Google Sheets | Yes (no description, only size) | Not stated | Not stated | None | "Aumento" sheet: % per list 18 → 34 | Partial (side-by-side blocks) |
| [Martini S.A.](https://martinisa.com.ar/lista-de-precios/) | Autopartes / faros LED | XLS + PDF | Yes | $ | Not stated | 24-09-2026 | — | XLS OK (10,636); **PDF gives neighbour prices** |
| [Dist. Fátima](https://distribuidorafatima.com.ar/lista-de-precios/) | Alimentos | PDF | **No** | $ | "Incluyen IVA" | 08-09-2026 | — | 0 rows |
| [Colihue](https://colihue.com.ar/distribuidores/) | Editorial (B2B) | XLSX + CSV + PDF | Yes (internal, ISBN, barcode) | Not stated | Not stated | 01-09-2026 | Older lists downloadable | XLSX OK (1,970) |
| [COMSA](https://www.comsasanitarios.com.ar/) | Sanitarios / ferretería | PDF, 76 pages | Yes | Not stated | Not stated | 18-09-2026 | — | 0 rows (2 items per line) |
| [Ind. Saladillo](https://industriassaladillo.com.ar/) | Accesorios / válvulas | PDF, 80 pages, 18 MB | Yes | Not stated | Suggested retail with IVA; cost = list − discounts | LM 08-09-2026 | N/P/M change markers | **Rejected** (> 12 MB) |
| [Rotoplast](https://irp.cdn-website.com/299b0928/files/uploaded/LISTA%20DE%20PRECIO%20ROTOPLAST.pdf) | Tanques | PDF | Yes | $ | Net and gross columns | **Oct 2021** | — | 0 rows |
| [Barbiero](https://barbiero.com.ar/) | Material eléctrico | PDF, 206 pages | Yes | Not stated | "PRECIO SIN IVA" | 09-2026 | — | OK (4,692) |
| [Di Pietro](https://www.dipietrosrl.com.ar/) | Aislantes eléctricos | PDF, 109 pages | Yes (hierarchical) | $ column | Net and gross columns | 17-09-2026 | — | 0 rows |
| [Dipel](https://dipel.com.ar/) | Ferretería / corralón | XLSX (+ 1 password-encrypted XLSX) | Yes | Not stated | Not stated | LM 23-09-2026 | — | OK (4,633); two price columns |
| [Fedeli](https://fedeli.com.ar/) | Bulonería | PDF, **password-protected** | UNKNOWN | — | — | 15-09-2025 | — | Rejected |
| [Borcas](https://borcas.com.ar/) | Limpieza | PDF | Yes | $ | "No incluyen IVA" | LM 21-09-2026 | — | **Wrong: 1,295 rows with the pack quantity as the price** |
| [Casa ABE](https://casaabe.com.ar/) | Juguetería / librería | 2 PDFs, 369 pages | Yes | Not stated | "IVA INCLUIDO" | 18-09-2026 | — | OK (13,561 / 14,986) |
| [Todo Fiambres](https://www.todofiambres.com.ar/) | Alimentos | PDF | Yes | Not stated | Not stated | 24-09-2026 | — | Wrong (prices read as codes, price 0: visible) |
| [POSTA](https://grupohaedoweb.com.ar/) | Muebles de exterior | PDF catalog | No | $ | "No incluyen IVA" | 04-2026 | — | 0 rows |
| [Dist. del Sur](https://www.distribuidoradelsur.com.ar/tienda/lista_precios.php) | Alimentos | Web page only | No | $ | Not stated | 25-09-2026 | — | n/a |
| [La Fábrica](https://www.lafabrica.com.ar/) | Alimentos | PDF (promo layout) | No | $ | Not stated | 09-2026 | — | 0 rows |
| [Cámara Arg. del Libro](https://www.el-libro.org.ar/) | Libros | XLS | Yes (barcode) | Not stated | Not stated | **2023** | Old and new price columns | OK (2,656) |
| [ACCME page](https://accmelec.com.ar/lista-de-precios/): Atomlux | Eléctrico | XLSX | Yes ("Modelo") | Not stated | Not stated | **01-2025** | — | 0 rows (code column not found) |
| Cleos | Eléctrico | PDF | Yes | **USD** | + 10.5% | LM 18-09-2026 | — | 0 rows |
| Conextube | Eléctrico | PDF, 62 MB | Yes | $ | Net | 07-09-2026 | "Reemplaza a la lista 26031" | Rejected (size) |
| Emanal | Eléctrico | PDF | Yes | $ | Net | 08-2026 | — | 0 rows |
| Exultt | Eléctrico | PDF (font-encoded) | UNKNOWN | $ | — | LM 29-04-2026 | Catalog N°48 | 0 rows |
| Flexivolt | Cables | PDF | No | — | — | **11-2023** | — | 0 rows |
| Lumenac | Iluminación | XLSX | Yes (with spaces: "GALAXY 50/850") | "PRECIO EN PESOS" | — | LM 23-09-2026 | — | **0 rows** (code column not found) |
| MIG | Eléctrico | XLSX | Yes | — | — | LM 31-07-2025 | "#37 vigente desde…" | OK (80) |
| Milenium Led | Iluminación | PDF | Yes | **USD** | 10.5% / 21% per row | **2021** | N°21 | 0 rows |
| Prodem | Eléctrico | PDF (matrix) | Yes | — | — | 08-2025 | Nº 739 | Wrong (226 rows) |
| S-BOX | Eléctrico | PDF (font-encoded) | UNKNOWN | — | — | 2024 | N°47 | 0 rows |
| TAAD | Eléctrico | PDF, 15.5 MB, images | UNKNOWN | — | — | LM 28-07-2026 | — | Rejected (size) |
| TACSA | Eléctrico | **Scanned** PDF | UNKNOWN | — | — | LM 18-09-2026 | — | Rejected (no text) |
| Technic | Iluminación | XLSX (catalog) | Yes | — | — | LM 27-11-2025 | — | Partial (19) |
| TOP | Eléctrico | PDF, images | UNKNOWN | — | — | 01-2025 | — | 0 rows |
| Trefilcon | Cables | PDF | No | $ | — | 02-2026 | — | 0 rows |
| Trefilight | Cables | PDF | Yes | **Mixed** | "SIN IVA (10,5%)" | 08-2026 | N°46 | 0 rows |
| Viyilant | Eléctrico | PDF | Yes | **Mixed** | Not included; 10.5% per row | 14-09-2026 | Nº 03-2026 | 0 rows |

LM = HTTP Last-Modified. The docs/20 sources (Camba, AS, JB, ALMA; Cambre, Jeluz, Roker, Strada) are in the dataset
file with their docs/20 labels.

---

## 4. Spreadsheet + Code Prevalence

**OBSERVED PUBLIC DATA** ([`public_lists_stats.py`](../scripts/research/public_lists_stats.py)):

| Metric | Independent, new (n=19) | Independent, all (n=23) | ACCME (n=22) | **All (n=45)** | Target sectors (n=35) |
|---|---:|---:|---:|---:|---:|
| Publishes a spreadsheet (XLS/XLSX/CSV/Google Sheet) | 6 (32%) | 10 (43%) | 5 (23%) | **15 (33%)** | 12 (34%) |
| Product code present | 14 (74%) | 18 (78%) | 15 (68%) | **33 (73%)** | 27 (77%) |
| Code unreadable (scan, images, encoding, password) | 1 (5%) | 1 (4%) | 5 (23%) | 6 (13%) | 6 (17%) |
| **Spreadsheet + code + price** | 6 (32%) | 10 (43%) | 5 (23%) | **15 (33%)** | 12 (34%) |
| Recent (list or file date ≥ 2026-03-25) | 15 (79%) | 19 (83%) | 9 (41%) | 28 (62%) | 19 (54%) |
| Any versioning evidence | 5 (26%) | 7 (30%) | 8 (36%) | 15 (33%) | 12 (34%) |
| Older versions downloadable | 2 (11%) | 2 (9%) | 0 | 2 (4%) | 0 |
| **GOOD ZONE:** spreadsheet + code + price + recent + one currency | 4 (21%) | 7 (30%) | 1 (5%) | **8 (18%)** | **6 (17%)** |
| GOOD ZONE + versioning evidence | 2 (11%) | 4 (17%) | 0 | **4 (9%)** | 2 (6%) |

- **Good zone members:** Neopel, Martini, Colihue, Dipel, Camba, AS, ALMA, Lumenac.
- **Good zone + versioning:** Neopel, Colihue, Camba, AS.
- In target sectors, only **Camba and AS** combine both.
- Remarcá reads **Lumenac** as 0 rows. Its codes contain spaces. So the good zone is not the same as "Remarcá reads
  it" (§5).

**Frequency of spreadsheet + code + price + recurring update:**

- The full combination (good zone + versioning evidence) holds for 4 of 45 lists (9%).
- Versioning evidence alone appears in 15 of 45 (33%). For the rest, frequency is **UNKNOWN**. A recent date shows
  the list is maintained, not how often.
- Only Neopel shows its rhythm: a new PDF every business day. The median day changes **1.2%** of items.

**MARKET-WIDE UNKNOWN:**

- the share of Argentine suppliers that publish lists at all;
- the format suppliers **send to clients privately**. Two hints point in opposite directions:
  - Dipel publishes an open XLSX plus a password-encrypted one (clients seem to get Excel);
  - Fedeli publishes a password-protected PDF (clients get PDF);
- how the 45 lists map onto what a given store receives.

**docs/21 rule (§17a.2):** "< 50% of suppliers publish a spreadsheet with codes → the service's profitable zone is too
small; weighs toward Option 4."

- **Observed: 33% overall, 34% in target sectors, 43% in the most favourable group.**
- The rule is met on every cut. docs/21 had used 5 of 8 brands (63%) from docs/20, a smaller sample it already
  labelled "OBSERVED, biased".

---

## 5. PDF Prevalence

| Metric (OBSERVED PUBLIC DATA) | All (n=45) | Target sectors (n=35) | ACCME (n=22) |
|---|---:|---:|---:|
| Publishes a PDF | 35 (78%) | 27 (77%) | 17 (77%) |
| **PDF only** | **29 (64%)** | 23 (66%) | 17 (77%) |
| Web page only | 1 (2%) | 0 | 0 |
| Hostile file (scanned, images, font-encoded, password, > 12 MB) | 8 (18%) | 8 (23%) | 6 (27%) |

**Remarcá's automatic result, by best available file (OBSERVED):**

| Best file | n | OK | Partial | Wrong rows | 0 rows (safe) | Rejected |
|---|---:|---:|---:|---:|---:|---:|
| Has a spreadsheet | 15 | **10** | 3 | 0 | 2 | 0 |
| PDF only | 29 | **2** | 2 | 3 | 17 | 5 |

- **Spreadsheets:** 10/15 correct with no help. Three are partial (Dosos blocks, Camba column choice, Technic catalog).
  Two give 0 rows (Atomlux "Modelo", Lumenac codes with spaces). **No spreadsheet produced wrong rows.**
- **PDF-only lists:** 2/29 correct (Barbiero, Casa ABE). Three produce wrong rows:
  - **Borcas:** 1,295 rows with the units-per-bulto as the price. The rows look plausible. A large-change flag would
    probably catch them only when a previous cost exists. That was not tested.
  - **Prodem:** matrix layout.
  - **Todo Fiambres:** visibly broken.

  Five are rejected: 3 over the 12 MB cap (62 MB, 18 MB, 15.5 MB), 1 password, 1 scanned.
- docs/20 measured 1/6 PDF lists correct on a smaller set. The larger set confirms it.
- **Remarcá's PDF support does not cover the formats suppliers publish.** Of the 29 PDF-only lists, 25 (86%) need
  typing, another tool, or a request for a spreadsheet.

**MARKET-WIDE UNKNOWN:** whether PDF-only publishers send spreadsheets on request.

---

## 6. Currency/IVA Complexity

| Metric (OBSERVED PUBLIC DATA, n=45) | Count | Which |
|---|---:|---|
| Prices in USD (whole list) | 2 (4%) | Cleos, Milenium Led |
| **ARS and USD mixed in one list** | 3 (7%) | JB, Trefilight, Viyilant ("en pesos, a excepción de termocontraíbles… en dólares") |
| **IVA rate differs by product** (10.5% / 21%) | 5 (11%) | AS, JB, Cambre, Milenium Led, Viyilant |
| Net and gross price columns printed | 3 | Neopel, Rotoplast, Di Pietro |
| IVA not stated at all | 26 (58%) | — |
| Currency not stated (presumably pesos: ASSUMPTION) | 21 (47%) | — |
| List price is not the cost (a discount, bonificación or coefficient must be applied) | ≥ 6 | Saladillo (list = retail with IVA − discounts), MIG ("Descuento General"), Atomlux (per-product bonificación), Technic (coefficient 0.3266), Neopel (discount notes by bulto), Dosos (bonificación change) |

- **Every USD, mixed-currency and per-product-IVA case is in material eléctrico.** That is the sector with the most
  public lists (ACCME), so this may be sample composition.
- For these lists Remarcá still has one currency and one IVA rate per supplier (docs/20 §6):
  - USD rows are held;
  - 10.5% items are priced 9.5% too high, silently.
- Remarcá has cascaded discounts per supplier. **It has no per-product bonificación** (FACT, code:
  `src/services/suppliers.ts`, `src/lib/pricing.ts`).
- **MARKET-WIDE UNKNOWN:** how often a store's suppliers mix currencies or IVA rates.

---

## 7. Historical Price Changes

**Question (the hypothesis to test):** «Si casi todos los productos aumentan aproximadamente lo mismo, quizás el
cliente puede aplicar un aumento general y Remarcá tiene poco valor.»

**Metric.** Per product present in both versions (by supplier code): r = new / old. Take the median r, called m.

- "Within 2% of the median" means |r/m − 1| ≤ 2%.
- "Blanket error > 5%" means |r/m − 1| > 5%. It is the share of products that an across-the-board increase at the
  median would misprice by more than 5%.

**Sources:** only suppliers with public versions.

- **Neopel:** 88 dated PDFs.
- **Colihue:** Argentina Apr-2025 vs Sep-2026; Venezuela list Nov-2025 vs Sep-2026.
- **Cámara Argentina del Libro:** "PVP ANT" vs "PVP NVO" in one file.
- **Dosos:** declared increases.

The docs/20 sources cannot be re-measured before 2026-10-24.

### 7.1 Near-uniform suppliers

| Comparison | Items | Changed | Median change | p05 / p95 | Within 2% of median | Blanket error > 5% | Interquartile range |
|---|---:|---:|---:|---|---:|---:|---:|
| Cámara del Libro, PVP ANT → NVO (2023) | 2,651 | 98% | +10.0% | +9.8 / +10.2% | **95%** | 3.7% | 0.07 pp |
| Colihue AR, Apr-2025 → Sep-2026 | 1,876 | 100% | +40.2% | +36.6 / +47.6% | 65% | 6.3% | 3.6 pp |
| Colihue VE, Nov-2025 → Sep-2026 | 1,149 | 98% | +30.0% | +23.5 / +37.5% | 36% | 9.5% | 6.1 pp |

**Dosos** ("Aumento" sheet, FACT as declared by the supplier):

- one percentage per product family per list: tubes, fittings, fittings with metal insert;
- +4.5% to +10% per step, lists 18 → 34;
- one step where "se cambió la bonificación" (−0.55);
- one exception: "Boquillas (35%)".

For these suppliers **a blanket increase is almost as good**. Per product family for Dosos. The value of per-item
updating is mostly **time**, plus the few exceptions.

### 7.2 A non-uniform supplier: Neopel (papelera / embalaje, ≈ 2,600–2,740 products)

| Interval | Changed | New / removed codes | Median | p05 / p95 | Within 2% of median | **Blanket error > 5%** | > 10% | Decreased |
|---|---:|---|---:|---|---:|---:|---:|---:|
| 2025-03 → 2025-06 | 65% | 115 / 100 | +2.0% | −9.0 / +11.8% | 45% | **34%** | 10% | 12% |
| 2025-06 → 2025-09 | 68% | 111 / 107 | +4.1% | −8.3 / +21.6% | 13% | **47%** | 23% | 10% |
| 2025-09 → 2025-12 | 81% | 125 / 129 | +7.0% | −2.7 / +21.3% | 37% | **49%** | 14% | 5% |
| 2025-12 → 2026-01 | 28% | 70 / 95 | 0% | 0 / +6.0% | 74% | 11% | 3% | 5% |
| 2026-01 → 2026-02 | 44% | 75 / 73 | 0% | −3.7 / +9.9% | 57% | 33% | 7% | 6% |
| 2026-02 → 2026-03 | 27% | 55 / 103 | 0% | −5.0 / +7.7% | 73% | 17% | 3% | 13% |
| 2026-03 → 2026-04 | 63% | 127 / 79 | +5.0% | 0 / **+90.5%** | 14% | **39%** | 31% | 2% |
| 2026-04 → 2026-05 | 50% | 67 / 59 | 0% | 0 / +28.8% | 50% | **45%** | 32% | 3% |
| 2026-05 → 2026-06 | 37% | 60 / 45 | 0% | −9.4 / +8.0% | 64% | 19% | 8% | 9% |
| 2026-06 → 2026-07 | 32% | 55 / 61 | 0% | −5.0 / +7.4% | 68% | 15% | 6% | 7% |
| 2026-07 → 2026-08 | 27% | 68 / 49 | 0% | −6.7 / +6.0% | 76% | 15% | 4% | 10% |
| 2026-08 → 2026-09 | 24% | 87 / 52 | 0% | −7.0 / +8.0% | 77% | 14% | 8% | 7% |
| **2025-03 → 2026-09 (18 months)** | 99% | 393 / 351 | **+47.8%** | −2.4 / +128% | **4.6%** | **82.5%** | 65% | 6% |
| 2026-06-01 → 2026-09-24 | 71% | 177 / 150 | +2.9% | −10.0 / +15.1% | 8% | 45% | 18% | 19% |

- **Daily** (78 consecutive business-day pairs, Jun–Sep 2026):
  - 75 had at least one change;
  - median **1.2%** of items changed per update; maximum 9.4%.
- **Per product, Jun–Sep 2026** (2,274 products present every day):

  | Changes in the period | Share of products |
  |---|---:|
  | 0 | 30% |
  | 1 | 33% |
  | 2 | 20% |
  | 3 | 14% |
  | 4 or more | 3% |

- **Outliers:** p95 reached +90.5% in one month. About 6% of items were cheaper after 18 months.
- New and removed codes: 2–5% of the list per month. They need a decision whatever the update method.

### 7.3 Reading

- **OBSERVED:** both patterns exist:
  - near-uniform: Cámara del Libro, Colihue, Dosos by family;
  - dispersed: Neopel.
- For Neopel, the problem is not the size of the increase. **Different products change at different times.** A store
  that applies one percentage when it notices "Neopel subió" misprices a third to half of the items after a busy
  quarter, and most of them after a year.
- **docs/21 rule (§17a.3), IQR < 2 pp:**
  - Cámara del Libro: meets it.
  - Colihue: just above, but its blanket error is small.
  - Neopel: monthly IQR is 0 pp in 4 of 12 months. That is an artefact: ≤ 25% of items changed, so p25 = p75 = 0.
    Yet 11–17% of items were off by more than 5% in those months.

  **The blanket-error share is the better measure.** The IQR is reported because it was pre-registered.
- **Correlation, not cause:**
  - We do not know *why* Neopel's prices diverge: supplier costs, USD-linked items (Neopel published a "lista de
    productos de variación por cotización dólar" in 2023), promotions, or rounding.
  - We do not know whether its customers update per item.
  - Two uniform suppliers are books. Book prices in Argentina are set by the publisher per title, and uniform list
    increases are common there. **That may be a sector trait, not a general one** (ASSUMPTION).
- **What it means for the hypothesis:**
  - Per-item updating has real value **for dispersed suppliers**. The size of that value in margin is UNKNOWN (no
    store data).
  - For uniform suppliers, a blanket % is nearly free. Tiendanube documents exactly that workflow (§8).
- **MARKET-WIDE UNKNOWN:** the share of suppliers that behave like Neopel. **n = 4 versioned suppliers.**

---

## 8. Competitive Substitutes

(FACT unless marked. Items from docs/19 K5–K15 were re-checked where noted.)

| Substitute | What it solves | What it does not | Published price | Setup / human | Imports supplier lists | Bulk-updates prices | History | Works with codes |
|---|---|---|---|---|---|---|---|---|
| **Salaried admin with Excel + ERP** (status quo in the 16 postings) | Everything, including PDFs (by typing) and judgment | Speed; errors are silent | ≈ ARS 1.32 M/month (CCT A, §2), shared with other duties | Human | By hand / VLOOKUP | Via ERP | ERP-dependent | Yes |
| Excel / Google Sheets alone | Mapping by VLOOKUP, formulas, % increases | PDFs; audit; repeatability needs discipline | Sheets free; Excel license (not re-checked) | Skill needed | Manual | Formula | Manual copies | Yes |
| ERP / POS import (Tango "Administrador de Precios", Zeus "Modificación de Precios Avanzada", Líder `CODIGO;PRECIO`, GEOMA, Contabilium, Dux, COMIT) | Loading a prepared file; cost updates; multiple sale lists | Preparing a messy supplier file; PDFs | Dux from ARS 31.5 k+IVA; Contabilium 122–245 k+IVA; FeBePOS ARS 99,900/month (search summary) | Implementer or staff | Yes (fixed layout) | Yes | Some | Yes |
| **Multilistas** (AR, ferreterías / eléctricos / bulonerías) | "Subís el Excel tal como te lo manda el proveedor, el sistema reconoce las columnas y te muestra el resultado antes de aplicar"; recalculates up to 3 sale prices; invoicing | PDF not mentioned; you work inside its system | **Not published** (re-checked 2026-09-25) | Low | Yes | Yes (automatic) | Backup | Yes (search across lists) |
| **EmberPrice** (WooCommerce plugin) | Supplier XLSX/XLS/CSV import; auto-detects columns; matches by learned alias, SKU/GTIN, exact or fuzzy name; margin/VAT/rounding; preview old/new/%; rollback | WooCommerce only; PDF not stated | UNKNOWN (plugin page) | Low | Yes | Yes | Snapshots + rollback | Yes, and without codes |
| Tiendanube bulk CSV | Export → edit in Excel → import; documents "aumentar un porcentaje fijo de mis precios" | Supplier file mapping; ≤ 20,000 lines recommended; desktop only | Included in paid plans | Staff | No (own export) | Yes | No | Own SKU |
| Tiendanube AI connector (Claude / ChatGPT) | "Editar productos en forma masiva: cambiar precios", with approval | Online store only | Included (docs/19 K13) | Prompting | Via the AI | Yes | UNKNOWN | By prompt |
| syncX Stock Sync (Shopify) | Scheduled supplier feeds, markups | Shopify only; PDFs not stated | Free / USD 7 / 10 / 300 (**re-checked**) | Low | Yes (CSV/XLSX feeds) | Yes | UNKNOWN | SKU |
| Matrixify (+ Claude MCP) | Any supplier file "as-is", PDFs included, via Claude | Shopify only | USD 20 / 50 / 200 per 30 days (**re-checked**) | Prompting | Yes | Yes | Import logs | Barcode / SKU |
| **Claude for Excel** | Reads and edits workbooks with an assistant | No memory or audit by default; accuracy on these lists UNKNOWN | Included in Claude Pro (USD 20/month) since Jan-2026; Excel/Word/PowerPoint add-ins GA 2026-05-07 (secondary sources) | Prompting each time | Yes (what the user opens) | By prompt | No | By prompt |
| Copilot agent mode (Excel); ChatGPT for Excel | Same class | Same | M365 Personal/Family (K14); ChatGPT for Excel beta in US/CA/AU (K15) | Prompting | Yes | By prompt | No | By prompt |
| General agents (Claude Code, computer use) | Could run the whole pipeline, PDFs included | Needs a technical operator; no product | Plan price | Technical | Yes | Yes | If built | Yes |
| Admin services (VA, Fiverr, Mercado Libre) | Delegation | No Argentine priced offer for list *updating* found | USD 15–25 per gig (unverified); ARS 800–1,800 per product loaded (unverified) | Human | Human | Human | No | Human |
| Supplier-side portals (Commercy, docs/19 K18) | Client-specific price lists published by distributors | Only for suppliers who adopt them | UNKNOWN | Supplier | n/a | n/a | n/a | n/a |
| **Blanket % increase** | Free; nearly right for uniform suppliers (§7.1) | Wrong for 11–49% of items per month at Neopel (§7.2) | 0 | Minutes | No | Yes | No | No |

**EmberPrice** is the closest match to Remarcá found so far, in concept and features. It was added to WordPress.org on
2026-07-20. The WordPress.org API reports 0 active installs on 2026-09-25, which it shows as "fewer than 10".
This reads both ways:

- the idea is easy to copy;
- a copy got no visible traction in two months. That is too early to judge.

**«¿Qué tendría que ser suficientemente mejor de Remarcá para justificar pagar por él?»**

1. **PDFs.** Most public lists are PDF-only (64%). Remarcá reads 2 of 29. A general AI assistant at USD 20/month
   claims to read them. Its accuracy on these files is UNKNOWN and was not tested. Remarcá would have to read real PDF
   layouts reliably, which today it does not.
2. **Reliability without supervision.** No silent errors, clear holds, undo. Remarcá is good on this for spreadsheets
   with codes (docs/20: 0 wrong matches in 10,229). That is also the case where Excel VLOOKUP and ERP imports are
   strongest.
3. **Argentine price math per row.** Mixed currency, 10.5%/21% IVA, bonificaciones. Remarcá handles these per
   supplier, not per row. USD or mixed currency appears in 11% of public lists and per-row IVA in 11%. 7 lists
   (16%) have at least one of them, all electrical.
4. **No change of system.** Better than Multilistas for a store that will not switch POS. Its value is UNKNOWN.
5. **Delegation.** Someone else does it, with an audit trail. This is the only advantage the tools above do not
   commoditize, and it is a **service** property, not a software one.

**Quantitatively (ESTIMATE):**

- A service at ARS 50–75 k/month must replace ≥ 4–6 staff hours per month (ARS 11,875/h, docs/21), or protect a
  comparable margin.
- It must also be worth ≥ ARS 20–45 k/month more than "the owner + Claude Pro" (USD 20 ≈ ARS 31 k at 1,540).
- Today Remarcá is better than that pairing only on repeatable spreadsheet lists with codes. That is 18% of public
  lists.

---

## 9. Economic Implications

1. **The service's cost driver is input format** (docs/21 §5, §7, OBSERVED on synthetic stores).
   - In docs/21, medium store B had 25% PDF lists, read at docs/20's rates. That produced 12.9 h/month of work with
     Remarcá, of which 6.3 h came from PDFs.
   - **Public mix instead (ESTIMATE):**
     - 64% PDF-only lists, read at the §5 rates: 7% ok, 7% partial, 86% not usable;
     - store B: 4 lists × 750 rows × 0.64 × 0.86 ≈ **1,670 rows typed per month**;
     - at docs/21's mid assumption of 60 s per row (ASSUMPTION, range 30–120 s): **≈ 28 h/month** (14–56 h), instead
       of 4.2 h;
     - at ARS 15,833/h (hired operator, docs/21) that is ≈ **ARS 440 k/month** of labour; at founder cost (ARS 10 k/h),
       ≈ ARS 280 k;
     - against a 50–75 k price, the PDF typing alone costs **≈ 4–9× the price**, unless PDF-only suppliers send
       spreadsheets on request (UNKNOWN).
2. **In the good zone, docs/21's numbers stand:**
   - value ARS 34–69 k/month against an Excel-competent store, and 105–311 k against manual loading;
   - one founder serves ≈ 30–76 clients.

   The good zone is 18% of public lists. A store needs **most of its lists** in the zone for the service to pay.
   With suppliers like the sample, a store's expected share of good-zone lists is ≈ 18% (ESTIMATE; same-mix
   ASSUMPTION). The probability that one store has mostly good-zone suppliers is UNKNOWN: sectors cluster.
3. **The buyer's reference price is a salary, not a tool** (§2).
   - The duty sits inside roles paid ARS 1.0–1.6 M/month.
   - The service only saves cash if it lets the company avoid or shrink a role. The postings show the role exists
     for many other duties (ASSUMPTION that it would not shrink).
   - The margin protected for dispersed suppliers could be larger than the time value. It is **UNKNOWN**.
4. **The software is not where the money is.**
   - In the zone where Remarcá works (spreadsheets with codes), Excel, ERP imports and AI assistants are also
     strongest.
   - Where the work is (PDFs, per-row math), Remarcá does not help today.
   - A "service with Remarcá" on public-like inputs becomes mostly **manual PDF transcription**: a commodity priced at
     Fiverr / Mercado Libre levels (§2.2).

---

## 10. Strongest Evidence FOR

1. **The job is real, current and paid** (OBSERVED, §2).
   - 16 Argentine postings in about a week name it.
   - 4 are high-overlap: supplier lists → system or sale prices, at a bazar mayorista/minorista, a cleaning-products
     wholesaler, an electronic-security buyer and a commercial company.
   - Salaries: ARS 1.0–1.6 M.
2. **Lists are re-issued often, and for some suppliers per-item changes matter** (OBSERVED, §7.2).
   - Neopel changes about 1.2% of items per business day.
   - A blanket increase misprices 11–49% of items in a month, and 82.5% over 18 months.
   - 70% of its products changed at least once in 4 months.
3. **Codes are common:** 73% of public lists carry a product code (§4). The code-based matching that Remarcá does
   reliably (docs/20) applies to most lists that can be read.
4. **On spreadsheets Remarcá is accurate:** 10/15 correct automatically and **0 spreadsheet lists with wrong rows**
   (§5).
5. **Wholesalers and mid-size companies visibly pay for this work** (§2). They are larger than a ferretería, with
   admin staff and ERPs (Tango, Bejerman, Zeus).
6. **The closest global analog exists** (syncX: 921 reviews at USD 7–10, docs/19). People pay for this job in
   e-commerce, at low prices.

## 11. Strongest Evidence AGAINST

1. **The pre-registered input rule fails** (§4): 33% of public lists are spreadsheets with codes, below 50%. The good
   zone is 18%, and 17% in the target sectors.
2. **64% of lists are PDF-only, and Remarcá reads 2 of 29** (§5).
   - 3 PDFs give wrong rows. Borcas: 1,295 plausible wrong prices.
   - 5 are rejected by the 12 MB cap, a password or a scan.
   - The service's hours would be spent where the software does not help (§9).
3. **No outsourced market is visible** (§2).
   - Zero priced Argentine offers to update price lists.
   - The work is bundled into salaried roles with many other duties, so outsourcing it saves no salary.
   - The only close priced examples are international gigs at USD 15–250 per job or macro.
4. **For uniform suppliers a blanket % is enough** (§7.1).
   - 95% of Cámara del Libro items and 65% of Colihue's fall within 2% of the median change.
   - Tiendanube documents how to do that in a spreadsheet.
5. **Substitutes are cheap, native and improving** (§8).
   - Claude for Excel comes with a USD 20 plan.
   - Multilistas owns the same Argentine pitch.
   - EmberPrice copied the feature set.
   - ERP imports exist in every system the postings name.
6. **Suppliers are moving lists behind logins and passwords.** 7 not public, plus password files at Dipel and Fedeli.
   Some also publish client-specific portals (docs/19 K18). A store may get **fewer** messy lists over time, not more
   (ASSUMPTION, direction only).
7. **Zero willingness-to-pay evidence after five phases** (docs/19–22). Every positive signal is about the *job*,
   never about paying a third party for it.

## 12. Remaining Unknowns

| Unknown | Why it decides | Can desk research answer it? |
|---|---|---|
| Whether anyone pays an outsider for this, at any price | Everything | **No**, it needs an offer to real stores |
| Format of the lists stores receive **privately** (email, WhatsApp, portals) | Service cost (§9): spreadsheet vs PDF moves hours 5–7× | **No.** Public lists are a proxy of unknown bias. Hints point both ways (§4) |
| Share of suppliers with Neopel-like dispersion | Value of per-item updating vs blanket % | Partly: more versioned lists could be collected. It would not change the decision (§14) |
| Margin lost by blanket or late updates | Could exceed the time value | No, it needs a store's sales and costs |
| Whether the admin role would shrink if the duty were outsourced | Whether the service saves cash | No |
| Accuracy of a general AI (Claude for Excel, ChatGPT) on these PDFs | If high, it replaces both Remarcá and the PDF labour | Yes, with a test. But a good result argues **against** building Remarcá further |
| Representativeness of the 45 lists | All of §4–§6 | No |
| Real human minutes per list | Every hour in §9 and docs/21 | No, it needs a timed pilot |

## 13. Updated Business Hypothesis

### 13.1 Red team (Experiment 6)

**Claim:** «Un servicio que procesa listas de proveedores con Remarcá puede ser un negocio pequeño pero rentable.»

| Attack | Evidence | Does the claim survive? |
|---|---|---|
| "Nobody pays for this job" | 16 postings, salaries ARS 1.0–1.6 M (§2) | **Survives:** the job is paid |
| "Nobody pays an *outsider* for it" | 0 Argentine priced offers; duty bundled in roles (§2) | **Not refuted and not answered.** Absence in search is weak evidence, but it is the only evidence |
| "Inputs are too messy for the service to be cheap" | 33% spreadsheet + code; 64% PDF-only; Remarcá 2/29 on PDF-only (§4–§5); typing ≈ 28 h/month for a medium store (§9) | **Fails** unless private lists are much cleaner than public ones (UNKNOWN) |
| "A blanket % is enough" | True for 3 of 4 versioned suppliers; false for Neopel (§7) | **Survives partly:** only for stores with dispersed suppliers |
| "Cheaper substitutes do the same" | Claude for Excel (USD 20), Multilistas, ERP imports, EmberPrice (§8) | **Survives only as delegation.** Remarcá adds little over them |
| "Even if it works it is too small" | 30–76 clients per founder (docs/21) | Accepted by the claim's own wording ("pequeño") |
| "Remarcá is necessary for the service" | On clean inputs, Excel and ERP imports are strong; on PDFs, Remarcá does not help (§5, §8) | **Fails.** A service could run on Excel + an AI assistant. The software is optional |

**Verdict.** The claim does **not** survive in its current form. Two parts fail:

- the input condition fails on public evidence;
- "con Remarcá" fails, because the software is not what would make a service work.

What survives is a narrower and different claim:

> «Un servicio de delegación de listas de precios, para distribuidores o comercios con personal administrativo, podría
> cobrarse si las listas que reciben en privado son mayormente planillas con código.»

That claim is **unverified**. Its key condition (private input format) cannot be observed from the web. Remarcá would
be one optional tool inside it.

**Under which exact conditions it would survive** (all must hold, all UNKNOWN):

1. ≥ 70% of the client's list volume arrives as spreadsheets with codes, in one currency. This is the docs/21 §17a
   upper threshold.
2. The client currently types prices by hand or applies blanket % to dispersed suppliers.
3. The client pays ≥ ARS 50–75 k/month upfront.
4. Measured minutes per client stay ≤ price ÷ ARS 16 k/h (≈ 3–5 h/month).
5. The founder can reach ≥ 30 such clients without paid acquisition.

### 13.2 Updated hypothesis

- **Old (docs/21):** "Validate the service in a narrow zone; do not build."
- **New:** «La zona estrecha existe en los datos públicos, pero es chica (18% de las listas). Los clientes con más
  interés visible (distribuidores con administrativos) ya hacen este trabajo con Excel y un ERP. Remarcá no es la
  parte difícil. No hay evidencia de que alguien pague a un tercero por esto.»
- **Status:** the hypothesis is **weakened and not validated**. It is not refuted, but only a store test could revive
  it, and that test does not need Claude credits.

## 14. Go / Continue Testing / Abandon criteria

The decision here is **where to spend Claude credits**, not whether the founder may talk to stores.

| Decision | Criteria (all required) | Current state |
|---|---|---|
| **GO:** spend credits on Remarcá (PDF layouts, per-row IVA/currency, operator console) | ≥ 3 stores or distributors paid upfront for a pilot (docs/19 §15) **and** measured minutes per client ≤ price ÷ ARS 16 k/h **and** their real lists are ≥ 70% spreadsheets with codes, or they pay a price that covers the PDF work | **Not met:** 0 payments, 0 measurements |
| **CONTINUE TESTING:** founder time only, **0 credits** | The founder already knows ≥ 5 stores or distributors who will share their last month's supplier lists within 2 weeks, **and** accepts a hard stop date | Depends on the founder's contacts: **UNKNOWN** |
| **ABANDON as a credit investment** | Any of: the input rule fails (it does, §4); no paid outsourced market is visible (it is not, §2); the software is not necessary for the service (it is not, §13) | **Met** |

**Decision: ABANDON Remarcá as a destination for more Claude credits.**

- Keep the repository as is. It works, and the docs are complete.
- Do not build anything further.
- Do not do more desk research on it: nothing public can answer what is left.
- The only test left (§15) costs founder time and 0 credits. It is optional. If it passes its thresholds, reopen with
  evidence. If it is not run within 3 weeks, treat the idea as closed.

**For the next opportunity** (lessons, not a plan):

- Prefer problems where public data shows **priced outsourced demand**: dedicated roles, service listings with
  prices.
- Prefer inputs that are machine-readable in the field.
- Prefer work that a USD 20 general AI assistant does not already do.
- Remarcá failed on all three.

## 15. Cheapest next experiment

**Recommended:** stop here; that is the credit-free choice. If the founder wants one last check, it is the one
experiment public data cannot replace.

**"Last month's lists" (0 credits, ≈ 2 weeks of founder time, ARS 0):**

1. Ask 5–10 stores or distributors the founder already knows to **forward the supplier lists they received in the
   last 30 days**. Collect the real private channel, not the website.
2. **Count** (15 minutes per contact):
   - lists;
   - spreadsheet vs PDF;
   - codes;
   - one currency.

   Ask one question: «¿Cómo actualizás hoy: a mano, Excel, o un % general?»
3. **Offer** the service at ARS 50 k/month, paid upfront, for 4 weeks, on those same lists.
4. **Thresholds, fixed now:**

   | Result | Decision |
   |---|---|
   | ≥ 70% of received lists are spreadsheets with codes **and** ≥ 2 of the contacts pay | Reopen Remarcá with evidence. Then docs/21 §17b |
   | < 50% spreadsheets with codes **or** 0 payments | Close the hypothesis for good |
   | Anything in between | Close. The margin for a solo founder is too thin to justify more time |

5. **Stop date:** 3 weeks from the first contact, whether or not all the contacts answer.

What this experiment **cannot** do: prove a scalable business. At best it shows a small service for a few known
clients, which docs/21 already described as the ceiling.

---

## Appendix: reproduction

```sh
# Experiment 2–3: prevalence tables (from the committed labels)
python scripts/research/public_lists_stats.py

# Re-inspect the files (download them first with the URLs in public-lists-sources.json)
python scripts/research/public_lists_inspect.py <raw dir> inspect.json          # pip install openpyxl xlrd pdfplumber
RAW_DIR=<raw dir> PARSE_IN_WORKER=0 npx tsx scripts/research/public-lists-remarca.ts > remarca.json

# Experiment 5: price changes (versions listed under "versions" in public-lists-sources.json)
python scripts/research/price_changes.py <ver dir> <raw dir> price_changes.json  # pip install pypdfium2 xlrd
```
