---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3447-hybris-stock-sync-atp-to-the-hot-folder-spec.md
blocked-by: BackOffice 3453
---

# 847 — The Hybris stock stores page marks stores and shows their health

## What to build

A **Hybris stock** menu area (gated by `Access`), first page **Stores**: every store with its flag,
search, and for marked stores the health block (last delta, last full, next full due, last error, unhealthy
highlighted). **Mark / unmark** with a mandatory reason dialog (manage only), the row updated in place; a
**history** drawer (who, when, why). A banner shows the rail's mode from `Status`: off, **shadow** (files
not imported by Hybris) or live. Arabic beside English, LTR and RTL.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3447-hybris-stock-web-door-contract.md` (written by BackOffice 3453, extended by 3454-3456).
Pattern: the HungerStation and Deliverect pages (`src/features/hungerstation`, `src/features/deliverect`).

## Spine reach

UI → app (BackOffice doors, stubbed until 851)

## Proof (→ `tdd` red-green cycles)

- [x] vitest: health → unhealthy mapping; mode banner text (`stores/health.test.ts`, `core/hybris-stock/mode.test.ts`, + access, stores-query, i18n-keys)
- [x] drive script against stubs (LTR/RTL): list, mark with reason, unmark, history, view-only hides actions (`tools/hybris-stock-stores-drive.mjs`, 76/76)
- [x] typecheck, lint, test green (lint: grid-base, contrast, palette, controls green; boundaries red on the base commit for 4 pre-existing `insurance-rules/aliases` imports, none in this area)

## Boundaries

oms-react only. Actions gated by the `Access` door (view / manage). On staging the rail stays in **shadow**, so Hybris never imports anything this page triggers.

## Done when

The proof is green; the live check rides 851.

## Blocked by

- BackOffice [3453](C:/Work/DMSCO/BackOffice/.issues/3453-the-hybris-team-marks-and-unmarks-hybris-stock-stores-with-a-reason.md)

## Comments

**2026-11-07 — built against stubs (BackOffice 3453 not built, no contract asset yet).** Worktree
`C:\Playground\oms-react-spec3447`, branch `spec/3447-hybris-stock`.

- 🚩 **Guessed contract.** Every route, field and code is read off spec 3447 in the HungerStation
  contract's style and lives in ONE place, `src/core/models/hybris-stock.ts` (+ the drive stubs
  `tools/hybris-stock-stubs.mjs`): `HybrisStockWeb/Access` → `{ canView, canManage }`,
  `Status` → `{ mode, deltaMinutes, …, alerts }`, `Stores?marked=&q=`, `Stores/{code}/Mark|Unmark { reason }`
  → the row, `Stores/{code}/History`; refusals `HYS-00001` reason, `00002` no store, `00003` changed
  meanwhile. 851 reconciles them with the real doors.
- **Health is the server's arithmetic.** The row carries `deltaBehind` / `fullOverdue` flags (story 11);
  the client only maps: unhealthy (red, causes in words) > last push failed (amber) > awaiting first full >
  healthy. Only an explicit `true` flags a store. BO ask: send those two flags (or say what to read instead).
- **Mode banner never claims live** unless Status says exactly `live`; a failed read says "mode unknown — do
  not assume it is live". Standing alerts (`alerts[]`) show under it.
- **Area shape:** `features/hybris-stock/{stores,materials,pushes}`, URLs `/hybris-stock/*`, group right after
  HungerStation (menu tests re-pinned: HungerStation at(-3), Deliverect at(-4)). Shared reads, reason binding
  and the banner in `core/hybris-stock`; the area's shared words in `hybris-stock-stores`.
- Under RTL the drive checks direction + isolation; copy stays English app-wide (`lng` en), the Arabic
  namespace is checked key for key by the i18n test.
