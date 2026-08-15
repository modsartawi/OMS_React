---
type: wayfinder-map
status: open
---

# 275 — Settlement follow-up lanes: entry ageing + cash waiting

## Destination

One `status: ready` spec, consumable by `/to-tickets`: **the accountant's follow-up surface on
`/collection/settlement`** — the screen that answers *"who has not sent the money, how long has it
been, and who do I ring"*, covering both lanes ticket
[274](274-the-screen-calls-the-real-door.md) left without a door: **entry ageing** (`.afk/FINDINGS-274.md`
§B3) and **cash waiting / uncollected receipts** (§B2).

Reached when that spec is `ready` and no decision blocks the build. The BackOffice doors it needs
leave this map as a **hand-off draft** in the shape `.afk/BACKOFFICE-TICKET-DRAFT-settlement-reads.md`
already established — this repo is read-only on that side.

## Notes

**Domain:** `CONTEXT.md`'s — settlement entry, SHORTAGE (عجز) / SURPLUS (فائض), consumption, special
receipt, shift close, branch. The feature is `src/features/collection/settlement/` (spec
[267](267-settlement-account-web-spec.md), tickets 268–274).

**Skills every session should consult:** `/grilling` and `/domain-modeling` by default;
`/prototype` for the view's arrangement; `/research` where a server contract must be read rather
than guessed. The server source is
`C:\Work\DMSCO\BackOffice\Sartawi.Retail.Data\Modules\Pos\Services\Settlement\SettlementAccountantService.cs`
— **read it before designing a door**; every finding below came from it, not from a spec.

**Prior art to read, not to repeat.** [274](274-the-screen-calls-the-real-door.md) is the parent
event: it pointed the screen at a live SIS.Api and **deleted** both of these lanes rather than fake
them. Its reasoning is sound and this map does not overturn it — it removes the blocker 274 could
not. Read `.afk/FINDINGS-274.md` §B2/§B3/§B4 before any ticket here.

**Owner rulings already taken (charting session, 2026-08-15)** — premises, not open:

