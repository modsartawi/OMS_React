# BbyModel detail-shape field inventory

> Research asset for [ticket 055](055-bbymodel-detail-shape-research.md) (map [053 — BBY Inquiry](053-bby-inquiry-map.md)).
> Complete field inventory of the `BbyModel` object graph that the SAP "Display Bonus Buy" detail view
> renders, so the detail-endpoint contract (ticket 058) and detail-modal prototype (ticket 060) can be
> specified from data. **Read-only source study — no BackOffice code changed.**

## Sources read (`C:\Work\DMSCO\BackOffice`)

- `Sartawi.POS\BB\PotentialBonusBuys\BonusBuyDetailController.cs` — the WPF detail view + row VMs.
- `Pricing\Pricing.Core\Repo\Bby\Models\{BbyModel,BbyCondModel,BbyPrereqModel,BbyCond000Model}.cs`.
- `Pricing\Pricing.Core\Repo\Bby\Constants\Bby{DiscountType,ScaleType,ConditionType,MatGroupingStatus,PrerequisiteType,CondTargetType}Constants.cs`.
- `Sartawi.Retail.Data\Modules\Logistics\Pricing\Bby\Data\BbyHeader.cs` — flat header entity, for the "BbyModel-only" delta.
- `Pricing\SIS.Pricing.Services\Repositories\SqlServerBonusBuyRepository.cs`, `...\Caching\CachedBonusBuyRepository.cs` — `GetBonusBuyByNumber`.

The `LiveStatus` live-basket join is **explicitly excluded** per ticket scope; noted inline only where it explains why a row field exists.

---

## The graph at a glance

```
BbyModel  (header scalars ─ all also on BbyHeader, except computed StackableOrder)
 ├─ Prereqs        : List<BbyPrereqModel>          → Buy grid  (+ grouping-member popups)
 ├─ Conditions     : Dictionary<string,BbyCondModel>  keyed by CondNumber → Get grid / total-discount card
 └─ ItemConditions : List<BbyCond000Model>         → per-material expansion; resolves Get-row materials + Get grouping members
```

`GetBonusBuyByNumber` returns this whole tree **populated** (Prereqs, Conditions, ItemConditions all loaded). What the WPF controller adds on top is purely in-memory: grouping-member maps, the `BbyCond000Model→BbyCondModel` join, and material-description lookup. No `Description` field exists anywhere in the model graph — enrichment is layered by the controller.

---

## Header fields

`BbyModel` header scalars (`BbyModel.cs:9-50`), each with its WPF display mapping (`BonusBuyDetailController.cs:46-121`). All are **also on `BbyHeader`** (so a flat list endpoint already covers them) *except* the computed `StackableOrder`.

| Field | Type | Format / codes | Display note |
|---|---|---|---|
| BbyNumber | string | — | Title |
| Description | string | server text | header label |
| BbyProfile | string | — | |
| ValidFrom / ValidTo | string | `yyyyMMdd` | `FormatSapDate` (`:473`) |
| ValidFromTime / ValidToTime | string | `HHMMSS` | `FormatSapTime` (`:487`) |
| PromoNumber | string | — | |
| LinkCategoryBuy / LinkCategoryGet | string | `A`=And / `O`=Or | `MapLinkCategory` (`:439`) |
| BbyStatus | string | `A`ctivated / `I`nactive / `D`raft / `X`Deleted | `MapStatus` (`:461`) |
| OfferId | string | — | |
| LimitNumber | int | — | |
| MinValue | decimal | — | also reused as total-discount requirement (`:121`) |
| MaxValue | decimal | — | |
| CondTargetType | string | `R`=Document / `P` / `M` / `G` | drives `IsTotalDiscountMode` (`:88`), `MapCondTarget` (`:449`) |
| Score | int | — | |
| OriginFilter | string | — | |
| PriceListType | string | — | |
| Includes / Excludes | string | — | |
| IsStackable | bool | — | also feeds server-side `ConditionType` derivation (see Get grid) |
| AllowNestedStacking | bool | — | |
| StackingExcludes | string | — | |
| LoyGroups / LoyTiers | string | — | loyalty scoping |
| **StackableOrder** | int (computed `IsStackable ? 1 : 0`) | — | **BbyModel-only**, not persisted; not surfaced by the view either |

**Shown by the view but NOT from `BbyModel`/`BbyHeader`** — sourced from the caller-supplied pricing-context `PcHeader Header` (`:42,79-81`): `SalesOrganization`, `DistributionChannel`, `Plant`, `DocumentCurrency`/`Currency`. See Org fields.

---

## Org fields

