---
status: done
spec: 282
blocked-by: 285
---

# 287 — Chasing a branch is recorded from the row, and its absence is not a claim

## What to build

The accountant rings a branch and records what was said — **from the row, without leaving the list**,
because a session of twenty calls must not become twenty navigations.

**The column.** *Last chased* shows the newest note (`Fri · promised Sunday` over the caller's name).
It rides on the lane rows themselves, so no row fetches anything.

🔑 **The cell is a tri-state, and keeping the three cases apart is the whole ticket:**

```ts
type ChaseCell =
  | { kind: 'unavailable' }               // field absent → the column is not rendered AT ALL
  | { kind: 'never' }                     // null → "Never chased", a named state
  | { kind: 'chased'; at: string; by: string; note: string }
```

Collapsing `unavailable` into `never` would state, confidently, that nobody has chased any of 1,394
branches. The projection returns the **case**; the renderer takes a case and cannot produce a blank
cell. This is 269's rule 1 applied one layer up.

**The act.** A dialog opened from the row: the branch it is about, who to ring, the newest existing
note for context, and a free-text box. Saving posts:

```
POST Settlement/Chase { storeId, subject, subjectId, entryNumber, note } → { accepted, chase }
```

A note belongs to the **branch** and optionally names what it was about (`subject` is
`BRANCH | ENTRY | RECEIPT`) — one phone call about four open entries is **one** note, not the same
sentence typed four times, but *"they promised to pay entry 143 on Sunday"* still has somewhere
precise to live. From a Cash waiting row the subject is the receipt: same table, same act,
different person on the phone.

**Append-only, and the UI says so rather than enforcing it silently:** no edit, no delete, no
supersede. A typo is corrected by adding another note.

⚠️ **The text is internal**, and the field says so at the point of entry — not in a tooltip. Every
other free text on this screen (an entry's reason, a cancellation's, a correction's) is quoted back
to the branch verbatim; this one is an accountant's memo for colleagues. Saying it in the UI is what
stops someone later putting it in front of a store manager.

**The chip.** *Never chased* joins *mine only* in the toolbar, and is hidden entirely when the column
is `unavailable` — a filter over a fact the screen does not have is a lie about what it filtered.

## Spine reach

model (the chase row + the optional lane field) · api (`settlementApi.chase`) · logic (the tri-state
in the projection + the filter) · component (the column + the dialog) · i18n · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `lane: an absent chase field is not a claim that nobody was chased` — `unavailable` hides the
      column and the chip; `null` renders *never chased*; a note renders the note. Three cases, three
      results · **pure** (`open-lane.test.ts`) — the three cases are asserted on `chaseCell` itself
      and again through `buildOpenLane`/`buildCashLane`'s `chased` flag, plus the case that is easy
      to lose: **a door answering `null` for every row has ANSWERED**, so the column is drawn and
      says *never chased* rather than disappearing. Also at estate scale, where the claim is about
      **branches**: every row of one branch carries the same note, and the receipts door tells the
      same story about that branch as the ledger does
- [x] `lane: the never-chased filter is offered only when the answer knows` — the chip is absent
      under `unavailable`, and narrows to `never` rows otherwise · **pure** — and the case 286's
      review found one layer down: a tab whose answer never mentioned a chase **ignores** the chip
      rather than emptying, because the filter is one piece of state across three tabs while
      *whether it can be offered* is a per-tab fact. Composes with *mine only* (two narrowings of one
      list) and reaches *emptied by my own filter*, never *nothing owing*
- [x] Drive `tools/settlement-drive.mjs`: a note saved from a row changes that row's cell from *never
      chased* to the note without a reload, a refusal (`accepted:false`) surfaces its message and
      leaves the row unchanged, and a fixture without the field renders no column at all ·
      **flow (Playwright)** — **287/287 PASS**; the section also drives the body posted (the
      **branch**, with `subject: ENTRY` and the entry's own id), the row reading back the **server's**
      name and stamp with **0 refetches**, the never-chased chip re-narrowing off that written
      answer, the refusal leaving the dialog open **with the sentence still in it**, the §7-absent
      rendering on **both** the entry tabs and cash (no column, no chip, no button, and nothing
      saying *never chased*), and a chase from a waiting receipt naming `subject: RECEIPT` with the
      document id while still quoting the same entry number

**Also run:** `npm run typecheck` clean · `npm test` 1906/1906 (118 files) · `npm run lint`
(boundaries, contrast, colour literals) clean · `npm run build` green.

## Boundaries

**Server dependency §7** of `.afk/BACKOFFICE-TICKET-DRAFT-settlement-reads.md` — the table and the
write door are **not built**, and this is the one slice that needs a new table anywhere in the wave.
It is deliberately last and deliberately isolated: [285](285-open-entries-list-oldest-first.md) and
[286](286-prepared-receipt-shows-how-long-it-waited.md) ship as complete read-only lanes without it.
Envelope: refusals arrive as **200 with `accepted:false`** (unknown branch, blank note, over-length,
unrecognised subject) — this screen's established idiom, not an error. Grant is the **existing**
settlement screen grant; no new grant is minted or checked. New keys in the existing `settlement`
namespace, including the internal-only hint.

## Done when

A chase recorded from a row shows on that row without a reload; the three `ChaseCell` cases each
render their own way; and a fixture with the field absent renders the lane with no *Last chased*
column and no *never chased* chip.

## As built (2026-08-15)

`ChaseCell` and the whole tri-state live in `open-lane.ts` beside the arrangement — the projection
returns the **case**, and `chaseColumn` returns an **empty array** rather than a hidden column when
the answer never mentioned a chase, so `unavailable` cannot reach a renderer at all.

🚩 **The optimistic write is `applyChase`, and it is by BRANCH.** An accepted note is laid onto every
row of that branch in **both** query caches (the ledger's and the receipts'), from the **server's**
returned `chase` — its stamp, its name — rather than invalidating: a session of twenty calls would
otherwise re-read 2,000 entries twenty times, which is the navigation cost this dialog exists to
remove, moved onto the network. What is written is exactly what a refetch would have returned, since
the door's own read projection is *newest note per branch*. ⚠️ An answer that never carried the field
is returned **untouched, identity and all** — writing into it would MINT the column, and with it
*never chased* against every other branch in the estate off one accepted write.

⚠️ **`e.stopPropagation()` in the button does NOT stop the row navigating**, and this was found by
driving rather than by reasoning: AG Grid listens on the row element, nearer the click target than
React's delegated root listener, so the first drive of *Record a chase* landed on the branch account.
The exemption is made where the row click is decided (`onRowClicked` skips a target inside
`[data-row-action]`), because the row is what owns that click.

`ReasonField` gained an optional `maxLength` (the three reason boxes still share `REASON_MAX`; a
chase note stops where its own `varchar(400)` does), and `SettlementChaseResult.refusalReason` is
**optional** — contract 278 does not name it, so it is read when sent and the namespace's own
sentence stands underneath. Both logged in `.afk/HITL-287.md` with five other decisions.

**Reviews.** `/code-review` found one real defect, fixed here: the entry tabs' *Show the whole
estate* button still cleared only *Mine only*, so a list emptied by the new chip stayed empty when
the reader pressed the one named way out — the drive now asserts both chips release. Its other
observations (the tri-state guards, the optimistic write, the `[data-row-action]` exemption) were
checked and cleared.

`/standards-review` reported **no hard standards violation**, and both axes were acted on:

- 🚩 **the spec axis found a real one** — `ChaseDialog` branched on `servedBy`'s truthiness, so with
  §6 unbuilt it stated *"nobody is assigned to this branch"* about a door that had said **nothing**:
  this ticket's own rule made about the neighbouring field. It is three cases now (absent → silent,
  `''` → *nobody assigned*, else *ring X*), driven under `laneBare`;
- `chaseWords` assembled the filter/export text by concatenation and now interpolates a key;
- 🔑 **the lane's query keys are spelled once** (`OPEN_LANE_KEY` / `CASH_LANE_KEY`) across all six
  files that read or invalidate them — this ticket made it the eighth spelling, and the seventh was
  the exact shape of 288's own finding, where a renamed key left a lane serving cache for a minute
  with nothing failing anywhere.

Two findings were **declined with reasons** in the HITL log: the cell stacks the button inline rather
than under the note (the prototype's row is three lines tall; 285 shipped a two-line 44px row), and
*Never chased* keeps its state on a tab whose door is silent rather than being cleared (286's own
ruling for *Mine only*: ignore a filter the answer cannot support, never quietly undo the reader).

## Blocked by

[285](285-open-entries-list-oldest-first.md) — the rows, the projection and the dialog's host screen.
