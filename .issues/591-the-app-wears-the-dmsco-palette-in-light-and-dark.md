---
status: done
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

- [x] contrast gate green with 590's light + dark tables, gold negative assertion kept · lint gate
- [x] `dmsco-theme-drive`: shell + Deliveries list in light/dark/RTL resolve role tokens; links underlined; 19 rows at 1568×744 · flow (Playwright)

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

## Comments

**2026-10-26 — built (branch `impl/590-591`).**

- **Tokens:** `src/app/global.css`'s `:root` and `.dark` tables now hold spec 590's 585 light and
  586 navy-night values byte for byte; one gold `#fec33b` everywhere (light `--gold`/`--rail-active`,
  dark `--ring`/`--cursor`). Header comment rewritten (DMSCO theme, cites 585/586, "light is hueless
  and dark is navy-tinted, on purpose"). `--login-*` and the brand pair untouched.
- **Radius:** `--radius: 1rem` — h-7 controls at `rounded-md` are 14px, full pills; the grid wrapper
  stays 8px (its own param, asserted by the drive).
- **Links:** one rule in `@layer base`: `a[href]:is(.text-primary, .text-primary-800)` underlines.
  In the base layer so an explicit `no-underline` still wins. No screen edited.
- **Gate:** `tools/check-contrast.mjs` gained an `EXPECTED` table (both themes, 59 tokens) that holds
  590's values byte for byte (red 38 → green); pairs and both negative assertions (gold < 3:1 on a
  light card, dark fill ink not white) kept. 243 checks, green.
- **Drive:** `tools/dmsco-theme-drive.mjs` (port 5291 default, stubbed): screens `shell` (home) +
  `deliveries` × modes light / dark / rtl at 1568×744 → **108/108**. Red first on the pill and link
  checks, green after the radius + link rule. Screenshots → `tools/.dmsco-theme-shots/` (ignored).
- Gates: typecheck clean · lint 4/4 · vitest 6563/6563.

**Snag — the 19 rows.** At a 1568×744 *viewport* the stubbed Deliveries list shows **15** fully visible
rows, both on this branch and on the pre-591 stylesheet (measured by the drive with `global.css`
stashed): the grid box is `h-[calc(100vh-17.75rem)]`, so the count is set by viewport height, and
colour/radius don't move it. 584's 19 was a staging measurement on the prototype branch (different
chrome; "1568×698"), not this layout. The drive therefore asserts the spec's invariant — the same count
as before the theme — with `BEFORE_THEME_ROWS = 15`. Owner: confirm 15-at-744 is the baseline you
want, or name the window size that gave 19.

