# HITL log: ticket 397 (the selected row shows in a resizable inspector)

## Q: Where does the next step's slot-window expectation come from, now that the deliveries feature needs `deliveryWindow()`?
**Decision taken:** `deliveryWindow()` moved, unchanged, from `document/fields.ts` to `@/core/oms/delivery-window.ts`. It takes the four schedule fields, which both models carry. `TimelineInput` gains `window` (both mappers fill it from `deliveryWindow()`), and `timeline()` puts it on the `next` step as `expect`. `fields.ts` and its test import it from core.
**Why:** HITL-396 named this exact revisit ("397 wants the expectation inside the pure output"). Spec 380's test table lists "`deliveryWindow()` for the expectation" under the timeline derivation. Features may not import each other, and the trap says to use `deliveryWindow()`, never the raw schedule fields.
**Revisit if:** 402 wants the expectation only on Out/Delivered, not on a next step of Ready.

## Q: What exactly does the Fulfilment "Slot" line read?
**Decision taken:** From a real schedule (both ends set, From < To) it reads `02 Oct 2026 · 10:00–12:00`: the short date of From, then `deliveryWindow()`. Otherwise it reads the slot's own `timeSlotDay · timeSlotDescription` (`Thursday · 10am - 12 pm`). It is one string and one `Ltr`.
**Why:** The ticket's example is "day · window". The schedule-first order is `deliveryWindow`'s own (D-7), so the slot and the expectation never disagree. The range takes `formatRange`'s closed en dash, not the ticket's spaced hyphen, which only echoed the stub's `timeSlotDescription`.
**Revisit if:** Operators want the server's `timeSlotDescription` shown verbatim even when the schedule is real.

## Q: What happens when 40% of the viewport is less than the 320 minimum?
**Decision taken:** The 320 floor wins. Below an 800px viewport the pane stays 320 and the grid gives way.
**Why:** A pane narrower than 320 can't hold the 96px label column plus values. The prototype's clamp did the same.
**Revisit if:** The owner wants the 40% cap to win on narrow windows, or the pane to auto-fold there.

## Q: What do Enter, a double-click and Open full record do on a row with no delivery no.?
**Decision taken:** Nothing. Open full record is disabled, with a tooltip saying why.
**Why:** The ticket says they open Delivery details, which is keyed by delivery no. The toolbar's Open Order still reaches the order.
**Revisit if:** Operators expect Enter on an order-only row to open the order page.

## Q: Where does the grid bar's Inspector toggle sit before 398/399 rebuild the bar?
**Decision taken:** At the inline end of today's results header row. It is shown always, even before a search, so a folded pane can always come back by mouse.
**Why:** The current `GridToolbar` only renders once results exist. The empty prompt must be reachable before a search (367 §4).
**Revisit if:** 398/399's grid bar moves it next to Columns/Export.

## Q: Is the pane flush to the screen edge although the list isn't three panes yet?
**Decision taken:** Yes. It is a sticky, full-height pane on the inline-end edge, under the 44px top bar (negative margins against `main`'s padding). The filter panel and grid stay as they are for 398/399 to rework.
**Why:** L6 puts the inspector at the inline end, full height, as captured in `368-shots/A-open-*.png`. A card inside the padding would have to be undone by 398.
**Revisit if:** 398's layout wraps the centre column differently.

## Q: What do J/K do before a search, and is `I` a palette row?
**Decision taken:** J/K are hidden commands. With no rows their handler is absent, so the key layer toasts "There are no rows to step through yet. Search first." `I` is a visible This screen row labelled Hide/Show inspector.
**Why:** K5: a key is never a silent dead key. 365: a key only does what a palette row does, and only J/K are named hidden.
**Revisit if:** The J/K refusal toast feels noisy to operators.

## Q: The core host reported the list's J/K/I as refused (`single-key-screen`) on every navigation away from the list.
**Decision taken:** I fixed it in `CommandPaletteHost`. The refusal effect now reads `registeredNow()` when it runs, instead of the render-time command list. By then the leaving page has unregistered, because unmount cleanups run first.
**Why:** This is a real race in 393's host, which only surfaced now that a single-key screen registers keys. It made `foundation-drive.mjs` fail "no page errors" in 12 places. The fix is one line and changes no behaviour of the key layer, which already reads the registry per press.
**Revisit if:** —

## Q: Smaller calls
**Decision taken:**
- The separator binds ←/→ (the one toward the inline start grows), Home and End. It does not bind ↑/↓.
- The phone stays in Plex Sans like the grid's Mobile column. Mono is for IDs and codes (359).
- The failed-jobs hint reads "Open the full record to see the jobs." It does not mention retry, because 410 is not built.
- A selected row hidden by a column filter stays inspected, which is AG Grid's default. J from there lands on the first displayed row.
- The empty prompt's J/K caps come from `legendText` and hide while the single-key switch is off (393's hint rule).
**Why:** These are conservative readings of 367 §4, 359, 370 and 393.
**Revisit if:** The owner signs off differently at S3.

## Q: Review follow-ups (standards + spec axes)
**Decision taken:** The failed-jobs banner keeps its hint text, and the way to the full record is the pane's Open full record button below it, not a link inside the banner. `documentType` and `source` stay in `<bdi>`. The reschedule pair leads with its time (`2026-10-02 15:30 · msartawi`), so it is a machine-led pair.
**Why:** A second Open button in the banner would duplicate the pane's own button. The list sends those two fields as descriptions (`columns.ts` `trimmedCol`). Leading with the time keeps the pair safe under one `Ltr`.
**Revisit if:** The owner wants the banner itself to carry an Open link, or the list starts sending codes.
