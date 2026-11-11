# 717 — Pharmacy and health-retail omnichannel: what the market offers that a generic OMS does not

Desk research, 2026-11-03. Market side only; our own platform is not assessed here. Sibling
research covers generic enterprise OMS (Manhattan, Salesforce, Sterling, and others). The rows
below are **pharmacy-specific extras** for the comparison matrix.

Evidence conventions: `[n]` = numbered source in §6. "(secondary)" = press, vendor or aggregator,
not the company or regulator itself. `?` = not found / not confirmed. Nothing is inferred from
memory without a source. Where a fact comes from a search-result summary of a page we could not
open (several Tadawul PDFs and regulator pages refused direct fetch), this is said explicitly.

---

## 1. Summary

- **Digital is already about a quarter to a third of a KSA pharmacy leader's sales.** Nahdi reports
  digital at **25.8% of sales in FY2025** (> SAR 2.5 bn) and **31% of revenue in Q1 2026**, up from
  16.6% (2023) and 22% (2024) [1][3][63]. That is a higher digital share than most generic
  retailers publish.
- **Regulation, not marketing, defines the KSA must-haves:** e-prescription via **Wasfaty**
  (MoH/NUPCO) [41][42][4], insured dispensing through **NPHIES** (CHI) [52][53], **SFDA RSD** drug
  track-and-trace on every pack movement with fines up to **SAR 5 m** and closures up to 180 days
  [46][45], a national **controlled-drug e-prescription** platform covering private pharmacies
  [50][51], and **shortage notification** to SFDA [46]. None of these is in a generic OMS.
- **Wasfaty opened to private chains at scale in 2025:** Nahdi signed with NUPCO on 10 Jul 2025 and
  went live across all its pharmacies on 1 Oct 2025 [4][5]. Wasfaty covers 5,053 pharmacies
  (May 2024, secondary) [42].
- **Enforcement on RSD is live:** SFDA fined 10 pharmacies > SAR 1.7 m (Jan 2026) — 7 of them for
  not reporting drug movements [46].
- **Speed is the GCC delivery battleground:** Nahdi "Delivery Now" in 30 min (app listing) [8];
  Al-Dawaa "within 60 minutes (eligible areas)" [16]; myAster 24/7 express within 90 min across 5
  emirates [22]; Aster prescription medicines on **talabat** [26].
- **US/UK leaders compete on refill automation, not speed alone:** CVS ReadyFill auto-refill and
  ScriptSync [32][33]; Boots PrescriptionsPlus (NHS-app ordering, stage-by-stage SMS tracking)
  [36]; Amazon PillPack adherence packs and RxPass at $5/month [35].
- **Fulfilment network is a pharmacy-specific asset:** Walgreens 12 robotic micro-fulfilment
  centres serve > 5,000 stores and fill > 3.5 m Rx/week [29]; Boots regional dispensing hub
  supplies stores within 24 h [36]; Al-Dawaa reportedly runs 23 dark stores (secondary) [17].
- **Loyalty has pharmacy rules:** Boots excludes NHS prescriptions from Advantage points [38];
  myWalgreens earns 1% on Rx but cannot be redeemed on Rx [31]. KSA chains run their own points
  (Nahdi **Nuhdeek**, Al-Dawaa **Arbahi**) plus partner currencies (Mobily Neqaty) [8][15][11].
- **The "omni-health" move:** Nahdi runs 14 polyclinics in 9 cities tied to its digital platform
  [3]; myAster bundles pharmacy, video consult, appointments and home care (5 m users) [20][21];
  Amazon puts pharmacy kiosks in One Medical clinics [35].
- **Thin evidence:** Al-Dawaa's digital share (only a 2021 company figure of 5% and a secondary
  ">15% in 2024"), Aster's digital revenue (none published), official CHI/NPHIES pharmacy mandate
  dates, and the exact SFDA RSD dispense-scan rule text (vendor-sourced).

---

## 2. Pharmacy-specific capability rows

Classification: **REG** = Regulatory must-have in KSA/GCC · **STD** = Competitive standard ·
**DEL** = Customer delighter.

