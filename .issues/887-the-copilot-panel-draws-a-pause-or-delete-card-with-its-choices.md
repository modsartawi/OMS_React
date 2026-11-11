---
status: open
spec: BackOffice .issues\3631-the-copilot-proposes-a-personal-schedule-send-me-this-every-monday-spec.md
blocked-by: BackOffice 3665, 885
---

# 887 — The copilot panel draws a pause or delete card, with up to 4 choices when the words matched several

## What to build

BackOffice spec 3631 S32, its web half: the `pause` and `delete` kinds of `proposal` on the card of 885.

- One match: the card names the schedule and the action. Several: up to 4 choices, one must be picked before Confirm.
- Confirm sends the chosen schedule with the proposal's id; the answer is the server's sentence.

## Proof (→ `tdd` red-green cycles)

- [ ] A `pause` card with one match confirms it · oms-react tests
- [ ] A card with choices keeps Confirm off until one is picked, and sends that one · oms-react tests
- [ ] A `delete` card says the report is deleted with it · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3665.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3665, 885
