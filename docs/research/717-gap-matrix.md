# 717 — Gap matrix: where we lead, match and lag the market (AGREED)

The owner agreed this matrix on 2026-11-03 (ticket 724). It merges four research notes and the numbers ticket:
- 718: enterprise OMS
- 719: pharmacy
- 720: delivery
- 721: our capabilities
- 723: the numbers

About 250 market rows are collapsed to 54 rows pitched at management level.

- **Market tier:**
  - TS = table stakes
  - C = common
  - D = differentiator
  - REG = KSA regulatory must-have
  - STD = standard among pharmacy chains
  - DEL = customer delighter
- **Verdict:**
  - **LEAD** = we do it, and the top OMS products do not ship it out of the box
  - **MATCH** = on par with the market
  - **PART** = partly, or built but not yet deployed
  - **LACK** = we don't do it
- **State:**
  - Live
  - Pilot
  - Built = merged, not deployed
  - Dec-3 = owner expects it live or demo-able on staging by the pitch (~2026-12-03)
- **Owner facts behind the verdicts:**
  - oms-react **is in production**, used by ops and finance.
  - Tracking, proof of delivery and status messages are **ours for our own fleet and the partner's for OTO and HungerStation riders**.
  - Refill reminders, auto-refill (Wasfaty refill), SFDA RSD reporting, self-service order status and capacity-capped slots are **live**.

## Headline "we lead" claims (owner pick: operations & compliance)

1. **Serial and batch on every pack** (row 10). GS1 serial is captured at every sale, a return must be the same pack we sold, and the batch is checked at scan. Of the seven top OMS products, only Kibo sells lot/serial tracking. SFDA fines are live: 10 pharmacies were fined over SAR 1.7 m in January 2026.
2. **Donor-store transfers** (row 11). A store that is out of stock is supplied by a neighbour within 5 km. The sale is saved instead of lost.
3. **Delivery callouts with a widening radius** (row 16). Orders are offered to nearby stores, the first to take wins, and the radius widens on its own. Among the vendors researched, only Tookan documents this. Demo-able by 3 December.
4. **Our own till and OMS on one platform** (row 15). 2,054 tills and the OMS run as one estate, with fleet operations (row 54). The vendors sell POS separately.

The commercial and finance leads (loyalty, Wasfaty/NPHIES at scale, SAP audit trail, settlement) were **not** picked as headlines. They stay in the matrix as rows.

## Ranked gaps that matter (owner ruling)

1. **Controlled drugs through Raqeeb** (row 40). Regulatory; the work is ticketed but not built.
2. **AI copilot, plain-language data questions and agent-ready (MCP) APIs** (rows 47, 48, 50). This is what the market treats as the 2026 differentiator.
3. **Smart sourcing with simulation and "explain why"** (row 8).
4. **Cold-chain logging** (row 23). No vendor publishes it either.

**Partly done, to be finished** (no ranking yet): network available-to-promise (row 9); rules-based sourcing beyond callouts (row 7); an executive live dashboard (row 46); prescription sessions (row 41); insurer rules (row 38); Deliverect traffic (row 2); express ≤60 min (row 21); adherence packs (row 44); RELEX (row 12).

## The matrix

