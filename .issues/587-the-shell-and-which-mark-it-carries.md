---
type: wayfinder-ticket
wayfinder: prototype
map: 580
status: open
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
