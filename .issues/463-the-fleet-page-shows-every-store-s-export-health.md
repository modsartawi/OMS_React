---
status: open
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

- [ ] `fleetTiles(summary)`: each tile reads its field, drives the right filter or link, and the stale warning flips at 30 min (vitest).
- [ ] `fleetQuery(urlState)`: repeated `label` / `state`, `rail`, `q`, `sort`, `page` round-trip through the URL; a filter change resets to page 1 (vitest).
- [ ] `tools/sap-export-fleet-drive.mjs` (new, stubbed): tiles with counts and the stale warning; tiles and filters reach the request as the contract spells them; sorts and paging; a row opens `/reports/sap-export/store/:code`; a `400 BAD_FILTER` shows an inline error, not a blank grid.
- [ ] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only, built in parallel with BackOffice 2584.

## Done when

The helpers and the fleet drive are green against stubs.

## Blocked by

[461](461-the-sap-export-console-opens-on-a-store-day-s-unfinished-transactions.md).
