---
status: done
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

- [x] `lessonCheck` — an outcome meeting the assertion is met; each assertion kind (matched null, a trace value, a
      verdict field, an intake ignore) names its difference when not met — pure
- [x] `lessons.test.ts` — every lesson decodes through the experiment codec, and its EN and AR texts exist — pure
- [x] drive: load lesson 1 and Check (stub answers to the lesson) → met; change the data so it fails → the
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

## Comments

- 2026-10-30 (689 built, branch `impl/3243-689`). vitest `lesson-check.test.ts` (8) + `lessons.test.ts` (13: each lesson decodes
  through `readExperiment`, en + ar title/explain). Drive `tools/insurance-playground-lessons-drive.mjs` 102/102 (LTR + RTL): all
  nine load and Check **met** against the stub; lesson 1 with line 1 given 120 days → not met, naming the matched lines and
  line 1's trace; Check waits while the edited experiment has no answer. 677/687/682/684/686 drives still green
  (116/60/52/52/46). typecheck, lint, test, build green.
- **Layout:** `lessons.ts` — `LESSONS` (id, a v1 experiment FILE, `expects`), `lessonExperiment` (through the codec),
  `lessonById`. `lesson-check.ts` — `LessonExpect` = `matched` (lines | null) · `trace` (line, ruleId, blockPath, value) ·
  `verdict` (line, field, value, ruleId?; guard `outcome`|`fired`, coverage a value key, category `category`|`group`|`source`) ·
  `ignored` (path, hint?); `lessonCheck(expects, { outcome, verdict, intake })` reads the answer through the Outcome pane's
  own view models. `LessonPanel.tsx` (picker + Load, title, explanation via `<Trans>` with `<c>` → `bdi dir=ltr`, Check,
  differences in words, every value `fsi`). Page: `<LessonPanel>` under `ExperimentBar`; `Answer` now carries the `body` it
  answers, and Check judges only an answer whose body equals the experiment as it stands (else "wait for the answer").
  Opening/importing an experiment or switching the kind unloads the lesson. Copy: `lessons.*` in `insurance-playground`.
- **Stub `// --- 689 ---`:** `playgroundLessonsStub` / `evaluatePlaygroundLessons` — Kleene evaluator for `line` (+ `anyOf`,
  `atMost`), `group` any/all, `not`, `request`, `eligibility` (fact `{ number }`), `history` (window back from asOf) and
  `formula` (`filter`/`lines`/`count`/`sum` over `$request.lines`). One edit to 678's `playgroundHolds`: only top-level rows
  (`when[n]`) decide, so a group's nested rows do not.
- **Shape guesses for 691:** nested trace path `when[i].conditions[j]`; lesson 8's expr
  `[">=", ["lines", ["filter", "$request.lines", ["==", "$line.item", "200021"]]], 2]`; history row `on`; eligibility
  keys `benefit[66].<field>`. Re-run every lesson's Check on the live door and fix an assertion only once the engine is
  confirmed right (open question above).
- **Decisions (overrulable):** 🚩 lesson 6 asserts the "limit of 10,000" is `approvalLimit` — it is the brief's own
  example fact; the owner must confirm against a real payer answer (pairs with 685's paste). Load is an explicit button
  (picking alone never overwrites the experiment). A Check result shows only for the answer it judged. The lesson
  experiment's name is the machine `lesson-<id>`. Lesson titles are numbered in the copy ("1. …").
