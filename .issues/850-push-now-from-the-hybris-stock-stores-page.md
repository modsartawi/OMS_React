---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3447-hybris-stock-sync-atp-to-the-hot-folder-spec.md
blocked-by: 847, BackOffice 3456
---

# 850 — Push now from the Hybris stock stores page

## What to build

On Stores (manage only): **Push store now** (a full, with a reason; the confirmation says so) and
**Push materials now** (pick materials and stores, with a reason). The result shows the push row (rows,
status). 409 busy says "a push of this store is already running; try again shortly" and is not an error
state. In flight, the action shows progress and cannot be clicked twice.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3447-hybris-stock-web-door-contract.md` (written by BackOffice 3453, extended by 3454-3456).
Pattern: the HungerStation and Deliverect pages (`src/features/hungerstation`, `src/features/deliverect`).

## Spine reach

UI → app (BackOffice doors, stubbed until 851)

## Proof (→ `tdd` red-green cycles)

- [x] vitest: 409 and failure message mapping (`stores/push-now.test.ts`)
- [x] drive script against stubs: both push kinds, 409, no double submit (`tools/hybris-stock-stores-drive.mjs` §9–12, whole drive 120/120, LTR + RTL)
- [x] typecheck, lint, test green (full vitest 9843/9843; four gates green; boundaries red only for the 4 pre-existing `insurance-rules/aliases` imports; build clean)

## Boundaries

oms-react only. Actions gated by the `Access` door (view / manage). On staging the rail stays in **shadow**, so Hybris never imports anything this page triggers.

## Done when

The proof is green; the live check rides 851.

## Blocked by

- [847](847-the-hybris-stock-stores-page-marks-stores-and-shows-their-health.md)
- BackOffice [3456](C:/Work/DMSCO/BackOffice/.issues/3456-the-hybris-team-pushes-a-store-or-chosen-materials-now.md)

## Comments

**2026-11-07 — built against stubs (BackOffice 3456 not built).** Branch `spec/3447-hybris-stock`.

- 🚩 **Guessed doors:** `POST Stores/{code}/PushNow { reason }` and `POST Pushes/Materials { storeCodes,
  materialNumbers, reason }`, each answering the push row. Refusals read in words: 409 `HybrisStockPushBusy`
  (busy), HYS-00009 not marked, 00010 rail off, 502 00011 file not delivered (recorded as failed), 00004 a
  material not listed.
- **409 busy is a status, not an error**: neutral box, the ticket's sentence, no code, no list re-read, Confirm
  stays on. A recorded failure (00011) and a store no longer marked (00009) re-read the list.
- **No double submit**: the row's Push now reads the store's mutation (`pushStoreKey`) and goes busy +
  `aria-disabled`; the shared reason dialog's latch drops a second Confirm. The drive double-clicks and clicks
  the busy row: one POST.
- Push materials now picks from the **marked** stores on the list (filters apply — a filtered list offers fewer)
  and takes pasted numbers (split on space / comma / line; repeats collapsed; a malformed one blocks Confirm).
