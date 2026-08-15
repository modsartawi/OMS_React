---
status: open
spec: 282
blocked-by: 285
---

# 286 — A prepared receipt nobody collected shows how long it has waited

## What to build

The third tab, **Cash waiting** — every prepared special receipt the estate has not collected,
enumerated rather than flagged. Today the fleet row can only say *"0331 has one somewhere"*, which
sends the accountant hunting through an account for it.

A new estate-wide door, no scope parameter, mirroring `Settlement/Orphans`:

```
GET Settlement/Uncollected?limit=500  →
{ settlementConsumptionId, documentId, storeId, storeName, servedBy, isMine,
  entryNumber, entryKind, amount, currencyKey, preparedAt, ageDays }[]
```

The tab reuses [285](285-open-entries-list-oldest-first.md)'s projection and grid with **three
substitutions and nothing else**:

1. **the age says *prepared*, not *posted*** — `preparedAt` is when the receipt was written;
2. **the money is the receipt's whole amount**, with no *still open* and no *of* — a receipt is
   collected or it is not, so there is no partial state to show;
3. **the name column is the collector**, not the branch manager. A receipt waiting is a **visit that
   did not happen** — different failure, different call — which is why this is its own tab and not a
   kind filter on the other two.

The handle is `entryNumber`, the same one the other two tabs quote, so the accountant identifies it
on the phone the same way.

⚠️ **A partly-consumed entry can appear on Owing *and* here, and must not be deduplicated.** They are
two true sentences about the same money: *"the branch still owes 40"* and *"a receipt for 60 is
prepared and nobody has been to fetch it"*.

Cap is the orphan lane's **500** (`WORKLIST_LIMIT`'s reasoning — a waiting receipt is a rare event,
not a population), and `isCapReached` watches it. The empty state is its own sentence — *No cash
waiting. Every prepared receipt has been collected.* — never a generic one shared with the other
tabs, and the failed-door rendering is the same em-dash-and-refusal rule 285 established.

## Spine reach

model (the uncollected row) · api (`settlementApi.uncollected`) · logic (the projection's cash
variant) · component (the third tab + its column swaps) · i18n · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `lane: a waiting receipt reads its age from prepared, and carries no remaining` — the three
      substitutions, asserted through the projection's public result · **pure**
- [ ] `lane: the same entry may appear owing and waiting` — both rows survive; nothing deduplicates
      them · **pure**
- [ ] Drive `tools/settlement-drive.mjs`: the third tab renders against a fixture, its empty state is
      distinct from the other two, and the collector's name shows where *served by* does elsewhere ·
      **flow (Playwright)**

## Boundaries

**Server dependency §2** of `.afk/BACKOFFICE-TICKET-DRAFT-settlement-reads.md` — the door is
**designed and costed but not built**, so this slice is proven against a fixture served over the same
call, exactly as 269's screens were before 274 joined them to a live SIS.Api. Its shape is settled
(the map's [277](277-the-cash-waiting-doors-shape.md) fixed the table, the clock and the handle
against the server source and a live database), so the fixture is a stand-in for a known contract
rather than a guess. New keys in the existing `settlement` namespace.

## Done when

The Cash waiting tab lists waiting receipts oldest-first with the collector and the entry number,
both pure tests are green, and its empty and failed states are visibly distinct from the other tabs'.

## Blocked by

[285](285-open-entries-list-oldest-first.md) — the projection, the grid, the sections and the state
vocabulary all arrive there.
