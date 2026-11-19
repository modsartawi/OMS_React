---
status: done
spec: BackOffice 4016
blocked-by: BO 4034, BO 4035, BO 4036, BO 4037, 916
---

# 918 — Space, Backup and Jobs panels: shrink log/data, back up now, schedule, run cleanup

## What to build

- **Space**: used vs free inside the file, log size; Shrink log, Shrink data (shows the server's refusal text; warns
  it blocks the till; default tonight, Run now override), Run cleanup now. Each asks for a reason.
- **Backup**: last backup, Back up now, the store's schedule (off / daily / weekly + weekday) and, for the owner,
  the fleet default.
- **Jobs**: the store's jobs with state, attempts, not before, start, finish, error.

Buttons only with the Act key.

## Spine reach

UI

## Proof (→ `tdd` red-green cycles)

- [x] a refused job shows the server's refusal text (`store-db/job-helpers.test.ts` refusal words + run-time `jobFailure`; drive checks 6 and 11)
- [x] buttons hidden without Act (`job-helpers.test.ts` `jobActionsVisible`, `schedule-helpers.test.ts` `fleetDefaultVisible`; drive checks 10 and 12)

## Boundaries

—

## Done when

A log shrink and a backup requested from the page show up in Jobs and finish against the dev store.

## Blocked by

BackOffice 4034, 4035, 4036, 4037; 916

## Comments

**2026-11-18 — built, STUBBED (BO 4034–4037 unbuilt).** Branch `t918-store-db-space` off `spec/4016-store-database`.

What was built:
- **`store-db/JobDialog.tsx`** — the one write path of the tab, kind-generic: `<JobDialog code kind extra? note? onClose
  onDone?>{children}</JobDialog>` (`kind: null` = closed; `extra: { file?, database? }` for 919's restore/drop;
  `children` above the reason, e.g. the side-copy name). On the console's `ReasonDialog`: reason required and trimmed;
  ShrinkData / RestoreSideCopy / DropSideCopy default to tonight with a **Run now** chip (`runsTonightByDefault`), every
  other kind is sent `runNow: true`; a refusal shows the server's text through `apiErrorMessage` with its code and words
  (`storeDb.jobs.refusals.<CODE>`) and the dialog stays open. Success toasts when it starts (`notBefore`), toasts the
  door's `warning` if any, and re-reads `storeDbJobsKey(code)` + `AUDIT_KEY`. Words for all eight kinds are in
  `storeDb.jobs.kinds.<Kind>.{label,button,title,note,confirm}` already (919 needs none for the dialog).
- **Space** (`SpacePanel.tsx`): cap, used, file size, free inside the file, log, drive free from the page's reading
  (reuses 916's `readingLines` + now-exported `LineValue`); Shrink log, Shrink data, Run cleanup now (`JobButtons`, Act
  only); the side copies, MOVED here from Readings (`SideCopies.tsx`, keys moved to `storeDb.space.sideCopies`).
  **919's Drop spot:** a column/action inside `SideCopies.tsx` (mounted once, in `SpacePanel.tsx`), opening
  `JobDialog kind="DropSideCopy" extra={{ database: copy.name }}`.
- **Backup** (`BackupPanel.tsx`, `ScheduleEditor.tsx`): last full backup, Back up now (Act), the effective schedule in
  words with its source, editable with Act (off / daily / weekly + weekday → reason → `PUT StoreDatabase/BackupSchedule`),
  and the fleet default (`code: null`) for the owner.
- **Jobs** (`JobsPanel.tsx`, `jobs-columns.tsx`): `GET StoreDatabase/Jobs?code=` every 15 s while open — kind, state chip,
  attempts, not before, started, finished, result, error (`<bdi>`), asked by/at, reason, job id.
- api §918 (`jobs`, `requestJob`, `backupSchedule`, `setBackupSchedule`; keys nest under `storeDbStoreKey(code)`),
  models §918, locale `space` / `backup` / `jobs` in en + ar.

Proof: `store-db/job-helpers.test.ts` 11/11, `store-db/schedule-helpers.test.ts` 6/6, `locales.test.ts` green over the
new keys. Full suite 825 files / 11,209 tests green (before the final drive edits; sync-console 472/472 after);
typecheck green; lint: grid-base, contrast, palette, controls (no new raw control), map-build green; `check-boundaries`
only the 4 PRE-EXISTING insurance-rules violations. Drive `tools/store-db-space-drive.mjs` 47/47 (port 5218). 916's
`tools/store-db-store-drive.mjs` re-run 37/37 after two edits it needed: its "unknown panel" case used `?panel=jobs`
(now real → `?panel=nope`), and check 7 now asserts the side copies are NOT on Readings.

