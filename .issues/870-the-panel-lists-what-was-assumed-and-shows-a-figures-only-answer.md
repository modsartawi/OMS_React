---
status: done
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3586-copilot-answers-you-can-trust-and-a-next-step-spec.md
blocked-by: BackOffice 3590, BackOffice 3594
---

# 870 — The panel lists what was assumed under any answer, and shows a figures-only answer as its sentence above the tables

## What to build

BackOffice spec 3586, "The web half"; tickets 3590 and 3594.

- The panel shows the answer's `assumptions` under every answer, in the reader's language, not only under a report
  answer. They sit under the answer and are not mixed into it.
- An answer whose `outcome` is `figures-only` is shown as its fixed sentence above the tables, with the list of
  lookups, and is not styled as an error.
- An answer with no assumptions, and any other outcome, renders exactly as today.

## Proof (→ `tdd` red-green cycles)

- [x] A plain answer with two assumptions lists both under the answer, in the panel's language · oms-react tests (the panel's answer tests)
- [x] An answer with no assumptions renders as today · oms-react tests
- [x] A `figures-only` answer shows its sentence above its tables and its lookups · oms-react tests
- [x] A `figures-only` answer with no tables shows its sentence and its lookups · oms-react tests

## Boundaries

Switched by the server (`Copilot:Answers:*`): with the switches off the panel sees today's answer and behaves as today.
Pure-function tests, where the panel's answer tests already are.

## Done when

Proof boxes ticked.

## Blocked by

BackOffice 3590, BackOffice 3594
