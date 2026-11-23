---
status: open
blocked-by: —
---

# 961 — Start and cancel a store's count on Store stages

BackOffice [4198](C:\Work\DMSCO\BackOffice\.issues\4198-a-stores-count-is-started-and-cancelled-on-the-web.md)
(owner ask 2026-11-23): the whole count journey on the web, so the desktop SAP integration screen's Block / Unblock is
no longer needed.

## What was built

On `/oms/store-stages`, the store sheet's Count section, behind `StoreCountStart:02` (`canStartStoreCount`):

- **No count** → "Start count" with a count day (date input, default today, `max` today). A later day is refused
  (`startCommit`), and the server refuses it again.
- **Open count** → "Cancel count" with a required reason (`cancelCommit`, 500 characters). A closed count offers no
  cancel: it ends by its seed or the hand release.
- The releases list is now the **count log**, with the kinds `Started` and `Cancelled` beside `Seeded` / `ByHand` /
  `Reopened`.
- `localDay` builds today off the local wall clock (never `toISOString`, which is UTC).
- Wire: `storeStageApi.countStarted` / `countCancelled` → SIS.Api `POST StoreStage/{store}/CountStarted` /
  `CountCancelled`; model `StoreCountStartRequest`. English and Arabic text.

## Proof

- [x] `stages.test.ts` — start today / earlier / never later, never on a store under count, never blank or twice; cancel
  open only with a reason; `localDay` at 00:30 local. `i18n-keys.test.ts` — the new kinds in both locales. 23/23.
- [x] `npm run typecheck`; lint gates grid-base, contrast, palette, controls, map-build pass. ⚠ `check-boundaries` is red
  on `insurance-rules/aliases/door-shapes.test.ts` (committed in `e9243c46`), unrelated.
- [ ] Opened in a browser against a SIS.Api with BackOffice 4198 (a person).
