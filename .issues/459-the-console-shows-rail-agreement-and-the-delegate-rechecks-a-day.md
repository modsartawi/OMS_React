---
status: done
spec: 444
blocked-by: 456
---

# 459 — The console shows rail agreement, and the delegate rechecks a day

BackOffice spec 2563 phase 2 (doors 2571, 2572). **Rail agreement** asks whether a NewPos store's
finished sales reached HQ the same way on the counter rail and the mirror rail.

## What to build

- **Fleet.**
  - A "rails disagree" tile (state `railsDisagree`).
  - An Agreement column (`agree` / `disagree` / `notJudged`) that is filterable.
- **Store, Agreement tab** (from `Store/Agreement`):
  - one row per judged day (D-1..D-7, newest first) with counts and totals on each side, and the gap
    counts;
  - clicking a day filters the paged gap list (receipt number, kind, and both totals to 3 decimals);
  - days with no NewPos receipt are absent, and the tab says so when there are none.
- **Recheck** a day (`canOperate`, `ReasonDialog`). It replaces the day row with the returned one,
  or removes it when the result is `null`. `BAD_DATE` is never reachable from the UI, because only
  listed days offer it.

## Spine reach

UI → app (BackOffice doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `agreementBadge` / `gapKindLabel`: every value gets a label and token (vitest).
- [x] `applyRecheck(days, result)`: replaces or removes the day (vitest).
- [x] The fleet and store drives extended: the tile filters, the column, the tab day → gaps, a
  recheck that clears a gap, the read-only view.
- [x] Gates green.

## Boundaries

oms-react only.

## Done when

The helpers and the extended drives are green.

## Blocked by

[456](456-the-fleet-page-shows-each-store-s-mirror-lane-and-the-mirror-workers.md)

## Comments

- 2026-10-10 (AFK): **done**. Every proof is stubbed, because BackOffice 2571 and 2572 are not built yet. Nothing here was driven against a live SIS.Api.
  - **Fleet:**
    - The "Rails disagree" tile now closes the tile row (`FLEET_TILES = ['all', ...STORE_STATES]`) in the danger token, and sends `state=railsDisagree`. This tile is the fleet's only agreement filter: the door has no `agreement` parameter, and none is sent.
    - The Agreement column ("Rail agreement") reads the door's value through `agreementBadge`: agree is ok, disagree is bad, notJudged is muted, and an unknown value shows raw. An old door's row is filled to `notJudged` by `wire.ts`.
  - **Agreement tab:**
    - The tab is appended after Mirror for worker and WPF stores alike. With `onMirror` false it shows the note and sends no request, Refresh included.
    - It shows the store's agreement, then the judged days in the door's order. Each day has its verdict, both counts, both totals (`formatMoney3`, `Ltr`), the gap counts and its judged time.
    - The gaps are paged by the door at 50 (`TabGrid`, the grid base): business day, receipt, kind (`gapKindLabel` badge) and both totals, with a missing side left blank.
    - Picking a day asks again with `day=`. "Show every day's gaps" goes back. A picked day that drops off the list resets to every day.
    - With no days, the tab shows the "No NewPos receipt" message.
  - **Recheck** (`canOperate` only, one button per listed day, `ReasonDialog`):
    - It POSTs `{ code, day, reason }`.
    - `applyRecheck(days, day, result)` replaces the day in place, or removes it when the result is null. Then the store prefix (gaps, header), the fleet and the audit feed are re-read.
    - Request-level refusals are worded through `recheckRefusalLabel`: `BAD_DATE` and `BAD_REQUEST`, plus the shared `failureLabelKey`. They use a new optional `codeLabel` prop on `ReasonDialog`.
  - **Changed on purpose:**
    - The fleet drive's tile count (section 1) and section 10's tile check (12 → 13 tiles, rails disagree last).
    - The store drive's four tab-list checks (sections 3, 7, 11, 12b; Agreement after Mirror).
    - The matching vitest tile and tab tests.

    Every other existing assertion is unchanged.
  - **Proof:**
    - vitest: `helpers.test.ts` and `store-helpers.test.ts` (`agreementBadge`, `gapKindLabel`, `dayVerdict`, `agreementQuery`, `recheckRefusalLabel`, `applyRecheck`). Full suite: 253 files, 4547 tests passing.
    - Fleet drive: 88/88 (section 11 is new).
    - Store drive: 185/185. Sections 13–15 are new: read only, day → gaps, Recheck that clears a gap and Recheck that removes a day, a refusal with its words, no days, and not on mirror with no request.
    - Other drives, unchanged: controls 110/110, commands 69/69, onboard 83/83.
    - Typecheck, all four lint gates and the build pass.
  - **Outstanding (not AFK's to do):**
    - a human's eye on the Agreement tab and column (no prototype covers them);
    - the live doors (ticket 460).
  - Decisions and the contract gap (no way to filter to notJudged) are logged in `.afk/HITL-459.md`.
