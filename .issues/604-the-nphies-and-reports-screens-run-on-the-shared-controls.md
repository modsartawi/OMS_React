---
status: open
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

- [ ] `dmsco-theme-drive` gains the heaviest nphies and reports screen(s): light, dark and RTL screenshots; every field labelled, every icon button named, role tokens resolved · flow (Playwright)
- [ ] the area's existing drives stay green unchanged (colour checks are by role after 593) · flow (Playwright)
- [ ] the lint ratchet shows `nphies and reports` at its allowlist (documented one-offs and pickers only) · lint gate

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
