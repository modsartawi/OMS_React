# 717 — Enterprise OMS capabilities: the market side of the comparison matrix

> Desk research, accessed **2026-11-03**. Scope: what market-leading enterprise OMS products *sell*,
> organised as matrix rows. This file does **not** assess our own platform (separate ticket).
> Every claim carries a footnote `[n]` pointing at §6. **(secondary)** = not a vendor/analyst primary
> source. **(vendor-reported)** = analyst placement quoted from a vendor press release / web page.
> "?" = could not confirm from a public source; it does **not** mean "absent".

Products covered: Manhattan Active Omni · Salesforce Order Management · IBM Sterling Order Management
(+ Sterling Intelligent Promising) · Fluent Order Management · Kibo Order Management (KIBO) ·
Blue Yonder Order Management · **Oracle Retail Order Management Suite Cloud Service** (Order
Orchestration, formerly *Order Broker*, + Order Administration) — chosen over Oracle Fusion Cloud
Order Management, which Oracle positions for manufacturing/B2B order-to-cash [46].

---

## 1. Summary

- **What the category is (2026).** Analysts frame OMS as "the workhorse at the heart of the commerce
  tech ecosystem" — inventory, order, logistics and operational tools across channels [1]. Gartner now
  calls it *Distributed Order Management (DOM)* (Market Guide, 30 Jun 2025, ~20 representative vendors,
  no Magic Quadrant) [5]; IDC renamed its MarketScape to **"AI-Enabled Order Orchestration and
  Fulfillment Applications for Retail and B2C" (2026)** [6] — the word "AI-enabled" is now in the
  category title.
- **Forrester Wave OMS Q1 2025**: 8 vendors, 35 criteria [4 (secondary)]. Leaders confirmed (vendor-reported):
  Manhattan (5.0 in 20 of 27 current-offering criteria) [3], Fluent [2], Kibo [33]. IBM / Salesforce /
  Blue Yonder / Oracle placement not publicly confirmed.
- **Table stakes**: real-time cross-node inventory, rules-based sourcing/routing, split/consolidate,
  BOPIS + ship-from-store with a store picking app, returns with refunds, a service console that can
  cancel/modify, APIs, cloud SaaS.
- **The market moved from "can we route an order?" to "can we route it profitably and explain why?"**
  Cost-to-serve / margin-aware sourcing [15][37][20], sourcing **simulation** before go-live [12][38],
  and **A/B testing of sourcing rules on live orders** [29] are the 2026 differentiators.
- **Promise accuracy is a selling point in its own right**: delivery-date promises shown on search/PLP,
  to 15-minute windows [20], node capacity + carrier transit in the promise [40].
- **Agentic AI is in every vendor's 2026 release**, converging on three agent roles: (1) *store
  associate / customer-service agent*, (2) *"explain why this order routed there"* agent,
  (3) *natural-language configuration* of sourcing rules with human approval [12][28][34][35][38][15].
- **MCP servers** (Model Context Protocol) for the OMS appeared in 2026 at Salesforce, Kibo, IBM and
  Fluent [15][35][24][2] — the OMS is being opened to *external* AI agents, including LLM sales channels.
- **Store is a node, not a channel**: vendors bundle POS + store inventory + store fulfilment with the
  OMS (Manhattan Active Omni, Oracle Xstore integration, Salesforce unified POS inventory) [8][51][15].
- **Returns are becoming "reverse orchestration"**: return routing, condition-based disposition,
  re-commerce, return-to-vendor feeding stock back to ATP [33][37][41].
- **Pharmacy relevance**: lot / serial / expiry tracking in inventory is explicitly sold only by Kibo
  among the seven [33]; Saudi pharmacy chain **Nahdi** runs Fluent [31]; Brazilian pharmacy chain
  **Raia Drogasil** is a named Manhattan customer [7]; Walgreens is named by Blue Yonder [37].

---

## 2. Capability taxonomy (matrix rows)

Tier key: **TS** = Table stakes (every serious vendor sells it; absence disqualifies) ·
**C** = Common (most leaders sell it) · **D** = Differentiator (few vendors, or new in 2025–26).

### OC — Order capture & orchestration

| ID | Capability | Plain-English description (CFO-readable) | Tier |
|---|---|---|---|
| OC-01 | Omnichannel order hub | One record of every order whatever channel it came from (web, app, store, call centre, marketplace). | TS |
| OC-02 | Order lifecycle orchestration | The system moves each order through its steps (pay, allocate, pick, ship, deliver) and handles exceptions automatically. | TS |
| OC-03 | Configurable fulfilment workflows | Business users can change the steps an order goes through without a code release. | C |
| OC-04 | Holds & SLA management | Orders can be paused (fraud, compliance, customer request) without breaking delivery-time KPIs. | C |
| OC-05 | B2B / contract orders | Same engine handles wholesale/contract orders (net terms, contract pricing, time-phased promises). | C |
| OC-06 | Subscriptions / recurring orders | Repeat orders (e.g. monthly refills) generated and fulfilled through the normal order flow. | D |
| OC-07 | Drop-ship / vendor portal | Suppliers receive and fulfil orders directly to the customer through a portal or EDI. | C |
| OC-08 | Mixed physical / digital / service lines | One order can contain goods, digital items and services (e.g. a consultation). | D |