Not part of `BbyModel` or `BbyHeader`. In WPF they come from the caller's `PcHeader Header` (pricing-context header, unrelated to `BbyHeader`): `SalesOrganization`, `DistributionChannel`, `Plant`, `DocumentCurrency` (`:79-81`).

Org/channel data *does* physically live on the condition tables (`BbyCond201`/`BbyCond202` carry `SalesOrganization`/`DistributionChannel` — `SqlServerBonusBuyRepository.cs:294-295,309-310`) but is **not projected** into the `BbyModel` graph the detail view consumes.

**Contract implication (→ ticket 058):** a detail-by-number endpoint returning `BbyModel` alone **cannot** supply Org fields. Either (a) the detail endpoint additionally projects Sales-Org / Dist-Channel / Plant off the condition rows, or (b) the modal carries them over from the list row's context, or (c) they're dropped from the inquiry modal. Decide in 058; flag currency handling too (see total-discount branch).

---

## Buy grid (prereqs)

`BonusBuyDetailBuyRow` (`:500-515`) built by `BuildBuyRow` (`:312-345`) from each `BbyPrereqModel` in `Model.Prereqs`.

`BbyPrereqModel` (`BbyPrereqModel.cs`): `BbyNumber`, `PrereqNumber`, `MatItemPos`, `PrereqType`, `MatGrouping`, `MaterialNumber`, `Qty`, `Uom`, `NumberAsTotal`, `DiscountType`, `MinValue`, `MatGroupingStatus`.

| Row property | Type | Source | Note |
|---|---|---|---|
| LineItemPos | string | `MatItemPos` | |
| LineItemType | string | `PrereqType` → `MapPrereqType` | "Material" / "Material grouping" (`:412`) |
| LineItemIdentifier | string | `MatGrouping` (grouping) else `MaterialNumber` | |
| Description | string | **client-side** `IMaterialInfoRepository` by `MaterialNumber`; null for grouping | enrichment (see below) |
| Quantity | decimal | `Qty` | |
| QuantityUnit | string | `Uom` | |
| MinValue | decimal | `MinValue` | |
| IsGrouping | bool | derived: `MatGrouping` non-empty AND `PrereqType == MGP` | |
| MemberCount | int | count of `_groupMembers[MatGrouping]` | opens member popup |
| FoundQty / IsMet / LiveProgress / HasLive | — | `LiveStatus` | **out of scope** (live basket) |

**Not surfaced:** `BbyNumber` (redundant), `NumberAsTotal`, `DiscountType`, `PrereqNumber` (join key only), `MatGroupingStatus` (routing only).

**Row visibility filter** (`BuildRows`, `:251-265`): prereq rows with `PrereqType == MaterialGrouping` AND a non-empty `MaterialNumber` are **skipped from the main grid** — these are the status-`2` generated members, parked into the grouping-member popup instead.

### MatGrouping / MatGroupingStatus codes
- `BbyPrerequisiteTypeConstants`: `MGP`=MaterialGrouping, `MAT`=Material.
- `BbyMatGroupingStatusConstants`: `1`=ExistingMaterialGrouping, `2`=GeneratedOutOfMaterialGrouping, `3`=CreatedManually.
- `_groupMembers` (`:207-225`): `Model.Prereqs` grouped by `MatGrouping` (only rows with both `MatGrouping` + `MaterialNumber`, i.e. status `2`), deduped by `MaterialNumber`.

---

## Get grid (conditions)

`BonusBuyDetailGetRow` (`:517-533`) built by `BuildGetRow` (`:347-381`) from each `BbyCondModel` in `Model.Conditions.Values`. **Suppressed entirely when `CondTargetType == Document`** (`:183-186`) — see total-discount branch.

`BbyCondModel` (`BbyCondModel.cs`): `CondNumber`, `PromoNumber`, `BbyNumber`, `DiscountType`, `CondValue`, `CondValueP`, `CondValuePOriginal`, `MatGrouping`, `PricingUnit`, `PricingUnitUom`, `Qty`, `Uom`, `ScaleType`, `NumberAsTotal`, `CondReference`, `MatGroupingStatus`, `ConditionType`.

