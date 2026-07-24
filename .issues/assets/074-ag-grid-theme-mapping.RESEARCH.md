# 074 — AG Grid theme mapping · research

Read-only investigation for ticket [074](../074-ag-grid-theme-mapping.md), map
[068](../068-pos-palette-and-document-detail-rework.md). Every claim below is checked against the
**installed** build (`ag-grid-community@36.0.1` in `node_modules`), not against memory or docs prose —
the Theming API changed at v33 and again through v36, and the doc site is versionless in places.

Sources: `node_modules/ag-grid-community/dist/package/main.esm.mjs`,
`node_modules/ag-stack/dist/package/main.esm.mjs` (v36 moved the theming primitives into `ag-stack`),
and the AG Grid React docs via context7 (`/websites/ag-grid_react-data-grid`).

---

## 1 · How the grid is themed today

**Version:** `ag-grid-community` / `ag-grid-react` **36.0.1** (`package.json:16-17`). Well past the v33
break, so the modern Theming API is in force and there is **no legacy CSS theme import anywhere** —
no `ag-theme-quartz.css`, no `ag-grid.css`. Confirmed: zero matches for `ag-theme-` outside the
generated bundle.

**One theme object, six consumers.** `src/core/theme/ag-grid-theme.ts` exports `omsGridTheme`, applied
as `theme={omsGridTheme}` at every grid in the app:

| Consumer | File |
|---|---|
| Deliveries (Screen 1, 41 columns) | `features/oms/deliveries/DeliveriesPage.tsx:160` |
| Change Store picker (×2 grids) | `features/oms/document/ChangeStoreDialog.tsx:161,173` |
| The four Document Details detail grids | `features/oms/document/DetailGrid.tsx:61` |
| BBY Inquiry | `features/pricing/bonus-buy-inquiry/BonusBuyInquiryPage.tsx:198` |
| Sim bonus-buy panel | `features/pricing/simulation/SimBonusBuyPanel.tsx:41` |

That single point of application is the ticket's best news: **the remap is one file**, and every grid
in the app re-tints together or not at all.

**Every param currently set** — `themeQuartz.withParams(…, 'light').withParams(…, 'dark')`:

*Shared (`denseSharedParams`, lines 17-24):* `spacing: 4` · `fontSize: 12` · `fontFamily` (Inter /
Readex Pro / system-ui) · `headerFontSize: 12` · `headerFontWeight: 600` · `wrapperBorderRadius: 10`.

*Per mode (10 each):* `backgroundColor` · `foregroundColor` · `headerBackgroundColor` ·
`headerTextColor` · `oddRowBackgroundColor` · `rowHoverColor` · `selectedRowBackgroundColor` ·
`accentColor` · `borderColor` · `browserColorScheme`.

Row and header **height are props, not params** — `OMS_GRID_ROW_HEIGHT = 28` and
`OMS_GRID_HEADER_HEIGHT = 30` (lines 61-64), passed per grid. Leave them there; they are density, and
density is a settled product decision (403 §7, D-9), untouched by this map.

**Beyond the theme, exactly two CSS-level escapes exist in the whole app** — and both are the same hex:

- `features/oms/deliveries/columns.ts:46` — `cellStyle` on the Failed Jobs column,
  `{ backgroundColor: '#c62828', color: '#ffffff', fontWeight: '700' }` when `count > 0`.
- `features/oms/document/columns.ts:190` — `failedJobRowStyle`, a `getRowStyle` returning the same
  three declarations for a failed outbox row (`DocumentDetailsPage.tsx:411`).

No stylesheet in the repo targets an `.ag-*` class. The grid's DOM is untouched today, which is
exactly what [logical-tailwind](../../.claude/rules/logical-tailwind.md) asks for.

### 1a · Two defects found in passing

**The doc comment names the wrong element.** `ag-grid-theme.ts:5` says AG Grid picks the mode from
`data-ag-theme-mode` on **`<body>`**. Both writers actually set it on `<html>` —
`index.html:18` and `layout/theme.ts:22`, via `document.documentElement.dataset.agThemeMode`.

