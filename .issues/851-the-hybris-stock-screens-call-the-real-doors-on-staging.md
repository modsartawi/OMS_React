---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3447-hybris-stock-sync-atp-to-the-hot-folder-spec.md
blocked-by: 848, 849, 850, BackOffice 3453, BackOffice 3454, BackOffice 3455, BackOffice 3456
---

# 851 — The Hybris stock screens call the real doors on staging

## What to build

HITL walk on staging, rail in **shadow**: mark and unmark a store, upload a material list, see deltas
and a full in the log with their lines and a material's history, push a store and materials now, see 409
by pushing twice. Record findings in Comments.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3447-hybris-stock-web-door-contract.md` (written by BackOffice 3453, extended by 3454-3456).
Pattern: the HungerStation and Deliverect pages (`src/features/hungerstation`, `src/features/deliverect`).

## Spine reach

UI → app (BackOffice doors, stubbed until 851)

## Proof (→ `tdd` red-green cycles)

- [ ] every page walked against staging SIS.Api, LTR and RTL
- [ ] findings recorded

## Boundaries

oms-react only. Actions gated by the `Access` door (view / manage). On staging the rail stays in **shadow**, so Hybris never imports anything this page triggers.

## Done when

The proof is green; the live check rides 851.

## Blocked by

- [848](848-the-hybris-stock-materials-page-uploads-with-a-preview.md)
- [849](849-the-hybris-stock-push-log-opens-a-pushs-lines-and-a-materials-history.md)
- [850](850-push-now-from-the-hybris-stock-stores-page.md)
- BackOffice [3453](C:/Work/DMSCO/BackOffice/.issues/3453-the-hybris-team-marks-and-unmarks-hybris-stock-stores-with-a-reason.md)
- BackOffice [3454](C:/Work/DMSCO/BackOffice/.issues/3454-the-hybris-team-uploads-and-edits-the-hybris-stock-material-list.md)
- BackOffice [3455](C:/Work/DMSCO/BackOffice/.issues/3455-operations-read-the-push-log-its-lines-and-a-materials-history.md)
- BackOffice [3456](C:/Work/DMSCO/BackOffice/.issues/3456-the-hybris-team-pushes-a-store-or-chosen-materials-now.md)

## Comments

**2026-11-07 — not started: BackOffice 3453–3456 are unbuilt, and the contract asset does not exist.** 847–850
were built on branch `spec/3447-hybris-stock` (worktree `C:\Playground\oms-react-spec3447`) against stubs of a
GUESSED contract. Before the walk, reconcile these with the real doors:

- Every route, field and refusal code lives in `src/core/models/hybris-stock.ts`; the drive stubs in
  `tools/hybris-stock-stubs.mjs`. Prefix `HybrisStockWeb/`; codes `HYS-00001`…`00011` + `HybrisStockPushBusy`.
- **BO asks raised by the build and its reviews:**
  1. Stores rows carry `deltaBehind` / `fullOverdue` flags (the client never does the arithmetic).
  2. The preview's refusal codes `unknownMaterial | malformed | badEnabled | repeated`.
  3. A push carries `linesSwept`, and ideally the Lines answer too (or a `GET Pushes/{id}`): a push opened from a
     link that is not on the loaded log page cannot otherwise tell "swept" from "no lines".
  4. Story 21 (material change history) has no read door in the spec; nothing on the web shows it.
  5. Material numbers are checked client-side as 1–18 digits (push materials now, add); confirm no letters.
- Drives: `tools/hybris-stock-{stores,materials,pushes}-drive.mjs` (stubbed, 120/67/56). A live twin should be
  GET-only plus the shadow-mode writes the ticket names.
