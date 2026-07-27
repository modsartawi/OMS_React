# Can the server tell an agent *which items* would fire a missed promotion?

Research asset for oms-react ticket [130](../../130-potential-bby-prerequisites.md), map
[126 — The call center goes to the web](../../126-web-call-center.md). All file:line evidence read
2026-07-27.

---

## Verdict

**Available with listed engine changes — and considerably more is already built than ticket 130
assumed.**

Three separate findings, in descending order of how much they change the map:

1. **`prerequisites[]` is not dead code. It is populated, it works, and a whole POS surface already
   consumes it.** The four captures showed `prerequisites: []` because those two promotions carry
   **zero `BbyPrereq` rows** — not because the field is unfilled. BackOffice spec 574 / ticket 579
   already shipped an **"Available offers"** projection (`AvailableOffersBuilder`) that turns exactly
   this data into "add N more {item}" guidance, ready-first sorted, in the WPF POS.
2. **The live engine session can produce it without a re-price.** `PricingContext
   .BuildSimulationResult(...)` is an extension over a live transaction's context; the WPF controller
   calls it on the open `PosTransaction` and reads both promotion surfaces off one projection. This is
   the seam `getState()` (ticket 136) needs, and it exists today.
3. **Two real gaps remain, and one of them is the headline feature.** The *eligible item list* is
   computed and then thrown away in projection (a two-line loss). And a promotion whose miss is on
   the **get** side is not merely un-analysed — it is **never discovered at all**, because BBY lookup
   is keyed on the condition-side access tables only.

---

## 0. Where the engine actually lives (read this first)

Ticket 130 pointed at `C:\Work\Pricing\SIS.Pricing`. That is one of **three** copies, and it is not
the one the call centre will bind to. Getting this wrong sends the minted work to the wrong repo.

| Copy | What it is | Who binds to it |
|---|---|---|
| `C:\Work\Pricing\SIS.Pricing\src\SIS.Pricing.Core` | Source of the **`SIS.Pricing.Core` NuGet package** (26.4.38) | `BackOffice/Pricing/SIS.Pricing.Services`, `SIS.Pricing.Tests`, `Sap.AcceptanceTests` — all `PackageReference` |
| `BackOffice\Pricing\Pricing.Core` | In-repo **project** copy of the engine core | `Sartawi.POS`, `Sartawi.Retail.Data`, `Sartawi.Retail`, `SapIntegration` — all `ProjectReference` |
| `BackOffice\Pricing\SIS.Pricing.Services` | The **simulation projection layer**, in-repo, and **ahead of** the standalone repo (it holds `AvailableOffers.cs`, which the standalone copy does not) | `Sartawi.POS`, SIS.Api |

Evidence: `BackOffice/Pricing/SIS.Pricing.Services/SIS.Pricing.Services.csproj:11`
(`<PackageReference Include="SIS.Pricing.Core" Version="26.4.38" />`); the seven `.csproj` files
carrying `ProjectReference` to `Pricing/Pricing.Core/Pricing.Core.csproj`.

**Consequence for minting:** a change to `PrereqStatus` / `BbyProcess` / `PricingResultBuilder` is a
**package change** in `C:\Work\Pricing\SIS.Pricing` plus a version bump, *and* must be mirrored into
`BackOffice\Pricing\Pricing.Core` (which the POS binds to by project). A change to
`SimulationResultBuilder`, `AvailableOffers`, or `SqlServerBonusBuyRepository` is a plain BackOffice
edit. Verify the mirror before assuming a one-repo fix.

---

## 1. Why `prerequisites` came back empty

**Not "never populated" and not "dropped in projection" — the two captured promotions genuinely have
no prerequisites.**

The projection is live and unconditional:

- `SimulationResultBuilder.BuildPotentialBonusBuys` calls
  `BbyProcess.AnalyzePrerequisites(model, allLines)` for every non-fired candidate
  (`BackOffice/Pricing/SIS.Pricing.Services/Simulation/Result/SimulationResultBuilder.cs:268`;
  standalone twin at `SIS.Pricing.Core/Pricing/PricingResultBuilder.cs:151`).
- `AnalyzePrerequisites` (`SIS.Pricing.Core/Bonusbuy/Bby/BbyProcess.cs:804-870`) returns one
  `BbyPrereqGroupStatus` per `(PrereqNumber, PrereqType)` group with `RequiredQty`, `FoundQty`,
  `MinValue`, `FoundValue`, `IsMet` — the found-vs-required meter `promo-view.ts` already models.