| ID | Capability | What it means (CFO-readable) | Class |
|---|---|---|---|
| RX-01 | National e-prescription intake | The pharmacy pulls a doctor's electronic prescription from the national system (KSA Wasfaty, UK NHS EPS) instead of reading paper, and dispenses against it. | **REG** (KSA) |
| RX-02 | Prescription upload in app/web | Customer photographs a paper prescription in the app; a pharmacist reviews it and the order is delivered or held for pickup. | STD |
| RX-03 | Insurance eligibility check | Before dispensing, the till checks in real time that the patient's insurance policy is active and covers the medicine (KSA: NPHIES). | **REG** (KSA, insured) |
| RX-04 | Pre-authorisation and e-claim | Medicines that the insurer must approve are sent for approval, and every insured sale is claimed electronically through the national exchange. | **REG** (KSA, insured) |
| RX-05 | Patient-share / co-pay split | The basket is split between what the insurer pays and what the patient pays (deductible, co-pay), in store and online. | STD |
| RX-06 | Serial & batch track-and-trace at scan | Every medicine pack's GS1 2D barcode (serial, batch, expiry) is scanned and its movement reported to the regulator (KSA: SFDA RSD). | **REG** (KSA) |
| RX-07 | Expiry / recall / suspect-pack block | The till refuses a pack that is expired, recalled or flagged by the regulator before it reaches the customer. | STD (REG-adjacent) |
| RX-08 | Controlled-drug e-prescription & log | Narcotic and psychotropic medicines are prescribed and dispensed only through the national controlled-drug platform, with a full audit trail. | **REG** (KSA) |
| RX-09 | Shortage notification to regulator | The chain must warn the regulator of expected shortages or supply disruption ahead of time. | **REG** (KSA) |
| RX-10 | E-pharmacy licence conditions | Selling medicines online requires an e-pharmacy licence tied to a licensed physical pharmacy and a licensed pharmacist. | **REG** (KSA/UAE) |
| RX-11 | Pharmacist verification / Rx session | A licensed pharmacist checks and signs off each prescription (in store or remotely) before release; the system records who did it. | **REG** |
| RX-12 | Ask-a-pharmacist (chat/video) | Free chat or video with a pharmacist from the app for advice and product choice. | STD |
| RX-13 | Online doctor / teleconsult to Rx | Customer sees a doctor online and the resulting prescription flows straight to the pharmacy. | DEL |
| RX-14 | Refill reminders | The customer is reminded before a regular medicine runs out. | STD |
| RX-15 | Auto-refill | Regular medicines are refilled automatically a few days before they run out, without the customer asking. | DEL (GCC) / STD (US) |
| RX-16 | Refill synchronisation | All of a patient's regular medicines are aligned to one collection or delivery date per month. | DEL |
| RX-17 | Rx order tracking & "ready" alerts | The customer sees each stage (ordered → approved → ready → out for delivery) by SMS/app. | STD |
| RX-18 | Click & collect for Rx (incl. drive-thru / kiosk / curbside) | Prescription prepared in advance and picked up in store, at a drive-thru, curbside, or a clinic kiosk. | STD |
| RX-19 | Express medicine delivery (≤ 60–90 min) | Medicines, including prescription items, delivered within an hour or so, often 24/7. | STD (GCC) |
| RX-20 | Rx delivery via aggregators | Prescription medicines sold through talabat / DoorDash / Uber-type apps, with the pharmacy keeping the regulated checks. | DEL |
| RX-21 | Free or insured Rx home delivery | Prescription medicines delivered at no delivery fee (often as a policy or insurer-covered service). | STD |
| RX-22 | Inter-store transfer / dark stores for OOS medicine | An out-of-stock medicine is sourced from another branch or a dark store and delivered or transferred, instead of losing the sale. | STD (ops) |
| RX-23 | Central fill / micro-fulfilment | Robotic hubs fill routine prescriptions for many stores, freeing pharmacists and cutting stock. | DEL (ops, cost) |
| RX-24 | Health loyalty with Rx earn/burn rules | Loyalty that knows prescription items are treated differently (excluded from earning, or cannot be redeemed against). | STD |
| RX-25 | Partner loyalty currencies | Customers pay or earn with telco/bank points at the pharmacy (e.g. Mobily Neqaty). | STD (KSA) |
| RX-26 | Adherence packaging | Medicines sorted into dated, timed pouches (PillPack-style) for chronic patients. | DEL |
| RX-27 | Rx subscription pricing | A flat monthly fee covers a list of common generic medicines. | DEL |
| RX-28 | Chronic-care programme | Ongoing programme for chronic patients: refills, reminders, check-ins, sometimes delivery. | STD |
| RX-29 | Clinic / polyclinic integration ("omni-health") | Pharmacy app and records joined to the chain's own clinics, appointments and home care. | DEL |
| RX-30 | Pharmacy services booking (vaccines, tests) | Book a vaccine or pharmacy service slot online. | STD |
| RX-31 | Profile-based pharmacist recommendations | Pharmacist uses the customer's account history to recommend suitable products. | DEL |

31 rows.

---

## 3. Coverage table

