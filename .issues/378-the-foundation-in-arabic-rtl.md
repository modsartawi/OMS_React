---
type: wayfinder-ticket
wayfinder: prototype
map: 358
status: done
blocked-by: —
---

# 378 — The foundation in Arabic/RTL

## Question

What does the Ops Console **foundation** (362's tokens and density, 359's Plex incl. Plex Sans
Arabic, 363's rail shell) need to hold up under `dir="rtl"` with Arabic text, before step 1 ships?
The four screens get their own RTL passes in their steps (361); this ticket is the shared layer.

- **AG Grid:** in 363's RTL capture the Deliveries grid body did **not** mirror while the shell did.
  Does `ag-grid-theme`'s `enableRtl` (read once at module load) reach every grid, and what is the
  rule for a grid in a page whose direction changes?
- **Plex Sans Arabic at 12px / 26px rows:** legibility, line-height and vertical centring in grid
  cells and 6px controls (359 checked Latin only).
- **Mono IDs and codes in RTL:** 359 put IDs in Plex Mono; do they need `Ltr` isolation everywhere
  (crumb record number, store chip, grid cells), and does the breadcrumb separator read right?
- **Logical-only:** sweep the foundation diff for physical utilities and icons that must or must not
  flip (chevrons, the expand/collapse toggle, arrows in buttons).
- **The keyboard legends** 365 made LTR-isolated: do they sit right in the RTL top bar and palette?

- **Time windows and other digit ranges.** From [the sentence ticket](373-the-call-center-order-header-as-a-sentence.md):
  `Ltr`'s documented rule (a value breaks only with a space and a leading or trailing digit) is
  incomplete. `15:00–18:00` reverses to `18:00–15:00` under RTL with no space in it. **The shipped
  call center slot chip already does this** (`ConsoleShell` `Chip`, `${from}–${to}` unwrapped).
  Restate the rule and sweep for ranges. See `assets/373-shots/C-arabicRtl-light.png`.

Drive it on the 363 prototype branch (`?rtl=1`) with an Arabic locale stub for the shell's strings.

- **From [The Deliveries list as one screen](368-the-deliveries-list-as-one-screen.md):** under
  `dir="rtl"`, the inspector's **slot value** (`02 Oct 2026 · 10:00 - 12:00`, a day plus a window) and
  its **courier line** (`JAH · Khalid N.`) reorder. Add both to the sweep. See
  `assets/368-shots/A-rtl.png`.

## Answer

**The foundation holds under Arabic/RTL once the six fixes below land with it.** All are measured on
363's shell D, with an Arabic stub for the shell's strings and Arabic stub rows. The owner picked
three things live: Arabic `size-adjust: 115%`, the **slash** separator, and numbers at the cell's
**end**.

- **Prototype:** branch `prototype/378-rtl` (`18dd9cd`, `4f3bc5b`), stacked on 363's `acd5564`. It
  lives in the worktree `C:\Playground\oms-react-378`.
- **Toggles:** `?ar=1&fix=0|1&iso=0|1&glob=0|1&arsize=100|108|115&sep=slash|chevron`.
- **Bench:** `/prototype/bidi`, which measures 23 value shapes × 8 techniques, alone in an RTL cell
  and inside an Arabic sentence. The readout sorts each character's box by x.
- **Evidence:** [captures + `facts.json`](assets/378-shots/).

### 1. AG Grid direction

- **Why 363's grid did not mirror:** it was not the module-load read. `omsGridDirection` is an
  **opt-in spread, and 5 of 22 grids never spread it**: `DeliveriesPage`, `DetailGrid`,
  `ChangeStoreDialog`, `CentralInvoicesPage` and central-invoice `ResultGrid`.
- **`enableRtl` is `@initial`** (AG Grid 36.0.1), so a mounted grid cannot change direction.
- **Rule: direction is an app-boot fact.**
  - `dir` is set from the locale before first paint, the way the theme is.
  - `@/core/theme` then calls `provideGlobalGridOptions({ enableRtl })` once.
  - Measured: every grid mirrors with no opt-in. `omsGridDirection` and its 17 spreads go.
  - A language switch reloads the page. If a live switch is ever wanted, grids remount on
    `key={dir}`.
- **The global hook carries scalars only.** Under the default `'shallow'` merge, a grid's own
  `defaultColDef` replaces a global one (measured: no effect). The renderer therefore goes in a
  shared base (§2).
- **Pinning is physical.** `pinned: 'left'` stays left in a mirrored grid, which put the pinned
  Delivery No at the reading **end** (`fixed-ar-light.png`).
  - **Rule:** a core `pinStart` replaces the literal sides. It reads `'right'` under RTL and is
    read at boot.
  - Three files use literal sides today: the deliveries columns, the bonus-buy-inquiry columns
    and retail-invoice `DownloadAction`.
- **Numbers stay at the end (owner).** Under `enableRtl`, `numericColumn` moves to the cell's inline
  end, which is left in RTL. AG Grid's convention is kept, with no override.

### 2. Bidi isolation: `Ltr`'s rule restated

**These break without a space:**

| Value | Reads under RTL |
|---|---|
| `15:00–18:00` | `18:00–15:00` |
| `+966558102177` | `966558102177+` |
| `-5.00` (U+2212 too) | `5.00-` |
| `7+` | `+7` |
| `40 / 200` | `200 / 40` |
| `1001 · Riyadh` | `Riyadh · 1001` |
| `JAH · Khalid N.` | `.JAH · Khalid N` |

Inside an Arabic sentence, `2026-09-12` also reads `12-09-2026` and `5%` reads `%5`.

**These survive un-isolated:** pure digits, `08:07`, `1,240.70`, `ERX-77120934` and `Ctrl+K`.

**Every isolation works:** `<bdi dir=ltr>`, `<bdi>`, LRI or FSI…PDI, and CSS isolate. Two things
fail:

- `unicode-bidi: plaintext` on the cell end-aligns LTR values and still breaks inside sentences.
- **Isolating each end of a range separately reverses it** (`18:00–15:00`), and pairs and `n / m`
  reverse the same way.

**The rule, restated** (replaces 095's shape rule in `Ltr.tsx`; amends 373's finding):

- **Isolate by kind, not shape.** Every value that comes from data is rendered isolated wherever the
  text can be RTL. That covers numbers, money, codes, dates, times, ranges, phones, counts, key
  chords, names, addresses and notes. There is no "safe shape" list: 095's list was right about its
  own shapes and still let ranges, signs and counts through.
  - **Machine values** take `Ltr` (`<bdi dir="ltr">`).
  - **Free text in either script** (names, addresses, notes, server messages) takes `<bdi>`, dir
    auto, per 373/138.
- **Isolate the whole value, never its parts.** A range, a `code · name` pair or `n / m` is
  formatted to one string and isolated once.
- **String-only sinks** get a core helper that wraps the value in FSI…PDI (measured ✓). These are
  `title`, `placeholder`, native `<option>`, toast strings, `document.title` and AG header names.
  The helper is **never** used in grid values or exports, because its invisible characters would
  reach Ctrl+C and CSV.
- **Grids get one core base `defaultColDef`** that every grid's `defaultColDef` spreads.
  - Its renderer is a React `<bdi>` (auto) showing `valueFormatted ?? value`.
  - Measured with `?glob=1`: slot, date-time, phone, Arabic name and money all read right.
    Alignment and the failed-jobs cell style are untouched.
  - Under AG Grid React a function renderer *is* a component, so returning a DOM node throws
    (measured).
  - A column with its own renderer isolates its own values.
  - `Ltr` used as a cell renderer reads `value` and silently drops `valueFormatter`. The base
    renderer replaces that use.
- **A lint gate stands next to 483's.** It refuses a file that mounts `<AgGridReact` without the core
  base, because an opt-in is exactly what failed for direction (5 of 22).
- **`enableRtl` and isolation land in one change.** Mirrored without isolation, the live grid read
  slot `10:00 - 08:00`, entry `08:00 2026-09-01` and mobile `2178 810 51 966+`
  (`mirrored-unisolated-ar-values.png`).

### 3. The range sweep (main, today)

| Where | Shape |
|---|---|
| `callcenter/console/header-chips.ts:99`, the **shipped** slot chip | `${from}–${to}`, which reverses (373) |
| `oms/document/fields.ts:283`, the Details slot | `from - to` |
| `collection.json` `daySpan` | `{{from}} – {{to}}` |
| `bonus-buy-inquiry.json` `range` | `Showing {{first}}–{{last}} of {{total}}`: becomes one range value |
| `bonus-buy-download.json` and `broadcast.json` `counter` | `{{a}} / {{b}}` |
| `formatDateTime` (`yyyy-MM-dd HH:mm`) | every place it is shown: grid date columns and Details |

- **Ranges written with words** ("from {{from}} to {{to}}") need each value isolated, and nothing
  more, because the words carry the order.
- **Interpolated values** are isolated through `<Trans>` slots (373) or the FSI helper.
- **368's inspector slot** `02 Oct 2026 · 10:00 - 12:00` and **its courier** `JAH · Khalid N.` (or an
  Arabic name) are covered by the rule. Its bench rows are `day-win` and `courier-l`/`courier-a`, and
  it is applied in the List step.

