---
status: open
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

- [ ] `intakeView` — read, ignored-with-hint and refused-with-expected each become a row; an empty intake (data
      experiments) shows nothing — pure
- [ ] `evaluateBody` — the Raw tab sends `raw` and no `data`; the Form/JSON tabs send `data` and no `raw` — pure
- [ ] drive: send `{"lines":[{"qty":2}]}` as Raw, and the intake report shows `qty → quantity?` — flow

## Boundaries

BackOffice 3246 (raw). `PLAYGROUND_*` refusal for an unreadable raw text: shown in words with its code.

## Done when

A Raw experiment runs and its intake report teaches the near-miss. Vitest and drive are green.

## Blocked by

[677](677-a-guard-experiment-typed-as-json-runs-through-playground-evaluate-and-shows-the-matched-lines-or-nothing-matched-and-the-trace.md)
