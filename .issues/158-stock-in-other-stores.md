---
type: wayfinder-ticket
wayfinder: research
map: 126
status: done
blocked-by: —
---

# 158 — Stock for an item in other stores

## Question

**Owner-added scope, 2026-07-27 — ruled into phase 1.** When the order's store cannot supply an
item, the agent needs to know who can. Like [157](157-price-check.md) this is a **till** feature
today, unreachable from CC1/CC2: `ItemInfoLookupController.StockInOtherStoresCommand` opens
`StockByDistanceController`, which shows a `DistanceKm` column and calls
`StockV2Service.GetCurrentStockByDistance(itemNumber, myPlant.Latitude, myPlant.Longitude)`, with an
OMS path through `OmsService.HttpService.MaterialPlantStockModel(...)`.

This is the first thing on the map that needs **geo**, and the first item read that is deliberately
**not** scoped to the order's plant — [131](131-item-search-endpoint.md) folded `Stock/ItemPlant` in
server-side *at the order's plant*, which is the opposite reach.

What to establish:

- **Where the distance comes from.** `GetPlant(stockStore)` supplies lat/long, so plants carry
  coordinates — confirm the source table is populated estate-wide, not just for the stores the till
  runs in. A missing coordinate must degrade to "distance unknown", never to an omitted store.
- **Which of the two reads is authoritative** — `StockV2Service` direct, or the OMS
  `MaterialPlantStockModel` HTTP path — and whether either is already exposed on SIS.Api or needs a
  new contract behind [137](137-callcenter-web-door.md)'s door.
- **Cost and cardinality.** A stock read across the estate is a different query from a single-plant
  ATP read. How many rows, how slow, and does it need the same cap + `truncated` shape 131 used.
- **ATP or on-hand?** 131 and the contract both speak `atp`; `StockByDistance` reads
  `AtpQuantity` in the till path — confirm they are the same number, because an agent quoting
  on-hand where the console quotes ATP will promise stock that is already committed.
- 🚩 **The dangerous half: what the agent may DO with the answer.** Seeing that store 1204 has the
  item invites moving the order there — which is [129](129-rebind-store-door.md)'s plant rebind, with
  its atomic refusal and its whole-basket re-price. A "stock elsewhere" list with an innocent-looking
  action beside it is a re-price of every other line, mid-call. Rule explicitly whether this surface
  is **read-only** or a rebind entry point; if the latter, it rides 129's confirm path and nothing
  else.
- **Degradation.** 287's rule holds: a stock service that is down degrades, never blocks — and per
  135, *unknown* must not read as *zero*.

Deliverable: a research note with file:line evidence, the contract (if new), and the read-only /
rebind-entry ruling.

## Constraint added by [157](157-price-check.md), 2026-07-29

The owner ruled the price check into **the deliberate expansion of a search row** — one *"about this
item"* panel — and ruled 158 into **the same panel**. So this ticket no longer chooses a surface: it
inherits one, beside a VAT-inclusive engine price and the offers on that item (contract
[§3.4](assets/136-cc-contract/CONTRACT.md)).

Three things that changes, and one it deliberately does not:

- **The panel is opened, not ambient.** One deliberate expand per item, never per keystroke. Whatever
  this read costs, it is paid at most once per item the agent actually asks about — which is the
  budget the "cost and cardinality" bullet above should be measured against.
- **Availability is already on the row.** 131 folds `atp` at the **order's** plant into every search
  result server-side, so this read is strictly the *other stores* half. Don't re-specify the local
  number; contract §3.4 explicitly keeps `atp` off `PriceCheckResult` for the same reason.
