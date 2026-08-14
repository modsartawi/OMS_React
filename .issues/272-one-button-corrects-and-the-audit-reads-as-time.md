---
status: done
spec: 267
blocked-by: 269
---

# 272 — One button corrects an entry, and the audit reads as one column of time

## What to build

Two surfaces on 269's account, both about a mistake already made.

### The correction — one button whose meaning the entry decides

The rule is the server's; the **interaction** is this ticket's, and the answer is that the screen
**never offers both acts**:

| entry state | the one button |
|---|---|
| untouched (`OPEN`, remaining == amount) | **Cancel this entry** |
| partly consumed | **Write off the remaining 400.000**, with the reason it cannot be cancelled beside it |

A menu offering both is a menu on which someone eventually cancels a consumed entry.

Three things ship with it, all load-bearing:

1. **The journal stays on screen, unchanged, under the act.** What a write-off does *not* touch — a
   receipt already in a collector's hands is never retro-voided — is more convincing shown than
   asserted.
2. **"Changing the amount is not offered at all"** is said out loud beside the button, because its
   absence is otherwise indistinguishable from an oversight.
3. 🔑 **The cancel must handle losing the race.** The server's `remaining == amount` predicate sits
   **inside its UPDATE**, so a till that consumed a millisecond earlier wins. Come back with *"a till
   consumed part of this — here is the new remaining. Write off the rest instead?"* and the write-off
   in reach. **Never an error toast**: a refusal arrives as a 200 with `accepted: false` and a true
   remaining, and rendering it as a failure teaches the accountant to distrust a screen that is
   working correctly.

### The audit pane — the authz pane's shape, none of its storage

A projection of the entry and its consumptions into **one column of time**: posting, consumption,
void, repair and correction rendered as the same kind of fact.

- ⚠ **Store nothing in the authz audit table and read nothing from it.** Its timestamps are UTC,
  every settlement timestamp is local, and mixing them puts a three-hour lie beside a branch
  manager's own row in the same list. Borrow the layout only.
- **"From where"** renders the **store code** for a consumption (*which branch spent this* is a real
  audit question) and the **poster's name** for a posting. There is no address, no IP, and no
  `PostedFrom` field to bind — a browser IP on an internal app names a desk, not a person, and the
  person is already on the row.
- Reversals appear as **restorations**, consistent with 269.

## Spine reach

A mis-posted entry can be withdrawn or written off, and every act against a branch can be read in
order.

### What the build settled

**The one button is a union, not two predicates, and that is the whole of `correction.ts`.** There
is deliberately no `canCancel` and no `canWriteOff`: two predicates a caller could ask
independently are two predicates a caller can ask **both** of, and the menu this ticket exists to
keep at one item would be back. `correctionFor(entry)` returns `cancel | write-off | none`, the
component renders whatever comes back, and it never tests a status itself.

🔑 **The race recovery is the same rule applied to the server's newer truth**, not a patch on the
old one — `afterRefusedCancel` runs `correctionFor` again over the returned remaining. That is what
stops the two paths drifting: one definition of *which button*, and a raced entry gets it too. It
answers **three** outcomes rather than one, because three genuinely different things come back: the
ticket's `partly-consumed`; `nothing-left` (a till took **all** of it mid-dialog — there is no
write-off to offer, and offering one for zero would be an act with no effect); and `refused` (the
remaining did not move, so whatever the server objected to is not this race).

⚠️ **Equality is tested at the scale money is HELD at** (`roundMoney`, 3 dp), not at the branch's
display precision. A BHD entry consumed by one fils is a partly-consumed entry, and rounding that
away at 2 dp would offer *Cancel* on an entry the server will refuse to cancel — manufacturing this
ticket's own race for no reason. Pinned on 0688.

🚩 **The correction is a panel above the journal, not a modal** — diverging from 270's repair and
271's posting, both dialogs. The ticket makes *"the journal stays on screen, unchanged, under the
act"* load-bearing, and a dialog covering the journal could not show it. The divergence is the
ticket's own argument, logged in `.afk/HITL-272.md`.

**The audit pane takes the projected row, not an entry and a journal separately**, so the two panes
on this screen cannot be handed different journals and the write-off's figure is 269's `writtenOff`
— the journal's own last `remainingAfter`, read back — rather than a second derivation of it. Rule
3 holds: there is no subtraction anywhere in either new module.

🚩 **Two contract gaps transcribed rather than tidied**, both for 274: `Settlement/CloseOut` has no
`refusalReason` (so a refused write-off reads through the namespace's own sentence), and D8 carries
no closer **name** — only `closedByStaffId` — so *"from where"* renders a staff id there, the same
call 269 made for the journal's operator. A third: a **void and a repair are the same row** on this
contract (a `REVERSE` consumption), so both render as one honest fact and the document beside the
row is what distinguishes them.

⚠️ **The write-off confirmation names no figure.** D8 gives that answer one number called
`remainingAmount`, and on a *successful* close-out *what was forgiven* and *what is left* are both
readings of it — they differ by the whole amount, and asserting the wrong one would say *"0.00 of
entry 143 is written off"*. The forgiven figure is on screen a moment later regardless, off the
refetched audit pane, from a field 269 already reads back unambiguously.

## Proof

- [x] An untouched entry offers **only** Cancel; a partly-consumed one offers **only** the write-off,
      with its reason stated. — drive: 0688/152 (95.250 untouched) renders `data-correction="cancel"`,
      **one** act button, and the string *Write off* appears nowhere on the panel; 0142/151 (120.00
      of 320.00) renders *Write off the remaining 120.00*, no *Cancel this entry*, and the reason
      beside it names both figures. Both directions asserted on every case — a test that only checked
      the right button was present would pass on a union that had become two booleans.
- [x] Unit test on the correction decision — which single button, from status and remaining, across
      all four statuses. — `correction.test.ts`, **22 assertions**, every status against the
      fixture's own entries (0142/143 untouched, 0142/151 partly consumed, 0207/149 `CONSUMED`,
      0688/147 `CANCELLED`, 0688/133 `CLOSED_OUT`), plus the three *none* reasons asserted
      **distinct** — *where did the money go* is the question, and "closed" is not an answer to it.
