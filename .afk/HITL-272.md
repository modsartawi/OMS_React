# HITL — ticket 272 (one button corrects, and the audit reads as one column of time)

Decisions taken unattended, with what would make each one wrong. Wire extensions and
contract gaps are 274's to settle against a live SIS.Api.

## Q: `Settlement/CloseOut` has no `refusalReason` on D8, unlike cancel and repair. Add one?

**Decision taken:** No. `SettlementCloseOutResult` is transcribed exactly as D8 gives it
(`{ accepted, remainingAmount }`), and a refused close-out reads through the namespace's own
sentence (`correction.raced.closeOutRefused`), which names the server's returned remaining.

**Why:** Inventing a third field is this screen assuming a wire it has not seen; the asymmetry is
more likely to be the real contract than a typo, since cancel's refusal is the *designed* path and
close-out's is not.

**Revisit if:** 274 finds the door does answer a reason — then the sentence becomes a fallback and
the server's words lead, as they do for cancel and repair.

## Q: The audit pane needs "who corrected this", but the wire carries `closedByStaffId` and no name.

**Decision taken:** Render the staff id, as `Where`'s third case (`by staff 30117`). No resolution,
no lookup, no invented name.

**Why:** D8 denormalises `postedByName` at post time deliberately (an audit fact under the name
they had then) and does not do the same for the closer. 269 hit the identical gap on the journal's
`consumedByOperatorId` and made the identical call. A screen that resolved a name here would be
reading a field the contract does not have.

**Revisit if:** 274's live door carries a `closedByName`, or BackOffice 1173 adds one — the pane
should then show the name and the asymmetry disappears.

## Q: On D8's contract a **void** and a **repair** are the same row — a `REVERSE` consumption. Distinguish them?

**Decision taken:** No. Both render as one fact, `restored` (*Given back*), and the **document
beside the row** is what tells a reader which act it was: a void names the receipt it undoes, a
repaired orphan has none to name.

**Why:** There is no field on `SettlementConsumption` that separates them, and guessing from an
empty `documentId` would be a rule nobody wrote down. The ticket asks for these acts *"rendered as
the same kind of fact"*, so the honest projection is also the specified one.

**Revisit if:** the server stamps a repair distinctly (a `consumptionKind` of its own, or a reason
column) — then the pane can name the act rather than the movement.

## Q: Modal or inline panel for the correction?

**Decision taken:** An **inline panel above the journal** (`data-region="entry-correction"`), not a
`Modal` — unlike 270's repair and 271's posting, which are both dialogs.

**Why:** The ticket makes *"the journal stays on screen, unchanged, under the act"* load-bearing,
and a dialog that dimmed or covered the journal could not show what a write-off does not touch. The
divergence from the two neighbouring writes is deliberate and is the ticket's own argument.

**Revisit if:** the panel is later reached from somewhere with no journal beneath it (a worklist
lane, the cross-estate ledger) — it would need the journal to travel with it, or to become a dialog
that carries one.

## Q: What does an `OPEN` entry with `remainingAmount == 0` offer?

**Decision taken:** Nothing (`{kind:'none', because:'nothing-left'}`), and the same for a cancel
refused with a returned remaining of 0.

**Why:** A write-off of zero is an act with no effect whose audit row would say an accountant
forgave nothing. The state is a server inconsistency (the consume that emptied it should have set
`CONSUMED`), and the screen should not paper over it with a button.

**Revisit if:** the server turns out to leave entries `OPEN` at zero routinely — then the sentence
should say so rather than reading as an edge case.

## Q: Is the cancel/write-off equality tested at the branch's display precision or at the money scale?

**Decision taken:** At **`MONEY_SCALE`** (3 decimals, `roundMoney`), not at `currencyDecimals`.

**Why:** A BHD entry consumed by one fils is a partly-consumed entry. Rounding that away at the
branch's display precision would offer *Cancel* on an entry the server will refuse to cancel —
manufacturing this ticket's own race for no reason. Pinned by a test on 0688.

**Revisit if:** the server's own predicate turns out to compare at a different scale — the two must
agree, and the server's wins.

## Q: What does `remainingAmount` mean on a **successful** `Settlement/CloseOut`?

**Decision taken:** Nothing is assumed. The success toast names **no figure** — *"Entry 143's
remainder is written off. What a till already took is unchanged."* The refusal path still reads the
field, where its meaning is unambiguous (nothing was forgiven, so it can only be what is left).

