# Three visual directions for Delivery Documents Inquiry

Throwaway prototype for [Choose the app theme through three visual directions](../../355-choose-the-app-theme-through-three-visual-directions.md), captured on 2026-10-02. **Owner-selected direction recorded on 2026-10-02:** see the [decision](../../355-choose-the-app-theme-through-three-visual-directions.md#answer).

## Run and review

On branch `prototype/theme-directions-355`, run `npm run prototype:theme` and open:

- [A · Steel](http://127.0.0.1:5198/oms/deliveries?variant=A): grouped filter card, familiar steel palette, separate results toolbar.
- [B · Cobalt](http://127.0.0.1:5198/oms/deliveries?variant=B): persistent filter rail, cooler palette, stronger separation of controls and results.
- [C · Graphite](http://127.0.0.1:5198/oms/deliveries?variant=C): compact query strip, larger scope counts, warm neutral surfaces and restrained green-grey accents.

The floating bar changes the variant, light/dark mode, and RTL. These are URL parameters (`variant`, `mode`, `dir`), so links survive reload. Arrow keys cycle variants outside interactive controls and the grid. The real shell's theme button also updates the prototype URL without storing a theme preference.

All variants use the real AppShell, shared Button and StatusBadge, AG Grid Community, 28px rows, and the same 48 fictional deliveries. Grid sorting, floating filters, horizontal scrolling, pinned identity, row selection, the column chooser, sample search, scope filters, and a local detail preview are interactive. The palette strip shows the active token values. Command-family specimens are disabled; prescription and provenance retain distinct meanings.

The dedicated Vite configuration intercepts every `/api/` request, including writes; it never forwards these requests to SIS.Api. The regular server's authentication remains unchanged. Only development builds can load the variant renderer. No production rollout is part of this ticket.

## Captures

| Direction | Light | Dark | Narrow viewport |
| --- | --- | --- | --- |
| Selected | [View](selected-light.png) | [View](selected-dark.png) | [View](selected-mobile-all-filters.png) |
| Steel | [View](A-light.png) | [View](A-dark.png) | [View](A-mobile.png) |
| Cobalt | [View](B-light.png) | [View](B-dark.png) | [View](B-mobile.png) |
| Graphite | [View](C-light.png) | [View](C-dark.png) | [View](C-mobile.png) |

[Steel, dark, RTL](A-dark-rtl.png) verifies the mirrored shell and identity at the grid's inline start. The page remains English; time-slot content is isolated LTR so its range does not reverse.

## What this comparison can settle

Choose a palette and a composition independently, or choose one direction whole. The agent's recommendation is **C's compact composition with A's steel palette**: it preserves the familiar palette and gives the data more vertical space. The owner accepted this recommendation; the canonical answer is in the [decision ticket](../../355-choose-the-app-theme-through-three-visual-directions.md#answer).

B reserves 260px for filters, making repeated searches easier to reach but reducing horizontal grid space. At a narrow viewport its filters move above the grid. C removes the filter card and lets status colours stand out against quieter neutral surfaces. A changes the least from the current application.

## Full-filter and text-copy refinement

Following owner feedback, the prototype now includes all 14 production filter fields. The current proposal keeps From Date, To Date, Store Code, Delivery No and Customer Phone visible; **All filters** expands the remaining nine, grouped by document identity, classification, fulfilment and results. The accepted interaction is recorded in the decision ticket; opening the panel keeps it open through Search and Clear all until the operator collapses it.

Search applies the draft criteria as a batch. Applied criteria remain visible as removable chips even when the panel is collapsed. The result limit is always stated. Column filters act on the loaded sample, separately from the search criteria. All matching happens against fictional rows, with the real query builder used to retain request-shaping semantics. The former combined customer/number search has been replaced by the distinct production fields.

- All fields expanded: [Steel](A-all-filters.png), [Cobalt](B-all-filters.png), [Graphite](C-all-filters.png).
- [Applied-filter chips with the panel collapsed](C-active-filter-chips.png).
- All fields at 390px: [Steel](A-mobile-all-filters.png), [Cobalt](B-mobile-all-filters.png), [Graphite](C-mobile-all-filters.png).

Native cell-text selection is enabled using `enableCellTextSelection` and `ensureDomOrder`. Select text with a drag or double-click a word, then press Ctrl+C. Row selection remains available; copying selected text does not require an Enterprise licence. This is not a proposal for Excel-style range selection.

Sources checked on 2026-10-02: [AG Grid cell text selection](https://www.ag-grid.com/react-data-grid/cell-text-selection/) documents both settings and the resulting selected-text clipboard behaviour; the installed Community 36.0.1 types contain both. [IBM Carbon filtering](https://www.carbondesignsystem.com/building-blocks/core/patterns/filtering) supports batch application for multiple criteria and visible indicators/reset for hidden active filters. The specific five-field ordering and expandable grouping are this prototype's proposal, not a claim that those sources prescribe this screen.

The columns and combined status are illustrative fixtures, not a proposed replacement for the production list's 41-column contract or its multiple domain status fields. The fuller shared-state and component review belongs to the dependent visual ticket. This study does not establish loading/error/empty-state styling across the app or settle rich-row density.

## Verification

- `npm run build` (includes TypeScript): passed; the existing large-chunk warning remains.
- `npm run lint`: passed, including the existing 129-pair contrast gate.
- `node tools/theme-prototype-drive.mjs`: see the latest [browser results](verification.json), including native selection/Ctrl+C, all 14 controls, combined filtering, chip removal, and expanded layouts at 390px.
- Browser checks cover all six desktop variants, 28px rows, horizontal overflow within the grid, row selection, four key text/action contrast pairs per view, sample filters, column visibility, keyboard ownership, detail preview, switcher/reload, RTL pinning, shell mode synchronization, no persisted theme setting, and all three layouts at 390px.
- Captures were visually inspected. No browser errors. React Router's hydration-fallback warning and the shell's duplicate-query warning are recorded in the results; neither is introduced as a design decision.
- The driver follows the repo's existing Playwright arrangement in `C:/Playground/frontend` and uses installed Edge. It is a manual review tool, not a new test-suite dependency.

## Handoff

The owner subsequently requested [delivery details and POS simulation previews](../356-theme-screens/README.md). The inquiry's Preview delivery action now opens that full detail route; top-of-page links connect the three screens. The original 355 verification records the earlier inline preview; the extension has its own current browser drive.

The visual-direction ticket is resolved. Continue with [Make grid and component states feel like one system](../../356-make-grid-and-component-states-feel-like-one-system.md). The map remains open until the shared-state decisions and final theme specification are ready.

Selected combination: [expanded light](selected-light-all-filters.png), [expanded dark](selected-dark-all-filters.png), [RTL](selected-dark-rtl.png). `node tools/theme-selected-drive.mjs` verifies palette/composition, all filters, expansion behavior, text copying, 28px rows, RTL and mobile layout; see [selected verification](selected-verification.json).
