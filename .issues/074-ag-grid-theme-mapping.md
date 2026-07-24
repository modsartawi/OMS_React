---
type: wayfinder-ticket
wayfinder: research
map: 068
status: done
blocked-by: 070
---

# 074 — AG Grid theme mapping

## Question

AG Grid does not read our Tailwind tokens — it has its own theming API and its own DOM, which
[logical-tailwind](../.claude/rules/logical-tailwind.md) explicitly puts out of reach of class
overrides. Every grid in the app (Deliveries, Sim results, BBY Inquiry, and the four Document Details
detail grids) must re-tint with the palette or the swap ships a half-restyled app.

Establish:

- **How the grid is themed today** — theming API version in use (legacy CSS themes vs the v33+
  Theming API `themeQuartz`/`themeBalham` with `withParams`), where it is configured, and every
  param or CSS override currently set.
- **The parameter map** — which AG Grid theme params carry our 070 values: background, foreground,
  header background/foreground, border, row hover, row selected, odd-row (the prototype's
  `tr:nth-child(even)` uses `--panel-2`), and the accent used for selection.
- **The dark path** — how the grid switches theme with our `.dark` class, and whether the 071 dark
  values plug into the same params or need a second theme object.
- **What can't be expressed** through params and would need CSS — name it explicitly so the spec
  can decide whether it's worth it.
- **The prototype's grid details** specifically: the inset 3px accent bar on the selected row, the
  totals footer row (pinned bottom row?), and the dashed/solid divider distinction
  (`--divider` between rows vs `--border-strong` under the header).

Output `074-ag-grid-theme-mapping.RESEARCH.md`. Prefer the AG Grid docs via context7 over memory —
the Theming API changed substantially at v33. Read only.

## Comments

**From [070 — The POS token remap (light)](070-pos-token-remap-light.md) (done):** the light table is
settled and, deliberately, **hex** — one of the three reasons for choosing hex over `oklch` was that
`core/theme/ag-grid-theme.ts` is already a hand-mirrored hex copy, so this ticket's remap becomes
copy-paste rather than conversion.

The prototype ([assets/070-pos-token-remap.PROTOTYPE.html](assets/070-pos-token-remap.PROTOTYPE.html))
renders a mock grid on suggested values — `headerBackgroundColor #EEF2F6`, `headerTextColor #586674`,
`borderColor #E3E9F0`, row rules on `--divider #EDF1F5`, header rule on `--border-strong #CBD6E2`,
`rowHoverColor #F4F7FA`, `selectedRowBackgroundColor #E9EFF7` (`--primary-050`),
`accentColor #2F63A6`. Those are a **suggestion to this ticket, not a decision** — 070 explicitly did
not rule on the 9 AG params.

Note also the two `cellStyle` overrides (`deliveries/columns.ts:46`, `document/columns.ts:190`, both
`#c62828`) bypass the theme entirely and need an explicit answer here or in 077.

**From [073 — The reworked layout, filled with our real fields](073-detail-layout-with-our-data.md)
(done):** three grid treatments were deliberately pushed here rather than settled on one screen.

1. **Zebra striping is a real collision.** The POS reference stripes `nth-child(even)`; our restyle
   (BackOffice map 463) went deliberately zebra-less, and today's grids have no banding. The grid theme
   owns row banding for *every* grid in the app, so 073 rendered its prototype zebra-less and left the
   ruling here.
2. **`font-variant-numeric: tabular-nums` belongs in the theme**, once, not per column — 073's layout
   depends on figures aligning in the items table, and `columnKit.money/number` already sets
   `type:'numericColumn'` for the alignment half.
3. **Selected-row treatment.** 073 draws it as a `--primary-050` ground plus an inset accent bar in
   `--primary` on the **inline-start** edge (logical, so it mirrors in RTL for free). That is a theme
   decision, not a screen one — `rowSelection` stays a per-grid prop but the look lands here.

Also: `failedJobRowStyle` in `columns.ts` hard-codes `#c62828` for a failed outbox row. 069 flagged it
as one of two raw `cellStyle` overrides; with 070's `--danger` family declared it now has a token to
move to.

## Answer

