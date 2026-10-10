---
status: open
spec: 444
blocked-by: —
---

# 456 — The fleet page shows each store's mirror lane and the mirror workers

Follows the BackOffice spec 2563 amendment to this console
(`C:\Work\DMSCO\BackOffice\.issues\2563-mirror-rail-lane-and-rail-agreement-on-the-sync-console-spec.md`, ADR 0073).
BackOffice builds the doors in 2564–2567. Until they land, build against stubs of the contract.

## What to build

On the Fleet page (`/admin/sync`):

- **Mirror lane on every store row**, beside the Master and Counter lanes. It is one compact chip
  showing till backlog, inbox pending and open dead letters, coloured by the worst mirror state.
  - `onMirror: false` shows "not on mirror" and is greyed, with no state.
  - A WPF store still shows its lane.
- **Tiles and filters.** Four new clickable tiles: mirror offline, mirror behind, dead letters,
  deferred too long. They drive the `state` filter. New sorts: largest backlog, most dead letters.
- **Worker card.** It lists every `Workers` item, narrowed on `rail`:
  - the store sync worker, as today;
  - Mirror pull: last tick, outcome, inbox pending / threshold;
  - Mirror apply: last tick, outcome.

  Each item gets its own red stale banner. `SkippedBackpressure` reads as a warning, never as idle.
- **Last hour.** The panel adds the mirror totals.
- **Till clock.** Till-clock times (`tillBacklogOldestAt`) carry a small "till clock" hint.
- **Models.** The `src/core/models/sync-console.ts` types grow field-for-field with the contract
  section "Mirror lane and rail agreement".

Wire shapes come from
`C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md`, section "Mirror lane and
rail agreement". Use the glossary words: **till backlog**, **mirror dead letter**.

## Spine reach

UI → app (BackOffice read doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [ ] `mirrorLaneChip(row)`: worst state wins; `onMirror: false` gives "not on mirror"; every
  `StoreState` in the mirror set maps to a token and a label; unknown values fall back safely (vitest).
- [ ] `workerCardItems(items)`: narrows on `rail`; a stale mirror role gets its own banner;
  backpressure gives a warning (vitest).
- [ ] `tools/sync-console-fleet-drive.mjs` extended with stubs: lane, four tiles filtering, two
  sorts, worker card with a stale mirror apply, last-hour mirror totals. The existing assertions
  stay green.
- [ ] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only, built in parallel with BackOffice 2564–2567.

## Done when

The helpers and the extended drive are green.

## Blocked by

None. It can start immediately (the contract section is published).
