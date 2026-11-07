# 846 — Canvas editor drag/drop UX: how professional tools behave

Research for the analytics board editor (12-col grid) and report designer (top-to-bottom blocks).
Owner complaints: (1) dragging a panel down jumps the page scroll to the bottom; (2) deleting a panel
leaves a gap that must be closed by hand; (3) the views list is narrow and truncates names. Bar: Figma.
Collected 2026-11-07. Exact defaults are marked *(secondary)* where only a non-official source had them.

## Patterns

| Pattern | Who does it | How | Source |
|---|---|---|---|
| Gradual edge auto-scroll | Atlassian Pragmatic DnD | Speed rises as the pointer nears the edge and reaches max *before* the edge. **Time dampening**: speed ramps up the longer you hover. Speed is normalised to 60 fps. Only the innermost scrollable under the pointer scrolls, one per axis per frame. The docs say the browser's native auto-scroll "does not provide a great experience and it cannot be disabled". | https://atlassian.design/components/pragmatic-drag-and-drop/optional-packages/auto-scroll/about |
| Edge auto-scroll with tunables | dnd-kit | `autoScroll` takes `threshold` (a fraction of the container, 0.2 by default *(secondary)*), `acceleration` and `interval` (5 ms by default). The new `@dnd-kit/dom` AutoScroller defaults `acceleration` to 25 and sets `threshold` per axis. | https://github.com/clauderic/dnd-kit/releases/tag/@dnd-kit%2Fcore@2.0.0 · https://github.com/clauderic/dnd-kit/issues/1414 |
| Auto-scroll in grid libs | gridstack | `scroll: true` on drag options, with an `autoScrollBandMin` of 30 px. | https://github.com/gridstack/gridstack.js/blob/master/doc/API.md |
| Vertical compaction ("gravity") | react-grid-layout (Grafana, Metabase, Kibana, AWS CloudFront and others) | `compactType: 'vertical'` (v2: `verticalCompactor`) moves every item up to the first free row after each change, so a delete never leaves a gap. `noCompactor`/`null` gives free placement. `preventCollision` blocks pushing. `allowOverlap` skips compaction. | https://github.com/react-grid-layout/react-grid-layout |
| Gravity vs float | gridstack | `mode: 'top'` (was `float:false`, the default) packs widgets upward. `'float'` means no gravity. `compact('list')` keeps reading order. | https://github.com/gridstack/gridstack.js/blob/master/doc/API.md |
| External drag-in with a placeholder | RGL `dropConfig`/`droppingItem`/`onDrop`; gridstack `acceptWidgets`, `setupDragIn()` | A ghost item of the default size shows inside the grid while hovering. The layout reflows live around it. | (as above) |
| Auto grid vs custom grid | Grafana (schema v2) | "Custom" is x/y/w/h. "Auto grid" lets Grafana place panels from column and row constraints. | https://grafana.com/docs/grafana/next/dashboards/build-dashboards/create-dashboard/ |
| Tiled vs floating | Tableau | Tiled items never overlap and form one grid that resizes with the dashboard. Floating items are layered on top. Tableau recommends tiled. | https://help.tableau.com/current/pro/desktop/en-us/dashboards_organize_floatingandtiled.htm |
| Snap, smart guides, align and distribute | Power BI | Snap to grid, smart guides to the centre and edges of nearby visuals, Align and Distribute with several visuals selected, and a Selection pane for layer order. | https://learn.microsoft.com/en-us/power-bi/create-reports/desktop-gridlines-snap-to-grid |
| Arrange, group, distribute | Looker Studio | An Arrange menu aligns and distributes the selection. | https://docs.cloud.google.com/looker/docs/studio/arrange-group-and-distribute-components |
| Insertion indicator | Figma auto layout | Drag over an auto-layout frame and a blue indicator shows where the item will land. Siblings reflow, so there are no gaps. | https://help.figma.com/hc/en-us/articles/360040451373 |
| Line vs inside drop | Pragmatic DnD hitbox | `closestEdge` (top/bottom/left/right) drives a drop-indicator **line**. Tree instructions add reorder-above, reorder-below and make-child, and a blocked drop shows the warning colour. | https://atlassian.design/components/pragmatic-drag-and-drop/optional-packages/hitbox/about |
| Block drag handle | Notion | A ⋮⋮ handle appears on hover. Blue guides show the drop line. Shift-click selects several blocks to drag together. | https://www.notion.com/en-gb/help/writing-and-editing-basics |
| Smart selection and Tidy up | Figma | Equal-spaced selections get pink spacing handles. Drag inside the selection to reorder. Tidy up (Ctrl+Alt+T) normalises spacing. | https://help.figma.com/hc/en-us/articles/360039956914 · https://www.figma.com/blog/introducing-smart-selection/ |
| Nudge, duplicate, zoom | Figma | Arrow keys move 1 px and Shift+Arrow 10 px (both configurable). Alt-drag and Ctrl+D duplicate. Shift+1 zooms to fit, Shift+2 zooms to the selection. | Figma's in-app shortcut panel (Ctrl+Shift+?) *(secondary: https://www.nobledesktop.com/shortcuts/figma/pc)* |
| 12-col snap and stack containers | Retool | Edges snap to a 12-column grid. Stack containers (flex-like) give finer control. `maintainSpaceWhenHidden` decides whether a hidden item keeps its space. | https://docs.retool.com/reference/components/web/repeatables/grid-view |
| Resizable side panel | react-resizable-panels (bvaughn) | Separators render `role="separator"` with ARIA values and resize from the keyboard. Panels take `minSize`/`maxSize`/`collapsible`/`collapsedSize` in px, %, rem or vh. Save sizes from `onLayoutChanged` (fires on release) and restore them with `defaultLayout`. | https://github.com/bvaughn/react-resizable-panels |
| Splitter keyboard contract | WAI-ARIA APG | Arrow keys move the splitter, Home/End go to min/max, Enter collapses or restores. `aria-valuenow/min/max` are set. | https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/ |

