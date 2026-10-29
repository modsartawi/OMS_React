---
status: open
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; story 48)
blocked-by: 686, 687
---

# 690 — Compare runs two experiments side by side and highlights the lines and trace rows that differ

## What to build

**Compare (A/B):** duplicate the current experiment as B, edit either one, and the page makes **two** door calls,
each with 678's latest-wins rule. The two outcomes are shown side by side. Highlighted:
- the lines whose matched state differs;
- the trace rows whose value differs (keyed by line + `ruleId` + `blockPath`);
- the read-log rows whose value differs;
- a verdict that differs.

A row present on one side only is shown as such. Leaving Compare keeps A as the experiment.

## Spine reach

store/logic (compare diff) · component (side-by-side) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `compareDiff` — equal outcomes give no highlight; a flipped `when[1]` on line 2, a line matched only in B, and a
      differing read value are each flagged by key; a one-sided row is marked — pure
- [ ] drive: duplicate, change one quantity in B, see the differing line and trace row highlighted — flow

## Boundaries

No new door (two calls to Evaluate).

## Done when

Two experiments run side by side with their differences highlighted. Vitest and drive are green.

## Blocked by

[686](686-the-read-log-shows-what-the-engine-read-on-each-line-and-an-explain-paragraph-reads-the-outcome-in-words.md),
[687](687-experiments-are-kept-by-name-in-the-browser-and-exported-or-imported-as-a-versioned-json-file.md)