- When `bbyModel.Prereqs.Count == 0`, the group loop never runs: `Groups` stays empty and
  `AllPrereqsMet` is set `true` (`:856-859`). The DTO then serialises `prerequisites: []`.

The two captured near-misses are exactly that case. `.issues/assets/098-simulate-payloads/03-near-miss.json`
— basket is one line, `200706 × 1`; the potential is `000100000131 "70% 2nd PCS"`,
`condTargetType: "G"`, `prerequisites: []`, `skipReason: null`. `04b-no-price.json` /
`03-applied-and-potential-owner-supplied.json` carry `000100000132 "2 PC for 29.95 SR"`, same shape.

Both are **second-piece / N-for-price** promotions. Their entire rule lives on the *condition* side:
`BbyCond.Qty = 2` with a `ScaleType`, and `ApplyBby` bails at
`BbyProcess.cs:411-415` — `condsLines.Count < qty` ⇒ `continue` ⇒ `condGroups.Count == 0` ⇒
`return false` (`:291-292`). Nothing records *why*. `skipReason` stays null because it is only ever
set for validator / origin-filter / accumulation rejections (`BbyProcess.cs:32, 44, 61`), never for a
condition-side shortfall.

So the UI's diagnosis in `SimMissedPromotions.tsx:52` — "a missed promotion carries no prerequisite
data on the wire" — is right about the symptom and wrong about the cause. The wire carries no
prerequisite data **for these two promotions** because there is nothing to carry; a promotion with a
real buy-side prerequisite fills the array today.

**The genuine projection loss is a different field** — see §3.

---

## 2. What the engine can return without new pricing work

Already in `PotentialBonusBuy` on every simulate response (all fields confirmed present in the
captures):

- **Per-prerequisite found-vs-required** — `prerequisites[]` with qty *and* value pairs.
- **The driving unmet one** — first `!isMet`; already surfaced both by this repo's
  `promo-view.ts:352` and by BackOffice's `AvailableOffer.FirstUnmet`.
- **The "add N more" delta** — `AvailablePrereq.Missing`, floored at zero, qty for material/grouping
  prerequisites and currency for a value threshold
  (`BackOffice/Pricing/SIS.Pricing.Services/Simulation/Result/AvailableOffers.cs:119-154`).
- **A three-way honest prerequisite kind** — `Material` / `Grouping` / `ValueThreshold` (`:23`).
- **Progress and rank** — `MetCount` / `TotalCount`, `IsReady` (all prerequisites met but out-ranked
  by a better promotion), sorted ready-first then most-progress-first (`:85-88`).
- **The discount definition** — `discount.{discountType, value, conditionType}` from the first
  condition (`SimulationResultBuilder.cs:307-316`).
- **Accumulation state** — `remainingUsage`, `skipReason` (`:319-332`).

### ⚠ The would-save figure this repo prints is not a savings figure

`promo-view.ts:368` sets `wouldSave: p.discount?.value`, and `SimMissedPromotions.tsx:152` renders it
through `formatMoney` next to the currency code. But `discount.value` is `CondValueP` — a **percent**
— whenever `discountType === '%'`. The `03-near-miss` capture makes this visible: `"70% 2nd PCS"`
carries `discount: {discountType:"%", value:35}`, and the card prints **"WOULD SAVE 35.00 SAR"** for
a promotion that would have saved nothing of the sort.

BackOffice reached the opposite ruling deliberately: spec 574 US26, quoted in `AvailableOffers.cs:17`
— *"the honest numbers … and the discount DEFINITION — never a fabricated savings total, which would
require firing the offer."* A true would-save requires actually firing the promotion.

This is a live defect in `features/pricing/simulation/`, not a call-centre one, but map note 13
graduates `promo-view.ts` to `@/core/` — so it travels with the map and must be resolved before the
call centre inherits it.

---

## 3. How a prerequisite resolves to eligible items

**The eligible set exists, is already exploded, and is the same set the prerequisite evaluates
against. It is computed and then discarded in projection.**

`BbyPrereq` is one row **per member material**: PK `(BbyNumber, PrereqNumber, MatItemPos)`. For an
`MGP` (material-grouping) prerequisite, SAP writes a `MatItemPos 000000` row carrying the group-level
`Qty` with a blank `MaterialNumber`, then one row per member material with `Qty 1`. From the schema
dump (`C:\Work\Pricing\SIS.Pricing\bby fetching mecanism.md:169-213`):

