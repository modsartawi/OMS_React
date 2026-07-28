# Stock for an item in other stores — what exists, and what it costs

Research note for [158](../../158-stock-in-other-stores.md), map [126](../../126-web-call-center.md).
Every claim below carries file:line evidence. Three repositories are in play:

| Repo | Role here |
|---|---|
| `C:\Work\DMSCO\BackOffice` | the WPF till (`Sartawi.POS`), SIS.Api, and the shared data layer |
| `C:\Work\DMSCO\SIS.Stock` | **the stock microservice itself** — where the distance query actually lives |
| `C:\Playground\oms-react` | the console |

---

## 1. The till path, end to end

`ItemInfoLookupController.cs:333-347` opens `StockByDistanceController`. Its `RefreshList`
(`StockByDistanceController.cs:95-140`) is three calls:

```csharp
var stockStore = POSCommon.StockStore;                                    // :106
var myPlant    = StockV2Service.GetPlant(stockStore);                     // :107
var models     = StockV2Service.GetCurrentStockByDistance(
                     Item.ItemNumber, myPlant.Latitude, myPlant.Longitude); // :108
```

Both go to the **StockV2 microservice**, not SIS.Api — `StockV2Service.cs:12-20` hard-codes
`http://172.23.27.56:4321/` with its own api key at `:33`. The routes are
`Plants/{plant}` and `Stock/CurrentStockByDistance?materialNumber=&latitude=&longitude=`
(`StockHttpService.cs:56`, `:68`).

The grid (`StockByDistanceController.cs:32-81`) shows Plant · Distance · City · Area · Address ·
**Stock** (`UnrestrictedPos`) · Order Qty (`OmsQuantity`) · **ATP** (`AtpQuantity`).

### The one action on that grid is a referral, not a move

`SendLocation` (`:317-376`) is the only command beside a row. It refuses your own store and refuses
a row with no ATP —

```csharp
if (SelectedRow == null || SelectedRow.Plant == POSCommon.Store.StoreCode) throw …"Select pharmacy first";
if (SelectedRow.AtpQuantity <= 0)                                          throw …"No Stock";   // :324-327
```

— then SMSes the customer a map link to that pharmacy (`:356-373`). **Nothing on this screen moves
an order.** That is the strongest available evidence for §6 below.

### One dead control, recorded so nobody ports it

`:307-313` sets the grid filter to `"[IsCentral] = True"`. The bound model
(`CurrentStockByDistanceModel.cs:9-24`) has no `IsCentral` property, and neither does the SQL that
fills it (§3). The "Central Pharmacies" button filters on a column that does not exist.

---

## 2. Which of the two reads is authoritative

The ticket offered a choice: `StockV2Service` direct, or the OMS `MaterialPlantStockModel` HTTP
path. **They are not two ways to do this.** `MaterialPlantStockModel` is
`FillStockPreOrder`'s read (`StockByDistanceController.cs:142-173`) — it takes **no location**,
fills a *different* grid, and reads `line.UnrestrictedQuantity` (`:165`), i.e. on-hand, not ATP.
There is exactly one distance read in the estate, and it is `Stock/CurrentStockByDistance`.

**SIS.Api does not expose it today.** `StockEndpoints.cs:33-35` has the route commented out and
`StockService.cs:299-336` has `GetStockByDistance` commented out with it. But the *client* is
already registered and wired: `StockV2CollectionExtensions.cs:32-33` binds `StockV2:BaseUrl` +
`StockV2:ApiKey`, and `StockV2HttpService.cs:51` and `:65` already carry
`GetCurrentStockByDistance` and `GetPlant`. **Nothing in SIS.Api calls either one yet.** So the
server work is an endpoint over two typed methods that already exist — no new HTTP client, no new
credential, no new deployment dependency.

### The alternative SIS.Api could compose, and why not

SIS.Api has its own geo stack and it is better engineered: `NearestStoreService.RankByDistanceAsync`
(`NearestStoreService.cs:26-31`) over the pure, unit-tested `NearestStoreFinder`
(`NearestStoreFinder.cs:25-97`), already exposed as `POST Stores/Nearby`
(`StoresEndpoints.cs:28-30`). Composing `Stores/Nearby` + `Stock/ItemPlant` would answer the same
question **in SIS.Api's own database**.