**The code is right and the comment is wrong.** The generated selector, extracted verbatim from the
bundle, accepts all three:

```
:where(:root[data-ag-theme-mode="X"], body[data-ag-theme-mode="X"], .ag-theme-mode[data-ag-theme-mode="X"]) &
```

`:root` **is** `<html>`, so the current wiring works. Worth noting because the docs describe only the
`.ag-theme-mode` class form, and a future reader following the docs would "fix" a working line. One
comment edit; not a decision.

---

## 2 · The finding that changes the shape of this ticket

`ag-grid-theme.ts:14-15` carries a standing claim: *"Values are hex because AG params don't resolve CSS
vars in all paths; keep them in sync with global.css."*

**On v36 that is no longer true.** The colour serializer, `ag-stack/dist/package/main.esm.mjs:3352`:

```js
var colorValueToCss = (value) => {
  if (typeof value === "string") {
    return value;                       // ← emitted verbatim into --ag-<param>
  }
  if (typeof value === "object" && value && "ref" in value) {
    const colorExpr = paramToVariableExpression(value.ref);
    if (value.mix == null) return colorExpr;
    const backgroundExpr = value.onto ? paramToVariableExpression(value.onto) : "transparent";
    return `color-mix(in srgb, ${backgroundExpr}, ${colorExpr} ${clamp(value.mix * 100, 0, 100)}%)`;
  }
  return false;
};
```

A **string param value is passed through untouched** — there is no JS colour parsing, no `hex → rgb`
step that a `var()` would break. And every derived colour the grid computes is done in **CSS**, via
`color-mix(in srgb, var(--ag-…), …)` — three such expressions ship in the bundle. So a param of
`'var(--card)'` composites correctly everywhere the grid derives from it.

**Consequence:** the theme can read our tokens directly instead of mirroring their hex.

```ts
// today — two hand-mirrored hex blocks that must be kept in sync with global.css
.withParams({ backgroundColor: '#ffffff', … }, 'light')
.withParams({ backgroundColor: '#262521', … }, 'dark')

// possible on v36 — one block, no mirror, no sync hazard
.withParams({ backgroundColor: 'var(--card)', … })
```

Because `.dark` on `<html>` already reswitches every token, **one params block serves both themes**.
The `data-ag-theme-mode` machinery then carries a single remaining passenger: **`browserColorScheme`**,
which is a *literal*, not a colour (`colorSchemeValueToCss = literalToCSS`, `ag-stack:3366`) and cannot
be expressed as a token — it drives native scrollbar and form-control rendering inside the grid. So the
shape becomes one full params block plus a two-line mode pair setting only `browserColorScheme`.

**What this is worth.** 069 counted the hand-mirrored hex copy as one of the swap's real costs, and
070 chose hex partly to make this ticket copy-paste. Reading tokens directly is better than either:
it deletes 20 mirrored values, makes the grid re-tint automatically for **071's dark table and any
future palette move**, and removes a class of bug (grid and app disagreeing) rather than re-creating it
in new colours.

**The caveat, stated honestly.** `var()` values are opaque to AG Grid's JS — nothing reads them back,
so nothing breaks, but a *typo'd* token name fails silently to `unset` rather than throwing. Mitigation
is a one-time visual check, not a code mechanism. Also, 070's and 071's values are still the source of
truth; this changes *where the grid reads them*, not what they are. **This is a recommendation to the
spec, not a decision — this ticket is read-only.** The hex table in §3 is written so it stands either
way.

---

## 3 · The parameter map

Ten params today; the table below adds the ones the prototype and 073 need. Column 3 is the
recommended `var()` form (§2); columns 4-5 are the literal hex, so the spec can take the conservative
path without re-deriving anything.

