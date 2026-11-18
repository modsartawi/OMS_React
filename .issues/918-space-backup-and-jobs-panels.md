---
status: open
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

- [ ] a refused job shows the server's refusal text
- [ ] buttons hidden without Act

## Boundaries

—

## Done when

A log shrink and a backup requested from the page show up in Jobs and finish against the dev store.

## Blocked by

BackOffice 4034, 4035, 4036, 4037; 916
