# HITL — ticket 528 (engine switch on Rules/Switch/Flip + History)

## Q: When does the in-flight warning show, with no read before the flip?
**Decision taken:** Settled default applied: after a Rule → BonusBuy flip, from the flip reply's `inFlight`. The reason step says HQ lists it after the flip. A reply with `inFlight: null` closes the dialog.
**Why:** 2745 has no dry-run read; the flip never blocks.
**Revisit if:** the owner wants it before the flip. That needs BO ask C (a dry-run in-flight read).

## Q: Where does the store list come from?
**Decision taken:** Settled default applied: `POST Rules/Authoring/Lookups/stores { q }`, with the engine read from `detail`. It is called from the feature's own api.ts, not core/rules' `lookup`, which still points at the invented `RuleCampaign/Lookups/Stores` and is ticket 523's to re-point.
**Why:** the switch must call only real doors, and 523 owns the core lookup.
**Revisit if:** 523 re-points the core lookup. Then fold this call into it (one door, one place). Grant mismatch: the list needs RuleAuthoring, while the switch is RuleEngineSwitch, so a switch-only admin sees a "you do not hold its grant (RuleAuthoring)" banner. That is BO ask C.

## Q: The lookup answers at most 50 stores, with no engine filter. How does the list behave?
**Decision taken:** The search goes to HQ as `q` (debounced). The engine filter narrows HQ's answer in the browser. An answer of 50 shows "HQ answers at most 50 stores to a search: narrow it if a store is missing."
**Why:** there is no paged or engine-filtered store door.
**Revisit if:** the owner needs "every Rule store" listed. That needs BO ask C (a store list under RuleEngineSwitch).

## Q: The changed by / changed at / reason columns. The lookup answers none of them.
**Decision taken:** Dropped from the grid. The history pane now shows the engine now, and who set it and when (History's `store`), above the flips.
**Why:** the new shape forces it; no invented field.
**Revisit if:** BO ask C's store list carries the last flip.

## Q: The flip body has no `from`, so a stale list can ask for the engine the store is already on.
**Decision taken:** When the reply's `fromEngine === engine`, the toast says "{store} was already on {engine}" instead of "flips to".
**Why:** HQ records the no-op flip; saying "flips" would be false.
**Revisit if:** HQ starts refusing a no-op flip.
