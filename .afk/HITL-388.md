# HITL-388 — unattended decisions, ticket 388 (overlays share one recipe; toasts sit bottom-end)

## Q: Where does "the one recipe" live?
**Decision taken:** In `@/core/ui/overlay.ts`, as composable class strings: `POPOVER` (8px card), `DIALOG` (10px card over `backdrop:bg-backdrop`), `SHEET` (square side sheet), `DIALOG_TITLE` (13px semibold), `SCRIM`, `OVERLAY_SHADOW`, and the rail-origin set `RAIL_POPOVER`, `RAIL_EDGE` and `RAIL_MENU_ITEM`. The toast half lives in `global.css` on sonner's elements, as the ticket requires.
**Why:** Each overlay keeps its own placement and behaviour, and only the surface is shared. The repo already composes class constants (`MARKER`, `GROUP_LABEL`), and features may import from core.
**Revisit if:** the owner prefers Tailwind `@utility` classes in `global.css`. The change would be mechanical.

## Q: How is `--shadow-pop` consumed, given the contrast gate wants a `--color-*` bridge for every root token?
**Decision taken:** It is consumed as `shadow-(--shadow-pop)`, with no bridge. `--shadow-pop` joins `--radius` in `check-contrast.mjs`'s explicit `NOT_A_COLOUR` set, with a comment.
**Why:** It is a box-shadow, not a colour. A `@theme` entry named `--shadow-pop` would collide with the token itself.
**Revisit if:** a later gate change wants non-colour tokens listed elsewhere.

## Q: The rail panels' white 12% edge, when the palette gate forbids `border-white/*`
**Decision taken:** It is `border-rail-accent-foreground/12`, because `--rail-accent-foreground` is #ffffff in both themes (385). The rail panels also cast `--shadow-pop`, so there is one shadow token everywhere.
**Why:** The ticket allows "no new tokens beyond the two". The literal is refused by the gate, and this composes exactly `rgb(255 255 255 / .12)`.
**Revisit if:** `--rail-accent-foreground` ever stops being white. In that case the edge needs its own token.

## Q: How does server text in a toast get `dir="auto"` when sonner owns the elements?
**Decision taken:** `unicode-bidi: plaintext` on every toast's `[data-title]` and `[data-description]` in `global.css`, which gives each line `dir="auto"`. It reaches the direct `toast.*` call sites too, not just `notify`. The confirm dialog's message is a `<bdi>` (dir auto). `.claude/rules/bidi.md` now says this sets a line's direction but does not isolate an interpolated value, so `fsi()` still applies there. The drive proves the full stop stays at the end under RTL, with a control that must see it flip.
**Why:** Sonner takes no attributes on its title or description. Wrapping strings at ~100 call sites contradicts "styling lives in the global stylesheet, not at call sites".
**Revisit if:** a real Arabic title led by an un-isolated Latin value reads scrambled. The fix there is `fsi()` at that call site, per the rule.

## Q: Sonner's `--success-border` has the same name as 082's token
**Decision taken:** Inside the toaster, `--success-border: inherit`, which takes the page's token. The other three tiers map by name.
**Why:** `var(--success-border)` there would reference itself, and the edge fell back to the ink colour. The drive caught it.
**Revisit if:** sonner renames its variables.

## Q: Sonner's 356px width is an inline style
**Decision taken:** `--width: 340px !important` on the toaster, with a comment.
**Why:** Only `!important` outranks an inline custom property from a stylesheet. Passing `style` on the Toaster would put styling at the host, not beside the tokens.
**Revisit if:** sonner exposes a width prop.

## Q: What gets the recipe beyond the ticket's named list?
**Decision taken:**
- The document page's command-reason tooltip and StatusRail's "All statuses" popover sections take `POPOVER`.
- `SlipDrawer` takes `SHEET`.
- The nphies attachment lightbox moves from `bg-foreground/70` to `--backdrop`, with the 10px dialog recipe.
- The phone drawer gained the rail's white 12% `border-e`.
- Toast extras taken from the 377 prototype: 10×12 padding with an 8px gap, a close button that wears its toast's tier (sonner's greys never show), and the shared `--ring` focus ring on toast buttons.

**Why:** "Everything else → the card recipe", and "used by any hand-drawn scrim".
**Revisit if:** the owner wants the lightbox darker. At 0.32 it dims much less than before.

## Q: Should the outside-click/Esc dismiss logic (rail flyout, overlay, drawer, user menu, chip, bell) be folded into one hook?
**Decision taken:** No. 386 and 387 left that note, but 388's ticket describes the LOOK, not behaviour, and the runner says later slices extend tonight's shells rather than restructure them.
**Why:** It is a behaviour refactor that no ticket asks for, across six drive-proven components.
**Revisit if:** a keyboard-step ticket (392/393) needs one dismiss layer anyway.

## Q: Card-recipe menu items (28px, 12.5px, 6px)
**Decision taken:** The geometry is a constant inside `overlay.ts`, used by the rail's user menu today. No off-rail menu exists yet: the saved-view menus are 400's, which moves ViewManager onto `Modal`. ViewManager's hand-drawn dialog only takes the recipe and the scrim here.
**Why:** 400 owns the saved-view menus. Building them here would be scope creep.
**Revisit if:** 389 or 400 needs the geometry. They can export it then.

## Comments
- "Maximum update depth exceeded": not seen. Every overlays mode asserts no page errors.
- Under RTL, Deliveries' in-page search error banner (`ErrorBanner`) shows the server message with its stop flipped (`.Cannot move…`). It is not a toast or a confirm, so it is left for the 390/391 sweep.
- `nphies-authorizations-drive` (119/121) and `ua-users-scale-drive` (83/85) fail on a nav leaf (the rail has been collapsed by default since 385) and on card/act label copy. Neither touches anything this slice changed.
