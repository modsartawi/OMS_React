---
status: done
spec: BackOffice .issues\3633-the-copilot-keeps-a-readers-own-readings-on-a-tap-spec.md
blocked-by: BackOffice 3687, 892
---

# 893 — The named-set card shows the name and its members, with Keep and Not now

## What to build

BackOffice spec 3633 R20: the card for a proposed named set: the name, each member with its kind, Keep and Not now,
and the refusal reason when the reader is at the limit.

## Proof (→ `tdd` red-green cycles)

- [x] The card shows the name and members and sends Keep · oms-react tests
- [x] A refusal at the limit is shown with a link to the page · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3687.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3687, 892

## Build notes

Built 2026-11-12 on `t893` (from `spec/3633`). Contract in `src/core/models/copilot.ts` (`namedSet` on the answer as
`CopilotNamedSetProposal`, `CopilotNamedSetKind`, `CopilotProposedMember`, the Keep body and answer), as 3687 wrote it.

- Tests: `answer.test.ts` (the card's name and every member in order with its kind, in either language; a proposal
  missing its id, name, a known kind or a keyed member draws no card), `conversation-store.test.ts` (Keep sends
  `{conversationId, proposalId}` and the card shows the server's line; `COPILOT-434` is state `full` with the server's
  message and Keep kept to try again after a delete; `COPILOT-435`/`433` close the card, words kept, buttons gone; Not now
  calls nothing), `api.test.ts` (the door's path). typecheck, 10340 tests and the lint gates green (boundaries: only
  the known base violation).
- Card state reuses 892's offer store keyed by the proposal id, adding one state, `full`. Keep refreshes `GET Copilot/Me`
  and links "What the copilot knows about me"; the same link shows beside the limit's reason.
- Only the panel's thread draws the card (`Answer`'s optional `readings`); the house-rules Try box does not.
- Each member is drawn by its server label, which names its kind (`Jeddah (city)`); the name is drawn as given.
- Not driven against a live SIS.Api (RTL is not installed; no drive was written).