| AG param | What it paints | Token | Light (070) | Dark (071) |
|---|---|---|---|---|
| `backgroundColor` | grid body ground | `--card` | `#FFFFFF` | `#1C2631` |
| `foregroundColor` | cell text | `--foreground` | `#19232E` | `#ECF0F3` |
| `headerBackgroundColor` | header row ground | `--muted` | `#EEF2F6` | `#27313A` |
| `headerTextColor` | header labels | `--muted-foreground` | `#586674` | `#98A6B4` |
| `borderColor` | default for every border | `--border` | `#E3E9F0` | `#2E3742` |
| `rowHoverColor` | hover overlay | `--card-2` ¹ | `#FAFBFC` | `#17212C` |
| `selectedRowBackgroundColor` | selection overlay | `--primary-050` | `#E9EFF7` | `#22344B` |
| `accentColor` | focus ring, checkboxes, range edges | `--primary` | `#2F63A6` | `#6BA0E8` |
| `oddRowBackgroundColor` | zebra — see §5 | `--card` (= off) | `#FFFFFF` | `#1C2631` |
| `browserColorScheme` | native scrollbars | *literal* | `light` | `dark` |
| **`rowBorder`** | rules between rows | `--divider` | `#EDF1F5` | `#28313B` |
| **`headerRowBorder`** | the rule under the header | `--border-strong` | `#CBD6E2` | `#3B4755` |
| **`pinnedRowBackgroundColor`** | totals footer ground | `--muted` | `#EEF2F6` | `#27313A` |
| **`pinnedRowTextColor`** | totals footer ink | `--foreground` | `#19232E` | `#ECF0F3` |
| **`pinnedRowBorder`** | rule above the footer | `--border-strong` | `#CBD6E2` | `#3B4755` |
| **`inputBorder`** / `inputBackgroundColor` | filter inputs inside the grid | `--input` / `--card` | `#CBD6E2` / `#FFFFFF` | `#3B4755` / `#1C2631` |
| **`invalidColor`** | validation | `--danger` | `#C23B41` | `#DF6768` |
| `wrapperBorderRadius` · `spacing` · `fontSize` · `fontFamily` · `headerFontSize` · `headerFontWeight` | — | **unchanged** | — | — |

¹ **`rowHoverColor` is the one row that departs from the 070 prototype's suggestion.** 070 proposed
`#F4F7FA` (`--background`). On a `--card` white grid inside a `--background` page, hovering a row to
the *page* colour reads as a hole rather than a highlight, and in dark it inverts (page is *darker*
than card, so hover would go down). `--card-2` is the second panel tier and moves the correct
direction in both themes by construction — it is 070's own "second surface" and 073 already uses it as
the rail ground. **The prototype's other eight suggestions are adopted as-is.**

All bolded rows are params **not set today**; every one was verified present in the 36.0.1 bundle by
name before being listed here.

### Params deliberately not set

- `columnBorder` / `headerColumnBorder` — vertical rules. Quartz's default (none between body cells)
  matches both the POS reference and today's grids. Setting them would be a new visual, not a remap.
- `chromeBackgroundColor`, `menuBackgroundColor`, `tabBackgroundColor`, `sideBarBackgroundColor`,
  `buttonBackgroundColor` and the rest of the chrome family — these paint the column menu, tool panel
  and filter popups, which derive acceptably from `backgroundColor`/`borderColor`. Listing them is
  possible; needing them is not established. Flagged so the spec knows the surface exists rather than
  discovering it as fallout.
- `rangeSelection*` — Enterprise range selection; we are on Community.

---

## 4 · The dark path

**No second theme object is needed, under either approach.** `withParams(params, mode)` on the same
theme emits a `:where(:root[data-ag-theme-mode="<mode>"] …)`-scoped block, so the existing two-mode
structure already plugs 071's values in directly with no structural change.

The flip is correct today and stays correct: `layout/theme.ts:20-22` toggles the `.dark` class and
rewrites `dataset.agThemeMode` **in the same synchronous block**, and `index.html:15-18` does both
pre-paint. There is no frame in which the app is dark and the grid is light.

Under §2's single-block form, `.dark` alone would repaint the grid — the class flip *is* the token
flip — and `data-ag-theme-mode` would remain only to carry `browserColorScheme`. Both writers stay;
nothing is removed from the flip path.