### DOM — Distributed order management / sourcing

| ID | Capability | Plain-English description | Tier |
|---|---|---|---|
| DOM-01 | Rules-based sourcing | Picks which warehouse or store fulfils each order by distance, stock, priority. | TS |
| DOM-02 | Split / consolidate / failover | Splits orders when needed, minimises split shipments, re-routes automatically if a node rejects. | TS |
| DOM-03 | Cost-to-serve / margin-optimised sourcing | Chooses the node that minimises total cost (shipping, labour, markdown risk) while keeping the promise. | D |
| DOM-04 | Node capacity limits | Caps how many orders a store/DC is given per day so it is not overloaded. | C |
| DOM-05 | Sourcing simulation / what-if | Test a new routing strategy on historical orders before switching it on. | D |
| DOM-06 | A/B testing of sourcing on live orders | Run two routing strategies side-by-side on real orders and keep the winner. | D |
| DOM-07 | Explainable routing | Shows in plain language *why* an order went to a given location. | D |
| DOM-08 | Cross-border fulfilment | Handles orders fulfilled from another country (duties, carriers, currencies). | C |

### INV — Inventory visibility & promising

| ID | Capability | Plain-English description | Tier |
|---|---|---|---|
| INV-01 | Real-time network inventory | Live stock across stores, DCs, in-transit, vendors in one view. | TS |
| INV-02 | Available-to-promise (ATP) to channels | Websites/apps show only what can really be sold, per location. | TS |
| INV-03 | Safety stock rules | Hold back a buffer per item/location so the store is not oversold. | C |
| INV-04 | Inventory segmentation / channel allocation | Ring-fence stock for a channel, region or campaign. | C |
| INV-05 | Future / in-transit inventory (pre-order, backorder) | Sell stock that is arriving with a dated promise. | C |
| INV-06 | Delivery-date promising pre-purchase | Show "arrives Tuesday / ready in 2 hours" on product and search pages. | C |
| INV-07 | Capacity- & carrier-aware promising | The promise accounts for store labour capacity and carrier transit times. | D |
| INV-08 | Lot / serial / expiry tracking | Inventory carries batch, serial and expiry date (critical for pharmacy). | D |
| INV-09 | AI stock-out prediction / rebalancing | Predicts stock-outs and moves stock or orders before they happen. | D |

### STR — Store fulfilment

| ID | Capability | Plain-English description | Tier |
|---|---|---|---|
| STR-01 | Ship-from-store | Online orders packed and shipped from a store's shelf stock. | TS |
| STR-02 | BOPIS / click & collect | Buy online, pick up in store, with "ready" notifications. | TS |
| STR-03 | Curbside pickup | Customer collects at the kerb; store notified on arrival. | C |
| STR-04 | Store associate fulfilment app | Mobile app for pick waves, pack, labels, handover. | TS |
| STR-05 | Substitutions at pick | Associate can substitute an out-of-stock item during picking. | D |
| STR-06 | Ship-to-store / transfers | Stock moved to the pickup store from another node. | C |
| STR-07 | Unified POS + OMS | Store tills, endless aisle and online orders on the same platform. | D |
| STR-08 | Store inventory ops (counts, RFID) | Cycle counts, receiving, RFID in the same app. | C |

### DLV — Delivery & last mile

| ID | Capability | Plain-English description | Tier |
|---|---|---|---|
| DLV-01 | Same-day / local delivery | Fulfils same-day home delivery from a nearby node. | C |
| DLV-02 | Carrier integration & rate shopping | Books carriers and chooses the cheapest/fastest per parcel. | C |
| DLV-03 | Delivery / handling fees per method | Delivery and pickup fees tied to the fulfilment method for finance reporting. | D |
| DLV-04 | Shipment tracking & customer notifications | Customer sees status and gets messages at each step. | TS |

### RET — Returns & exchanges

| ID | Capability | Plain-English description | Tier |
|---|---|---|---|
| RET-01 | Returns with refund (RMA) | Create a return authorisation, receive goods, refund. | TS |
| RET-02 | Exchanges | Swap an item instead of refund. | TS |
| RET-03 | Return anywhere / BORIS | Return an online order in any store. | C |
| RET-04 | Return routing & disposition | Rules decide where a return goes and whether it is restocked, marked down, returned to vendor or scrapped. | D |
| RET-05 | Self-service returns | Customer starts a return online with eligibility/window rules. | C |