Full investigation in
[assets/074-ag-grid-theme-mapping.RESEARCH.md](assets/074-ag-grid-theme-mapping.RESEARCH.md). Every
claim is checked against the **installed** `ag-grid-community@36.0.1` bundle rather than the doc site —
the Theming API moved at v33 and the theming primitives moved again into `ag-stack` by v36.

**How it is themed today.** One theme object, `omsGridTheme` (`core/theme/ag-grid-theme.ts`), applied
at **six** call sites; no legacy CSS theme is imported anywhere. Six shared density params plus ten
colour params per mode, in two hand-mirrored hex blocks. Row/header height are per-grid props, not
params, and stay that way — density is settled (D-9). Outside the theme the app touches AG Grid's DOM
in exactly **two** places, and both are the same `#c62828`.

### The finding that reshaped the ticket: `var()` works on v36

`ag-grid-theme.ts:14` justifies its hex with *"AG params don't resolve CSS vars in all paths"*. The
v36 serializer (`ag-stack:3352`) **returns a string param value verbatim** — there is no JS colour
parsing to break — and every colour the grid derives is computed in CSS via
`color-mix(in srgb, var(--ag-…), …)`. So `backgroundColor: 'var(--card)'` composites correctly
everywhere.

Because `.dark` already reswitches every token, **one params block then serves both themes**, and the
two mirrored blocks collapse into one. `data-ag-theme-mode` keeps a single passenger:
`browserColorScheme`, which is a literal (native scrollbars), not a colour, and has no token.

This is worth more than the copy-paste 070 set this ticket up for. It deletes the 20 mirrored values
069 counted as a real cost of the swap, makes the grid re-tint automatically for 071's dark table
**and any future palette move**, and removes the grid-vs-app divergence bug rather than re-creating it
in new colours. Recorded as a **recommendation to the spec, not a decision** — this ticket is
read-only, and §3's hex table stands if the spec takes the conservative path.

### The parameter map

Seventeen params: the ten in use remapped, seven added (`rowBorder`, `headerRowBorder`,
`pinnedRowBackgroundColor`/`TextColor`/`Border`, `inputBorder`, `invalidColor`). Each was verified
present in the 36.0.1 bundle by name before being listed. Full table with both light and dark values
in the asset §3.

**One departure from 070's prototype suggestion:** `rowHoverColor` reads **`--card-2`**, not
`--background`. On a `--card` white grid inside a `--background` page, hovering to the page colour
reads as a hole rather than a highlight — and in dark it inverts, because page is *darker* than card,
so the hover would move down. `--card-2` is 070's own second panel tier and moves the right direction
in both themes by construction. The prototype's other eight suggestions are adopted as-is.

Named as available-but-unset rather than left to be discovered as fallout: the chrome family
(`chromeBackgroundColor`, `menuBackgroundColor`, `tabBackgroundColor`, `sideBarBackgroundColor`,
`button*`), which derives acceptably; `columnBorder`/`headerColumnBorder`, whose Quartz default of no
vertical rules already matches both the POS reference and today's grids; and `rangeSelection*`, which
is Enterprise.

### The dark path

**No second theme object is needed under either approach.** `withParams(params, mode)` emits a
mode-scoped block on the same theme, so 071's values plug into today's structure unchanged. The flip
is already correct and stays correct — `layout/theme.ts:20-22` toggles `.dark` and rewrites
`agThemeMode` in the same synchronous block, and `index.html:15-18` does both pre-paint, so there is
no frame where the app is dark and the grid is light.

### The three treatments 073 pushed here — two need no work

1. **`tabular-nums` is already done by the grid.** The bundle ships
   `.ag-right-aligned-cell{font-variant-numeric:tabular-nums}`, and `columnKit.money`/`.number` already
   set `type:'numericColumn'`, which is exactly what applies that class. **Every numeric column in the
   app already has tabular figures**; 073's items table gets its alignment for free. No param, no CSS.
2. **Zebra: keep it off** — and for a better reason than restyle inertia. `rowBorder` on `--divider`
   draws a hairline under every row, which is the job banding does, done once and more quietly; both on
   is belt and braces on a 41-column screen. The mechanical catch, if the spec overrules: **`--card-2`
   is already spent on `rowHoverColor`**, so zebra-on makes hover invisible on odd rows and costs a
   second token 070 has not minted. Zebra-on is one line plus a token decision, not one line.
