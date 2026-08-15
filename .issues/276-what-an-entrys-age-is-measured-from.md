---
type: wayfinder-ticket
wayfinder: grilling
map: 275
status: done
blocked-by: —
---

# 276 — What an entry's age is measured from

## Question

The map rules that age is stated as a **fact** and never judged (no threshold). That makes the
number itself load-bearing: it is the only thing the lane sorts on and the only thing a row asserts.
So what is it measured from?

**The concrete case that forces the question** — live in `POS_Server` on `.\SQLEXPRESS` today:

| entry | store | kind | amount | remaining | posted | last consumed |
|---|---|---|---|---|---|---|
| 2 | P001 | SURPLUS | 35 | **9** | **2026-08-01** | **2026-08-09** (26.000, SHIFT_CLOSE) |

Is that entry **14 days old** or **6**? Both readings are defensible and they order the lane
differently:

- **From `postedAt`** — "this decision has been outstanding a fortnight". Simple, matches the
  sentence an accountant says on the phone (*"entry 143, posted the first"*), and never moves.
- **From the last movement** — "nothing has happened here for six days". A branch paying 26 of 35
  is *engaging*; ranking it above a branch that has paid nothing in ten days is arguably backwards.
  But it means a partly-paying branch can stay young indefinitely by dribbling.

Sub-questions this must also settle:

