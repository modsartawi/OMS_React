---
status: done
spec: 819
blocked-by: 831, 832, 833
---

# 834 — The acceptance case runs end to end against stubs, in en, ar and dark

## What to build

One flow in `analytics-drive` proves spec 819's acceptance case:
1. the owner's sentence in the copilot;
2. the designer holding the expected report (the period defaulting to yesterday, net value by channel, HungerStation against QC for value and for the cancellation rate with the caveat, a Stores by day table, text with live figures);
3. sharing with the team's roles;
4. a daily schedule;
5. a runner re-running it for last week and copying the link;
6. the kept-run record of a send.

The 798 prototype's drive checks (165 at its last run) are ported to the real screens where they still apply. Screenshots go in `.issues/assets/834-shots/`.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

test (flow), touching every v2 screen

## Proof (→ `tdd` red-green cycles)

- [ ] drive: the acceptance flow, steps 1–6 above, in en, ar and dark, with no page errors · flow

## Boundaries

Stubs only. No new code beyond fixes the flow exposes.

## Done when

The acceptance flow is green in all three modes, and the shots are committed.

## Blocked by

[831](831-the-designers-tutorial-builds-the-acceptance-case.md), [832](832-the-copilot-builds-a-report-and-edits-the-open-one-as-one-undo-step.md), [833](833-an-author-schedules-a-report-to-audience-members.md)

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
