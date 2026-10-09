---
status: done
spec: 444
blocked-by: 446
---

# 449 — The sync delegate onboards a store and finishes the pending ones

## What to build

Onboarding (BackOffice 2520):

- **New store wizard** at `/admin/sync/new-store`, in two steps:
  - **Step 1, the store master:** code, description, city, area, address, phone, CR, plus the
    template store.
  - **Step 2, the sync location:** IP, plus the template location, `P001` preselected and `C011`
    selectable.

  It takes one store, or pasted rows (TSV/CSV) parsed into a preview grid with the bad codes marked
  before any call. **Preview**, then **Create**, with a result per row (store created or skipped,
  location created, error, warning). A connection test is queued for each new location; its failure
  shows as a **warning**.
- **Visibility by grant:** step 1 renders only with `canOnboard`. Without it, the wizard starts at
  step 2 (location only, for existing stores).
- **Code format:** checked live against `^[A-Z0-9]{4}$`. Lowercase is refused, not upper-cased.
- **Sync pending** at `/admin/sync/pending`: a paged list with **Finish** (opens the wizard at step 2
  for that code) and **Dismiss** (selection of up to 50, with a reason).
- **Edit store** (address fields) and **Edit location** (description, IP, instance, DB) dialogs,
  each with a reason. Edit location lives on the Location tab from 446.

