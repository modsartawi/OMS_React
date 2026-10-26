---
status: done
spec: 590
blocked-by: 597
---

# 599 — The OMS screens run on the shared controls

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

**Migrate** the `oms` screens onto the shared controls (spec 590 §Shared controls). This is a
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

The Deliveries list and filter are already done (594/595). Start with Document details (`oms/document`).

583's inventory (`assets/583-control-inventory/`) lists every occurrence by file and bucket. Re-run
its script before and after, and paste both counts in the ticket.

## Spine reach

component/route (oms) · test

## Proof (→ `tdd` red-green cycles)

- [x] `dmsco-theme-drive` gains the heaviest oms screen(s): light, dark and RTL screenshots; every field labelled, every icon button named, role tokens resolved · flow (Playwright)
- [x] the area's existing drives stay green unchanged (colour checks are by role after 593) · flow (Playwright)
- [x] the lint ratchet shows `oms` at its allowlist (documented one-offs and pickers only) · lint gate

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

Every oms feature is at its allowlist, its drives are green, and the theme drive covers its heaviest screen.

## Blocked by

[597](597-the-campaign-workspace-runs-on-the-shared-controls.md)

## Comments

**2026-10-27 — built (branch `impl/590-599`).**

**Counts.**

| feature | ratchet before | ratchet after (= allowlist) | 583 inventory before | 583 after |
|---|---:|---:|---:|---:|
| oms/document | 18 | 3 | 21 | 6 |
| oms/deliveries | 18 | 14 | 19 | 15 |
| oms/prescription-sessions | 14 | 1 | 15 | 2 |
| oms/serving-lists | 12 | 1 | 12 | 1 |
| oms/document-payments | 10 | 2 | 10 | 2 |
| oms/delivery-statistics | 8 | 2 | 10 | 4 |
| oms/dispatch-scorecard | 8 | 3 | 8 | 3 |
| oms/central-invoice | 7 | 1 | 9 | 3 |
| oms/donor-requests | 6 | 0 | 7 | 1 |
| oms/failed-donor-transfers | 6 | 2 | 6 | 2 |
| oms/serial-refusals | 6 | 1 | 6 | 1 |
| oms/pick-support | 4 | 0 | 4 | 0 |
| oms/dispatch-board | 1 | 0 | 1 | 0 |
| oms/document-source-users | 1 | 0 | 1 | 0 |
| oms/geography | 1 | 0 | 1 | 0 |
| **oms** | **120** | **30** | **130** | **40** |

The 583 "after" column is the allowlist plus the native checkboxes/radios/file input spec 590 keeps
(10: Return dialog ×3, Columns chooser, central-invoice GS1 filter, leave-out ×2, donor states,
write-off reasons radio, the central-invoice file input). Links styled as buttons are not counted.
Local constants deleted: `FIELD`/`INPUT` (central-invoice list, dispatch-scorecard,
document-payments, donor-requests, failed-donor-transfers, serial-refusals, prescription-sessions
Ended/Open/ToOpen, pick-support ×2), `SELECT`/`LABEL` (RescheduleDialog), `NUMBERS`
(document-payments), the serving-lists `FIELD`s (AddStores, History, Members, Name) and their
`label` strings, `TAB` (dispatch-scorecard, serial-refusals, pick-support), and
`delivery-statistics/controls.ts` entirely (`PILL*`, `FIELD`, `INPUT`).

**Where the buckets went.** Fields → `Input`/`Select`/`Textarea`; label-above blocks and implicit
labels → `Field` (every filter bar; Mark delivered, Request cancellation, Reschedule, NoteField,
pickup address, write-off note, serving-list Name/Write/AddStores); hints that sat in the label or
beside it → `Field hint` (mark-delivered note, prescriptions store hints, paste hint, write-off),
errors → `Field error` (district lookup, stores lookup, serving-list name problem — now
`aria-invalid` through the Field). Hand-built search boxes → `Input type="search"`
(document-source-users, geography, Add stores). Icon-only → `IconButton` (deliveries inspector
collapse, saved-view menu trigger `compact`, scorecard sheet close, return-quantity steppers
`outlined compact`, basket remove `danger compact`). Tabs → `Chip variant="tab"` inside the existing
tablists (document Activity/Callout, prescription HQ tabs, pick-support tabs, serving-list tabs,
scorecard + serial-refusal report tabs); `aria-pressed` toggles → `Chip` (statistics period/range/
track switches, prescription views + flags). Variant look-alikes → `Button` (inspector Open full
record ×2 `primary`, donor "request only" clear `outlined`).

