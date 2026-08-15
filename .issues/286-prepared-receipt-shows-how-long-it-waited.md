---
status: done
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

- [x] `lane: a waiting receipt reads its age from prepared, and carries no remaining` — the three
      substitutions, asserted through the projection's public result · **pure**
      (`open-lane.test.ts`) — every fixture row's `ageDays` is checked against its own `preparedAt`
      and the frozen `LANE_TODAY`, and against the **entry's** age, which differs on most rows; the
      *no remaining* half is `'remainingAmount' in row === false`, because the wire carries no such
      field at all. **Both halves were falsified before being trusted**: a fixture that copied the
      entry's `postedAt`/`ageDays` fails the first, and collapsing `failed` into `empty` fails the
      state case
- [x] `lane: the same entry may appear owing and waiting` — both rows survive; nothing deduplicates
      them · **pure** — one hand-built pair (entry 1611: *40 still open* and *a 60 receipt waiting*,
      on two different clocks) plus the estate-scale case, where **every** one of the 37 receipts is
      minted against a real open entry and both lanes still count their own answer in full
- [x] Drive `tools/settlement-drive.mjs`: the third tab renders against a fixture, its empty state is
      distinct from the other two, and the collector's name shows where *served by* does elsewhere ·
      **flow (Playwright)** — **272/272 PASS**; the section also drives `?tab=cash` as an address,
      the door being asked for its own 500 with **no scope**, the header row reading *Amount* and
      *Collector* (and neither *Still open* nor *Served by*), *prepared* under every row and *posted*
      under none, no colour anywhere on the age, both degraded states — **its own refusal** (its
      count em-dashed while the two entry tabs still count) and the converse, **a refused ledger
      leaving the receipts drawn** — and the empty shelf reading `0` rather than an em-dash, because
      *collected everything* is a number this door did give us

**Also run:** `npm run typecheck` clean · `npm test` 1891/1891 (118 files) · `npm run lint`
(boundaries, contrast, colour literals) clean · `npm run build` green.

**What it cost, and what it did not.** The projection was **generalised rather than copied**:
`arrange()` is generic over the three facts an arrangement is made of (`isMine` / `servedBy` /
`ageDays`), so `buildOpenLane` and `buildCashLane` share one sectioning, one signpost and one
*empty ≠ emptied-by-filter ≠ failed*. `LaneBody` and `Section` are generic the same way. The three
substitutions live where they belong — in `buildCashColumns`, and nowhere else.

🚩 **The cash count is NOT `tallyOpenLane`'s.** It is a second door with its own cap and its own
failure, so the tab strip composes it beside the other two: one lane refusing must never take the
other's numbers down with it, and the drive asserts that in both directions. The same reasoning kept
the third link **off** 288's front-page signpost, which would otherwise have to fetch the receipts on
the screen an accountant opens first (logged).

**`/code-review` (high) raised two; both were real and are fixed here.** The *Mine only* chip is
one piece of state across three tabs while **whether it can be offered is per-tab** — the receipts
door always ranks its rows, the entry tabs wait on §6 — so a reader could press it on Cash waiting,
switch to an unranked Owing and read *"nothing matches these filters"* **with no chip on screen to
clear**. The projection now ignores a filter over a field nobody sent (a pure test and a drive case
pin it). And the three tabs **shared one AG Grid instance**, whose per-column sort and filter state
survives a `columnDefs` swap across shared `colId`s — an *age* sort set while chasing shortages
carried into the receipts list; sections are now keyed by tab as well, and the drive check was
falsified against the unkeyed version before being kept.

**Spec fidelity: nothing missing, and one flag checked rather than accepted.** The spec axis read
D12 as requiring the receipt's `currencyKey` to be **ignored**; `money-display.ts` says the opposite
in as many words (*"every call site still says which branch's currency it means… the day the reads
carry a code this function starts honouring it with no call site changing"*), and the **ledger** door
already carries one, so 285's entry rows honour it too. Stripping it here would have made this the
one column on the screen that refuses a precision the branch actually has. Left as it is, logged.

**`/standards-review` — Standards: no hard violation** against any of the four documented rules,
one behavioural nit fixed (the chip drew above the cash tab's shimmer, because `!cash.isError` is
true before the answer arrives). Judgement calls left as they are: the two `LaneBody` call sites
read as a conditional twin — a per-tab descriptor object would make *three substitutions and nothing
else* structural rather than prose, and is worth doing if a fourth tab ever lands; and the settlement
wave's vocabulary (*prepared special receipt*, *cash waiting*, *consumption*) is still absent from
`CONTEXT.md`, which is `/domain-modeling`'s debt rather than this ticket's.

⚠️ **One pre-existing drive check is flaky** — 270's *"a broad query is capped"* failed once in four
runs with *Showing 1 of 1*, a race on the scope button before the search; it passes on re-run and is
untouched by this slice.

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