### CS — Customer service

| ID | Capability | Plain-English description | Tier |
|---|---|---|---|
| CS-01 | Agent console with full order context | One screen with order, payment, shipment and customer history. | TS |
| CS-02 | Order modification / cancel | Agent changes address, items or cancels before shipment. | TS |
| CS-03 | Appeasements / credits / reship | Agent issues goodwill credit, discount or re-ship. | C |
| CS-04 | Order on behalf of customer | Call-centre agent places a new order for the customer. | C |
| CS-05 | Customer self-service (WISMO) | Customer checks status, cancels or modifies without calling. | C |

### PAY — Payments

| ID | Capability | Plain-English description | Tier |
|---|---|---|---|
| PAY-01 | Authorise / capture on fulfilment / refund | Card authorised at order, captured when shipped, refunded on return. | TS |
| PAY-02 | Partial capture / partial refund | Handles split shipments and partial returns financially. | C |
| PAY-03 | Failed-payment recovery | Automatically retries or recovers failed payments. | D |

### PRC — Pricing & promotions touchpoints

| ID | Capability | Plain-English description | Tier |
|---|---|---|---|
| PRC-01 | Omnichannel promotions in the order | One promotion logic across store, web and call centre. | D |
| PRC-02 | Contract / B2B pricing in the order | Customer-specific price lists honoured on the order. | C |

### ANA — Analytics

| ID | Capability | Plain-English description | Tier |
|---|---|---|---|
| ANA-01 | Operational dashboards / SLA at-risk flags | Live view of late, stuck, at-risk orders. | TS |
| ANA-02 | Fulfilment analytics & benchmarking | Cost, speed and split-rate analysis; peer benchmarking. | D |
| ANA-03 | Natural-language analytics | Ask questions of order data in plain language, no SQL. | D |

### INT — Integration & architecture

| ID | Capability | Plain-English description | Tier |
|---|---|---|---|
| INT-01 | Open APIs (REST) | Every function callable from other systems. | TS |
| INT-02 | Pre-built connectors / integration platform | Ready connectors to ERP, e-commerce, carriers, payments. | C |
| INT-03 | Cloud-native SaaS, versionless upgrades | Vendor-run, upgrades without projects. | C |
| INT-04 | MCP server / agent-ready APIs | External AI agents (and AI shopping channels) can query and act on orders. | D |
| INT-05 | Composable / modular adoption | Buy one module (e.g. inventory hub) alongside an existing OMS. | C |

### CFG — Configurability

| ID | Capability | Plain-English description | Tier |
|---|---|---|---|
| CFG-01 | Business-user rules / low-code | Ops teams change rules without IT. | C |
| CFG-02 | Natural-language configuration | Describe a rule change in plain language; AI drafts it, human approves. | D |

### AI — AI / agentic

| ID | Capability | Plain-English description | Tier |
|---|---|---|---|
| AI-01 | Customer-service AI agent / copilot | AI answers order questions and executes simple changes, escalates to humans. | C (2026) |
| AI-02 | Store-associate AI agent | AI helps store staff with tasks and questions. | D |
| AI-03 | Autonomous optimisation agent | Agent monitors KPIs and tunes settings toward a goal within guardrails. | D |
| AI-04 | Event-triggered AI playbooks | Saved AI tasks that run on a schedule or on an order event. | D |

### OPS — Operations & scale

| ID | Capability | Plain-English description | Tier |
|---|---|---|---|
| OPS-01 | Multi-country / multi-language / multi-currency | One instance runs several countries, languages and currencies. | C |
| OPS-02 | Peak-scale order capture | Proven to absorb peak-day volumes. | C |
| OPS-03 | Security certifications (SOC 2, PCI) | Third-party audited security. | TS |

**Row count: 69** across 14 domains.

---

## 3. Coverage table

Columns: **MAN** Manhattan Active Omni · **SF** Salesforce OM · **IBM** Sterling OMS (+SIP) ·
**FLU** Fluent · **KIBO** Kibo · **BY** Blue Yonder · **ORA** Oracle Retail OMS Suite.
✔ = vendor-confirmed · partial = add-on / partner / limited · ? = not confirmed publicly.

