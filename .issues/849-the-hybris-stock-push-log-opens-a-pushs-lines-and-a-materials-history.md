---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3447-hybris-stock-sync-atp-to-the-hot-folder-spec.md
blocked-by: 847, BackOffice 3455
---

# 849 — The Hybris stock push log opens a push's lines and a material's history

## What to build

**Pushes** page: the log across stores with filters (store, type, status, date), each row with type,
started/finished, rows, target, files and error; status reads "delivered to hot folder", never "live on the
website". Opening a push shows its lines; a material's history drawer (from a line or from the store)
shows every quantity sent at that store. Lines older than 15 days say they were swept.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3447-hybris-stock-web-door-contract.md` (written by BackOffice 3453, extended by 3454-3456).
Pattern: the HungerStation and Deliverect pages (`src/features/hungerstation`, `src/features/deliverect`).

## Spine reach

UI → app (BackOffice doors, stubbed until 851)

## Proof (→ `tdd` red-green cycles)

- [x] vitest: type and status labels, shadow vs live target label (`pushes/push-labels.test.ts`, + pushes-query, i18n-keys)
- [x] drive script against stubs: filters, lines, material history (`tools/hybris-stock-pushes-drive.mjs`, 56/56, LTR + RTL)
- [x] typecheck, lint, test green (four gates green; boundaries red only for the 4 pre-existing `insurance-rules/aliases` imports)

## Boundaries

oms-react only. Actions gated by the `Access` door (view / manage). On staging the rail stays in **shadow**, so Hybris never imports anything this page triggers.

## Done when

The proof is green; the live check rides 851.

## Blocked by

- [847](847-the-hybris-stock-stores-page-marks-stores-and-shows-their-health.md)
- BackOffice [3455](C:/Work/DMSCO/BackOffice/.issues/3455-operations-read-the-push-log-its-lines-and-a-materials-history.md)

## Comments

**2026-11-07 — built against stubs (BackOffice 3455 not built).** Branch `spec/3447-hybris-stock`.

- 🚩 **Guessed doors:** `GET Pushes?store=&type=&status=&from=&to=&skip=&take=` → `{ total, rows }`, each push
  `{ pushId, type D|F|S|M, storeCodes[], startedAt, finishedAt, status R|S|E, rows, target shadow|live, files[], error,
  requestedBy, reason, linesSwept }`; `GET Pushes/{id}/Lines?store=&material=&skip=&take=` → `{ pushId, total, lines }`
  (HYS-00008 no such push); `GET Stores/{store}/Materials/{n}/History` → `[{ pushId, type, status, target, sentAt, quantity }]`.
- **Status `S` reads "Delivered to hot folder"** everywhere (grid, drawers, filter); no string in the namespace says
  "live on the website" (a test pins it). An unknown target never reads live.
- **Swept lines:** a push the sweeper marked (`linesSwept`) or older than `Status.lineRetentionDays` (15) by the
  screen's clock says its lines were swept and asks no lines. BO ask: send `linesSwept` so the clock is only a fallback.
- **History from a store** is a link, not a cross-feature import: the stores page's Pushes / Material history go to
  `/hybris-stock/pushes?store=<code>[&history=<code>]`; the drawer asks for the material. Drawers live in the URL
  (`?push=`, `?history=&material=`).
