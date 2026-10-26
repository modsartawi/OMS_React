---
type: wayfinder-ticket
wayfinder: prototype
map: 580
status: done
blocked-by: 581, 584
---

# 587 — The shell, and which mark it carries

## Question

The shell is `src/layout/` (`AppShell`, `Rail`, `TopBar`, `UserMenu`, the command palette): a navy
rail with the al-dawaa gold mark (`core/ui/BrandMark`) and the "BackOffice" wordmark. The login now
shows the **DMSCO** lockup. **What does the shell look like in the DMSCO language, and which mark
does it carry?**

Prototype from 581's Homepage frame, keeping our navigation model (rail groups, crumbs, command
palette, rail modes) — arrangement stays ours, look comes from the design:

- **The mark:** DMSCO lockup, the al-dawaa mark, or both (company vs pharmacy brand)? And on a
  dark rail, which version of the lockup (the Figma one has navy text, which disappears on navy)?
- **The rail ground** under the new palette, its active marker, and its hover state.
- **The top bar and page header**: does the design's large heading style reach page titles here
  (per 584's scale)?

Owner picks by eye.

## Prototype

Built 2026-10-26 on the throwaway branch `prototype/dmsco-density` (commit `d1c7915e`, worktree
`C:\Playground\oms-react-proto-dmsco`, `npx vite --port 5251` against staging). Real pages,
today's sizes (584). The floating bar's ← / → switches the **look** and its ↑ / ↓ the **mark**:

- **Looks:** A, today's rail on 585's palette with the 3px gold bar marker; B, the Figma top bar's
  treatment moved onto the rail: radial deep navy, a filled `#182F4A` pill with a gold icon for the
  active item, pill rows, and a white pill search field.
- **Marks:** the white DMSCO lockup next to the "BackOffice" wordmark, collapsing to the dotted-D
  symbol (cropped from the lockup); today's al-dawaa glyph; or both, with DMSCO at the head and
  al-dawaa · BackOffice under it.

Awaiting the owner's pick.

## Answer

Resolved 2026-10-26 by the owner, by eye on the prototype: **the DMSCO lockup, with look B (the
Figma top bar's treatment)**.

- **Mark:** the white DMSCO lockup, a hairline divider, then the "BackOffice" wordmark in the
  expanded rail and drawer. The collapsed rail shows the dotted-D symbol cropped from the same
  artwork. The al-dawaa glyph (`core/ui/BrandMark`) leaves the shell; whether it stays anywhere
  else (favicon, printed pages) belongs to the spec. Sources:
  `assets/581-figma-frames/assets/dmsco-logo-on-dark.svg` and the crop on the prototype branch
  (`src/assets/prototype-dmsco/dmsco-symbol.svg`, viewBox `155 0 107 140`).
- **Rail ground:** the design's radial deep navy (`#111A1E` → `#172031`) on the rail, its flyout
  and the drawer. The colours become tokens in `global.css`; the prototype's literals don't ship.
- **Active item:** a filled `#182F4A` pill with a gold icon and a faint white hairline in place
  of the 3px gold bar. Every rail row and icon is a full pill, and hover keeps `--rail-accent`.
- **Top bar:** stays 44px on `--card`. The palette field and the store chip become full pills,
  and the field's ground is white.
- **Page titles stay at today's size** (584). The design's large headings stay off working screens.
- **Sizes are unchanged:** 56/240px rail, 32px rows, collapse rules from spec 380 F13.

Open for the spec, not blocking: the blue dots of the symbol are faint on navy at 22px (brand
artwork, accepted as is); the active pill's hairline must pass the gate's non-text 3:1 or be
dropped in favour of a lifted fill.