✔ = documented · partial = documented with limits · ? = not found. Footnotes are source numbers in §6.

| ID | Walgreens | CVS | Boots | Amazon Pharmacy | Nahdi | Al-Dawaa | Aster |
|---|---|---|---|---|---|---|---|
| RX-01 e-Rx intake (national) | ? | ? | ✔ NHS app/EPS [36] | ? | ✔ Wasfaty all stores, 1 Oct 2025 [4][5] | partial — Wasfaty sales cited 2022 (secondary) [18] | partial — UAE e-pharmacy via DHA systems [56] |
| RX-02 Rx upload in app | ? | ? | n/a (NHS repeat) [37] | ? | ✔ [8] | ? | ✔ (with insurance card) [23] (secondary) |
| RX-03 Eligibility check | ? | ? | n/a (NHS) | ? | ? (NPHIES participation not published) | ? | partial — call-centre approval flow [23] (secondary) |
| RX-04 Pre-auth / e-claim | ? | ? | n/a | ? | ? | ? | partial [23] |
| RX-05 Co-pay split | partial — "some plans don't cover delivery" [28] | partial — delivery tied to benefit plans [33] | n/a | ? | ? | ? | ? |
| RX-06 Serial/batch T&T | n/a (US DSCSA, not checked) | n/a | n/a | n/a | ? (KSA law applies to all [45][46]) | ? (law applies) | ? |
| RX-07 Expiry/recall block | ? | ? | ? | ? | ? | ? | ? |
| RX-08 Controlled-drug e-Rx | n/a | n/a | n/a | n/a | ? (law applies [50]) | ? (law applies) | ? |
| RX-09 Shortage notice | n/a | n/a | n/a | n/a | ? (law applies [46]) | ? | ? |
| RX-10 E-pharmacy licence | n/a | n/a | n/a | n/a | ✔ implied by operation [1] | ✔ implied [16] | ✔ UAE [56] |
| RX-11 Pharmacist verification | ? | ? | ? | ✔ 24/7 pharmacist access [35] | ? | ? | ? |
| RX-12 Ask-a-pharmacist | ✔ 24/7 pharmacy chat [28] (secondary snippet) | ? | ? | ✔ 24/7 [35] | ✔ free video "Ask the Pharmacist" [6][9] | ? | ✔ video consult in app [20] |
| RX-13 Online doctor → Rx | ? | ? | ✔ Online Doctor, 45 conditions [39] (secondary) | partial — One Medical link [35] | partial — 14 polyclinics + digital [3] | ? | ✔ video consult [20] |
| RX-14 Refill reminders | ✔ text alerts [28] | ✔ [33] | ✔ reorder reminders [36][37] | ✔ [35] | ? | ? | ? |
| RX-15 Auto-refill | ? | ✔ ReadyFill [33] | ? | ✔ automatic refills [35] | ? | ? | ? |
| RX-16 Refill sync | ? | ✔ ScriptSync [32] | ? | partial — PillPack monthly [35] | ? | ? | ? |
| RX-17 Rx tracking & alerts | ✔ ready text alerts [28] | ? | ✔ stage-by-stage SMS [36] | ? | ? | ? | ? |
| RX-18 Click & collect Rx | ✔ store/drive-thru/curbside [28] | ? | ✔ any Boots pharmacy [36] | ✔ One Medical kiosks [34][35] | ✔ pickup at chosen branch [8] | ? | ? |
| RX-19 Express delivery | ✔ same-day Rx; 24/7 retail delivery ~400 stores [28][64] | ✔ same-day via Shipt [33] | partial — free Royal Mail (not express) [36] | ✔ same-day, ~4,500 cities by end-2026 [34][35] | ✔ "Delivery Now" 30 min (app listing) [8]; 2-h telesales [7] | ✔ ≤ 60 min eligible areas [16] | ✔ 24/7, ≤ 90 min, 5 emirates [22] |
| RX-20 Aggregator Rx delivery | ✔ DoorDash/Uber (HIV, Paxlovid) [30] | ? | partial — Advantage on Deliveroo (retail) [40] | n/a (own logistics) | ? | ? | ✔ talabat Rx [26] |
| RX-21 Free Rx delivery | ? | ? | ✔ free NHS Rx delivery in England [36] | ✔ included with RxPass [35] | ✔ since 2020 [10] | partial — free over SAR 100 / 50 (listings differ) [15] | ? |
| RX-22 Store transfer / dark stores | ? | ? | ✔ regional hub ≤ 24 h [36] | n/a | ? | partial — 23 dark stores (secondary) [17] | ? |
| RX-23 Central fill / MFC | ✔ 12 MFCs, > 3.5 m Rx/wk [29] | ? | ✔ Basingstoke hub, 150 stores [36] | ? | ? | ? | ? |
| RX-24 Rx-aware loyalty | ✔ 1% earn on Rx, no redeem on Rx [31] | partial — ExtraCare excludes Rx; Pharmacy & Health Rewards (secondary) [31] | ✔ Rx excluded from points [38] | n/a | ✔ Nuhdeek points, dynamic QR [8] | ✔ Arbahi points [15] | partial — Aster Secure (UAE, secondary) [27] |
| RX-25 Partner currencies | ? | ? | ? | n/a | ✔ Mobily Neqaty [11] | ✔ Mobily Neqaty [15] | ✔ Al Rajhi card offers [66] |
| RX-26 Adherence packs | ? | ? | ? | ✔ PillPack [35] | ? | ? | ? |
| RX-27 Rx subscription | ? | ? | ? | ✔ RxPass $5/mo [35] | ? | ? | ? |
| RX-28 Chronic-care programme | ? | partial — ScriptSync for maintenance meds [32] | ✔ repeat-Rx service [36] | ✔ [35] | ? | ? | ? |
| RX-29 Clinic integration | ? | ? | ? | ✔ One Medical [35] | ✔ 14 polyclinics [3] | ? | ✔ hospitals/clinics + myAster [20][21] |
| RX-30 Services booking | ? | ✔ online scheduler (2010) [67] | ✔ Online Doctor [39] | ? | ? | ? | ✔ appointments in app [20] |
| RX-31 Profile-based recommendations | ? | ? | ? | ? | ✔ [7] | ? | ? |

