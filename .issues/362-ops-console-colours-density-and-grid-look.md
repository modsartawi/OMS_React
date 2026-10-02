---
type: wayfinder-ticket
wayfinder: prototype
map: 358
status: done
blocked-by: 359
---

# 362 — Ops Console colours, density and grid look

## Question

Settle the exact Ops Console tokens for **light and dark**:

- navy, gold and neutral surfaces and text;
- status colours that keep their **distinct domain meanings** (cancellation, cancellation request,
  prescription, provenance);
- focus, selection and hover;
- radius and depth;
- the **AG Grid look**: row height (28px today), header, borders, pinned columns.

Gold is a signal colour. Check its contrast before it ever carries text.

**Type is settled** ([359](359-which-type-family-the-ops-console-uses.md): Plex Sans, Plex Mono for
IDs and codes only, Plex Sans Arabic). Prototype in those faces, and **check Plex Sans at 12px in the
chosen row height** in both modes. The owner chose the family without a side-by-side comparison.

Try it live in the real app, through `global.css` and `ag-grid-theme.ts`, and the owner reacts in
both modes. The Answer records the token values. The prototype branch and its captures are the
asset.

## Answer

**The owner picked palette B, "Navy-led", with 26px rows, 12px grid text and 6px controls.** They
decided it on 2026-10-02 by flipping between three candidates, each in light and dark, on the live
app. The candidates were today's steel, A "Far as drawn" and B "Navy-led".

**Assets:**

- The prototype is branch `prototype/362-ops-console-tokens` (`da08890`, never merges), worktree
  `C:\Playground\oms-react-362`.
- The 32 captures (1×, light and dark, plus a rows × text matrix) are in
  [362-shots/](assets/362-shots/). The decisive ones are `deliveries-navy-{light,dark}.png`,
  `document-navy-{light,dark}.png` and `grid-navy-*-26-12.png`.
- To run it: in the worktree, `npx vite --port 5199`, then open
  `/oms/deliveries?stub=1&palette=navy`.
- `PALETTE=navy TABLE=1 node tools/proto-362-contrast.mjs` re-measures the palette against the
  production gate's pairs plus the new ones. **B is clean on all 143 pairs in both modes.**

### 1. Neutrals and accent: navy-led

The neutrals take the navy's temperature (H≈218). The interactive blue is **the navy lifted, not a
third blue**: Far's cobalt `#1F4FD1` read as a second brand blue beside the rail. All values are
hex, per 082 D-1. Token names stay 082's, so call sites don't change.

| Token | Light | Dark |
|---|---|---|
| `--background` | `#F2F4F8` | `#0A111D` |
| `--foreground` / `--card-foreground` / `--accent-foreground` | `#0F1B2D` | `#E6EBF2` |
| `--card` | `#FFFFFF` | `#111A28` |
| `--card-2` (second tier, grid hover) | `#F7F9FC` | `#162131` |
| `--muted` | `#EBEFF5` | `#1B2536` |
| `--muted-foreground` | `#46546A` (7.67 on card) | `#A3AFC0` (7.86) |
| `--ink-3` | `#6F7C91` (4.23 on card) | `#788599` (4.67) |
| `--accent` (hover ground) | `#E3E8F0` | `#222E41` |
| `--border` / `--border-strong` / `--divider` | `#DFE4EC` / `#C6CEDB` / `#E8ECF2` | `#212C3D` / `#2E3B4F` / `#1A2433` |
| `--input` (field edge) | **`#8590A3`** (3.22 on card) | **`#5A6780`** (3.07) |
| `--ring` (focus) | `#0F4C9C` (8.29 on card) | **`#FDC801` gold** (11.18 on card) |
| `--primary` | `#0F4C9C` | `#79A7EC` |
| `--primary-050` / `-border` / `-800` | `#E7EEF8` / `#BCD0EC` / `#0B3A78` | `#1A2B45` / `#2C4469` / `#BCD4F6` |
| `--primary-foreground` | `#FFFFFF` (8.29) | `#0A111D` (7.70) |
| `--secondary` / `-press` / `-foreground` | `#46546A` / `#38455A` / `#FFFFFF` | `#8794A8` / `#98A4B6` / `#0A111D` |
| `--destructive-foreground` | `#FFFFFF` | `#0A111D` |