Ruled against, for the reason [156](../../156-delivery-fee-shared-rule.md) taught: it would be a
**second definition of distance** on a screen whose whole value is agreeing with the till, and it
fans a ~1,000-plant list into a stock read that the till answers in one query. The console takes the
till's read. `NearestStoreFinder` still earns its keep here — as the source of the degradation rule
(§4), which it got right and the SQL does not.

---

## 3. What the query actually is

`StockInquiryService.cs:183-210`, in the SIS.Stock repo:

```sql
SELECT TOP (200) stock.Plant, s.City, s.AreaName, s.Address, stock.Unrestricted, stock.UnrestrictedPos,
       s.Latitude AS StoreLatitude, s.Longitude AS StoreLongitude,
       6371 * acos( CASE …clamped to [-1,1]… ) AS DistanceKm
FROM [dbo].[StockAccumulated] stock
INNER JOIN [dbo].[StockPlant] s ON s.Plant = stock.Plant
WHERE stock.MaterialNumber = @MaterialNumber AND stock.StorageLocation = '0001'
  AND s.IsClosed = 0
ORDER BY DistanceKm
```

Then a second query on a **different connection** annotates ATP: `GetActiveOrders` over the
returned plants with an 11-day window (`StockInquiryService.cs:32-49`, `PosRepository.cs:39-57`).

**Cost and cardinality.** One Dapper call with `commandTimeout: 120`
(`StockInquiryService.cs:23`), bounded at 200 rows, plus one active-orders query over up to those
200 plants (`PosRepository.cs:55`, also 120 s). The distance is computed per row and sorted on —
**non-indexable by construction**, exactly the shape of unmeasured cost
[131](../../131-item-search-endpoint.md) left open on its `LIKE '%…%'`. Nobody has measured either.

`ToDictionary(c => c.Plant)` at `:35` is safe despite the `UNION ALL`: the active-orders SQL has an
outer `GROUP BY StoreCode, ItemNumber` (`PosRepository.cs:96-97`) and one material is asked for, so
the plant key is unique.

---

## 4. ATP or on-hand — one definition, proven

`StockInquiryService.cs:42` / `:47`:

```csharp
distanceModel.AtpQuantity = distanceModel.UnrestrictedPos - omsOrder.OrderQuantity;   // else UnrestrictedPos
```

`:73` / `:78` computes it **identically** for `GetCurrentStock` — the read
[131](../../131-item-search-endpoint.md) folded in as the search row's `atp`
(`StockService.cs:31-41` maps `UnrestrictedQty = c.AtpQuantity`, and
`CallCenterAtpSource.cs:23-33` documents that chain as "no second definition of available"). Same
`StockAccumulated`, same `StorageLocation = '0001'`, same 11-day window
(`StockInquiryService.cs:32` vs `:57`).

**They are the same number.** But the till's grid shows *both* `UnrestrictedPos` ("Stock") and
`AtpQuantity` ("ATP") in adjacent columns (`StockByDistanceController.cs:64-77`), and the till's own
guard uses ATP (`:326`). Two availability numbers on a phone call is how an agent promises the
larger one.

---

## 5. Where the coordinates come from — and the two-source finding

### The row side

`StockPlant` is seeded from HANA with **no geo at all** (`SyncPlantsService.cs:29-30` inserts
`Plant, PlantCategory, Country, CreatedAt`). Geo arrives later from POS, by way of a full mirror
rebuild (`StoreAreaService.cs:15-35`): delete `StoreArea`, re-insert it from
`PosRepository.GetStoreAreas`, then

```sql
UPDATE StockPlant SET IsClosed = …, Latitude = StoreArea.StoreLatitude,
                      Longitude = StoreArea.StoreLongitude, City = …, AreaName = …, Address = …
FROM StockPlant INNER JOIN StoreArea ON StockPlant.Plant = StoreArea.StoreCode
```

and the source columns are `StoreLatitude, StoreLongitude` (`PosRepository.cs:102-106`).