| # | Domain | Capability | Market | Us | State | Evidence |
|---|---|---|---|---|---|---|
| 1 | Channels | One order hub for every channel | TS | MATCH | Live | 412k orders/30d from 20+ sources |
| 2 | Channels | Aggregator orders land directly | TS | MATCH | Live (HS) / Built (Deliverect) | HS = 20% of orders; Deliverect 0 traffic |
| 3 | Channels | Aggregator catalogue, stock and promotions from our side | D | **LEAD** | Live stock / Built promos | |
| 4 | Channels | Call-centre ordering | C | MATCH | Live | 39.5k orders/30d |
| 5 | Channels | Auto-refill (Wasfaty refill) | D / DEL | **LEAD** | Live | no regional competitor publishes it |
| 6 | Channels | Configurable order-type behaviour | C | PART | Built | doc-type config |
| 7 | Sourcing | Rules-based sourcing | TS | PART | Built (callout) | |
| 8 | Sourcing | Cost-optimised sourcing, simulation, explain-why | D | LACK | — | gap #3 |
| 9 | Inventory | Network stock / available-to-promise | TS | PART | Built | stock check |
| 10 | Inventory | Lot / serial / expiry on every pack | D | **LEAD** | Live | **headline 1** |
| 11 | Inventory | Store-to-store transfer to save the sale | C | **LEAD** | Live | **headline 2** |
| 12 | Inventory | Demand-forecast feed | D | PART | Pilot | RELEX |
| 13 | Store | Ship-from-store / click & collect | TS | MATCH | Live | |
| 14 | Store | Scan-verified picking | TS | MATCH | Live | |
| 15 | Store | Own till + OMS on one platform | D | **LEAD** | Live / NewPos pilot | **headline 4** |
| 16 | Delivery | Callout to stores, first to take wins, radius widens | D | **LEAD** | Dec-3 | **headline 3** |
| 17 | Delivery | Store / courier scorecard | TS | MATCH | Dec-3 | |
| 18 | Delivery | Customer live tracking, ETA, status messages | TS | MATCH | Live (own fleet; partner riders via partner) | |
| 19 | Delivery | Proof of delivery | TS | MATCH | Live (own fleet; partner riders via partner) | |
| 20 | Delivery | Slots capped by real capacity | D | MATCH | Live | IBM/BY/Kibo have it too |
| 21 | Delivery | Express ≤60 min | STD GCC | PART | Built | express + OTO auto-courier |
| 22 | Delivery | Third-party courier integration | C | MATCH | Live | OTO, Starlink |
| 23 | Delivery | Cold-chain logging | D | LACK | — | gap #4 |
| 24 | Returns | Returns and refunds | TS | MATCH | Live | 1.0% return rate |
| 25 | Service | Agent console with order and member context | TS | MATCH | Live | |
| 26 | Service | Change an order without breaking its price | TS | MATCH | Live | |
| 27 | Service | Customer self-service status / cancel | C | MATCH | Live | |
| 28 | Payments | Authorise / capture / refund, BNPL | TS | MATCH | Live / Partial BNPL | |
| 29 | Finance | Store cash collection + per-store settlement | none ship it | **LEAD** | Live | |
| 30 | Finance | ERP posting with line-level audit trail | C | **LEAD** | Live (5 channels) | IDoc inspector |
| 31 | Finance | ZATCA e-invoice | REG | MATCH | Live | |
| 32 | Pricing | One promotion engine, four-eyes test gate, basket simulator | D | **LEAD** | Dec-3 (engine + coupons) | |
| 33 | Loyalty | Loyalty in every order | STD | **LEAD** | Live | 14.9M members, 72.5% of sales |
| 34 | Loyalty | Coupons and campaigns | C | MATCH | Live / Dec-3 | |
| 35 | Pharmacy | Wasfaty e-prescription intake | REG | MATCH | Live | 2.69M eRx/30d |
| 36 | Pharmacy | NPHIES eligibility, pre-auth, claims | REG | MATCH | Live | 134k sales/30d |
| 37 | Pharmacy | Patient-share / co-pay split | STD | MATCH | Live | |
| 38 | Pharmacy | Insurer rules as data, FHIR, playground | none ship it | **LEAD** | Built (not by Dec-3) | roadmap |
| 39 | Pharmacy | SFDA RSD reporting | REG | MATCH | Live | |
| 40 | Pharmacy | Controlled drugs (Raqeeb) | REG | LACK | not built | gap #1 |
| 41 | Pharmacy | Pharmacist verification / prescription session | REG | PART | Built (not by Dec-3) | |
| 42 | Pharmacy | Teleconsult → prescription | DEL | MATCH | Live | Altibbi |
| 43 | Pharmacy | Labs / clinics joined to the pharmacy | DEL | MATCH | Live | |
| 44 | Pharmacy | Adherence packs | DEL | PART | Built | NUPCO / PillPack |
| 45 | Pharmacy | Refill reminders | STD | MATCH | Live | |
| 46 | Analytics | Live ops / executive dashboard | TS | PART | Built (ops boards only) | |
| 47 | Analytics | Ask the data in plain language | D | LACK | — | gap #2 |
| 48 | AI | AI agents (copilot, explain-why) | D | LACK | — | gap #2 |
| 49 | Platform | Open APIs | TS | MATCH | Live | SIS.Api |
| 50 | Platform | Agent-ready APIs (MCP) | D | LACK | — | gap #2 |
| 51 | Platform | Business users change rules without IT | C | **LEAD** | Built | rule engine, IDF, doc-type config |
| 52 | Platform | Security: 2FA, roles, sessions | TS | MATCH | Live | no SOC 2 / PCI certificate |
| 53 | Platform | Multi-country / multi-currency | C | MATCH | Live | KSA + Bahrain |
| 54 | Platform | Store fleet ops (sync console, store scripts, self-updating tills) | none ship it | **LEAD** | Live / Partial | |

**Count:** 13 LEAD · 27 MATCH · 8 PART · 6 LACK.
