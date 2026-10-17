---
status: open
spec: BO 2737 (brief); needs the BO asks listed in 520
blocked-by: 524, 527, 528
---

# 529 — Access probes, the coupon finder and Customers, on the doors BackOffice adds

Split out of [520](520-the-rule-campaign-screens-call-the-real-doors-on-staging.md) on 2026-10-17. ⚠
**Blocked outside this repo** on BO asks **B** (access probes) and **D** (coupon finder + member reads),
listed in 520.

## What to build

- **Access probes.** The repo's pattern is a cookie-only `X/Access` door answering booleans, fed to
  `accessProbe(...)` in `layout/menu-model.ts`. The rule doors have none: their grants are
  `RuleAuthoring[03|02|06]`, `RuleSupport[03|02]` and `RuleEngineSwitch[03|02]`, and a missing grant is a
  bare 403. Once ask B lands, gate the Campaigns group (03), author actions (02), approver actions (06), the
  support leaves (RuleSupport 03), Cancel (02) and the engine switch (RuleEngineSwitch 03 / Flip 02).
  Replace 511's invented `Roles` door with the probe.
- **Coupon finder (519).** No door in 2754 or 2755. Re-point once ask D names one, or retire the leaf.
- **Customers (519).** No member, wallet or budgets-used door. `Rules/Authoring/Budgets` sums over every
  key, so it is not per member. Re-point once ask D names one, or retire the leaf.

## Proof

- [ ] menu probe tests for each grant · pure
- [ ] finder + customers drives re-stubbed on the real shapes, green · flow

## Done when

Every rule screen is gated by a real probe, and the two support leaves call real doors or are retired.
