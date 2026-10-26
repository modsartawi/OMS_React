---
status: open
spec: 590
blocked-by: 594, 595
---

# 596 — The lint check stops hand-styled controls from growing back

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

The **fifth lint gate,** built from 583's inventory script.

- **What it counts:** hand-styled `<button>`, `<input>`, `<select>` and `<textarea>` per
  feature, outside `__prototype__` folders. The counts come from 583's bucket rules, tuned so the
  shared controls aren't counted.
- **A checked-in baseline:** today's count per feature, after 594/595. **No feature's count may
  rise.** An area ticket lowers its feature's baseline to its allowlist, the documented one-offs
  and pickers with a reason each.
- **Wired into `npm run lint`** beside the other four gates.
- **It must not depend on a global TypeScript 5:** the repo's TypeScript 7 has no compiler API. Use
  a parser the repo ships (pin the TypeScript 5 API as a dev dependency, or a JSX parser), and say
  which in the ticket.

## Spine reach

test (lint gate) · tooling

## Proof (→ `tdd` red-green cycles)

- [ ] the gate passes on main and fails when a hand-styled `<input>` is added to a feature (shown in the ticket) · lint gate
- [ ] the gate runs with no global install (fresh shell, `npm run lint`) · check

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **Tooling only.** No change to screens.

## Done when

`npm run lint` runs five gates, and the ratchet fails on a new hand-styled control.

## Blocked by

[594](594-buttons-are-pills-and-icon-buttons-and-chips-are-shared.md), [595](595-fields-share-one-input-select-textarea-and-field.md)
