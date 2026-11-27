---
status: open
spec: BackOffice 4412
blocked-by: BO 4429
---

# 982 — The finding card's early-warning form, in the brief and on the opening screen

Spec: BackOffice `E:\Projects\BackOffice\.issues\4412-the-copilot-warns-early-explains-the-nights-top-warnings-and-opens-on-them-spec.md`.

## What to build

The shared finding card (built with 950) gains an early-warning form: the figure against what was expected, the
basis, a colour by good or bad direction, the explanation's words as stored, the "open since" date, and Open. The
brief's "what changed overnight" shows the night's explained early warnings in it, with the same stored words the
opening screen shows. A warning without words (not reached, or a failed check) shows its figures only.

## Spine reach

route → page

## Proof (→ `tdd` red-green cycles)

- [ ] an early-warning finding renders its figure, expected value, direction colour and open-since date · vitest
- [ ] a warning without words renders its figures only · vitest
- [ ] the brief and the opening screen render the same card from the same finding · vitest

## Boundaries

Front end only. The brief's layout is unchanged apart from this card form.

## Done when

The tests are green, and on dev the brief and the copilot show the same words for the same warning.

## Blocked by

BackOffice 4429 (`E:\Projects\BackOffice\.issues\4429-the-opening-screen-route-the-briefs-what-changed-overnight-and-the-command-center-tool-return-the-explained-warnings.md`)