The wire shapes come from the door contract, `C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md`. The layout comes from the
[prototype](https://claude.ai/artifact/557hsB6V9zt9zV1XVrZPVd).

## Spine reach

UI → app (BackOffice onboarding doors)

## Proof (→ `tdd` red-green cycles)

- [x] `parsePastedStores(text)`: TSV and CSV, a header row skipped, blank lines ignored, each row's code validated and lowercase flagged (vitest).
- [x] `codeIsValid`: `A1B2` passes; `a1b2`, `ABC` and `ABCDE` fail (vitest).
- [x] `onboardResultSummary`: created, skipped and failed counts, plus warnings (vitest).
- [x] `tools/sync-console-onboard-drive.mjs`: with stubs, one store through both steps, a paste of 5 with one bad row, the warning on a failed test, finish and dismiss from pending, and edit location.
- [x] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only. The BackOffice side (BackOffice 2541, 2542) is built in parallel; until it lands, prove the screen
against stubs of the contract.

## Done when

The named helpers and the drive are green.

## Blocked by

[446](446-the-sync-delegate-opens-one-store-s-sync-history-counters-and-scripts.md)

## Comments

**Done 2026-10-09 (AFK).** Built in `src/features/admin/sync-console/`:
- **Model** (`@/core/models/sync-console`), field for field with the contract:
  - `PendingStore`, `LocationRowInput`;
  - `CreateLocationsRequest/Result/Response`, `EditLocationRequest`;
  - `DismissPendingRequest`, `AuditedWriteResponse`;
  - `StoreInput`, `OnboardRequest/Result/Response`, `EditStoreRequest`.

  `api.ts` adds `pendingStores`, `dismissPending`, `createLocations`, `editLocation`, `onboard`
  (Preview or real), `editStore` and `connectionTests`, plus `pendingStoresQuery` (`PENDING_KEY`).
- **Pure helpers** in `onboard-helpers.ts`:
  - `codeIsValid` / `codeProblem`: lowercase refused, never re-cased.
  - `wizardStart`: which wizard each grant gets.
  - `parsePastedStores` + `pasteReady`:
    - TSV or CSV (quotes allowed), header skipped, blank lines ignored;
    - bad / lowercase / duplicate codes, a wrong cell count and an empty IP are marked;
    - at most 50 rows.
  - `onboardResultSummary`: created, skipped, failed (coded), locations, warnings.
  - `onboardRow` / `locationRow`.
  - `connectionTestVerdict`: a failed test is a WARNING.
  - `locationEditReady`, `storeEditReady`.
- **New store wizard** (`NewStorePage`, `/admin/sync/new-store`):
  - **With `canOnboard`:** step 1 (store master + template store P001), then step 2 (IP +
    template location, P001 preselected, C011 one click), through `Store/Onboard/Preview` →
    `Store/Onboard` (`alsoCreateLocation: true`).
  - **Without it, or for a Finish:** step 2 alone, through `ActionSync/Locations` (preview true,
    then false).
  - **Input:** one store or paste many, with the parsed grid marking bad rows before any call.
  - **Reason:** inline.
  - **Preview first:** Create is offered only while the inputs still match what was previewed.
  - **Result:** a row each (store created / existed, location added, refusal with words + code),
    plus one toast sentence. Each new location's connection test is followed every 2 s for up to
    60 s; its failure is a warning.
  - **Counter = 0 note:** beside Create.
- **Sync pending** (`PendingPage`, `/admin/sync/pending`):
  - paged at 50 by the door;
  - Finish opens the wizard at step 2 for its code;
  - Dismiss takes a selection of up to 50 (447's cap, now the shared `useCappedSelection` hook),
    with a reason.
- **Edit location** (Location tab, `canOperate`): description, IP, instance, database; no
  credential field.
- **Edit store** (store page, `canOnboard`, not on WPF): address fields, every one required
  (there is no read door; see HITL).
- **ConsoleNav** gains New store (hidden when the holder may onboard nothing) and Sync pending.
- **Route:** two lazy routes in `app/router.tsx`.

Proof:
- **vitest:** `onboard-helpers.test.ts`, 35 tests: `codeIsValid` (A1B2 passes; a1b2, ABC, ABCDE
  fail), `codeProblem`, `wizardStart`, `parsePastedStores` (TSV, CSV with quotes, header skipped,
  `CODE` kept as data, blank lines, lowercase flagged and kept as written, every problem),
  `pasteReady` (cap 50), `onboardResultSummary` (created/skipped/failed + warnings, unknown code
  raw), result rows, `connectionTestVerdict`, `locationEditReady`, `storeEditReady`.
  Full suite: **233 files, 4288 tests, all passing.**
- **drive:** `tools/sync-console-onboard-drive.mjs`, **83/83**, against STUBBED contract envelopes
  (the real SIS.Api error shape) on vite :5199:
  - **One store, both steps:** live code check; P001 / C011; Preview body exact; a stale preview
    after an edit; Create posts the SAME body; result row and link.
  - **Paste of 5 with one lowercase row:** marked at its line and nothing sent; then fixed and
    created — 3 created, 2 skipped, 1 `LOCATION_EXISTS`, 1 warning, and a warning toast.
  - **Step 2 alone without `canOnboard`:** CSV; a wrong template → `NO_TEMPLATE`; Locations
    preview then real; the tests polled at 2 s, one OK, one failed → warning; the poll stops.
  - **Sync pending:** Finish → step 2 with the code locked; Dismiss of 2 with a reason.
  - **Edits:** Edit location (four fields, trimmed); Edit store (all fields, absent on WPF and
    without `canOnboard`).
  - **View only:** no form, no New store link, no checkbox / Finish / Dismiss / Edit.
- **Regression drives**, re-run green after the selection hook moved: fleet 38/38, store 65/65,
  controls 67/67, commands 68/68. One earlier commands run missed a single timing check (29 of 30
  reads); the re-run was clean.
- `npm run typecheck`, `npm run lint` (all four gates) and `npm run build` are green.

**Reviews:**
- `/code-review`: 10 findings. **Fixed:**
  - the preview key is now taken from the request sent, not from the form at answer time;
  - a real store `CODE` is no longer read as a header;
  - a Finish offers no Paste many;
  - a padded stored value is not counted as a change;
  - the preview columns are memoized;
  - one shared `TextField`.

  **Logged, not changed** (they follow the ruling or the contract):
  - `alsoCreateLocation` always true;
  - finding tests among the newest 200;
  - stale Dismiss codes;
  - step-1 fields left to the door.
- `/standards-review`: no hard violation. **Fixed:**
  - a "Store,Name,IP" header is now skipped;
  - `NO_STORE` reads "create the store first" in the wizard;
  - a name and a magic number made clear;
  - unused exports dropped;
  - a `NO_TEMPLATE` drive check added.

  **Left as judgement calls:** the inline reason on the wizard page, the address-field data clump
  (five shapes that mirror five contract bodies), the repeated invalidation block, and the size of
  `Wizard`.

**Owner sign-off wanted** (`.afk/HITL-449.md`):
- Edit store asks for every field, since no door reads the address back (contract gap);
- the connection tests are found among the newest 200 (contract gap: no batch / id);
- the `Store/Onboard` warning is shown as the door's own text;
- `alsoCreateLocation: true` for a `canOnboard`-only holder;
- Edit store is hidden on WPF stores.

**Outstanding (not this ticket's to fake):** every proof is stubbed. The live walk against
BackOffice 2541/2542 on staging is ticket 450, as is an owner eye on the pages against the
prototype.
