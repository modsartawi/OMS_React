# 717 — Last-mile dispatch & quick-commerce / aggregator tooling (market scan)

> Desk research for the management comparison matrix, **market side only**. Our platform is not
> scored here. Researched 2026-11-03 from vendor product pages, help centres, API docs and partner
> portals. Claims carry a footnote `[n]` that points to **Sources** (§6). Sources marked
> **(secondary)** are press, review sites or third-party integrators. `?` = no public evidence found.
> It does **not** mean the vendor lacks the feature.

---

## 1. Summary

- **Dispatch tools split into two camps.** *Fleet tools* (Onfleet, Tookan, Shipday) run a
  merchant's own drivers. *Orchestrators* (Bringg, Deliverect Dispatch, Grubtech gDispatch) decide
  between your own fleet and outside couriers for each order [1][8][23][35].
- **Courier "callouts" with a widening radius are a recognised pattern, but only Tookan documents
  it.** Tookan's *batch-wise* mode searches a start radius, widens it by a set increment and stops at
  a maximum. Its other modes are *send to all* (first to accept wins), *one-by-one* (offer expires,
  then goes to the next nearest driver) and *round robin* [15][54][55]. Onfleet only auto-assigns,
  by closest driver or shortest route [5].
- **Hybrid own-fleet + 3PL is now common.** Bringg chooses the cheapest or preferred carrier and
  reconciles carrier invoices against its estimates [8]. Deliverect Dispatch routes orders to Uber
  Direct, Stuart, DoorDash Drive or Wolt Drive by rule [23]. Grubtech lists Uber Direct and Careem
  Express in the GCC [35].
- **Proof of delivery for medicines is where Onfleet leads.** It offers photo, signature, barcode,
  government-ID/age check, a recipient PIN (Enterprise) and an exportable chain of custody. It signs
  a HIPAA Business Associate Agreement [1][3][4][7]. None of the vendors scanned publishes
  **temperature / cold-chain logging** [4]. That is a market gap, not a table stake.
- **Delivery-slot booking with live capacity** is a Bringg add-on. Slots are calculated from fleet
  capacity, blackout hours and SLAs, held during checkout, and reported as "% remaining" so emptier
  slots can be discounted [9][10][14].
- **Aggregator middleware is table stakes for food. Promotions are the differentiator.** Deliverect
  and Otter both do order injection, one-place menu publishing and cross-channel item "snooze"
  [25][26][31]. Otter sells auto-optimised delivery-app promotions [33]. Deliverect has a Campaign
  Manager and maps discount funding (who pays) into the POS order [29][30].
- **GCC aggregators differ a lot in what merchants can do through the API.** Talabat publishes
  Catalog, **Promotions**, Orders/Picking and availability APIs [37][38]. HungerStation's spec is
  behind a partner login [41]. Through UrbanPiper, HungerStation supports only a *store* on/off
  switch, not item toggles, order-status push or merchant cancellation, and needs a HungerStation
  device in each store [40] (secondary). Jahez integrations run through Deliverect, Foodics or
  Omniful [27][42][43].
- **GCC pharmacy precedent: FarEye at a 1,200-store, Jeddah-headquartered Saudi pharmacy chain**
  (unnamed in the case study; press links FarEye to Nahdi). The deployment has store-mapped drivers,
  lending of drivers between stores with manager approval, Uber-style customer tracking links, and
  1-click secure driver–customer contact [49][50]. Locus was bought by IKEA's Ingka Group in October
  2025 and still runs independently [51].
- **Pricing.** Onfleet is from $619/mo (2,500 tasks) [1]. Shipday is free to $399/mo with
  $0.06–0.25 per extra order [19]. Tookan has published task tiers, but the figures conflict between
  pages [18]. Bringg, Deliverect, Grubtech, FarEye and Locus quote only on request [24][35].
- **Gaps in the evidence:** HungerStation/Jahez promotion tooling, failed-delivery workflows (no
  vendor documents re-attempt logic in public), Bringg's customer-tracking features, and cold-chain
  handling.

