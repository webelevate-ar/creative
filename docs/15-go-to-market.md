# 15 — Go-To-Market: the first 10 customers

> **Superseded in part by [`19-commercial-red-team.md`](19-commercial-red-team.md) §10 and §14** (2026-09-24): the next experiment is a screening + concierge-service test, not SaaS pilots.

Principle: channels the founder can run personally, this month, with ~zero budget, measured weekly.
The product was built so every sales conversation ends with the prospect's **own supplier file** running
through Remarcá — the demo is the pitch.

## 1. Who (in order)
1. **Ferreterías, casas de electricidad, sanitarios, pinturerías** in the founder's own city/area (dense, walk-in-able,
   many suppliers, prices change monthly). 14–15k ferreterías nationally (F, 02). *(The "66% ≤5 employees" figure previously cited here is only the profile of a 47-respondent survey — see docs/19.)*
2. **Autopartes/motopartes and librerías comerciales** (many SKUs, many lists).
3. **Distribuidoras/mayoristas** that build their own client lists from manufacturer lists (higher ticket; test in month 2).

Qualifying questions (30 seconds): *¿Cuántos proveedores te mandan listas? ¿Cada cuánto? ¿Quién actualiza los precios y cuánto tarda?*
Good lead: ≥8 suppliers, monthly lists, someone spends ≥2 h/week on it.

## 2. Where / channels

| Channel | Action | Weekly volume (weeks 1–4) | Cost |
|---|---|---|---|
| **Walk-ins** (primary) | Visit 10:00–12:00 (low traffic). Laptop/phone with the app open. | 40 stores | Transport + time |
| **WhatsApp to store numbers** (Google Maps listings) | Short personalized message + 40-second screen recording of a real list being processed | 100 messages | 0 |
| **Existing network** | Founder's current web-agency clients and their contacts in retail | all | 0 |
| **Distributor partnership** | Pitch 3 local distributors: "tus clientes actualizan tu lista en minutos → menos reclamos, menos errores". Ask them to forward a message to their retailer clients | 3 meetings | 1 free month per referred store |
| **Content** (compounding) | 1 short video/week: "Cómo actualizar la lista de [tipo de proveedor] en 3 minutos" (YouTube/TikTok/IG), and one SEO article for "actualizar lista de precios proveedor excel" | 1 | 0 |
| **Chambers & trade media** (month 2) | CAFARA / cámaras de comercio locales: offer a free 30-min talk "Cómo no vender por debajo del costo con inflación"; Revista Ferreteros | 1 contact/week | 0 |
| Paid ads | **Not yet.** Only after a converting landing + onboarding is proven with 10 customers | 0 | — |

## 3. Message

**Hook (walk-in or WhatsApp):**
> "Hola, soy [nombre], de [ciudad]. Hice una herramienta para ferreterías: le subís la lista que te manda el proveedor
> —en Excel o PDF, como venga— y en dos minutos te dice qué subió, qué productos estás vendiendo por debajo del costo
> nuevo y te da los precios nuevos listos para tu sistema. ¿Me pasás la última lista de tu proveedor principal y te
> muestro el resultado con tus números?"

**Demo script when the store has no catalog export at hand (most first visits):** ask for the **previous and the
current list of the same supplier** (usually both are in their WhatsApp). Upload the previous one → "Crear los N
productos desde esta lista" → Aplicar; upload the current one → Remarcá recognizes the format and shows what went up,
by how much, and what is new or discontinued. Their real numbers in ~3 minutes; the catalog can be imported later.

**Value lines to use:** "No cambiás tu sistema." · "Revisás antes de aplicar y lo podés deshacer." · "La segunda lista de ese proveedor se lee sola."

**Objections:**
| Objection | Answer |
|---|---|
| "Mi sistema ya importa Excel." | "¿Te importa la lista *tal como te llega*? Probemos con la de hoy." (If yes → disqualify, thank them.) |
| "Subo todo un X%." | Show their list's distribution: items +15% sold with +8% = margin lost. Show the "bajo costo" count. |
| "Está caro / vendo poco." | "Es menos que un producto vendido mal en un mes. Probalo 14 días sin pagar nada." |
| "No quiero subir mis precios a internet." | "Tus datos son solo tuyos; no los ve nadie, ni otros comercios ni los proveedores. Podés exportarlos y borrarlos cuando quieras." |

## 4. Offer
- **Pilot offer (first 10):** first month ARS 15,000 paid upfront (Mercado Pago link or transfer), setup included
  (founder imports catalog + top 3 suppliers). Month 2 at list price. Price locked for 6 months as early customer.
- **CTA:** "Mandame por WhatsApp la última lista de tu proveedor principal." (the file is the intent signal)
- **Referral:** 1 free month for both when a store refers another that pays.

## 5. Funnel metrics (weekly, in a spreadsheet + `npm run admin -- funnel`)

| Stage | Metric | Target week 4 |
|---|---|---|
| Contacted | walk-ins + messages | 280 cumulative |
| Conversation | replied / talked | 25% |
| **File received** | sent a real supplier list | 30% of conversations |
| Demo'd | saw their own list processed | 80% of files |
| Paid pilot | paid month 1 | 30% of demos → **≥5 paying** |
| Activated | 1st list applied + export downloaded (events) | 100% of paid in 7 days |
| Retained | applied lists on ≥2 different days in 30 days | ≥60% |
| Renewed | month 2 at list price | ≥60% |

## 6. Experiments (one variable at a time)
1. **Walk-in vs. WhatsApp**: file-received rate per hour of founder time. Keep the cheaper channel.
2. **Vertical**: ferreterías vs. electricidad vs. autopartes — which has the highest file-received and paid rate?
3. **Offer**: "primer mes $15.000 con puesta en marcha" vs. "14 días gratis, lo configurás vos". Measure paid conversion and support minutes.
4. **Distributor referral**: one distributor forwards to its clients → signups and CAC.

## 7. Operating cadence (founder, part-time)
- Mon/Wed/Fri mornings: 15 walk-ins each. Tue/Thu: WhatsApp follow-ups, onboarding sessions, content.
- Every Friday: update funnel sheet, read `admin funnel`, write 5 lines of learnings (what files broke, what objections).
- Stop/pivot rules: see 05 §3 and 17.
