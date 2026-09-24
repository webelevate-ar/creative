# 02 — Market Research

Research date: 2026-09-24. All research is **desk research** (web search + page fetches) from the
cloud container. No customer interviews were possible from this environment (see 01-mission).

## 1. Macro context (Argentina, the initial market)

| Fact | Value | Source | Label |
|---|---|---|---|
| Monthly CPI Aug-2026 | 1.7% (Jul-2026: 2.1%) | [Bloomberg Línea](https://www.bloomberglinea.com/latinoamerica/argentina/cuanto-dio-la-inflacion-de-agosto-2026-en-argentina-segun-el-indec/), [finarg](https://finarg.net/indices/inflacion) | FACT |
| YoY CPI Aug-2026 | 33.5% | same | FACT |
| USD/ARS BNA 24-Sep-2026 | ~1,540 sell | [La Nación](https://www.lanacion.com.ar/dolar-hoy/), [Infobae](https://www.infobae.com/economia/2026/09/23/el-dolar-volvio-a-aumentar-y-marco-un-nuevo-record-nominal/) | FACT |
| Ferreterías in Argentina | 14,000–15,000 (as reported by the press) | [Rosario3/Ecos365](https://www.rosario3.com/ecos365/noticias/dia-del-ferretero-121-anos-de-historia-en-medio-de-la-peor-caida-de-ventas-del-sector-20260903-0004.html), [CAFARA](https://cafara.org.ar/) | FACT (as reported) |
| ~~66% have ≤5 employees~~ | **Correction (docs/19):** this is the composition of the 47 respondents of a CAFARA 2026 training survey, not a sector statistic | [Revista Ferreteros](https://revistaferreteros.com.ar/en/encuesta-de-capacitacion-ferretera-2026/) | EVIDENCE (n=47, not representative) |
| Ferretería sector state | "peor caída de ventas del sector" (Sep-2026); 2025 closed with "márgenes presionados" | Rosario3, [Diario Huarpe](https://www.diariohuarpe.com/nota/ferreterias-arrancan-2026-con-ventas-ajustadas-y-presion-de-costos-2026186021) | FACT |

**Implication:** prices still move ~2%/month on average, with individual supplier lists jumping more.
Margins are compressed, so selling below replacement cost hurts more than in normal times.
At the same time, sector sales are falling → **willingness to pay is under pressure**. Both matter.

## 2. A key meta-finding: the Argentine vertical-SaaS market is saturated in 2026

Nearly every "obvious" vertical I searched already has 4–8 local products, many of them visibly
AI-built in 2025–2026 (see `03-opportunity-universe.md`). Examples found in a single search each:

- Accounting firms: Aconpy, Acont, ContaSense, Witmi, Taxes, Holistor, Catedral.
- Law firms (case tracking PJN/MEV): Veredicta, RivoLegal, JurisPro, MetaJurídico.
- Rental administration (ICL/IPC): Ubiquo, Rentaloop, TusAlquileres, Barreeo, Renti, mialquiler, Inmosoft, SimpleProp.
- Collections via WhatsApp: Caudo, Intiza, Debitia, Colektia, Moonflow.
- WhatsApp order-taking for distributors: Cheetrack, Leba, AppInWhats, Yaku, Farandsoft.
- Restaurant food cost: bcnsoft, InstaCost, CostoCero, WISK, Gastrometrics.
- Public tenders: Licita Ya, Licitar (with AI), Latamcompra.

**Implication (ESTIMATE):** "another vertical SaaS for X" is now cheap to build for anyone, so
building is not a moat. Differentiation must come from (a) a narrow, painful job done much
better, (b) distribution the founder personally controls, (c) accumulated data/workflow memory.

## 3. The selected problem space: supplier price lists → sale prices

### 3.1 Evidence the problem exists

| # | Evidence | Type | Source |
|---|---|---|---|
| E1 | Practitioner write-up: supplier sends a list "cada dos o tres semanas en PDF o Excel con formato distinto según quién la exportó ese día, y alguien carga cientos de artículos a mano"; "medio día" per update; failures: decimal separators (`1.234,56` vs `1,234.56`), IVA included or not, price per box vs unit, scanned PDFs. | Practitioner (consultant, Varka) | [dev.to](https://dev.to/gonzalo_terrones_7737b137/automatizar-listas-de-precios-lo-que-se-rompe-cuando-el-proveedor-cambia-el-excel-596i) |
| E2 | Ferretería software buying guide lists "Dificultad para actualizar listas de proveedores" among frequent problems. | Vendor content | [Wynges](https://wynges.com/como-elegir-software-para-ferreteria-argentina/) |
| E3 | "Una tienda que revisa precios cada dos meses termina vendiendo a pérdida durante semanas enteras"; "El precio nuevo debe cubrir lo que te va a costar reponer el producto". | Retail blog | search result summary (Treinta / Yimi, see 04) |
| E4 | Multilistas exists as a product whose core promise is importing many supplier lists for ferreterías/electricidad/sanitarios. | Competitor existence | [multilistas.com.ar](https://www.multilistas.com.ar/) |
| E5 | Every ferretería/autopartes ERP advertises Excel price-list import (Tango/Axoft, EGA Futura, Wynges, Natural Software, Flexxus, GEOMA, JCLB). The feature is table stakes → the job is universal. | Competitor docs | see 04 |
| E6 | Shopify merchant with multiple local suppliers sending "pricelists in varying formats" daily asks for automation. | **User voice** (non-AR) | [Shopify Community](https://community.shopify.com/t/dealing-with-multiple-supplier-pricelists/221854) |
| E7 | Many Excel forum threads/tutorials on updating prices from a supplier list with VLOOKUP/BUSCARV. | User voice (substitute) | [MrExcel](https://www.mrexcel.com/board/threads/como-actualizar-una-lista-de-precios.10507/), [TodoExcel](https://foro.todoexcel.com/threads/cambiar-precios-de-venta-antiguos-por-los-nuevos.30279/), [TodoExpertos](https://www.todoexpertos.com/categorias/tecnologia-e-internet/software-y-aplicaciones/microsoft-excel/respuestas/4oyeykybyofp1/actualizar-precios-de-productos-en-excel-con-informacion-de-otro-libro-u-hoja) |
| E8 | Developers publish "supplier price list parser" actors (Apify ×4), Priceboard, ProductBay → builders see demand for normalizing supplier files. | Supply-side signal | [Apify](https://apify.com/invincible_nova/supplier-price-list-parser), [Priceboard](https://www.priceboard.ai/en) |
| E9 | US: Trade Service TRA-SER sells up-to-date supplier pricing data at **USD 1,260/user/year** (electrical contractors). | **Paid WTP** (adjacent) | [search summary / tradeservice.com](https://www.tradeservice.com/tra-ser-distributors) |
| E10 | US: MarginEdge charges **USD 350/location/month** for invoice processing incl. price-change alerts; value prop "price alerts notify you when product prices change beyond thresholds". | **Paid WTP** (adjacent vertical) | [MarginEdge pricing](https://www.marginedge.com/pricing/) |
| E11 | Argentine open-source ERP extension (AlparLabs) added a supplier price-list importer with preview, variation control, replacement cost and cascaded discounts → real businesses need exactly those features. | Builder signal (AR) | [GitHub PR](https://github.com/AlparLabs/enhancement-suite/pull/31) |

### 3.2 What I did **not** find (honest gaps)
- **No direct first-person complaints from Argentine retailers** (Reddit/forums) — they likely live in
  Facebook/WhatsApp groups that are not accessible from here. **UNKNOWN** how they phrase the pain.
- **No published willingness-to-pay for a standalone tool** in Argentina. Anchors only (see 08).
- **No count** of electricidad, sanitarios, pinturerías, autopartes, corralones or distribuidoras. **UNKNOWN.**

### 3.3 Economic impact (ESTIMATE, to be validated in interviews)
- Time: E1 says half a day per list update. With 10–40 active suppliers updating every 2–6 weeks,
  a store can face 2–10 list updates per week → **4–20 h/week** of admin work (ESTIMATE, wide range).
- Margin leak: if a supplier raises 8% and the store updates 30 days late, every unit sold in that
  window is sold at ~8% lower margin than planned. For a store with ARS 30M/month sales and 35%
  gross margin, a 2-point average margin leak ≈ **ARS 600,000/month** (~USD 390) (ESTIMATE; inputs are
  ASSUMPTIONS).
- Errors: decimal/IVA/unit errors can misprice items ×10 or ×1000 (E1) — rare but expensive.

## 4. International view
- The same job exists wherever retailers buy from many small suppliers without EDI (E6: Shopify,
  E9/E10: US adjacent). Inflation makes it **more frequent** in Argentina, which is why Argentina is
  a good *first* market, not the only one.
- In Shopify's ecosystem the job is partially served (Ablestar Bulk Product Editor, stock-sync apps) →
  internationally we'd enter later via e-commerce integrations, not as a standalone first.
- Other LatAm markets with meaningful inflation or many informal suppliers (Bolivia, Venezuela,
  Colombia, Mexico, Uruguay) — **UNKNOWN** frequency of list changes there.
