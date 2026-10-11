---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\2579-sap-export-console-spec.md
blocked-by: 461 (live: BackOffice 2584)
---

# 463 — The fleet page shows every store's export health

Follows BackOffice spec 2579 (`C:\Work\DMSCO\BackOffice\.issues\2579-sap-export-console-spec.md`). BackOffice builds the doors in 2580-2585, in parallel. Until they land, build against stubs of the door contract (`C:\Work\DMSCO\BackOffice\.issues\assets\2579-sap-export-console-door-contract.md`), which is the only source of wire shapes. Use the spec's words: **behind**, **held for inventory**, **stuck**, **by design**, **double send**, **export accounting**, **rail** (legacy / new).

## What to build

`/reports/sap-export` becomes the fleet page.

- **Tiles** from `GET SapExport/Fleet/Summary`: stores behind, stores stuck, stores held for
  inventory, double sent, double send pending, accounting breaks, legacy stalled. The three store
  tiles drive the `label` filter. The double-send tiles link to the double-send list (465; a
  placeholder route until then). The "as of" stamp shows the rollup's oldest `computedAt`, with a
  warning when it is older than 30 minutes ("numbers may be stale").
- **The store list** from `GET SapExport/Fleet`: code, description, the label counts (zero cells
  blank), the rail mix, oldest behind (hours), break days, and the stalled / held-for-inventory
  markers. A row opens the store page (464; placeholder until then). Filters: label (repeated),
  rail, state code (repeated, from a picker listing the contract's codes with meanings), and a
  search box. Sorts: worst (default), oldest behind, most stuck, code. Paged at 50. Filters and
  sort live in the URL.
- Refetch every 60 s.

## Spine reach

UI -> app (BackOffice 2584 fleet doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `fleetTiles(summary)`: each tile reads its field, drives the right filter or link, and the stale warning flips at 30 min (vitest).
- [x] `fleetQuery(urlState)`: repeated `label` / `state`, `rail`, `q`, `sort`, `page` round-trip through the URL; a filter change resets to page 1 (vitest).
- [x] `tools/sap-export-fleet-drive.mjs` (new, stubbed): tiles with counts and the stale warning; tiles and filters reach the request as the contract spells them; sorts and paging; a row opens `/reports/sap-export/store/:code`; a `400 BAD_FILTER` shows an inline error, not a blank grid.
- [x] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only, built in parallel with BackOffice 2584.

## Done when

The helpers and the fleet drive are green against stubs.

## Blocked by

[461](461-the-sap-export-console-opens-on-a-store-day-s-unfinished-transactions.md).

## Comments

**Done 2026-10-11 (AFK).** Every proof here is **stubbed**: BackOffice 2584 is unbuilt and no call has met a live SIS.Api (466 is the live walk).

- **Built:** `/reports/sap-export` is now the fleet page (`SapExportPage.tsx`).
  - **Tiles** come from `Fleet/Summary`. The three store tiles toggle the `label` filter, and the double-send tiles link to `/reports/sap-export/double-sends?flag=X1|X1p`.
  - **"As of" stamp:** shows the rollup's oldest `computedAt`, with a stale warning past 30 minutes.
  - **Store list:** from `Fleet`, with label counts (zeros blank), rail mix, oldest behind, break days and markers.
  - **Filters:** label chips, rail, a state picker (23 codes with meanings) and search. Sorts and the page live in the URL. Paged at 50, refetched every 60 s, and a `BAD_FILTER` / `BAD_PAGING` shows its own sentence.
  - **New modules:** `fleet-query.ts` (the URL ⇄ query ⇄ door params; the ticket's `fleetQuery(urlState)` is `fleetQueryFromParams`/`fleetQueryToParams`), `fleet-helpers.ts` (`fleetTiles`), `fleet-columns.tsx`, and fleet normalisers in `wire.ts`.
  - **Placeholder routes:** the store page (464) carries 461's open-a-day form, and the double-send list (465) is a placeholder.
  - **URL-state hook:** graduated to `src/core/ui/use-url-query.ts`.
- **Proof:**
  - vitest: `fleet-helpers.test.ts`, `fleet-query.test.ts`, plus fleet cases in `wire.test.ts` and `storeday-helpers.test.ts`. The full suite is 260 files / 4624 tests green. typecheck, lint (4 gates) and build are green.
  - `tools/sap-export-fleet-drive.mjs`: **61/61** on port 5199. It covers tiles and tokens, the stale and never-computed states, the request spellings, every sort, paging, the URL round-trip, a row and the tiles opening their targets, `BAD_FILTER`, the 60 s refetch (Playwright clock) and a denied grant.
  - `tools/sap-export-storeday-drive.mjs` is **55/55**. Its step 1 now opens a day from the store placeholder, and it adds a check for the back link to the store.
  - `idoc-inspector-drive` is unchanged at 125/127. The two failures are the same pre-existing ones.
- **Review:** /code-review and /standards-review findings were applied: the stale clock ticks, the state picker closes, an own-echo no longer clobbers the search draft, the colours are read from `label-helpers`, the row is clickable, and more sorts are driven. The rest is logged in `.afk/HITL-463.md`.
- **Outstanding (not AFK-able):**
  - a human's eye on the tile and marker colours;
  - the live doors (466, BackOffice 2584).
  - The Material search still carries its own copy of the URL-state hook (HITL).