---

## 2. Capability rows (candidates for the matrix)

Tier key: **TS** = Table stakes (a buyer assumes it exists) · **C** = Common (most serious tools
have it) · **D** = Differentiator (few have it, or it sells the demo).

### 2a. Dispatch & last mile (DL)

| ID | Capability | Plain-English (CFO-readable) | Tier |
|---|---|---|---|
| DL-01 | Auto-dispatch | The system picks a driver for each new order by itself, so no dispatcher has to assign orders by hand. | TS |
| DL-02 | Selectable assignment strategies | Managers can choose the assignment rule (nearest driver, shortest added route, fewest current jobs, round-robin) for each team or zone. | C |
| DL-03 | Broadcast / offer cascade to couriers | An order is offered to many couriers at once (first to accept wins), or to one at a time with a timeout before the next is tried. | C |
| DL-04 | Widening search radius | If no courier nearby accepts, the system automatically searches a wider circle in steps, up to a set maximum. | D |
| DL-05 | Driver capacity & zone limits | Caps how many jobs one driver can hold and keeps jobs inside the driver's team or zone. | C |
| DL-06 | Hybrid own fleet + 3PL couriers | One screen dispatches to our own drivers or to outside courier companies (e.g. Uber Direct, Careem Express), with overflow at peak. | C |
| DL-07 | Cost-based carrier selection & invoice reconciliation | Each order goes to the cheapest or preferred qualified courier using rate cards, and carrier invoices are checked against expected cost. | D |
| DL-08 | Route optimisation | Multi-stop routes are sequenced automatically to cut distance, fuel and driver hours. | TS |
| DL-09 | Order batching | Several orders going the same way are combined into one trip when they still arrive on time. | C |
| DL-10 | Live dispatcher map | Dispatchers see every driver and order on a live map. | TS |
| DL-11 | Customer tracking link, notifications & driver chat | The customer gets an SMS with a branded live map, status updates, and a masked way to message the driver. | TS |
| DL-12 | Predictive ETA & delay alerts | ETAs update through the day and late deliveries are flagged before they become complaints. | C |
| DL-13 | Proof of delivery: photo + signature | The driver captures a photo and/or signature at handover, stored against the order. | TS |
| DL-14 | Barcode scan at load & handover | Packages are scanned when loaded and when delivered, proving the right parcel reached the right person. | C |
| DL-15 | ID / age verification at the door | The driver checks a government ID before handing over restricted items (relevant for prescription medicines). | D |
| DL-16 | Recipient PIN / OTP release | The parcel is released only when the recipient gives a one-time code. | D |
| DL-17 | Exportable chain of custody | Every handover from store to doorstep is logged and can be exported for audit or regulators. | D |
| DL-18 | Mandatory custom completion forms | Configurable forms that a driver must complete before closing the job (e.g. "collected cash", "patient counselled"). | C |
| DL-19 | Delivery slot booking with live capacity | Checkout offers only time slots the fleet can really meet, holds the slot while paying, and can discount emptier slots. | D |
| DL-20 | Failed delivery & returns handling | Failed attempts are captured with a reason and routed to re-attempt or return-to-store, and return pickups are scheduled. | C |
| DL-21 | Courier / carrier performance analytics | On-time rate, service time and cost per delivery, broken down by driver, store and courier partner. | TS |
| DL-22 | Post-delivery customer rating | The customer rates each delivery, and ratings feed driver and carrier scorecards. | C |
| DL-23 | Driver earnings / wallet / cash-on-delivery | Tracks what each driver earned and what cash they hold, so it can be settled. | C |
| DL-24 | Health-data privacy controls | The tool signs a health-data agreement (e.g. HIPAA BAA), masks phone numbers and wipes patient data from the driver app after delivery. | D |
| DL-25 | Temperature / cold-chain logging | Records that temperature-sensitive medicines stayed in range in transit. | D (gap) |
| DL-26 | Store-mapped drivers with approved cross-store lending | Drivers belong to a store but can be lent to a neighbouring store with manager approval. | D |