| ID | MAN | SF | IBM | FLU | KIBO | BY | ORA |
|---|---|---|---|---|---|---|---|
| OC-01 | ✔[7] | ✔[13] | ✔[19] | ✔[2] | ✔[33] | ✔[37] | ✔[44] |
| OC-02 | ✔[7] | ✔[13] | ✔[19] | ✔[2] | ✔[33] | ✔[37] | ✔[42] |
| OC-03 | ✔[7] | ✔[13] drag-and-drop | ? | ✔[2] (secondary)[27] | ✔[33] | ? | ? |
| OC-04 | ? | ? | ? | ? | ✔[34] | ✔[38] smart queues | ? |
| OC-05 | ? | ✔[13] | ✔[19] | ✔[2] Forrester-noted | ✔[33] | ✔[37] | partial[46] Fusion |
| OC-06 | ? | ? | ? | ? | ✔[33] add-on | ? | ? |
| OC-07 | ? | ? | ? | ? | ✔[33] | ✔[37] | ✔[42] Supplier Direct |
| OC-08 | ? | ✔[15] Sept '26 | ? | ? | ? | ? | ? |
| DOM-01 | ✔[7] | ✔[13] | ✔[19] | ✔[2] | ✔[33] | ✔[37] | ✔[42] |
| DOM-02 | ✔[7] | ✔[13] | ? | ✔[2] | ✔[33][34] | ✔[37] | ✔[42] |
| DOM-03 | ✔[7] | ✔[15] Sept '26 | ✔[20] | ✔[28][29] | ✔[33] | ✔[37] | ✔[42] Science Engine |
| DOM-04 | ? | ? | ✔[26] | ? | ✔[33] | ✔[40] | ? |
| DOM-05 | ✔[12] (secondary) | ? | ? | ? | ? | ✔[38] | ? |
| DOM-06 | ? | ? | ? | ✔[29] (secondary) | ? | ? | ? |
| DOM-07 | ? | ? | ✔[20] | ✔[28] | ✔[34] | ✔[38] | ? |
| DOM-08 | ✔[7] | ? | ? | ✔[31] (secondary) | ? | ? | ? |
| INV-01 | ✔[7] | ✔[13] | ✔[21] | ✔[2] | ✔[33] | ✔[37] | ✔[42] |
| INV-02 | ✔[7] | ✔[13] | ✔[21] | ✔[2] | ✔[33] | ✔[40] | ✔[42] |
| INV-03 | ? | ✔[13] | ✔[21] | ? | ✔[33] | ✔[37] | ? |
| INV-04 | ✔[7][3] | ? | ? | ? | ✔[33] | ? | ? |
| INV-05 | ? | ✔[13] Future Stock | ? | ? | ✔[33] | ✔[37] | ? |
| INV-06 | ✔[7] | ✔[13][15] | ✔[20] | ? | ✔[33] | ✔[40] | ? |
| INV-07 | ✔[7] | ✔[13] carrier transit | ✔[20][26] | ? | ✔[33] cut-offs | ✔[40] | ? |
| INV-08 | ? | ? | ? | ? | ✔[33] | ? | ? |
| INV-09 | ? | ? | ? | ? | ? (roadmap)[34] | ✔[37] | ? |
| STR-01 | ✔[7] | ✔[13] (secondary detail) | ✔[19] | ✔[2] | ✔[33] | ✔[39] | ✔[43] |
| STR-02 | ✔[7] | ✔[13] | ✔[19] | ✔[2] | ✔[33][36] | ✔[39] | ✔[43] |
| STR-03 | ✔[9] | ? | ✔[19] | ? | ✔[33] | ? | ? |
| STR-04 | ✔[9] | ✔[13] | ✔[25] | ✔[2] (secondary)[27] | ✔[33] | ✔[39] | ✔[43] Store Connect |
| STR-05 | ? | ? | ? | ? | ✔[33] | ? | ? |
| STR-06 | ✔[7] | ? | ✔[19] | ? | ✔[33] | ? | ✔[42] |
| STR-07 | ✔[8][10] | partial[15] unified inventory | partial[25] | ? | ? | ? | partial[51] Xstore |
| STR-08 | ✔[7][9] RFID | ? | ? | ? | ? | ? | ? |
| DLV-01 | ✔[7] | ✔[13] | ? | ✔[2] (MediaWorld) | ✔[33] | ? | ✔[42] |
| DLV-02 | ? (TMS separate)[7] | ✔[15] Delivery Service | partial (separate TMS) | ? | ✔[33] | ✔[40] | ? |
| DLV-03 | ? | ? | ? | ? | ✔[34] | ? | ? |
| DLV-04 | ✔[7] | ✔[13] | ✔[20] | ? | ✔[33] | ✔[38] | ✔[43] |
| RET-01 | ✔[7] | ✔[16] | ✔[22] | ✔[2] | ✔[33] | ✔[37] | ✔[44] |
| RET-02 | ? | ✔[16] | ✔[23] | ✔[2] | ? | ? | ✔[44] |
| RET-03 | ✔[7] | ? | ? | ? | ✔[36] | ✔[39] | ? |
| RET-04 | ✔[7] | ? | ✔[22] | ? | ✔[33] | ✔[37][41] | partial[44] courier pickup |
| RET-05 | ✔[7] | ✔[13] | ? | ? | ✔[33] | ✔[37] | ? |
| CS-01 | ✔[7] | ✔[13] | ✔[23] | ✔[2] (secondary)[27] | ✔[33] | ✔[38] | ✔[44] |
| CS-02 | ✔[7] | ✔[16] | ✔[23] | ? | ✔[33] | ✔[38] | ✔[44] |
| CS-03 | ? | ✔[16] replacements | ✔[23] coupon | ? | ✔[33] | ? | ✔[44] refunds |
| CS-04 | ? | ✔[13] | ✔[23] | ? | ? | ✔[38] | ✔[44] |
| CS-05 | ✔[7] | ✔[13] | ✔[20] | ? | ✔[33] | ? | ? |
| PAY-01 | ? | ✔[17] | ? | ? | ✔[33] refunds | ? | ✔[44] |
| PAY-02 | ? | partial[17] via Adyen | ? | ? | ✔[33] per-line | ? | ? |
| PAY-03 | ✔[7] | ? | ? | ? | ? | ? | ? |
| PRC-01 | ✔[7][10] | ? | ? | ? | ? | ? | ? |
| PRC-02 | ? | ✔[13] | ✔[19] (CPQ separate) | ? | ✔[33] | ✔[37] contract-aware | ? |
| ANA-01 | ✔[7] | ✔[15] Slack insights | ? | ✔[2] (secondary)[27] | ✔[33] | ✔[38] | ? |
| ANA-02 | ✔[7] benchmarking | ? | ? | ? | ✔[35] | ? | ✔[42] statistics |
| ANA-03 | ✔[12] (secondary) | ✔[15] | ✔[24] | ✔[28] | ✔[35] | ✔[38] | ? |
| INT-01 | ✔[7] | ✔[17] | ✔[19] | ✔[2] | ✔[33] | ✔[37] | ✔[42] REST |
| INT-02 | ? | ✔[14] | ✔[24] watsonx | ✔[2] Fluent Connect | ✔[33] Connect Hub | ✔[37] | ✔[42] OCDS/Xstore |
| INT-03 | ✔[7] 90-day | ✔[14] | partial[20] SaaS or containers | ✔[2] | ✔[33] | ✔[37] | ✔[45] |
| INT-04 | ? | ✔[15] | ✔[24] | ✔[2] | ✔[35] | ? | ? |
| INT-05 | ✔[1] (framing) | ✔[14] Order Visibility edition | ✔[20] modular | ✔[2] MACH | ✔[33] MACH | ✔[37] | ✔[42] |
| CFG-01 | ✔[7] low/no-code | ✔[13] | ? | ✔[2] | ✔[33] no-code | ? | ✔[42] |
| CFG-02 | ✔[12] Config Agent (secondary) | ✔[15] | ? | ✔[28] | ✔[35] | ✔[38] | ? |
| AI-01 | ✔[7] Maven, [12] | ✔[18][13] | ✔[23] | ? | ✔[33] | ✔[38] | ? |
| AI-02 | ✔[12] (secondary) | ? | ? | ? | ? | ✔[37] | ? |
| AI-03 | ? | ✔[15] reroutes exceptions | ? | partial[28] recommends | ✔[35] Optimize | ✔[37] Rebalancer | ? |
| AI-04 | ? | ? | ? | ? | ✔[35] Playbooks | ? | ? |
| OPS-01 | ✔[7] cross-border | ✔[14] localisation | ? | ✔[2] 70+ countries | ? | ? | ? |
| OPS-02 | ✔[7] high-demand | ? | ✔[19] peak | ? | ? | ? | ? |
| OPS-03 | ? | ? | ? | ✔[2] SOC 2 | ✔[33] SOC 2, PCI L1 | ? | ? |

