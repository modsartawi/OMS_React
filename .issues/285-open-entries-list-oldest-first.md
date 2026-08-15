---
status: done
spec: 282
blocked-by: 283
---

# 285 — The estate's open entries list oldest first, yours above everyone else's

## What to build

The screen at `/collection/settlement/open`, with its two entry tabs: **Owing** (SHORTAGE) and
**Owed** (SURPLUS). This is the spec's tracer bullet — one call, one pure projection, one grid, and
every state the screen can be in.

**One call feeds both tabs**, split by `entryKind` in the projection, so the two counts and the cap
banner all describe one answer and cannot disagree:

```
GET Settlement/Ledger?status=OPEN&sort=age&limit=2000
```

**The rows are the server's order, not the client's.** Oldest first, tie-broken by entry number so
the order is total. The projection **must not re-sort**: the answer is capped, and re-sorting a
capped page changes which rows the cap kept.

**Each tab draws two sections** — *Yours* above *Everyone else's*, each already oldest-first — and
the second section's header says what is inside it:

> **Everyone else's** · 824 · *oldest is 162 days — older than anything of yours (159 days)*

🚩 **That sentence is the point of the ticket, not decoration.** At estate scale 176 of 1,000 Owing
rows are the accountant's own, so mine-first ranking pushes the estate's oldest entry 176 rows below
the fold — the carve-out kept unassigned money *in* the answer and the arrangement was about to hide
it anyway. The comparison clause is claimed **only when it is true**.

**A row is one sentence you can say out loud:** entry number · branch name + code · the age as a
**fact** with its date beneath (`0` renders *today*) · what is **still open**, with `of amount` only
when the branch has part-paid · who serves the branch, or a worded *nobody assigned*.

🚩 **Nothing colours the age.** No red, no badge, no *overdue* — the domain has not ruled when an
entry is late, and a colour is a ruling. `npm run lint`'s colour-literal gate is load-bearing here.

**Five states, and the last two are the ones that get broken later:**

| state | what draws |
|---|---|
| rows | the two sections |
| nothing open | *Nothing owing.* / *Nothing owed.* — worded distinctly |
| emptied by the *mine only* chip | says so, and how to clear it — never "nothing owing" |
| cap reached | the banner, from `isCapReached` |
| **the door failed** | the refusal, and the tab counts render **—**, never `0` |

A new `OPEN_LANE_LIMIT = 2000` joins `cap.ts`; `LEDGER_LIMIT` **stays 500**, and the docblock says
why: this lane answers a *population* (1,394 open entries at seeded estate scale) where a cap below
it truncates a complete answer, while the Ledger view answers a *question* where reaching 500 means
the question is too broad to read.

The projection module is pure in `worklist.ts`'s mould — **no React, no `t()`, no network, no
clock** — and owns: the split by kind, the mine/theirs partition, the signpost, the *mine only*
filter, and keeping *empty* / *emptied-by-filter* / *failed* three distinct results.

## Spine reach

model (`core/models/settlement.ts` — the lane row, with `servedBy`/`isMine`/`ageDays` **optional**)
· api (`settlementApi.openLane`) · logic (the new pure projection + `cap.ts`) · component/route (the
screen + its columns at `/collection/settlement/open`) · i18n · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `lane: entries split by kind, each section oldest-first and totally ordered` — SHORTAGE and
      SURPLUS separate, the server's order preserved, ties broken by entry number · **pure**
      (`open-lane.test.ts`) — the tie is a fixture case (two rows at 140 days, one mine and one
      not), so *the projection never re-sorts* is asserted rather than assumed
- [x] `lane: the signpost claims the comparison only when it is true` — states the second section's
      oldest; adds *"older than anything of yours"* only when it is, and omits the clause otherwise ·
      **pure** — five cases, including 🚩 **the tie**: equal is *not* older, so the clause drops
- [x] `lane: empty, emptied-by-filter and failed are three different answers` — the assertion that
      stops a failed door rendering as good news · **pure** — plus *a door that answered nothing at
      all is empty, not failed*, and the counts staying the **estate's** under a filter
