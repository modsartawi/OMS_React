---
status: open
spec: 590
blocked-by: 591
---

# 593 — Drives check colours by role, not by hex

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

The 38 drives that probe a colour stop pinning hex values, so a palette change no longer breaks
them.

- **A pinned-literal assertion is deleted.** The contrast gate owns token values.
- **A role assertion is rewritten to compare against the token:** for example,
  `getPropertyValue('--danger')` read from the document. Typical roles are the danger ink, the
  gold cursor and the attention chip.
- **Nothing else changes.**

Start from a grep of the drives for `rgb(`, hex literals and `getComputedStyle`. List each drive
and what was done to it in the ticket.

## Spine reach

test (tools drives)

## Proof (→ `tdd` red-green cycles)

- [ ] every touched drive green against stubs after 591's tables · flow (Playwright)
- [ ] no drive under tools/ asserts a literal colour value (grep in the ticket) · check

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **Drives only.** No change under `src/`.

## Done when

Every drive that probed a colour passes on the DMSCO tables, and none pins a hex.

## Blocked by

[591](591-the-app-wears-the-dmsco-palette-in-light-and-dark.md)
