---
status: done
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

- [x] `stripCells(days)`: oldest first, `worst` to token, `noData` muted, a `breaks` marker (vitest).
- [x] `storeFacts(store)`: the danger facts for no SAP location / no counter row; nullable dates shown as blank (vitest).
- [x] `tools/sap-export-store-drive.mjs` (new, stubbed): header facts; 30 cells with the right tokens; a day click opens the store-day page; Recompute posts `{ code }` and `{ code, day }`, then re-reads; `404 NO_STORE` shows not-found.
- [x] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only, built in parallel with BackOffice 2584.

## Done when

The helpers and the store drive are green against stubs.

## Blocked by

[461](461-the-sap-export-console-opens-on-a-store-day-s-unfinished-transactions.md).

## Comments

**Done 2026-10-11 (AFK).** Every proof here is **stubbed**. BackOffice 2584 is unbuilt, and no call has met a live SIS.Api (466 is the live walk).

- **Built:** `/reports/sap-export/store/:code` (`StorePage.tsx`) replaces 463's placeholder and its open-a-day form.
  - **Header** from `Store`: code · name, the rollup stamp, the window total, label chips (worst first, plus raw chips for unknown labels), rail mix, oldest behind, break days and the stalled / held-for-inventory markers.
  - **Export facts:** no SAP location (L6) and no counter row (L7) are danger, each with its plain-English cause. A null watermark or date is blank.
  - **The strip** from `Store/Days` (`StoreStrip.tsx`): one cell per day, oldest first, in the worst label's token. A noData day is dashed and muted, and a breaks day carries a dot. Hover or focus shows the day's counts and verdict, and a click opens the store-day.
  - **Recompute** (`RecomputeControl.tsx`): the window button sits on the store page and posts `{ code }`. The per-day button sits on the store-day header and posts `{ code, day }`. Each is busy while it runs, then re-reads the store's header and strip (and the fleet), and says "Recomputed N days". A refusal shows its own sentence. The copy says it never touches export data.
  - **Not found:** `404 NO_STORE` shows a not-found state.
  - **Code:** new `store-helpers.ts` (`stripCells`, `storeFacts`, `recomputeErrorKey`); `normaliseStore` / `normaliseStoreDays` in `wire.ts`; `storeDayHref` beside `storeHref`.
- **Proof:**
  - vitest: `store-helpers.test.ts` plus the store cases in `wire.test.ts`. The full suite is 261 files / 4647 tests green. typecheck, lint (4 gates) and build are green.
  - `tools/sap-export-store-drive.mjs` is **54/54** on port 5199.
  - `sap-export-storeday-drive` is 55/55; its step 1 now opens a day from the strip. `sap-export-fleet-drive` is 61/61; its row-click target now draws the store page. One run gave 60/61 on the pre-existing row-click check (it read row 0 during a refresh); three reruns were 61/61.
  - `idoc-inspector-drive` is unchanged at 125/127, with the same two pre-existing failures.
- **Review:**
  - /code-review: applied the verdict fill on strip days, unknown labels on the header and hover, recompute kept reachable when the header read fails, raw days in the strip (no UTC parse), and `storeDayHref` placement.
  - /standards-review: no hard violations. Applied the window length no longer hard-coded at 30, and the live store-day no longer re-read after a recompute.
  - The rest is logged in `.afk/HITL-464.md`.
- **Outstanding (not AFK-able):**
  - a human's eye on the strip's colours and the noData look;
  - the live doors (466, BackOffice 2584).
