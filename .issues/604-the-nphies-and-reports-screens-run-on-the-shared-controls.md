---
status: done
spec: 590
blocked-by: 597
---

# 604 — The Nphies and reports screens run on the shared controls

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

**Migrate** the `nphies and reports` screens onto the shared controls (spec 590 §Shared controls). This is a
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

Heaviest first: Nphies authorizations (38), eligibility (26), SAP export console (16).

583's inventory (`assets/583-control-inventory/`) lists every occurrence by file and bucket. Re-run
its script before and after, and paste both counts in the ticket.

## Spine reach

component/route (nphies and reports) · test

## Proof (→ `tdd` red-green cycles)

- [x] `dmsco-theme-drive` gains the heaviest nphies and reports screen(s): light, dark and RTL screenshots; every field labelled, every icon button named, role tokens resolved · flow (Playwright)
- [x] the area's existing drives stay green unchanged (colour checks are by role after 593) · flow (Playwright)
- [x] the lint ratchet shows `nphies and reports` at its allowlist (documented one-offs and pickers only) · lint gate

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

Every nphies and reports feature is at its allowlist, its drives are green, and the theme drive covers its heaviest screen.

## Blocked by

[597](597-the-campaign-workspace-runs-on-the-shared-controls.md)

## Comments

**2026-10-26 — built (branch `impl/590-604`).**

**Counts.**

| feature | ratchet before → after (= allowlist) | 583 inventory before → after |
|---|---:|---:|
| nphies/authorizations | 31 → 0 | 38 → 7 |
| nphies/eligibility | 22 → 0 | 26 → 2 |
| reports/sap-export-console | 14 → 6 | 16 → 8 |
| reports/idoc-inspector | 8 → 1 | 8 → 1 |
| reports/retail-invoice | 5 → 1 | 5 → 1 |
| **total** | **80 → 8** | **93 → 19** |

The 583 "after" column holds three things:
- the 8 allowlisted buttons;
- 6 native checkboxes, radios and file inputs that spec 590 keeps (their `accent-color` comes
  from `global.css`);
- 5 `<Link>`s styled as buttons. They already navigate, are not on the ratchet and were left
  alone (597).

Local constants deleted: `CONTROL` and the local `Field`, in both `ListFilters.tsx` files and in
`EligibilityCheckPage.tsx`. Nothing else in the area held a field constant. `LABEL_TOKEN_CLASS`
is a severity palette, not a control style, and it stays.

**What became what.**
- **Fields** moved onto `Input` / `Select`.
- **Labels above a field became `Field`:**
  - the list filters and the eligibility form (their local `Field` was a `<label>` wrapper);
  - the add-row, the diagnosis and morphology rows, the attachment document and the cancel reason;
  - the IDoc and Invoices lookup toolbars. The required `*` rides in the `label` node.
  - The hand `aria-label`s that repeated the label are gone, because the Field's
    `<label for>` names the control now.
- **Fields with only an `aria-label` kept it, with no Field:**
  - the line cells (quantity, max coverage, days supply, selection reason);
  - the nine deductible boxes;
  - the SAP fleet and double-sends toolbars.
- **Invalid is `aria-invalid`.** The `border-danger-border` toggles are dropped. The IDoc and
  Invoices lookups keep their own error `<p>` where it was (after the buttons), with its
  `aria-describedby`. Moving it under the field would change the arrangement.
- **Search boxes:** the SAP fleet's hand-built search box (label + absolute icon + `ps-8`) is now
  `Input type="search"`. The double-sends store box was already `type="search"` and is now the
  shared one. The diagnosis and morphology searches feed a select and stay `type="text"`.
- **`IconButton`:** the window chip's ✕ on both Nphies lists, as `danger compact`. Its hand
  `title` is gone because it equalled the label.
- **`Button`:**
  - Search as `primary`, and Reset, Refresh, Fill and Apply as `outlined`, across the Nphies
    lists, the eligibility form and the three reports toolbars.
  - The eligibility submit as `primary`, keeping `aria-disabled` + `title` for the gate reason.
  - Attachment View as `outlined` and Remove as `danger-outlined`.
  - The line Void as `danger-outlined`, keeping its `title`.
  - Diagnosis Remove as `outlined`.
  - The IDoc per-type download as `outlined`.
  - Minted-by Clear as `outlined`.
  - The `className="h-7|h-8"` overrides on existing Buttons are removed.