```
000100000029  0001  000000  MGP  B1          1.000  X   -- group gate: any 1 of B1
000100000029  0001  000001  MGP  B1  200001  1.000
000100000029  0001  000002  MGP  B1  200002  1.000
000100000029  0002  000000  MGP  B2          2.000  X   -- group gate: any 2 of B2
000100000029  0002  000001  MGP  B2  200003  1.000
000100000029  0002  000002  MGP  B2  200004  1.000
```

Matching is a plain membership test over those rows — `items.Contains(c.MaterialNumber)` in both
`GetPrerequisites` (`BbyProcess.cs:180-189`) and `AnalyzePrerequisites` (`:819-827`). **No grouping
master lookup is involved at price time**, so there is no risk of the guidance set drifting from the
evaluated set.

`AnalyzePrerequisites` already carries the whole array out: `BbyPrereqGroupStatus.MaterialNumbers` is
a `string[]` (`BbyPrereqAnalysis.cs:15`, filled at `BbyProcess.cs:838`).

**Then both projections collapse it to one element:**

```csharp
MaterialNumber = g.MaterialNumbers.Length > 0 ? g.MaterialNumbers[0] : null,
```

`BackOffice/Pricing/SIS.Pricing.Services/Simulation/Result/SimulationResultBuilder.cs:302` and
`C:\Work\Pricing\SIS.Pricing\src\SIS.Pricing.Core\Pricing\PricingResultBuilder.cs:185`.

For a `MAT` prerequisite that is lossless (one material). For an `MGP` prerequisite it silently keeps
the **first member of the grouping and drops the rest**, and — worse for the client — the survivor
lands in `PrereqStatus.MaterialNumber`, which downstream code reads as *"the prerequisite is this
specific material."* `AvailableOffers.cs:132-134` classifies `Kind` by exactly that test:
`string.IsNullOrWhiteSpace(g.MaterialNumber) ? Grouping : Material`. So a grouping prerequisite whose
member rows carry material numbers is classified as **Material**, and the CTA names one arbitrary SKU
as if it were the only way to qualify.

**This is the single highest-value engine fix on this ticket, and it is small:** add
`MaterialNumbers[]` to `PrereqStatus`, populate it in both builders, and fix the `Kind` test to key
off `PrereqType == MGP` / `MatGrouping` rather than off the collapsed field.

### The already-built second route

`GET Bby/GroupingMembers` **exists in SIS.Api** — the oms-react comment at `src/core/bonus-buy/api.ts:79`
("does NOT exist in SIS.Api yet") is stale. Built by BackOffice ticket
[601](C:\Work\DMSCO\BackOffice\.issues\601-bby-inquiry-grouping-members.md) under map 598:

- `BackOffice/Services/SIS.Api/Endpoints/Logistics/BbyInquiryWebEndpoints.cs`
- `Sartawi.Retail.Data/Modules/Logistics/Pricing/Bby/Services/BbyGroupMembersQuery.cs`
- `…/BbyGroupMembersProjection.cs:94-105` — buy-side members = `model.Prereqs` where
  `MatGrouping == key` **and** `MaterialNumber` non-blank. **Byte-for-byte the same set the
  prerequisite evaluates against.**

⚠ Both `Bby/Detail` and `Bby/GroupingMembers` are **double-gated** —
`ApiKeyEndpointFilter` + `BbyInquiryGrantEndpointFilter` (`BbyInquiryWebEndpoints.cs:16-47`), i.e.
they require the **Bonus-Buy Inquiry** grant, not a call-centre one. A CC agent will not hold it. If
the console reuses these endpoints for the "show all members" drilldown, ticket 134 must decide
whether to widen the gate or mint a CC-scoped read.

It is **paged**, and it enriches descriptions **for the returned page only** — explicitly "never the
whole ~1000-SKU grouping union" (`BbyGroupMembersQuery.cs:15-16`). It reaches the BBY master via
`IBonusBuyRepository.GetBonusBuyByNumber`, so it works from a bare `bbyNumber` with no pricing result
in hand. The WPF POS already drills into it from the promotion detail
(`Sartawi.POS/BB/PotentialBonusBuys/BonusBuyGroupMembersController.cs`).

