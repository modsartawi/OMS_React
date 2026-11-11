---
status: done
spec: 819
blocked-by: 823
---

# 827 — A runner opens a report: sections, panels, live figures, the summary or "unavailable", caveats, and print with values

## What to build

**The report kind** (801) reads from `Analytics/Item`. `/analytics/report/:id` becomes the **runner's page** (798 item 6):
- the title and audience chip;
- the strip and Reset;
- ordered sections, each panel rendered in v1's panel frame (loading, freshness, actions, drill);
- text blocks with **live figures** filled from `POST Analytics/Report/{id}/Words`, each figure isolated whole as a machine value;
- the summary block, or "summary unavailable", which drops only the summary.

The page has no edit control, no cross-filter and no TV mode.

**The model's caveats and marks:** a measure's `caveat{en,ar}` (e.g. "inside OMS only") and `mayStillRiseDays` ("may still rise" on young days) show on report panels **and** board panels.

**The print route** `/analytics/print/report/:id` takes parameter values from its query string.

**The CTO demo's frozen report page and model are replaced**, not kept beside. A demo report id falls to not-found.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

model/api (report definition, Words door, model caveat fields) · store/logic (token fill, may-still-rise) · component/route (runner page, print) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `live figure tokens` — parse `{panel:figure}`, then fill from the Words answer; a missing figure renders a placeholder, never a raw token · pure
- [ ] `mayStillRise` — a day younger than `mayStillRiseDays` relative to `dataAsOf` is marked · pure
- [ ] drive: open the sample report as a runner; change the period; figures and panels update; the summary shows, then a stubbed unavailable drops only it; print carries the values; en, ar and dark · flow

## Boundaries

Proposed: the report item shape, the `Analytics/Report/{id}/Words` door, and the model's `caveat` and `mayStillRiseDays`. It replaces the demo `AnalyticsReportPage` and its model. New `boards` keys.

## Done when

The pure tests are green and the drive runs the sample report as a runner, including print.

## Blocked by

[823](823-every-parameter-kind-has-its-strip-control-and-round-trips-the-permalink.md)

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
