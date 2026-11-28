---
status: open
spec: 1006
blocked-by: BackOffice 4485
---

# 1007: The agent picks the order type and sees what a switch took off

Client half of spec 1006, decisions **D1**, **D10** and default **A**.

## What to build

- **The picker.** One segmented control in the header column, beside the source:
  - the options are *Phone order · Wasfaty · Nphies* (en and ar);
  - it shows only the types in `capabilities.orderTypes`, and is hidden when only `Ordinary` is offered;
  - choosing a type sends `setOrderType`.
- **Telling a prescription order apart.** A Wasfaty or Nphies order shows its type as a badge on the order
  title and the receipt, so it is never mistaken for a phone order mid-call.
- **The switch notice.** When `removed` is non-empty, one dismissible line reads, for example, *"Wasfaty
  order: 2 promotions and coupon SAVE10 were removed"*. Nothing shows for an empty `removed`.
- **The promotions panel** on a Wasfaty or Nphies order says *Offers don't apply to prescription orders*
  instead of listing near-misses.

## Proof

- [ ] vitest: the picker's offering from capabilities, and the notice text for coupons, promotions, both and
  none (en and ar).
- [ ] A console test from stubbed states: an Ordinary order with a fired offer, switched to Wasfaty, shows
  the notice, the badge and the empty-panel line.
- [ ] typecheck, vitest, lint.
