# 741 — Recharts for the native analytics charts

Asked 2026-11-04 by the owner: instead of building chart components from scratch for the native
analytics screens ([ticket 747](../../.issues/747-do-users-explore-inside-oms-react-or-inside-the-bi-tool.md),
amended by 754/755), use [Recharts](https://recharts.github.io/)
([github.com/recharts/recharts](https://github.com/recharts/recharts)). Show how it looks on our prototype.

## Verdict

> **Confirmed by the owner on 2026-11-05** after driving the Recharts board and the Linked board:
> "the best so far". Prototype commits on `prototype/747-embedded-bi` are `244a080c` (the Recharts
> board) and `01286f77` (the Linked board's loading UX).
>
> One follow-up stays open for the build. The Linked and Build boards still go through
> `NativeChart.tsx`, which colours by rank, so a channel changes colour when the filter changes. The
> v1 wrapper must colour by entity, as the Recharts board does.

**Use Recharts 3 as the chart renderer for the native analytics screens.** It covers every chart type the
v1 boards need, it follows our DMSCO tokens and dark mode through props, and with one container rule it
mirrors correctly under Arabic. We hand-build none of the charts, only the thin wrapper that applies the
tokens, the formats and RTL.

One correction to the premise: the 747 prototype **already** drew its charts with Recharts (2.15.4,
inside `NativeChart.tsx`). What was hand-built were the KPI tiles and the tables. This follow-up
upgrades it to the current major and uses much more of the library.

## The facts

| | |
|---|---|
| Version | **3.10.1**, the latest on npm, published 2026-11-03. Actively released. |
| Licence | **MIT**. No AGPL concern, unlike Metabase's frontend. |
| React | Peer range `^16.8 … ^19`. Our React 19.2.7 is supported. |
| Dependencies | Bundles d3 pieces (`victory-vendor`), `@reduxjs/toolkit`, `react-redux`, `immer`, `reselect`. All are installed from npm at build time. Nothing reaches the network at runtime, so the no-egress rule holds. |
| Bundle | **~144 KB gzipped** (509 KB minified) for the 23 components the prototype imports, measured with esbuild. It loads only in the lazy `/analytics` route chunk, never on the other screens. |
| Rendering | SVG. It suits hundreds to a few thousand points per chart, which fits our aggregated marts (365 daily points with a Brush was smooth). It is not for 100k-point scatters, and v1 has none. |
| Accessibility | v3 turns on `accessibilityLayer` by default, which gives keyboard focus and arrow-key movement through the tooltip. |
| Upgrade cost 2 → 3 | Small. Our existing `NativeChart.tsx` had two type errors: a tooltip `formatter` value can now be `undefined`, and `activeLabel` can be a number. Each took one line to fix, and the rest compiled unchanged. |

## What the prototype now shows

Branch `prototype/747-embedded-bi` (worktree `C:\Playground\oms-react-proto747`), route
`/prototype/analytics?variant=recharts&scenario=en|ar`. It uses the same synthetic data and the same
Metabase OSS `/api/dataset` queries as the Linked board, and each panel is a stock Recharts component:

| Panel | Recharts piece |
|---|---|
| Four KPI tiles, each with a 30-day sparkline | `AreaChart` with hidden axes |
| Value by day for 12 months, drag to zoom, daily-average line | `AreaChart` + `Brush` + `ReferenceLine` |
| Orders by month and channel | `BarChart` with `stackId` + `Legend` |
| Channel mix by week | `AreaChart stackOffset="expand"` (100% stacked) |
| Delivery speed by city against a target | vertical `BarChart` + `ReferenceLine` + `LabelList` |
| City share of value | `Treemap` (one hue, darker = more) |
| Stores: value against loyalty share, bubble size = till sales | `ScatterChart` + `ZAxis` |
| Value by month with a 3-month average | `ComposedChart` (Bar + Line on **one** axis) |

Screenshots: [English](../../.issues/assets/741-recharts-shots/recharts-en.png) ·
[Arabic](../../.issues/assets/741-recharts-shots/recharts-ar.png) ·
[dark](../../.issues/assets/741-recharts-shots/recharts-en-dark.png) ·
[hover tooltip](../../.issues/assets/741-recharts-shots/recharts-en-tooltip.png).
To re-run: start Metabase (`C:\Playground\mb-proto\start-metabase.ps1`), run `npx vite --port 5199`
in the worktree, then run `node tools/recharts-board-drive.mjs`. SIS.Api is not needed, because the
drive stubs `/api`.

## What we must still own (the wrapper, not the charts)

1. **RTL. This is the one real trap.** Recharts has no RTL mode. SVG `<text>` inherits `dir="rtl"`,
   which flips `text-anchor`, and labels then collide with the bars and axes. The first Arabic shot
   showed exactly that. The rule that fixed it:
   - always put the chart inside a `dir="ltr"` box;
   - mirror only through props: `XAxis reversed`, and `YAxis orientation="right"`;
   - custom SVG content such as treemap labels anchors to the right edge under RTL.

   **Gap: `Brush` has no `reversed`**, so the zoom strip stays left-to-right under Arabic. Either accept
   it or leave the Brush out of RTL.
2. **Tokens and colour.** Recharts takes colours as props, so the wrapper reads the DMSCO tokens. A
   categorical palette for the channels, in a **fixed hue per entity**, was checked with the dataviz
   `validate_palette.js`:
   - light against `#ffffff`: `#0f98a3 #c98f00 #3567b8 #d0628f #8160d6`. It passes, with a contrast
     WARN on gold that the legend and table view cover.
   - dark against `#111a28`: `#169aa3 #b8860e #5585d4 #cf6496 #8b6fe0`. All checks pass.

   The raw brand tokens **fail** as a chart palette: navy is too dark, and teal and gray read as gray.
   The status colours (success, attention, danger) are not reused as series. These belong as
   `--chart-1…5` tokens in `global.css` for the build. The current `NativeChart.tsx` colours bars by
   rank and reuses the status colours; the build must not carry that over.
3. **House rules Recharts doesn't know:**
   - one y-axis per chart, so no dual-axis `ComposedChart`;
   - legend text in ink, not in the series colour (use a `formatter` on `Legend`);
   - number and date formats through `Intl` under the active locale;
   - every label through `t()` once this leaves the prototype.

   `fsi()` must never reach a tick formatter, because it would leak into copied text.
4. **Loading feedback (asked for by the owner on 2026-11-04).** Recharts has no loading state, so the
   wrapper owns it. A filter change must show work **at once**, not after 5–10 s of silence. What the
   prototype does now ([mid-load shot](../../.issues/assets/741-recharts-shots/recharts-loading.png)):
   - **The filter strip** shows a spinner and "Updating Western… 7 of 17 panels", with a progress bar
     along its bottom edge.
   - **Each card** shows an indeterminate bar on its top edge, a spinner by its title and an
     "Updating…" pill, while its previous chart stays visible, dimmed. It is never blanked.
   - **Each panel redraws the moment its own query returns**, instead of all of them waiting for the
     slowest. A newer filter discards older answers through a generation counter.

   For the build this means TanStack Query with `placeholderData: keepPreviousData` and per-panel
   `isFetching`, which gives the same behaviour.
5. **The table view.** Recharts draws no tables. The grid stays AG Grid, which also gives the
   accessible "see the data" view each chart needs.

## Alternatives, briefly

- **Apache ECharts** (Apache-2.0) has canvas rendering, a built-in RTL `inverse` axis, and more chart
  types such as Sankey and heatmaps. But it is heavier (~300 KB+ gzipped), configured as one big
  options object rather than React components, and harder to theme per token.
- **Nivo** (MIT) is React with good defaults, but it releases more slowly and has a smaller community.
- **visx** (MIT) gives low-level primitives. It is close to "building from scratch" again.

Recharts is the best fit for the native boards: React-first, MIT, current with React 19, and enough
chart types. Revisit only if a v1 question needs a chart type it lacks (Sankey, geo map).

## For `/to-spec`

Carry into the v1 spec:
- Recharts 3 (pin the exact version) as the renderer;
- one `core/charts` wrapper owning tokens, formats and the RTL container rule;
- `--chart-1…5` tokens (the validated values above);
- AG Grid for tables.
