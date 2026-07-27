---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: done
blocked-by: —
---

# 129 — The plant-rebind door and its five re-derivations

## Question

Note 7: changing the fulfilment store mid-basket is a **rebind**, not void+replay. The door does
not exist — `_storeId` is written only at `OpenAsync` (`PosTransaction.cs:883`) and `ResumeAsync`
(`:1096`); `IPosTransaction` has `RebindShiftAsync` and no store equivalent. This is real engine
work in `C:\Work\Pricing\SIS.Pricing`, released as an `SIS.Pos` pack, then consumed by SIS.Api —
so its contract must be right before it is built.

A rebind is a data-integrity event, not a re-price. Specify **each** of these, because pricing
recalculation touches none of them:

1. **Re-price every line** at the new plant — and what happens to a line that no longer prices
   there. Ticket 081 pinned that NewPos surfaces "No price detected!" and the line is *not added*;
   on a rebind that line already exists. Drop it, zero it, flag it, or refuse the rebind?
2. **Re-freeze ATP.** `ScanOptions.AtpAtScan` is frozen per line at add time and is the fraud
   signal BackOffice reads (285/286). After a rebind every line otherwise carries the old store's
   ATP under a new store's order.
3. **Coupon disposition.** The burn already went to Coupons-V2 attributed to the old store. Reverse
   and re-burn, or rule that attribution follows the burn? This interacts with 128 — after that
   ticket the origin no longer moves with the plant, which may make this simpler.
4. **Promotion re-derivation and re-statement.** A BBY qualified at the old store may not exist at
   the new one; a partially-satisfied promotion changes shape. The agent has already told the
   customer "add one more and the second is free" — a silent update is worse than useless.
5. **An audit event.** Otherwise the trail records adds at plant A while the submitted CLCN carries
   plant B, and reads as inconsistent to an auditor.

Also: does the rebind keep the transaction id (yes, presumably) and what the API returns so the
client can show a per-line diff rather than a silently different basket.

Deliverable: the door's contract, and the BackOffice/engine build ticket minted from it.

**Amended by [132](132-header-capture-inventory.md).** The trigger set is wider than "the operator
changed the store". In delivery mode the store is *derived* from the address's district
(`tempStoreCode || storeCode`), so a rebind also fires when:

- the operator picks a **different saved address** for the same customer;
- the operator **edits the selected address in place** (`PUT SdDocument/CustomerAddresses`) and
  changes its district — CC2 never had to handle this, because it assembled the header before any
  transaction existed;
- **ops flips `TempStoreCode`** on the district between two requests — a rebind with **no operator
  action at all**, and the case most likely to surprise. Decide whether the derivation is re-read on
  every request or pinned at the point the address was chosen; that choice is what makes this
  trigger real or impossible.

## Answer

Grilled with the owner, 2026-07-27. Engine work minted as BackOffice
[798](C:\Work\DMSCO\BackOffice\.issues\798-plant-rebind-door.md), which carries the full contract;
its blocking prerequisite is BackOffice
[797](C:\Work\DMSCO\BackOffice\.issues\797-resume-drops-pcheader-plant.md), a defect found while
specifying this door.

### 🚩 The blocker found on the way: a resume loses the plant

`ResumeAsync` restores `_storeId` (`PosTransaction.cs:1096`) but the `PcHeader` it rebuilds at
`:1125-1141` **never sets `Plant`** — the open path does (`:950`); the two header assemblies have
drifted. The omission cascades, because `PricingEnrichmentService.EnrichHeader` starts with
`GetPlantAsync(header.Plant)` and wraps its whole body in `if (plant != null)`, so a resumed header
also loses `LocalCurrency`, `DepartureCountry` and `TaxClassificationCustomer`.

It hides because resume ends in `RecalculateAsync` — pricing type `"A"`, rescale only — so every
line already in the basket keeps correct conditions. The next **scan** runs type `"B"`
redetermination against the plant-less header: `ZVKP` access 40 (`SalesOrg / DistCh / Material /
Plant`, table 705) misses and the line falls through to access 50 (table 554), taking the
**national price instead of the store price**, with no error — `HasMissingPriceBlocker` only fires
when *nothing* prices. `YMWS` tax, keyed on the now-empty `DepartureCountry`, may not determine
either.

This is a **till** bug (suspend→resume, park→unpark, crash recovery), not a call-center one. It
becomes existential for this map because 127 made every mutation a resume, so "second item onward"
is the normal path, not an edge. Fix is one line. Owner ruled it its own BackOffice issue rather
than folded into 798, so it can ship ahead of the call center if any till is running the pack.

### The seven decisions

1. **The district→store derivation is pinned at the address act**, not re-read per request. Ops
   flipping `TempStoreCode` mid-basket changes nothing until the operator next picks or edits an
   address. Consequence: **every rebind has an operator behind it**, so the door may refuse and may
   require confirmation. 132's third trigger — a rebind with no operator action — is ruled out of
   scope by this choice.
