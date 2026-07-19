# Promo-shape taxonomy & response-field mapping

Asset for ticket [040](040-sim-promo-shape-taxonomy.md) (map [039](039-sim-promo-visibility-rework.md)).
The vocabulary the sketch ([041](041-sim-results-promo-sketch.md)) speaks. Ground truth: `SIS.Pricing.Core`
v26.4.34 (`C:\Work\Pricing\SIS.Pricing\src\`; identical BackOffice mirror under
`C:\Work\DMSCO\BackOffice\Pricing\`).

## The one shape

Every promotion ("bonus buy" / **BBY**) is one structure, not a family of types:

> **Prerequisite ("buy X")  →  Reward ("get Y", which carries a discount type).**

- The **"kind"** a user perceives (1+1 free, 50%-off-2nd, …) is just **which discount type rides the
  reward**. There are exactly four.
- The **buy** and the **get** can be **different products**, and either side can be a **material
  grouping** (a category), not a single SKU. So a promo relates one-or-more buy lines to one-or-more
  get lines — potentially a many-to-many across distinct basket rows.

## The four discount types (the "kind")

`BbyDiscountTypeConstants` (clean code) ↔ `BbyConditionTypeConstants` / `VKA0` (SAP code) ↔ label
(`BonusBuyDetailController.MapDiscountType`):

| Clean code | SAP condition type | Human label | User's example |
|---|---|---|---|
| `N` | `VKA0` (free-goods / price-cut) | **Free Goods** | buy 1 get 1 free |
| `%` | `ZB03` / `ZB13` (stack) | **Discount Percent** | 50% off the 2nd piece |
| `R` | `ZB02` / `ZB12` (stack) | **Fixed Discount** | 5 SAR off |
| `P` | `ZB01` | **Set Price** | bundle/combo fixed price |

Value formatting (`FormatDiscountValue`): `%` → `"{value} %"` (from `CondValueP`); `R`/`P`/`N` →
money (`CondValue`).

## Buy vs get — how the response marks the role

The role and the buy↔get link **already exist, fully computed, on the engine's `PcCondition` rows**
(stamped in `BbyProcess`), but are **dropped by `SimulationResultBuilder`** today:

| Field on `PcCondition` | Meaning | On applied result today? |
|---|---|---|
| `IsPrerequisite` | this row is a **buy** line | **dropped** |
| `IsCondition` | this row is a **get / reward** line | **dropped** |
| `ConditionKey` | **per-fired-application key** — identical on every buy+get row of one promo instance → the buy↔get join | **dropped** |
| `BbyNumber` | which promotion | kept (group key) |
| `ConditionItemNumber` | which basket line | kept (flattened into `AffectedItemNumbers`) |
| `ConditionType`, `ConditionValue` | SAP kind code + amount | kept |

Nuance: a **buy-line-item / Set-Price** promo lands the discount on the prerequisite line itself, so
one row can be **both** `IsPrerequisite` and `IsCondition` (the buy line *is* the discounted line);
`ConditionKey` still makes the grouping unambiguous.

## Applied vs Potential asymmetry (the load-bearing fact)

- **Potential (didn't-fire)** promos are already **rich** in the response: `Discount.{DiscountType
  (P/R/%/N), Value, ConditionType (ZBxx)}`, `LinkCategoryBuy/Get` (AND/OR), `CondTargetType`
  (Document/Material/MaterialGrouping/AllPrerequisites), and `Prerequisites[]` (`PrereqStatus`:
  material vs `matGrouping`, requiredQty vs foundQty, minValue vs foundValue, `isMet`). This powers
  the **"why did it NOT fire"** view directly.
- **Applied (fired)** promos are **flattened**: `AppliedBonusBuy` = one row per `BbyNumber` with a
  summed `totalDiscountValue`, a `discountType` that is the raw **SAP** code (ZBxx/VKA0, *not* the
  clean P/R/%/N), and a flat `affectedItemNumbers` with **no buy/get split**.

## Decision — the target applied contract the sketch assumes (map 039)

Ticket resolution chose **"assume a backend enhancement"**, now confirmed to be a **pure projection
pass-through** (no new computation):

1. Add `isPrerequisite`, `isCondition`, `conditionKey` (optionally `bbyItemIndex`) to
   `SimulationResultCondition` — copy them in `MapCondition`.
2. In `BuildAppliedBonusBuys`, group BBY rows by `conditionKey` and split each application into
   **prerequisite (buy)** vs **reward (get)** item lists instead of a flat `affectedItemNumbers`.
3. Normalise applied `discountType` to the clean P/R/%/N code (or carry both) so the four-kind label
   map applies uniformly to applied and potential.

The sketch draws an **exact** buy→get relationship against this shape; the projection itself is a
later build concern (not this design-only map).

## Per-line promo indicator vocabulary (for the results grid)

Minimal token set the grid can show per line, derivable once the projection lands:

- **role**: `buy` (prerequisite) / `get` (reward) / `buy+get` (self-discounted prereq).
- **kind**: Free Goods / % off / Fixed off / Set Price (the four above).
- **promo identity**: `promoNumber` / `offerId` / `description` (already present).
- **link**: `conditionKey` groups the lines of one fired application → the connector the sketch draws.
- **amount**: per-line `conditionValue` (get side); promo total `totalDiscountValue`.

## Source references

- Discount/condition codes: `SIS.Pricing.Core\Repo\Bby\Constants\Bby*Constants.cs`
  (`BbyDiscountTypeConstants`, `BbyConditionTypeConstants`, `BbyPriceCutConstants` `VKA0`,
  `BbyCondRefConstants` 5=buy/1,2,3=get, `BbyCondTargetTypeConstants`, `BbyLinkCategoryConstants`,
  `BbyScaleTypeConstants`).
- Role/link fields: `SIS.Pricing.Core\Models\PcCondition.cs` (`IsPrerequisite`, `IsCondition`,
  `ConditionKey`, `BbyItemIndex`); stamped in `SIS.Pricing.Core\Bonusbuy\Bby\BbyProcess.cs`.
- Flattening: `SimulationResultBuilder.cs` `BuildAppliedBonusBuys` (~209-238), `MapCondition` (~80-101).
- Human labels: `Sartawi.POS\BB\PotentialBonusBuys\BonusBuyDetailController.cs`
  (`MapDiscountType`/`MapCondTarget`/`MapLinkCategory`/`MapScaleType`/`MapPrereqType`/`MapStatus`).
- WPF PosSimulation (current, code-raw display): `Sartawi.Retail\POS\PosSimulation\PosSimulationView.xaml`.
