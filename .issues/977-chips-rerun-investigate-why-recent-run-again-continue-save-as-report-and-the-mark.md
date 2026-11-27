---
status: open
spec: BackOffice 4411
blocked-by: 976, BO 4415, BO 4418
---

# 977 — Chips rerun, "Investigate why", Recent investigations, Run again, Continue, Save as report and the mark

Spec: BackOffice `E:\Projects\BackOffice\.issues\4411-the-copilot-investigates-a-why-question-to-its-cause-spec.md`.

## What to build

The investigation's actions. A chip offers the other readings and choosing one starts a new investigation with it.
"Investigate why" under an ordinary answer starts one from that answer. Stop (while running) keeps what was found.
Continue (after a budget stop) starts the next investigation. Run again starts a fresh one on today's data. "Recent
investigations" opens from the panel header, newest first, with question, date, cause line and status; opening one
shows its stored figures with their date. Delete removes one. Save as report saves its tables as a report. 👍/👎 is
the mark on the investigation.

## Spine reach

route → page

## Proof (→ `tdd` red-green cycles)

- [ ] choosing another reading on a chip starts a new investigation and shows it · vitest
- [ ] Investigate why appears first among the suggestions and starts from that answer · vitest
- [ ] Recent lists newest first and reopens with the stored date · vitest
- [ ] Stop, Continue, Run again and Delete each call their route · vitest

## Boundaries

Front end only. Behind `Copilot:Investigations`.

## Done when

The tests are green, and on dev a reader reopens last week's investigation and runs it again.

## Blocked by

[976](976-the-panel-shows-a-running-investigations-steps-lets-the-reader-leave-or-stop-and-shows-the-finished-answers-parts.md)
BackOffice 4415 (`E:\Projects\BackOffice\.issues\4415-an-investigation-keeps-to-its-budget-and-a-stopped-or-budget-ended-one-keeps-what-it-found-and-offers-continue.md`)
BackOffice 4418 (`E:\Projects\BackOffice\.issues\4418-an-investigation-starts-from-any-answer-reruns-with-another-reading-and-is-reopened-asked-about-marked-and-deleted.md`)