- **The gate is decided.** The panel is unreachable unless a caller is attached and a store is
  chosen (`canPriceCheck` = `canAddItem`'s predicate, §2.3). A distance-ranked list needs the order's
  plant to rank *from*, so this is a prerequisite, not a coincidence.
- **Not decided, and still yours:** the 🚩 bullet above. 157 did not pre-judge whether this surface
  is read-only or a [129](129-rebind-store-door.md) rebind entry point — sharing a panel with a
  price is not an argument either way, and putting an innocent-looking action beside a stock number
  is exactly what that bullet warns about.

## Answer

**Contract v1.7, additive** — [§3.5 `stockElsewhere`](assets/136-cc-contract/CONTRACT.md#35-stockelsewhere--who-else-has-it-read-only),
read-only. Full evidence with file:line: [research note](assets/158-stock-elsewhere/RESEARCH.md).
Server work minted as BackOffice
[876](C:\Work\DMSCO\BackOffice\.issues\876-cc-stock-elsewhere-endpoint.md).

### The read is already built, and SIS.Api already holds the client

There is exactly **one** distance read in the estate — SIS.Stock's
`GET Stock/CurrentStockByDistance` (`StockInquiryService.cs:183-210`), the read the till performs
(`StockByDistanceController.cs:106-108`). ⚠ The ticket's two-way choice was not one: the OMS
`MaterialPlantStockModel` path takes **no location**, fills a different grid, and returns on-hand
rather than ATP (`:142-173`).

SIS.Api does not expose it — the route and `StockService.GetStockByDistance` are both commented out
(`StockEndpoints.cs:33-35`, `StockService.cs:299-336`) — but the typed client is **already
registered and called by nobody**: `StockV2CollectionExtensions.cs:32-33` binds the base URL and key,
and `StockV2HttpService.cs:51/:65` already carry both methods. The endpoint is two existing calls.

**Not** `Stores/Nearby` + `Stock/ItemPlant`, though both exist and compose
(`StoresEndpoints.cs:28`, `NearestStoreFinder.cs:25-97` — pure and unit-tested). That would be a
**second definition of distance** on a screen whose value is agreeing with the till
([156](156-delivery-fee-shared-rule.md)'s lesson), and fans ~1,000 plants into a stock read the till
answers in one query. `NearestStoreFinder` still earns its keep — as the source of the degradation
rule it got right and the SQL does not.

### 🚩 The dangerous coordinate is the ORIGIN, not the row

Nothing anywhere refuses `(0,0)`. With an unlocatable order plant the SQL still runs, still sorts,
and returns a **fully-populated, plausible, entirely wrong** ranking measured from the Gulf of
Guinea. The estate already refuses that exact fiction by name, one repo over —
`NearestStoreFinder.cs:65-70` and `NearestStoreService.cs:81-85` (`STORE-GEO-001`) — so the endpoint
reuses the ruling rather than inventing one: `distanceKnown: false`, every `distanceKm` null,
ordered by code and honestly unranked. A row with no coordinate is `distanceKm: null` and **stays in
the list** — the ticket's own rule, met.

The origin fetch itself is sound and was checked because getting it wrong would be invisible:
`PlantEndpoints.cs:35` binds `GetPlantDetails`, which selects `Latitude, Longitude`
(`PlantService.cs:108-112`), unlike its sibling `GetPlant` at `:87` which omits them.

### 🚩 The estate derives store coordinates twice, and warned about it in writing

SIS.Stock fills `StockPlant.Latitude/Longitude` from `StoreArea.StoreLatitude/StoreLongitude`
(`StoreAreaService.cs:24-35`). SIS.Api derives the same coordinate from the **same table's** free-text
`StoreGPS` (`StoreAreaSyncService.cs:36-39`) — because `StoreAreaGeoRow.cs:22-25` says the numeric
columns *"exist in some environments but not others, so depending on them is not portable."* The
console's whole ranking rests on the pair another team documented as environment-dependent. Not an
argument to re-rank (above), but a **deployment obligation** on 876: verify by query before the
console quotes a distance. If they are unpopulated that is a data fix — the till depends on them
today.

### ATP or on-hand: one definition, proven — and only one number ships

`AtpQuantity = UnrestrictedPos − active orders (11 days)` is computed **identically** by the distance
read (`StockInquiryService.cs:42/47`) and by the read [131](131-item-search-endpoint.md) already
folded in as the search row's `atp` (`:73/78`) — same table, same `StorageLocation = '0001'`, same
window. Same number. 🚩 But the till's grid shows on-hand **and** ATP in adjacent columns
(`StockByDistanceController.cs:64-77`); the console ships only ATP, because two availability numbers
read down a phone is how the larger one gets promised. Rows with `atp <= 0` and the order's own plant
are dropped server-side, capped at 10 with `withStock` + `truncated` ([131](131-item-search-endpoint.md)'s
shape) — the upstream `TOP (200)` is a mouse-grid cap, not a phone-call one.

### 🚩 Read-only. Ruled, on the till's own precedent

The panel carries no control that moves the order. Three grounds:

1. **The WPF precedent is a referral, not a move.** The only action beside that grid is
   `SendLocation` (`StockByDistanceController.cs:317-376`) — SMS the customer a map link, guarded on
   `AtpQuantity <= 0` and on the row not being your own store. In eight years nobody built a move.
2. **Scope mismatch.** This panel's object is one **item**; a rebind's object is the whole **order** —
   [129](129-rebind-store-door.md)'s door re-prices every line with `"C"`
   `NewPricingAndKeepManual`, re-freezes every ATP and refuses atomically. An action with that blast
   radius cannot live inside a per-item disclosure; [135](135-agent-console-prototype.md) ruled both
   `pendingConfirmation` kinds modal for the weaker version of this argument.
3. **It invalidates its own list.** The ranking's origin *is* the order's plant.

The store still moves through `setStore` and §5.1's confirm, and the panel may name that path in
words. The SMS referral is **not** carried into phase 1 — a new outbound-messaging power aimed at a
customer's phone, with its own consent design, and nothing about a CLCN cash order needs it.

### Cost, and why it is a separate call from the price check

One Dapper query, `TOP (200)`, `commandTimeout: 120`, plus one active-orders query over those plants
on a different connection (`PosRepository.cs:39-57`). The distance is computed per row and sorted on
— **non-indexable by construction**, the same shape of unmeasured cost 131 left open on its
`LIKE '%…%'`. Paid at most once per item the agent deliberately expands.

It is the **only read on the contract that is a remote HTTP hop out of SIS.Api**, so it is its own
call rather than a field on `PriceCheckResult`: 157's price is a lock-free in-process engine run, and
a stock outage must not cost the agent the price they asked for. Both render in one panel and fail
independently. Degradation copies `CallCenterAtpAnnotator` exactly (`CallCenterAtpSource.cs:67-178`)
— race a timeout, never throw, never a non-200, `available: false` meaning *unknown*, which
[135](135-agent-console-prototype.md) renders differently from *zero* — with **its own ~3 s constant**,
since the annotator's 1,500 ms is argued from "the agent is typing while a customer waits" and an
expand is a question already asked out loud.

### Recorded so nobody ports it

The till's "Central Pharmacies" button filters the grid on `[IsCentral]`
(`StockByDistanceController.cs:307-313`), a field the bound model does not have
(`CurrentStockByDistanceModel.cs:9-24`) and the SQL never selects. The console carries no such
filter.

🚩 **The pattern worth keeping**: the ticket asked which of two reads was authoritative, and the
answer was that only one of them was a distance read at all — the other was a different grid's
on-hand fill. Reading what each candidate *actually returns* before comparing them is what turned
the question into a five-minute answer and left the session's time for the defect underneath it.
