# HITL log — ticket 399 (the search is a bar of tokens)

## Q: Where does `/` put the caret — the bar, the first token, or + Filter?
**Decision taken:** On + Filter, as the 368 prototype did (`data-query-focus` on + Filter). The key layer prevents the press. `/` is a registered command ("Focus the search bar") with `keys: 'Slash'`, so it also appears as a palette row and in the shortcuts sheet, like `I`.
**Why:** The bar has no text box. + Filter is the bar's one always-present entry point, and under 393 a key is a field on a command, so every keyed command is a palette row unless it is hidden navigation (J/K).
**Revisit if:** The owner wants `/` to open + Filter's menu straight away, or does not want the palette row (then add `hidden: true`).

## Q: Does a failed search count as "Search ran" for the pending flags?
**Decision taken:** No. The last-run query is recorded only when the read comes back. A failed search shows its error card, and its edits stay dashed amber with "N changes not searched" and the dot. Discard goes back to the criteria that last came back. Both review passes asked for this, and the drive checks it.
**Why:** "Flagged until Search runs" is meant to stop an operator reading a result that does not match the criteria on screen. A failed search produced no result for its criteria.
**Revisit if:** The owner reads "runs" as "is attempted".

## Q: Picking Date from + Filter — start blank or at a preset?
**Decision taken:** At Today, as the prototype did. The token shows as an added (amber) change until Search runs or × drops it.
**Why:** A `<select>` of presets has no blank state worth showing, and Today is the cheapest range.
**Revisit if:** Operators find a Date token they did not mean to keep after closing the popover.

## Q: A Custom date missing one end — a filter or not?
**Decision taken:** Not a filter. It has no token once its popover closes, raises no flag, and sends nothing (the old panel also sent FromDate/ToDate only with both ends). Choosing Custom seeds today–today, so it starts complete.
**Why:** The /code-review pass found that a "Date: Custom" token read as applied while the request carried no range.
**Revisit if:** A one-sided range ("from X onward") is wanted. That needs a contract change (BuildDeliveryQuery sends both ends or neither).

## Q: The Delivery type options `Delivery` / `PickInStore` show as raw strings.
**Decision taken:** Carried over unchanged from FilterPanel. They are the WPF wire values (R-3), and the grid's Delivery Type column shows the same raw strings.
**Why:** Translating them in the bar alone would make the token disagree with the grid column. A label map is a separate change that covers both.
**Revisit if:** The Arabic locale lands. Then give these values `t()` labels in both the bar and the grid.

## Q: The empty-state copy said "select Load", and Load is gone.
**Decision taken:** `deliveries:emptyPrompt` now reads "No search yet. Set the criteria above and select Search." The grid-stays-mounted empty states (L10) and "pick a view" copy are 400's.
**Why:** The old copy named a button that no longer exists.
**Revisit if:** 400 rewrites the empty states.

## Q: Other drives clicked "Load".
**Decision taken:** foundation, command-palette, grid-theme, oms-access, palette and screen1-smoke now target Search. The foundation drive's "scroll is locked under the drawer" check gets a 2000px spacer, because the one-line bar no longer makes the 390px page scrollable. The lock itself was unchanged: overflow was hidden and scrolled was 0. command-palette's sheet check now expects J, K, /, I.
**Why:** These were drive assumptions about the old panel's height and label, not product regressions.
**Revisit if:** —
