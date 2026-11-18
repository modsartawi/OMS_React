---
status: open
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

- [ ] Restore controls hidden without the Restore key
- [ ] a newer-engine backup cannot be chosen

## Boundaries

—

## Done when

A side copy restored from the page appears on the Space panel and can be dropped, against the dev store.

## Blocked by

BackOffice 4038, 4039; 918
