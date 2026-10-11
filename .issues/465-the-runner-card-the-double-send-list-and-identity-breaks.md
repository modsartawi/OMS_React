---
status: done
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

- [x] `runnerRows(items)`: liveness to token; `fromHeartbeat: false` gives the inferred hint; any `down` gives the banner; `idle` is never red (vitest).
- [x] `identityBreakKey(kind)` and `doubleSendRows(...)`: every kind has a meaning key; X1p sorts and reads as stoppable (vitest).
- [x] The fleet and store drives extended (stubbed): the runner card with a down legacy uploader and its banner, an inferred row; the double-send list with both flags, its filters, paging and links; the identity-break section with rows and its empty state.
- [x] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only, built in parallel with BackOffice 2583 and 2585.

## Done when

The helpers and the extended drives are green against stubs.

## Blocked by

[463](463-the-fleet-page-shows-every-store-s-export-health.md), [464](464-the-store-page-shows-its-export-facts-the-30-day-strip-and-a-recompute.md).

## Comments

**Done 2026-10-11 (AFK).** Every proof here is **stubbed**. BackOffice 2583 and 2585 are unbuilt, and no call has met a live SIS.Api (466 is the live walk).

- **Built:**
  - **Runner card** (`RunnerCard.tsx`) on the fleet page, from `GET SapExport/Runners`: one row per runner in the door's order, with liveness (`down` danger, `up` success, `idle` muted, never red), host, last cycle end (or "Started …, not ended" for a cycle still running), outcome, last moved, due backlog and down-after minutes. A faulted outcome shows `lastMessage` in a `<bdi>`. `fromHeartbeat: false` shows "Inferred — no heartbeat yet". Any `down` runner raises a red banner **above the tiles** (`RunnerBanner`) that names each one. A failed read shows the error and no rows. It refetches every 60 s with the fleet.
  - **Double-send list** at `/reports/sap-export/double-sends` (`DoubleSendsPage.tsx`, `double-send-columns.tsx`) replaces 463's placeholder. It reads `GET SapExport/DoubleSends`. X1p comes first, red, and reads "Can still be stopped". The flag filter (both / X1p / X1) and the store filter (applied on Show) live in the URL as the door names them (`code`, `flag`, `page`). It is paged at 50. Each row links to the inspector (`/reports/idoc-inspector?store=&trx=`), its store-day page and its store. `NO_STORE` / `BAD_FILTER` / `BAD_PAGING` each show their own sentence. The fleet tiles' `?flag=` links land on it.
  - **Identity breaks** (`IdentityBreaks.tsx`) is a section under the strip on the store page, from `GET SapExport/IdentityBreaks`. It lists each break by kind with its name and plain-English meaning, paged at 50. When there are none it reads "The books add up…".
  - **Code:** pure `runner-helpers.ts` (`runnerRows`), `double-send-helpers.ts` (`doubleSendRows` + the URL query), `identity-break-helpers.ts` (`identityBreakKey`); `normaliseRunners` / `normaliseDoubleSends` / `normaliseIdentityBreaks` in `wire.ts`; three reads and queries in `api.ts`. `label-helpers`' private `lookup` is now exported as `tokenBadge`, and the runner badges share it.
- **Proof:**
  - vitest: `runner-helpers.test.ts`, `identity-break-helpers.test.ts`, `double-send-helpers.test.ts` and the new `wire.test.ts` cases. The full suite is 264 files / 4683 tests green. typecheck, lint (4 gates) and build are green.
  - `sap-export-fleet-drive` is **111/111** (was 61), run twice on port 5199. Steps 11–12 are new:
    - the runner card with a down, faulted legacy uploader and its banner above the tiles, an idle row never red, and an inferred row; no banner when nothing is down;
    - the double-send list with both flags, X1p first, its flag and store filters, paging at 50 and the inspector / store-day / store links; NO_STORE;
    - the runners' 60 s refetch and the no-grant guard on both pages.
  - `sap-export-store-drive` is **71/71** (was 54): identity breaks with rows (every kind, meanings, paging 57 → 50 + 7) and the "books add up" empty state; no section on a not-found store and no read without the grant.
  - `sap-export-storeday-drive` is 55/55 (it gained one `IdentityBreaks` stub line).
  - The menu and the inspector are untouched, so `idoc-inspector-drive` was not re-run.
- **Review:**
  - /code-review: applied the started-not-ended cell, retries on an outage (not on a refusal) for the two lists, banner copy that does not claim sales stopped when only the census rollup is down, the store box applied with a flag change, an empty inner page no longer drawn as the green all-clear, one badge lookup instead of two, and the runners keyed off `FLEET_KEY` so a recompute does not refetch them.
  - Skipped: graduating the clamp-to-last-page effect (now in 4 files) to core. That needs its own ticket.
  - /standards-review: no hard violations. Applied the `identityBreakErrorKey` helper, the `RunnerSummary` and `tokenBadge` renames, an explicit X1p-first option list, and two copy fixes.
  - The rest is logged in `.afk/HITL-465.md`.
- **Outstanding (not AFK-able):**
  - a human's eye on the runner card, the banner and the double-send colours;
  - the live doors (466, BackOffice 2583 / 2585).
