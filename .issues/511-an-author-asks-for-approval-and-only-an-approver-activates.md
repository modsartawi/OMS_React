---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 508
---

# 511 — An author asks for approval and only an approver activates

## What to build

The dashboard's **pre-activation steps** (named, rules valid, schedule set, budgets considered…) each tick or link
to the page that fixes them. The actions follow the **role split** (BackOffice 2759, Ua):

- an **author** sees **Ask for approval** (with a note), which is disabled while 508's checks hold an error, and
  **Delete draft**, which asks for confirmation;
- an **approver** sees the pending changes and **Activate**, **Send back** (with a note) or **Disable**;
- an author never sees Activate, and the server's refusal is the backstop, shown with its envelope message and code.

The list's state tiles and the dashboard's State follow each transition.

## Spine reach

model/api (ask, activate, send back, disable, delete, the caller's role) · logic (which actions for which role
+ state) · component (dashboard actions, steps) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `actionsFor_authorNeverActivates_approverCan` — every state × role · pure
- [ ] `preActivationSteps_tickFromTheDraft` · pure
- [ ] drive: author asks → approver activates; send back; a refused activate shows the envelope message (stubbed) · flow

## Boundaries

Provisional lifecycle endpoints + new Ua permissions (BackOffice 2759; owner grant owed), stubbed. Business
`success:false` codes surface through `apiErrorMessage` / `apiErrorCode`.

## Done when

The drive walks draft → waiting → live as two roles, and an author cannot activate.

## Blocked by

[508](508-the-checks-pill-points-at-the-rule-block-and-field-and-errors-block-approval.md)

## Open questions

- The approval contract's states are fog in BackOffice 2759 / spec 2737. Default: draft → waiting for approval → (sent back →
  draft) | live → disabled.
