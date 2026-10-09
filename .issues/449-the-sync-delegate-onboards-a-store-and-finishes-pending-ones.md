---
status: open
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

- [ ] `parsePastedStores(text)`: TSV and CSV, a header row skipped, blank lines ignored, each row's code validated and lowercase flagged (vitest).
- [ ] `codeIsValid`: `A1B2` passes; `a1b2`, `ABC` and `ABCDE` fail (vitest).
- [ ] `onboardResultSummary`: created, skipped and failed counts, plus warnings (vitest).
- [ ] `tools/sync-console-onboard-drive.mjs`: with stubs, one store through both steps, a paste of 5 with one bad row, the warning on a failed test, finish and dismiss from pending, and edit location.
- [ ] `npm run typecheck`, `npm run lint` and `npm test` green.

## Boundaries

oms-react only. The BackOffice side (BackOffice 2541, 2542) is built in parallel; until it lands, prove the screen
against stubs of the contract.

## Done when

The named helpers and the drive are green.

## Blocked by

[446](446-the-sync-delegate-opens-one-store-s-sync-history-counters-and-scripts.md)
