---
type: wayfinder-ticket
wayfinder: prototype
labels: [wayfinder:prototype]
map: 354
status: claimed
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

## Comments

2026-10-02: The owner liked the selected inquiry and requested delivery details and simulation previews. The [cross-screen extension](assets/356-theme-screens/README.md) on `prototype/theme-directions-355` now provides both, with linked navigation, fictional delivery data, captured pricing replays, both themes and RTL. This is partial evidence for this ticket; no new visual rules have been accepted and the full state matrix and Collection specimen remain outstanding.

## Approved screen previews

2026-10-02: The owner approved the delivery details and POS simulation previews ("ok approaved"), captured in commit `5cc3a27` on `prototype/theme-directions-355`. This accepts the selected steel palette and compact rectangular treatment on these screens, including the displayed detail hierarchy, command/badge treatment, and simulation inputs/results/promotions arrangement. The [review assets](assets/356-theme-screens/README.md) record the approved artifact and its 44 passing browser checks.

Carry these accepted screens forward without reopening their visual direction. This approval concerns the displayed prototypes; it does not settle the unshown Collection specimen, complete the shared interaction-state matrix, or authorize a production rollout. This ticket remains open for that remaining design work before ticket 357 finalizes the theme specification.

## Shared-state review ready

2026-10-02: Claimed and extended the accepted theme with the remaining [Collection toolbar and interaction-state review](assets/356-theme-states/README.md) on `prototype/theme-directions-355`. [Open Controls & states](http://127.0.0.1:5198/oms/deliveries?variant=selected&review=states).

The proposal demonstrates 32px form controls, compact 28px actions/rows, a deliberate 44px two-line option, common hover/focus treatments, semantic command/badge samples, pinned totals, invalid/disabled/loading/empty states, real grid filters and checkboxes, copying, and focus with selection. The Collection specimen retains both date ranges and both person filters and demonstrates ACR scope without inventing search behavior.

Verification: 39 state-review browser checks and 21 selected-inquiry checks pass; build and lint pass. Both themes, RTL and smaller viewports are captured. Installed AG Grid parameters and the rendered pinned-totals exception are documented in the assets.

**Awaiting owner feedback.** No shared-state rule is accepted by this entry. Keep the ticket claimed and the dependent specification decision blocked until the owner reacts to the artifact.
