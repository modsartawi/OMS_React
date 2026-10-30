---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 706
---

# 707 — Label overrides are approved by a second person, and the worklist ranks what lacks Arabic

## What to build

Stories 65, 66; L12, L13; door 3297. On the Code labels screen, a member writes an Arabic or corrected English label for
a code, and someone who is not its author approves it. The **curation worklist** lists the codes a ruleset can show that
lack Arabic, then the codes seen but unlabelled, most-used first. Its rows open the override editor, so nobody faces the
full 1,682 error codes.

## Spine reach

model/api (worklist, propose, approve) · store/logic (form rules, who may act) · component (worklist, override editor) ·
i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] the form needs at least one of EN or AR; who may approve — pure
- [ ] the order is the door's and the grid keeps it on load — flow
- [ ] open a worklist row, write Arabic, approve it as another user, and the row leaves the list — flow

## Boundaries

Never offer a machine translation. A label is `<bdi>`, a code is `Ltr`. Doors stubbed; 711 reconciles.

## Done when

Pharmacists' Arabic comes from checked text, and the team works from the codes that matter.

## Blocked by

706.

## Comments
