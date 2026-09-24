# 04 — Competitive Analysis (finalist: supplier price lists → sale prices)

## 1. Landscape

| Competitor / substitute | Type | Target | What it does for this job | Pricing (FACT if sourced) | Strength | Weakness / gap |
|---|---|---|---|---|---|---|
| **Excel + BUSCARV/VLOOKUP** | Substitute (dominant) | Everyone | Manual lookup old vs new list | Free (already owned) | Flexible, known | Hours per list; breaks when columns move; error-prone decimals/IVA; needs skill; no history |
| **"Subir todo X%"** | Substitute (behavior) | Small shops | Blanket increase | Free | Instant | Wrong per-item: loses margin where supplier rose more, loses sales where it rose less |
| **Multilistas** | Direct (AR) | Ferreterías, electricidad, sanitarios, herrajes | Full POS: upload supplier Excel lists, unified search, invoices/quotes/remitos, cuenta corriente | Not published; 15-day free trial | Built for the exact vertical | **Requires replacing your POS**; Excel only (no PDF mentioned); switching cost is the barrier |
| ERP/POS import modules: Tango (Axoft), Líder Gestión (Wynges), Natural Software, EGA Futura, GEOMA, Flexxus, JCLB Go | Indirect (AR) | Ferreterías, autopartes, distribuidoras | Import price file with fixed/mapped columns; % increases by supplier | GEOMA: ARS 400k license + ARS 69k/mo server + 35k/mo per extra PC ([geoma](https://www.geoma.com.ar/)); Tango ~ARS 528k/mo; Xubio up to ARS 231k/mo; Líder from ~ARS 588k perpetual ([Wynges comparison, Sep-2026](https://wynges.com/blog/top-10-software-zeus-flexus-softland-xubio-tango-bejerman-contagram-colppy-nubox/)) | Already installed; data lives there | Needs a **clean** file (someone reformats messy supplier files by hand); no PDF; weak diff/margin analysis; each vendor different |
| Automation consultants (e.g. Varka) & AI/n8n agencies | Custom service | SMBs | Build a bespoke pipeline | AI consultancies quote from ~USD 1,500 per project (search result) | Tailored | Expensive for a ferretería; maintenance when formats change |
| Horizontal PDF/Excel extractors: Lido, Dijit, ImageToTable, Apify actors, Priceboard, ProductBay | Horizontal tools | Ops teams, developers | Turn documents into tables | Varied | Good extraction | No catalog matching, no discount cascades, no margin rules, no POS export — **half the job** |
| Generic AI assistants (ChatGPT, Claude, Gemini) | Substitute (rising) | Anyone | Ad-hoc: "merge these two files" | ~USD 20/mo | Very flexible | No persistent catalog/mappings unless user is savvy; non-deterministic; row omission risk (E1); no audit/undo; user must re-explain each time |
| Shopify apps: Ablestar Bulk Product Editor, stock-sync apps | International (e-com) | Shopify merchants | Upload supplier spreadsheets, remember column choices, cost+markup rules | Ablestar free tier: 5 edits/30 days | In-platform | Shopify-only; English; no ARS realities (IVA, cascaded bonificaciones, USD lists) |
| TRA-SER (Trade Service, Trimble) | US analog | Electrical/plumbing contractors & distributors | Central pricing database, maintained | USD 1,260/user/yr (electrical) | Data network | US-only; manufacturer-fed |
| MarginEdge | US analog (restaurants) | Restaurants | Invoice digitization + price-change alerts | USD 350/location/mo ([pricing](https://www.marginedge.com/pricing/)) | Proven WTP for "tell me when supplier prices change" | Restaurants only; US |

## 2. Gaps we can exploit
1. **Neutrality:** a tool that **feeds whatever system the store already uses** (export in its import
   format) instead of replacing it. Multilistas asks you to switch POS; ERPs need clean input. Nobody
   sells "the cleaning + deciding step" alone. (Gap: FACT that I didn't find one; ASSUMPTION that none exists.)
2. **Argentine pricing math done right:** cascaded bonificaciones (`30+10+5`), IVA included/excluded,
   USD-priced lists × exchange rate, flete/recargo %, per-box vs unit, rounding to "nice" prices.
3. **Decision support, not just import:** what changed, by how much, which items would be sold
   below replacement cost, anomalies (×1000 decimal errors), items that disappeared from the list.
4. **Memory:** per-supplier column mapping and learned code equivalences → second upload of the same
   supplier is near zero effort. This is what generic AI chats lack by default.
5. **Reversibility:** every applied batch can be undone (practitioner rule from E1: "ningún flujo
   escribe sin poder deshacerse").

## 3. How incumbents would copy us
- ERP vendors can add "smart import" (column detection, cascaded discounts) — plausible in 6–24 months
  for the more active ones (Wynges publishes heavy content marketing). Our defense: speed of focus,
  neutrality (works across *all* their systems + e-commerce), and the per-supplier format library.
- Multilistas could add an export-to-your-POS mode — it would cannibalize their POS pitch; less likely.
- Generic AI will keep improving at one-off merges. Our defense is the workflow (persistent catalog,
  deterministic math, audit, undo, repeatability for non-technical staff). This risk stays **open** (see 17).

## 4. Shorter analysis of the other finalists
- **#10 Transfer verification:** Nequi (Colombia) ships native receipt verification; ComprobAI (image
  forensics); Mercado Pago already gives cashier-only roles. Our access to bank data is the blocker.
- **#12 "Lista viva" for distributors:** B2B catalog/ordering tools (Pedix, Wabi, Tiendanube B2B) exist,
  but they start from a clean catalog; the upstream list processing is our same core. Keep as expansion.
- **#13 Installer quotes:** construction/quote tools exist; buyer fragmented; depends on price data we'd
  have anyway. Later adjacency.
