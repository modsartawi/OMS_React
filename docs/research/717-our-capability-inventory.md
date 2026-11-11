# 717 — Our capability inventory (the "us" column)

Research note for wayfinder map 717, ticket 721 ("What does our platform do today?").
Compiled 2026-11-03 from local trackers, ADRs, glossaries and the BackOffice owner's memory notes.
**No production or staging system was queried for this note.** Every state below comes from what
those records say, and the records lag reality in both directions. Where they say nothing reliable,
the row says **Unverified** and gives the reason.

## How to read the State column

| State | Meaning used here |
|---|---|
| **Live** | The records show it running in production for real customers, stores or finance users. |
| **Piloting** | Running in production at a few stores, or as a time-boxed trial or sample. |
| **Built-not-deployed** | Code is finished and merged. Something is still owed before production: SQL scripts, a deploy, grants, an owner walk-through, or a push. Some of these run on **staging**. |
| **Partial** | Some of it is built or live, and an important part is not. |
| **Unverified** | Built, and possibly live, but no record says so with confidence. The row gives the reason. |

**Demo-able on staging?** means yes only where an oms-react "calls the real doors on staging" ticket
is marked done, or where the backend is live and the screen reads it. "local" means the screen has
been driven against a developer's own copy of the backend, which is not a staging demo.

---

## 1. Summary

- **What it is.** We built the full order-to-cash platform for a pharmacy and health-retail chain in
  KSA and Bahrain. It covers the store tills, online orders, delivery-app orders, the call centre,
  in-store picking and store-to-store transfers, insurance claims, e-prescriptions, regulatory serial
  tracking, promotions, loyalty, cash collection and settlement, and posting to SAP.
