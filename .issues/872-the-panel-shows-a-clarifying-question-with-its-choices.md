---
status: open
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3586-copilot-answers-you-can-trust-and-a-next-step-spec.md
blocked-by: BackOffice 3597
---

# 872 — The panel shows a clarifying question with its choices, and the box stays open for something else

## What to build

BackOffice spec 3586 A36–A40, "The web half"; tickets 3596 and 3597.

- An answer whose `outcome` is `asked` is shown as the question, in the reader's language, with its choices as
  buttons. It is not counted as a new question in the panel's question counter.
- A tap sends the reply with the ask's id and the chosen key, and the request says the question came from a choice.
- The question box stays open: text typed while an ask is pending is sent with the ask's id as the typed reply.
- An ask with no choices asks the reader to type the name again.
- Once answered, or once the reader asks something new, the choices can no longer be tapped.

## Proof (→ `tdd` red-green cycles)

- [ ] An `asked` answer shows the question and one button per choice, labelled in the panel's language · oms-react tests (the panel's answer tests)
- [ ] A tap builds a request with the ask's id, the chosen key and the origin "choice" · oms-react tests
- [ ] Text typed while the ask is pending builds a request with the ask's id and the text · oms-react tests
- [ ] An ask with no choices shows the question and leaves the box open · oms-react tests
- [ ] The asked half and its continuation count as one question in the panel's counter · oms-react tests
- [ ] After the continuation's answer the choices cannot be tapped · oms-react tests

## Boundaries

Switched by the server (`Copilot:Answers:AskUnclearName`).

## Done when

Proof boxes ticked.

## Blocked by

BackOffice 3597
