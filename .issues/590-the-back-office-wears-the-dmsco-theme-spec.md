---
type: spec
status: ready
---

# 590 — The back office wears the DMSCO theme

Synthesised from wayfinder map [580 — The DMSCO theme, app-wide](580-dmsco-theme-app-wide-map.md).
Every decision below lives in exactly one ticket of that map: 581 (Figma frames), 582 (Chalet
licence), 583 (control inventory), 584 (density), 585 (light palette), 586 (dark), 587 (shell),
588 (sweep strategy), 589 (typeface). The source design is the Figma file *HR-Portal_Website*
(`HENEtVzt5KO6b0Mq9MuvhT`, page "Website - Phase 1"). Its frames, palette and assets are filed
under `assets/581-figma-frames/`. The login is already built (`d689a2f7`) and is the reference
implementation.

## Problem Statement

The company has a new visual language: DMSCO's navy, gold and neutral greys, pill-shaped
controls, and the DMSCO lockup. The sign-in page already wears it. Every screen after sign-in still
wears palette B, the al-dawaa mark and square-ish controls. So an operator who signs in steps from
the company's new brand into an older one.

The design was drawn for a spacious HR website. It has no data table, no dense form, no dark mode
and no left rail. Copying it literally would halve the rows an operator sees (19 rows become 10 on
the Deliveries list, measured on staging) and break the navigation people already know.

There is also a structural cost. Colour is centralised in one token table, but **shape and size are
spelled by hand in each screen**: 435 hand-written buttons on 307 distinct class strings, and 543
fields on 224. Without shared controls, every future theme change repeats this sweep.

## Solution

The whole back office takes DMSCO's **visual language only**. Every flow, step, screen
arrangement, keyboard path and density stays as it is.

- **Colours:** navy `#172031` is the interactive colour everywhere and links are underlined.
  Light neutrals carry no hue. There is one gold, `#FEC33B`.
- **Dark mode:** a "navy night" twin with a lifted navy.
- **Shell:** the rail carries the white DMSCO lockup, or its dotted-D symbol when collapsed, and
  the Figma top bar's look: a radial deep navy, a filled navy pill for the active item with a gold
  icon, and pill rows. The top bar's search field becomes a pill.
- **Controls:** fields, icon buttons and chips move onto new shared controls in the shared UI
  layer, and buttons take the pill shape.
- **Sizes stay compact:** 12px grid text, 26px rows, 28px controls.
- **Typeface:** IBM Plex stays.

It reaches users in two steps. **Release one** carries the token table, the shell, the Button and
grid themes and the new shared controls, and the whole app turns DMSCO at once. **Then the field
shapes follow area by area.** For a while a screen can show DMSCO colours on old field shapes,
which the owner accepted. There is no toggle between old and new looks.

## User Stories

**Brand continuity**

1. As an operator, I want the screens after sign-in to wear the same brand as the sign-in page, so that the back office feels like one company product.
2. As an operator, I want the DMSCO lockup at the head of the rail, so that I know whose system I'm in.
3. As an operator with the rail collapsed, I want the DMSCO dotted-D symbol in the rail head, so that the brand is visible in 56px.
4. As an operator on a phone, I want the drawer to carry the same lockup and "BackOffice" wordmark, so that the narrow layout matches the wide one.
5. As an operator, I want "BackOffice" beside the DMSCO lockup, so that I can tell this tool apart from the company's other systems.
6. As the company, I want the al-dawaa glyph gone from the shell, so that the corporate mark (DMSCO) and the pharmacy brand aren't competing in the frame.

**Density (nothing gets bigger)**

7. As a dispatcher, I want the Deliveries list to show as many rows as today, so that the theme costs me no scrolling.
8. As an operator, I want controls to stay 28px high, so that toolbars keep their current width and wrap points.
9. As an operator, I want grid text to stay 12px with 26px rows and a 28px header, so that dense screens stay dense.
10. As an operator, I want page titles to stay their current size, so that headers don't push content down.
11. As an operator, I want the rail to stay 56px collapsed and 240px expanded, with its current collapse rules, so that my layout doesn't move.

**Colour and legibility**

