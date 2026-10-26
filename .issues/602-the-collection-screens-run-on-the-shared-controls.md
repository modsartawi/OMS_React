---
status: done
spec: 590
blocked-by: 597
---

# 602 — The collection screens run on the shared controls

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

**Migrate** the `collection` screens onto the shared controls (spec 590 §Shared controls). This is a
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

Heaviest first: Collection inquiry (74; `CollectionAssignmentPage` alone holds 27), then Settlement (26).

583's inventory (`assets/583-control-inventory/`) lists every occurrence by file and bucket. Re-run
its script before and after, and paste both counts in the ticket.

## Spine reach

component/route (collection) · test

## Proof (→ `tdd` red-green cycles)

- [x] `dmsco-theme-drive` gains the heaviest collection screen(s): light, dark and RTL screenshots; every field labelled, every icon button named, role tokens resolved · flow (Playwright)
- [x] the area's existing drives stay green unchanged (colour checks are by role after 593) · flow (Playwright)
- [x] the lint ratchet shows `collection` at its allowlist (documented one-offs and pickers only) · lint gate

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

Every collection feature is at its allowlist, its drives are green, and the theme drive covers its heaviest screen.

## Blocked by

[597](597-the-campaign-workspace-runs-on-the-shared-controls.md)

## Comments

**2026-10-26 — built (branch `impl/590-602`).**

**Counts.**

| | ratchet (`check-controls`) | 583 inventory: buttons | fields | total |
|---|---:|---:|---:|---:|
| before, `collection/inquiry` (integration tip `67fe1c5f`) | 67 | 37 | 37 | 74 |
| after, `collection/inquiry` | 5 (= the allowlist) | 6 | 6 | 12 |
| before, `collection/settlement` | 24 | 15 | 11 | 26 |
| after, `collection/settlement` | 9 (= the allowlist) | 10 | 1 | 11 |

