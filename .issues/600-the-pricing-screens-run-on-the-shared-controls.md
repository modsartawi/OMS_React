---
status: done
spec: 590
blocked-by: 597
---

# 600 — The pricing screens run on the shared controls

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

**Migrate** the `pricing` screens onto the shared controls (spec 590 §Shared controls). This is a
pure restyle: nothing about behaviour, arrangement, copy or density changes.

- **Fields** (text, number, date, search, select, textarea) move onto `Input` / `Select` /
  `Textarea`. A label, hint or error beside a field becomes `Field`. Any local `INPUT`-style
  constant in the area is replaced by the shared control, and the constant is deleted once the
  area no longer uses it.
- **Buttons:**
  - Icon-only buttons become `IconButton`.
  - Chips, toggles and tab bars become `Chip`.
  - Outlined look-alikes and buttons that carry a variant's colours become `Button`.
  - Text-style buttons that navigate take the link look.
- **Restyled in place:** one-offs, row or tile pickers, grid-cell actions and non-navigating text
  buttons are rewritten to tokens and the new radius, and listed in the ratchet's allowlist with a
  one-line reason.
- **Checkboxes and radios** stay native with `accent-color: var(--primary)`.
- **Untouched:** anything under `__prototype__`, and the printed facsimiles' ink.

Heaviest first: Bonus Buy maintenance (40), Simulation (26), Coupons (21).

583's inventory (`assets/583-control-inventory/`) lists every occurrence by file and bucket. Re-run
its script before and after, and paste both counts in the ticket.

## Spine reach

component/route (pricing) · test

## Proof (→ `tdd` red-green cycles)

