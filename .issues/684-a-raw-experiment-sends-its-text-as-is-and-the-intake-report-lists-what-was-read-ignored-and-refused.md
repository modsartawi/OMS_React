---
status: done
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; stories 18-20)
blocked-by: 677
---

# 684 — A Raw experiment sends its text as-is, and the intake report lists what was read, ignored and refused

## What to build

- A **Raw** tab in the Data pane: free text. When Raw is the active tab, the body carries `raw: "<text>"` and no
  `data` (exactly one of the two). The text is sent even when it is not valid JSON; the door says so.
- **Outcome tab A, intake report** (Raw only): the keys the engine **read**, the keys it **ignored**, each with its
  hint (`lines[0].qty → quantity?`), and the values it **refused** for the wrong type (`lines[0].price`, expected
  number). Paths are machine values (`Ltr`).
- Leaving Raw never overwrites the form/JSON dataset.

## Spine reach

model/api (`raw` body, `intake` reply) · store/logic (intake view model) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `intakeView` — read, ignored-with-hint and refused-with-expected each become a row; an empty intake (data
      experiments) shows nothing — pure
- [x] `evaluateBody` — the Raw tab sends `raw` and no `data`; the Form/JSON tabs send `data` and no `raw` — pure
- [x] drive: send `{"lines":[{"qty":2}]}` as Raw, and the intake report shows `qty → quantity?` — flow

## Boundaries

BackOffice 3246 (raw). `PLAYGROUND_*` refusal for an unreadable raw text: shown in words with its code.

## Done when

A Raw experiment runs and its intake report teaches the near-miss. Vitest and drive are green.

## Blocked by

[677](677-a-guard-experiment-typed-as-json-runs-through-playground-evaluate-and-shows-the-matched-lines-or-nothing-matched-and-the-trace.md)

## Comments

- 2026-10-30 (684 built, branch `impl/3243-684`). vitest: `intake.test.ts` (3), `experiment.test.ts` +4 (Raw sends
  `raw` and no `data`, even when not JSON; Raw does not read the data box; the rule box is still checked; JSON sends
  `data` and no `raw`), `i18n-keys.test.ts` extended. Drive `tools/insurance-playground-raw-drive.mjs` 52/52 (LTR + RTL,
  its own file so 678/686's edits to the 677 drive merge clean); the 677 drive still 64/64. typecheck, lint, test, build green.
- **Layout:** `DataPane.tsx` owns the Data pane's tab bar (`DataTab = 'json' | 'raw'` in `experiment.ts`; 682 adds
  `'form'`, which also sends `data`). `JsonPane` gained `tabs` (drawn under the title) and `children` (takes the box's
  place). Each tab keeps its own text in the page (`dataText`, `rawText`), so leaving Raw never overwrites the data.
  `evaluateBody({ …, dataTab, rawText })`: Raw → `{ kind, raw, document, asOf }`. `intake.ts` → `intakeView(reply.intake)`
  (null when empty, i.e. a data experiment); `IntakeReport.tsx` draws it after the lines on tab A; `OutcomePane` takes
  an optional `intake` prop. Not shown with reader errors (errors-only reply).
- **Decisions (overrulable):** the near-miss reads "lines[0].qty  did you mean quantity?" (words around an `fsi` hint)
  rather than a glued `qty → quantity?`, which would reverse under RTL; refused reads "expected number" with the
  type as HQ sends it (a machine word, untranslated). Sections order: ignored, refused, read; an empty section is not
  drawn. An empty Raw text is sent as `""` (the door refuses it).
- **Shape guesses for 691:** `intake.ignored[].hint` may be null/absent (no near-miss); entries without a `path` are
  dropped. The stub's unreadable-raw refusal code is `PLAYGROUND_RAW_INVALID` (400, envelope) — 3246 owns the spelling.

