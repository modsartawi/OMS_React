---
status: open
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; stories 45-47)
blocked-by: 684, 687
---

# 689 — Lessons load ready experiments, and Check says whether the outcome meets the lesson

## What to build

**Lessons** ship with the page as static experiments, in the 687 codec. Each one has data, a rule, a kind, an as-of,
an EN + AR explanation, and an **expected result as a minimal assertion on the outcome** (for example: line 1 trace
`when[0]` is `unknown`; the matched lines are null; line 2's category is G2 set by rule `C-2`). The first nine:

1. unknown vs false;
2. a group with any, all and not;
3. a quantity cap;
4. category order: who wins;
5. a history window;
6. benefit category 66's fields side by side (`benefit`, `approvalLimit`, `copayPct`, `copayMax`), which answers the
   owner's "limit of 10,000" question;
7. the same benefit code at a different payer;
8. the cross-line SKU 200021 check (`request.lines`);
9. a Raw near-miss (`qty`).

A **Lessons** picker loads a lesson as the current experiment, with its explanation shown. **Check** compares the
door's latest answer with the assertion and says met, or names what differs. Editing a loaded lesson is allowed;
Check then tells whether the change still meets it.

## Spine reach

store/logic (assertion type + check) · component (picker, explanation, Check) · i18n (lesson texts en + ar) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `lessonCheck` — an outcome meeting the assertion is met; each assertion kind (matched null, a trace value, a
      verdict field, an intake ignore) names its difference when not met — pure
- [ ] `lessons.test.ts` — every lesson decodes through the experiment codec, and its EN and AR texts exist — pure
- [ ] drive: load lesson 1 and Check (stub answers to the lesson) → met; change the data so it fails → the
      difference is named — flow

## Boundaries

No new door. Lesson 8 uses `request.lines` as JSON, so it does not need 681. Lesson 9 needs Raw (684).

## Done when

All nine lessons load, and Check judges them against the stub. Vitest and drive are green.

## Blocked by

[684](684-a-raw-experiment-sends-its-text-as-is-and-the-intake-report-lists-what-was-read-ignored-and-refused.md),
[687](687-experiments-are-kept-by-name-in-the-browser-and-exported-or-imported-as-a-versioned-json-file.md)

## Open questions

- The expected results are authored against stubs. 691 must re-run every lesson's Check on the live door, and correct
  an assertion only after confirming the engine (not the lesson) is right.