Reading the table: "?" mostly means **not found in this pass**, not "absent". US/UK chains score
"n/a" on KSA regulatory rows by definition; they meet equivalent home-market rules (e.g. US DSCSA)
that were out of scope.

---

## 4. Regional competitor snapshot (direct comparators)

### 4.1 Nahdi Medical Co. (KSA, Tadawul 4164) — the benchmark

| Metric | Value | Source |
|---|---|---|
| Digital share of sales | 16.6% (2023) → 22% (2024) → **25.8% (FY2025)** → **31% (Q1 2026)** | [63][1][3] |
| Digital revenue | > **SAR 2.5 bn** in 2025 | [1] (filing, via search summary) |
| Online growth | 26% in 2025 | [65] (secondary) |
| Store network | 1,218 pharmacies (9M 2025, KSA + UAE; 71 openings in 9M) | [2] |
| Q1 2026 revenue | ~SAR 2.79 bn, +6% YoY | [3] / [68] (secondary) |
| Healthcare | 14 polyclinics in 9 cities, "well-integrated digital platform"; healthcare revenue +35% (Q1 2026) | [3] |
| Wasfaty | NUPCO agreement 10 Jul 2025; live in all pharmacies 1 Oct 2025; Q3 2025 cost "Wasfaty readiness" | [4][5][2] |
| App features | Rx photo upload → delivery or branch pickup; Ask the Pharmacist (free video); profile-based recommendations | [8][6][7] |
| Delivery promise | "Delivery Now" in 30 min (app listing, 2025); 2-h telesales delivery; free Rx home delivery since 2020 | [8][7][10] |
| Loyalty | **Nuhdeek** points (earn/burn in app, dynamic QR); Mobily Neqaty partner | [8][11] |
| Platform | Adobe Commerce omnichannel build by Redbox/SQLI (secondary) | [62] |
| Unknown | NPHIES integration depth, insured-online share, aggregator partners, refill automation | ? |

### 4.2 Al-Dawaa Medical Services (KSA, Tadawul 4163)

| Metric | Value | Source |
|---|---|---|
| Revenue | SAR 6.74 bn FY2025, +4.4%; net profit SAR 321.8 m, −8.4% | [12] |
| Digital share | 1.5% (2019) → 5% (2021, company interview); "> 15% omnichannel in 2024" (secondary, unverified) | [14][17] |
| Digital investment | FY2025: higher S&D costs tied to "a digital platform"; "improving multi-channel sales capabilities by launching a digital platform" | [12] |
| 9M 2025 driver | Retail growth "contributed by omni-channel and engagement initiatives" | [13] |
| Store network | > 900 pharmacies in 130 locations (2022); 954 pharmacies + 23 dark stores (Jun 2025, secondary) | [14][17] |
| Wasfaty | Cited a 68% rise in Wasfaty sales (2022, secondary); 2025 status ? | [18] |
| Delivery promise | "Arrives within 60 minutes (eligible areas)"; free delivery threshold SAR 100 (listings differ: SAR 50) | [16][15] |
| Loyalty | **Arbahi** points in app; Mobily Neqaty redeemable in branches | [15] |
| Supply chain | RELEX customer (forecasting/replenishment) | [19] |
| Unknown | Current digital %, app users, NPHIES, aggregators | ? |