### 🚩 SIS.Api derives the same coordinate from a *different column of the same table*

`StoreAreaSyncService.cs:36-39` reads `StoreGPS` — free text — and parses it
(`:96`, `StoreGpsParser`). Its read-model says why, in as many words
(`StoreAreaGeoRow.cs:22-25`):

> *"We rely solely on StoreGPS, not on any StoreLatitude/StoreLongitude columns: **those exist in
> some environments but not others**, so depending on them is not portable."*

So the estate has two coordinate derivations from one table — and SIS.Stock's whole ranking rests on
the pair another team documented as environment-dependent. That is not an argument to re-rank in
SIS.Api (§2), but it is a **deployment obligation**: verify those columns are populated in the
environment SIS.Stock reads before the console quotes a distance from them.

### 🚩 The dangerous coordinate is the ORIGIN, not the row

The origin lat/long is fetched separately, per call (`StockByDistanceController.cs:107`). That path
is sound — `PlantEndpoints.cs:35` binds `GetPlantDetails`, which *does* select `Latitude, Longitude`
(`PlantService.cs:108-112`), unlike the sibling `GetPlant` at `:87` which omits them. Checked
because getting it wrong would have been invisible.

What is missing is any refusal. **Nothing validates the origin.** With an origin of `(0, 0)` the SQL
still runs, still sorts, and returns a fully-populated, plausible, entirely wrong ranking measured
from the Gulf of Guinea. The estate already refuses exactly this, by name, one repo over:

- `NearestStoreFinder.cs:65-70` — *"(0,0) is an unsynced / unlocatable store, not a real point off
  the Gulf of Guinea — skip it silently so it can never win nearest."*
- `NearestStoreService.cs:81-85` — a `(0,0)` **query point** is `STORE-GEO-001`, an HTTP 400.

The ruling already exists in this estate. The endpoint reuses it rather than inventing one.

Row side degrades more gently: `s.IsClosed = 0` drops closed stores, and a `(0,0)` row lands ~4,900
km away and sorts last — *far*, not *absent*. The ticket's rule ("a missing coordinate must degrade
to distance unknown, never an omitted store") is met by mapping both cases to `distanceKm: null`.

---

## 6. The dangerous half: read-only, ruled

**Read-only. The panel carries no control that moves the order.** Three grounds:

1. **The WPF precedent is a referral, not a move** (§1). The till's answer to *"someone else has
   it"* is to send the customer there. In eight years nobody built a move.
2. **Scope mismatch.** This panel's object is **one item**; a rebind's object is the **whole
   order** — [129](../../129-rebind-store-door.md)'s door re-prices every line with `"C"`
   `NewPricingAndKeepManual`, re-freezes every line's ATP, and refuses atomically naming a line that
   no longer prices. An action with that blast radius cannot live inside a per-item disclosure.
   [135](../../135-agent-console-prototype.md) already ruled both `pendingConfirmation` kinds modal
   for the weaker version of this argument.
3. **It invalidates its own list.** The ranking's origin *is* the order's plant. A one-click rebind
   from the list changes the thing the list was measured from.

The store still moves the way it already moves — the store control, `setStore`, and 129's
preview/confirm. The panel may *name* that path in words; it carries no control to it.

The SMS referral is **not** carried into phase 1: it is a new outbound-messaging power aimed at a
customer's phone, with its own consent and abuse design, and nothing about a CLCN cash order
requires it.

---

## 7. What this costs the console

A fourth independent latency surface on one screen, after the resume-per-request mutations, 131's
non-sargable search, and 157's per-expand pricing run. It is the only one of the four that is a
**remote HTTP hop out of SIS.Api**, and the only one whose failure is somebody else's outage. It is
paid at most once per item the agent deliberately expands.

`CallCenterAtpAnnotator` (`CallCenterAtpSource.cs:67-178`) is the precedent to copy exactly: race a
timeout, never throw, log once, and answer `null` — *unknown*, which
[135](../../135-agent-console-prototype.md) renders differently from *zero*. Its own 1,500 ms
(`:77`) is argued from "the agent is typing while a customer waits" and does not transfer to a
deliberate expand; this read gets its own, longer constant.
