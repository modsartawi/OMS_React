# HITL log — ticket 398 (lenses narrow the loaded rows, with counts)

## Q: The grid bar keeps Open Order, Open Delivery and the old ViewManager, which L9 does not list. Drop them now?
**Decision taken:** Kept all three. Only the order changed: Columns now sits before Export (368 §1). The row pill replaces "Hit Count".
**Why:** ViewManager is retired by 400 by name. No ticket in 380–409 names Open Order / Open Delivery, and removing a shipped control is not this slice's call.
**Revisit if:** The owner confirms L9's list is exhaustive. Then a later slice, or 400, drops the two Open buttons; the inspector's "Open full record" already covers the delivery.

## Q: "12 of 40 shown" — one isolate (ticket Boundaries) or one per value?
**Decision taken:** Each number is isolated on its own through `<Trans>` slots, and the locale carries "of". "200+" and "8+" are one value, isolated once.
**Why:** `.claude/rules/bidi.md` says a value pair written with words needs each value isolated and nothing more, because the words carry the order. `formatCount`'s "12 / 40" would drop the ruled wording "12 of 40 shown".
**Revisit if:** An Arabic translation needs the whole phrase as one LTR run. That would be a locale change, not a code change.

## Q: Is the cut-off Limit the one the client sent, or the one the server applied?
**Decision taken:** The client's effective Limit (`effectiveLimit(criteria)`, the same value `buildDeliveryQuery` sends). The page counts as cut when rows ≥ Limit.
**Why:** The response carries no limit. L2 rules on `rows.length === Limit`.
**Revisit if:** SIS.Api caps Limit below what was asked. Then `isCut` never fires, and the live door (S3 sign-off) should check.

## Q: What do the counts read after a failed search, and does the lens survive a new search and a drill-down?
**Decision taken:** A failed search shows its error instead of the grid, and the counts read "—". The lens lives in the in-memory search store: it survives a new search and a trip to Details. A current row that the lens hides is deselected, so the inspector clears.
**Why:** No loaded rows are on screen after a failure. R-8 restores the working state on return. An inspector showing a row the grid hides would contradict "one current row".
**Revisit if:** 400's saved views want a new search to reset the lens.

## Q: The foundation drive waited for an Arabic Reason cell that the 220px rail pushes past column virtualisation at 1600px.
**Decision taken:** The drive now scrolls the grid toward its inline end until the Reason column renders, then checks as before. It is back to its 1294/1302 baseline (the 8 topbar/bell failures pre-date this wave's 391).
**Why:** The failure is in the drive's assumption about layout, not in the product.
**Revisit if:** The rail's width changes again.
