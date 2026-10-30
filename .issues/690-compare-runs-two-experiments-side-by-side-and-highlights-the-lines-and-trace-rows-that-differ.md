---
status: done
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

- [x] `compareDiff` — equal outcomes give no highlight; a flipped `when[1]` on line 2, a line matched only in B, and a
      differing read value are each flagged by key; a one-sided row is marked — pure
- [x] drive: duplicate, change one quantity in B, see the differing line and trace row highlighted — flow

## Boundaries

No new door (two calls to Evaluate).

## Done when

Two experiments run side by side with their differences highlighted. Vitest and drive are green.

## Blocked by

[686](686-the-read-log-shows-what-the-engine-read-on-each-line-and-an-explain-paragraph-reads-the-outcome-in-words.md),
[687](687-experiments-are-kept-by-name-in-the-browser-and-exported-or-imported-as-a-versioned-json-file.md)

## Comments

- 2026-10-30 (690 built, branch `impl/3243-690`). vitest `compare-diff.test.ts` (6) + `i18n-keys.test.ts` (+2, en+ar);
  drive `tools/insurance-playground-compare-drive.mjs` 46/46 (LTR + RTL) on the new `// --- 690 ---` stub
  (`playgroundCompareStub` = 677 evaluator + 686 reads + 678 verdict). typecheck, lint, test, build green.
- **Layout:** `compare-diff.ts` (pure): `sideOf(kind, reply, fields)` → `{ view, verdict, reads }` (the Outcome pane's
  readers) and `compareDiff(a, b)` → lines paired by number, trace rows by `line|ruleId|blockPath`, read rows by
  `line|ruleId|blockPath|path` (a repeated key takes `#2`), each `same | differs | onlyA | onlyB`; the verdict per line
  (+ the coverage invoice) compared whole; `same` = nothing differs anywhere. A trace row compares its `value` only
  (HQ's `why` is not compared). `ComparePanel.tsx` owns B: its two JSON boxes, its own `latestWins` runner (so two
  Evaluate calls) and the side-by-side (`A | B` columns per line, trace, reads; two `VerdictPane`s). The page holds
  only `compareSeed` (B's boxes at the moment Compare is turned on) and a Compare A/B / Leave Compare button.
  `TraceValueBadge` (OutcomePane) and `Shown` (ReadLog) are now exported for reuse.
- **Decisions (overrulable):** B shares A's kind and "as of" (only data + rule are B's own); switching kind while
  comparing re-copies B from the new kind's seed; opening an experiment (687) while comparing does NOT re-copy B.
  B copies A's Raw text when A is on the Raw tab (then B's data box is raw text), otherwise the JSON (the Form tab maps
  to JSON). Leaving Compare unmounts B (it is not kept). A reader-error side has no lines: the other side's lines
  read "only in". The A/B side words are letters (أ / ب in Arabic).
- **Shape guesses for 691:** none new — it reads through 677/678/686's readers.