### 2b. Aggregator & quick-commerce (AG)

| ID | Capability | Plain-English (CFO-readable) | Tier |
|---|---|---|---|
| AG-01 | Multi-aggregator order injection (+ auto-accept) | Orders from every delivery app land directly in our POS/OMS, accepted automatically, with no tablets to re-key. | TS |
| AG-02 | Two-way order status sync | When we accept, prepare, hand over or cancel, the aggregator app updates too. | C |
| AG-03 | Central catalogue / menu publish | Edit products, prices and photos once and publish to every app, including mandatory Arabic names and per-store menus. | TS |
| AG-04 | Cross-channel item "snooze" / out-of-stock | Mark an item unavailable once and it disappears from every app until restocked. | TS |
| AG-05 | Store availability / busy toggle | Pause or close a store on all apps at once during a rush or an outage. | C |
| AG-06 | Aggregator promotions management | Create, schedule and measure discounts on the delivery apps from our side, and record who funds each discount. | D |
| AG-07 | Cross-channel sales analytics | One report of sales, items and campaign performance across all apps and stores. | C |
| AG-08 | Platform-rider vs own-delivery & "ready" signal | Supports orders delivered by the app's riders (we press "prepared" to call the rider) as well as orders we deliver ourselves. | C |
| AG-09 | In-store picking app for quick commerce | Staff pick, substitute and pack app orders with a guided picker that feeds back item changes. | C |

**35 rows in total** (26 DL + 9 AG).

---

## 3. Coverage table

Legend: ✔ documented · partial = documented in part, or only for some tier/market · ✗ documented as
*not* supported · ? = no public evidence · — = out of the product's scope. Numbers in brackets are
sources (§6).

### 3a. Dispatch rows

| ID | Onfleet | Bringg | Tookan | Shipday | Deliverect (Dispatch) | Grubtech (gDispatch) |
|---|---|---|---|---|---|---|
| DL-01 | ✔ [1][2] | ✔ [13] | ✔ [16][55] | ✔ [19][21] | ✔ [23] | ✔ [35] |
| DL-02 | ✔ closest / shortest-route / load [5][6] | partial: skills, availability [11][13] | ✔ 5 modes [15][54][55] | partial: location, vehicle, shift [21] | partial: price/speed/distance/time rules [23] | ? |
| DL-03 | ? | partial: offers go to *carriers* in turn until one accepts [8] | ✔ send-to-all, one-by-one with expiry [15][55] | ? | ? | ? |
| DL-04 | ? | ? | ✔ start radius + increment + max [15] | ? | ? | ? |
| DL-05 | ✔ max tasks, team restriction [5] | partial: skills/availability [11] | partial: radius limit [54] | ? | ? | ? |
| DL-06 | ✔ Onfleet Connect couriers [2][4] | ✔ own fleet + 250+ carriers [8][13] | partial: in-house + 3rd party [16] | partial: 3rd party only in US/CA/AU/UK [19][22] | ✔ own fleet + Uber Direct/Stuart/DoorDash/Wolt [23] | ✔ local 3PL, Uber Direct, Careem Express [35] |
| DL-07 | ? | ✔ rate cards + invoice reconciliation [8] | ? | ? | partial: price rule [23] | ? |
| DL-08 | ✔ basic → advanced [1] | ✔ [11] | ✔ [16] | ✔ [19][21] | ? | ? |
| DL-09 | partial: bulk assign keeps linked tasks together [6] | ? | ? | ? | ? | ? |
| DL-10 | ✔ [1] | partial [57] | ✔ [16] | ✔ [19] | partial [23] | partial: real-time tracking [35] |
| DL-11 | ✔ branded page, SMS, driver chat [1][2] | ? | ✔ tracking link [16] | ✔ SMS + branded tracking (higher tiers) [19] | partial [23] | ? |
| DL-12 | ✔ dynamic ETA + delay alerts (Scale+) [1][2] | ? | ? | partial: live ETA [19] | ? | ? |
| DL-13 | ✔ [3] | partial: via custom forms [12] | partial: image field [17] | ✔ [20] | ? | ? |
| DL-14 | ✔ Scale+, can be made mandatory [1][3] | ✔ [12] | ✔ barcode field [17] | ? | ? | ? |
| DL-15 | ✔ Scale+ [1][3][4] | ? | ? | ? (claimed only in secondary listings) | ? | ? |
| DL-16 | ✔ Enterprise [1] | ? | ? | ? | ? | ? |
| DL-17 | ✔ exportable task history [4] | ? | ? | ? | ? | ? |
| DL-18 | partial [3] | ✔ conditional forms [12] | ✔ mandatory template fields [17] | ? | ? | ? |
| DL-19 | partial: delivery windows feed dispatch [2] | ✔ Dynamic Delivery Slots add-on [9][10][14] | ? | ? | ? | ? |
| DL-20 | ? | partial: returns / reverse logistics [58] (secondary) | ? | ? | ? | ? |
| DL-21 | ✔ by driver & partner [2] | ✔ carrier on-time + rating [8] | ✔ [16] | partial: reports by tier [19] | ? | ✔ gData [35] |
| DL-22 | ✔ feedback survey [2] | ✔ per carrier [8] | ✔ [16] | partial: customer feedback [22] (secondary) | ? | ? |
| DL-23 | ? | ? | ✔ agent wallet [16] | ? | ? | ? |
| DL-24 | ✔ BAA, masked numbers, PHI wipe [4][7] | ? | ? | ? | ? | ? |
| DL-25 | ? (not on pharmacy page [4]) | ? | ? | ? | ? | ? |
| DL-26 | partial: teams [5] | ? | ? | ? | ? | ? |

