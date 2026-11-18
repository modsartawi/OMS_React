---
status: done
spec: BackOffice 4016
blocked-by: BO 4030
---

# 915 — The Store database tab lists the fleet by state, with the needs-2019 ranking

## What to build

BackOffice spec 4016 D10. A new **Store database** tab in the sync console, shown when `GET Auth/Permissions`
holds `StoreDatabase.View`'s screen key (914's single answer, no Access probe). It lists `GET StoreDatabase/Fleet`:
store, engine (2008 / 2008 R2 / 2019 / other), edition, bitness, used / cap with a bar, used share, drive free,
state chip (OK / Watch / Critical / Disk low / Not checked), taken at. Sorted worst state first, then fewest days to
cap (once BO 4031 sends it). Filters: state, engine, edition. A "Needs 2019" view: stores on a 4 GB cap ranked by
days to cap. Arabic beside English labels where the console does.

## Spine reach

UI

## Proof (→ `tdd` red-green cycles)

- [x] component test: rows render state chips and the bar from a fixture answer
- [x] the tab is hidden without the View key

## Boundaries

—

## Done when

The tab shows the dev fleet answer against a local SIS.Api.

## Blocked by

BackOffice 4030

## Comments

**2026-11-18 — built, STUBBED (BO 4030/4031 unbuilt).** Branch `t915-store-db-fleet` off `spec/4016-store-database`.

What was built (and the shared seams 916–919 append to, per the 4016 file plan):
- `/admin/sync/database` — `store-db/StoreDbFleetPage.tsx`: a console page (its own `ConsoleNav` entry `database`),
  behind `ScreenGate canViewStoreDb` with its own denial sentences (`storeDb.access`). Grid (`store-db/fleet-columns.tsx`):
  store link, name, state chip, used / cap with a share-of-own-cap bar (state colour, grows from the inline start),
  used %, days to cap, drive free, engine, edition, bitness, taken at. Filters state / engine / edition (core `Select`)
  and a **Needs 2019** chip (4 GB-cap stores, nearest first). Filtering + order are client-side (`fleet-helpers.ts`).
- `/admin/sync/database/:code` — `store-db/StoreDbStorePage.tsx`, a SHELL only (nav, back link, code) for 916 to fill.
- Shared seams laid once: `SCREEN_KEYS` + `access.ts` (`canViewStoreDb`, `canActStoreDb`, `canRestoreStoreDb` — Act and
  Restore count only beside View); `console-pages.ts` (the nav's pages + gating, pure, tested; `ConsoleNav` draws it);
  `src/core/models/store-database.ts` and `store-db/api.ts` with one banner section per ticket (`STORE_DB_KEY`,
  `storeDbStoreKey(code)`); `storeDb` locale objects in en + ar with an empty `{}` per later ticket (`readings`, `live`,
  `health`, `space`, `backup`, `jobs`, `restore`, `blitz`; `store` holds only `back` today); `store-db/size.ts`
  (`kbSize`, `sharePercent`) for every panel; `tools/store-db-stubs.mjs` (convention: `StoreDatabase/<Door>` →
  `store-db/__fixtures__/<door-kebab>.json`, `overrides[<Door>]` for refusals/hangs); `.gitignore` `tools/.store-db-*-shots/`.

Proof: `store-db/fleet-helpers.test.ts` 11/11 (chips + bar from `__fixtures__/fleet.json`, order, filters, Needs 2019),
`store-db/access.test.ts` 5/5 (tab hidden without `StoreDatabase:03`, even to a console operator), `store-db/size.test.ts`
5/5, `store-db/locales.test.ts` 3/3 (every `storeDb` key + `nav.database` in en AND ar, same slots — covers 916–919's
keys for free). Full suite 821 files / 11,167 tests green; typecheck green. Lint: grid-base, contrast, palette,
controls (no new raw control), map-build green; `check-boundaries` reports 4 PRE-EXISTING violations in
`src/features/insurance-rules/aliases/door-shapes.test.ts` (on the base branch too, not touched here).
Drive `tools/store-db-fleet-drive.mjs` 29/29 (port 5215).

🚩 GUESSES (reconcile when BO writes `assets/4016-oms-react-store-database-brief.md`):
- Screen keys `StoreDatabase:03` / `StoreDatabase:06` / `StoreDatabaseRestore:06` (BO names only the grants).
- `GET StoreDatabase/Fleet` answers a bare array (a `{ rows }` wrapper is read too); every field name
  (`usedKb`, `capKb` 0 = none, `usedShare` 0..1, `driveFreeKb`, `is64Bit`, `daysToCap`, `takenAt`, `productVersion`).
- Sizes in KB on the wire (`kbSize` is the one place to change if BO sends MB).
- State words `Ok | Watch | Critical | DiskLow | NotChecked`; engine labels `2008 | 2008 R2 | 2019 | other`.
- Worst-first rank Critical, Disk low, Not checked, Watch, OK (the client re-sorts so an older door reads right).
  Not checked is drawn `warn` (never green, spec story 6).
- Needs 2019 = `capKb === 4 GB` exactly, ranked by `daysToCap` (no forecast last).

Open rulings:
- **Menu leaf:** the sync-console leaf still requires `ActionSyncConsole:03`; a helpdesk holding only `StoreDatabase:03`
  cannot reach the tab from the menu (the URL works). Owner ruling: `requires: p => canOpenSyncConsole(p) ||
  canViewStoreDb(p)`? Not changed here.
- The app is still `lng: 'en'`: the Arabic words ship and are pinned by test, but the drive can only prove the RTL layout.

**Owed:** "Done when" — the tab against the dev fleet on a local SIS.Api — waits on BO 4030 (and 4031 for the sort +
days to cap).