1. **The cash-waiting side.** A receipt's age is from `preparedAt` — but confirm that is what the
   uncollected set actually carries, and that it is the same clock. ⚠️ Every settlement timestamp on
   this contract is **local wall clock, not UTC** (`src/core/models/settlement.ts`, and D6's trap for
   272's audit pane). A day count computed against a UTC `now` is wrong by up to three hours at the
   boundary — which is a whole day at midnight.
2. **Whose clock computes it.** 270's `worklist.ts` is explicit that it reads no `Date.now`, so *"this
   module's answers do not change overnight"*, and 274 removed the server's `ageDays` when it
   narrowed to D13's contract. Does the age come back from the server as a number, or does the client
   derive it from a timestamp? The lane sorts on it either way — but only one of those two is stable
   across a browser left open all night.
3. **Whether a REVERSE counts as movement.** A void restores money to the entry
   (`consumptionKind: 'REVERSE'`, `isRestoration` in `account-projection.ts`). Under a
   last-movement reading, a void would make an old entry look freshly active — which is the opposite
   of what happened.

## Why it blocks

Both [280](280-the-ageing-read-door.md) (the door's sort and projection) and
[281](281-the-open-settlements-view.md) (what a row says) need the answer. A door that sorts on the
wrong timestamp cannot be fixed on the client without re-sorting a capped result set, which silently
changes which rows the cap kept.

## Answer

**Age is measured from `postedAt`, the server subtracts it in calendar days, and the cash-waiting
side takes the identical treatment from `PreparedAt`.** Owner-ruled in session, 2026-08-15.

So entry 2 is **14 days old**, not 6.

### The ruling, in one rule

> An entry's age is `DATEDIFF(day, PostedAt, <server now>)`, computed server-side, sent on the row
> beside the timestamp it came from. A receipt's age is the same subtraction from `PreparedAt`.
> The client never calls the clock.

### Why `postedAt` rather than the last movement

- **It cannot be gamed.** Under a last-movement reading a branch dribbling 1 riyal a week stays
  permanently young while owing the estate money — the exact branch the lane exists to surface.
- **Sub-question 3 dissolves.** A void (`consumptionKind: 'REVERSE'`) cannot refresh a clock that
  never moves. The REVERSE-counts-as-movement question only exists under the other reading, and this
  ruling deletes it rather than answering it.
- **It is a column, not an aggregate.** `postedAt` is already on `SettlementEntry` and therefore on
  `SettlementLedgerRow`. "Last movement" is a correlated `MAX(ConsumedAt)` per entry that no door
  computes today — and `SettlementAccountantService.cs:388` already warns **`PostedAt` itself is not
  indexed** on the ledger query, so the door is starting from behind on sorting cost before adding an
  aggregate on top of it.
- **It matches the sentence said on the phone** — *"entry 143, posted the first"*. The one
  human-quotable handle (`entryNumber`) and the age now come from the same immutable row.

**What the other reading was right about is not lost.** *"This branch is engaging"* is a real and
useful fact — it is just **not the age**. It is `remainingAmount` beside `amount` on the same row:
*"posted 1 Aug · 9 of 35 still open"* says both things, and lets the reader weigh them, without
making one number encode two facts. Rendering that pair is [281](281-the-open-settlements-view.md)'s.

### Whose clock — the server's, as `ageDays`

The row carries **both** `postedAt` (the timestamp, the sort key) **and** `ageDays` (the server's
subtraction, the thing displayed).

- It follows a ruling already taken on this contract: `SettlementOrphanRow`'s docblock
  (`src/core/models/settlement.ts:264-267`) — *"`ageDays` in particular must stay the server's
  subtraction (the clock is the server's)"*.
- It holds `worklist.ts:31`'s purity stance — *no React, no `t()`, no network, **no clock***.
- It keeps the number and the ordering **consistent**. A client-derived count desynchronises from
  the sort by construction: the order is fixed at fetch, the number recomputes on every render, so a
  row can read *"15 days"* while sitting exactly where 14 put it.
- It sidesteps sub-question 1's UTC trap outright. Every settlement timestamp is **local wall
  clock**; a client subtracting against a UTC `now` is out by up to three hours, which at midnight is
  a whole day. The server stamps and the server subtracts, so the two ends of the subtraction are
  always the same clock. (The server's own code already reasons this way —
  `SettlementAccountantService.cs:125-128`: *"Local wall-clock, per no-utc-time … a `UtcNow` cutoff
  here would read every consumption of the last three [hours]"*.)

The cost accepted: a browser left open overnight shows a **stale but coherent** number until the next
fetch. Coherent-and-stale beats fresh-and-disagreeing-with-the-sort.

### Calendar days, not 24-hour periods

`DATEDIFF(day, …)`. An entry posted yesterday at 23:00 reads **1 day** this morning, not 0. This is
the arithmetic a person does off the posted date printed in front of them (*"posted the first, it's
the fifteenth"*), and the age must agree with the date on the same row. Same-day is `0`, which
[281](281-the-open-settlements-view.md) renders as *today* rather than *"0 days"*.

### Sub-question 1, confirmed — with a wrinkle 277 should carry

`PreparedAt` is the right clock for cash waiting, and it is stamped `_clock.Now`
(`SettlementReceiptService.cs:90,106`) — the same local-wall-clock family, so one clock rule covers
all three tabs.

⚠️ **But the clock is not on the table the fleet flag reads.** `hasUncollectedReceipt` is computed off
`PosSettlementConsumption` — special-receipt consume, `DocumentNumber = ''`, no REVERSE naming the
same document (`SettlementAccountantService.cs:216-231`) — and that row has **no prepared timestamp
at all**; its only clock is `ConsumedAt`. The table that carries a chase row's whole sentence is
`PosSettlementDocument` (`SettlementDocumentEntity.cs`): `StoreId · SettlementEntryId · EntryNumber ·
Amount · PreparedByStaffId/Name · PreparedAt · DocumentNumber · Status`, where uncollected is
`Status == Prepared` (`SettlementCollectService.cs:147`, and `:367-374` shows collection stamping
`CollectedAt` + `Status = Collected`).

So [277](277-the-cash-waiting-doors-shape.md) inherits a **live choice of table**, not just a
projection: the document table is the one that can answer *how long* and *who prepared it*, and the
existing flag's predicate is the one that has been proven against production data. If 277 mints the
door off `PosSettlementDocument`, it must satisfy itself the two definitions of *uncollected* select
the same set — the server's own comment at `:213-219` flags that this meaning is already spelled
twice and warns *"if the meaning ever moves, it moves in both"*. This ruling does not settle that;
it only fixes that **whatever row 277 mints carries `preparedAt` + a server-computed `ageDays`.**

### What this hands the blocked tickets

- **[280](280-the-ageing-read-door.md)** — sorts `postedAt` ascending (equivalently `ageDays`
  descending), ties broken by `entryNumber` so the order is total; projects `postedAt` **and**
  `ageDays`; and now knows the index question is real, because `PostedAt` is unindexed and the sort
  sits inside a cap.
- **[281](281-the-open-settlements-view.md)** — a row asserts an age that never moves, shows
  `remaining of amount` beside it as the engagement fact, and renders `0` as *today*.

## Comments

**2026-08-15 — [277](277-the-cash-waiting-doors-shape.md) closed the choice of table, and half of
the wrinkle above is wrong.** `PosSettlementDocument` is a **store-side** table: head office only
learns of a document when the *collection* syncs (`CollectionSyncHandler:57-87` inserts it already
stamped `Collected`). Measured — `POS` holds `PREPARED 1 / COLLECTED 1`, `POS_Server` holds
`PREPARED 0 / COLLECTED 1` — so `Status == Prepared` selects the empty set at head office, and the
door stays on `PosSettlementConsumption`.

The ruling above is otherwise **strengthened**, not weakened: because *"the consume happens at
prepare, not at collect"* (`SettlementReceiptService`), the special-receipt CONSUME row's
`ConsumedAt` **is** the prepared-at moment, stamped `DateTime.Now` at head office. One clock rule,
three tabs, no exception. And the handle this ticket worried about comes from the join —
`SettlementEntryId → EntryNumber` — not from the document row.
