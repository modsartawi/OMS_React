---
status: open
spec: 147
blocked-by: —
---

# 152 — theCardRowRendersRightAtSixAndSevenCards

## What to build

A seventh report card, **"Activation done"**, counting the people who have **completed activation** —
the number the SAP→Ua cutover is actually measured on, and the one thing the six existing cards
cannot tell anyone.

It sits at **position 5**, immediately after *Awaiting activation*, so the pair reads as two ends of
one journey: how many still need chasing, how many are finished. Clicking it opens its worklist like
any other card. It carries **no tone**: on this row colour means *there is work here*, and this is
the one card whose rows need nothing done. The asymmetry with its accented neighbour is deliberate —
don't "fix" it.

**"Disabled" does not move and is not renamed.** The collision is the word *active*, so the fix is
never spending it; renaming Disabled was considered and declined, because it is the same word as the
status pill, the Status column, and the Disable/Re-enable actions.

**The card is conditionally present, and that is the interesting part.** The count is server-only —
it cannot be derived from the six existing numbers, which count over three different universes. Until
BackOffice 805 ships, the wire field is **absent**, and **an absent field means the card is not
rendered at all** — never `0`, never a dash, never a placeholder. A confident zero would read as "the
cutover hasn't started" and get repeated in a status meeting.

So the card row **stops being a fixed six-slot grid** and becomes an auto-fitting track — it must
look deliberate at **both 6 and 7 cards**, because the six-card state may be what production sees for
a while. This is a real state, not a temporary hack.

The card list itself moves out of the page into its own module, so "which cards are visible, given
these counts, in what order" becomes a pure function rather than an inline array inside a component.

**Do not add any check that the cards sum.** They already don't, for structural reasons that predate
this work: three universes, and `mustChange` alone skips the legacy-backed join and the
shared-account exclusion. This card overlaps *Disabled* on purpose — a leaver who activated still
counts, because the card is an odometer for how far the cutover got, not a headcount of current
staff (ticket [141](141-completed-activation-predicate.md)).

## Spine reach

model (the counts type gains an optional `completedActivation`) · logic (pure card-list module) ·
component (the card row's layout + conditional render) · i18n (`ua-admin`:
`cards.completedActivation` = "Activation done") · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `visibleCardsAtSixAndSeven` — counts without the field yield six cards in today's order;
      counts **with** it yield seven with *Activation done* fifth and *Disabled* still last; a
      `completedActivation` of `0` still renders (zero is a count, absence is not) · pure
- [ ] `theSeventhCardOpensItsWorklist` — drive against a stubbed envelope carrying the field: the
      card shows its count untoned, clicking it lists people and titles the grid with its label ·
      flow (Playwright, extends `tools/ua-users-scale-drive.mjs`)

## Boundaries

**Depends on BackOffice [805](file:///C:/Work/DMSCO/BackOffice/.issues/805-ua-completed-activation-count.md)**
for `completedActivation` on the counts result and the matching `ReportCards/completedActivation`
worklist case. Verified against a **stubbed envelope** until that ships — the same approach tickets
051/052 used while SIS.Api was unavailable. Independent of the pager, so it can run in parallel with
[148](148-ua-users-pager.md).

⚠ The card appears in production the moment 805 deploys, with no client release. That is by design;
it is also worth telling Ayed rather than letting it surprise him.

## Done when

With the field absent the screen shows six cards in a row that looks deliberate; with it present the
screen shows seven, *Activation done* fifth and untoned, and clicking it lists exactly the people it
counted.

## Open questions

None blocking. One caveat to carry into whatever release note this ships with: an admin password
reset moves someone **back out** of this count, so the number is monotonic *except for resets* — a
dip is a reset, not a bug.

## Blocked by

None — can start immediately.
