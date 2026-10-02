# Shared component and grid state review

Proposal for [Make grid and component states feel like one system](../../356-make-grid-and-component-states-feel-like-one-system.md), on `prototype/theme-directions-355`. **Awaiting owner feedback; these rules are not yet accepted.** The approved inquiry, delivery details and simulation directions stand.

Run `npm run prototype:theme`, then open [Controls & states](http://127.0.0.1:5198/oms/deliveries?variant=selected&review=states). It lives on the existing inquiry route in the real shell. Navigation connects the approved previews; Light/Dark and RTL are in the floating review bar. This view retains the selected palette.

## Proposed rules

- Rectangular controls with 3px corners; 32px form fields and adjacent actions. Compact standalone actions and grid inputs may be 28px. Remove the unexplained 36px Collection-toolbar variant.
- Retain 28px single-line data rows; permit 44px when two lines of useful content need it. Use the visible toggle to compare.
- Existing 12px typography, tabular financial figures, and LTR numeric editing inside RTL layout.
- Opaque cards, stronger field borders, quieter row dividers, muted headers and bold muted totals.
- App and grid hover share `--accent`, including dark mode. Selection keeps the primary tint. A 2px cell focus border remains visible over selection. App focus has a 2px outline with a 2px offset; compact grid fields use a 2px focus border.
- Rounded semantic badges remain distinct from rectangular commands. Preserve fulfilment, cancellation request, terminal cancellation, prescription and POST provenance meanings.
- Invalid fields have a danger border and explanatory text; disabled controls are visibly unavailable and skipped by Tab. Loading and empty states have explicit text.
- At smaller widths, toolbar and specimens wrap while the grid scrolls locally and pins identity at the logical start.

## What to try

The Collection toolbar is a **visual specimen**, not the live search workflow. It shows both date ranges and both person filters. Toggle ACR scope to blank and disable fields while retaining draft values. Served by is a field for geometry comparison; it does not replace the real picker. Show sample results changes display mode only.

The real AG Grid supports sorting, floating filters, filter popups, row/header checkboxes, pinned identity and totals, native text copying, and keyboard navigation. Select a checkbox and click a cell to see selection with focus. Toggle Default / Loading / Empty and 44px rows. Totals describe the original sample rows before column filtering.

Hover and Tab through the fields and buttons below; correct the negative amount to clear validation. Command buttons are inert visual samples. All data is fictional; state stays in memory.

## Captures

| State | Light | Dark |
| --- | --- | --- |
| Default and specimens | [Light](light-default.png) | [Dark](dark-default.png) |
| Selection plus focus | [Light](light-selected-focus.png) | [Dark](dark-selected-focus.png) |
| Filter popup | [Light](light-filter.png) | [Dark](dark-filter.png) |
| Loading | [Light](light-loading.png) | [Dark](dark-loading.png) |
| Empty | [Light](light-empty.png) | [Dark](dark-empty.png) |
| RTL with 44px content | [Light](light-rtl-rich.png) | [Dark](dark-rtl-rich.png) |
| 1000px viewport | [Light](light-laptop.png) | [Dark](dark-laptop.png) |
| 600px viewport | [Light](light-narrow.png) | [Dark](dark-narrow.png) |

## Verification and implementation observations

`node tools/theme-states-drive.mjs`: **39 checks pass**, covering both themes, selection/focus, grid arrows, native copying, filter popups, disabled Tab behavior, validation, loading/empty, 28/44px heights, RTL pinning and smaller viewports. No browser errors. [Results](verification.json).

The existing selected-inquiry drive also passes **21 checks**: all fourteen filters, expansion through Search, text copying, compact rows, light/dark and RTL. Build and lint pass; the existing large-bundle warning remains.

Checked installed AG Grid Community **36.0.1** input-style and core theme declarations. The used input height/radius, button radius, focus/invalid borders, focus shadow and disabled-input parameters exist. This prototype extends the existing shared theme; the production adapter is unchanged.

Rendered inspection found the inherited `pinnedRowBackgroundColor` alone did not yield the intended totals background here. A scoped `.ag-row-pinned` rule sets `--ag-data-background-color`, background and font weight. A scoped cell rule provides the stronger focus border. Carry this evidence into the central-theme contract rather than assuming every treatment has a working theme parameter.

The decision remains claimed until the owner accepts or adjusts these rules. Specification synthesis and production rollout are separate.
