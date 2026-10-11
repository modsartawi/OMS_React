---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2579-sap-export-console-spec.md
blocked-by: — (live: BackOffice 2580-2583)
---

# 461 — The SAP export console opens on a store-day's unfinished transactions

Follows BackOffice spec 2579 (`C:\Work\DMSCO\BackOffice\.issues\2579-sap-export-console-spec.md`). BackOffice builds the doors in 2580-2585, in parallel. Until they land, build against stubs of the door contract (`C:\Work\DMSCO\BackOffice\.issues\assets\2579-sap-export-console-door-contract.md`), which is the only source of wire shapes. Use the spec's words: **behind**, **held for inventory**, **stuck**, **by design**, **double send**, **export accounting**, **rail** (legacy / new).

## What to build

**Slice 0 of the SAP export console.** It registers the feature end to end and builds the
store-day page, the console's deepest view.

- **Registration**
  - A new feature `features/reports/sap-export-console` (the Reports area, beside the IDoc
    inspector; NOT Admin, because the sync console's drives assert Store sync is the last Admin
    leaf).
  - The `sap-export-console` i18n namespace, EN only (as `sync-console`), registered in
    `core/i18n.ts`.
  - Routes: `/reports/sap-export` (a placeholder until 463) and
    `/reports/sap-export/store/:code/day/:day`.
  - A **SAP export** leaf in the Reports group, after the IDoc inspector, gated by `accessProbe`
    on `GET SapExport/Access` (`screenAllowed`). It **fails closed**, like the sync console's
    probe: an error or a 403 hides it. The page guards itself too.
- **The whole model.** `core/models/sap-export.ts` carries **every** shape and enum in the
  contract, field for field, so 463-465 only consume it. The feature's `api.ts` holds its calls.
  A `wire.ts` boundary normaliser per door fills what an older door leaves out (for example
  `flags: []`, `held: null`, `accounting: 'agrees'` before BackOffice 2583), so the page never
  crashes on a partial door.
- **The store-day page** (`GET SapExport/StoreDay`):
  - Header: store, day, "as of", the total, and one count per **label** as clickable chips that
    drive the repeated `label` filter. The export-accounting verdict is a badge; `breaks` is the
    danger token.
  - A **state legend**: each state code present that day with its meaning (the contract's table,
    as i18n keys), clickable to drive the repeated `state` filter.
  - The grid (AG Grid, spreading `OMS_GRID_BASE_COL_DEF`): transaction number, machine, rail,
    state code + meaning, label badge, version stamp, counter (with the watermark for legacy
    rows), hours past day end, reason (free text, `<bdi>`), "held k of m" with the missing-rows
    hint for N1, and the flags as chips. Paged at 50. The worst label sorts first (the door's
    order; don't re-sort).
  - Each row links to the IDoc inspector at `/reports/idoc-inspector?store=<code>&trx=<trxNumber>`
    (462 makes the inspector honour it; until then the link just opens the inspector).
- **Label tokens.** One pure helper maps each `Label` to a severity token and a label key:
  `stuck` danger, `behind` warning-strong, `heldForInventory` info (never red), `waiting` neutral,
  `exported` success, `byDesign` muted. An unknown value falls back to neutral, never a crash.

## Spine reach

UI -> app (BackOffice read doors 2580-2583, stubbed)

## Proof (→ `tdd` red-green cycles)

- [ ] `labelToken(label)` and `worstLabel(labels)`: every `Label` maps to a token and a key; `heldForInventory` is never the danger token; an unknown value falls back safely; worst order is stuck > behind > heldForInventory > waiting > exported > byDesign (vitest).
- [ ] `stateMeaningKey(code)`: every contract code (L1-L10, L2a, L2b, N1-N11, U) has a key; an unknown code falls back (vitest).
- [ ] `wire.ts` normalisers: an older StoreDay without `flags`/`held`/`accounting` is filled; a full one passes through unchanged (vitest).
- [ ] `tools/sap-export-storeday-drive.mjs` (new, stubbed at `page.route`): the Reports leaf shows only when `screenAllowed`; label chips and the legend reach the request as repeated `label` / `state`; paging at 50; a `breaks` day shows the danger badge; an N1 row shows "held 1 of 2"; a row links to the inspector with `store` and `trx`; `screenAllowed: false` hides the leaf and the page guards itself.
- [ ] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only, built in parallel with BackOffice 2580-2583. No new npm dependency.

## Done when

The helpers and the new drive are green against stubs.

## Blocked by

None. It can start immediately (the contract is published).
