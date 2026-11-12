---
status: open
spec: BackOffice .issues\3632-sql-mode-the-copilot-writes-and-runs-one-guarded-select-and-its-answer-can-be-saved-spec.md
blocked-by: BackOffice 3672, BackOffice 3676
---

# 890 — The SQL editor runs a statement, shows a refusal at its line, saves revisions, restores one, and a curator verifies

## What to build

BackOffice spec 3632 Q44, Q45: the editor for a SQL item: the statement, Run (the door), the result, a refusal's reason
at its line and column, Save (a new revision), the revisions with their authors and Restore. A curator's Verify and
Unverify.

## Proof (→ `tdd` red-green cycles)

- [ ] Run shows rows, or the refusal at its line · oms-react tests
- [ ] Save and Restore call their doors and list the revisions · oms-react tests
- [ ] Verify shows for a curator only · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3672 and 3676.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3672, BackOffice 3676