The 583 "after" rows are what spec 590 keeps: inquiry's 6 fields are 4 checkboxes + 2 file inputs
(native), its 6 "buttons" are the 5 allowlisted `<button>`s + DepositDetail's `<a>` styled as a button
(a link, not on the ratchet); settlement's 1 field is a file input, its 10 are the 9 allowlisted
`<button>`s + one `Link` styled as a button. Local constants deleted: `TEXT_INPUT_CLASS` (Acrs,
Collections, Ready toolbars), `DISABLED_CLASS` (Collections toolbar), `FIELD_CLASS` (ServedByPicker),
`PILL`/`PILL_IDLE` (GridStates and settlement's AccountStates).

**What moved where.**
- Every inquiry toolbar field (5 toolbars + `DateField` + `ServedByPicker`) → `Field` + `Input` /
  `Select`; Search → `Button primary` (still `type="submit"`); Reset → `Button ghost`; the Filtered /
  ACR-scope chips' ✕ → `IconButton danger compact`; the More columns / Filter row / No slip toggles
  (`ToggleChip`, both copies) → `Chip`; Export → `Button outlined`; the slip drawer's close →
  `IconButton` (title only while busy, the label otherwise).
- Collection Assignment: the tab bar → `Chip variant="tab"` inside its `tablist`; every field →
  `Field` + `Input` / `Select` / `Textarea`; the bordered buttons → `Button outlined`, the muted text
  ones (Clear ticks, Cancel ×2) → `Button text`.
- Settlement: the two search boxes → `Input type="search"` (hand-built icon deleted); the scope
  segment and the ledger's kind/status segments (`aria-pressed`) → `Chip`, a `gap-1` replacing the
  bordered segment (597); the open lane's underline tabs → `Chip variant="tab"`; ledger date / text
  boxes and Posted by → `Input` / `Select`; the ledger pill's `×` → `IconButton danger compact`
  (an X glyph replacing the `×` character); post / change-request / business-day / reason fields →
  `Input` / `Textarea`.
- Restyled in place + allowlisted (14): ACRs + Deposits Status segments (`role="radio"`, 597 Q2,
  `h-7` track / `h-6` segment), the CollectorBalances disclosure (`aria-expanded`), the People row's
  Edit (table-row action, now `h-6 rounded-full border-border`), the slip count cell, the two kind
  tile pickers, the ambiguous-branch row picker, the open lane's "clear filter" text button, five
  grid-cell row actions (`border-border/60` → `border-border`).
- Printed facsimiles (`collection-voucher.css`, the ACR/receipt print pages) are untouched.

**Proof.**
- Theme drive, screens `collection-assignment` (Branches + People tabs, then the Cash Collections and
  ACRs strips) and `collection-settlement` (door, post dialog with a blank Review, ledger criteria,
  open lane tabs), light/dark/RTL: **324/324**. Red first: the same screens on the old controls
  failed 59 of 83 light checks (36px fields, `border/60` edges, `--background` ground, unnamed grid
  Selects and pasted-list textarea, the tab bars and segments off the Chip look).
- Area drives (stubbed, port 5602): acr-closed-by 41/41, acr-filters 37/37, assignment-upload 58/58,
  collection 264/264, collections-filters 59/59, four-filters 83/83, people-upload 42/42,
  profit-center 54/54, settlement-approval 42/42, settlement-change 374/374,
  settlement-description 41/41, settlement-supervision 41/41, settlement-theft 62/62, slip-add 52/52,
  slip-count 67/67, slip-drawer 63/63, slip-withdraw 68/68.
- Fails that are the integration tip's, not this ticket's (each re-run with this ticket's `src`
  stashed, same fails): `collection-print` 154/156 (two ACR date-line checks on the facsimile,
  which this ticket does not touch); `ready` 57/59 (two menu checks: 0 rail links);
  `settlement-ledger-filters` (1–5 timing-sensitive fails that move between runs: a call recorded
  after `settle()`; 36/37 on the tip); `settlement` (274 scope refetch, 1199 kind chip, 270/284
  checks — also failing / crashing on the tip under load). A clean re-run of `settlement` on this branch: 283/291, its 8 fails the same flaky family (scope lane, 270 cap, 1199 chip, 283/284 child routes drawing the door).
- `npm run lint` 5/5 (ratchet: `collection/inquiry 5`, `collection/settlement 9`, each = its
  allowlist), `typecheck` clean, `npm test` 424 files / 6728 tests.

**Snags / rulings taken (overrulable).**
- Settlement's field wrappers (`BusinessDayField`, `ReasonField`, the post dialog's Branch / Amount,
  the change request's Amount) keep their own `<label>` and only swap the control: their label
  carries a "required" tag and their trailing block (resolution, read-back words, error, then hint)
  is richer than `Field`'s label → control → hint → error order, which would have reordered them.
  The ledger's label-beside boxes (`DateBox`, `CommitInput`, `PostedByPicker`) likewise keep their
  label (597 Q1).
- Invalid is now `aria-invalid` → the `--danger` edge. Those settlement boxes used to paint
  `border-attention-border` (amber) on an error; the error TEXT stays attention-800. Flagging in case
  the owner wants the amber edge back (that would need an `attention` invalid tone on the shared
  controls).
- Two fields had no accessible name at all and now have one from an existing key: the grid's slot
  Selects (`assignment.columns.accountant|collector`) and the pasted-list Textarea
  (`assignment.bulk.targets.pasted`). No new i18n keys.
- `aria-disabled` Review in the post dialog: a Playwright `click` waits for "enabled", so the theme
  drive clicks it with `force` (the area drives already do the same).
- Rows that lined up with the old 36px fields were re-aligned: the Type tick rows `h-9` → `h-7`,
  `pb-2` → `pb-1` beside the People form, the open lane's count badge lost its `py-0.5`.
- Field labels on Collection Assignment went from `text-sm` to `Field`'s `text-xs font-medium`.
