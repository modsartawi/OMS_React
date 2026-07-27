---
type: wayfinder-ticket
wayfinder: research
map: 126
status: done
blocked-by: —
---

# 130 — Can the server tell an agent *which items* would fire a missed promotion?

## Question

Note 10 makes actionable promotion guidance the highest-value feature on this map, and this is the
one thing that can make it impossible. `SimMissedPromotions.tsx` records the blocker in this repo's
own words: no capture carries a `prerequisites[]` array — "the captures sent `prerequisites: []` on
all four" — which is why the bonus-buy detail modal is currently the *only* route to a miss's rules.

Establish, with file:line evidence in `C:\Work\Pricing\SIS.Pricing`:

- **Why `prerequisites` comes back empty.** Is it never populated, populated only on some paths, or
  populated and dropped in projection? `PotentialBonusBuy` carries `OriginFilter` and prerequisite
  structure — trace what fills it.
- **What the engine *can* return** without new pricing work: per-prerequisite found-vs-required
  (qty and value), the driving unmet one, and the would-save figure `promo-view.ts` already models.
- **How a prerequisite resolves to eligible items.** `core/bonus-buy/GroupingMembersModal` already
  resolves a grouping to its members. Is that the same set the prerequisite evaluates against, and
  is it reachable from a pricing result or only from the BBY master?
- **Cardinality reality.** A prerequisite scoped to a hierarchy node could be thousands of items.
  What is the realistic distribution, and does the agent need "the eligible set" or "a ranked
  handful"?
- **ATP filtering.** Suggesting an item the store does not have is worse than suggesting nothing
  (Note 10). Where does that filter belong — pricing result, search endpoint, or client?
- **Whether 128's origin fix changes which promotions even appear** in the potential list for a CC
  basket. It almost certainly does, so the two must be reasoned about together.

Deliverable: a linked research note, a verdict (available as-is / available with listed engine
changes / not feasible), and — if engine changes are needed — the BackOffice issue minted for them.
This ticket **blocks the API contract** (136): `getState()` cannot be shaped without knowing what
promotion data exists.

## Answer

**Verdict: available with listed engine changes** — and the premise of the question was wrong in a
useful direction. Far more is already built than the ticket assumed.

Full evidence, file:line: [research note](assets/130-potential-prereqs/RESEARCH.md).
Engine work minted as BackOffice
[787](C:\Work\DMSCO\BackOffice\.issues\787-web-cc-promotion-guidance-engine.md).

### Why `prerequisites` came back empty — not the reason this repo recorded

Neither "never populated" nor "dropped in projection". `AnalyzePrerequisites` runs on **every**
non-fired candidate (`BbyProcess.cs:804-870`, called at `SimulationResultBuilder.cs:268` and
`PricingResultBuilder.cs:151`) and fills the array whenever the promotion has `BbyPrereq` rows. The
four captures came back `[]` because both captured promotions — `"70% 2nd PCS"` and
`"2 PC for 29.95 SR"` — carry **zero prerequisite rows**. They are second-piece promotions whose
entire rule lives on the *condition* side, and `ApplyBby` bails there (`:411-415`, `:291-292`)
recording nothing at all. `SimMissedPromotions.tsx:52` is right about the symptom, wrong about the
cause.

### What already exists (no engine work)

- Per-prerequisite found-vs-required (qty **and** value), the driving unmet one, `isMet`.
- BackOffice **already shipped the guidance projection** — spec 574 / ticket 579's
  `AvailableOffersBuilder`: the honest `Missing` ("add N more") delta, a three-way prereq kind, m/n
  progress, an `IsReady` chip for fully-qualified-but-out-ranked, ready-first sorting.
- **The live-session seam `getState()` needs.** `PricingContext.BuildSimulationResult(...)` projects a
  **live** transaction's context with *"no re-price, no throwaway simulation"*; the WPF controller
  already calls it on the open `PosTransaction` (`PotentialBonusBuysController.cs:152-159`) and reads
  both promotion surfaces off one pass.

### Prerequisite → eligible items: the same set, computed then discarded

