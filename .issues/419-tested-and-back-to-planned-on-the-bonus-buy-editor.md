---
status: open
spec: C:/Work/DMSCO/BackOffice/.issues/2396-an-oms-bonus-buy-is-tested-before-it-goes-live-and-authoring-scales-to-real-campaigns-spec.md
blocked-by: 417
---

# 419 — The editor and overview show Tested, offer Mark Tested, and take a bonus buy back to Planned

**Source:** BackOffice spec 2396 and ADR 0063. **Standing preference:** like SAP wins.

## What to build

- Status `3` reads **Tested** everywhere a status is shown: overview rows, the editor header, and the `BbyStatusCode` map.
- **Read-only unless Planned.** The editor opens Tested, Activated and Deactivated bonus buys read-only. Only a Planned one
  offers Save and the line actions.
- **Mark Tested** (`POST BbyMaintainWeb/BonusBuy/MarkTested { number, note }`):
  - shown only when `GET Access` returns `canTest`, and only on a Planned bonus buy;
  - asks for an optional note;
  - shows the server's in-band refusals as is: last writer, validator refusals in EN + AR.
- **Back to Planned** (`POST BonusBuy/BackToPlanned { number }`):
  - on Tested, Activated and Deactivated;
  - on Activated, a confirmation warns that the offer leaves the tills.
  - There is no promotion-level Back to Planned.
- **Activate** on a Planned bonus buy is not offered; the hint says it must be tested first. A promotion-level Activate refusal
  lists the untested bonus buys.
- The editor and overview show **tested by / at / note** (`testedBy`, `testedAt`, `testNote`).

## Spine reach

UI (oms-react feature) · API client (MarkTested, BackToPlanned, Access.canTest)

## Proof (→ `tdd` red-green cycles)

- [ ] `each status opens read-only except Planned` · vitest
- [ ] `mark tested is offered only with canTest on a Planned bonus buy` · vitest
- [ ] `back to planned on an activated bonus buy asks first` · vitest
- [ ] `status 3 reads Tested in the overview and the editor` · vitest

## Boundaries

Same rules as 416–418. Needs BackOffice 2397 and 2398 for the live walk.

## Done when

The owner walks Planned → Mark Tested (as a second user) → Activate → Back to Planned on a dev SIS.Api.

## Blocked by

417 (+ BackOffice 2397, 2398 for the endpoints)
