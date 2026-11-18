---
status: done
spec: BackOffice 4016
blocked-by: BO 4038, BO 4039, 918
---

# 919 — The Restore panel: browse, side-copy restore and drop, plus sp_Blitz controls

## What to build

- **Restore** (Restore key): folder field (default the backup folder), Browse lists files with database, date,
  size, engine version, or the file's error; Restore to side copy (reason, shows the side-copy name it will
  create; a newer-engine file is disabled with the reason); side copies listed with size and Drop.
  The panel states plainly that the live database is never replaced from here.
- **sp_Blitz** (Health check panel): installed / version, Install / Remove (Act), Run (View) with its findings.

## Spine reach

UI

## Proof (→ `tdd` red-green cycles)

- [x] Restore controls hidden without the Restore key — `store-db/restore-helpers.test.ts` (`restoreVisible` over `permissionsOf`) + drive check 9
- [x] a newer-engine backup cannot be chosen — `store-db/restore-helpers.test.ts` (`restoreChoice`, from `__fixtures__/backups.json`) + drive check 4

## Boundaries

—

## Done when

A side copy restored from the page appears on the Space panel and can be dropped, against the dev store.

## Blocked by

BackOffice 4038, 4039; 918

## Comments

**2026-11-19 — built, STUBBED (BO 4038/4039 unbuilt).** Branch `t919-store-db-restore` off `spec/4016-store-database`.

What was built:
- **Restore** panel (`store-db/RestorePanel.tsx`, mounted in `panel-views.tsx`): states plainly that the live database
  is never replaced from here; a folder field (empty = the store's backup folder; after Browse it shows the folder the
  server read) and **Browse** → `GET StoreDatabase/Backups?code=&folder=` (View, run only on Browse, never polled);
  the file grid (`store-db/backups-columns.tsx`): file, database, taken at, size, engine, whether it can be restored
  (or the engine's error, `<bdi>`). With the Restore key a Restore button per file — disabled, with its reason, for a
  newer-engine or unreadable file — opening 918's `JobDialog kind="RestoreSideCopy" extra={{ file }}` showing the
  side-copy name it will create. The side copies are listed here too.
- **Drop** (`store-db/SideCopies.tsx`, on Space and Restore): with the Restore key, a `POS_Restore_*` copy has Drop →
  `JobDialog kind="DropSideCopy" extra={{ database }}`. Hidden without the key.
- **sp_Blitz** (`store-db/BlitzSection.tsx`, in 917's Health slot): installed / version (or not installed / not
  reported), **Run** (View; `GET StoreDatabase/Blitz?code=` only when asked, never retried) with the findings most urgent
  first, Install / Remove (Act jobs). The `BLITZ_NOT_INSTALLED` refusal is shown plainly, never as an empty list.
- Pure: `restore-helpers.ts` (`restoreVisible`, `restoreChoice` — server flag first, else `major.minor` compare so an
  SP build is not "newer"; `sideCopyName` with `_2`, `_3`, compared case-insensitively; `canDropCopy`),
  `blitz-helpers.ts` (`blitzControls`, `blitzFindings`, `blitzNotInstalled`). Models §919, api §919, fixtures
  `backups.json` / `blitz.json` (+ `blitz` on `store.json`), locale `storeDb.restore` / `storeDb.blitz` in en + ar.

Proof: `restore-helpers.test.ts` 15/15, `blitz-helpers.test.ts` 6/6, `locales.test.ts` green over the new keys. Full
suite 830 files / 11,247 tests green; typecheck green; lint: grid-base, contrast, palette, controls (no new raw
control), map-build green; `check-boundaries` only the 4 PRE-EXISTING insurance-rules violations. Drive
`tools/store-db-restore-drive.mjs` 49/49 (port 5219). Re-run: fleet 29/29, store 37/37, live 46/46 (its check 7 now
asserts the sp_Blitz section where it asserted 917's empty slot), space 47/47.

🚩 GUESSES (reconcile with BO's brief):
- Backups door: `{ folder, storeEngineVersion, files: [{ file, fileName, database, backupDate, sizeKb, engineVersion,
  newerEngine?, error }], nextSideCopyName? }`; no `folder` param = the backup folder. Browse is NOT run on open (it
  reads every file's header on the till) — the field is empty with "the store's backup folder" until the first Browse.
- Newer engine: the server's `newerEngine` flag wins; without it, `major.minor` against `storeEngineVersion` (else the
  reading's `productVersion`); an un-judgeable file cannot be chosen.
- Side-copy name: the server's `nextSideCopyName` when sent, else `POS_Restore_<today>` + suffix over the store's side
  copies. A restore left for tonight's window may run after midnight and be named for that day — the dialog says the
  name is taken "when it runs".
- Job body extras `file` (full path) / `database` (918's guess); Drop offered only for `POS_Restore_yyyymmdd[_n]`.
- sp_Blitz state as `blitz: { installed, version }` on the Store door (merged into `StoreDbStore` from §919); Blitz door
  `{ findings: [{ priority, findingsGroup, finding, databaseName, details, url }] }`; refusal `BLITZ_NOT_INSTALLED`.
  Install stays offered over an installed build (reinstall / upgrade); both Install and Remove show when the state is
  not reported.

**Owed:** "Done when" — a side copy restored from the page appears on Space and is dropped, against the dev store —
waits on BO 4038 (and 4039 for sp_Blitz) on a local SIS.Api.
