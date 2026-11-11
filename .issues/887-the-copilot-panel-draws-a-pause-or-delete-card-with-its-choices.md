---
status: done
spec: BackOffice .issues\3631-the-copilot-proposes-a-personal-schedule-send-me-this-every-monday-spec.md
blocked-by: BackOffice 3665, 885
---

# 887 — The copilot panel draws a pause or delete card, with up to 4 choices when the words matched several

## What to build

BackOffice spec 3631 S32, its web half: the `pause` and `delete` kinds of `proposal` on the card of 885.

- One match: the card names the schedule and the action. Several: up to 4 choices, one must be picked before Confirm.
- Confirm sends the chosen schedule with the proposal's id; the answer is the server's sentence.

## Proof (→ `tdd` red-green cycles)

- [x] A `pause` card with one match confirms it · oms-react tests
- [x] A card with choices keeps Confirm off until one is picked, and sends that one · oms-react tests
- [x] A `delete` card says the report is deleted with it · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3665.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3665, 885

## Build notes

Built 2026-11-12 on `t887` (from `spec/3631`). Proofs: `src/features/copilot/proposal-stop.test.ts` (6 cases: the pure card
seam `proposal.ts` and the conversation store with `Copilot/Ask` stubbed), one `describe` per Proof box. Full suite,
typecheck, and lint (bar the base boundary failure in `insurance-rules/aliases/door-shapes.test.ts`) green. Not driven in a
browser.

- **Contract** in `src/core/models/copilot.ts`, 3665 verbatim: `CopilotProposal.choices` (`CopilotProposalChoice`),
  `CopilotProposalValues.choice`, `CopilotConfirmationValues.choice`, `CopilotAnswer.stopped` (`CopilotStopped`), and
  `scheduleRefusal.reason` `notFound`.
- **The card** (`proposal.ts`): `proposalCard` now also draws a `pause`/`delete` proposal offering at least one schedule
  (`ProposalCard` gains `kind`, `destructive` and `choices`). With several choices the server's `- <title>, <when>` lines
  are dropped (the choices are drawn as a radio list) and `values.choice` is null until one is picked; with one it is
  preset. `cardReady(values, card)` wants one of the card's own choices. `confirmationBody` sends
  `{ proposalId, values: { choice } }`, `values: {}` on a one-choice card. `stoppedNote(reply)` reads a confirmed
  pause/delete; `choiceProblem(conv, proposalId)` is `COPILOT-441`'s `problems[0].message` while the latest confirmation of
  that proposal was refused so.
- **The panel** (`ProposalCard.tsx`): a pause/delete card draws `StopChoices` (radio list, the 441 message beside it) instead
  of the schedule fields; Confirm reads Pause / Delete, drawn `danger` on Delete; the "My schedules" link sits under a
  confirmed pause/delete; any `confirmed` answer rereads My schedules (`rereadMySchedules`). `notFound` is the server's
  sentence on a `not-confirmed` turn; the card stays open. New words `proposal.label_*`, `confirm_*`, `choose_*` in en and ar.