`BbyPrereq` is already one row **per member material** (PK `…, MatItemPos`); an `MGP` grouping is
exploded by SAP, and price-time matching is a plain membership test over those rows — no grouping
master lookup, so guidance cannot drift from evaluation. The array is carried out of the analyser as
`BbyPrereqGroupStatus.MaterialNumbers`, then **collapsed to `[0]`** in both builders
(`SimulationResultBuilder.cs:302`, `PricingResultBuilder.cs:185`). Downstream, `AvailableOffers.cs:132-134`
classifies by `IsNullOrWhiteSpace(MaterialNumber)`, so a grouping prereq is mis-typed as `Material`
and the CTA names one arbitrary member SKU as though it were the only way to qualify — **a live
defect in the WPF POS today**. Fix A in 787; small.

`GET Bby/GroupingMembers` **already exists in SIS.Api** (BackOffice 601 — this repo's
`core/bonus-buy/api.ts:79` "does NOT exist yet" is stale), paged, resolving buy-side members from
exactly the same `Prereqs` rows. ⚠ but it is gated on the **Bonus-Buy Inquiry** grant, which a CC
agent will not hold — 134's problem.

### The real blocker: get-side misses are invisible, twice over

1. No `AnalyzeConditions` twin — a condition-side shortfall produces `prerequisites: []`,
   `skipReason: null`, no reason of any kind.
2. Worse, **discovery never loads the promotion.** BBY lookup keys on the condition-side access
   tables only (`From201`/`From202` over `BbyCond201`/`BbyCond202`,
   `SqlServerBonusBuyRepository.cs:65-110`); `BbyPrereq` is never an access path. **A basket holding
   only the buy-side item of a "buy X, get Y" promotion never loads it at all.** That is precisely
   the guidance note 10 calls the highest-value feature. Second-piece promotions escape only because
   their buy and get materials coincide.

Closing it needs a `FromPrereq` access path, which carries a genuine correctness question
(`BbyPrereq` has no org/channel/validity columns — validity must be borrowed from `BbyHeader`) and a
hot-path cost question under resume-per-request. Fix C in 787; **not** a plumbing job.

### Cardinality, ATP, and 128

- **Cardinality:** the schema bounds it — `PrereqType` is only `MAT` or `MGP`, never a hierarchy
  node, so the worst case is a wide-but-finite grouping. BackOffice's own working figure is
  **~1,000 SKUs**, asserted independently in two repos. The agent needs a **ranked handful**, not the
  set. One `GROUP BY` on the live pricing DB sets the page size — run it before 136 freezes.
- **ATP filter belongs in SIS.Api**, sharing ticket 131's read. Not the engine (no stock dependency,
  ships to tills, would put an availability call in every price pass and endanger 287's
  degrade-never-block rule); not the client (would ship the unfiltered set).
- **128 matters, but does not block 136.** Origin-rejected promotions are **not** dropped —
  `Process` assigns the *unfiltered* candidate list (`:83`), so they surface as near-misses carrying
  `SkippedByOriginFilter`. Fixing Origin to `C000` moves promotions in both directions and adds a
  permanently **non-actionable** near-miss class. 136 absorbs this by carrying the skip reason as a
  **typed category** rather than a passthrough string.

### Consequence for 136

`getState()` carries both promotion surfaces from one `BuildSimulationResult` pass, modelled on
`AvailableOffer` / `AvailablePrereq` (not raw `PotentialBonusBuy`), with `materialNumbers[]`, a typed
skip category, and suggestions already ATP-filtered and ranked to a stated top-N. **No `wouldSave` on
the wire** — carry the discount *definition*; spec 574 US26 ruled a fabricated savings total out,
since a real one requires firing the promotion. Buy-side guidance is buildable now; get-side is not
until 787-C — so the contract carries the get-side fields from day one and the client degrades while
they are absent, the pattern `AppliedBonusBuy.applications?` already uses here.

### Defect found in this repo

`promo-view.ts:368` sets `wouldSave = discount.value`, which is `CondValueP` — a **percent** — for
`discountType: '%'`; `SimMissedPromotions.tsx:152` then renders it through `formatMoney` beside the
currency. The `03-near-miss` capture makes it visible: `"70% 2nd PCS"` prints **"WOULD SAVE
35.00 SAR"**. Live today in `features/pricing/simulation/`, and map note 13 graduates `promo-view.ts`
to `@/core/` — so it travels with this map and must be resolved before the call centre inherits it.
