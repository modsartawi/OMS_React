---
status: done
spec: BackOffice 3173 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3173-oms-react-loyalty-groups-brief.md)
blocked-by: 630
---

# 631 — Deactivating a group asks for confirmation that names the live bonus-buys it will stop, and reactivating brings it back

## What to build

On the group page, a maintainer can **deactivate** an active group and **reactivate** an inactive one
(`POST LoyGroupWeb/Groups/SetActive { groupId, isActive }`). Deactivate opens a confirm that names every
live bonus-buy using the group (promo number + description, from `liveBonusBuys`) and says plainly when
there are none. Reactivate needs no list (the members are intact). The list and page refresh to the new
state.

There is **no delete**, anywhere — no button, no menu entry.

## Spine reach

api (`SetActive`) · logic (confirm content from the group) · component (confirm `Modal`) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `deactivate confirm names the live bonus-buys` — n bonus-buys → n named lines; none → the "stops no live offer" sentence · pure
- [x] `loy-groups activate drive` — deactivate shows the confirm and flips the badge; reactivate flips it back; no delete control exists; hidden on view-only · flow (extend `tools/loy-groups-drive.mjs`)

## Boundaries

Door BackOffice 3174 (`SetActive`, stubbed); the bonus-buy names come from 3179's `liveBonusBuys` (stubbed
non-empty in the drive). Promo numbers are machine values (`Ltr`), descriptions free text (`<bdi>`).

## Done when

On stubs, deactivate and reactivate work from the group page with the confirm listing bonus-buys, and the gates are green.

## Blocked by

[630](630-a-marketing-user-creates-a-group-with-an-upper-case-code-and-edits-its-names-and-the-code-never-changes.md)

## Comments

- 2026-10-28 — Done — built 2026-10-28 on spec/3173-loyalty-groups (worktree C:\Playground\oms-react-spec3173, unpushed), all envelopes stubbed; commit e5e80883.
- 2026-10-28 — Owner: Reactivate has no confirm; SetActive answer ignored (page re-reads); confirm button is the danger variant; EN+AR wording needs a native read.
- 2026-10-28 — Review fix 9c27d39c: when the detail omits `liveBonusBuys` the confirm uses the list entry, else says the offers could not be read (never "stops no live offer" without data).
