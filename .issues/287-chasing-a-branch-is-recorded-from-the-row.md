---
status: open
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

- [ ] `lane: an absent chase field is not a claim that nobody was chased` — `unavailable` hides the
      column and the chip; `null` renders *never chased*; a note renders the note. Three cases, three
      results · **pure**
- [ ] `lane: the never-chased filter is offered only when the answer knows` — the chip is absent
      under `unavailable`, and narrows to `never` rows otherwise · **pure**
- [ ] Drive `tools/settlement-drive.mjs`: a note saved from a row changes that row's cell from *never
      chased* to the note without a reload, a refusal (`accepted:false`) surfaces its message and
      leaves the row unchanged, and a fixture without the field renders no column at all ·
      **flow (Playwright)**

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

## Blocked by

[285](285-open-entries-list-oldest-first.md) — the rows, the projection and the dialog's host screen.