### 3b. Aggregator rows (middleware + merchant-facing side of aggregators)

| ID | Deliverect | Otter | Grubtech | Talabat (partner API) | HungerStation (merchant) | Jahez (merchant) |
|---|---|---|---|---|---|---|
| AG-01 | ✔ [24][28] | ✔ + auto-accept [32] | ✔ incl. HS, Jahez, Keeta, Talabat, Noon, Careem [35] | ✔ direct (own POS) or via vendor app; auto-accept [38] | partial: needs HS device, accept on device or auto-ack [40] (secondary); Cube POS API [41] | ✔ via Deliverect / Foodics [27][42] |
| AG-02 | ✔ (e.g. Jahez) [27] | partial [32]; Foodics status not reflected [secondary] | ? | ✔ accept / reject / picked-up / prepared [38] | ✗ status push & merchant cancel unsupported via UrbanPiper [40] (secondary) | ✔ status back to Jahez [27][42] |
| AG-03 | ✔ [27] | ✔ edit once, publish everywhere [31] | ? | ✔ Catalog API + SFTP [37][38] | ✔ Arabic mandatory, no sub-categories / nested options [40] (secondary) | ✔ menus from POS [27] |
| AG-04 | ✔ snooze to all channels, bulk [25][26] | ✔ hide out-of-stock [31] | ? | ✔ item availability API [38] | ✗ item toggle via UrbanPiper [40]; catalogue availability API claimed [secondary] | partial: inventory sync via Omniful [43] (secondary) |
| AG-05 | ? | ? | ? | ✔ vendor availability API [38] | ✔ store toggle [40] (secondary) | ? |
| AG-06 | partial: Campaign Manager + discount funding mapping [29][30] | ✔ auto-create & optimise promos [33] | ? | ✔ Promotions API: strikethrough, same-item bundles [37] | ? ("marketing solutions" only [39]) | ? |
| AG-07 | ✔ [24] | ✔ item sales reports [31] | ✔ gData [35] | ? | partial: merchant app sales reports [secondary] | ? |
| AG-08 | ✔ Dispatch for own delivery [23] | partial: courier handoff [32] | ✔ gDispatch [35] | ✔ "mark prepared" [38]; own-delivery mode ? | ✔ HS riders deliver; own delivery ? [39] | ? |
| AG-09 | partial: Retail catalogue product [24] | — | ✔ gPicker [35] | ✔ Partner Picking / Pelican app [37] | ? | ? |