### 4.3 Aster (Aster DM Healthcare GCC / Aster Pharmacy)

| Metric | Value | Source |
|---|---|---|
| Footprint | 15 hospitals, 124 clinics, 333 pharmacies across GCC (secondary) | [20] |
| myAster users | 5 m users (UAE/GCC) | [21] |
| App scope | Online pharmacy, Rx home delivery, appointments, video consultation, home care | [20] |
| Delivery promise | 24/7 express, within 90 min, 5 emirates | [22] |
| Aggregator | Prescription medicines via **talabat** (UAE) | [26] |
| Insured Rx online | Upload Rx + Emirates ID + insurance card; call centre handles approval (secondary) | [23] |
| KSA entry | ~$250 m KSA expansion; myAster launched in KSA (LEAP, Feb 2025); "Trio" Riyadh flagship Feb 2025; 15 Riyadh stores, plan 180 in KSA | [20][25][24] |
| Loyalty | **Aster Secure** (UAE, since 2016; ~770k active — secondary, unverified) | [27] |
| Unknown | Digital revenue share (not published), KSA Wasfaty/NPHIES status | ? |

**So what for us:** Nahdi's 31% digital share and nationwide Wasfaty are the bar the board will be
measured against; Aster is the one regional player already selling Rx through a food aggregator,
which is the closest analogue to our HungerStation/Deliverect rail.

---

## 5. KSA / GCC regulatory landscape (brief)

| Regime | Owner | What it requires of a retail pharmacy | Status / date | Source |
|---|---|---|---|---|
| **Wasfaty** e-prescription | MoH, run by NUPCO | Dispense MoH-facility e-prescriptions to eligible (government-entitled) patients via the platform; participating pharmacies contract with NUPCO | Running since ~2018; > 20 m Rx by Dec 2021; 5,053 pharmacies May 2024; private chain rollout 2025 (Nahdi 1 Oct 2025). One study calls use "mandatory for doctors and pharmacies" (secondary) | [41][42][4][43][44] |
| **NPHIES** insurance exchange | CHI (formerly CCHI) | Eligibility, prior authorisation, claims, payment reconciliation for insured patients via FHIR R4 | Launched 2021; CHI Circular 289 (28 Sep 2022) cited as pharmacy transition point (secondary); exact pharmacy mandate date **?** | [52][53] |
| **SFDA RSD** drug track & trace | SFDA | Report every pack movement (receive, dispense/deactivate) using GS1 2D barcode (GTIN, serial, batch, expiry); vendor sources say pharmacist scans the pack before handing out | In force; Jan 2026 fines > SAR 1.7 m on 10 pharmacies; max SAR 5 m, closure ≤ 180 days, licence cancellation; SFDA–pharmacy committee meeting 5 Jan 2026 | [45][46][47][48][49] |
| **Shortage notification** | SFDA (under RSD enforcement) | Notify expected shortages/supply disruption in advance (one fine was for missing a 6-month notice) | In force (enforced Jan 2026) | [46] |
| **Controlled drugs** | MoH platform + SFDA CDS / Raqeeb | Narcotic/psychotropic prescriptions electronic; dispensing tracked at governmental, community and private pharmacies | National platform reported Feb 2025; mandate wording not explicit | [50][51] |
| **E-pharmacy licence (KSA)** | MoH (licence annex), SFDA | Online sale needs licensed physical pharmacy + licensed pharmacist; cyber, delivery, consultation criteria (secondary) | Annex exists, text not retrieved; KSU review notes rules still incomplete | [54][55] |
| **UAE e-pharmacy** | DHA (Dubai), DoH (Abu Dhabi) | Rx e-pharmacy only via facility systems audited by DHA; drug delivery licence (Sheryan); Abu Dhabi pharmacies must connect to Malaffi HIE | In force (2021 circular; 2024 DHA note) | [56][57] |
| **Bahrain** | NHRA | Patients free to buy Rx outside hospital pharmacies; national e-Rx is a National Health Plan 2016–2025 goal; current e-Rx/e-pharmacy rule **?** | ? | [58] |

Relevant to us because: all five KSA rows (Wasfaty, NPHIES, RSD, shortage notice, controlled drugs)
are things a generic OMS vendor would have to build or buy from a local specialist (e.g. Juleb
advertises Wasfaty and RSD integrations [48]).

---

## 6. Sources

