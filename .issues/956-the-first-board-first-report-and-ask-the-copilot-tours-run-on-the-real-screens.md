---
status: open
spec: BackOffice 4182
blocked-by: 955
---

# 956 — The first-board, first-report and ask-the-Copilot tours run on the real screens

Spec: BackOffice `C:\Work\DMSCO\BackOffice\.issues\4182-the-analytics-help-center-in-english-and-arabic-read-by-the-copilot-spec.md`.

## What to build

- **The `data-tour` ids** for the three task tours, from BO 4188's target list:
  - `first-board`: new board, add a view, filter, save, share.
  - `first-report`: designer, run, print, schedule.
  - `ask-copilot`: ask, open the answer as a view, save it, ask a how-to question.
- **The `ticksWhen` checks** these tours name, registered in the engine. Examples: a draft board holds a panel; the
  report was run; the Copilot answered.
- **Access:** a tour step that needs Author access tells a Viewer so and offers Leave, instead of pointing at a
  button they don't have.

## Spine reach

UI (`data-tour` ids, tick checks)

## Proof (→ `tdd` red-green cycles)

- [ ] Each target of the three tours exists on its page · vitest
- [ ] Each `ticksWhen` check turns true from the state it names · vitest
- [ ] A Viewer on an Author step sees the access sentence · vitest

## Boundaries

Only `data-tour` attributes and tick checks; no layout change.

## Done when

The proofs are green, and on dev each tour runs end to end in both languages.

## Blocked by

[955](955-a-guided-tour-highlights-real-controls-step-by-step-starting-with-the-first-look-around.md)