| Row property | Type | Source | Note |
|---|---|---|---|
| CondNumber | string | `CondNumber` | |
| LineItemType | string | derived from `MatGrouping` non-empty | "Material" / "Material grouping" |
| LineItemIdentifier | string | `MatGrouping` else joined `BbyCond000Model.MaterialNumber` | |
| Description | string | **client-side** material lookup via the joined `BbyCond000Model` (ItemConditions) | |
| ScaleType | string | `ScaleType` → `MapScaleType` | `A`=From / `B`=UpTo / `C`=Equal (`:428`) |
| Quantity | decimal | `Qty` | |
| QuantityUnit | string | `Uom` | |
| DiscountTypeLabel | string | `DiscountType` → `MapDiscountType` | `P`=Price / `R`=Fixed / `%`=Percentage / `N`=FreeGoods (`:400`) |
| ValueDisplay | string | `FormatDiscountValue`: `CondValueP` if `%` else `CondValue` | (`:383`) |
| PricingUnit | decimal | `PricingUnit` | |
| PricingUnitUom | string | `PricingUnitUom` | |
| ConditionType | string | `ConditionType` (raw SAP code) | server-computed — see below |
| IsGrouping | bool | derived: `MatGrouping` non-empty | |
| MemberCount | int | count of `_getGroupMembers[CondNumber]` | |

**Not surfaced:** `PromoNumber`, `BbyNumber`, `CondValuePOriginal`, `NumberAsTotal`, `CondReference` (used only in the description-lookup pass), `MatGroupingStatus`.

### DiscountType / ScaleType / ConditionType codes
- `BbyDiscountTypeConstants`: `P`=Price, `R`=FixedDiscount, `%`=PercentageDiscount, `N`=FreeGoodsDiscount.
- `BbyScaleTypeConstants`: `A`=From, `B`=UpTo, `C`=Equal.
- `BbyConditionTypeConstants`: `ZB01`=Price, `ZB02`=FixedDiscount, `ZB12`=FixedDiscountStack, `ZB03`=PercentageDiscount, `ZB13`=PercentageDiscountStack.
- `ConditionType` is **server-computed** in the repo (`SqlServerBonusBuyRepository.cs:222-230`) by switching on `DiscountType` + `IsStackable` — it is not stored. ⚠️ **No case for `N` (FreeGoods)** — the switch throws `ArgumentException` for it (see Backend defects).

---

## Document total-discount branch

Gated by `IsTotalDiscountMode => CondTargetType == "R"` (Document) (`:88-89`). When true the Get grid is replaced by a single header-level discount card:

| View property | Source |
|---|---|
| (Get grid) | forced empty (`:183-186`) |
| TotalDiscountCond | `Conditions.Values.FirstOrDefault()` — the first/only condition (`:91`) |
| TotalDiscountTypeLabel | `MapDiscountType(TotalDiscountCond.DiscountType)` |
| TotalDiscountConditionType | raw `TotalDiscountCond.ConditionType` |
| TotalDiscountValueDisplay | `CondValueP:N2` if `%` else `CondValue:N2` (`:97`) |
| TotalDiscountCurrencyIndicator | `%` if percentage else `CurrencyLabel` (`:109`) |
| TotalDiscountRequirement | **header** `MinValue` (`:121`) — not a condition field |

**Contract implication:** the detail response must expose `CondTargetType` so the client can switch layouts, plus header `MinValue`, and the single condition's `DiscountType`/`CondValue`/`CondValueP`/`ConditionType`. Currency is not on `BbyModel` (comes from `PcHeader`) — decide currency sourcing in 058.

---

## Grouping members

`BonusBuyGroupMemberRow` (`:535-541`): `MaterialNumber` (string), `Description` (string), `Quantity` (decimal), `QuantityUnit` (string). Two maps feed it:

- **Buy-side** `_groupMembers` (`:207-225`): keyed by `BbyPrereqModel.MatGrouping`; `Qty`/`Uom` from the prereq.
- **Get-side** `_getGroupMembers` (`:231-249`): keyed by `BbyCond000Model.CondNumber`; `Quantity` = `ic.Condition?.Qty` (falls through to the nested `BbyCondModel`), `QuantityUnit` = `ic.Uom ?? ic.Condition?.Uom`.

`BbyCond000Model` (`BbyCond000Model.cs:9-16`): `BbyNumber`, `BbyDiscountType`, `MaterialNumber`, `Uom`, `ValidFrom` (DateTime), `ValidTo` (DateTime), `CondNumber`, `Condition` (nested `BbyCondModel`). ⚠️ **`Condition` is set by the controller, NOT the repository** (`:350` does `ItemConditions.FirstOrDefault(p => p.CondNumber == c.CondNumber)`). Off `GetBonusBuyByNumber` it is **null** — a backend endpoint that wants this link must replicate the join itself.

---

## Repository: `GetBonusBuyByNumber`

- Interface: `IBonusBuyRepository.GetBonusBuyByNumber(string bbyNumber) : Task<BbyModel>`.
- `SqlServerBonusBuyRepository` (`:44-50`) → `LoadBbyModel` (`:125-258`), all **Dapper** over `IDbConnection` into private row DTOs (no NHibernate/EF entities returned).
- `CachedBonusBuyRepository` (`:61-68`) wraps it in FusionCache `GetOrSetAsync<BbyModel>` keyed by `PricingCacheKeys.BonusBuy(bbyNumber)`, TTL `CacheDurationConstants.BonusBuyMinutes`. (Ties into the existing sim clear-cache work — cache is already keyed per-BBY.)

