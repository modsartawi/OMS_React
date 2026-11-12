---
status: done
spec: BackOffice C:\Work\DMSCO\BackOffice\.issues\3586-copilot-answers-you-can-trust-and-a-next-step-spec.md
blocked-by: BackOffice 3593
---

# 874 — A curator edits and tries the default readings on the house-rules screen

## What to build

BackOffice spec 3586 A23, A25, A56, "The web half"; ticket 3593.

- The house-rules screen gains the default-readings text beside the house rules, with its own limit of 2,000
  characters and its own counter.
- One save sends both texts and makes one version. The history shows each version's default readings, and a rollback
  brings both texts back.
- "Try" sends the draft default readings with the draft house rules.
- A version with no default-readings text shows the built-in text the server returns.
- A refusal that names the default readings marks that field, not the house rules.

## Proof (→ `tdd` red-green cycles)

- [x] The screen's view model carries the default readings from the read door, and the built-in text when the version has none · oms-react tests (the house-rules tests)
- [x] A save request carries both texts and the base version · oms-react tests
- [x] A try request carries the draft default readings · oms-react tests
- [x] 2,001 characters disables the save and shows the limit; 2,000 is fine · oms-react tests
- [x] A refusal naming the default readings marks that field · oms-react tests

## Boundaries

The default readings do not use the house rules' 4,000 characters.

## Done when

Proof boxes ticked.

## Blocked by

BackOffice 3593