**Recommended split:** the pricing result returns the **prerequisite identity + a bounded ranked
handful**; `Bby/GroupingMembers` remains the "show me all of them" drilldown. Both read the same
rows, so they cannot disagree.

---

## 4. Cardinality reality

Not measurable from source — no production DB reachable from this session. What the repos assert:

- BackOffice's own working figure is **~1,000 SKUs** for a grouping, stated twice and independently:
  `BbyGroupMembersQuery.cs:16` and `oms-react src/core/bonus-buy/api.ts:79`. Both were written
  because a payload that inlined the union was rejected.
- A prerequisite is never a hierarchy node in this schema. `PrereqType` is only `MAT` or `MGP`
  (`BbyPrerequisiteTypeConstants.cs`), and `MGP` is already exploded into member rows by SAP. So the
  worst case is "a grouping with many member rows", not "an unbounded hierarchy subtree" — bounded by
  what SAP exploded, and directly countable with
  `SELECT PrereqNumber, COUNT(*) FROM BbyPrereq WHERE MaterialNumber <> '' GROUP BY BbyNumber, PrereqNumber`.
  **Run that on the live pricing DB before freezing the contract in 136** — it is a one-query task and
  it sets the page size.

**The agent needs a ranked handful, not the set.** At 12-hour agent-desk density, an "add one of
these 1,000" list is not guidance. Ranking inputs available without new pricing work: ATP at the
order's store (§5), store list price (ticket 131's endpoint), and — free from the engine — the
`Missing` delta that says how many more are needed. Ranking a *set of candidates* is not a pricing
concern; it belongs in SIS.Api beside the ATP read.

---

## 5. Where the ATP filter belongs

**SIS.Api, not the pricing engine and not the client.**

- **Not the engine.** `SIS.Pricing.Core` has no stock dependency of any kind and ships to the tills as
  a package. Adding a stock read to a prerequisite projection would put an availability call inside
  every price pass — a latency cost on the till path for a call-centre feature, and a new failure
  mode where a stock outage degrades pricing. Map note 8's rule ("stock-service failure degrades to
  unknown-ATP and never blocks entry", ticket 287) is much easier to honour outside the engine.
- **Not the client.** Map note 10 requires the suggestion list to be already-filtered; filtering after
  transport means shipping the unfiltered ~1,000 and re-deriving the ranking in the browser. It also
  breaks note 3's shape (the client would be reasoning about availability rather than displaying it).
- **SIS.Api, sharing ticket 131's read.** Ticket 131's item search must return catalogue + ATP + price
  per row at the order's store anyway. Near-miss suggestions want the same three columns for a
  different candidate list. Server-side stock is reachable there today — `Sartawi.Retail.Data` already
  carries HANA clients for stock ("the sibling StockV2 HANA clients",
  `Modules/Logistics/Pricing/Bby/Services/BbyHanaClient.cs:37`).

**Recommendation for 136:** one server-side enrichment step — *candidate materials in → ATP-filtered,
priced, ranked top-N out* — shared by item search and promotion guidance, and the near-miss
suggestion is a projection over it. `Bby/GroupingMembers` stays as-is (unfiltered, paged, the audit
view); the *guidance* path is the filtered one. They serve different questions and should not be
merged.

---

## 6. Does 128's origin fix change which promotions appear?

**Yes, in both directions, and it changes the potential list as much as the applied one.**

`BbyProcess.Process` (`:36-46`):

```csharp
var origin = pricingContext.Header.Origin;
if (origin.IsNullOrEmpty())
    origin = pricingContext.Header.Plant;     // ← the fallback ticket 128 calls a bug
if (bbyModel.IsOriginAllowed(origin) == false) {
    pricingContext.BbySkipReasons[bbyModel.BbyNumber] = AnalysisMessageConstants.SkippedByOriginFilter;
    continue;
}
```

Note that origin-rejected promotions are **not** dropped from the potential list. `Process` assigns
`pricingContext.PotentialBonusBuys = bonusBuys` (`:83`) — the **unfiltered** candidate list — so a
promotion excluded by origin still surfaces as a near-miss, carrying
`skipReason: SkippedByOriginFilter`.

