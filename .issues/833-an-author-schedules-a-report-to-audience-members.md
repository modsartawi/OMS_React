---
status: done
spec: 819
blocked-by: 826, 827
---

# 833 — An author schedules a report to audience members; send-now, suspended and 414 show; kept runs are listed

## What to build

**The schedule editor** is a dialog on the report (803):
- the cadence (daily, weekly on chosen days, monthly on a day) and a Riyadh time;
- the parameter values, set with the strip's controls;
- the language;
- recipients from `AudienceCandidates`, filtered to the audience and the run grant, at most 25;
- enable or pause, Send now, and delete.

`ANALYTICS-414` names each refused recipient. A suspended schedule shows its reason (the owner lost a grant, or a value no longer resolves).

**The kept-run list** `/analytics/report/:id/runs` shows the date, trigger, values, recipients and outcome, with HTML and PDF links while they are kept. After 90 days the record shows "no longer kept" (the server answers `410`). It is open to the owner, curators and the run's own recipients.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

model/api (Schedules, SendNow, Runs, ReportRun) · store/logic (cadence summary, recipient filter) · component/route (dialog, runs list) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `cadenceSummary` — each cadence → its sentence, with the time and days isolated · pure
- [ ] `recipient filter` — candidates limited to the audience and the run grant; the 25 cap; company address only · pure
- [ ] drive: schedule the sample report daily for yesterday to two members; a stubbed 414 names a third; Send now; a suspended schedule; the runs list with an expired artefact · flow

## Boundaries

Proposed doors: Schedules, SendNow, Runs, ReportRun, Html and Pdf. Code 414 and the 410 artefact. New `boards` keys.

## Done when

The pure tests are green and the drive schedules, sends now and lists runs.

## Blocked by

[826](826-an-author-shares-with-roles-and-users-and-an-outsider-is-told-not-shared-with-you.md), [827](827-a-runner-opens-a-report-with-live-figures-and-its-summary.md)

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
