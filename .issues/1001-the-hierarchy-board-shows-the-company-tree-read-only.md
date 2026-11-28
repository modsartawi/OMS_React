---
status: open
spec: BackOffice 4456
blocked-by: BackOffice 4468
---

# 1001 — The hierarchy board shows the company tree, read-only

Spec: BackOffice `.issues/4456-the-store-hierarchy-and-the-duty-roster-are-kept-in-backoffice-and-fill-omss-storearea-and-storeduty-spec.md`.

## What to build

Organisation › Hierarchy board, after prototype `BackOffice/.issues/assets/4408-hierarchy-board-prototype.html`
(layout 1; a reference, not ported line for line). EN and AR on every label, RTL mirrors (the tree indents from
the right), dark mode on tokens; desk width the target, on a phone the tree with cards below.

- The Operations tree with store cards: holder, store count, vacancy, acting person, deputies, "move planned".
- Right panel tabs: Unplaced (count), Planned, People (Holder has left / Seated without a login once BackOffice 4473
  lands).
- Line switcher (OPX / Pro lists + marks once 4471 lands); store side sheet (place, class, log, "Duty: today's
  hours ›").
- Search drop-down grouped stores / people / positions; as-of toolbar date.
- A manager sees everything read-only, a banner, a "yours" mark; actions shown disabled, not hidden.

## Spine reach

UI (oms-react) → SIS.Api endpoints of the BackOffice tickets it is blocked by

## Proof (→ `tdd` red-green cycles)

- [ ] `BoardTree_RendersPositionsAndCards` · vitest
- [ ] `ManagerMode_ActionsDisabledNotHidden` · vitest
- [ ] `Rtl_TreeIndentsFromTheRight` · vitest
- [ ] `Search_GroupsResults` · vitest
- [ ] HITL: walked against a BackOffice host in English and Arabic, light and dark

## Boundaries

Reachable only through the `Organisation` view grant.

## Done when

Proof green; board walks against a BackOffice test host.

## Blocked by

BackOffice 4468