3. **The selected-row accent bar is the one genuine CSS escape.** The `--primary-050` ground is
   `selectedRowBackgroundColor`; the 3px inline-start bar has **no param** — AG Grid exposes no per-row
   edge marker. `.ag-row-selected::after` with `inset-inline-start: 0` (logical, mirrors in RTL for
   free). **`::before` is unavailable** — AG paints its own selection/hover overlay there via
   `--ag-internal-row-overlay-color`. This is the case
   [logical-tailwind](../.claude/rules/logical-tailwind.md)'s exception clause anticipates: the token
   API has no answer.

**The totals footer is expressible after all** — `pinnedRowBackgroundColor`/`TextColor`/`FontWeight`
and `pinnedRowBorder` all exist in 36.0.1, so 073's row is a `pinnedBottomRowData` row themed purely
through params. No grid in the app uses pinned rows today, so this is new surface with nothing to
conflict with.

### The two `#c62828` overrides

`var(--danger)` — `#C23B41` light, `#DF6768` dark. **But the ink cannot stay white.** 071's rule R2
lifts every chromatic to L .66–.76 in dark and records the consequence: in dark, a filled chromatic is
a *light* tonal fill with dark ink, and white measures 2.2:1 on it. So `color` becomes
`--primary-foreground` (`#FFFFFF` light / `#121C27` dark), the token 071 defines for exactly this
case. The comment at `deliveries/columns.ts:42` documents a light-only contrast check and must be
rewritten with the pair rather than deleted.

They are inline styles, so `var()` resolves against `:root`/`.dark` in `global.css` and works
regardless of which path §2 takes. **The substitution is [077](077-severity-colour-layer.md)'s sweep;
the value and the ink-flip finding are this ticket's**, recorded so 077 does not re-derive them.

### One defect found in passing

`ag-grid-theme.ts:5` says AG Grid reads `data-ag-theme-mode` from **`<body>`**. Both writers set it on
`<html>` (`index.html:18`, `theme.ts:22`). The extracted selector is
`:where(:root[data-ag-theme-mode=…], body[…], .ag-theme-mode[…])` — `:root` **is** `<html>`, so the
**code is right and the comment is wrong**. Worth fixing because the docs describe only the
`.ag-theme-mode` class form, and a reader following them would "fix" a working line.

**From [080 — RTL mirroring of the reworked layout](080-rtl-mirroring-of-the-reworked-layout.md)
(done): your one CSS escape is confirmed correct, and one cell needs adding.**

`.ag-row-selected::after { inset-inline-start: 0 }` **mirrors correctly** — verified by rendering it
under `dir="rtl"` and measuring where the bar lands. Worth stating because
[073](073-detail-layout-with-our-data.md) described the same treatment as a `box-shadow` and called
*that* logical, which it is not (`box-shadow` offsets are physical and have no logical form). The
spec here was right; 073's prototype was wrong. Comment filed there too.

**One addition.** The pinned bottom row's label — `4 lines · 7 units` — **reorders under RTL** to
`lines · 7 units 4`. It begins with a digit followed by a space, and bidi rule N1 treats digits as
right-directional when resolving the neutral, so the leading token detaches. It is the only bidi
hazard *inside* the grid: the id, money and quantity columns are all measured safe (a value breaks
only if it contains a space **and** begins or ends with a digit — the space is the culprit, not the
hyphen or decimal point). Fix is a `cellClass` carrying
`direction:ltr; unicode-bidi:isolate` on that pinned cell, not the `<bdi>` component 080 specifies for
our own markup — a grid cell is already its own element.

**And one grid option this ticket did not cover:** `enableRtl` is a **grid option, not a theme param**,
so the theme cannot carry it. 080 rules it should be **one derived value exported beside
`omsGridTheme`**, spread into every `AgGridReact`. Today it is set on exactly one of seven call sites
(`BonusBuyInquiryPage.tsx:206`) and reads `document.documentElement.dir`, which **nothing in the app
ever sets**. Not built now (080 Q3 scoped the `dir` switch out) — recorded so the spec names its home.
