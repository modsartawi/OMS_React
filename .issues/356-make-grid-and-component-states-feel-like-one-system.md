---
type: wayfinder-ticket
wayfinder: prototype
labels: [wayfinder:prototype]
map: 354
status: open
blocked-by: 355
---

# Make grid and component states feel like one system

## Question

Within the selected visual direction, what shared control geometry, typography, surface hierarchy, and interaction treatment should ordinary components and AG Grid use, and which density differences are intentional?

Extend the selected prototype to put app fields beside grid filter fields; app buttons beside grid controls; badges and numeric cells beside their detail-view equivalents. Make default, hover, keyboard focus, selected, disabled, invalid, loading, and empty states reviewable. Include grid headers, sorting, filter popups, checkboxes, pinned columns and totals where applicable, and selection plus focus at the same time.

Resolve the current 28/32/36px control-height differences, pill versus rectangle treatment, border strengths, focus indicators, and the opposing dark-mode hover directions. Evaluate whether compact grids need an explicit alternate density for stacked content; a 44px settlement row is not automatically an error.

Use a Collection toolbar and a Document Details command/badge sample to test that the design transfers beyond the inquiry screen. Verify both themes, keyboard use, logical layout/RTL, and smaller viewports. Keep business semantics stable. Check the installed AG Grid API/source before claiming a styling parameter works; existing local theme research is a starting point.

The answer records the owner's accepted visual rules and deliberate exceptions, backed by linked prototype assets. It does not perform the production refactor.

## Context

[Choose the app theme through three visual directions — Answer](355-choose-the-app-theme-through-three-visual-directions.md#answer) supplies the accepted starting direction. Extend the [selected combination](http://127.0.0.1:5198/oms/deliveries?variant=selected), captured on `prototype/theme-directions-355`, with [review assets](assets/355-theme-review/README.md).

Carry the prior ticket's filter and copying decisions through the state review. Specifically verify draft versus applied criteria, chips while collapsed, expansion staying open after Search, native text selection coexisting with row selection/keyboard focus, and both themes/RTL. Do not reopen the chosen palette or composition without new evidence that requires a decision.
