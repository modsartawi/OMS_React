---
type: wayfinder-ticket
wayfinder: research
map: 126
status: open
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