### 3c. Other names in the brief (notes rather than columns)

| Player | What is public for merchants / buyers | Relevant to us because… |
|---|---|---|
| **FarEye** | Saudi pharmacy case study (1,200 stores, Jeddah HQ): ERP connector imports orders; hyperlocal same-day delivery; drivers mapped to stores and lendable across stores with manager approval; Uber-style tracking link with special instructions and secure driver chat; 1-click live-location share; reported higher first-attempt success, and growth from 30–40 to 100+ stores on the platform [49]. Gulf Business lists Nahdi as a FarEye MENA client [50] (secondary). Emirates Post and Landmark Group are GCC partners [59] (secondary). | It is the closest like-for-like reference: a KSA pharmacy chain running store-based dispatch on a bought tool. |
| **Locus** | AI rider-order scoring (pickup ETA, route, learned acceptance probability, SLA tier) plus batching for quick commerce, in a Southeast-Asia-framed post [52]. Acquired 100% by Ingka (IKEA) in Oct 2025 and still independent [51]. No named GCC pharmacy customer found. | It shows where "callout" logic is heading: scoring by *likelihood to accept* instead of a widening radius. |
| **Instacart Platform** | White-label Storefront Pro includes OMS, CMS, payments, fraud, CRM and fulfilment tech, and powers 380+ grocery chains [46]. Caper smart carts and FoodStorm (prepared-food order management) are sold à la carte [47]. US/Canada only. Retailer-own-driver mode ? | A benchmark for "bring your own brand, rent the fulfilment stack". Not a GCC competitor. |
| **Careem Quik** | Careem's own dark-store network. Careem runs ordering, fulfilment, inventory and delivery end-to-end [44] (secondary), and said it was "open to partners operating locations" [45] (secondary). No public merchant API found. | For a retailer it is a competitor model (first-party dark stores), not a sales channel. |
| **Talabat pharmacy** | Prescription upload with 90-minute delivery and OTC in about 30 minutes with Aster in the UAE [48] (secondary). | Aggregators are moving into medicines delivery. |
| **Delivery Hero ODR / pandago** | Courier-on-demand API: create and track orders, proof of pickup and delivery, courier-location webhooks [53] (secondary). GCC availability ? | A possible 3PL lane for DL-06 if offered in KSA/Bahrain. |

---

## 4. "Looks modern" shortlist (what makes a 2026 back-office demo feel state-of-the-art)

| # | Capability (row) | Why it lands with an exec audience | Best showcase |
|---|---|---|---|
| 1 | **Predictive ETA + proactive delay alerts on a branded live-tracking page with driver chat and a feedback survey** (DL-11, DL-12, DL-22) | Shows customer experience and operations together: the at-risk order turns red *before* the customer calls, and the customer sees the driver live. It is the "Uber moment" FarEye sold to the Saudi pharmacy chain [49]. | Onfleet [1][2] |
| 2 | **Hybrid orchestration: own fleet first, spill to the cheapest qualified courier, then reconcile courier invoices** (DL-06, DL-07) | Turns dispatch into a cost lever the CFO can see: cost per delivery by carrier, and a billing variance view. | Bringg Delivery Hub [8]; Deliverect Dispatch for multi-courier rules [23] |
| 3 | **Capacity-aware delivery slots at checkout (with % remaining and discounted emptier slots)** (DL-19) | Connects marketing (slot pricing) with operations (no overbooking), and makes "delivery promise" a measured on-time KPI. | Bringg Dynamic Delivery Slots [9][10][14] |
| 4 | **Regulated-goods handover: ID/age scan, barcode custody, recipient PIN, exportable chain of custody, PHI wipe** (DL-14–DL-17, DL-24) | For a pharmacy chain this is the compliance story: proof for the regulator and patient privacy, shown in a 30-second driver-app clip. | Onfleet pharmacy [3][4][7] |
| 5 | **Self-optimising aggregator promotions and one-click cross-channel snooze** (AG-04, AG-06) | It is CMO-facing: promotions that "learn", and one switch that removes an out-of-stock item from every app. | Otter promotions [33]; Deliverect snooze [25]; Talabat Promotions API is the GCC proof that this can be automated [37] |