- [x] 🔑 A cancel that loses the race renders the *"a till consumed part of this"* recovery with the
      **new remaining**, and the write-off completes from there. — drive: the stub has a till consume
      150 of 0142/143 a millisecond before the button lands and answers `accepted:false` with 350.
      The panel shows *"350.00 is left, not 500.00"*, **nothing on screen says the act failed**, the
      act button becomes *Write off the remaining 350.00*, and the close-out commits from there. 🚩
      The reason box comes back **empty**: *"posted onto the wrong branch"* is why someone wanted to
      cancel, not why they are writing off what a till took.
- [x] A `CANCELLED` and a `CLOSED_OUT` entry offer **no** correction button at all. — drive: both
      render zero act buttons and a sentence naming which ending it was; `CONSUMED` (0207/149) too.
      The no-amend sentence is asserted **on the stateless states**, which is where it does its work.
- [x] The journal is visible **during** the correction, and unchanged after a write-off. — drive:
      with the reason box open, the journal region is `isVisible()`, its row count is unchanged, and
      **`dialog` count is 0** — the act cannot be behind a modal. After the write-off commits, the
      row count is identical (1 → 1) and the entry reads *Remainder written off*.
- [x] The audit pane orders posting, consumption, void and repair by their own local timestamps, and
      renders the store code for consumptions and the poster's name for postings. — `audit.test.ts`
      (**18 assertions**) + drive: 0455 comes back
      `posted → consumed → consumed → restored → consumed` in timestamp order with the void 47
      minutes under the receipt it undoes; *from branch 0455* on consumptions, *by هدى القحطاني /
      Huda Al-Qahtani* on the posting, *by staff 30117* on the correction; **no IP anywhere**,
      asserted by regex; timestamps pass through **verbatim**, and the pane names which clock.
- [x] `typecheck` + `lint` green. — plus `npm test` **1730** (110 files), `npm run build`,
      `settlement-drive` **148/148** (extended from 271's 117, not replaced), 523 files
      boundary-clean, 117 contrast pairs, 528 files colour-clean.

**Two defects found by eyeballing the panes, not by any assertion** — the discipline 269 set. The
audit row's ` — ` separator sat **inside** the `dir="auto"` span, so an Arabic reason reordered the
whole run and the note collided with the poster's name (`…Al-Qahtani18-06-2026 عجز تسليم —`); and
the write-off row stated **no figure at all**, when *how much was forgiven* is the number a reader
opens the pane for.

**`/code-review` (high): five findings, four in this slice, all fixed.** The two that were real
defects rather than hardening: a refused cancel whose remaining had not moved **re-drew the
identical Cancel button** — the press-refuse-press loop `correction.ts` documents as forbidden, and
in the `nothing-left` case a live Cancel under the sentence *"there is nothing left to cancel"*;
and a `partly-consumed` offer **permanently overrode fresh account data**, so a write-off could
still be offered on an entry the refetch showed as settled (the offer now stands in for a stale row
and only for that). Plus: one field read two ways (see the write-off confirmation above), and a
refusal notice surviving a later **successful** correction of the same entry. The fifth is 270's
and is logged rather than fixed here — `CrossEstateLedger`'s filter draft does not re-sync on
Back/Forward **within** the ledger view.

**`/standards-review`: no hard violation on either axis; four things acted on.**

- 🚩 **The reason box was on its third copy and had already drifted** — post / repair / correct all
  carried the same limit and shape, but only the posting form's had `dir="auto"`, so an Arabic
  reason rendered right-to-left in one box and left-to-right in the other two on one screen. Now
  `ReasonField`, extracted **within the feature** (that rule's ladder, not a graduation to
  `@/core/ui` — no second feature wants it). The four-key invalidation fan-out went with it.
- 🚩 **The close-out's refusal was reasoned about inline with `-1` for "no figure"** while the
  cancel's got a tagged union in a tested module. It now has `afterRefusedCloseOut` and four tests —
  it was the one refusal path with nothing behind it.
- **The spec axis found the refusal handling stranded the accountant**: refusing to re-offer the act
  is right, but an entry that is still `OPEN` is still correctable and the only route back was
  selecting another row. A dismiss button restores the affordance from the refetched account. The
  ticket forbids *erroring* on a refusal; it does not forbid recovering.
- ⚠️ **`CONTEXT.md`'s Store entry still lists *branch* under *Avoid*** while spec 267 says branch in
  all 35 user stories. Kept, unchanged from 268–271, and **not re-decided in isolation** — 269
  logged it as a `/domain-modeling` job for the wave, and a fifth slice ruling on it alone is the
  drift that logging it was meant to prevent.

## Boundaries

- **No amend.** The amount is immutable; the screen states it and offers nothing.
- **No repair here** — the orphan repair lives on 270's wrong-money lane, where it is found.
- **No new audit storage.** The two tables are the audit.
- **No cross-kind variance**, per 269's third rule.

## Done when

Every entry state shows exactly one correction affordance or none, a lost race recovers into the
write-off instead of erroring, and the audit pane reads as one ordered column of local-time facts.

## Blocked by

[269](269-a-branchs-account-is-the-destination.md).

## Open questions

None.