Reading the "?" cells: many are capabilities the vendor very probably has but does not market on
a public page (e.g. payment capture in Manhattan/IBM). For a management deck, treat "?" as "not
publicly claimed", not "absent".

---

## 4. Per-product notes

| Product | Positioning | Notable strengths | Pricing (public) | Named customers (★ = health/pharmacy or Middle East) |
|---|---|---|---|---|
| **Manhattan Active Omni** | One cloud-native app unifying POS, order management, customer service and store inventory/fulfilment [8]; versionless, features every 90 days [7]. | Forrester Leader, 5.0 in 20/27 criteria incl. inventory segmentation, store inventory, orchestration rules [3]; unified POS+OMS; Maven agentic chatbot [7]; Apr 2026 Store Associate, Contact Centre and OMS Configuration agents + Fulfilment Optimisation Simulation [12 (secondary)]. ActiveStore editions Essentials/Enterprise/Premier [11]. | Not public. | PacSun, Michaels, Crocs, Carhartt, Floor & Decor, **★ Raia Drogasil (Brazil pharmacy)** [7]. |
| **Salesforce OM** | OMS native to Commerce/Service Cloud; strongest when the CRM and storefront are Salesforce [13][14]. | Agent console + Agentforce order self-service [18][13]; cost-based routing (GA Sept '26), natural-language routing changes, MCP server for OMS [15]; Omnichannel Inventory with Safety Stock & Future Stock metrics [13]. Payments rely on Salesforce Payments/Stripe/Adyen connectors [17]. | Editions *Order Visibility* and *Growth* ("up to 50 locations"), "Contact for pricing" [14]; GMV-% figures circulate only in secondary sources. | Not named on product page. |
| **IBM Sterling OMS** | The long-standing enterprise incumbent; OMS + Intelligent Promising + Inventory Visibility + Store Engagement + Call Center suite [19][20]. | Promising to 15-minute windows and cost-based AI promising [20]; safety-stock rules across nodes [21]; watsonx gen-AI call-centre assistant [23]; Apr 2026 OMS Agentic AI Toolkit via MCP + watsonx Orchestrate [24]; SaaS or on-prem containers [20]. | Not public. | World Market, hagebau, Ulta Beauty [19]. |
| **Fluent Order Management** | "AI-native", MACH, SaaS-only; fast deployment (8 weeks claimed) [2]. | Forrester Leader, stood out in workflows, orchestration rules, B2B [2][4]; June 2026 natural-language sourcing agent with human approval [28]; AI A/B testing of sourcing on live orders [29]; MCP server and LLM sales channels (ChatGPT, Gemini) [2]; 70+ countries / 50+ languages, SOC 2 [2]. | **Published model**: *Fluent Light* (≤500k orders/yr, 10 nodes, 20k SKUs) and *Fluent Enterprise* priced by order volume [30]. | Psycho Bunny, MediaWorld, Breitling [2]; **★ Nahdi Medical Co. (Saudi pharmacy, 140+ cities, UAE cross-border)** [31]. |
| **Kibo (KIBO)** | Unified commerce + OMS on one data model, B2B and B2C [33]. | Broadest *published* feature list: lot/serial/expiry, substitutions, capacity limits, subscriptions, vendor portal, carrier rate shopping [33]; Order Routing Explain Agent (Apr 2026) [34]; KIBO AI GA Aug 2026 — Engage/Configure/Explain/Analyze/Optimize, model-agnostic, event-triggered Playbooks [35]. Forrester OMS Leader (vendor-reported) [33]. | Not public ("Pricing & Packaging" page; Forrester TEI-based ROI estimator) [33]. | Office Depot, Ace Hardware, Hugo Boss, **★ Al-Futtaim (UAE)** [33][35]. |
| **Blue Yonder OM** | OMS tied to Blue Yonder's planning/supply-chain suite — "order-driven demand planning" [38]. | Fulfilment Sourcing Simulator + Intelligent Rebalancer; Fulfilment Agent and Customer Service Agent (Jan 2026) [38]; ML stock-out prediction and safety-stock optimisation; Smart Disposition returns, recommerce [37]; Commits Service ATP dates using node capacity + carrier transit [40]. | Not public. | REI, Asda, Stanley 1913, **★ Walgreens** [37]. |
| **Oracle Retail OMS Suite** | Order Orchestration (routing engine, formerly Order Broker) + Order Administration (CSR/order maintenance), tightly coupled to Oracle Xstore POS and Merchandising [42][44][51]. | Standard vs Weighted brokering (Science Engine: labour cost, margin, proximity) [42]; Store Connect associate portal for pick/ship/pickup [43]; Supplier Direct Fulfillment drop-ship portal [42]; returns courier pickup via Collect & Receive [44]. Least visible AI messaging of the seven. | Not public. | Not named in sources found. IDC 2023 Leader placement was for **Fusion** OM (manufacturing) [46]. |

---

## 5. AI and "modern" differentiators in 2026

| Theme | What vendors demo | Who (evidence) |
|---|---|---|
| **Explain-why agents** | Ask "why did order X go to store Y?" and get the locations considered, rules applied, and the reason. "Investigation time drops from hours to seconds." | Kibo [34], Blue Yonder [38], Fluent [28], IBM (transparent promising) [20] |
| **Natural-language configuration with human approval** | Describe a sourcing change in plain words; the agent drafts it; a human approves before it applies. | Fluent [28], Manhattan OMS Configuration Agent [12 (secondary)], Kibo Configure [35], Salesforce [15], Blue Yonder [38] |
| **Role-based embedded agents** | Store-associate agent, contact-centre agent, fulfilment agent, inside the OMS UI. | Manhattan [12 (secondary)], Blue Yonder [38], IBM call-centre gen-AI [23], Salesforce Agentforce order support [18] |
| **Autonomous optimisation** | Set an objective (SLA, margin, allocation), the agent tunes settings / reroutes exceptions itself. | Kibo Optimize [35], Salesforce agentic routing [15], Blue Yonder Rebalancer [37] |
| **Sourcing simulation & live A/B tests** | Replay order history against new strategies; run two strategies on live traffic. | Manhattan [12 (secondary)], Blue Yonder [38], Fluent [29 (secondary)] |
| **Profit-aware promising** | Cost-to-serve routing; promise dates on search pages to 15-minute windows; capacity + carrier in the date. | Salesforce [15], IBM [20], Blue Yonder [40][37] |
| **MCP / agent-ready OMS** | External AI agents (incl. ChatGPT/Gemini shopping) query and act on orders through an MCP server. | Salesforce [15], Kibo [35], IBM [24], Fluent [2] |
| **Event-triggered AI playbooks** | Saved prompts that run on schedule or on an order event. | Kibo [35] |
| **Natural-language analytics / Slack** | Ops asks questions of order data in chat; insights pushed into Slack. | Kibo Analyze [35], Salesforce [15], Blue Yonder [38] |

Reality check: Forrester's Q1 2026 commentary says agentic commerce disruption "comes more from
market hype than from reality" for now (secondary, via search summary of Kibo coverage); and one
analyst note reports Manhattan's agent pilots as 90-day *paid* engagements, with revenue impact a
2027 story (secondary, Zacks). Most AI claims above are vendor press releases from 2026.

---

## 6. Sources

All accessed 2026-11-03.

1. Forrester blog, "Order Management Systems And A Story Of Augmented Evolution" (21 Jan 2025) — https://www.forrester.com/blogs/order-management-systems-and-a-story-of-augmented-evolution/
2. Fluent Commerce, Fluent Order Management / Forrester Wave Leader page — https://fluentcommerce.com/22373-2/ (vendor-reported analyst placement)
3. Manhattan, "The Forrester Wave: Order Management Systems, Q1 2025" — https://www.manh.com/en-sg/our-insights/resource-types/research-reports/the-forrester-wave-oms (vendor-reported)
4. SupplyChainBrain, "The Forrester Wave: Order Management Systems, Q1 2025" — https://supplychainbrain.com/articles/41221-the-forrester-wave-order-management-systems-q1-2025 (secondary)
5. Fluent Commerce, Gartner Market Guide for Distributed Order Management Systems (30 Jun 2025) — https://fluentcommerce.com/?p=25303 (vendor-reported)
6. SAP News, "SAP Order Management services a Leader in IDC MarketScape: Worldwide AI-Enabled Order Orchestration and Fulfillment Applications for Retail and B2C 2026" (13 Aug 2026) — https://news.sap.com/2026/08/sap-order-management-services-a-leader-idc-marketscape-worldwide-ai-enabled-order-orchestration-fulfillment-applications-retail-b2c-2026-vendor-assessment/ (vendor-reported)
7. Manhattan, Order Management System product page — https://www.manh.com/solutions/omnichannel-software-solutions/order-management-system
8. Manhattan, Omnichannel software solutions (Active Omni) — https://www.manh.com/solutions/omnichannel-software-solutions
9. Manhattan, Store Inventory and Fulfillment — https://www.manh.com/solutions/omnichannel-software-solutions/store-inventory-fulfillment
10. Manhattan, Point of Sale — https://www.manh.com/solutions/omnichannel-software-solutions/point-of-sale-software
11. Manhattan, ActiveStore — https://www.manh.com/solutions/omnichannel-software-solutions/activestore
12. Manhattan press release "Latest Enhancements for Retailers" (Jan 2026) — https://ir.manh.com/node/21136 (blocked to fetch); coverage: IT Brief, "Manhattan adds AI agents, fulfilment tools for retailers" — https://itbrief.com.au/story/manhattan-adds-ai-agents-fulfilment-tools-for-retailers (secondary)
13. Salesforce, Order Management product page — https://www.salesforce.com/commerce/order-management/
14. Salesforce, Order Management editions & pricing — https://salesforce.com/editions-pricing/commerce-cloud/order-management/
15. Salesforce, Commerce innovations (Summer/Sept '26 items) — https://www.salesforce.com/commerce/innovations/
16. Salesforce Trailhead, "Increase Service Excellence with Commerce Cloud" — https://trailhead.salesforce.com/content/learn/modules/improved-service-commerce-and-service-cloud/increase-service-excellence-with-commerce-cloud
17. Salesforce Developers, ConnectApi.Payments (capture/refund) — https://developer.salesforce.com/docs/atlas.en-us.242.0.apexref.meta/apexref/apex_ConnectAPI_Payments_static_methods.htm ; Adyen, Salesforce OMS plugin — https://docs.adyen.com/plugins/salesforce-order-management-system
18. Business Wire, Salesforce "Agentforce for Retail" incl. Commerce Skills for Order Management (10 Jan 2025) — https://www.businesswire.com/news/home/20250110389338/en
19. IBM, Sterling Order Management — https://ibm.com/products/order-management
20. IBM, Sterling Intelligent Promising — https://www.ibm.com/products/intelligent-promising/promising
21. IBM, Sterling Inventory Visibility — https://www.ibm.com/products/intelligent-promising/inventory-visibility
22. IBM Docs, Sterling OMS Essentials Edition (returns: creation, approval, disposition, refund) — https://www.ibm.com/docs/en/order-management?topic=overview-sterling-order-management-system-essentials-edition
23. IBM, "Announcing our generative AI-enabled IBM Sterling Call Center" — https://www.ibm.com/new/announcements/announcing-our-generative-ai-enabled-ibm-sterling-call-center
24. IBM, "Introducing the Sterling OMS Agentic AI Activation Package from IBM Expert Labs" (15 Apr 2026) — https://www.ibm.com/new/announcements/introducing-the-sterling-oms-agentic-ai-activation-package-from-ibm-expert-labs
25. IBM, Sterling Store Engagement — https://www.ibm.com/products/store-engagement
26. IBM Docs, Integrating with Sterling Intelligent Promising Capacity service — https://www.ibm.com/docs/en/SSGTJF/oms_sip_optimizer_integration/oms_sip_capacity_integration_overview.html
27. ERP Research, Fluent Commerce profile — https://erpresearch.com/erp-add-ons/retail/fluent-commerce (secondary)
28. Fluent Commerce, AI agent for order sourcing (16 Jun 2026) — https://fluentcommerce.com/?p=26155
29. eCommerceNews, "Fluent Commerce adds AI A/B testing to order sourcing" (Jan 2026) — https://ecommercenews.com.au/story/fluent-commerce-adds-ai-a-b-testing-to-order-sourcing (secondary)
30. Fluent Commerce, Pricing — https://fluentcommerce.com/pricing/
31. Retail Technology, "Nahdi upgrades OMS" (15 Oct 2024) — https://retailtechnology.co.uk/news/8300/nahdi-upgrades-oms (secondary)
32. (unused)
33. Kibo, Order Management System platform page — https://kibocommerce.com/platform/order-management/
34. Kibo, Q1 2026 product releases (29 Apr 2026) — https://kibocommerce.com/press-events/kibo-q1-2026-product-releases-agentic-commerce-order-management/
35. Kibo, "KIBO AI unifies agentic commerce and OMS" (3–5 Aug 2026) — https://kibocommerce.com/press-events/kibo-ai-unified-agentic-commerce-oms/
36. Kibo Docs, Buy Online Pickup In Store — https://docs.kibocommerce.com/concept-guides/bopis
37. Blue Yonder, Order Management & Commerce — https://blueyonder.com/solutions/order-management-and-commerce
38. Blue Yonder blog, "On the road to Cognitive: Intelligent and agentic Blue Yonder Order Management" (9 Jan 2026) — https://blueyonder.com/blog/2026/on-the-road-to-cognitive-intelligent-and-agentic-blue-yonder-order-management
39. Blue Yonder, Store Fulfillment — https://blueyonder.com/solutions/order-management-and-commerce/store-fulfillment
40. Blue Yonder FAQ, "What is the Blue Yonder Commits Service?" — https://info.blueyonder.com/order-management-commerce/what-is-the-blue-yonder-commits-service
41. Blue Yonder FAQ, "What is Returns Management?" — https://info.blueyonder.com/returns-management/what-is-returns-management
42. Oracle Docs, Order Orchestration Routing Engine Overview (Retail OMS Suite Cloud 24.1.101.0) — https://docs.oracle.com/en/industries/retail/retail-oms-suite-cloud/24.1.101.0/roboh/Locate_overview.htm
43. Oracle Docs, Store Connect Overview (Order Broker Cloud 23.1.101.0) — https://docs.oracle.com/en/industries/retail/retail-order-broker-cloud/23.1.101.0/roboh/Store_Connect_Overview.htm
44. Oracle, Retail Order Administration / Order Management Cloud Service datasheet — https://oracle.com/kr/a/ocom/docs/industries/retail/order-management-cloud-service.pdf ; Oracle Docs, Collect and Receive returns integration — https://docs.oracle.com/en/industries/retail/retail-oms-suite-cloud/24.1.101.0/omsix/c_collect_and_receive.htm
45. Oracle Docs, Retail OMS Suite Cloud Service 26.1 Getting Started — https://docs.oracle.com/en/industries/retail/retail-oms-suite-cloud/26.1.101.0/romoh/c_contents.htm
46. Oracle, "What are analysts saying about Oracle Fusion Cloud Order Management?" (IDC MarketScape 2023, manufacturing) — https://www.oracle.com/scm/order-management/idc-marketscape (vendor-reported)
47–50. (unused)
51. Oracle Docs, Xstore POS — Order Transactions Through Order Orchestration Cloud Service (24.0) — https://docs.oracle.com/en/industries/retail/retail-xstore-point-of-service/24.0/rpxmo/order-transactions-order-broker-cloud-service.htm