*Honourable mention:* acceptance-probability rider scoring with batching (Locus [52]). It is
impressive, but the evidence is vendor-blog only.

---

## 5. Pricing snapshot (public list prices; quotes vary by market and are often lower under contract)

| Vendor | Model | Public figures | Notes |
|---|---|---|---|
| **Onfleet** | Monthly plan + per-task overage | Launch **from $619/mo**, 2,500 tasks · Scale **from $1,349/mo**, 5,000 tasks (adds auto-dispatch of on-demand orders, barcode, ID/age) · Enterprise custom, "typically from $3,099/mo", 10,000+ tasks (adds recipient PIN) [1] | Overage rate not published. SMS/voice billed by usage. Courier Suite add-on from $299/mo [1]. Third-party sites list older prices ($500–$599 Launch) (secondary). |
| **Shipday** | Monthly plan + per-order overage | Basic free (300 orders) · Pro Lite $29 (300 incl., $0.06/extra) · Professional $49 ($0.10) · Branded Elite $99 ($0.20) · Business AI Lite $199 (750 incl., $0.20) · Business AI $399 (1,500 incl. or unlimited for merchants; $0.25) [19] | Third-party on-demand delivery only from Branded Elite, and only in US/CA/AU/UK [19]. |
| **Tookan (Jungleworks)** | Monthly plan by task count + per-task overage | Pricing page (OMR): Early Stage OMR 18/mo, 150 tasks, OMR 0.14/extra · Startup OMR 59 (500) · Growth OMR 189 (2,000) · Standard OMR 359 (5,000; OMR 0.08/extra) [18]. Help centre (USD): Early Stage 200 tasks, $0.19/extra; Standard 5,000 tasks, $429/mo [18] | The official pages disagree, so treat the figures as indicative. A multi-stop job counts as fractional tasks (1 pickup + 2 drops = 1.5) [18]. A Middle-East currency is shown, and there are UAE offices [16]. |
| **Bringg** | Quote | ? (SAP Store lists modules "price upon request" [57]) | A per-delivery estimate of $0.25–0.60 on one blog is unverified (secondary). Excluded. |
| **Deliverect** | Per location, by order volume and solution | Not published. A calculator on the pricing page asks for locations and orders per location; solutions are Restaurants / Retail / Direct / Dispatch [24] | Third-party figures (€49–€79 or $149 per month) conflict (secondary). |
| **Otter** | Per location per month (+ per-order fees reported) | ? Official helpdesk page blocked. TrustRadius: Lite $89 / Standard $149 / Premium $219 per location per month [34] (secondary). A per-location activation fee exists [34] | Some reviews report a 1.5%–3.19% + $0.15 per-order fee (secondary). Unverified. |
| **Grubtech** | Quote | ? [35] | — |
| **FarEye / Locus** | Enterprise quote | ? | — |
| **Aggregators (HS, Talabat, Jahez)** | Commission per order (merchant contract) | Not public | Middleware such as Deliverect requires a *separate* subscription on top of the aggregator's [27]. |

---

## 6. Sources

