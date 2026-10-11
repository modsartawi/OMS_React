---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2579-sap-export-console-spec.md
blocked-by: 461 (live: BackOffice 2584)
---

# 464 — The store page shows its export facts, the 30-day strip and a recompute

Follows BackOffice spec 2579 (`C:\Work\DMSCO\BackOffice\.issues\2579-sap-export-console-spec.md`). BackOffice builds the doors in 2580-2585, in parallel. Until they land, build against stubs of the door contract (`C:\Work\DMSCO\BackOffice\.issues\assets\2579-sap-export-console-door-contract.md`), which is the only source of wire shapes. Use the spec's words: **behind**, **held for inventory**, **stuck**, **by design**, **double send**, **export accounting**, **rail** (legacy / new).

## What to build

`/reports/sap-export/store/:code`.

- **Header** from `GET SapExport/Store`: the store row's counts plus the export facts: under SAP
  (and how many SAP locations), counter row present, watermark, open date, closed, inventory date.
  A missing SAP location or counter row reads as a danger fact, with the plain-English cause
  (the L6 / L7 meanings).
- **The 30-day strip** from `GET SapExport/Store/Days`: one cell per day, oldest first, coloured
  by `worst` through 461's label tokens; `noData` days are hatched or muted. Hover shows the
  day's label counts and verdict; a `breaks` day carries a marker. Clicking a day opens that
  day's store-day page.
- **Recompute** (`POST SapExport/Recompute`): a button for the whole window and one per day
  (from the strip's context or the store-day header). It shows a busy state, then re-reads the
  strip and header. A refusal shows its `errorCode` meaning inline. Make clear in the copy that it
  refreshes the console's numbers and never touches export data.
- An unknown store (`404 NO_STORE`) shows a not-found state.

## Spine reach

UI -> app (BackOffice 2584 store doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [ ] `stripCells(days)`: oldest first, `worst` to token, `noData` muted, a `breaks` marker (vitest).
- [ ] `storeFacts(store)`: the danger facts for no SAP location / no counter row; nullable dates shown as blank (vitest).
- [ ] `tools/sap-export-store-drive.mjs` (new, stubbed): header facts; 30 cells with the right tokens; a day click opens the store-day page; Recompute posts `{ code }` and `{ code, day }`, then re-reads; `404 NO_STORE` shows not-found.
- [ ] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only, built in parallel with BackOffice 2584.

## Done when

The helpers and the store drive are green against stubs.

## Blocked by

[461](461-the-sap-export-console-opens-on-a-store-day-s-unfinished-transactions.md).