12. As an operator, I want buttons, the focus ring and the selected-row cursor in DMSCO navy, so that what I can act on reads consistently.
13. As an operator, I want links underlined, so that I can tell clickable text apart from body text now that both are near-black.
14. As an operator, I want selected grid rows to keep their tint and cursor bar, so that I never lose my place.
15. As an operator, I want status colours (success, attention, danger, post, prescription, the command families) to keep their meaning, so that a red still means refusal and a green still means settled.
16. As a low-vision operator, I want every text and control pair to clear WCAG AA, so that the new palette is no harder to read than the old.
17. As an operator, I want gold used only as a signal (the rail's active icon, the focus ring on navy, the Ctrl+K key cap), never as text on white, so that nothing important is written in a colour I can't read.
18. As an operator, I want neutral greys without a blue cast in light, so that the screens match the design's clean neutrals.

**The shell**

19. As an operator, I want the rail's active item shown as a filled navy pill with a gold icon, so that I can see where I am at a glance.
20. As an operator, I want hover on rail rows to keep a visible lifted ground, so that pointing feedback is unchanged.
21. As an operator, I want the rail's flyouts and the phone drawer to share the rail's deep-navy gradient, so that panels opening from the rail read as part of it.
22. As an operator, I want the top bar's palette field and store chip as pills, so that the bar matches the design's search pill.
23. As a keyboard user, I want the rail's focus ring to stay gold on navy, so that focus stays visible on the dark ground.
24. As a screen-reader user, I want the rail's marks to keep their accessible names and `aria-current` logic, so that the restyle changes nothing I hear.
25. As an Arabic-locale operator, I want the rail, its markers and its pill shapes to mirror correctly, so that RTL looks as deliberate as LTR.

**Dark mode**

26. As an operator who works in dark mode, I want a dark twin of the DMSCO theme, so that switching themes still works.
27. As a dark-mode operator, I want the dark neutrals to keep their navy temperature, so that the screens feel like night, not grey.
28. As a dark-mode operator, I want interactive elements in a lifted navy with dark ink on filled controls, so that they read clearly on dark grounds.
29. As a dark-mode operator, I want the focus ring and grid cursor in the one DMSCO gold, so that they stand out on dark.
30. As an operator who prints, I want paper to stay light whatever my screen theme, so that printouts are unchanged.
31. As an operator, I want the login page to look the same in both themes, so that the brand's front door is fixed.

**Controls**

32. As an operator, I want every text field, select and textarea to share one look (pill shape, the same edge, focus and disabled state), so that forms look like one system.
33. As an operator, I want a field's label, hint and error laid out the same way on every screen, so that I know where to look.
34. As an operator, I want icon-only buttons to share one size, hover and focus treatment and always carry an accessible name, so that toolbars behave alike.
35. As an operator, I want chips, toggles and tabs to share one look for "on" and "off", so that a filter's state is never ambiguous.
36. As an operator, I want the outlined toolbar buttons that today copy the secondary button (the `border-border/60` pills) to become the real outlined Button, so that toolbars stop drifting.
37. As an operator, I want the shared Button to take the pill shape at its current height, so that every action button matches the design.
38. As an operator, I want text-style buttons that navigate to look like underlined links, so that the link rule is consistent.
39. As an operator, I want disabled-with-a-reason commands to stay focusable and keep stating their reason, so that the restyle doesn't hide why I can't act.

**Rollout**

40. As an operator, I want the new colours to arrive everywhere at once, so that I don't meet two palettes on two screens.
41. As an operator, I want field shapes to change one area at a time after that, so that each change is small and tested.
42. As a support lead, I want no theme toggle, so that screenshots in support tickets always show one look.

**Sweep and maintenance**

43. As a developer, I want the next theme change to be the token table plus a handful of shared controls, so that this sweep is never repeated.
44. As a developer, I want a lint ratchet that stops a swept area from regaining hand-styled fields or buttons, so that the sprawl doesn't grow back.
45. As a developer, I want the drives to check colours by role token instead of a pinned hex, so that a palette change doesn't break every drive.
46. As a reviewer, I want each slice to prove itself with light, dark and RTL screenshots of its area's heaviest screen, so that I can judge the look without running it.
47. As a developer, I want prototype folders left alone, so that throwaway code doesn't cost sweep time.
48. As a developer, I want the printed facsimiles to keep their forms' own ink, so that paper reproductions stay faithful.
49. As a developer, I want empty, loading and error states to keep their current patterns and just take the tokens, so that no new design is invented mid-sweep.
50. As the owner, I want the sweep to run unattended after the first hand-driven slices prove the pattern, so that it lands quickly.

## Implementation Decisions

### Scope rule (584, owner)

- **Only the visual language carries over:** colour, shape, the logo and type style. Sizes, flows,
  steps, arrangement and copy semantics don't.
- **Working screens keep today's compact sizes:** 12px grid text, 26px rows, 28px grid header, h-7
  (28px) controls, 44px top bar, 56/240px rail, today's page-title sizes.
- **The design's scale (15px copy, 44px fields) and its frosted glass stay on the login.** The
  login's short-window scroll fix (776px minimum height in a 744px window) is carried here as a
  build fix.

### Token table: light (585, owner)

The token table in the global stylesheet stays the only place a colour is written. Token **names**
don't change, so no call site changes for colour. Light values, measured on the prototype branch
(gate 184/184):

| Role | Light |
|---|---|
| background / foreground (card-foreground, accent-foreground) | `#f4f4f4` / `#1f1f1f` |
| card / card-2 / muted | `#ffffff` / `#f7f7f7` / `#efefef` |
| muted-foreground / ink-3 | `#4c4c4c` / `#747983` |
| accent | `#e9e9e9` |
| border / border-strong / divider | `#e2e2e2` / `#bcbcbc` / `#ededed` |
| input (field edge) | `#8f8f8f` |
| primary, ring, cursor | `#172031` |
| primary-050 / -border / -800 | `#e8ebf0` / `#c3cad6` / `#182f4a` |
| secondary / secondary-press | `#4c4c4c` / `#3d3d3d` |
| rail / rail-foreground / rail-accent / rail-muted | `#172031` / `#d1d2d6` / `#26324a` / `#8d96a8` |
| rail-active, gold / gold-foreground | `#fec33b` / `#172031` |
| grid-head / grid-head-foreground | `#f4f4f4` / `#4c4c4c` |

- **Neutrals are hueless in light.** Palette B's navy-tinted light greys retire.
- **There is one gold, `#FEC33B`**, replacing `#FDC801` in every role. The al-dawaa logo file
  keeps its own artwork colour.
- **Links are underlined.** Because `--primary` is nearly the body ink, any text that navigates
  carries an underline. This goes in the shared link styling, not per screen.
- **Status and command families are unchanged** in both themes: success, attention, danger, post,
  prescription, `fam-*`.
- **The login's fixed `--login-*` block stays separate** and has no dark twin. Its values already
  equal the navy above.
- **The token-table header comment is rewritten:** "palette B, navy-led" becomes the DMSCO theme,
  and it cites 585/586.

### Token table: dark (586, owner)

R1–R4 (spec 082) still stand. **Light is hueless and dark is navy-tinted, on purpose**, with one
temperature per theme. The header comment must say so, so nobody "fixes" one theme to match the
other. Dark values, measured on the prototype branch (gate 184/184):

| Role | Dark |
|---|---|
| background / foreground | `#0a111d` / `#e6ebf2` |
| card / card-2 / muted | `#111a28` / `#162131` / `#1b2536` |
| muted-foreground / ink-3 | `#a3afc0` / `#788599` |
| accent | `#222e41` |
| border / border-strong / divider | `#212c3d` / `#2e3b4f` / `#1a2433` |
| input | `#5a6780` |
| primary (R2: navy H 262.6 lifted to L .76, C .06) | `#9db2d8` |
| primary-050 / -border / -800 (R4) | `#232e42` / `#3e4d69` / `#c3d2ec` |
| primary-foreground, secondary-foreground, destructive-foreground | `#0a111d` |
| secondary / secondary-press | `#8794a8` / `#98a4b6` |
| ring, cursor | `#fec33b` |
| rail-foreground | `#c7d2e3` |
| grid-head / grid-head-foreground | `#162131` / `#a3afc0` |

- Dark stays screen-only (F19). Paper resolves the light table.

### Shell (587, owner)

- **The mark.**
  - A new shared brand-lockup piece replaces the al-dawaa `BrandMark` in the rail head and the
    phone drawer.
  - Expanded, it shows the white DMSCO lockup, then a hairline divider, then the "BackOffice"
    wordmark (`common:brandName`). Collapsed, it shows the dotted-D symbol, cropped from the same
    artwork (viewBox `155 0 107 140` of the 262×140 lockup).
  - The lockup is the white twin composed from the Figma frame's own vectors, filed in
    `assets/581-figma-frames/assets/`. It moves into the app's assets, and the palette gate
    excludes it as it excludes the login's lockup.
  - The accessible name comes from a translation key, not a literal. The rail head link can grow
    taller than 36px to fit the lockup.
  - `BrandMark` stays in the shared UI layer only while something still uses it. Where it survives
    outside the shell (favicon, print headers) is a build-time check, and nothing in the shell
    uses it.
- **The rail ground** is a radial deep navy (`#111A1E` → `#172031`) on the rail, its flyout, the
  overlaid tree and the phone drawer. The two stops are tokens. The rail popover recipe in the
  overlay module picks them up, so every rail-born panel follows.
- **The active item** is a filled `#182F4A` pill with a gold icon and a faint white inset
  hairline. It replaces the 3px gold `::before` bar in the expanded tree, the collapsed icons, the
  flyout and the drawer. `aria-current` logic is unchanged.
  - The pill colour and the hairline are tokens. If the hairline can't meet the gate's non-text
    3:1 against the rail, it is dropped and the pill ground is lifted instead.
- **Rows:** every rail row and icon ground is a full pill. Hover keeps `--rail-accent` with white
  ink.
- **The top bar** stays 44px on `--card`. The palette field and the store chip become full pills,
  and the field's ground is `--card`.
- **Unchanged:** the crumb, the command palette and the rail modes (pinned, overlay, drawer).

### Shape (584, 585, 588)

- `--radius` becomes `1rem`. At h-7, controls are full pills, as on the approved compact prototype.
- Cards and panels take `rounded-lg` from the same variable.
- The grid wrapper stays 8px, set in its own theme parameters.
- Dialogs keep the overlay recipe's radius.

### Shared controls (588, owner: mixed)

**New shared controls** in the shared UI layer, each styled once from tokens:

- **`Input`** covers text, number, date and search. Search carries its own leading icon.
- **`Select`** wraps the native select. Native `<option>` stays, because it is a string-only sink
  under the bidi rule.
- **`Textarea`**.
- **`Field`** pairs a label with the control (`htmlFor` / `id`), takes an optional hint, and
  shows an error linked through `aria-describedby`.
- **`IconButton`** requires an accessible name and keeps the Button's disabled-with-a-reason
  behaviour (`aria-disabled` stays focusable).
- **`Chip`** is a toggle with `aria-pressed`, and has a tab variant (`role="tab"`) for the tab
  bars the inventory counted as chips.

**The existing `Button`:**

- **Shape:** its base takes the pill shape at its current height.
- **Variants:** its nine variants stay. The 41 outlined look-alikes move onto `outlined` or
  `secondary`, and the 88 buttons that already carry a variant's colours move onto the component.
- **Link variant:** a `link` look (underlined, primary ink) is added, or the existing `text`
  variant is restyled, for text-style buttons that navigate.

**The local field constants** (the `INPUT` copies in 20 features, core's `RULE_INPUT`) are replaced
by the shared controls. These are the cheapest 302 fields, one line each.

**Restyled in place, not extracted:**

- the 42 one-offs;
- the 31 row and tile pickers;
- the 25 grid-cell actions;
- the 56 text-style buttons that don't navigate;
- the 5 menu items, which already sit on the overlay recipe.

Each is rewritten to tokens and the new radius in its own screen.

**Checkboxes and radios (59)** keep native controls with `accent-color: var(--primary)`. They are
not wrapped in a primitive.

**Prototype folders** (`__prototype__`, 78 controls) are not swept.

### Grid (584, 585)

- **Sizes are unchanged.**
- **Colours** come from the roles above through the existing grid theme: accent, header ground,
  cursor and selection tint.
- The grid-base gate is unchanged.

### Typeface (589, owner)

- **IBM Plex** (Sans, Mono, Sans Arabic) stays everywhere, including the login. ADR 0003 stands
  and there is no new ADR.
- **Chalet Book isn't bought:** no Arabic, unproven at 12px, and internal-host licence scope
  unconfirmed (582).

### Rollout and slicing (588, owner: colours first, shapes follow)

- **Slice 0 (one release, built by hand):**
  - the light and dark token tables;
  - the rail gradient and active-pill tokens;
  - the shell and the lockup;
  - `--radius`;
  - the Button pill and link look;
  - the six new shared controls;
  - the link underline;
  - the drives' colour-assertion change;
  - the lint ratchet;
  - the theme drive.

  After slice 0 the whole app is DMSCO in colour.
- **Area slices, heaviest first:** one ticket per area, swept in this order: campaigns, collection,
  call center, admin, OMS, loyalty, nphies, reports, then the remaining areas. Inside an area, the
  heaviest screen goes first (from 583: campaigns workspace 92 controls, collection inquiry 74,
  call-center console 70, admin sync console 48). The first area slice is built by hand. Once its
  pattern holds, the rest run as an `/afk-loop` batch.
- **No dual-theme toggle.** One token table carries one palette.

### What stays fixed

- Every rule in the repo's rules folder: tokens only in the global stylesheet, logical Tailwind,
  bidi isolation, zero-literal i18n, the API envelope.
- The four lint gates keep running.
- The printed facsimiles keep their forms' own ink. Only the chrome around them follows the theme.

## Testing Decisions

A good test here checks what an operator sees and can do: which token a control resolves to, whether
it is reachable, named and focusable, and whether the row count holds. It never checks which class
string produced that. The three seams below were agreed with the owner, and no other seam is added.

1. **The contrast gate** (the existing token-contrast lint gate).
   - **Role:** it owns every colour value. Slice 0 updates its light and dark expectations to the
     tables above, including the one-gold change and the dark navy primary.
   - **New pairs:** both rail gradient stops against `--rail-foreground`, `--rail-muted` and
     `--rail-active`; the active pill ground against white ink and against the gold icon; the
     pill's hairline against the rail (3:1 non-text, or the hairline is dropped); and the dark
     `--primary` against `--card` and `--background`.
   - **Negative assertions kept:** gold below 3:1 on a light card, and dark fill ink not white.
   - **Prior art:** the gate's current pair list and its `darkOnly` block.
2. **One theme drive** (a new Playwright drive, run against stubs like the other drives, with a
   live staging pass optional).
   - **What it walks:** the shell and, per area, the area's heaviest screen. It runs in light, dark
     and RTL, with the rail expanded and collapsed, plus the phone drawer.
   - **What it asserts:**
     - controls resolve to their role tokens, read through computed style rather than a pinned
       hex;
     - the rail head carries the DMSCO lockup, or the symbol when collapsed;
     - exactly one rail item is active and it is the filled pill;
     - links have an underline;
     - every icon button has an accessible name;
     - every field's label is linked to it;
     - the Deliveries list shows as many rows at 1568×744 as before the theme (19).
   - **Output:** it saves a light, dark and RTL screenshot per screen for review.
   - **Growth:** each area slice adds its screens to the drive's list. That is the slice's proof.
   - **Prior art:** the existing drives and smoke under the tools folder, and the 584/586
     prototype screenshots for the expected look.
3. **The lint ratchet** (a new lint gate built from 583's inventory script).
   - **What it counts:** hand-styled buttons and fields per feature.
   - **What fails:** a feature already swept may not exceed its allowlist (the documented one-offs
     and pickers), and no feature's count may rise.
   - **Where it runs:** in `npm run lint` beside the other four gates.
   - **TypeScript:** it must not depend on a global TypeScript 5 install. The script's
     compiler-API fallback is replaced by a parser the repo ships, or by the TypeScript 5 API
     pinned as a dev dependency.

**Existing drives (38 match a colour probe today):**

- An assertion that pins a literal hex retires in favour of the contrast gate.
- An assertion that checks a role (danger ink, gold cursor) is rewritten to read the token.
- A sweep slice changes no behaviour, so every other assertion must stay green unchanged.

**Per-slice proof:** `typecheck`, the lint gates (now five), the theme drive's screens for the area,
and the area's existing drives unchanged. React Testing Library is still not installed (spec 083),
so the shared controls are proven through the drive, not unit tests. Any pure helper they grow
(class composition, for instance) gets a vitest test.

## Out of Scope

- **The HR portal's content:** home, e-services, teams, reports, news and profile as features, the
  "Noura" chatbot, and the language pill.
- **The design's scale and the frosted glass** on any working screen.
- **A language switch** in the shell or on the login.
- **The illustrated service icons** (PNG tile sprites). Empty states keep their line icons. A
  home-page illustration would be its own effort.
- **New empty, loading or error state designs.** They keep today's patterns and take the tokens.
  No Figma call is spent on the empty Team Dashboard frame.
- **Chalet Book or any typeface change.**
- **The printed facsimiles' ink.**
- **Prototype folders.**
- **The login page,** except the short-window scroll fix.

## Further Notes

- **Figma budget.** The seat is Starter/View, about 6 MCP calls a month, and about 5 are spent.
  Nothing in this spec needs another call. Asset URLs from 581 expire on 2026-11-02, and everything
  needed is already filed under `assets/581-figma-frames/`.
- **The prototype branch** `prototype/dmsco-density` (worktree `oms-react-proto-dmsco`) is never
  merged. It holds the 584 skins, the 585 light table (`ae9aa8a5`), the 587 shell (`d1c7915e`)
  and the 586 dark candidates (`95400ce1`, then navy night in the table, `a9755710`). It is the
  reference for the look, not code to copy: its CSS writes literals outside the token table.
- **Owner rulings that differed from the recommendation:** dark is navy night, not graphite
  (586). Everything else was taken on recommendation.
- **One build-time check:** confirm nothing outside the shell still needs `BrandMark` (favicon,
  print headers) before deleting it.