**Loading behavior:** header from `BbyHeader` (returns `null` if not found, `:130`); `Prereqs` from `BbyPrereq` ordered by `PrereqNumber, MatItemPos`; `Conditions` dictionary from `BbyCond` with server-side `ConditionType` derivation; `ItemConditions` from `BbyCond201`(+`BbyCond202`). **All child collections are populated** — the WPF controller issues no further SQL.

**Serialization verdict — serializes cleanly to JSON as-is:**
- Plain POCO tree; row DTOs mapped into plain models. No lazy proxies, no NHibernate/EF entities, no cycles in what the repo returns.
- `BbyCond000Model.Condition` is `null` off the repo (no self-reference risk); if the endpoint wants the resolved link it must do the `CondNumber` join server-side.
- `Conditions` is a `Dictionary<string,BbyCondModel>` → serializes as a JSON object keyed by `CondNumber`. **Recommendation:** the wire contract should flatten it to a `BbyCondModel[]` (each already carries `CondNumber`) for a simpler TS consumer — decide in 058.

### ⚠️ Backend defects to flag for the endpoint build (ticket 058)
1. **`BbyCond202` never actually loaded** — `LoadBbyModel` (`:140-141`) queries `SELECT * FROM BbyCond201` a second time into the `cond202s` variable (copy-paste bug); real `BbyCond202` rows are never read. Both appended to `ItemConditions`. Confirm whether the new endpoint needs BbyCond202 and fix at the source.
2. **Free-goods BBYs throw** — `ConditionType` derivation (`:222-230`) has no case for `DiscountType == "N"` (FreeGoods), so `GetBonusBuyByNumber` throws `ArgumentException("Invalid BbyDiscountType")` for any free-goods BBY, even though `BbyDiscountTypeConstants.FreeGoodsDiscount` exists. The detail endpoint must handle/fix this or such BBYs will 500.

Both are pre-existing BackOffice defects, not introduced here — recorded so ticket 058 designs around them.

---

## Material description enrichment — needed server-side? **Yes (recommended).**

Description is **not a field on any model** (`BbyPrereqModel`, `BbyCondModel`, `BbyCond000Model` have no `Description`). WPF enriches **client-side**: `LookupDescriptions` (`:281-304`) opens its own DI scope, resolves `IMaterialInfoRepository`, and calls `GetItemInfoAsync(mat)` per material, batched once over the union of all Buy/Get/ItemCondition material numbers (`:192-199`); lookup failures are swallowed so the BBY still renders.

The SPA has no `IMaterialInfoRepository` equivalent. **Verdict:** fold enrichment into the new detail endpoint server-side — batch the same material-number union through `IMaterialInfoRepository` and attach `description` inline to each Buy/Get/member DTO in the JSON response. This matches the current batch-once behavior and avoids N client round-trips. Ticket 058 should specify the enriched DTO shape (each row DTO gets a `description` field). Alternative (a separate bulk material-lookup endpoint the SPA calls after) is possible but adds a round trip.

---

## BbyModel-only fields summary (why a detail endpoint exists)

Every header scalar above is already on `BbyHeader` — a flat list/header endpoint (ticket 057) covers them. The **only** reason a detail endpoint is needed is the three child collections, which `BbyHeader` lacks entirely (it exposes just a raw NHibernate `ISet<BbyPrereq>`, not the DTO shape):

- **`Prereqs` (Buy grid):** PrereqNumber, MatItemPos, PrereqType, MatGrouping, MaterialNumber, Qty, Uom, NumberAsTotal, DiscountType, MinValue, MatGroupingStatus.
- **`Conditions` (Get grid + total-discount):** CondNumber, DiscountType, CondValue, CondValueP, MatGrouping, PricingUnit, PricingUnitUom, Qty, Uom, ScaleType, CondReference, MatGroupingStatus, ConditionType (+ PromoNumber, CondValuePOriginal, NumberAsTotal available if wanted).
- **`ItemConditions` (per-material expansion):** MaterialNumber, BbyDiscountType, Uom, per-material ValidFrom/ValidTo, CondNumber — needed to resolve Get-row materials + Get grouping members.
- Plus, **not on `BbyModel` at all** but shown by the detail view: Org fields (SalesOrg / DistChannel / Plant / Currency) from `PcHeader`, and `description` from `IMaterialInfoRepository` — both must be sourced/enriched by the endpoint deliberately.
