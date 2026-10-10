---
status: done
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

- [x] `mirrorLaneChip(row)`: worst state wins; `onMirror: false` gives "not on mirror"; every
  `StoreState` in the mirror set maps to a token and a label; unknown values fall back safely (vitest).
- [x] `workerCardItems(items)`: narrows on `rail`; a stale mirror role gets its own banner;
  backpressure gives a warning (vitest).
- [x] `tools/sync-console-fleet-drive.mjs` extended with stubs: lane, four tiles filtering, two
  sorts, worker card with a stale mirror apply, last-hour mirror totals. The existing assertions
  stay green.
- [x] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only, built in parallel with BackOffice 2564–2567.

## Done when

The helpers and the extended drive are green.

## Blocked by

None. It can start immediately (the contract section is published).

## Comments

- 2026-10-10 (AFK): **done**. Every proof is stubbed; BackOffice 2564–2567 are not built yet.
  - **Model.** `src/core/models/sync-console.ts` now carries the whole contract section "Mirror lane and rail agreement" field for field: the added states, `Rail`, the tick outcomes, the dead-letter stage and reason, `Agreement`, the gap kinds, the added audit actions, `MirrorLane` nested on `StoreRow` with `agreement`, `MirrorWorker` with `rail` on the store worker (`WorkerItem` is the union), `MirrorHour`, the mirror `HourTotals`, `StoreMirror`/`DeadLetter`, the retry/acknowledge body and result, and the agreement day, gap and recheck shapes. 457–459 consume the parts this ticket does not draw.
  - **Boundary fill** (`wire.ts`, one pure normaliser per door, `wire.test.ts`). Fleet, Store, Workers, Store/Hours and Fleet/LastHour fill only what an older door leaves out: a not-on-mirror lane, `notJudged`, `rail: 'store'`, a `noData` mirror hour, zero mirror totals. The store, controls, commands and onboard drives stay green **unchanged** (68/68, 67/67, 69/69, 83/83).
  - **Fleet page.**
    - `mirrorLaneChip` and `MirrorLaneChipView`: the worst mirror state colours the chip. A never-measured till backlog reads "not measured", not 0. "Not on mirror" is muted, with no state.
    - `TillClockTime` adds the "till clock" hint.
    - Four mirror tiles are added, with `railsDisagree` held out for 459, and two sorts are appended.
    - `workerCardItems` narrows the worker card on `rail`. Mirror pull and Mirror apply each get their own stale banner; backpressure reads as a warning, Faulted as bad. The "no worker" banner still keys on the store worker.
    - The last-hour panel adds the mirror totals.
  - 🚩 **Deliberately changed existing assertions:**
    - Fleet drive: "eight tiles" became twelve, and "the four sorts" became six.
    - `helpers.test.ts`: the FLEET_TILES test now holds `railsDisagree` out.
  - **Proof.** `helpers.test.ts` and `wire.test.ts` pass; `npm test` 253 files / 4513 tests; typecheck clean; lint 4/4; build green; `sync-console-fleet-drive` **72/72** (was 38/38).
  - **Outstanding, not mine:**
    - A human's eye on the lane chip and the mirror rows of the worker card (no prototype covers them).
    - The live walk (460).
  - Rulings are in `.afk/HITL-456.md` (not committed): the State column still names the mirror states, Fleet/Summary is not filled (blank counts on an old door), the audit labels are left to 458 via `UnlabelledAuditAction`, and the column placement.
