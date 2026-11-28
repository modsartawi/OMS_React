---
status: open
spec: 1006
blocked-by: 1008, BackOffice 4488
---

# 1009: A prescription that already has an open order is confirmed before submit

Client half of spec 1006, decision **D5**.

## What to build

`pendingConfirmation.kind: activePrescription` is a modal, like `belowAtp` (spec 160: *both kinds are modal*).

- **The modal:** *"This prescription already has an open order, {{documentNo}}. Place another one?"*, with
  the buttons *Go back* and *Place anyway*.
- *Place anyway* re-sends submit with the `confirmToken`.
- *Go back* leaves the order open and unchanged.
- The modal follows the console keyboard grammar (ticket 153): Esc is *Go back*, and Enter does not confirm by
  default.

## Proof

- [ ] vitest on the modal's copy (en and ar), and on its token being sent once.
- [ ] A console test: a stubbed `activePrescription` opens the modal; *Place anyway* submits with the token;
  *Go back* sends nothing.
- [ ] typecheck, vitest, lint.
