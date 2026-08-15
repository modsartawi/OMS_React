---
type: wayfinder-ticket
wayfinder: grilling
map: 275
status: done
blocked-by: 276
---

# 280 — The ageing read door: extend the ledger, or mint a lane

## Question

Where do the **Owing** and **Owed** tabs get their rows? There is a built door that almost fits and
a gap between "almost" and "fits" that has to be ruled on rather than papered over.

**`Settlement/Ledger` exists** (BackOffice 1199 §3, built and proven against a live database) and
already gives more than 274's own notes suggest:

- ✅ Takes `status`, `entryKind`, `postedFrom`/`postedTo`, `storeId`, `entryNumber`, `batchId`
  (`SettlementAccountantService.cs:436-437`). `status=OPEN&postedTo=<date>` **is** an ageing query.
- ✅ Rows carry `StoreName` **and** `CurrencyKey` — `LabelBranchesAsync` (line 490) adds both after
  the SQL. (⚠️ The raw projection at line 449 does not show this; reading the SQL alone gives the
  wrong answer, which is worth knowing before anyone re-derives it.)
- ❌ **No `ServedBy` / `IsMine`** — those live only on `Settlement/Branches` (lines 916-933). The
  map's mine-first ranking and the *who do I ring* column both need them.
- ❌ **`ORDER BY EntryNumber DESC` and nothing else**, chosen deliberately as a *total* order so
  rows do not shuffle at the cap boundary. A worklist wants oldest-first, and the cap makes that
  not merely a client-side re-sort: **re-sorting a capped page changes which rows the cap kept.**
- ❌ **Refuses an unfiltered call** (`SettlementLedgerCriterionRequired`, a 400) — correct for a
  lookup tool, and `status=OPEN` alone satisfies it, so this is a constraint to note rather than a
  blocker.
- ❓ No chase-note projection (see [278](278-the-chase-notes-contract.md)).

**The decision:**

- **Extend the ledger** — add `servedBy`/`isMine` to its rows and an age sort option. One door, one
  contract, no duplication. But it makes a *lookup* door carry a *worklist's* ordering and ranking,
  and 1199 §3's own reasoning for `ORDER BY EntryNumber DESC` was that a total order stops rows
  appearing and vanishing at the cap. A second sort mode has to be equally total.
- **Mint a purpose-built lane door**, mirroring `Settlement/Orphans` the way
  [277](277-the-cash-waiting-doors-shape.md) does — no scope parameter, its own cap, sorted and
  ranked for chasing. Cleaner semantics, one more door to keep in step, and two doors reading the
  same table with different orderings is how the fleet flag and the orphan lane nearly drifted (the
  reason `OrphanPredicate` is written exactly once, `SettlementAccountantService.cs:84`).

Sub-questions either way:

1. **The cap.** `LEDGER_LIMIT` in `cap.ts` against an estate-wide *every open entry* query. How many
   open entries does the estate actually hold? 274's lesson is that this is measured, not assumed —
   its worst find was a 500-row default against 1394 branches, with nothing in the answer to say so.
2. **Do Owing and Owed come back as one call or two?** Two tabs, one `entryKind` parameter. One call
   filtered client-side keeps the counts consistent; two calls halve each answer against the cap.
3. **Does this door supersede the Ledger leaf?** If the ageing door answers *"everything still open,
   estate-wide, ranked"*, confirm the Ledger leaf still has a distinct job (it does — resolving
   *"entry 143, which branch?"* — but say so, or the two leaves will be merged by someone later).

## Unblocked by [276](276-what-an-entrys-age-is-measured-from.md)

The blocker is answered. What it fixes, and one new fact it drags in:

- **The sort key is `PostedAt` ascending** (equivalently `ageDays` descending). Tie-break on
  `EntryNumber` so the order stays **total** — which is exactly the property 1199 §3 chose
  `ORDER BY EntryNumber DESC` to protect, so a second sort mode can satisfy the same reasoning rather
  than argue with it.
- **The projection grows two fields, not one:** `postedAt` (already on `SettlementEntry`, so free)
  **and** a server-computed `ageDays` = `DATEDIFF(day, PostedAt, <server now>)`. The client does not
  subtract — 276 ruled the clock is the server's, following `SettlementOrphanRow`'s own docblock.
  Note `ageDays` is **not persisted and not stable across calls** by design; it is a rendering of the
  timestamp beside it, and the timestamp is what sorts.
- 🚩 **New, and it sharpens sub-question 1: `PostedAt` is not indexed.**
  `SettlementAccountantService.cs:388` says so in as many words — *"Neither `BatchId` nor `PostedAt`
  is indexed"* — about the very query this door would extend. So *"sort the estate's open entries
  oldest-first under a cap"* is a sort on an unindexed column inside a `TOP`, which is the shape that
  makes a cap silently pick the wrong rows. **Measure before choosing** between extending and minting;
  the answer may be that either option needs an index, in which case that is part of the ask and not
  a client concern. This does not decide extend-vs-mint — it means the decision cannot be made on
  contract cleanliness alone.
- **Sub-question 2 is unaffected** by 276 — one call or two is still open.

## Answer

**Extend `Settlement/Ledger`. Do not mint a lane.** Resolved AFK, 2026-08-15, with the cost
question measured rather than deferred.

### Why extending wins, once the drift argument is checked rather than assumed

