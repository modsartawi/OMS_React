---
status: open
spec: BackOffice .issues\3631-the-copilot-proposes-a-personal-schedule-send-me-this-every-monday-spec.md
blocked-by: BackOffice 3663, BackOffice 3664
---

# 885 — The copilot panel draws a `proposed` answer as a card the reader can change, confirm or cancel

## What to build

BackOffice spec 3631, its web half: the card, the confirm sentence and the expired state (S13, S17 to S19, S36, S37).

- A `proposed` answer of kind `schedule` is drawn as a card: the server's lines in the screen's language (what will be
  sent, the days, the time, how the period will be read, the reader's address), and the editable values: days, time,
  title, and the period choice when it is offered.
- **Confirm** sends the proposal's id with the card's values; **Cancel** sends a cancel. Neither re-asks the model.
- The confirm answer shows the server's sentence, the first send date and a link to "My schedules" (886).
- An expired offer shows "This offer has expired. Ask again." and no live button.
- The card is drawn from the server's text only; the panel writes no wording of its own about what was scheduled.

## Proof (→ `tdd` red-green cycles)

- [ ] A `proposed` answer draws the card with its lines and its defaults · oms-react tests
- [ ] Changing the day, time, title and period sends them on Confirm · oms-react tests
- [ ] Cancel sends a cancel; the expired answer shows no button · oms-react tests
- [ ] An answer with no `proposal` draws as today · oms-react tests
- [ ] Arabic screen: the card is right to left with the Arabic lines · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3663 and 3664. Draws nothing when the field is absent (switch off).

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3663, BackOffice 3664
