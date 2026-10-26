---
status: open
spec: 590
blocked-by: —
---

# 591 — The app wears the DMSCO palette in light and dark

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

**Slice 0, the tracer.** After this ticket every screen is DMSCO in colour, in both themes.
Shapes follow in later tickets, except the global radius, which lands here.

- **The token table** in the global stylesheet takes spec 590's light table (585) and dark table
  (586, navy night) byte for byte:
  - One gold, `#fec33b`, replaces `#fdc801` in every role.
  - The dark interactive family is `#9db2d8` / `#232e42` / `#3e4d69` / `#c3d2ec`, with dark ink on
    fills.
  - The header comment is rewritten: palette B becomes the DMSCO theme. It cites 585 and 586 and
    says that **light is hueless and dark is navy-tinted on purpose**.
- **`--radius: 1rem`.** h-7 controls become full pills, and cards follow `rounded-lg`. The grid
  wrapper stays 8px, set in its own theme parameters.
- **Links are underlined.** One rule in the shared styling: every navigating text link that takes
  primary ink also carries an underline. No screen is edited for it.
- **The contrast gate's expectations move to the new values.** It keeps its negative assertions:
  gold stays below 3:1 on a light card, and dark fill ink is not white.
- **The theme drive is created** as `tools/dmsco-theme-drive.mjs`, stubbed like the other drives.
  - It walks the shell and the Deliveries list in light, dark and RTL.
  - It asserts that controls resolve to their role tokens through computed style, never a pinned
    hex.
  - It asserts that links have an underline.
  - It asserts that the Deliveries list shows **19 rows at 1568×744**, the same as before the
    theme.
  - It saves screenshots for review.

The prototype branch `prototype/dmsco-density` holds both tables already measured (`ae9aa8a5`,
`a9755710`). Use its values, not its CSS.

## Spine reach

tokens · component (shared link styling) · test (gate + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] contrast gate green with 590's light + dark tables, gold negative assertion kept · lint gate
- [ ] `dmsco-theme-drive`: shell + Deliveries list in light/dark/RTL resolve role tokens; links underlined; 19 rows at 1568×744 · flow (Playwright)

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **No i18n.** Colour only, plus the radius.
- **The login's `--login-*` block is untouched.**
- **Existing drives may go red** on pinned hexes until 593 lands. They are manual-run tools, not
  CI gates, so this ticket doesn't block on them.

## Done when

The gate is green on the new tables and `dmsco-theme-drive` passes on the shell + Deliveries list in all three modes.

## Blocked by

None — can start immediately
