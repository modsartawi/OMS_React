---
status: open
spec: BackOffice 4411
blocked-by: 975, BO 4413
---

# 976 — The panel shows a running investigation's steps, lets the reader leave or stop, and shows the finished answer's parts

Spec: BackOffice `E:\Projects\BackOffice\.issues\4411-the-copilot-investigates-a-why-question-to-its-cause-spec.md`.

## What to build

When an answer comes back with kind "investigation started" and an id, the panel polls the investigation's read
route and shows the progress card with the steps as the server labels them, never a tool name. The reader can leave
the panel and come back to it. When the status is done, the panel draws the answer's parts from the stored data:
the cause line with its share, "What I found" with one small table per level (the existing answer-table drawing),
"What I assumed" as read-only chips, "What I could not establish", and the foot with the data-as-of. The not-real,
spread-evenly, queued and failed states show their own words. The words are not streamed. Arabic is right to left
with Latin digits, as the number check reads them.

## Spine reach

route → page

## Proof (→ `tdd` red-green cycles)

- [ ] a started investigation polls its route and lists each new step in the reader's words · vitest
- [ ] a done investigation draws every part from the stored answer, nothing computed · vitest
- [ ] queued, failed, not-real and spread-evenly states each show their words · vitest
- [ ] Arabic lays the panel right to left and keeps Latin digits · vitest

## Boundaries

Front end only. Shown only when the server offers investigations (`Copilot:Investigations`).

## Done when

The tests are green, and on dev a "why" question shows its steps and its answer.

## Blocked by

[975](975-a-clickable-mock-of-the-investigation-panel-for-the-owner-to-react-to.md)
BackOffice 4413 (`E:\Projects\BackOffice\.issues\4413-a-why-question-starts-an-investigation-that-runs-as-a-stored-job-on-the-servers-path-and-returns-its-cause.md`)
