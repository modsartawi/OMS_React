---
type: wayfinder-ticket
wayfinder: prototype
map: 358
status: done
blocked-by: 362, 366, 367
---

# 368 — The Deliveries list as one screen

## Question

Arrange the whole Deliveries list in the real app on the new tokens:

- **Views** ([Deliveries views and their counts](366-deliveries-views-and-their-counts.md)).
- **Filter tokens.** All 14 filters reachable, applied ones visible, Search applies the edits,
  unapplied changes flagged, the result limit visible.
- **The grid**, with native text copy.
- **The inspector**
  ([What the inspector shows](367-what-the-inspector-shows-for-a-selected-delivery.md)).
- **J/K stepping.**

The owner reacts in both modes. The Answer records the arrangement. The branch and its captures
are the asset.

## Prototype (built 2026-10-02)

- **Branch** `prototype/368-deliveries-list` (`9b7f32c`, off 362's `da08890`, never merges), worktree
  `C:\Playground\oms-react-368`. Run `npx vite --port 5368` there, open
  `/oms/deliveries?variant=A&scenario=open` (B "Navy-led", stub data by default; `?legacy` = today's page).
  The floating bar flips ←/→ variant, ↑/↓ scenario; the header's moon flips light/dark.
- **Variants** (same content, different arrangement):
  - **A — Three panes:** Far corrected: 220px views rail (lenses, then my views with star, modified dot,
    ⋯ actions), token bar with an always-visible Limit token and a Search button, grid bar, grid,
    status bar with key hints, inspector.
  - **B — Grid first:** no left column; views menu + tokens on top, lens tabs with counts over the grid,
    icon-only grid tools.
  - **C — Labelled panel:** the 14 criteria as labelled fields in a collapsible 248px left panel
    (collapsed: an applied-criteria strip), views menu in the top bar, lens tabs over the grid.
- **Scenarios:** opening (starred default runs), before any search, page hit its limit, grid filter
  narrows, edits not searched, view drifted.
- **Captures:** [368-shots/](assets/368-shots/) — `{A,B,C}-open-{light,dark,1280}`, `{A,B,C}-{before,cut,filtered,pending,modified}`,
  `A-{token-edit,filter-menu,view-actions,lens-attention,collapsed,rtl}`, `C-collapsed`.
- **Drive:** `node tools/proto-368-shots.mjs` — 35/35 checks, no page errors.
- **Findings so far:** Enter in a criteria field must stop there (it bubbled into Enter-opens once the
  field unmounted — the registry must treat a handled key as owned); AG Grid preventDefaults Enter on a
  cell, so Enter-opens belongs on the grid's `onCellKeyDown`, not the document listener; under RTL the
  inspector's slot and courier values reorder and need `<Ltr>`; B has no room for the cut line beside the
  lens tabs at 1440.

## Answer

The owner picked **A, the three panes**, on 2026-10-02, from three arrangements of the same content
flipped on the live app (branch and captures above). B (grid first) and C (labelled criteria panel)
are rejected. Three rulings came with it: lenses and saved views join the palette, *Cancellation
requested* turns indigo, and `I` toggles the inspector.

### 1. The arrangement: three panes

From inline-start to inline-end: [the rail](363-the-rail-shell.md) (56px collapsed) · a **220px
views rail** · the **centre column** · the **inspector** (360px, 367's bounds). At 1280 with the rail
collapsed and the inspector open, the grid keeps ≈644px. Collapsing the inspector gives 360px back.

**The views rail** (`--card-2` ground, inline-end border):

- **Lenses**, under a small-caps heading: All · Needs attention · Cancellation requested · Dawaa
  Now · Rescheduled. Each row is an icon, a label and the count in mono, per 366: "—" before a
  search, "N+" when cut. The Needs attention count turns danger while it is above 0.
- **My views**, under its own heading. Each saved view shows a **star** when it is the default and a
  **`layout` tag** when it is an imported layout-only view. The active view shows the **modified
  dot**. A **⋯ menu** appears on hover or focus: Update (enabled only once the view has drifted) ·
  Save as new… · Rename… · Make/Remove default · Delete (undo from the toast).
- **+ Save current view** sits at the foot.
- The active row (lens or view) takes the `--primary-050` ground and a 3px `--cursor` bar on the
  inline-start edge, the same pair as the grid's selected row.

**The centre column**, top to bottom:

1. **Query bar** (`--card` ground):
   - A filter icon, then the **tokens**. Each reads `Field: value`. A click opens a popover with
     that field's own control, where **Enter searches** and Done closes without searching. × drops
     the token.
   - **+ Filter** (dashed) lists **all 14 criteria** in four groups: When · Find one · Narrow · Rows.
     The From/To pair is **one "Date" entry** with relative presets (Today, Yesterday, Last 3 days,
     Last 7 days, Custom). Criteria already in the search are marked "in search".
   - At the inline-end edge: the **Limit token, always shown**, editable and never removable. Then
     the pending note, then **Search** (primary).
   - **Unapplied edits are flagged:**
     - An edited token goes **dashed amber**.
     - A removed token stays as a **struck-through ghost** with a restore button.
     - The note reads "N changes not searched · Discard".
     - Search carries an amber dot until it runs.
2. **Grid bar:** the active view's name and modified dot, then the row pill ("5 deliveries", or
   "12 of 40 shown" plus Clear grid filters while column filters narrow), then the cut-off line when
   rows = Limit. After a gap: Columns · Export · Inspector toggle.
3. **The grid.** It **stays mounted under its empty states**, which overlay it ("No search yet — pick
   a view, or set criteria and Search", "No deliveries match this search", "No loaded rows match this
   lens"), because layout restore and J/K need its API.
4. **Status bar:** "N deliveries · 1 selected", then the key hints (J K move · ↵ open · R C N act ·
   / search · ? keys · I inspector) and "Drag over text, Ctrl C copies".

**The grid:**

- Today's columns, plus a **derived Status column** in second place: a dot and a word from 369's
  derivation (Created, Ready, Out for delivery, Delivered, Cancellation requested, Cancelled).
- **Delivery no.** is pinned, in mono 600, and the other IDs are mono (359). **Failed jobs** is a
  danger count pill, or a muted "—" when 0.
- The floating filters stay.
- `enableCellTextSelection` + `ensureDomOrder` (native copy).
- One current row, with **selection following focus**. Double-click or Enter opens Delivery details.

**The inspector** shows 367's content in 367's order:

- **Header:** the delivery no. in mono 18px, order and doc nos, and the status dot. Tags: document
  type, delivery type, **Dawaa Now as a gold fill with navy ink** (362's allowed gold), and 369's
  **due/paid tag**.
- The timeline, the failed-jobs banner, Customer, Fulfilment, and Money · SAR with a ruled Amount due.
  Then the Note.
- Three deep-link rows with key caps (Reschedule R, Request cancellation C, Add note N), and a
  full-width **Open full record ↵**.
- A collapse chevron sits at its top. The grid bar's Inspector toggle and `I` (§4) bring it back.

**Why A:**

- B hides saved views behind a menu, and at 1440 the cut-off line leaves no room beside the lens
  tabs ("Cancellation requested" truncates to "Cancel", see `B-cut.png`).
- C's 14 labelled fields make a long panel that repeats what the tokens already say.
- A keeps both kinds of view in sight with their counts, which 366's lens/view split needs, and
  costs the grid 220px.

### 2. Lenses and saved views join the palette's This screen group

As **rows, with no keys**: "Show: Needs attention" for each of the 5 lenses, and "Apply view: …" for
each saved view. Applying a view runs its search, as on screen. 365's key table is unchanged. The
rows are registered by the page through `useCommands`, like any other screen command
([What the Ctrl+K palette holds](364-what-the-command-palette-holds.md)).

### 3. *Cancellation requested* is indigo, not amber

This **amends [How a delivery's state maps to timeline steps](369-how-a-deliverys-state-maps-to-timeline-steps.md)'s
colour, not its rule**. The state (the grid's Status dot and the inspector timeline's step) takes
082's `--fam-cancel-request`, the same indigo as the Request cancellation command, because asking is
not doing. **Amber stays reserved for attention:** the due tag, the rewind marker, unapplied edits
and the cut-off line. *Cancelled* stays danger red. (The prototype still draws the state amber.)

### 4. `I` collapses and expands the inspector

This **amends [Keyboard shortcuts that work for everyone](365-keyboard-shortcuts-that-work-for-everyone.md)'s
list table**. `I` (`KeyI`) is a single key on the Deliveries list only, behind the same Single-key
shortcuts switch. It toggles the pane and never writes. The Inspector button's tooltip reads
"Inspector (I)" and the button carries `aria-keyshortcuts`. It collides with nothing in 365's table.

### Findings for the spec

- **A key a control has handled is owned by that control.** Enter in a criteria field searched, then
  bubbled into the list's Enter-opens after the popover unmounted, and the page navigated away. The
  `@/core/commands` key layer must skip `event.defaultPrevented`.
- **AG Grid preventDefaults Enter on a cell**, so the list's Enter-opens belongs on the grid's
  `onCellKeyDown`, not the document listener. (Fixed in the prototype; the drive checks both.)
- **Bidi in the inspector:** under `dir="rtl"`, the slot value ("02 Oct 2026 · 10:00 - 12:00") and
  the courier line ("JAH · Khalid N.") reorder. Both are handed to
  [The foundation in Arabic/RTL](378-the-foundation-in-arabic-rtl.md) (`A-rtl.png`).
- **The starred default runs on open**, as 366 ruled, and the prototype shows it. The operator
  lead's acceptance of that behaviour change is still owed at the step's sign-off (361).
- **Columns is unchanged** (today's chooser). The prototype only stubs the button.
