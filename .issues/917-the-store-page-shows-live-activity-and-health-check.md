---
status: done
spec: BackOffice 4016
blocked-by: BO 4032, 916
---

# 917 — The store page's Live activity and Health check panels, and Check now

## What to build

- **Live activity**: the four result sets of `GET StoreDatabase/LiveActivity` as four tables, with a Refresh button
  (and the time of the look), so the agent can take two or three looks.
- **Health check**: findings by priority with the fix text.
- **Check now** (Act key): reason dialog, then the fresh reading replaces the panel.

## Spine reach

UI

## Proof (→ `tdd` red-green cycles)

- [x] Check now requires a reason and is hidden without Act (`store-db/check-now.test.ts` 6/6 + drive checks 9–12)

## Boundaries

—

## Done when

Panels work against the dev store.

## Blocked by

BackOffice 4032, 916

## Comments

**2026-11-18 — built, STUBBED (BO 4032 unbuilt).** Branch `t917-store-db-live` off `spec/4016-store-database`.

What was built:
- **Live activity** panel (`store-db/LivePanel.tsx`, mounted in `panel-views.tsx`): `GET StoreDatabase/LiveActivity?code=`
  drawn as four tables (running requests, head blockers, sync worker sessions, transactions open over 30 s), each with
  its row count and an empty sentence, the time of the look, and **Look again**. Never polled, never re-taken on window
  focus (each look queries a till); the strip's Refresh also takes a new look (key nests under the store). The four
  column sets live in ONE file, `store-db/live-columns.tsx`, so a generic `{ columns, rows }` answer is a one-file change.
- **Health check** panel (`store-db/HealthPanel.tsx`): `GET StoreDatabase/HealthCheck?code=`, findings grouped by
  priority (most urgent first, server order within one), priority chip (1 bad, 2 warn, later go — never green), the
  check's words (12 known checks) or the server's own word, detail and fix as `<bdi>` server text, a faulted check
  marked. An empty `data-store-db-blitz-slot` with a commented `<BlitzSection store={store} />` line is the spot 919 fills.
- **Check now** (`store-db/CheckNowButton.tsx`, in the header's `data-store-db-actions` slot): hidden without
  `StoreDatabase:06` (beside View); the console's `ReasonDialog` (Confirm off without a reason, trimmed, refusal kept in
  the dialog with its code); on success `setQueryData(storeDbStoreKey(code))` with the answer, re-runs the health check,
  re-reads the fleet and `AUDIT_KEY`, toasts (a warn toast when the fresh read FAILED — the Not checked banner then shows).
- Pure modules: `check-now.ts` (`checkNowVisible`, `checkNowBody`), `health-helpers.ts`, `live-helpers.ts` (tolerant
  reads, sections, time of the look). Models §917, api §917 (`storeDbLiveKey`, `storeDbHealthKey`). Locale
  `storeDb.live` (incl. `storeDb.live.checkNow.*`) and `storeDb.health`, en + ar.

Proof: `check-now.test.ts` 6/6, `health-helpers.test.ts` 6/6, `live-helpers.test.ts` 5/5; `locales.test.ts` green over the
new keys. Full suite 826 files / 11,209 tests green; typecheck green; lint: grid-base, contrast, palette, controls (no
new raw control), map-build green; `check-boundaries` only the 4 PRE-EXISTING insurance-rules violations. Drive
`tools/store-db-live-drive.mjs` 46/46 (port 5217).

🚩 GUESSES (reconcile with BO's brief): `POST StoreDatabase/CheckNow` body `{ code, reason }` answering the whole
`StoreDbStore` (so it replaces the page's read) and a failed read coming back as a failed `lastAttempt`, not a refusal;
LiveActivity as four typed arrays `running / headBlockers / workerSessions / longTransactions` with camelCased aliases of
`store-whoisactive-2008.sql`, plus a server `takenAt` (client answer time otherwise); `blockedBy` 0 = not blocked;
HealthCheck `{ takenAt, findings: [{ priority (1 = most urgent), check, detail, fix, faulted }] }` and the twelve check
machine names; the Check now audit action word (not labelled; shows raw on the Audit page).

**Owed:** "Done when" — the panels against the dev store on a local SIS.Api — waits on BO 4032.

**2026-11-19 — reconciled to the real doors (BO `pricing2`, merge fa2759e8f).** Guesses replaced: Check now answers `StoreDatabaseCheckNowAnswer` — a reading result `{ code, takenAt, succeeded, error, reading, largestTables, auditId }`, NOT a store page — so the page is no longer `setQueryData`'d with it: the store's page and health check are invalidated (exact keys, so the live look and sp_Blitz are not re-run) and re-read, and a read that came back `succeeded: false` toasts as a failure (it used to toast success); the live-activity durations are `seconds`, `waitSeconds`, `idleSeconds`, `runningSeconds`, `transactionSeconds` and `openTransactions` (were `secs`/`waitSecs`/`idleSecs`/`runningSecs`/`tranSecs`/`openTran` — those columns were blank); a faulted health check is `level: "CheckFailed"` (no `faulted` flag) and `NoRecentBackup` is `NoFullBackup`; the on-demand looks stamp `DateTime.Now` with the server's offset. Fixtures `check-now.json`, `live-activity.json`, `health-check.json` re-made from the DTOs; the live drive passes 48/48 (contexts in Asia/Riyadh).

**Still owed:** the live walk against the dev store on a SIS.Api carrying 4032.
