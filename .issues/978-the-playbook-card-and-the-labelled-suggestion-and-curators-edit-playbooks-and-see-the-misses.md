---
status: open
spec: BackOffice 4411
blocked-by: 976, BO 4416
---

# 978 — The playbook card and the labelled suggestion; curators edit playbooks and see the misses

Spec: BackOffice `E:\Projects\BackOffice\.issues\4411-the-copilot-investigates-a-why-question-to-its-cause-spec.md`.

## What to build

In the answer, "What to do" shows a cited playbook as a card: its steps, the role that acts, and a link to the
screen. With no playbook it shows the suggestion under the server's fixed label, visibly different from a card. On
the curators' page (beside the house rules), a Playbooks tab lists playbooks by function and cause, edits a draft in
English and Arabic, publishes it with the approving role and date, shows versions and rolls back. A second list shows
the playbooks readers needed and did not find, most asked first. A save the server refuses (a person's name, customer
data) shows its reason.

## Spine reach

route → page

## Proof (→ `tdd` red-green cycles)

- [ ] a cited playbook renders as a card with its role and screen link · vitest
- [ ] no playbook renders the labelled suggestion, never a card · vitest
- [ ] publish needs both languages and the approving role; rollback restores the previous version · vitest
- [ ] the misses list is ordered most asked first · vitest

## Boundaries

Front end only. The Playbooks tab needs the curator grant. Help updated (or why not): the copilot article gains the playbook card.

## Done when

The tests are green, and on dev a curator publishes a playbook that the next investigation cites.

## Blocked by

[976](976-the-panel-shows-a-running-investigations-steps-lets-the-reader-leave-or-stop-and-shows-the-finished-answers-parts.md)
BackOffice 4416 (`E:\Projects\BackOffice\.issues\4416-a-causes-playbook-is-cited-by-its-key-a-miss-is-labelled-and-counted-and-curators-keep-playbooks-with-versions.md`)