1. Nahdi FY2025 results filing, Saudi Exchange, 9 Mar 2026 — https://www.saudiexchange.sa/Resources/fsPdf/19372_2964_2026-03-09_02-18-26_en.pdf (direct fetch refused; figures via search-result summary)
2. Nahdi 9M 2025 press release, Zawya — https://www.zawya.com/en/press-release/companies-news/nahdi-sustains-growth-momentum-delivering-76-revenue-growth-in-9m-2025-f0loaidh
3. Nahdi Q1 2026 press release "Nahdi reports 6.1% growth…", Zawya — https://www.zawya.com/en/press-release/companies-news/nahdi-reports-61-growth-while-continuing-strategic-investment-in-healthcare-d1hfos1y
4. "Nahdi rolls out Wasfaty e-services nationwide", Argaam, 9 Oct 2025 — https://www.argaam.com/en/article/articledetail/id/1848788
5. "Nahdi ties up with NUPCO to launch 'Wasfaty' program", Argaam — https://www.argaam.com/en/article/articledetail/id/1846424
6. Nahdi press release on e-pharmacist / Ask the Pharmacist, Zawya — https://www.zawya.com/en/press-release/nahdi-medical-company-the-kingdoms-leading-health-and-wellbeing-innovator-completes-the-launch-of-its-e-lfhvpnly
7. Nahdi flagship pharmacy Riyadh press release, Zawya — https://www.zawya.com/en/press-release/companies-news/nahdi-medical-company-opens-its-largest-flagship-pharmacy-in-the-kingdom-in-riyadh-czcs9ao0
8. Nahdi app, Apple App Store (and aggregator mirrors) — https://apps.apple.com/us/app/alnhdy-nahdi/id868704084
9. "Nahdi Medical plans e-pharmacists service as it prepares for IPO", Arab News (secondary) — https://www.arabnews.com/node/2014611/amp
10. "Nahdi Medical offers free home delivery of all prescription medications across the Kingdom", Eye of Riyadh, 30 Mar 2020 (secondary) — https://www.eyeofriyadh.com/news/details/nahdi-medical-offers-free-home-delivery-of-all-prescription-medications-across-the-kingdom
11. Mobily Neqaty partner page — Nahdi — https://www.mobily.com.sa/web/en/personal/neqaty/neqaty-partners/nahdi
12. Aldawaa FY2025 annual results, Argaam disclosure — https://www.argaam.com/en/bf/aldawaa/article/id/1902051/aldawaa-medical-services-co-announces-its-annual-financial-results-for-the-period-ending-on-2025-12-31
13. Aldawaa 9M 2025 interim results, Argaam disclosure — https://www.argaam.com/en/bf/aldawaa/article/id/1858436/aldawaa-medical-services-co-announces-its-interim-financial-results-for-the-period-ending-on-2025-09-30-nine-months
14. "Al-Dawaa holds 14% local market share, eyes expansion of pharmacy network", Argaam, Mar 2022 — https://betapp.argaamcharts.com/en/article/articledetail/id/1543078
15. Al-Dawaa Pharmacies app, Apple App Store (SA) — https://apps.apple.com/sa/app/id681487514 ; Mobily Neqaty Al-Dawaa — https://www.mobily.com.sa/web/en/personal/neqaty/neqaty-partners/dawaa
16. Al-Dawaa product page ("Arrives within 60 minutes (eligible areas)") — https://www.al-dawaa.com/en/p/252719/al-dawaa-plus-glow-mood-bag
17. Ken Research, Saudi Arabia retail pharmacy market (secondary) — https://www.kenresearch.com/industry-reports/saudi-arabia-retail-pharmacy-market
18. "Saudi pharma chain Al-Dawaa's profit slips 3% even as revenues grow", Arab News, 2022 (secondary) — https://arabnews.com/node/2053336
19. RELEX customer story — Al-Dawaa Pharmacies — https://www.relexsolutions.com/customers/al-dawaa-pharmacies/
20. "Arab Health 2025: Aster to expand pharmacy retail and digital presence", Gulf News — https://gulfnews.com/uae/health/arab-health-2025-uae-based-aster-to-expand-pharmacy-retail-and-digital-presence-1.500023771
21. "myAster hits 5 million users…", Khaleej Times — https://www.khaleejtimes.com/business/myaster-hits-5-million-users-as-uaes-healthcare-market-embraces-digital-shift
22. "myAster expands 24/7 express delivery service to 4 more emirates", Gulf News — https://gulfnews.com/business/need-medicines-fast-myaster-expands-247-express-delivery-service-to-4-more-emirates-1.500260777
23. "When Healthcare Meets Hyperlocal: Inside Aster's Rapid Delivery Playbook", Images RetailME (secondary) — https://www.imagesretailme.com/when-healthcare-meets-hyperlocal-inside-asters-rapid-delivery-playbook/
24. "Aster Pharmacy launches in Saudi Arabia with 'Trio'", Zawya — https://www.zawya.com/en/press-release/companies-news/aster-pharmacy-launches-in-saudi-arabia-with-trio-the-flagship-store-in-riyadh-me12noyx
25. "Aster DM Healthcare takes a leap into Saudi Arabia with AI-powered myAster at LEAP 2025", Albawaba — https://www.albawaba.net/business/pr/aster-dm-healthcare-takes-leap-saudi-1599494
26. "Aster Pharmacy, talabat UAE announce partnership to deliver prescription medicines", Gulf Business (secondary; fetch refused, title only) — https://gulfbusiness.com/?p=243110
27. "Redefining healthcare", Images RetailME (secondary; Aster Secure claim via search summary, unverified) — https://imagesretailme.com/?p=43379
28. Walgreens pharmacy checkout / delivery options page — https://www.walgreens.com/rx-checkout/pharmacy-landing ; Walgreens Pickup — https://walgreens.com/Pickup
29. Walgreens micro-fulfilment expansion, Business Wire, 20 May 2025 — https://www.businesswire.com/news/home/20250520109352/en ; Supermarket News — https://www.supermarketnews.com/new-stores/walgreens-adds-new-micro-fulfillment-facility-in-minnesota
30. "Walgreens partners with DoorDash, Uber to provide free same-day delivery of HIV medications", Pharmacy Times (secondary) — https://www.pharmacytimes.com/view/walgreens-partners-with-doordash-uber-to-provide-free-same-day-delivery-of-hiv-medications
31. myWalgreens programme release, Business Wire (secondary for terms) — https://www.businesswire.com/news/home/20230713871518/en ; Yahoo "6 Best Drugstore Loyalty Programs" (secondary, CVS ExtraCare) — https://news.yahoo.com/6-best-drugstore-loyalty-programs-230009026.html
32. CVS ScriptSync — https://cvshealth.com/about/our-offerings/cvs-pharmacy/scriptsync
33. CVS "Prescription refills made easy" (ReadyFill, delivery) — https://www.cvs.com/content/refill
34. "Amazon Pharmacy to expand same-day delivery to nearly 4,500 US cities", TechCrunch, 11 Feb 2026 — https://techcrunch.com/2026/02/11/amazon-pharmacy-to-expand-same-day-delivery-to-nearly-4500-us-cities/
35. "Amazon Pharmacy expanding same-day delivery to 4,500 cities and towns", Supermarket News (RxPass, PillPack, kiosks) — https://www.supermarketnews.com/nonfood-pharmacy/amazon-pharmacy-expanding-same-day-delivery-to-4-500-cities-and-towns
36. "Boots launches PrescriptionsPlus…", Boots UK newsroom, Jan 2026 — https://www.boots-uk.com/newsroom/news/boots-launches-prescriptionsplus-to-simplify-managing-nhs-repeat-prescriptions
37. Boots online prescriptions — https://boots.com/online/pharmacy
38. Boots Advantage Card terms & conditions — https://www.boots.com/en/Help/Boots-Advantage-Card/
39. "Boots expands Online Doctor services", Get Surrey (secondary) — https://www.getsurrey.co.uk/news/uk-world-news/boots-expands-online-doctor-services-20925760
40. "Boots Advantage Card now on Deliveroo", Deliveroo — https://deliveroo.co.uk/more/news-articles/boots-advantage-card-now-on-deliveroo
41. "MOH: Over 20M prescriptions dispensed via 'Wasfaty'", Ministry of Health, 29 Dec 2021 — https://www.moh.gov.sa/en/ministry/mediacenter/news/pages/news-2021-12-29-001.aspx
42. "Wasfaty Service", Saudipedia — https://saudipedia.com/en/wasfaty-service
43. Wasfaty study, Frontiers in Medicine 2024 (secondary for "mandatory") — https://www.frontiersin.org/articles/10.3389/fmed.2024.1487852/full
44. Monsha'at, Small and Medium Pharmacies Support Initiative (Wasfaty) — https://monshaat.gov.sa/en/node/257118
45. SFDA RSD portal — https://rsd.sfda.gov.sa/index-en.html
46. "Saudi Arabia fines 10 pharmacies SR1.7 million over drug tracking violations", Gulf News, Jan 2026 — https://gulfnews.com/world/gulf/saudi/saudi-arabia-fines-10-pharmacies-sr17-million-over-drug-tracking-violations-1.500407741
47. SFDA article on RSD (PDF) — https://SFDA.GOV.SA/sites/default/files/2022-12/SFDA_Article%203_RSD.pdf
48. Juleb, "Pharmaceutical Serialization and Traceability RSD Saudi Arabia" (vendor, secondary) — https://juleb.com/blog/pharmaceutical-serialization-in-saudi/en ; https://erp.juleb.com/blog/SFDA-Track-and-Trace-Requirements/en
49. TraceLink, Saudi Arabia compliance requirements 2019 (secondary, dated) — https://www.tracelink.com/_global-asset/pdf/saudiarabiacompliancerequirements_2019.pdf
50. "Prescription of controlled drugs goes digital in Saudi Arabia", Gulf News, Feb 2025 — https://gulfnews.com/world/gulf/saudi/prescription-of-controlled-drugs-goes-digital-in-saudi-arabia-1.500030057
51. SFDA Controlled Drugs System (CDS) — https://cds.sfda.gov.sa/
52. NPHIES workflows (unofficial documentation, secondary) — https://fadil369.github.io/brainsait-docs/healthcare/nphies/workflows
53. "Understanding NPHIES, KSA's health information exchange", Healthcare IT News (secondary; fetch refused) — https://www.healthcareitnews.com/news/emea/understanding-nphies-ksas-health-information-exchange
54. MoH licences e-services (e-pharmacy licensing annex) — https://www.moh.gov.sa/en/eservices/licences/pages/licences.aspx
55. Online pharmacy regulation review, Frontiers in Pharmacology 2024 — https://www.frontiersin.org/articles/10.3389/fphar.2024.1380231/full
56. DHA news on e-pharmacy and drug delivery licences — https://www.dha.gov.ae/en/media/news/866
57. Malaffi connection circular (Abu Dhabi), 2021 — https://openjet.inhealth.ae/assets/pdf/malaffi-circular.pdf
58. "No compulsion to buy medication from hospital pharmacies in Bahrain: NHRA", News of Bahrain — https://www.newsofbahrain.com/bahrain/86718.html
59. Salesforce Health Cloud documentation (medication management) — https://resources.docs.salesforce.com/latest/latest/en-us/sfdc/pdf/healthcare.pdf
60. Omnicell One launch, Business Wire, Jul 2020 — https://www.businesswire.com/news/home/20200720005206/en
61. (number not used)
62. "Redbox delivers scalable, robust omnichannel capability for … Nahdi", SQLI (vendor, secondary) — https://www.sqli.com/int-en/insights/redbox-delivers-scalable-robust-omnichannel-capability-saudis-largest-pharmacy
63. Nahdi FY2024 results filing, Saudi Exchange, Mar 2025 (22% vs 16.6%, via search summary) — https://www.saudiexchange.sa/Resources/fsPdf/19372_2964_2025-03-10_01-54-37_en.pdf
64. "Walgreens debuts 24-hour same-day delivery", Drug Store News, Dec 2022 — https://drugstorenews.com/walgreens-debuts-24-hour-same-day-delivery
65. Forbes Middle East, Top Healthcare Leaders 2026 — Yasser Joharji (secondary) — https://www.forbesmiddleeast.com/lists/top-healthcare-leaders-2026-executives/yasser-joharji/
66. Al Rajhi Bank card offers — Aster Pharmacy — https://www.alrajhibank.com.sa/en/personal/offers/cardsoffers/health-and-wellness/aster-pharmacy
67. "CVS/pharmacy, MinuteClinic announce new online scheduler", Drug Store News, 2010 — https://drugstorenews.com/pharmacy/cvspharmacy-minuteclinic-announce-new-online-scheduler
68. "Nahdi Medical achieves nearly SAR 2.8bn revenue in Q1-26", Decypha (secondary) — https://decypha.com/en/news/details/Nahdi-Medical-achieves-nearly-SAR-2-8bn-revenue-in-Q1-26/21549472?L=EN

### Platform vendors (context, not scored)

- **Salesforce Health Cloud**: Medication Management and Medication Review (reconciliation,
  therapy review); prescription-fulfilment configuration for retail pharmacies is a partner use
  case, not a packaged dispensing system [59].
- **Omnicell**: "Autonomous Pharmacy" automation, cloud inventory visibility (Omnicell One) [60];
  central-fill detail not retrieved (?).
- **McKesson**: nothing retrieved in this pass (?).
- **GCC**: Juleb (KSA) markets pharmacy ERP/POS with Wasfaty and RSD integrations (vendor claim)
  [48]. No other GCC pharmacy-OMS vendor surfaced with public detail (?).