The case for minting rests on `OrphanPredicate`'s lesson — *"two copies of a money predicate drift,
and the drift is invisible from either side"*. 🔑 **That lesson does not reach this door, and the
difference is what decides the ticket.** An orphan is a *money predicate*: a compound rule about
document markers and a 72-hour grace, whose meaning can move. The ageing lane's predicate is
`Status = 'OPEN'` — a column equal to a constant, the same one `Settlement/Ledger` already takes as a
parameter and the same one `IX_SettlementEntry_Status_Store` was minted for (081's own comment:
*"the accountant's worklist asks 'every OPEN entry in the estate'"*). There is nothing here to drift.

So the two options are not *clean semantics vs. duplication*; they are **one door with two callers
vs. two doors with one query**. And the ledger already takes the lane's exact question:
`status=OPEN&entryKind=SHORTAGE` **is** the Owing tab. A new door would take the same parameters, hit
the same index, and return the same rows in a different order — which is a sort option wearing a
route.

**What the ledger grows** (three fields and one parameter, all additive — no existing caller changes):

- `servedBy`, `isMine` — from `GetBranchesAsync`'s pairing resolve (`:916-933`). ⚠️ Applied in
  `LabelBranchesAsync` (`:490`) beside `StoreName`/`CurrencyKey`, i.e. **a chunked plural read per
  page**, not per row. That precedent is the reason this is cheap; a per-row resolve would be an N+1
  on a 500-row page and must be refused if anyone proposes it.
- `ageDays` — `DATEDIFF(day, e.PostedAt, <server now>)`, per [276](276-what-an-entrys-age-is-measured-from.md).
  Free: `PostedAt` is already projected.
- `lastChase` — optional, per [278](278-the-chase-notes-contract.md)'s `OUTER APPLY`. Absent when
  that table is not built.
- `sort=age` — `ORDER BY e.PostedAt ASC, e.EntryNumber ASC`. Default stays `EntryNumber DESC`, so
  every shipped caller is untouched.

🔑 **The second sort satisfies 1199 §3's own reasoning rather than arguing with it.** That reasoning
was that the order must be **total**, so rows do not appear and vanish at the cap boundary — and
`(PostedAt, EntryNumber)` is total, because `EntryNumber` is unique estate-wide by design
(`UX_SettlementEntry_Number`). The requirement was totality, not `EntryNumber` specifically.

### Sub-question 1 — the cap, measured

Two facts, both taken today against `POS_Server` on `.\SQLEXPRESS`:

- **The estate holds 0 open entries right now** — 1403 CANCELLED, 2 CLOSED_OUT, 2 CONSUMED, of 1407.
  That is 274's own 1394-row seed, withdrawn again afterwards, so the number to design against is
  **274's seeded shape: one open entry per branch, 1394 of them**, not today's zero.
- 🚩 **The unindexed-`PostedAt` flag is answered and it is not a problem.** The candidate query —
  `TOP (500) … ORDER BY PostedAt ASC, EntryNumber ASC` over the full 1407-row table — runs in
  **17 ms cold, 2 ms warm**, 0 ms CPU. A sort of ~1400 narrow rows is nothing, and the estate's open
  population is bounded by its branch count, not by history (a consumed entry leaves the set). **No
  index is asked for**, and this ticket's *"the answer may be that either option needs an index"* is
  closed: neither does. The revisit trigger, written down rather than relied on: if the open
  population ever reaches six figures, the index is `(Status, PostedAt) INCLUDE (StoreId,
  EntryNumber)`.

**So the cap is the real risk, not the sort** — 1394 against `LEDGER_LIMIT`'s 500 is 274's worst find
repeating itself exactly. The ruling:

> **The lane calls at `limit = 2000`; `LEDGER_LIMIT` stays 500.** One door, two callers, two
> constants — a new `OPEN_LANE_LIMIT = 2000` in `cap.ts`, beside `FLEET_LIMIT` and `BRANCH_LIMIT`
> and for the identical reason that docblock already gives: **these answer a *population*, where a
> cap below it truncates a complete answer; the Ledger view answers a *question*, where reaching 500
> means the question is too broad to read.** `isCapReached` watches both.

### Sub-question 2 — **one call, split client-side**

`status=OPEN&sort=age&limit=2000`, both kinds, split into Owing/Owed by `entryKind` in the
projection. Reasons, in order:

1. **The counts must agree.** Owing's count, Owed's count and the Overview signpost all come from one
   answer, so they cannot disagree with each other or with the cap banner.
2. **One cap statement, not two.** Two calls means two truncation states to reason about and to
   render; one call means the banner speaks once about one answer.
3. The population is bounded by the branch count, and 2000 clears 1394 with room — the same headroom
   `FLEET_LIMIT` chose.

Cash waiting is necessarily its own call — a different door on a different table
([277](277-the-cash-waiting-doors-shape.md)).

### Sub-question 3 — the Ledger leaf keeps its job, said out loud

They answer different questions and both are needed:

| leaf | question | cost |
|---|---|---|
| **Open settlements** | *"who has not sent the money, and how long has it been?"* | the estate's open set, ranked, ~2 ms + labelling |
| **Ledger** | *"entry 143 — which branch is that?"* | a **one-row seek** on `UX_SettlementEntry_Number` |

The lookup is the door's founding purpose (1199 §3: 1173 mints the handle and provides no way to
resolve one) and it answers about *closed* entries too, which the lane by definition never shows.
🚩 Written here so that the next person to notice they call the same endpoint does not merge the two
leaves and delete the phone-call lookup.

### What goes into the hand-off draft

A new **§6** — *the ledger grows what the lane ranks by* — carrying the four additions, the two
measurements above, and the explicit note that no index is requested. Not a client change; this repo
is read-only on that side.