- **No threshold, and this is the ruling that unblocks the map.** The ageing lane states elapsed
  time as a **fact** ("open 14 days"), sorted oldest-first. No *overdue*, no red, no count against a
  rule. BackOffice spec 1173 declines to say when an entry goes stale (*"whether an entry goes stale
  is fog, and there is no notification rail behind it by design"*) — and 270's lane was unbuildable
  because it needed a number that ruling refused to mint. 🔑 **A lane that shows age without judging
  it needs no threshold at all**, so 1173's ruling stands untouched and the lane ships anyway.
  Escalation policy becomes a separable, later question.
- **One follow-up screen at `/collection/settlement/open`**, three tabs: **Owing** (SHORTAGE) ·
  **Owed** (SURPLUS) · **Cash waiting** (uncollected receipts). Not lanes on the triage front page:
  the prototype proved that shape fails (`worklist.ts:8-16` — ~140 cards at estate scale, **131
  merely ageing**, burying the four that were actually wrong). Chasing is a *work session*; triage is
  a glance. They get different screens.
- **Both kinds, visibly split.** SHORTAGE open-and-old = the branch has not paid. SURPLUS
  open-and-old = the branch has not *claimed* what the estate owes it. Same age fact, **opposite
  direction**, never one sorted list — hence two tabs rather than a kind column.
- **Estate-wide, ranked mine-first.** The carve-out spec 267 holds for wrong money and cash waiting
  extends to ageing: 1255 of 1394 branches are assigned to nobody and their late money must not fall
  out of the door. Rows carry `ServedBy` + session-resolved `IsMine` — the labelling
  `Settlement/Branches` **already computes** (`SettlementAccountantService.cs:916-933`) — so the list
  ranks *yours first*, and the `ServedBy` name doubles as **who to ring**. This closes §B4's gap for
  these doors.
- **A chase record is in scope, minimally.** Append-only: who chased, when, free text. **No
  statuses, no assignment, no due dates, no escalation states.** Its BackOffice dependency is
  isolated in one ticket so the two read-only lanes ship whether or not it lands.
- **The nav grows a third level and the views become paths.** `Settlement Account` becomes an
  expandable node under Collections with four leaves — Overview (the parent's own link) ·
  **Open settlements** · **Ledger** · **Bulk upload**. This is a *shell* change: `MenuGroup`
  (`src/layout/AppShell.tsx:55`) maps children straight to `MenuLeaf` with no recursion, so three
  levels cannot render today. And `isActive` (`src/layout/menu-model.ts:503`) matches **pathname
  only** — its own docstring says *"query/hash already stripped by caller"* — so the `?view=` idiom
  270 built can never highlight distinct submenu entries. The views therefore become path segments.

**Inherited dependency, not this map's to resolve:** `currencyKey` on the account and fleet reads —
§1 of `.afk/BACKOFFICE-TICKET-DRAFT-settlement-reads.md`, still outstanding. These lanes display
money and inherit the same min-2/max-3 rendering compromise. Do not solve it here; do not design
around it either.

## Decisions so far

<!-- the index — one line per resolved ticket -->

- [What an entry's age is measured from](276-what-an-entrys-age-is-measured-from.md) — from
  **`postedAt`**, never the last movement (so a dribbling branch cannot stay young, and the REVERSE
  question dissolves); the **server** subtracts it in **calendar days** and sends `ageDays` beside the
  timestamp, so the client keeps `worklist.ts`'s no-clock stance and the number never disagrees with
  the sort. Cash waiting takes the identical treatment from `PreparedAt` — but the clock is **not** on
  the table the fleet flag reads, which hands 277 a live choice of table.
- [The cash-waiting door's shape](277-the-cash-waiting-doors-shape.md) — the door stays on
  **`PosSettlementConsumption`**, because 🚩 `PosSettlementDocument` is **store-side**: head office
  only inserts it at *collection*, so `Status == Prepared` selects the empty set there (measured —
  store `PREPARED 1`, server `PREPARED 0`). 276's clock survives intact, and better: *the consume
  happens at prepare*, so the CONSUME row's `ConsumedAt` **is** `preparedAt`, on head office's own
  clock. The handle is **`entryNumber`** via the entry join (driven live: entry 1407), so the
  words-not-a-blank-cell fallback is not needed and `documentNumber` is dropped. No index asked for;
  the predicate is lifted beside `OrphanPredicate` so it is spelled once, not thrice.
- [The chase note's contract](278-the-chase-notes-contract.md) — **per branch, optionally naming
  the entry or receipt it was about** (one discriminator + one id); cash waiting shares the table
  under `Subject = RECEIPT`; strictly **append-only** (a typo is corrected by adding a note) and
  explicitly **internal** — the first free text here a branch never reads; `ChasedAt` is local wall
  clock, matching what it renders beside. The newest note rides on the lane rows via `OUTER APPLY`,
  no N+1. 🔑 The wire is a **tri-state** — field absent (door not built) → no column; `null` →
  *Never chased*; else the note — which is what lets the read-only lanes ship regardless.
- [The nav grows a third level](279-the-nav-grows-a-third-level.md) — **one** extra level via a
  bounded `MenuSubGroup` (🔑 `useVisibleMenu` is **already recursive**, so fail-closed filtering
  needs no change — the blast radius is the renderer alone). Four paths under
  `/collection/settlement`: Overview · `/open` · `/ledger` · `/upload`; `view=` retires while
  `?scope=`, `?store=`, `?entry=`, `?batch=` and the ledger's criteria stay parameters — so 269's
  and 273's shared addresses keep working. `?view=` **redirects permanently**. Needs one new
  `exact` flag on the menu model, or Overview highlights on all four paths.
- [The ageing read door](280-the-ageing-read-door.md) — **extend `Settlement/Ledger`, do not mint a
  lane**: `Status='OPEN'` is a column-equals-constant, not a money predicate, so `OrphanPredicate`'s
  drift lesson does not reach it. It grows `servedBy`/`isMine`, `ageDays`, optional `lastChase` and
  `sort=age` (`PostedAt, EntryNumber` — total, satisfying 1199 §3's own reasoning). 🚩 Measured: the
  unindexed-`PostedAt` sort costs **17 ms cold / 2 ms warm** at 1,407 rows, so **no index is asked
  for** — the real risk was the cap, and the lane calls at **2,000** (`OPEN_LANE_LIMIT`) while
  `LEDGER_LIMIT` stays 500. One call for both tabs, split client-side, so the counts cannot disagree.
- [The Open settlements view](281-the-open-settlements-view.md) — prototyped at estate scale
  (`.afk/PROTO-281-open-settlements.html`), and the fixture found two things reasoning had not:
  🚩 mine-first ranking buries the estate's oldest **176 rows down**, fixed by two sections whose
  second header *states its own oldest against yours*; and `remaining of amount` was the same number
  twice on 65% of rows, so `of …` now draws only when part-paid. Sort is **age alone** (mine and
  never-chased are a section and a chip); counts are **rows**, and a failed door renders **—** plus
  the refusal, never `0`. AG Grid with a taller row; four empty states plus failure as a fifth.

✅ **Route complete, 2026-08-15** — all six tickets (276–281) are resolved and nothing on the way to
the destination is left undecided. The map stays `open` only because the destination is a `ready`
spec and that spec is not written yet: **the next step is `/to-spec`**, then `/to-tickets`. The
BackOffice asks leave as the hand-off draft's §2 (rewritten), §6 (new) and §7 (the chase table).

## Not yet specified

- **Whether a prepared receipt's store-side detail should reach head office at all.** 277 found the
  document row (`PreparedByName`, `Note`, `PreparedAt`, `Status`) exists only at the store until
  collection — so head office knows a receipt is waiting, its amount, its entry and its age, but not
  who prepared it or what note was written on it. Nothing on this map needs those, and a sync change
  is a POS-side effort with its own risk. It becomes a question only if an accountant asks *"who
  wrote this receipt?"* often enough to matter.
- **Escalation beyond a note.** Once accountants have chased on a real screen, what a *second* chase
  needs — a promised-by date, an escalation to the store manager as a distinct act, a way to see
  branches chased twice with no movement. Deliberately unticketed: the shape is learnt by watching
  the minimal note get used, not by designing it now.
- **Whether a threshold is ever ruled.** If finance later mints one, it lands as a badge over an
  existing lane rather than a new lane. Graduates only if 1173 re-opens entry staleness.
- **Taking the list off the screen.** Exporting a chase list for a meeting, or into whatever finance
  already uses. 258 has a bespoke CSV writer in this repo; whether that is the right rail here is
  unexamined.
- **Whether `PosCollectionAttempt` feeds cash waiting.** The table exists (`AttemptId /
  CollectorStaffId / StoreCode / ShiftId / BusinessDay / AttemptTime / ReasonCode / ReasonText`) and
  is **empty**. It records a *collector's* failed visit against a shift, not an accountant's chase
  against an entry — so it is not reusable as the chase record. But a receipt waiting because the
  collector **tried and could not** is a different sentence from one nobody has been to, and this
  table is where that fact would live.
- **Whether a branch account shows its chase notes.** The account screen (269) is the destination a
  chase lands on. Whether the notes follow the entry there is a question for after the note exists.

## Out of scope

- **A full follow-up workflow** — statuses (chased / promised / escalated / resolved), assignment,
  due-back dates. Ruled out at charting: it is a second map's worth of work with policy decisions
  inside it, and the minimal note is what tells us which of them are real.
- **A per-branch settlement cadence table.** Ruled out at charting alongside the no-threshold
  decision. Confirmed by inspection that nothing of the sort exists today — `PosCollectionAssignment`
  is `StoreCode / AccountantId / CollectorId / UpdatedBy / UpdatedAt` and carries no frequency, due
  day or SLA; the only grace period in the POS module is an unrelated `RecallGraceDays = 7`. A new
  table plus migration plus an admin screen to maintain it is a separate effort, and it is only worth
  having once someone has ruled that "late" varies by branch.
- **Any notification or reminder rail.** BackOffice spec 1173 rules there is none *by design*. This
  map surfaces work on a screen an accountant opens; it does not push.
