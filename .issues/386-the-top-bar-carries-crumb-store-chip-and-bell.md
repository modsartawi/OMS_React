---
status: done
spec: 380
blocked-by: 385
---

# 386 — The top bar carries the crumb, the store chip and the bell; the user menu sits at the rail foot

Step S1 (Foundation) of [spec 380](380-ops-console-rebuild-spec.md). Spec decisions **F11, F12,
F20**. The values are in [363](363-the-rail-shell.md) ("Top bar", "Store chip", "User menu",
"Broadcast").

## What to build

- **The top bar** is 44px on `--card`, with `print:hidden` (F20). It holds only:
  - **the crumb:** group / [sub-group] / screen / record number, derived from the menu. The separator
    is a **slash** (owner, [378](378-the-foundation-in-arabic-rtl.md) §5). The record number goes
    through `Ltr` and mono;
  - **the store chip**, at the inline end;
  - **the bell**, at the inline end.

  The palette field is **not** here yet. It arrives with 392 (361: no Ctrl+K hint before the keyboard
  step).
- **The store chip.** The acting store moves **out of the account popup** into its own chip ("Acting
  store `1001`", the code in `Ltr`, mono), opening today's `StoreSwitcher`. **With no store it takes
  the attention tone**, so the "store not resolved" dead end is visible from every screen.
- **The user menu at the rail foot.** An avatar opens a menu holding:
  - name + user id;
  - the theme toggle;
  - sign out;
  - the **build stamp**.

  The shortcuts sheet and the single-key switch join it in 393. `/version.json` stays the machine
  read. **Today's footer row is removed.**
- **Broadcast** stays an Administration leaf only. There is no top-bar button.
- **i18n:** `common:topbar.*` gets the crumb's accessible label, the store chip (set and unset), and
  the user menu items and build-stamp label. No literals.

The menu's overlay look is 388's card or navy recipe. This ticket gives it correct structure, focus
and dismissal.

## Spine reach

`layout/` shell (top bar, crumb derivation, store chip, user menu) · `common` locale · drive.

## Proof (→ `tdd` red-green cycles)

- [x] `crumb derives group, sub-group and screen from the menu for a route` (including a Settlement
  sub-group route and a record route) — pure · vitest
- [x] `tools/foundation-drive.mjs` (extend), in light, dark and RTL:
  - the crumb reads the current screen;
  - the store chip shows the acting store and opens the switcher, and with no store set it carries
    the attention tone;
  - the user menu opens from the rail foot with theme, sign out and the build stamp;
  - no footer row is rendered.

  · flow (Playwright)

## Boundaries

- New `common:topbar.*` keys. No endpoints; the store chip reads today's session store.
- The bell's panel redesign is 389. This ticket only places the bell.

## Done when

Every shell screen shows the 44px top bar with crumb, store chip and bell, the user menu works from
the rail foot, the footer is gone, and the drive passes.

## Blocked by

[385](385-navigation-lives-in-an-expanding-navy-rail.md)

## Comments

**Done 2026-10-02.**

**What was built:**
- `layout/TopBar.tsx` is the 44px bar on `--card`, with `print:hidden`. It holds:
  - **the crumb:** a `nav` landmark labelled "Breadcrumb" over an `<ol>`, with an aria-hidden slash separator. The record number is mono, through `Ltr`, and marked `aria-current`.
  - **the store chip:** "Acting store `1001`", the code mono through `Ltr`. With no store it reads "No acting store" in the attention tone (`attention-050` ground, `-border` edge, `-800` ink). It opens today's `StoreSwitcher` in a card panel (`role="dialog"`). Focus moves to the picker once the store list has settled. Esc returns focus to the chip; an outside click or navigation closes it.
  - **the bell**, unchanged; its panel is 389's.
- `layout/crumb.ts` holds `deriveCrumb(menu, pathname, params)`, which is pure. It reads the full `MENU`, so the crumb names the screen while the probes settle.
  - The most specific item wins, and on a tie the deeper one.
  - The record comes from the route params, never from the last path segment.
  - Matching goes through the new `matchLength` beside `isActive` in `menu-model.ts`. `isActive` is now `matchLength >= 0`, so the crumb and the lit leaf share one rule.
- `layout/UserMenu.tsx` is the avatar at the rail foot, under the expand toggle.
  - It opens a navy panel (377 §1: from the rail is navy) holding the name (`<bdi>`), the user id (`Ltr`, mono), a `menu` with the Dark mode `menuitemcheckbox` and Sign out, and the build stamp ("Build" + `buildTag`, mono, `Ltr`).
  - Focus lands on the first item. The arrows wrap, and Home/End jump. Esc returns focus to the avatar. Tab, an outside click or navigation closes it.
  - It and a rail flyout never stand open together.
  - Expanded, the foot shows the name and the id beside the avatar (the D capture).
- `AppShell` is now the rail plus a column of `TopBar` and `main`. The account popup, the top-bar theme button and the footer row are gone. `/version.json` is untouched.
- Keys: `common:topbar.crumb`, `topbar.store.{label,unset}` and `topbar.userMenu.{darkMode,signOut,build}`. `topbar.account` is kept for the avatar and the menu; `topbar.darkMode` is removed (no other user).

**Proof:**
- vitest `src/layout/crumb.test.ts`: 10 tests. They cover a plain leaf, two Settlement sub-group routes, the Overview tie, three record routes, the most-specific claim (`/nphies/eligibility/new`), a param-less create screen, splat and empty params, a trailing slash, home and an unknown address, and a top-level leaf. The test was red first (no module), then green.
- `tools/foundation-drive.mjs` gains a `topbar` part (`DRIVE_ONLY=topbar`), 32 checks in each of the four modes (light and dark, LTR and RTL), 128/128:
  - the bar is 44px on B's `--card`, its only controls are the chip and the bell, and no `footer` is rendered;
  - the crumb reads OMS / Delivery Documents; Collections / Settlement Account / Open settlements; and OMS / Delivery Documents / `1000000393` (mono, `bdi dir=ltr`). Each is read along the reading direction by x, and it starts at the inline start;
  - the chip reads "Acting store 1001" in the quiet tone, and the chip then the bell sit at the inline end;
  - the chip opens the switcher on 1001 with the picker focused; Esc, an outside click and navigation close it;
  - with `currentStoreCode: ""` the chip's ground, ink and edge equal the attention tokens on two screens, and the switcher opens on "Choose a store…";
  - the user menu opens navy against the rail's inline-end edge with name, id, Dark mode, Sign out and "Build v…+sha";
  - in the user menu, focus, arrow wrap, the theme flip, Esc back to the avatar and outside click all hold, and it never stands open with a flyout;
  - the expanded foot names the user; print hides the bar; Sign out lands on `/login`; no page errors.
- The whole foundation drive is 432/432 (paint, grids, ranges, rail and topbar).
- Regression drives:
  - `oms-access` 28/28, `central-invoice` 65/65, `central-invoice-list` 52/52, `loy-member` 184/184, `settlement` 291/291.
  - `settlement` needed its two `locator('nav').innerText()` reads widened to every nav, because the crumb is a second `<nav>`. It flaked once, then passed twice; see HITL-386.
  - `collection` is 258/260, the same two date-bound 255 failures as the 385 baseline.
  - `palette-drive` needs a live `Auth/Login` and fails at the same line as the 385 baseline.
- `tools/screen1-smoke.mjs` (needs a live SIS.Api, not run) now toggles the theme through the user menu.
- Gates: `npm run typecheck` is clean. `npm test` passes 170 files and 3159 tests. `npm run lint` passes all four gates (726 files; 22 grid mounts; 148 contrast pairs; 731 files). `npm run build` is green.

**Reviews:**
- `/code-review` found no correctness bugs.
- `/standards-review` raised four findings, all fixed:
  - the avatar's `'U'` literal fallback;
  - the store panel not closing on navigation;
  - the chip's accessible name missing its space;
  - `crumb.ts` copying `isActive`'s matching, now `matchLength`.
- Left on purpose: the outside-click/Esc dismiss effect now exists in four places (rail flyout, bell, chip, user menu). That is 388's one overlay recipe to fold together.

**Decisions taken unattended:** see `.afk/HITL-386.md`.
- record from params;
- the brand name on `/`;
- the build-stamp wording;
- "Sign out" and the checkbox item;
- the pre-388 overlay look;
- the narrow chip.

**Outstanding (owner):** the S1 live sign-off is at 391, and the Arabic-rendering eye check needs a human. Neither is a build blocker.