2. **One engine door, run twice by SIS.Api.** No `dryRun` flag: under 127's resume-per-request a
   preview *is* "rebind and don't persist". `POST …/rebind/preview` claims, resumes, rebinds,
   returns the diff and releases without saving; `POST …/rebind` saves. One mutation, one audit
   event, one replay handler.
3. **The re-price is `NewPricingAndKeepManual` ("C"), not `RecalculateAsync`.** `RecalculateAsync`
   runs type `"A"` — documented as "when Quantity or Scale is changed" — and would leave every
   plant-keyed condition exactly as the old store priced it. `"C"` skips any step carrying a manual
   condition outright (`PricingItemCalculator.cs:995-1007`) and redetermines the rest, so the coupon
   line and the `DFEE` delivery fee — manual by construction — cannot be recomputed by a rebind.
   Note that no existing header mutation (`SetLoyalty`, `ClearLoyalty`, `SetInsurance`) changes an
   access-sequence key, so **the engine has no precedent for a redetermining mutation**; this is the
   door's real content.
4. **A line that no longer prices ⇒ the whole rebind refuses**, naming the lines
   (`LINES_UNPRICED_AT_PLANT`). Atomic: the agent voids them deliberately and retries. Preview
   returns the same refusal, so nobody sees a basket half-moved. 🚩 The engine must mutate to
   discover this, so the contract states a refused instance is indeterminate and must be discarded,
   never saved — free under resume-per-request.
5. **ATP is re-frozen, and the audit keeps the old.** The engine never reads stock — `AtpAtScan`
   arrives on `ScanOptions` and is written only at scan (`:6651`) and resume (`:1210`) — so SIS.Api
   reads the new plant and passes a per-line map into the door. Lines whose read failed keep the old
   value and are reported stale, never blocking (287's rule). ⚠ **This amends map note 8**: frozen at
   add *and re-frozen on rebind*, so 285/286 keep reading one field whose meaning stays "availability
   at the store that will fulfil, at the last moment the agent could see it".
6. **Coupons: nothing happens.** The engine never burns — `AddCouponAsync` only records a burn the
   host already made at Coupons-V2 — and after 128 the template matches `Origin ?? StoreCode` where
   `Origin` is a sticky `C000` the rebind never touches. No reversal, no re-burn, no re-validation;
   the door needs no coupon parameter. Re-derivation 3 collapses to a documented non-event.
7. **`PLANT_REBIND` carries everything**, following `SetInsurancePayload` rather than the thinner
   `ShiftRebindPayload`: old→new plant, the trigger, post-recalc lines, the old→new ATP table,
   coupons held, header rollup. Replay must not re-invoke pricing — a replay a week later would
   redetermine against condition records that have since changed and silently produce a different
   basket.

### A sixth re-derivation the ticket didn't list

`SalesOrganization`, `DistributionChannel` and `DepartureCountry` are **plant attributes**
(`IPlantInfoRepository.GetPlantAsync`), read once at open and never re-read. The first two are the
other keys of `ZVKP` access 40 alongside `Plant`; the third keys `YMWS` tax. Redetermining with a
new `Plant` under the old plant's sales org reads a condition record describing neither store. The
door therefore takes the **new plant's whole identity**, not just its code — correct by construction
if al-dawaa ever opens a store in another sales org or country.

### What re-derivation 4 turned out to be — much smaller

`Plant` occurs in `SIS.Pricing.Core` **exactly once**: `BbyProcess.cs:39`, the empty-origin
fallback. BBY lookup keys on **Origin only**, and 128 made Origin a sticky `C000`. So a plant rebind
**does not change which promotions apply** — the agent's "add one more and the second is free"
survives a store change; only what it is *worth* moves, because the discount sits on prices that
changed. That is a consequence of 128's ruling that promotions follow the seat, not the fulfilment
store, and it is worth stating plainly to whoever writes the guidance UI (138).

### Two facts that closed the ticket's open questions

- **The transaction id survives trivially.** `UlidPosTransactionIdGenerator` ignores its
  `PosTransactionIdContext` entirely and emits a bare ULID — no store encoded — and
  `PcHeader.DocumentNumber` / `ConditionDocumentNumber` are that id. 133's
  `OrderNo := TransactionId` is safe.
- **The per-line diff has a shape already.** `SIS.Pricing.Core` ships
  `RepricingItemDiff` / `RepricingConditionDiff` / `RepricingHeaderDiff` with
  `Added` / `Removed` / `Changed` / `Unchanged` and a `ChangeReason`. 🚩 But **not**
  `RepriceDocument` itself — its `CloneHeader` drops `Plant`, `Application`, `DocumentType`, `LoyId`
  and `IsPromotionApplicable`, and its `CloneItems` keeps four fields with no `LineType` or
  `ItemConditionControl`, so it would reprice at an empty plant and mis-handle every coupon and fee
  line. Reuse the shape, build the diff from `BuildPricingResult()` before/after.