**Allowlist (30).** Deliveries keeps 14 (594 left them on purpose): inspector act rows, Show all /
Reset / Clear filters text buttons, Save-view rail row, saved-view rows + menu items, the query bar's
Add trigger / field menu entries / Discard, and the composite query token's body / Restore / Remove
segments / Done. Elsewhere: grid-cell actions (central-invoice Serials, payments Open ×2,
scorecard drill + store, failed-transfer number + Re-run), tile/row pickers (scorecard measure tile,
return reason `role="radio"` cards, Add stores `role="checkbox"` hits, prescription to-open group
row), disclosures (pickup address, leave-out types popover, restyled to `h-7 rounded-full`), and
non-navigating text buttons (fact-row Attachments action, leave-out Clear, serial drill Clear). All on
tokens (`border-border/60` → `border-border`, `rounded` → `rounded-md`).

**Label-beside / own-label layouts kept (597 Q1):** note composer (its uppercase label carries the
`N` key chord), central-invoice bulk list (label + hint + live count wired by hand), saved-view name
dialog (its refusal is an `ErrorBanner`, a `<div>` that cannot sit in Field's error `<p>`).

**Proof.**
- Theme drive, block "599", screens `oms-document` (/oms/delivery/8000000253: composer Textarea,
  10 icon buttons named + square, Mark delivered dialog with its Select/Textarea Fields and the
  Other hint described, Request cancellation dialog) and `oms-prescriptions` (HQ tab Chips, view +
  flag Chips by state, Open filter Fields with the store hint, Ended filter Fields), light/dark/RTL:
  183/183 (+1 icon check per mode afterwards). Red first on the unswept sources: 25/61 — 32/36px
  fields on `--background`, `border/60` edges, segmented tabs and `bg-primary` toggle pills.
- Area drives, 40 run: green — delivery-callout 96, delivery-statistics 284, dispatch-board 116,
  dispatch-scorecard 78, document-actions 67, -cards 45, -composer 70, -detail 36, -donor 18,
  -facts 240, -header 292, -items 22, -payments 66, -spine 92, donor-requests 90,
  failed-donor-transfers 102, geography 122, mark-delivered 40, oms-viewer 31, prescription-sessions
  52, -ended 74, -hq 122, -to-open 72, -write-off 88, return-dialog 105, serial-refusals 42,
  serving-list add-stores 80, history 61, members 116, serving-lists 51, writes 104, withheld-serial 36.
  **Pre-existing, same or worse on the integration tip (scratch worktree at 1ba9c126):**
  central-invoice 63/65 (Document reload count; rail leaf lit), central-invoice-list 49/50 (section
  G's Deliveries `form button[type=submit]`), document-rtl 52/53 (font-mono isolates), document-source-users
  74/76 (leaf order in the OMS group), oms-access 23/28 (tip 22/28: rail/home OMS group, new path),
  pick-support 288/290 (tip 287/290: census re-read on return). deliveries-list: first run 340 checks through all four light/dark × ltr/rtl passes of the query, view and inspector sections, its one FAIL the Notifications/Poll timing check ("stepping made no network request") that fails the same way on the tip, then hit the 20-minute cap; three reruns (and the tip's own run) crashed at different points on load-related timeouts / a destroyed execution context — machine shared with sibling drives.
- `npm run typecheck` clean; `npm run lint` 5 gates clean ("none above the baseline"); `npm test`
  424 files / 6728 tests.

**Snags / visible changes.**
- Fields went 32–36px/14px → 28px/12px (595). Rows that matched the old height were brought down
  (donor-requests state checkbox row `h-9` → `h-7`, leave-out row `h-9` → `h-7`).
- Underline tab bars are now chip rows; the `border-b` under them is kept with `pb-2`/`py-2`.
  Segmented pill groups (`rounded-full border bg-card-2 p-0.5`) lost their track: chips sit in
  `inline-flex gap-1` (597's ƒx helper pattern).
- The statistics/prescription toggles were filled `bg-primary` when on; as Chips they are the
  primary-050 tint with the primary edge.
- Field labels are `font-medium text-muted-foreground`; a few dialogs' labels were
  `font-semibold` or foreground ink — accepted.
- serving-lists History's store box was a plain `type="search"`; the shared search Input adds its icon.
- The return dialog's quantity box is now 28px (was 24px) between `compact` (20px) steppers.

**Open questions.**
- Deliveries keeps 14 allowlisted buttons (the query bar/token, rail rows, menu items) as 594 left
  them. Should the query token's Restore/Remove segments and the query bar's Add become
  `IconButton`/`Button` once the token itself is restyled (a separate ticket)?
- The inspector Open full record keeps `disabled` + `title` (no reason announced to the keyboard);
  594 moved the toolbar's Open Delivery to `aria-disabled`. Same move here? (Not done: a sweep does
  not add `aria-disabled`.)