**Field edge to 3:1.** A finding: today's `--input` measures **1.47:1** on card, which is under WCAG
1.4.11. The new edge clears 3:1 in both modes and reads heavier. The owner saw it and kept it.

**Dark ink on dark fills (082's R2) still holds.** Every dark chromatic fill carries
`--primary-foreground`, never white.

### 2. Brand: navy rail, gold signal

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--sidebar` (rail) | `#002554` | `#002554` | The brand navy, the same in both modes |
| `--sidebar-foreground` | `#D3DBE8` | `#C7D2E3` | 10.82 / 9.88 on navy |
| `--sidebar-accent` (hover / active ground) | `#143662` | `#143662` | Ink on it: 8.69 / 7.93 |
| `--sidebar-muted` **(new)** | `#8FA0BD` | `#8FA0BD` | Group labels, 5.69. `muted-foreground` is ~2:1 on navy |
| `--sidebar-active` | `#FDC801` | `#FDC801` | The active marker |
| `--gold` / `--gold-foreground` **(new)** | `#FDC801` / `#002554` | same | 9.65 both ways |

**Gold rules.** Gold is a signal and never a text colour on a light surface.

- Gold measures **1.56:1 on white** and **1.37:1 on `--primary-050`**.
- It is allowed **on navy**: the rail marker, the rail focus ring and the mark.
- It is allowed **as a fill carrying navy ink**: the Ctrl+K key cap and the mark.
- It is allowed **on dark surfaces**: the dark focus ring and the dark cursor bar.
- It is never a light-mode ground for any other ink, and never a light-mode line that carries
  meaning.

`--brand-panel` (the login slab) is untouched. The login page is out of scope.

### 3. Status colours: 082's, unchanged

`--success`, `--attention`, `--danger`, `--post`, `--prescription`, `--fam-fulfilment` and
`--fam-cancel-request`, with all their tiers, **carry over from 082 byte for byte** in both modes.
Their domain meanings stay distinct:

- cancellation is danger;
- a cancellation request is indigo;
- a prescription is teal;
- POST provenance is violet;
- fulfilment is green.

They re-measure clean on B's grounds. Far's own variants were 082's give or take a step, and Far's
green failed white ink (4.33:1), so nothing was gained by taking them.

### 4. Focus, selection, hover

- **Focus:** a 2px `--ring` outline with a 2px offset (today's rule). Navy in light, gold in dark.
- **Selection:** the `--primary-050` row ground plus a **3px leading-edge cursor bar on the new
  `--cursor` token**. It is **navy `#002554` in light** (15.08 on card) and **gold in dark** (11.18).
  It sits on the logical start edge (`inset-inline-start`), so it mirrors in RTL.
- **Hover:** `--accent` for controls and `--card-2` for grid rows.

### 5. Radius and depth

- `--radius` goes from `0.625rem` to **`0.5rem`**. That makes **controls 6px** (`--radius-md`:
  buttons, fields, tokens), **cards, menus and the grid wrapper 8px** (`--radius-lg`), and **dialogs
  and the palette 10px**.
- **Buttons stop being pills.** `core/ui/Button` drops `rounded-full` and keeps `h-7` (28px). The
  owner chose this.
- **Depth** follows Far: one overlay shadow (`0 10px 30px rgb(16 24 40 / .16)` light,
  `0 12px 34px rgb(0 0 0 / .5)` dark) and a backdrop (`rgb(13 16 21 / .32)` / `rgb(0 0 0 / .5)`).
  Cards stay flat on their border. This is taken from Far as drawn and **was not checked live**: no
  dialog was captured. The dialogs fog item owns that check.

### 6. The AG Grid look (`ag-grid-theme.ts`, still one params block)

| Param | Today | Now |
|---|---|---|
| row / header height | 28 / 30 | **26 / 28** |
| `fontSize` / `headerFontSize` / `headerFontWeight` | 12 / 12 / 600 | **12 / 11.5 / 600** |
| `fontFamily` | Inter literal | **`var(--font-sans)`** (resolves to Plex, verified on the painted cell) |
| header ground / ink | `--muted` / `--muted-foreground` | **new `--grid-head` / `--grid-head-foreground`**: `#F2F4F8` / `#46546A` (6.97) light, `#162131` / `#A3AFC0` (7.29) dark |
| `wrapperBorderRadius` | 10 | **8** |
| pinned columns | (no param set) | **`pinnedColumnBorder: --border-strong`** |
| rows, zebra, spacing | `--divider` rules, no zebra, spacing 4 | unchanged |

- **Plex at 12px in 26px rows is legible at 1× in both modes.** This is the check
  [359](359-which-type-family-the-ops-console-uses.md) passed on, and it is now done. 24px rows were
  legible but cramped. 12.5 and 13 cost column width for little gain.
- **IDs in Plex Mono** (359): Delivery, document and order numbers and store codes take
  `font-mono` as a column `cellClass`. The Delivery no. is mono **600**. Plex Mono's dotted zero
  keeps `80001238` readable.
- **Two finding-level fixes go with the grid:**
  - **The cursor bar disappears on a pinned column**, because v36 pinned cells paint over the row's
    `::before`. Today's rule has the same flaw whenever a user pins a column. The fix is
    `z-index: 3` on the bar.
  - **The `tabular-nums` rule** on `.ag-cell` and `[data-numeric]` becomes a no-op under Plex, per
    359. Keep `[data-numeric]` as a marker.

### 7. What changes in the lint gates

This resolves the map's lint-gates fog item.

**`check-contrast.mjs` changes:**

- **It drops** `--foreground` on `--sidebar`. Body ink never sits on a navy rail.
- **It adds** these pairs:
  - `--sidebar-muted` on `--sidebar` (4.5)
  - `--gold-foreground` on `--gold` (4.5)
  - `--gold` on `--sidebar` (4.5)
  - `--grid-head-foreground` on `--grid-head` (4.5)
  - `--foreground` on `--primary-050` (4.5)
  - `--cursor` on `--card` and on `--primary-050` (3, which gold fails in light, so the pair guards
    the light value)
  - `--input` on `--card` (3)
- **It adds a negative assertion: gold on `--card` must stay below 3:1 in light.** This turns the
  "gold never carries meaning on light" rule into a gate, the same way 082 guards white-on-dark
  fills.
- `NOT_A_COLOUR` is unchanged.

**`check-palette.mjs` doesn't change.** Every new value is authored in `global.css`.

The prototype's `tools/proto-362-contrast.mjs` is the worked version of these changes.

### Findings handed on

- **To [The rail shell](363-the-rail-shell.md):**
  - Rename the `--sidebar*` tokens to `--rail*` when the rail lands. `--sidebar` is consumed by
    **`callcenter/console/CustomerRail.tsx`** (`bg-sidebar`), which must **not** go navy. It moves to
    `--card-2` (the prototype overrides it).
  - `text-sidebar-active` is used as **link ink** in `LoginPage.tsx` and `ua-admin/cards.ts`. Gold
    on white is 1.56:1, so those two need `--primary` before the rail token turns gold.
  - Group labels need `--sidebar-muted`.
  - The prototype's active marker is an `inset` box-shadow, which is physical and does not mirror.
    The real marker must be logical.
- **To [The Delivery details record page](371-the-delivery-details-record-page.md):** today's
  identity band (`--brand-panel`, a dark slab) now sits beside a dark navy rail. That is the
  "two dark bands meeting at a corner" that 082 rejected (see `IdentityBand.tsx`), so the new header
  must not be a dark slab. See `document-navy-light.png`.
- **To the printed-output fog item:** a print scope must pin the light B tokens and hide the rail.
  That question is now its own ticket (see the map).