1. Onfleet — Pricing — https://onfleet.com/pricing
2. Onfleet — Last-mile delivery platform (features) — https://onfleet.com/last-mile-delivery
3. Onfleet — Proof of delivery — https://onfleet.com/proof-of-delivery
4. Onfleet — Pharmacy delivery software — https://onfleet.com/pharmacy
5. Onfleet Support — Auto Assignment — https://support.onfleet.com/hc/en-us/articles/360023669852-Auto-Assignment
6. Onfleet API — Automatically assign list of tasks — https://docs.onfleet.com/reference/automatically-assign-list-of-tasks
7. Onfleet Help — HIPAA compliance — https://intercom.help/onfleet-4f83d83093ac/en/articles/15254667-hipaa-compliance
8. Bringg Help — Manage your delivery network with Bringg's Delivery Hub — https://help.bringg.com/docs/manage-your-delivery-network-with-bringgs-delivery-hub
9. Bringg Help — Allow customers to choose a delivery time with Delivery Slots — https://help.bringg.com/docs/allow-customers-to-choose-a-delivery-time-with-delivery-slots
10. Bringg Help — About slots availability — https://help.bringg.com/docs/about-slots-availability
11. Bringg Help — About route optimization in Bringg — https://help.bringg.com/docs/about-route-optimization-in-bringg
12. Bringg Help — About the Bringg Driver App — https://help.bringg.com/docs/about-the-bringg-driver-app-1
13. Bringg — Consistent last-mile operations across hybrid networks — https://go.bringg.com/operations-working-with-3pls
14. SDCExec — Bringg's Dynamic Delivery Slots to offer precise eCommerce delivery windows (secondary) — https://www.sdcexec.com/transportation/last-mile/news/22939235/bringg-bringgs-dynamic-delivery-slots-to-offer-precise-ecommerce-delivery-windows
15. Jungleworks Help — Auto Allocation on Tookan — https://help.jungleworks.com/knowledge-base/auto-allocation/
16. Jungleworks — Tookan product page — https://jungleworks.com/tookan/
17. Jungleworks Help — Tookan custom templates — https://help.jungleworks.com/knowledge-base/tookan-custom-templates/
18. Jungleworks — Tookan pricing — https://jungleworks.com/tookan/pricing-demo/ ; Billing overview — https://help.jungleworks.com/knowledge-base/billing-overview-for-tookan/
19. Shipday — Pricing — https://shipday.com/pricing
20. Shipday — Proof of delivery — https://www.shipday.com/features/proof-of-delivery
21. Shipday — Route planning — https://www.shipday.com/route-planning
22. Shipday on Shopify App Store (DoorDash/Uber, customer feedback) (secondary) — https://apps.shopify.com/shipday
23. Deliverect — Dispatch — https://www.deliverect.com/en/dispatch
24. Deliverect — Pricing — https://deliverect.com/en-us/pricing
25. Deliverect Help — Snooze items to temporarily remove them from menus — https://help.deliverect.com/en/articles/7979011-snooze-items-to-temporarily-remove-them-from-menus
26. Deliverect Developers — Snooze / Unsnooze Products — https://developers.deliverect.com/v3.0-ordering-experience/reference/channel_snooze
27. Deliverect — Jahez integration — https://www.deliverect.com/ar-ae/integrations/jahez
28. Zawya — Deliverect and HungerStation partner up (secondary) — https://www.zawya.com/en/press-release/deliverect-and-hungerstation-partner-up-to-streamline-food-on-demand-gbmeum67
29. Deliverect Help — Using the Campaign Manager — https://help.deliverect.com/en/articles/16538764-using-the-campaign-manager
30. Deliverect Developers — How should I send discounts — https://developers.deliverect.com/docs/how-should-i-send-discounts
31. Otter — Menu management — https://tryotter.com/products/menu-management
32. Otter — Order management — https://tryotter.com/en-au/products/order-management
33. Otter — Products (promotions) — https://tryotter.com/en-au/products
34. TrustRadius — Otter pricing (secondary) — https://www.trustradius.com/products/otter-restaurant-operating-system-ros/pricing ; Otter helpdesk plan packages (blocked to fetch) — https://helpdesk.tryotter.com/hc/en-us/articles/18739528029715
35. Grubtech — Home / products and integrations — https://grubtech.com/
36. Wamda — Grubtech raises $15M Series B led by Jahez (secondary) — https://www.wamda.com/2024/05/grubtech-raises-15-million-series-b-led-jahez
37. talabat Developer — Integration products (Catalog, Promotions, Orders, Picking) — https://developer.talabat.com/
38. talabat — POS plugin integration documentation — https://integration.talabat.com/en/documentation/
39. HungerStation — Partner page — https://partner.hungerstation.com/en
40. UrbanPiper — HungerStation aggregator constraints (secondary) — https://api-docs.urbanpiper.com/downstream/aggregator-constraints/hungerstation
41. HungerStation — Cube universal POS integration docs (login-gated) — https://cube.hungerstation.com/
42. Foodics Help — Jahez integration (secondary) — https://help.foodics.com/hc/en-us/articles/7530462943132-Jahez
43. Omniful — Jahez integration document (secondary) — https://www.omniful.ai/docs/integration/jahez-integration-document
44. CNBC — Uber-owned Careem gets in on the dark-store market (secondary) — https://www.cnbc.com/2021/12/09/uber-owned-careem-gets-in-on-the-surging-dark-store-market-with-uae-launch-.html
45. Gulf News — Will dark stores be next big trend in UAE? Careem thinks so (secondary) — https://gulfnews.com/amp/gulfnews/business/retail/will-dark-stores-be-next-big-trend-in-uaes-supermarket-space-careem-thinks-so-1.1654572981420
46. Instacart — Storefront Pro — https://company.instacart.ca/enterprise-platform/e-commerce/storefrontpro
47. Instacart Newsroom — Instacart powers in-store and online technology for independent grocers — https://company.instacart.com/pressreleases/instacart-powers-in-store-and-online-technology-for-independent-grocers-nationwide
48. Gulf Business — Aster Pharmacy, talabat UAE partnership for prescription medicines (secondary) — https://gulfbusiness.com/?p=243110
49. FarEye — Case study: Leading Pharmacy in Saudi Arabia (PDF) — https://fareye.com/uploads/generic/pdf/Leading-Pharmacy-in-Saudi-Arabia.pdf
50. Gulf Business — FarEye raises $25m Series D (lists Nahdi as client) (secondary) — https://mot-backup.gulfbusiness.com/?p=159273
51. IKEA Newsroom — Ingka Group acquires Locus — https://www.ikea.com/in/en/newsroom/corporate-news/ingka-group-acquires-locus-an-ai-powered-logistics-software-company-to-transform-the-ikea-home-delivery-experience-pub3d38b980
52. Locus — AI dispatch & rider productivity in quick commerce — https://locus.sh/blogs/ai-dispatch-rider-productivity-quick-commerce-sea/
53. API Evangelist — Delivery Hero APIs (On-Demand Rider) (secondary) — https://providers.apievangelist.com/providers/delivery-hero/
54. Jungleworks Help — Round Robin auto allocation — https://help.jungleworks.com/knowledge-base/round-robin-auto-allocation/
55. Jungleworks Help — Auto allocation methods on Tookan dashboard — https://help.jungleworks.com/knowledge-base/auto-allocation-methods-on-tookan-dashboard/
56. Jungleworks Help — Task assignment on Tookan — https://help.jungleworks.com/knowledge-base/task-assignment-on-tookan/
57. SAP Store — Bringg partner profile (secondary) — https://www.sap.com/partners/profile/bringg
58. APIs.io — Bringg provider profile (returns, fleet-partner intelligence) (secondary) — https://providers.apis.io/providers/bringg/
59. Parcel & Postal Technology International — FarEye partners with Emirates Post and Landmark Group (secondary) — https://www.parcelandpostaltechnologyinternational.com/news/delivery/fareye-partners-with-emirates-post-and-landmark-group-to-improve-deliveries-in-gcc.html