### Why our scroll "jumps"

Smooth tools drive scrolling themselves: one `requestAnimationFrame` loop, a speed that scales with the
pointer's distance into an edge band and is capped, and a short ramp-up. A jump to the bottom usually
comes from one of two things:

- **A feedback loop.** The page calls `scrollIntoView` or `scrollTo(target)` on the dragged panel at
  every pointer move, or the grid grows taller under the ghost. Each scroll pushes the pointer's grid
  row further down, which grows the board, which scrolls again.
- **The browser's native HTML5 auto-scroll.** It cannot be turned off and is coarse.

The fix:

- Compute the pointer's row from `clientY + scrollTop` each frame.
- Scroll by `maxSpeed * ((band - distance) / band)²` px per frame, starting with a band of about 80 px
  and about 20 px per frame.
- Never scroll to the panel's position.
- Cap how much the board can grow below the lowest panel during a drag (at most one ghost height).

## Ranked improvements

1. **Vertical compaction in the layout reducer** (board): after every move, resize, add, delete or
   paste, float each panel up to the first free row (the RGL `verticalCompactor` algorithm: sort by
   y then x, drop each one while it does not collide). This fixes complaint 2 outright. Keep "free
   placement" as an opt-out toggle per board. **S–M**
2. **rAF edge auto-scroll that grows with distance** for pointer move/resize *and* the HTML5 drop
   from the views list. Use the formula above, with time dampening, and remove any `scrollIntoView`
   from the drag path. **S–M**
3. **Live reflow preview with a ghost placeholder**: while dragging, render the would-be layout
   (others pushed or compacted) and a dashed ghost at the target cell. Commit on drop and restore on
   Esc. **M**
4. **Resizable views list** with `react-resizable-panels`: a `minSize` and `maxSize` (for example
   180–480 px), collapsible, its size saved with `onLayoutChanged`, the APG keyboard splitter, and a
   full name in a tooltip (`title`) when text truncates. **S**
5. **Drop-indicator line for the report designer**: work out the closest edge (above or below) of
   the hovered block, draw a 2 px accent line in the gap, and give a blocked drop the warning colour.
   This replaces whatever absolute targeting the designer uses now. **S**
6. **Undo/redo as reducer history** (Ctrl+Z / Ctrl+Shift+Z): each committed gesture is one step, not
   each pointer move. **S** if the reducer is pure.
7. **Keyboard editing**: arrow keys move the selected panel one column or row, Shift+Arrow resizes,
   Delete removes, Ctrl+D duplicates beside it, Esc deselects, and `?` shows a shortcut sheet.
   Announce changes through a live region. **M**
8. **Multi-select** (Shift or Ctrl-click, and a marquee on empty grid) with group move, group delete,
   and Align/Distribute/Match width (Power BI and Figma style). **M–L**
9. **Copy/paste and Alt-drag duplicate**, pasting into the first free slot found by compaction. **S**
   once 1 lands.
10. **Zoom to fit / 100 % toggle** (Shift+1 / Shift+0) for long boards: a CSS `scale` on the grid
    with hit-testing that accounts for the scale. A layers/outline list that lets you click to scroll
    to a panel covers most of the need for less work. **M**