- [x] `dmsco-theme-drive` gains the heaviest pricing screen(s): light, dark and RTL screenshots; every field labelled, every icon button named, role tokens resolved · flow (Playwright)
- [x] the area's existing drives stay green unchanged (colour checks are by role after 593) · flow (Playwright)
- [x] the lint ratchet shows `pricing` at its allowlist (documented one-offs and pickers only) · lint gate

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **No new i18n keys,** except an accessible name an icon button was missing (add it in the
  feature's own namespace).
- **All rules stand:** logical Tailwind, bidi isolation, zero literals.
- **A restyle only.** If a screen seems to need a behaviour change, stop and write it under
  Open questions.
- **Runs AFK** (`/afk-loop`) once 597's pattern note exists.

## Done when

Every pricing feature is at its allowlist, its drives are green, and the theme drive covers its heaviest screen.

## Blocked by

[597](597-the-campaign-workspace-runs-on-the-shared-controls.md)

## Comments

**2026-10-26 — built (branch `impl/590-600`).**

**Counts.**

| feature | ratchet before | ratchet after (= allowlist) | 583 inventory before | 583 after |
|---|---:|---:|---:|---:|
| pricing/bonus-buy-maintenance | 35 | 1 | 40 | 6 |
| pricing/simulation | 23 | 5 | 26 | 8 |
| pricing/coupons | 18 | 0 | 21 | 2 |
| pricing/bonus-buy-inquiry | 10 | 1 | 11 | 2 |
| pricing/bonus-buy-download | 6 | 0 | 8 | 2 |
| **pricing** | **92** | **7** | **106** | **20** |

The 583 columns are buttons + fields (its links are plain links and are left out, as the ticket's
106 does). "After" is the allowlist plus what spec 590 keeps native: 10 checkboxes, the ledger
radio, two file inputs. Local constants deleted: `INPUT` (bonus-buy-maintenance `fields.tsx`, and
with it `CELL`'s old body, `LIST_BOX`, `PASTE_BOX`), `inputCls` (coupons `CouponDetailPane`,
`ImportWorkspace`, `TemplatesWorkspace`), `CHIP`/`CHIP_ON`/`CHIP_IDLE` (PromotionPage), and the
simulation cells' `cellInput` body (it is now only `w-full`; the spinner-hiding `numInput` extras stay).

**Where the buckets went.** Fields → `Input`/`Select`/`Textarea`; label-above blocks → `Field`
(bby `TextInput`/`DateInput` wrappers now render the core Field; editor limit, org type, coupon
material, Mark Tested note; Engine Rules lists with their meter as the hint, score, max value with
its hint, times; Grouping dialog; Paste box; Buy/Get link selects + total value; BBY Download's
numbers box — hint + count as the Field hint — and its nine attribute fields; BBY Inquiry's number
and dates; every coupons field, the Templates form's local `Field` renamed `TemplateField` with the
core Field as its body). Table-cell fields (Buy/Get grids, grouping materials, simulation items +
manual conditions) are `Input`/`Select` with `aria-label`. Icon-only → `IconButton` (line/material
remove as `danger compact`, New coupon material `compact`, inquiry's filtered-chip clear `compact`).
`aria-pressed` filters → `Chip` (BBY Inquiry status chips + Filter row, the promotion overview's
status chips + Column filters); tab bars → `Chip variant="tab"` (bby editor's folder tabs, coupons'
segmented workspace tabs). Look-alikes → `Button` (inquiry Search/Reset/Export, simulation
Process/Clear/Clear cache/Add item/Add condition, the failure banner's Open settings as
`danger-outlined`).

**Allowlist (7).** bby-inquiry: the grid's row Details (grid-cell action). bby-maintenance: the
overview's Clear filters (non-navigating text button). simulation: the BBY details card footer
(one-off), and four `aria-expanded` disclosures restyled in place (597 Q2): manual conditions'
empty toggle, the missed-promotion card header, the run strip's Done (now `h-7 rounded-full`) and
its chip set.

**Proof.**
- Theme drive, block "600", screens `pricing-bby` (editor Header tab: header Fields, Buy/Get cell
  Inputs/Selects, remove IconButtons, tab Chips; Engine Rules; the promotion overview's search +
  status Chips), `pricing-simulation` (the open run form, the items grid, the run Buttons) and
  `pricing-coupons` (tab Chips, Templates form, Inquiry search), light/dark/RTL: **252/252**.
  Red first, `src` stashed on the tip: light 14/39 (simulation + coupons: 34px fields on
  `--background`, rounded-md run buttons, unnamed items cells, segmented tabs) and bby 13/46.
- Area drives (stubbed, port 5600): bby-link 11/11, coupon-import-delete 65/65,
  coupon-import-file 30/30, coupon-template-limits 22/22, sim-bby-gate 22/22, sim-density 33/33,
  sim-rail 35/35, sim-responsive 47/47, sim-rtl 29/29, sim-states 27/27, sim-strip 51/51.
  **Pre-existing, the same checks fail with `src` stashed on the tip:** bby-maintenance 208/210
  ("5c. a row a column filter hides is unselected", "20. Engine Rules: Max value unavailable" —
  the tab no longer disables Max value), bby-inquiry 103/105 (the two Pricing-menu leaf checks),
  sim-process 48/51 ("the run controls drop the pill — 6px controls": pins 380's 6px radius, which
  591's `--radius: 1rem` already made 14px; 590 now makes them pills), coupon-159 99/103 (the 4
  loyalty fails 597 recorded). coupon-159 rewrites `.issues/assets/159-coupon-signup/*.png` —
  checked back out.
- `npm run typecheck` clean; `npm run lint` 5 gates clean ("none above the baseline"); `npm test`
  424 files / 6728 tests.

**Snags / visible changes.**
- `SimHeaderForm` keeps its implicit labels (`<label>` wrapping the span + control), swapping only
  the control: `sim-strip-drive` reads a focused field's name from `el.closest('label')`, and a
  `Field` (label beside, `htmlFor`) would turn "focus lands on Plant" red. Same arrangement, same
  names.
- Size moves from the shared heights: bby fields 32px, inquiry/coupons/simulation 34–36px, the run
  buttons 32px → 28px; read-only readouts and checkbox rows that matched the old `h-8`
  (editor ReadField, grouping status, promotion type, the Total Minimum Value / Total Discount /
  stackable rows, BBY Download's stackable row) → `h-7` so rows still line up.
- The bby editor's local read-only `Field` is renamed `ReadField` (it shows a value, not a control).
  Its tab strip is a chip row now, so the fieldset under it is fully `rounded-lg` (the folder join
  is gone); the coupons workspace tabs lose their segment frame (597's mapping).
- The simulation items and manual-condition cells had no name at all (column headers only); they
  now take `aria-label` from their existing column keys (no new keys).
- `RemoveCell` keeps `disabled:hidden` on the IconButton (a display-mode bonus buy hides it, as before).
- BBY Download's numbers box sizes by `rows={7}` (≈ its old `min-h-[8rem]`), not a min-height class
  that would fight the Textarea's own.

**Open questions.**
- `bby-maintenance-drive` step 20 and `sim-process-drive`'s 6px check pin looks the code / the
  theme no longer has — re-point them (owner) or leave them to 606?
