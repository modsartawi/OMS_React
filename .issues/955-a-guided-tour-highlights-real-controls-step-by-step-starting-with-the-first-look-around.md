---
status: open
spec: BackOffice 4182
blocked-by: 952, BO 4188
---

# 955 — A guided tour highlights real controls step by step, starting with the first look around

Spec: BackOffice `C:\Work\DMSCO\BackOffice\.issues\4182-the-analytics-help-center-in-english-and-arabic-read-by-the-copilot-spec.md`.
This is the later slice; it starts after BO 4187.

## What to build

- **The tour engine** in `src/features/help/tours/`:
  - It reads the tours from the table of contents (BO 4188).
  - It navigates to a step's `route` and highlights the element with `data-tour="<target>"`, with a callout holding
    the step's title and body and Next, Back and Leave buttons.
  - It works in both languages and directions.
- **Steps tick themselves** when they carry a `ticksWhen` check that the app knows (registered in one place). This
  follows the report designer's `tutorial.ts` precedent: the tour never asks "did you do it?".
- **Leaving is always possible:** Escape or Leave ends the tour at any step and restores the page. A tour never
  blocks a dialog or a save. If a target is missing, the step says "this part has moved" and offers Next. It never
  hangs.
- **Starting a tour:** from the help center's tour list and from the Home card.
- **The first tour,** `first-look`: the `data-tour` ids are added to the menu, Home, the library chips, search and the
  "?" button.

## Spine reach

UI (tour engine, `data-tour` ids on the first tour's controls)

## Proof (→ `tdd` red-green cycles)

- [ ] Each `first-look` target exists on its page (render each page, find each id from BO 4188's target list) · vitest
- [ ] Leaving at every step restores the page · vitest
- [ ] A missing target shows the "moved" step instead of hanging · vitest
- [ ] A `ticksWhen` step advances when its check turns true · vitest

## Boundaries

- Only `data-tour` attributes are added to existing components; no layout change.

## Done when

The proofs are green, and on dev the first look around runs end to end in both languages.

## Blocked by

[952](952-a-help-button-on-every-analytics-page-opens-its-article-and-home-and-the-copilot-point-to-the-help.md),
BackOffice [4188](C:\Work\DMSCO\BackOffice\.issues\4188-the-four-guided-tours-are-written-in-english-and-arabic-and-served-with-the-help.md)