---

## 5 · Zebra striping — the collision 073 flagged

`oddRowBackgroundColor` is the whole mechanism, and it is set today to **the same value as
`backgroundColor` in both modes** (`#ffffff` / `#262521`) — i.e. **zebra is explicitly off**, matching
the restyle's deliberate zebra-less choice (464) and today's shipped grids.

The POS reference stripes `tr:nth-child(even)` with `--panel-2`, and 070 minted `--card-2` `#FAFBFC` /
`#17212C` for exactly that tier — so **turning zebra on is a one-line change with a token already
waiting**, and turning it off is the status quo. Nothing about the palette forces either.

Two mechanical facts the decision should have:

1. **`--card-2` is already spoken for as `rowHoverColor`** (§3). If zebra uses the same token, hover
   becomes invisible on odd rows. Zebra-on therefore costs a *second* value — either hover moves to
   `--muted` (a heavier hover) or zebra takes a tint between card and card-2 that 070 has not minted.
   Zebra-on is not one line after all; it is one line plus a token decision.
2. **Selection and hover are `:before` overlays**, not backgrounds:
   `.ag-row-selected { --ag-internal-row-overlay-color: var(--ag-selected-row-background-color) }`,
   painted by a `:before` with `inset: 0`. So a **semi-transparent** selected colour composites over
   whatever the row's ground is — which is why AG's own docs pair zebra with `rgba` selection. Our
   `--primary-050` is opaque, and opaque is correct while zebra is off.

**Recommendation: keep zebra off.** Not from restyle inertia but because the grid already carries row
rhythm — `rowBorder` on `--divider` (§3) draws a hairline under every row, which is the same job
banding does, done once and more quietly. Turning both on is belt and braces on a 41-column screen
that needs neither. The decision is the spec's; this ticket only establishes it is a one-token flip
with one consequence attached.

---

## 6 · What the prototype needs that params cannot express

Three of 073's grid treatments were pushed here. **Two of the three turn out to need no work at all.**

### 6a · `tabular-nums` — already done by the grid

073 asked for `font-variant-numeric: tabular-nums` in the theme rather than per column. The bundle
already ships it:

```css
.ag-right-aligned-cell{font-variant-numeric:tabular-nums}
```

`columnKit.money`/`.number` already set `type: 'numericColumn'`, which is precisely what applies
`.ag-right-aligned-cell`. **Every numeric column in the app already has tabular figures**, and 073's
items table gets its aligned figures for free. No param, no CSS, no change. Also worth carrying to
[080](../080-rtl-mirroring-of-the-reworked-layout.md): the same rule set is guarded by `.ag-ltr` /
`.ag-rtl` classes, so AG Grid mirrors its own alignment and our logical-utility rule genuinely does
stop at its DOM boundary, as the rule already says.

### 6b · The totals footer — expressible, and it is a pinned bottom row

`pinnedRowBackgroundColor`, `pinnedRowTextColor` and `pinnedRowFontWeight` all exist in 36.0.1
(verified by name), plus `pinnedRowBorder` for the rule above it. So 073's pinned totals row is a
**pinned bottom row** (`pinnedBottomRowData`) themed entirely through params — §3 has the values.

Note: **no grid in the app uses `pinnedTopRowData`/`pinnedBottomRowData` today** (zero matches), so
this is new surface, and the params are unset. Nothing conflicts.

### 6c · The selected-row accent bar — the one genuine CSS escape

073 draws selection as a `--primary-050` ground **plus a 3px inset accent bar on the inline-start
edge**. The ground is `selectedRowBackgroundColor` (§3). The bar has **no param** — AG Grid exposes no
per-row edge marker — so it is the single treatment in this ticket that requires touching `.ag-*` CSS.

`logical-tailwind` puts third-party widget DOM out of reach of *class overrides* and says to theme
through the token API instead; this is the case where the token API has no answer, which the rule's
own exception clause anticipates. Recommended shape, in `global.css`, scoped and logical:

```css
.ag-row-selected::after {
  content: '';
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;          /* mirrors in RTL for free */
  width: 3px;
  background: var(--primary);
  pointer-events: none;
}
```

Two mechanical cautions, both checked:

- **`::before` is taken.** AG Grid paints its own selection/hover overlay on `.ag-row-selected:before`
  using `--ag-internal-row-overlay-color`. Use `::after`, or the overlay disappears.
- **Stacking.** The overlay `:before` has `inset: 0` and sits above the cell ground; `::after`
  declared later paints above it, which is the order we want (bar over ground).

This is the complete list. Everything else 073 and the prototype ask of the grid is a param.

---

## 7 · The two `#c62828` overrides

`deliveries/columns.ts:46` and `document/columns.ts:190` both hard-code
`{ backgroundColor: '#c62828', color: '#ffffff', fontWeight: '700' }`. They bypass the theme entirely
— `cellStyle`/`getRowStyle` return inline styles, so no param and no mode switch reaches them, and
they are **identical in dark mode today**, which is the actual bug: a warm 2014-era Material red on a
`#1C2631` steel panel.

070 declared the family they belong to. The substitution is direct and needs no new value:

| Today | Becomes | Light | Dark |
|---|---|---|---|
| `backgroundColor: '#c62828'` | `var(--danger)` | `#C23B41` | `#DF6768` |
| `color: '#ffffff'` | see below | | |

**The ink cannot stay white.** 071's rule R2 lifts every chromatic to L .66–.76 in dark, and records
the consequence explicitly: *"in dark every filled chromatic control is a light tonal fill with dark
ink (white measures 2.2:1 on them)"*. `--danger` dark `#DF6768` is exactly such a fill. So the ink must
be a token that flips — `--primary-foreground` (`#FFFFFF` light / `#121C27` dark) is the one 071
already defines for this exact situation, and using it keeps the pair AA in both themes instead of
failing badly in one.

The comment at `deliveries/columns.ts:42` ("White on #c62828 clears the WCAG AA contrast minimum")
documents a light-mode-only check and must be rewritten with the pair, not deleted.

Because these are inline styles, `var(--danger)` resolves against the element's inherited custom
properties — which come from `:root`/`.dark` in `global.css`, not from AG Grid — so this works
regardless of which approach §2 takes. **Ownership:** the substitution is mechanical and belongs to
[077](../077-severity-colour-layer.md)'s sweep; the *value* and the ink-flip finding are this
ticket's, recorded here so 077 does not re-derive them.

---

## 8 · Summary — what the spec needs to decide

| # | Question | This research says |
|---|---|---|
| 1 | Read tokens via `var()`, or mirror hex? | **`var()`** — proven safe on v36 (§2); deletes 20 mirrored values and the sync hazard 069 counted. Hex table in §3 stands if the spec prefers the conservative path. |
| 2 | The parameter map | §3 — 10 existing params remapped, 7 added. One departure from 070's prototype: `rowHoverColor` → `--card-2`, not `--background`. |
| 3 | Zebra on or off? | **Off** — `rowBorder` on `--divider` already carries row rhythm, and zebra-on costs a token that does not exist yet because `--card-2` is spent on hover (§5). |
| 4 | `tabular-nums` | **Nothing to do** — AG Grid v36 already applies it to `.ag-right-aligned-cell`, which `type:'numericColumn'` sets (§6a). |
| 5 | Totals footer | **Params, not CSS** — `pinnedRow*` exists; the row is a `pinnedBottomRowData` row, new surface, nothing conflicts (§6b). |
| 6 | Selected-row accent bar | **The one CSS escape.** `.ag-row-selected::after`, logical `inset-inline-start`; `::before` is AG's own overlay (§6c). |
| 7 | The two `#c62828` | `var(--danger)`, **ink must flip** to `--primary-foreground` or dark fails AA (§7). Sweep belongs to 077. |
| 8 | Doc-comment defect | `ag-grid-theme.ts:5` says `<body>`; both writers use `<html>`, and `:root` is in the selector, so the code is right (§1a). |
