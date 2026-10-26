---
status: open
spec: 590
blocked-by: 598, 599, 600, 601, 602, 603, 604, 605
---

# 606 — No hand-styled field constants are left

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

**Contract**, after every area is swept.

- **Delete the remaining local field constants** (the `INPUT` copies) and core's `RULE_INPUT`,
  once nothing references them.
- **`BrandMark`:** check whether anything outside the shell still uses it (favicon, print headers).
  Delete it if nothing does; otherwise note the remaining use and keep it.
- **Tighten the ratchet:** every feature's baseline equals its documented allowlist, and the
  baseline file records the reason for each allowlisted control.
- **Re-run 583's inventory** and record the before and after totals in the ticket.

## Spine reach

component (shared UI) · test (lint gate)

## Proof (→ `tdd` red-green cycles)

- [ ] typecheck + all five lint gates green after the deletions · lint gate
- [ ] `dmsco-theme-drive` full run (every area's screens) green in all three modes · flow (Playwright)

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **No behaviour change.**

## Done when

No local field constant remains, the ratchet equals the allowlist everywhere, and the full theme drive is green.

## Blocked by

[598](598-the-rest-of-campaigns-runs-on-the-shared-controls.md), [599](599-the-oms-screens-run-on-the-shared-controls.md), [600](600-the-pricing-screens-run-on-the-shared-controls.md), [601](601-the-admin-screens-run-on-the-shared-controls.md), [602](602-the-collection-screens-run-on-the-shared-controls.md), [603](603-the-call-center-console-runs-on-the-shared-controls.md), [604](604-the-nphies-and-reports-screens-run-on-the-shared-controls.md), [605](605-the-remaining-areas-run-on-the-shared-controls.md)
