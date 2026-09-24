# 03 — Opportunity Universe (56 explored)

Method: brainstormed from the founder's context (sells websites/digital services to small businesses,
direct sales, Argentina) plus the pain signals in the mission brief (Excel, WhatsApp, manual
re-typing, lost money). Each opportunity got a quick kill-test: *Is there a clear buyer? Is the
pain frequent and money-denominated? Is the space already saturated? Can a solo founder reach buyers?
Can a generic AI feature replace it?*

"Searched" = checked with a web search in this session (sources in 02/04). "Reasoned" = judged
from general knowledge only; treat as ASSUMPTION.

| # | Opportunity | Buyer | Verdict | Why | Basis |
|---|---|---|---|---|---|
| 1 | Accounting firm client portal + tax deadlines | Contadores | Discard | 7+ local tools (Aconpy, Acont, ContaSense, Witmi, Taxes, Holistor, Catedral) | Searched |
| 2 | Insurance broker (PAS) portfolio mgmt | PAS | Discard | Polko is free; Nekül, Asesor Ninja, NexoSmart | Searched |
| 3 | Court case tracking PJN/MEV | Lawyers | Discard | Veredicta, RivoLegal, JurisPro, MetaJurídico; scraping + captcha risk | Searched |
| 4 | Collections reminders via WhatsApp | SMBs | Discard | Caudo, Intiza, Debitia, Colektia, Moonflow | Searched |
| 5 | Rental admin with ICL/IPC adjustments | Inmobiliarias | Discard | 8+ tools found in one search | Searched |
| 6 | Health-insurance (obras sociales) billing | Therapists | Discard | FacturAPE, Psicobit, MednIA, Kandu, MedicAI; high complexity | Searched |
| 7 | Public tender alerts | SMB suppliers | Discard | Licita Ya, Licitar (AI summaries), Latamcompra | Searched |
| 8 | WhatsApp order-taking for distributors | Distribuidoras | Discard | Cheetrack, Leba, AppInWhats, Yaku, Farandsoft; Yalo for enterprise | Searched |
| 9 | Restaurant recipe costing & price alerts | Restaurants | Discard (AR) | bcnsoft, InstaCost, CostoCero, WISK, Gastrometrics | Searched |
| 10 | Verify incoming transfers vs fake receipts | Shops | Discard | Real pain (fraud +~30% YoY per press), but Mercado Pago already offers cashier roles ("Registro de cobros"); bank data inaccessible (no open banking); image forensics unreliable | Searched |
| **11** | **Supplier price lists → updated costs & sale prices** | **Retailers & distributors with many suppliers** | **FINALIST → SELECTED** | Universal, frequent, money-denominated; incumbents are full POS/ERPs with rigid import; no standalone "works with any system" tool found in AR | Searched |
| 12 | Distributors publish an always-current price list to their clients ("lista viva") | Distribuidoras | Finalist (expansion of 11) | Same data pipeline; distributors pay more | Reasoned |
| 13 | Quotes for installers/contractors using supplier prices | Tradespeople | Finalist (adjacent) | Needs same price data; buyer fragmented, low WTP | Reasoned |
| 14 | Appointment booking | Professionals | Discard | AgendaPro, Turnito, Reservo, Doctoralia | Searched (Turnito seen) |
| 15 | Gym management | Gyms | Discard | Deportnet, Fitco et al. | Reasoned |
| 16 | Building expenses (expensas) | Administradores | Discard | Mature local players | Reasoned |
| 17 | Electronic invoicing (ARCA) | All SMBs | Discard | Xubio, TusFacturas, Facturante, Alegra, Colppy | Searched (TusFacturas seen) |
| 18 | Monotributo for exporting freelancers | Freelancers | Discard | Low WTP, accountants + Calim | Reasoned |
| 19 | Mercado Libre seller tools | ML sellers | Discard | Real Trends, Nubimetrics; platform risk | Reasoned |
| 20 | Catalog + WhatsApp ordering for shops | Retail | Discard | Tiendanube, Pedix, Wabi | Reasoned |
| 21 | Google review generation | Local businesses | Discard | Low WTP in LatAm; Birdeye/Podium-type | Reasoned |
| 22 | Marketing agency reporting | Agencies | Discard | AgencyAnalytics, free Looker Studio | Reasoned |
| 23 | Website care-plan management | Web agencies | Discard | ManageWP, MainWP, WP Umbrella | Reasoned |
| 24 | Proposal software | Agencies | Discard | Proposify, PandaDoc, Better Proposals | Reasoned |
| 25 | Visual website feedback | Agencies | Discard | Markup.io, BugHerd, Pastel | Reasoned |
| 26 | Digital payslips | SMB HR | Discard | Humand and others | Reasoned |
| 27 | Time clock | SMB HR | Discard | Crowded globally | Reasoned |
| 28 | e-cheq portfolio mgmt | SMB finance | Discard | Requires bank integrations | Reasoned |
| 29 | Cash-flow forecasting | SMB finance | Discard | Colppy, Banktrack, Commercy; weak differentiation | Searched (Banktrack, Commercy seen) |
| 30 | Bank reconciliation | SMB finance | Discard | Banktrack, Commercy | Searched |
| 31 | Import landed-cost calculator | Small importers | Discard | Episodic; despachantes do it | Reasoned |
| 32 | Rural contractor billing per hectare | Contratistas | Discard | No founder domain access | Reasoned |
| 33 | Dairy/livestock management | Farms | Discard | Existing tools; domain | Reasoned |
| 34 | Dental lab job tracking | Labs | Discard | Small market | Reasoned |
| 35 | Optician lens orders | Ópticas | Discard | Small market | Reasoned |
| 36 | Car workshop service reminders | Talleres | Discard | Low WTP; existing tools | Reasoned |
| 37 | Vet vaccine reminders | Vets | Discard | Included in vet software | Reasoned |
| 38 | School communication book | Schools | Discard | Existing apps; long sales cycle | Reasoned |
| 39 | Club/academy fee collection | Clubs | Discard | MP subscriptions, Deportnet | Reasoned |
| 40 | Cabin/lodging bookings with deposit | Small lodging | Discard | Seasonal; channel managers | Reasoned |
| 41 | COI tracking for US contractors | US GCs | Discard (founder fit) | US domain + distribution; many AI startups | Reasoned |
| 42 | Web accessibility compliance (EU EAA) | EU e-commerce | Discard | Overlay vendors; legal nuance | Reasoned |
| 43 | Verifactu invoicing (Spain) | ES autónomos | Discard | Holded, Quipu, etc. | Reasoned |
| 44 | EU e-invoicing mandates | EU SMBs | Discard | Large incumbents | Reasoned |
| 45 | Speed-to-lead for US home services | US SMBs | Discard | Crowded | Reasoned |
| 46 | Shopify supplier-feed sync | Shopify merchants | Later channel for 11 | Ablestar, stock-sync apps exist | Searched |
| 47 | Competitor price monitoring | E-commerce | Discard | Prisync et al. | Reasoned |
| 48 | Shelf price labels after re-pricing | Retail | Feature of 11 | Not a product alone | Reasoned |
| 49 | Customer self-service account statements | Distributors | Discard (for now) | Overlaps collections tools | Reasoned |
| 50 | Bakery recipe/stock | Bakeries | Discard | Overlaps restaurant tools | Reasoned |
| 51 | Construction progress certificates (CAC index) | Small builders | Discard | Niche; existing construction software | Reasoned |
| 52 | School transport billing/routes | Operators | Discard | Tiny market | Reasoned |
| 53 | Proof-of-delivery for distributors | Distributors | Discard | DispatchTrack, SimpliRoute | Reasoned |
| 54 | Pre-sales rep app | Distributors | Discard | Chess, Axum (mature) | Reasoned |
| 55 | Used-car pricing for dealers | Dealers | Discard | Data access | Reasoned |
| 56 | "Who sells it cheapest" across my suppliers | Retailers | Feature of 11 (NEXT) | Falls out of the same normalized data | Reasoned |

## Clusters that survived
1. **Supplier price data for SMB retail/distribution** (#11, #12, #13, #48, #56) — one data pipeline, several products on top.
2. Everything else was killed mainly by **saturation** (the dominant killer in 2026) or **third-party dependency**.