### 4. Plex Sans Arabic at 12px in 26px rows

- **At 100% Arabic reads a step smaller than Latin** (`zoom-names-100` vs `-115`).
- **Owner: `size-adjust: 115%` on the four Plex Sans Arabic `@font-face` rules only.** Latin, the
  12px token and the 26px rows do not change.
- **Fit:**
  - An Arabic name's ink is 15px tall in a 26px row, with 7px above and 4px below. Latin digits are
    9px tall, at 9 and 9.
  - Arabic sits about 1.5px below centre. That is accepted, with no per-script line-height.
  - Descender words (`إيجابي يُجري`), the header row, 28px controls and Arabic buttons don't clip.
- This is the Arabic half of 359's 12px check, which was Latin-only.

### 5. Shell, mono IDs, icons and key legends

- **Logical sweep of the 362+363 diff:** no physical utilities. Chevrons carry `rtl:-scale-x-100` or
  `rtl:rotate-90`, and the marker and the selected-row bar use `inset-inline-start`. With Arabic
  strings, the rail, flyout, crumb, store chip and bell all mirror.
- **Crumb (owner): the slash stays.** The chevron variant flipped correctly too. The record number is
  pure digits and reads right without isolation, but it goes through `Ltr` by kind. The store chip
  code does the same.
- **Mono changes nothing about bidi:** Plex Mono sits fine beside Plex Sans Arabic. Isolation is by
  kind.
- **Key legends:**
  - Un-isolated, the `<kbd>` row mirrors to `K Ctrl`.
  - Isolated as one unit (a `dir="ltr"` wrapper, not one per `<kbd>`), it reads `Ctrl K` at the
    field's inline end. 365 holds.
- **Not foundation work:** untranslated English strings in RTL move their trailing punctuation to the
  start (`...Saved views`). Real Arabic keys remove that.

### Where it lands (361's steps)

- **Foundation step 1:**
  - boot `dir` and global `enableRtl`
  - `pinStart`
  - the core base `defaultColDef`, its renderer and the lint gate
  - the `Ltr` doc rewrite, plus a bidi rule under `.claude/rules/`
  - the FSI string helper
  - Arabic `size-adjust` 115%
  - the §3 sweep, including the call center slot chip, because it is a foundation-rule fix
- **Each screen's step** re-drives RTL on its own values: the List its inspector slot and courier,
  the Call center its sentence.
- **Noticed, not this ticket's:** the 362/363 prototype base logs React "Maximum update depth
  exceeded" on Deliveries with every 378 flag off. It was not checked on `main`.