- **Two codebases.** **BackOffice** (C#) holds the till software, the central API (SIS.Api), the
  SAP posting pipeline, the integrations and the rules engine. **oms-react** is the new web
  back-office portal that management will see.
- **Size of the web portal.** **73 feature screens** across **14 business areas**, with about **150
  routes**. The areas are admin, call centre, campaigns, collection, Deliverect, HungerStation,
  insurance rules, loyalty, materials, Nphies, OMS orders, pricing and reports. The portal started
  on 2026-07-17 and has **1,143 commits** in about 3.5 months.
- **Delivery record.** The oms-react tracker lists **~311 tickets done** against 45 open across 72
  efforts. The BackOffice tracker lists **~2,030 tickets done or shipped** against about 470 open and
  163 ready across **300 efforts**. BackOffice also has **120 architecture decision records**.
- **External integrations we run or have built (counted: 25+).** SAP (IDoc posting), Hybris
  (e-commerce), HungerStation, Deliverect (Jahez, Keeta and others), Nphies (national insurance
  exchange), Wasfaty/Wasfaty+ (MoH e-prescription), Waseel/Tawuniya referrals, Bupa orders, NUPCO
  Virtual and PillPack, the RSD/GS1 serial track-and-trace regime, OTO and Starlink (bonded-zone)
  couriers, Altibbi telemedicine, a lab partner, Al Rajhi Mokafaa, Qitaf, Tabby, Tamara, Geidea ECR card
  terminals, Juleb (warehouse), RELEX (demand planning), SPL national address, SMS gateways and email.
- **What is clearly live.** The till fleet with GS1 serial tracking. Hybris online orders.
  HungerStation orders posting to SAP on the new pipeline (since 2026-08-28). The new SAP IDoc
  pipeline for OTO, Altibbi, bonded-zone, lab-test and HungerStation sales (~28k entries across 588
  stores when it was measured on 2026-08-21). Nphies at the till. The store cash collection and
  settlement cycle (since mid-August). Two-step staff login. Auto-updating tills. Nightly
  "first purchase" customer flags (12M members). Al Rajhi Mokafaa on about 85% of stores.
- **What is piloting.** The new selling engine (NewPos) runs at a handful of stores, with insurance
  feedback from 5 stores. The RELEX demand export is a sample under review. The promotions engine
  pilot is tied to NewPos.
- **What is built but not yet live.** This is the largest group: dispatch callouts and scorecards,
  insurance rules with the FHIR language and playground, IDF priority, the rule-based promotion and
  loyalty engine, Deliverect, prescription sessions, pick support, serving lists, loyalty groups,
  and HungerStation promotions. Each waits on owner SQL, a deploy, grants or a walk-through.
- **How the inventory comes out.** **127 capabilities**: **25 Live**, **5 Piloting**, **50
  Built-not-deployed**, **16 Partial**, **31 Unverified**.
- **Demo-able on staging today, with evidence.** Materials search, stock check and GS1 check. The
  SAP export console. The store sync console's Transactions tab. HungerStation stores, orders,
  materials and stock. The finance settlement screen. Order and delivery inquiry. Most other web
  screens have been tested only against stubs or a local backend.

---

## 2. Capability inventory

Screen paths are relative to `src/features/`. "BO" means a BackOffice spec, map or ticket.

### 2.1 Order capture & channels

| ID | Capability | What it does (plain English) | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| OC-01 | Online orders (Hybris) | Website and app orders flow into our order system and are fulfilled by stores. | Live | `oms/document`, `oms/deliveries` | BO memory "Hybris live, Magento retired" | yes (inquiry parity signed off vs live API, BO 406) |
| OC-02 | HungerStation direct integration | Orders arrive from HungerStation, are invoiced, and post to SAP. Store stock and catalogue are pushed to HungerStation. | Live | `hungerstation/stores`, `orders`, `materials` | BO map 1330, spec 3028, ADR 0106 | yes (oms-react 557 done) |
| OC-03 | HungerStation promotions | Marketing creates HungerStation promotions in our portal and sends them to HungerStation. | Built-not-deployed (SQL 009-012 owed) | `hungerstation/promotions` | BO spec 3201, ADR 0114 | unknown |
| OC-04 | Deliverect (Jahez, Keeta and other apps) | One connection brings in orders from many delivery apps, each with its own SAP terms. | Built-not-deployed (SQL 001-010 unrun; staging tests in progress) | `deliverect/stores`, `orders`, `catalog`, `terms` | BO spec 2615, ADRs 0078-0080 | no (oms-react 483 open) |
| OC-05 | Bupa insurance orders | Bupa e-prescription orders become normal orders, with the patient's share worked out on the server. | Built-not-deployed (prod SQL owed) | `oms/document` | BO map 2107 | unknown |
| OC-06 | Lab bookings from the partner portal | A lab partner's bookings are pulled to any lab store and sold at the partner price. | Built-not-deployed (walks owed) | no screen | BO ADR 0059 | no |
| OC-07 | SGH hospital orders | A credit sales channel for a hospital partner, with status pushed back to it. | Partial (owner blockers) | `oms/document` | BO spec 2086 | no |
| OC-08 | Sales request / inquiry document | Captures a customer's request before it becomes an order. | Unverified (live-smoked in June; no rollout record) | `oms/document` | BO 055-057 | unknown |
| OC-09 | Order change without re-pricing | Staff change an online order or delivery without the price changing. Multi-line promotions stay intact. | Live (online orders only) | `oms/document` | BO 2614, map 1881 | unknown |
| OC-10 | Applied promotions kept from the website | Promotions applied online are stored with the order and protect its lines from edits that would break them. | Live (feed) / Partial (line guard) | `oms/document` | BO ADR 0061 | unknown |
| OC-11 | Invoice share link | The customer gets an invoice link by WhatsApp. | Built-not-deployed (DDL, smoke and partner app owed) | no screen | BO spec 2664, ADR 0082 | no |
| OC-12 | NUPCO Virtual & PillPack through Wasfaty+ | Government NUPCO prescriptions are dispensed through our stores and posted to SAP at commission. | Built-not-deployed (merged "inert") | no screen | BO spec 1367, map 2885 | no |
| OC-13 | Smart Acquisition Wasfaty portal | A separate web portal for winning Wasfaty prescription business. | Built-not-deployed (SQL 001-011 + config owed; UAT open) | no (own repo) | BO spec 3110 | no |
| OC-14 | Customer shows a QR instead of a phone number | The customer is identified by scanning a QR code, which avoids saying their number aloud. | Partial (wave mostly done; 1922 left) | no screen | BO map 1891 / spec 1911 | no |

### 2.2 Call centre & customer service

| ID | Capability | What it does | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| CS-01 | Web call-centre console | An agent finds the caller, builds a basket at live prices, sees the promotions the caller nearly qualifies for, applies coupons, picks a slot and a payment method, and submits. | Built-not-deployed (staging runbook exists; server tickets 786/787/800/801/804 open) | `callcenter/console` | oms-react map 126, specs 180/193; BO 785-804 | unknown |
| CS-02 | Desktop call-centre (CC2) | A rewritten call-centre screen in the desktop app that hands the order to the till engine. | Built-not-deployed (pilot and cutover phase not done) | no (WPF) | BO CC2 plan, map 244 | no |
| CS-03 | Customer location link | The agent texts the customer a link. The customer drops a GPS pin and the national short address is confirmed. | Built-not-deployed (dormant until go-live ticket 2492) | `callcenter/console` (LocationLinkPanel) | BO map 2448 / spec 2482, 3072 | no (oms-react 577 open) |
| CS-04 | Resend a member's invoice email | An agent resends a receipt email to the address we hold on file. | Built-not-deployed (owner step 2447 left) | `loy/member` (Invoices tab) | BO spec 2443 | unknown |
| CS-05 | Call-centre seat signs in like a till | Agents use the same secure login and role checks as store staff. | Unverified (POS 26.9.17 build; rollout not recorded) | no | BO 1845 | no |

### 2.3 Fulfilment & store operations

| ID | Capability | What it does | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| FS-01 | Store till (legacy POS) | The current till across the fleet: sale, return, insurance, serial capture and day close. | Live | no (desktop) | BO tracker | no |
| FS-02 | New selling engine (NewPos) | A modern till engine with atomic sales, a full audit trail, exact money handling and central pricing. | Piloting (3-store engine pilot, insurance feedback from 5 stores; 1 Oct go-live slipped) | `admin/engine-switch` | BO maps 1500, 2323, ADR 0093 | no |
| FS-03 | Picking verification | Every unit handed to a customer or courier is scanned against the order. Wrong picks are charged to the right line. | Live (prod incidents logged 2026-09-24) — extent unverified | `oms/document` | BO map 1693 / spec 1711, ADRs 0021-0031 | unknown |
| FS-04 | Store-to-store donor requests | When a store lacks stock, a nearby donor store (within 5 km) supplies it and the system tracks the hand-off. | Live (legacy + donor picking) | `oms/donor-requests`, `oms/failed-donor-transfers` | BO map 1757, ADRs 0037, 0069, 0085 | unknown |
| FS-05 | Donor transfer posted automatically | The stock transfer between stores is booked in the warehouse system with no manual entry. | Built-not-deployed (owner walk left) | `oms/failed-donor-transfers` | BO spec 2363, ADR 0062 | no |
| FS-06 | Donors on any picking source | Any order source, not only delivery, can raise a donor request. | Built-not-deployed (HQ SQL 018 owed) | `oms/donor-requests` | BO spec 3242, ADR 0116 | no |
| FS-07 | Open pick-up order protects its stock | An item reserved for a customer pick-up cannot be sold at the counter. Cancelling needs the customer's code. | Unverified (merged 2026-09-13; rollout not recorded) | `oms/document` | BO spec 1735/2170, ADR 0052 | unknown |
| FS-08 | Put-back list | Items from abandoned or cancelled picks are listed so they go back on the shelf. | Unverified | no screen | BO spec 1999 | no |
| FS-09 | Pick support console | Head-office support finds a stuck pick, sees the serials it holds, and releases it with a reason. | Built-not-deployed (HQ SQL 010-012 + grant owed) | `oms/pick-support` | BO spec 2685, ADR 0085 | no (oms-react 500 open) |
| FS-10 | Back office marks a delivery delivered | A granted user closes an out-for-delivery order that the courier never closed, and must give a reason. | Built-not-deployed (live walk left) | `oms/deliveries` | BO spec 2417, ADR 0065 | unknown |
| FS-11 | Delivery hand-over limit | Unclaimed deliveries close automatically after 72 hours. | Built-not-deployed (SQL 057 + go-live key owed) | no screen | BO spec 2904 | no |
| FS-12 | Central invoice | Head office invoices a delivered order that no till invoiced. | Built-not-deployed (walk 2102 left) | `oms/central-invoice` | BO spec 2094, ADR 0048 | unknown |
| FS-13 | Store change order with stock-at-scan | Store order changes go through the till, and stock is captured at the moment of scan. | Unverified | no | BO spec 280, ADRs 0002/0003 | no |
| FS-14 | Strict shift open & per-store shift lock | A manager must open the shift. One shift per store. The store's day follows the device clock. | Piloting (NewPos only) | no | BO 156-163 | no |
| FS-15 | Z-report amendment | A day-end Z report can be corrected, under an audit trail, until it is collected. | Built-not-deployed (cutover 1672 open) | no | BO spec 1663, ADR 0019 | no |
| FS-16 | Receipt replay | A lost or failed till sale is replayed centrally without double-posting to SAP. | Built-not-deployed (server done; web 476 open) | `admin/sync-console` (replay) | ADR 0076 | no |
| FS-17 | Offline till login | A till keeps working through a network outage on a cached password check. | Partial (core built; 830-834 open) | no | BO map 806, ADR 0009 | no |
| FS-18 | Wasfaty e-prescription dispense | MoH e-prescriptions are dispensed and priced (greater-of rule) and posted. | Live (legacy) / NewPos on new SAP rail built | no (desktop) | BO W00001, ADR 0075 | no |

### 2.4 Delivery & dispatch

| ID | Capability | What it does | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| DD-01 | Delivery inquiry & timeline | Find any delivery by number, order or mobile, and see its timeline including donor requests. | Live (backend); web Unverified in prod | `oms/deliveries`, `oms/document` | oms-react maps 068/402, 429 | yes |
| DD-02 | Competed delivery callout | An order is offered to nearby stores and the first to "take" it wins. Express orders compete first. | Built-not-deployed (SQL 056, grants, walks, rulings owed) | `oms/dispatch-board` | BO map 2936 / spec 2952 | no |
| DD-03 | Dispatch scorecard | Ranks stores on win rate and failed takes, with the courier's reason for each failure. | Built-not-deployed (3326 unpushed; oms-react 713-714 open) | `oms/dispatch-scorecard` | BO specs 2952, 3326 | no |
| DD-04 | Serving lists & store duty | Defines which stores may bid for each delivery type, and which are on duty. | Built-not-deployed (SQL + seed owed) | `oms/serving-lists` | BO spec 3042 | no |
| DD-05 | Callout widening | If no store takes an order, the search radius widens automatically (e.g. to 10 km). | Built-not-deployed (unpushed) | `oms/dispatch-board` (715/716 open) | BO spec 3326 | no |
| DD-06 | Express quick-commerce + OTO auto-courier | Express orders compete, and an OTO courier is booked only after a store takes the order. | Built-not-deployed (3307-3311 merged unpushed; SQL owed) | no (oms-react 712 open) | BO spec 3306 | no |
| DD-07 | OTO courier integration | Courier deliveries through OTO, with sales posted to SAP. | Live (on SAP rail since 2026-06-07) | `oms/deliveries` | BO SAP live-scope note | unknown |
| DD-08 | Bonded-zone courier (Starlink) | Bonded-zone deliveries and returns, with fees billed and credit notes issued. | Live (forward) / Partial (return fees, web return 295 open) | `oms/document` | BO SLNK, spec 1132 | no |
| DD-09 | Delivery statistics | Deliveries per store and per track, each counted once, plus trips. | Built-not-deployed (oms-react 488/492 open) | `oms/delivery-statistics` | BO brief 2641/2660, ADR 0081 | no |
| DD-10 | Geography master data | Cities and areas used to route and filter orders. | Unverified | `oms/geography` | BO spec 2469 | unknown |

### 2.5 Inventory & sourcing

| ID | Capability | What it does | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| IN-01 | Material search & detail | Search the product master and open its detail tabs. | Built-not-deployed (on staging; prod seed/grant owed) | `materials/search`, `materials/detail` | BO spec 2544 | yes (oms-react 455 done) |
| IN-02 | Available-to-promise stock check | Shows what any store can promise for an item right now. | Built-not-deployed (on staging) | `materials/stock-check` | BO spec 2544 | yes |
| IN-03 | RELEX demand export | Sends sales, stock and promotion history to RELEX for demand forecasting. | Piloting (100-store, one-week sample sent 2026-10-27; awaiting RELEX) | no screen | BO spec 2671, ADRs 0083/0084 | no |
| IN-04 | Fast master-data push to stores | Prices, promotions and product data reach every store's till quickly and reliably. | Partial (ActionSync 71 tickets done; sync worker SQL owed) | `admin/sync-console` | BO ActionSync effort, spec 2523 | partial (469 done) |
| IN-05 | Juleb warehouse returns & RSD capture | Store-to-warehouse returns are split correctly and RSD results are captured. | Partial (cutover 1577 not done) | no | BO 2079, map 1553 | no |
| IN-06 | Part-sold packs | Selling part of a pack (strips) keeps stock and serials correct. | Unverified | no | BO 2118 | no |

### 2.6 Pharmacy & clinical

| ID | Capability | What it does | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| PH-01 | Prescription session | One prescription, from any source, is worked as one session. Its approval is locked and it is picked on its own document. | Built-not-deployed (SQL 001-025 + seeds owed) | `oms/prescription-sessions` | BO map 2976 / spec 2994, ADRs 0099-0102 | no (oms-react 549 open) |
| PH-02 | Prescriptions on the order page | Staff see the prescription behind an order. | Unverified | `oms/document` | oms-react spec 324 | unknown |
| PH-03 | Lab tests sold at partner price | Lab tests are sold in store and settled with the lab vendor (75% vendor share posted). | Live (on SAP rail since 2026-06-01) | no | BO LabTest workflow | no |
| PH-04 | Telemedicine orders (Altibbi) | Altibbi consultations become orders and post to SAP. | Live (since 2026-03-01) | `oms/document` | BO SAP live scope | unknown |
| PH-05 | PillPack pouch handling | PillPack machine items carry their pouch count and skip unneeded serial scans. | Unverified (code-done, build pending) | no | BO memory | no |

### 2.7 Insurance & claims

| ID | Capability | What it does | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| IC-01 | Nphies at the till | Real-time eligibility, pre-authorization and claims with insurers through the national Nphies exchange. | Live (2026-11-02 outage incident proves live use) | no (desktop) | BO 303-305, 3336 | no |
| IC-02 | Nphies on the web | Head office checks eligibility and manages authorizations from the browser. | Unverified (server 11 tickets done; deploy not recorded) | `nphies/eligibility`, `nphies/authorizations` | oms-react map 196 / spec 209 | unknown |
| IC-03 | Patient share & deductible, including partial returns | Works out what the patient pays versus the insurer, and recomputes it correctly on partial returns. | Piloting (NewPos) / Live (legacy) | no | BO maps 553, 1594, ADR 0071 | no |
| IC-04 | Insurance rules engine (guards & coverage) | Insurer rules (what is covered, which checks block a sale) are configured as data instead of code. | Built-not-deployed | `insurance-rules/guards`, `coverage`, `lists`, `templates`, `fields`, `aliases`, `labels`, `editions`, `approvals`, `review` | BO map 3089 / spec 3126 | no (oms-react 618 open) |
| IC-05 | FHIR as the rule language | Rules are written in the international health-data standard (FHIR) that insurers already use. | Built-not-deployed (merged unpushed; SIS.Rules 2.2.0 local only) | `insurance-rules/*` | BO map 3254 / spec 3271 | no (oms-react 711 open) |
| IC-06 | Rule playground & simulator | Try a rule against a sample basket and see the decision and the reason before publishing. | Built-not-deployed (walked on a local backend 2026-10-30) | `insurance-rules/playground`, `simulator`, `inspector` | BO spec 3243, ADR 0117 | local only |
| IC-07 | Rule metrics | Shows how often each rule fires or blocks. | Unverified | `insurance-rules/metrics` | BO spec 3126 | unknown |
| IC-08 | IDF priority by insurer & store | Decides which insurer fills first, ranked per insurer and per store. | Built-not-deployed (owner SQL + engine push owed) | `insurance-rules/idf` | BO specs 3157, 3185 | no (628/654 open) |
| IC-09 | Nphies invoice shortening | A pharmacist can dispense less than the approved quantity and the claim follows. | Built-not-deployed (branch unmerged) | no | BO 3209, 3304 | no |
| IC-10 | Tawuniya referrals via Waseel | Insurer referrals with mandatory eligibility and a locked invoice. | Partial (live dispenses failing, 3337 open) | no | BO Tawuniya efforts | no |
| IC-11 | Insurer SAP posting | Insurance sales post to SAP as an insurer receivable plus the patient's cash. | Built-not-deployed (workflow shipped; not in the live SAP rail scope) | `reports/idoc-inspector` | BO insurance IDoc | no |

### 2.8 Regulatory traceability

| ID | Capability | What it does | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| RT-01 | GS1 serial capture at sale & return | Every serialized medicine pack is scanned at sale. A return must be the same pack we sold. | Live (legacy tills); NewPos piloting | no | BO ADRs 0006, 0067, map 1460 | no |
| RT-02 | GS1 batch & expiry gate | Refuses a batch the master does not know, at the scan, in one call. | Partial (3317 built; offline fallback partial) | no | BO ADRs 0004, 0033, 0034, spec 3317 | no |
| RT-03 | GS1 check tool | Head office checks any GS1 code: product, batch, expiry, serial status. | Built-not-deployed (on staging) | `materials/gs1-check` | BO spec 2544 | yes |
| RT-04 | Serial refusals at head office | Every refused serial scan (sold or held) is recorded with store, staff, till and transaction. | Built-not-deployed (HQ SQL owed; report on unmerged branch) | `oms/serial-refusals` | BO spec 3049, 3065 | no |
| RT-05 | Fake-GTIN guard | Rejects made-up barcodes that look like GS1. | Unverified (shipped in code; master-data deploy gate) | no | BO 203-206 | no |
| RT-06 | ZATCA e-invoice QR | Prints the tax-authority QR on receipts, including NewPos. | Live (legacy) | no | BO memory | no |

### 2.9 Pricing, promotions & coupons

| ID | Capability | What it does | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| PP-01 | Bonus-buy inquiry & download | Shows which multi-buy offers exist, their real status, and whether they are valid today. | Unverified (read doors built; deploy not recorded) | `pricing/bonus-buy-inquiry`, `bonus-buy-download` | oms-react 053/061/441, BO 598 | unknown |
| PP-02 | Bonus-buy maintenance (OMS copy of SAP's screen) | Marketing authors offers or uploads SAP's file. A second person marks the offer Tested before it goes live. | Built-not-deployed (HQ DDL, grants, SAP number range owed) | `pricing/bonus-buy-maintenance` | BO spec 2374/2396, ADR 0063 | unknown |
| PP-03 | Basket pricing simulator | Shows exactly how a basket will be priced and which promotions apply, before any store sees it. | Unverified (internal tool; built) | `pricing/simulation`, `campaigns/simulator` | BO map 484, oms-react 097 | unknown |
| PP-04 | Rule-based promotion & loyalty engine | Campaigns, deals, bundles and budgets in one central engine (Talon.One-style), evaluated by the API for every channel. | Built-not-deployed (unpushed; 12+ owner calls open) | `campaigns/workspace`, `promotions`, `priority`, `customers`, `sessions` | BO spec 2737, ADRs 0087-0098 | no (520/538 open) |
| PP-05 | Campaign upload with one approval | A whole campaign file is approved once and becomes one ruleset version. | Built-not-deployed | `campaigns/uploads` | BO ADR 0097 | no (533 open) |
| PP-06 | Promotions engine pilot | NewPos stores price SAP's live bonus buys through the new engine, for a 2-3 month verdict. | Piloting (tied to NewPos pilot) | no | BO map 2323 | no |
| PP-07 | Coupons admin | Coupon templates, bulk code import, redemption limits, deleting a mistaken import, and a per-code result file. | Built-not-deployed (deploy owed) | `pricing/coupons`, `campaigns/coupon-finder` | BO map 497, specs 2463, 2680 | unknown |
| PP-08 | Typed campaign coupons at the till | Store campaigns using typed codes (KSA96 10%, EXTRA15). | Live (KSA96 ran 17 Sep–3 Oct; known defects) | no | BO maps 1789, 2863 | no |
| PP-09 | Promotion use cap per member | Limits how often one member can use an offer (e.g. 8 uses). | Built-not-deployed (ships with 1679) | no | BO spec 1677 | no |
| PP-10 | Card-issuer offer (Al Rajhi Blue Week) | A payment-card discount, exported to SAP. | Unverified (17 tickets done; campaign GLs parked) | no | BO spec 2790, 3063 | no |

### 2.10 Loyalty & CRM

| ID | Capability | What it does | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| LC-01 | Loyalty member 360 | Look up a member, see points and invoices, correct the profile, block the member, remove a mobile. | Unverified (built; deploy not recorded) | `loy/member` | oms-react map 222, spec 301, ADR 0001 | unknown |
| LC-02 | Loyalty groups | Give an offer to a list of mobile numbers. | Built-not-deployed | `loy/groups` | BO 3173, ADR 0113 | no (638 open) |
| LC-03 | First-purchase flags | Knows, for each of 12M members, whether they have ever bought, by channel. Drives welcome offers. | Live (nightly worker since 2026-09-06) | no screen | BO map 1313 | no |
| LC-04 | Cash-back / points-back campaigns | Time-boxed "X% back" campaigns, online-aware, with SMS. | Live (Arbahi points-back ran 26 Aug–3 Sep) | no | BO map 1339 | no |
| LC-05 | Welcome cashback, paid once | 10% back on a member's first purchase, exactly once. | Partial (charted, not built) | no | BO map 1653 | no |
| LC-06 | Communication consent | Members choose how we may contact them, and consent is kept as an event log. | Partial (32 done / 18 open) | no | BO map 1409 | no |
| LC-07 | Al Rajhi Mokafaa points | Customers pay with bank reward points. | Live (~85% of stores on the new platform) | no | BO map 237 | no |

### 2.11 Payments, collection & settlement

| ID | Capability | What it does | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| PC-01 | Store cash collection cycle | Shift close leads to a collector pickup and a numbered collection receipt (ACR), with supervisor roles and printed papers. | Live (since ~2026-08-16) | `collection/inquiry` | BO specs 1976, 2149, 2423 | unknown (259 open) |
| PC-02 | Per-store settlement account | Shortages are demanded, approved deductions are taken at close, and theft is recorded as an entry that moves no cash. | Live (Unverified extent) | `collection/settlement` | BO map 1142, ADRs 0046, 0049 | yes (oms-react 274 done) |
| PC-03 | Settlement change requests | An accountant asks to change or delete an entry and a supervisor approves it. | Built-not-deployed (migrations 095-098 owed) | `collection/settlement` | BO spec 2190, ADR 0055 | unknown |
| PC-04 | ECR card slips at day close | Card-terminal slips are attached to each store day. Finance sees missing slips. | Built-not-deployed (owner walks) | `collection/inquiry` (320-323 built) | BO map 2024 | no |
| PC-05 | Order payments view | Shows each order's payments and refunds. | Unverified | `oms/document-payments` | BO spec 2469 | unknown |
| PC-06 | Card brand & bank commission | Each card payment carries its brand so bank commission is correct. Unknown cards are priced as mada. | Unverified (built; scripts unrun on prod for 1899) | no | BO 1899, 2288, ADR 0057 | no |
| PC-07 | Buy-now-pay-later (Tabby, Tamara) | Tabby inside the store as a real payment session (SAR 100–2,500 band), and online. | Partial (in-store built; online-only go-live open) | no | BO ADRs 0060, 0096 | no |
| PC-08 | Partner statements | Reconciliation reports for Mokafaa and Akthr partners. | Partial | no | BO spec 2650 | no |

### 2.12 Finance & SAP integration

| ID | Capability | What it does | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| FI-01 | New SAP IDoc posting pipeline | Every sale is split into SAP billing documents per channel, with the right customer, VAT, fees and payments. | Live for OTO, Altibbi, bonded zone, lab test and HungerStation / not yet for general cash retail | `reports/idoc-inspector` | BO ADRs 0011, 0013; SAP live scope | partial |
| FI-02 | SAP export console | Shows which store is behind in SAP posting and why, store by store. | Built-not-deployed (on staging) | `reports/sap-export-console` | BO spec 2579 | yes (oms-react 466 done) |
| FI-03 | IDoc inspector | A consultant sees exactly how any transaction's SAP document was made and can download the XML. | Unverified (built; deploy not recorded) | `reports/idoc-inspector` | BO spec 1386 / map 1374 | unknown |
| FI-04 | Line-level source provenance | Every SAP line records which layer created it, for audit. | Unverified (built + backfill plan) | `reports/idoc-inspector` | BO source-provenance rule | no |
| FI-05 | Batch sealing for SAP | Batches close when full or quiet, and operators can force a stage by hand. | Unverified (runbook; worker flags per host) | no | BO spec 924, ADR 0011 | no |
| FI-06 | Retail invoice (PDF) on the web | Reprints a store invoice from the browser. | Partial (render rail frontier 1046) | `reports/retail-invoice` | BO map 984 | unknown |
| FI-07 | POS-vs-SAP audit reconciliations | Excel reports for internal audit comparing till and SAP figures. | Partial (~7 reports left) | no | BO audit-reports memory | no |

### 2.13 Security & administration

| ID | Capability | What it does | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| SA-01 | Two-step staff login everywhere | Password plus authenticator, SMS or email code, for tills, back office and web. Self-service reset. | Live (wave 1 of POS rollout done) | `auth` | BO maps 364, 471, 718, 732 | yes (login) |
| SA-02 | User administration (web) | Find, page and export users, and manage their access. | Unverified | `admin/ua-admin` | BO map 413, oms-react 139/147 | unknown |
| SA-03 | Roles & authorizations admin | SAP-style roles and assignments, checked at login and per screen. | Unverified (built) | `admin/authz-admin` | BO maps 420, 437, 445 | unknown |
| SA-04 | Active sessions & remote sign-out | See who is signed in where, and sign out one device or a person everywhere. | Unverified (built) | `admin/active-sessions` | oms-react map 001 | unknown |
| SA-05 | SAP-driven joiners, movers & leavers | Staff accounts follow HR changes in SAP. | Partial (12 done / 9 open) | no | BO map 751 | no |
| SA-06 | Notification centre & broadcast | Head office sends notices to stores and users, who see them in a bell. | Unverified | `admin/broadcast` + top-bar bell | oms-react 023/031, BO map 591 | unknown |
| SA-07 | Document-type configuration | Configures each order type's behaviour from the web. | Built-not-deployed | `admin/doc-type-config` | BO 2026-10-27 effort | unknown |
| SA-08 | Per-store engine switch | Moves a store between the old and new selling engine, with a reason and a history. | Built-not-deployed | `admin/engine-switch` | BO ADR 0093, oms-react 517 | unknown |
| SA-09 | View-only OMS role | A role that can look but not change, return or reschedule. | Built-not-deployed (521 open) | all OMS screens | BO 2026-10-16 | no |

### 2.14 Analytics & reporting

| ID | Capability | What it does | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| AR-01 | Store OMS dashboard | An order dashboard for each store, built on a reusable dashboard kit. | Unverified (18 done) | no (desktop) | BO map 2199 | no |
| AR-02 | Document source users | Shows who created orders from which source. | Unverified | `oms/document-source-users` | BO spec 2469 | unknown |
| AR-03 | Potential bulk-sales report | Flags baskets that look like bulk buying. | Unverified | no | BO 2026-10-22 | no |

### 2.15 Platform & operations tooling

| ID | Capability | What it does | State | oms-react screen | Source | Demo on staging? |
|---|---|---|---|---|---|---|
| PO-01 | Store sync console | One console shows every data rail to every store: what is behind, dead letters, a store's transactions. | Partial (Transactions tab on staging; mirror lane and fleet views open) | `admin/sync-console` | BO specs 2523, 2563, ADR 0073 | partial (469 done; 450/460 open) |
| PO-02 | Store scripts | Head office sends a SQL fix to chosen stores and sees the result. | Built-not-deployed (HQ SQL 010/011 owed) | `admin/sync-console` | BO spec 3202, ADR 0115 | no |
| PO-03 | Data compare & reconcile | Compares store data with head office and repairs differences. | Partial (7 done / 1 open) | `admin/data-sync` | DataSync engine spec | unknown |
| PO-04 | Self-updating tills & installer | Tills update themselves from a central feed. A technician tool installs new tills. | Live (update feed) / Partial (installer gates parked) | no | BO maps 333, 607, 648, 885 | no |
| PO-05 | POS Time Machine | On non-production systems only, moves a till's clock forward for demos and day-roll tests. | Built-not-deployed (shipped in code; owner live smoke left) | no | BO spec 1111 | no |
| PO-06 | Point a till at staging without a rebuild | The same build can run against staging for testing. | Unverified | no | BO map 1054 | no |
| PO-07 | Stale-work sweepers | Background jobs retire stuck orders and release reservations safely. | Unverified | no | BO sweeper memories | no |
| PO-08 | Write-ahead integration log | Every outbound call to a partner is logged before it is sent and can be retried. | Unverified | no | BO ADR 0007 | no |

**Count check (127):** Live 25 · Piloting 5 · Built-not-deployed 50 · Partial 16 · Unverified 31.
Rows with a split state ("Live / Partial") are counted under their first word. Most Unverified rows
are "built, and the records never say whether it was rolled out". Treat Built-not-deployed and
Unverified together (81 rows) as "**not provably live**" for the pitch.

---

## 3. Hidden gems

These are strong capabilities with no screen, or with a screen nobody would think to demo.

| # | Gem | Why it impresses | Who |
|---|---|---|---|
| 1 | **First-purchase flags for 12M members** (LC-03) | Every night we know who has never bought, by channel, for all 12M members. That is the basis of welcome offers and acquisition measurement. It is live and has no screen. | CMO |
| 2 | **Competed delivery callout + scorecard** (DD-02/03/05) | Orders go to the nearest willing store. Stores are ranked on failed takes in the courier's own words, and the radius widens itself. This is the quick-commerce dispatch that top OMS products sell as an add-on. | COO |
| 3 | **Insurance rules as data, in FHIR, with a playground** (IC-04/05/06) | Rule changes no longer need a developer, and a rule can be tested before it goes live. FHIR is the language insurers already speak. We know of no packaged retail OMS that ships this for the Saudi market. | CEO, CFO |
| 4 | **IDoc inspector + line provenance** (FI-03/04) | Finance or a SAP consultant can see why any SAP line exists and which layer created it. That makes audit questions fast to answer. | CFO |
| 5 | **SAP export console** (FI-02) | One page shows which store is behind in posting to SAP, and why. It is already on staging. | CFO |
| 6 | **Store settlement account with theft as a no-cash entry** (PC-02) | Shortages, deductions and theft are accounted per store and approved. Live since August. | CFO |
| 7 | **GS1 serial and batch control end to end** (RT-01..04) | Every pack is scanned at sale. A return must be the same pack we sold. Batches are checked at scan. Refusals are logged with staff and till. This is regulatory exposure turned into a control. | CEO (risk), COO |
| 8 | **Donor requests within 5 km** (FS-04/05) | A store out of stock is supplied by a neighbour, and the system books the transfer. The sale is saved instead of lost. | COO, CMO |
| 9 | **Four-eyes "Tested" gate on promotions** (PP-02) | An offer cannot go live until a second person has tested it. This stops pricing mistakes that cost money in every store at once. | CFO |
| 10 | **Basket pricing simulator** (PP-03) | Marketing sees exactly what a basket costs under every live promotion before it reaches stores. | CMO |
| 11 | **POS Time Machine** (PO-05) | A demo or test till can jump to tomorrow or month-end safely. It is locked out of production. Useful for the live demo itself. | COO (and the demo) |
| 12 | **Receipt replay without double-posting** (FS-16) | A sale lost to a till fault is recovered centrally and never posts to SAP twice. | CFO |
| 13 | **Multi-app delivery through one connection** (OC-04) | Adding Jahez, Keeta and others is configuration, with SAP terms that are effective-dated data. | CMO, CEO |
| 14 | **Prescription session** (PH-01) | One prescription is handled as one locked unit across store, delivery and insurer. It closes a gap between pharmacy compliance and the customer journey. | COO, CEO |
| 15 | **RELEX demand export** (IN-03) | Our data already feeds a tier-1 forecasting product, with deletes detected against what was sent. | COO, CFO |

---

## 4. Honest caveats — do not overclaim

1. **NewPos is not live fleet-wide.** The 1 October go-live slipped. It runs as a pilot at a handful
   of stores. Most stores run the legacy till. Do not present NewPos features as running across the
   chain.
2. **The new SAP pipeline does not yet carry general cash retail** (~173k transactions a day). It
   carries five channels. "Every sale posts through the new rail" is false today.
3. **Most of the newest work is merged but not deployed.** This covers callouts, scorecards, serving
   lists, insurance rules with FHIR and the playground, IDF priority, the rule engine, Deliverect,
   prescription sessions, pick support, loyalty groups, HungerStation promotions, donors on any
   host, and settlement change requests. Each waits on **owner-run SQL**, a **SIS.Api deploy**,
   **grants or seeds**, or a **walk-through**. Several are **unpushed** (spec 3326, FHIR rules 3271,
   rule engine 2737, serving lists 3042).
4. **Many web screens have been tested only against stubs or a local backend.** The "calls the real
   doors on staging" tickets are still open for: sync console fleet/mirror, receipt replay,
   Deliverect, statistics, pick support, rule campaigns, campaign uploads, promotions, prescription
   sessions, location link, insurance rules, IDF and loyalty groups. Only materials, SAP export,
   sync Transactions, HungerStation and settlement have a done staging walk.
5. **We could not confirm that oms-react is in production.** There is a staging setup (call-centre
   staging runbook, staging walks), but no record we read says finance or ops use the web portal in
   production. Say "on staging" unless the owner confirms.
6. **Raqeeb controlled-medicine dispensing is not built** (9 open). The **negative-stock** programme
   is a brief only. **Welcome cashback** is charted, not built. **QC express + OTO auto-courier** is
   unpushed with SQL owed.
7. **Known live defects.** KSA96 coupon defects were found by review (one charges the unpromoted price
   in one path). Waseel dispenses fail on a missing column (3337). SIS.Api ran out of database
   connections on 2026-11-02 (3338). A demo must avoid these paths.
8. **Ops debts still open:** Ua retention sweep is OFF. SAP-driven joiners/movers/leavers is
   partial. Offline login is partial. Juleb RSD cutover is not done. The till installer's later
   gates are parked.
9. **Most numbers are from the records, not fresh queries.** Fresh figures (stores, daily
   transactions, member counts) should come from the read-only prod replica (corporate network only)
   in ticket 723.

---

## 5. Sources

**oms-react** (`C:\Playground\oms-react`)
- `src/features/*/*` directory tree (73 features), `src/app/router.tsx`, `src/app/insurance-rules-routes.tsx`, `src/layout/`
- `.issues/INDEX.md` (all 72 effort headings; status counts; every "calls the real doors on staging" ticket)
- `.issues/717-the-super-oms-pitch-map.md`, `.issues/721-what-does-our-platform-do-today.md`
- `CONTEXT.md` (grep for staging/production), `docs/adr/` (listing), `git log` (commit count, first commit)

**BackOffice** (`C:\Work\DMSCO\BackOffice`)
- `.issues/INDEX.md` — all 300 `## ` effort headings with done/open/ready counts; sections "Insurance pilot feedback", "Nphies link 401 outage"; runbook header notes; lines on 1205, 406, 470
- `docs/adr/` — listing of 120 ADRs (titles 0001–0117)
- `CLAUDE.md` and `.claude/rules/*` (conventions, context only)

**Owner memory** (`C:\Users\mohamed.sartawi\.claude\projects\C--Work-DMSCO-BackOffice\memory\`)
- `MEMORY.md`; every `hub_*.md` (afk_runner, coupons, deploy, file_write_traps, gs1, pick, qr_member_id, reskin, reskins_done, spec_waves_1881_2469, spec_waves_2507_3049, test_infra, ua_authz, web_maps, wpf_tests_ui)
- `description:` lines of all ~270 `project_*.md` files
- Read in full or near-full: `project_newpos_golive_oct1_retires_retailtrxaction`, `project_pos_transformation_waves`, `project_sap_idoc_pipeline_live_scope`, `project_ksa96_campaign_map1789`, `project_rule_engine_spec2737`, `project_competed_delivery_callout_spec2952`, `project_deliverect_spec2615`, `project_hungerstation_oms_react_spec3028`, `project_pick_verification_map1693`, `project_promotions_engine_pilot_map2323`, `project_local_iis_staging_sim_470`, `reference_pos_replica_readonly_door`, `project_cc2_shipped`, `project_web_cc_server_map126`, `project_first_purchase_flags_map1313`, `project_arbahi_points_back_campaign_map1339`
