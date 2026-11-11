---
status: open
spec: BackOffice .issues\3631-the-copilot-proposes-a-personal-schedule-send-me-this-every-monday-spec.md
blocked-by: BackOffice 3662
---

# 886 — The "My schedules" page lists a reader's personal schedules and lets them pause, resume, retime, rename and delete them

## What to build

BackOffice spec 3631, its web half: the page (S24, S30) and the report's line.

- A "My schedules" page, reachable by any reader with the view grant: the title, the days and time, the next send,
  paused or not. Pause, resume, change the days and time, rename, delete (with a confirm; it deletes the report too).
- Each row opens its report. A personal schedule's report opens read only for a viewer, with a line saying it is
  sent to them on a schedule; no edit, share or schedule controls for a viewer.
- When the doors refuse (switch off), the page is not offered.

## Proof (→ `tdd` red-green cycles)

- [ ] The page lists the reader's schedules with the next send · oms-react tests
- [ ] Pause, resume, retime, rename and delete each call their door and redraw · oms-react tests
- [ ] A viewer's personal report opens read only with the line · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3662.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3662