🚩 GUESSES (reconcile with BO's brief):
- Jobs door shapes: list = bare array of `{ jobId, code, kind, reason, requestedBy, requestedAt, notBefore, state,
  attempts, startedAt, finishedAt, result, error }`; states `Queued | Running | Done | Failed | Deferred`; POST answer
  `{ jobId, notBefore, warning }`; extra body fields `file` / `database` for 919's kinds.
- Night-window kinds = the sync-lock kinds (ShrinkData, RestoreSideCopy, DropSideCopy); every other kind is sent
  `runNow: true` with no choice offered.
- Refusal codes `REASON_REQUIRED, UNKNOWN_KIND, NOT_WORKER_STORE, JOB_OPEN, TOO_LITTLE_FREE, DISK_TOO_LOW, CLEANUP_OFF,
  NEWER_ENGINE, NOT_A_SIDE_COPY, BLITZ_NOT_INSTALLED` (an unknown code still shows the server's text).
- Schedule: `GET …/BackupSchedule?code=` → `{ code, frequency, weekday, source: 'Store'|'Fleet', fleetDefault }`;
  `PUT` body `{ code | null, frequency: 'Off'|'Daily'|'Weekly', weekday (0 = Sunday, .NET DayOfWeek) | null, reason }`.
- **Fleet default shown only to Act + Restore** (`fleetDefaultVisible`): BO names no owner grant; the Restore holder is
  "me or a DBA" (spec D9). The door itself checks Act (BO 4035). Owner ruling owed.
- The 916 reading's `lastFullBackupAt/SizeKb` is "last backup" (the Backup panel reads no door of its own for it).

**Owed:** "Done when" — a log shrink and a backup requested from the page show up in Jobs and finish against the dev
store — waits on BO 4034–4037 on a local SIS.Api.

**2026-11-19 — 4016 review: the fleet default is now Act's.** Spec D9 lists "the backup schedule" under
`StoreDatabase.Act`, matching the door (BO 4035), so the fleet default shows and saves with Act alone — the
Act + Restore guess above is withdrawn and `fleetDefaultVisible` is gone (the panel reads `canActStoreDb`). The space
drive's check 10 now proves an Act-only holder sees and edits it.

**2026-11-19 — reconciled to the real doors (BO `pricing2`, merge fa2759e8f).** Guesses replaced: the backup schedule's PUT sends `fleet: true` for the fleet default (`code: null` alone was 400) and the weekday as its day NAME (`Friday`; a number failed binding), and a store may choose `Fleet` (drop its own row, follow the default); the GET reads the flat `fleetFrequency` / `fleetWeekday` (the guessed `fleetDefault` object crashed the panel) and `source` `Store` / `Fleet` / `Default` (nothing set = Off, no longer drawn as the store's own). Job states are `Waiting` / `Running` / `Retrying` / `Done` / `Failed` (no Queued / Deferred). Refusal codes are the server's — `NO_STORE`, `SHRINK_FREE_LOW`, `DISK_LOW`, plus `BAD_REQUEST`, `NO_READING`, `STORE_UNREACHABLE`, `RESTORE_GRANT_REQUIRED`, `NOT_A_RESTORE_KIND`, `BACKUP_UNREADABLE`, `NOT_A_FULL_BACKUP`, `BACKUP_FOLDER`, `BAD_SCHEDULE`, `BLITZ_FAILED`, `NO_BLITZ_BUILD` — each with en + ar words. **Owner ruling (night window): follow the server.** `StoreDatabaseJobWindow.NotBefore` holds EVERY kind for the store's window unless `runNow`, so every kind now defaults to tonight in JobDialog with a Run now override; `runNow: true` is never forced (Shrink log, Back up now and Cleanup used to run at once). The queued answer is `StoreDatabaseJobQueued` (`warning` is `""` when none). Fixtures `jobs.json`, `backup-schedule.json` re-made; the space drive passes 50/50.

**Still owed:** the live walk against the dev store on a SIS.Api carrying 4034–4037.
