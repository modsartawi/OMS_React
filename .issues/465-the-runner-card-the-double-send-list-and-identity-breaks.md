---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2579-sap-export-console-spec.md
blocked-by: 463, 464 (live: BackOffice 2583, 2585)
---

# 465 — The runner card, the double-send list and identity breaks

Follows BackOffice spec 2579 (`C:\Work\DMSCO\BackOffice\.issues\2579-sap-export-console-spec.md`). BackOffice builds the doors in 2580-2585, in parallel. Until they land, build against stubs of the door contract (`C:\Work\DMSCO\BackOffice\.issues\assets\2579-sap-export-console-door-contract.md`), which is the only source of wire shapes. Use the spec's words: **behind**, **held for inventory**, **stuck**, **by design**, **double send**, **export accounting**, **rail** (legacy / new).

## What to build

- **Runner card** on the fleet page (`GET SapExport/Runners`): one row per runner (legacy
  uploader, the three IDoc stages, the census rollup) with liveness (`down` danger, `up` success,
  `idle` muted), host, last cycle end, outcome, last moved count, due backlog and the "down after"
  minutes. A faulted outcome shows `lastMessage` (`<bdi>`). `fromHeartbeat: false` shows an
  "inferred - no heartbeat yet" hint. Any `down` runner raises a red banner above the tiles.
- **Double-send list** at `/reports/sap-export/double-sends` (`GET SapExport/DoubleSends`):
  X1p first and marked "can still be stopped"; filters flag and store; paged at 50; each row
  links to the inspector (462's link) and to its store-day page. The fleet tiles from 463 link
  here with the matching `flag`.
- **Identity breaks** on the store page (`GET SapExport/IdentityBreaks`): a tab or section
  listing each break by kind with plain-English meanings, paged at 50, empty state "the books add
  up".

## Spine reach

UI -> app (BackOffice 2583 and 2585 doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [ ] `runnerRows(items)`: liveness to token; `fromHeartbeat: false` gives the inferred hint; any `down` gives the banner; `idle` is never red (vitest).
- [ ] `identityBreakKey(kind)` and `doubleSendRows(...)`: every kind has a meaning key; X1p sorts and reads as stoppable (vitest).
- [ ] The fleet and store drives extended (stubbed): the runner card with a down legacy uploader and its banner, an inferred row; the double-send list with both flags, its filters, paging and links; the identity-break section with rows and its empty state.
- [ ] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only, built in parallel with BackOffice 2583 and 2585.

## Done when

The helpers and the extended drives are green against stubs.

## Blocked by

[463](463-the-fleet-page-shows-every-store-s-export-health.md), [464](464-the-store-page-shows-its-export-facts-the-30-day-strip-and-a-recompute.md).