- **`Chip`:**
  - The IDoc minted-by tag filters (`font-mono` kept, the hand `aria-pressed` dropped).
  - The SAP fleet's chosen-state pills: `on`, which adds `aria-pressed="true"`.
  - The store-day state legend: `disabled` is kept for unknown codes.

**Allowlist (8, restyled in place).**
- IDoc document rail card: a tile picker. `border-primary-border` became `border-primary`, and
  `border-border/60` became `border-border`.
- Invoices per-row Download: a grid-cell action. `border-border/60` became `border-border`.
- SAP fleet count tiles: a tile picker. `border-border/60` became `border-border`.
- SAP export-label filter chips on the fleet and the store day: they carry a severity tone, so
  they are one-offs, restyled to an `h-7` pill.
- Three non-navigating "Clear filters" text buttons: fleet, store day and double sends.

**Proof.**
- **Theme drive, block "604"**, light/dark/RTL: 270/270.
  - `nphies-authorization`: the form with two priced lines, a principal diagnosis, the deductible
    block and attachments. Then the list filters and the window chip ✕.
  - `nphies-eligibility`: the check form.
  - `reports-toolbars`: the SAP fleet toolbar with a chosen-state Chip, the double-sends filters,
    and the IDoc and Invoices lookups.
  - New block helpers: `tagByLabel` (marks a control by its visible label) and
    `expectAllButtonsShared` (every text button is a 28px pill).
  - Red first, with `src` reverted to the tip, light only: 28/92. It failed on 32–36px fields,
    the `--background` ground, the `border/60` edge, and buttons at 32–36px.
- **Area drives** (stubbed, port 5604):
  - Green: `sap-export-store` 71/71 and `sap-export-storeday` 55/55.
  - Pre-existing failures, the same checks failing with `src` reverted to the tip `56c4990f`:
    - `nphies-authorization-session` 191/192: leaving an in-flight request.
    - `nphies-eligibility` crashes after "the Nphies nav leaf is present — 0 leaves".
    - `idoc-inspector` 143/145, `invoice` 77/79 and `nphies-authorizations`: the nav-leaf checks.
      These drives look for a rail leaf the 592 shell no longer draws that way.
    - `sap-export-fleet` 110/111: "clicking a row opens its store page".
    - `nphies-authorizations` 118/121 also fails "the refusal's own act is RENDERED…", and
      failed it on the tip too.
  - **Load-related:** `nphies-authorizations`' "and Back returns to the list" reads the URL 800ms
    after the click. Under load the lazy list route commits later: a probe copy of the drive read
    `/AUTH-1` at 800ms and `/nphies/authorizations` at 3.8s, then passed. The detail page is not
    touched by this ticket. Its other detail-page checks flipped between runs on both the tip and
    this branch.
  - No drive was edited.
- **Gates:** `npm run lint` passes all 5 (ratchet: "none above the baseline"). `npm run typecheck`
  is clean. `npm test` passed 424 files / 6728 tests.

**Snags.**
- Sizes moved to the shared 28px/12px: the list filters and the eligibility form were 36px/14px,
  and the lookup toolbars 36px. The authorization add-row, diagnosis row and attachment select
  were 32px.
- The morphology Fields' labels were `text-attention-800` inside the attention panel. They are now
  the Field's muted label ink.
- `git stash` is shared by every worktree. One red run here popped a sibling's pricing stash by
  mistake. It went straight back as `d8720d17` (a stash commit, on no branch) and its owner has
  since popped it. Red runs after that used a patch file.

**Open questions.**
1. **Severity-toned label chips (SAP fleet and store day).** They are `aria-pressed` toggles that
   carry a tone. `Chip` has no tone, so they are allowlisted one-offs. Should `Chip` gain a tone,
   or should these stay one-offs?
2. **The chosen-state pills on the SAP fleet.** Each removes its state when clicked. As `Chip on`
   they now announce `aria-pressed="true"`. Is that acceptable, or should they be a
   remove-labelled control?