Setting `Origin = C000` (ticket 127's ruling) therefore has three effects at once:

1. Promotions filtered to `C*` (`OriginFilterMatcher`, filter `"C"` ⇒ `C*`) begin to **fire** where
   today the plant fallback excluded them.
2. Promotions filtered to a store prefix stop matching and move from *applied* to *potential with
   `SkippedByOriginFilter`* — near-misses the agent will now see, correctly, as "not available on this
   channel".
3. The near-miss list gains a **non-actionable class**: an origin refusal can never be fixed by adding
   an item. Guidance must separate *"add this and it fires"* from *"this cannot fire here"*.
   `skipReason` already carries the distinction; nothing consumes it as a category today
   (`promo-view.ts:369` passes the raw string through, and `SimMissedPromotions.tsx:181` prints it
   verbatim).

**So 130 and 128 must be reasoned about together, as ticket 130 suspected** — but the coupling is
narrower than feared. It does not change *what data exists*; it changes *which promotions land in the
list* and adds one category to the guidance taxonomy. **136 is not blocked on 128 landing**, provided
the contract carries the skip-reason category as a first-class field rather than a passthrough string.

---

## 7. The remaining gap: get-side misses are invisible

This is the one finding that genuinely constrains map note 10, and it has two layers.

### 7a. No condition-side analysis

`AnalyzePrerequisites` has no twin. When a promotion fails because the *get* side is short —
`condsLines.Count < qty` at `BbyProcess.cs:411-415`, or no condition group formed at all (`:291`) —
nothing is recorded. The promotion appears in `potentialBonusBuys` with `prerequisites: []`,
`skipReason: null`, and no reason of any kind. **Both captured near-misses are this case.** A
promotion whose miss is condition-side is, to the agent, an unexplained entry.

Fix shape: an `AnalyzeConditions(bbyModel, lines)` twin returning per-condition
found-vs-required-qty + the eligible materials from `BbyCond201`/`BbyCond202` for that condition
number, projected onto the DTO alongside `prerequisites[]`. Mechanically the same pass as the prereq
analyser over a different row set — but it is new engine code, and it must not perturb `ApplyBby`.

### 7b. The deeper one — discovery never loads the promotion

BBY lookup is keyed on the **condition-side access tables only**:

```sql
SELECT DISTINCT c.BbyNumber FROM BbyCond201 c INNER JOIN BbyHeader h ON …
WHERE … AND (c.MaterialNumber IN @Materials OR c.MaterialNumber = '') AND @TrxDate BETWEEN c.ValidFrom AND c.ValidTo
```

`BackOffice/Pricing/SIS.Pricing.Services/Repositories/SqlServerBonusBuyRepository.cs:96-110`
(`From201`), unioned with the identical `From202` over `BbyCond202` (`:65-92`). `BbyPrereq` is
**never** an access path — it is only loaded *after* a BBY number is already known
(`LoadBbyModel`, `:134`).

`BbyCond201` rows are the **get-side** materials (PK includes `BbyDiscountType` + `CondNumber`, FK to
`BbyCond`). For BBY `000100000027` ("GET 2 Free") the prerequisite is material `200001` while the
`BbyCond201` rows are `200002` / `200003`.

**Therefore: a basket holding only the buy-side item of a "buy X, get Y" promotion never loads that
promotion at all.** It cannot appear in `potentialBonusBuys`, cannot be analysed, and cannot be
suggested. The agent is never told "you have the X — add a Y and this fires", which is precisely the
guidance map note 10 calls the highest-value feature.

Why the two captures *were* discovered: for second-piece and buy-line-item promotions
(`CondReference = 5`, `BbyCondRefConstants.BuyLineItem`) the buy and get materials coincide, so the
condition-side access finds them. The gap is specific to promotions where the reward is a *different*
material from the trigger.

Closing it means a **third access path** — `FromPrereq`, over `BbyPrereq` joined to `BbyHeader`. Two
real costs to weigh, and they are why this deserves its own decision rather than being assumed:

- `BbyPrereq` carries **no** `SalesOrganization` / `DistributionChannel` / validity columns (schema at
  `bby fetching mecanism.md:169-188`), so the join must borrow validity from `BbyHeader` — a
  different, looser predicate than the one `BbyCond201` supplies. Whether that is equivalent is a
  pricing-correctness question, not a plumbing one.
- It **widens the candidate set** on the hot path: every basket material now matches every promotion
  that names it as a trigger, each one then fully loaded by `LoadBbyModel` (four round-trips per BBY,
  `:128-147`). Under resume-per-request (map note 2) that lands on every mutation. The near-miss
  candidate list may need its own bounded, non-hot-path query rather than a widening of the price
  pass.

---

## 8. What this means for `getState()` (ticket 136)

The seam already exists and needs no new pricing work:

```csharp
// Sartawi.POS/BB/PotentialBonusBuys/PotentialBonusBuysController.cs:152-159
var result = AsyncBridge.Run(() =>
    tx.PricingContext.BuildSimulationResult(includeConditions: true, includePricingElements: false));
BuildAppliedSurface(result);      // → BuildPromoView
BuildAvailableSurface(result);    // → result.BuildAvailableOffers()
```

`BuildSimulationResult` is an extension over a **live** `PricingContext`
(`SIS.Pricing.Services/Simulation/Result/SimulationResultBuilder.cs:18`), explicitly *"no re-price, no
throwaway simulation"*. A resumed CC transaction can call it server-side and hand the client both
promotion surfaces from one projection.

Contract guidance for 136:

- `getState()` carries **both** surfaces from a single `BuildSimulationResult` pass — never two calls,
  never a client-side re-derivation.
- Model the near-miss on `AvailableOffer` / `AvailablePrereq`, not on raw `PotentialBonusBuy`. It is
  the shape two BackOffice tickets already argued to a conclusion, it carries `Missing` and `IsReady`,
  and reusing it keeps the web and the till telling the agent the same story.
- **No `wouldSave` on the wire.** Carry the discount *definition* (spec 574 US26). If the business
  wants a real savings number, that is firing the promotion, which is a different feature.
- Prerequisite items arrive as `materialNumbers[]` + a `prereqKind` keyed off `PrereqType` — never a
  single collapsed material.
- `skipReason` is a **typed category** (`validator` / `origin` / `accumulation` / `condition-short` /
  `none`), not a passthrough string — §6 makes origin refusals a permanent class of non-actionable
  near-miss.
- Suggestions arrive **already ATP-filtered and ranked, bounded to top-N**, with the N and the ranking
  rule stated in the contract rather than left to the client.
- **Phase the feature honestly:** buy-side guidance is buildable now; get-side guidance is not, until
  §7 lands. The contract should carry the get-side fields from day one (so the later engine work is
  additive) with the client degrading gracefully while they are absent — the pattern this repo
  already uses for `applications?` on `AppliedBonusBuy`.

---

## 9. Engine work to mint

BackOffice issue [786](C:\Work\DMSCO\BackOffice\.issues\786-web-cc-promotion-guidance-engine.md).
Three separable pieces, deliberately ordered so the map is not blocked on the hardest:

| # | Change | Where | Blocks 136? |
|---|---|---|---|
| A | `PrereqStatus.MaterialNumbers[]` — stop collapsing to `[0]`; fix `AvailableOffers` `Kind` to key off `PrereqType`/`MatGrouping` | `SIS.Pricing.Core` package (+ mirror into `BackOffice/Pricing/Pricing.Core`), `SimulationResultBuilder.cs:302`, `PricingResultBuilder.cs:185`, `AvailableOffers.cs:132` | **No** — contract can specify the field ahead of it |
| B | Typed skip-reason category, incl. a new `condition-short` set where `ApplyBby` bails on the get side | `BbyProcess.cs:291, 411-415` + DTO | No |
| C | `AnalyzeConditions` twin **and** a prerequisite-side discovery path (`FromPrereq`) — §7 | `BbyProcess`, `SqlServerBonusBuyRepository` | No, but **gates the get-side half of map note 10** |

A and B are small and well-understood. C carries a genuine pricing-correctness question (validity
predicate) and a hot-path cost question — it should be decided on its own evidence, not folded in.

## 10. Defects found in passing

1. **`wouldSave` prints a percentage as money** — `promo-view.ts:368` + `SimMissedPromotions.tsx:152`.
   Live in this repo today. §2.
2. **Grouping prerequisites mis-classify as `Material`** — `AvailableOffers.cs:132-134`, downstream of
   the `[0]` collapse. Live in the WPF POS today; the CTA names one arbitrary member SKU as if it were
   the only qualifying item. §3.
3. **Stale comments in `src/core/bonus-buy/api.ts:68, 79`** — `Bby/Detail` and `Bby/GroupingMembers`
   are marked "does NOT exist in SIS.Api yet"; both shipped under BackOffice map 598 / tickets 601 ff.
