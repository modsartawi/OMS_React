---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 695
---

# 696 — The field proposals inbox approves or rejects, by someone other than the author

## What to build

Story 21; 3262 V6; door 3282. A list of proposed FHIR fields. Opening one shows its path, its Probe result per payer,
its labels and any Patient warning. A grant holder who is not the author approves or rejects it. An approved field joins
the catalog and the picker at once. The author sees why approval is not offered on their own proposal.

Reuse the role split of `core/insurance-rules/approval` where it fits.

## Spine reach

model/api (proposals, approve, reject) · store/logic (who may act) · component (inbox, detail) · i18n (en + ar) ·
test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] who may act: author, other grant holder, reader — pure
- [x] a server refusal of an own approval shows the door's message and code, not "unexpected" — flow
- [x] propose as one user, approve as another, find the field in the picker; reject another with its reason — flow

## Boundaries

The client hides the action, and the door still decides. Patient warning text is a locale key with `{{path}}` isolated
by `fsi`. Doors stubbed; 711 reconciles.

## Done when

No single person adds a field, and an approved field can be picked without a reload.

## Blocked by

695.

## Comments

**2026-10-30, built on stubs.** Drive `tools/insurance-fhir-696-drive.mjs` passes 64/64 in LTR and RTL. It is stubbed, with no live SIS.Api.

Door shapes guessed (3282 spells none; 711 reconciles):

- `GET InsuranceRules/Fields/Proposals` → `{ proposals, viewer: { approver } }`. This area has no grant probe, so the reader is told apart by `viewer` on the list. With no `viewer`, the client treats the session as a grant holder and HQ refuses (the `approval.ts` precedent).
- A proposal row is 695's `FieldProposalBody` plus `id`, `state` (`proposed` | `approved` | `rejected`), `proposedBy`, `proposedAt`, `probe` (`{ payers, refusals }` or null), `patientWarning` (boolean), `decidedBy`, `decidedAt`, `rejectReason`.
- `POST …/Fields/Proposals/{id}/Approve` with `{}`, and `POST …/Fields/Proposals/{id}/Reject` with `{ reason }`. Each answers the row.
- Refusal codes, in the stub only: `INSFIELDS_SELF_APPROVAL`, `INSFIELDS_PROPOSAL_DECIDED`, `INSFIELDS_PROPOSAL_NOT_FOUND`, `INSFIELDS_REASON_REQUIRED`. The client shows whatever code the door sends and branches on none.

`patientWarning` is the door's finding, because the client never parses a path. 697 should not send it: the door flags a Patient path when it takes the proposal.

Overrulable decisions:

- The inbox is its own leaf, `/insurance-rules/field-proposals`, with a menu entry `menu.fieldProposals`, and its code lives in `features/insurance-rules/fields`.
- The author cannot approve or reject their own proposal. There is no withdraw.
- Approve has no extra confirm, because the dialog is the review. A written rejection reason asks before it is thrown away.
- A reject reason is required, on the ticket's "with its reason".
- An unknown user or author offers no action and no explanation, rather than claiming authorship (704's `approveStanding` says `ownProposal` there).
- Order: waiting first, oldest first; then decided, newest first.

**2026-10-30, review fixes (branch `t3271-review-fix`), all stubbed.** The second-person comparison is now `authorshipOf` in `core/insurance-rules/approval`, with its test (also 704, 705, 707). Each screen's standing is unchanged.