- [x] Drive `tools/settlement-drive.mjs` against an estate-scale fixture: both tabs render both
      sections with counts, the *mine only* chip narrows and its empty state is distinct, and a
      stubbed refusal draws the failure with **—** in the counts · **flow (Playwright)** —
      **245/245 PASS**; the new section also drives the tab as an address (`?tab=owed`, a
      hand-edited one landing on Owing, the scope surviving the switch), 🔑 **switching tabs
      costing no second call**, a row landing on its branch's account *on the entry it named*,
      **no colour/badge/overdue anywhere on the age**, and the **§6-absent** rendering — one
      unsectioned list, no chip, no derived age, and counts that are still real

**Also run:** `npm run typecheck` clean · `npm test` 1877/1877 (118 files) · `npm run lint`
(boundaries, contrast, colour literals) clean · `npm run build` green.

**One defect the drive found that reasoning had not:** the tab counts rendered **`0`** while the
read was in flight. Every argument the ticket makes about a failed door drawing `—` applies
unchanged to a pending one — *"Owing 0"* under a shimmer is the estate looking settled for as long
as the door takes to answer — so the pending case now renders the same em-dash, and the count
resolves *into* a number rather than out of one.

**`/code-review` (high) raised four; two were real and are fixed in this ticket.** The **open
lane went stale after every settlement write** — none of the three writers' invalidation lists
knew about it, so an entry cancelled a moment earlier stayed on the lane for a minute, inviting a
phone call about money nobody is owed; `invalidateSettlement` and the two bulk writers now name
it. And the screen **claimed an order it could not always have**: `sort=age` is half of the same
unbuilt §6 dependency as `ageDays`, so against today's door the answer is `EntryNumber DESC` while
the subtitle said *oldest first* and the cap banner said *"anything missing is newer than what is
here"* — which, past 2,000 rows, would be dropping exactly the entries the screen exists for. A
third `aged` flag joins `ranked` and `named`, and both sentences change rather than the order. Of
the other two: the branch account keeping the tab is answered by Back and by `KEPT` staying a
keep-list (logged); and `NavLink end` vs `isActive` on a trailing slash does **not** drift —
React Router's own `matchPath` tolerates it, checked rather than assumed.

**Eight decisions taken unattended, all logged in `.afk/HITL-285.md`.** The load-bearing ones: two
tabs and no placeholder third (286 owns Cash waiting and its door); `?tab=`'s key lives in
`addresses.ts` and its vocabulary in `open-lane.ts`, the split `ledger.ts` already has; the *mine
only* chip is component state, because story 39 names the scope and the tab and nothing else; and
the prototype's two money `<td>`s (the second with a blank header) became **one** *Still open*
column drawing the figure with `of X` beside it — same arrangement, no header-less column.

## Boundaries

**Server dependency §6** of `.afk/BACKOFFICE-TICKET-DRAFT-settlement-reads.md` (the ledger
extension) is **not built**. `servedBy`, `isMine` and `ageDays` are therefore **optional on the
wire**: without them the screen renders one unsectioned oldest-first list and derives nothing —
it does **not** fall back to a client-side clock or a guessed ranking. `sort=age` is sent regardless;
an unrecognised value is the server's to ignore. Envelope: the door refuses an unfiltered call with
`SettlementLedgerCriterionRequired`, which `status=OPEN` satisfies — but the failure state must
surface it by message rather than swallowing it. New keys in the existing `settlement` namespace.

## Done when

`/collection/settlement/open` lists the estate's open entries in two tabs, sectioned and counted,
against an estate-scale fixture; all three pure suites are green; and the failed-door rendering shows
the refusal with em-dashed counts.

## Blocked by

[283](283-settlement-views-answer-to-paths.md) — the screen needs its address. (Not blocked by
[284](284-settlement-account-expands-into-four-screens.md): the menu makes it *discoverable*, not
functional.)