**Why:** `/code-review` found the first draft reading one field two ways: *what was forgiven* in the
toast and *what is left* in the refusal notice. They differ by the whole amount, so one reading was
necessarily wrong — a server meaning the second would have made the toast say *"0.00 of entry 143 is
written off"*. The forgiven figure is on screen a moment later regardless: the refetched audit pane
draws `writtenOff`, which 269 already reads back unambiguously.

**Revisit if:** 274 confirms the field's meaning — then the toast can name the figure again, from the
answer rather than from the form.

## Q: `/standards-review` — should the reason box and the invalidation fan-out be extracted?

**Decision taken:** Yes, both, into `ReasonField.tsx` — and it stays **inside the feature** rather
than graduating to `@/core/ui`.

**Why:** Third copy each (post / repair / correct), which is this repo's documented escalation
trigger rather than a judgement call taken fresh — and the drift had already started: all three
reason boxes carried the same `maxLength` and shape, but only the posting form's had `dir="auto"`,
so an Arabic reason laid out right-to-left in one box and left-to-right in the other two, on one
screen. `feature-structure`'s ladder is *copy → extract within the feature → graduate on a second
feature wanting it*, and no other feature wants either.

**Revisit if:** a second feature needs the same control — then it graduates, on the road
`ScreenGate`, `distinctCurrencies` and `roundMoney` each took.

## Q: `/standards-review` — the close-out refusal was reasoned about inline, with `-1` for "no figure".

**Decision taken:** Given its own tagged union (`CloseOutRefusal`) and `afterRefusedCloseOut` in the
pure module, with four tests.

**Why:** The cancel's refusal got a union in a tested module while the close-out's was a magic
number in a component, on a panel where every other number is money. Two refusal paths reasoned
about two different ways is how the second one ends up wrong and unnoticed — and it was the one
refusal path with no test behind it.

## Q: `/standards-review` — `CONTEXT.md`'s Store entry lists *branch* under **Avoid**, and this slice's copy uses it throughout.

**Decision taken:** Kept **branch** in the copy, unchanged from 268–271. Not resolved unilaterally.

**Why:** Spec 267 says *branch* in all 35 user stories, D9 rules this screen speaks the branch's own
language, and every identifier crossing the API boundary is still `storeId`. 269 already logged this
as a `/domain-modeling` job for the wave; a fifth slice re-deciding it in isolation is exactly the
drift that logging it was meant to prevent.

**Revisit if:** `/domain-modeling` rules for *store* — then the rename happens in one act across
269–273, before 274, rather than slice by slice.

## Q: `/code-review` + `/standards-review` — two defects in the refusal handling.

**Decision taken:** Both fixed, and both now have a drive check.

1. **A refused cancel re-drew the identical Cancel button** (and, in the `nothing-left` case, a live
   Cancel under the sentence *"there is nothing left to cancel"*) — the press-refuse-press loop
   `correction.ts` documents as forbidden. The panel now offers nothing while a notice is up.
2. **…and then stranded the accountant**, since an entry that is still `OPEN` is still correctable
   and the only route back was selecting another row and returning. A **Read it — show me what I can
   do** button clears the notice and the affordance recomputes from the account refetched
   underneath. The ticket forbids *erroring* on a refusal; it does not forbid recovering.
3. **The cancel's reason rode into the write-off.** *"Posted onto the wrong branch"* is why someone
   wanted to cancel; it is not why they are writing off what a till already took. The box is cleared
   when a refusal lands, so the act that actually happens files words somebody chose for it.

## Findings raised outside this ticket's scope, left for triage

- 🚩 **`CrossEstateLedger.tsx:63` (ticket 270)** — the filter `draft` is seeded from the URL once and
  never re-synced, so Back/Forward **within** the ledger view leaves the form showing criteria that
  do not match the grid. Real, and not this slice's: the drive's own *"Back out of an account
  restores the ledger's filter"* check passes because that path remounts. Raised by
  `/code-review`; belongs to 270.
- ⚠️ **The drive's `search()` helper is timing-flaky.** Its 150 ms settle after typing failed twice
  on one run (*search by CITY*, *a broad query is capped*) and passed on the next. Not caused by
  this slice, and not fixed here — but 273 and 274 both extend this file, and a proof tool that goes
  red at random is a proof tool people stop believing. One line, whenever someone is in there.

## 🚩 Wire extensions this slice made — none

Both doors are D8's, unchanged: `POST Settlement/Cancel { settlementEntryId, reason }` →
`{ accepted, refusalReason, remainingAmount }` and `POST Settlement/CloseOut { settlementEntryId,
reason }` → `{ accepted, remainingAmount }`. Route strings and casing remain **274's to confirm**,
as with every door in this wave.
