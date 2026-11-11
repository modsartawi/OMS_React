---
status: done
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

- [x] The page lists the reader's schedules with the next send · oms-react tests
- [x] Pause, resume, retime, rename and delete each call their door and redraw · oms-react tests
- [x] A viewer's personal report opens read only with the line · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3662.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3662

## Build notes

Built 2026-11-11 on `t886` (from `spec/3631`). Proofs: `src/features/analytics/boards/my-schedules.test.ts` (16 cases, the
network stubbed at `@/core/api`), one `describe` per Proof box.

- **Contract** in `src/core/models/analytics.ts`: `AnalyticsPersonalScheduleWire` (3662's shape verbatim),
  `AnalyticsPersonalSchedule` (the same with its cadence read as any schedule's, `Weekday` numbers), the Time and Title
  bodies, and `AnalyticsItem.personalScheduleId?`. The doors are `analyticsApi.mySchedules / pauseMySchedule /
  resumeMySchedule / retimeMySchedule / renameMySchedule / deleteMySchedule`; readers `readPersonalSchedule(s)` and
  `personalTimeBody` sit in `./schedule` beside the ordinary schedule's.
- **Redraw** is `actOnMySchedule(rows, act)` (`./my-schedules`): the row is replaced by the door's answer (gone after a
  delete) and written into `ANALYTICS_MY_SCHEDULES_KEY`; a refusal leaves the list and is worded (in the dialog for
  retime / rename / delete, a toast for pause / resume).
- **The switch.** The menu leaf (`/analytics/my-schedules`, last in the Analytics group) has its own probe,
  `mySchedulesOffered` on `MY_SCHEDULES_OFFERED_KEY` in `./access`: `ANALYTICS-424` is a plain no, any other failure hides
  it too (fails closed). Reached by URL with the switch off, the page says personal schedules are not available.
- **The report.** `personalReportOf(report)`: with `personalScheduleId` the report page draws no Edit, history, share /
  tier actions or schedules, and a line "sent to you on a schedule" linking My schedules (Copy link, Print and Pin stay).
- `MY_SCHEDULES_PATH` is in `@/core/analytics-routes` so the copilot's cards (885, 887) link the page by route string.
- Gate: typecheck green; `npm test` 751 files / 10325 tests green; lint's boundary gate fails on BASE in
  `insurance-rules/aliases/door-shapes.test.ts` (4 cross-feature imports, untouched here) — the other four gates green.
  Not driven against a live SIS.Api (no Playwright drive written).

