---
type: wayfinder-ticket
wayfinder: grilling
map: 358
status: done
blocked-by: —
---

# 361 — How the Ops Console reaches main

## Question

How does the new look ship? Choose one:

- **One switch:** foundation and shell land together.
- **Stepwise on `main`:** tokens first, then the shell, then the screens one at a time.
- **Old and new coexist** behind a flag for a while.

Also decide:

- **Which of the four screens goes first?**
- **What do the screens that are not reworked get:** tokens only, or also new shared page-header,
  toolbar and empty-state pieces?
- **Who signs off a screen** as "done in the new look"?

## Answer

Grilled with the owner, 2026-10-02.

**Stepwise on `main`.** Every step leaves `main` shippable. There is no flag, and there are never
two token sets. The facts behind this: every colour is one `:root`/`.dark` block in
`src/app/global.css`, the grid is one theme file (`src/core/theme/ag-grid-theme.ts`), and the repo
has no feature-flag mechanism. Coexistence would mean keeping two token sets, two grid themes and
two shells, and the contrast lint would have to check both. One switch would mean a long-lived
branch drifting from `main`.

The steps, in order:

1. **Foundation, as one merge:** tokens, IBM Plex, density, the AG Grid look **and the rail shell**
   together. The owner chose not to split tokens from the shell, so the new palette never appears
   in today's topbar `AppShell`. The same step carries the **breakage sweep** (point 5 below). It is
   blocked by [Ops Console colours, density and grid look](362-ops-console-colours-density-and-grid-look.md)
   and [The rail shell](363-the-rail-shell.md).
2. **Keyboard layer:** the command registry in `@/core`, the Ctrl+K palette, global shortcuts, and
   navigation commands for every screen. It is its own step, right after the foundation. The rail
   shows **no Ctrl+K hint** until this step ships. It is blocked by
   [What the Ctrl+K palette holds](364-what-the-command-palette-holds.md) and
   [Keyboard shortcuts that work for everyone](365-keyboard-shortcuts-that-work-for-everyone.md).
3. **The four screens, one at a time:** **Deliveries list → Delivery details → Simulation → Call
   center.**
   - The list goes first because it sets the dense-grid and inspector pattern.
   - Details follows as its partner screen (list → record).
   - Call center goes last: it carries the most muscle-memory risk, it needs its own RTL pass, and
     it needs a mature palette and shortcuts.
   - Each screen adds its own palette commands as it is reworked.

**Screens that are not reworked: they inherit, plus a breakage sweep.**

- They take the foundation and the keyboard layer, and nothing more.
- The sweep, inside the foundation step, fixes **only what the foundation breaks**: clipped heights
  under the new density, contrast failures, and hard-coded sizes that Plex disturbs.
- Shared page-header, toolbar and empty-state pieces move up into `@/core` **only when the four
  screens need them**. Today `@/core/ui` has none of them: there are about 8 hand-rolled
  `*Toolbar.tsx` files, and one `EmptyState` lives in `collection/inquiry/GridStates.tsx`.
- Adopting those pieces on the other screens is a later effort and is **out of scope** here.

**Sign-off:**

- The owner signs off **every step** against the Far prototype, driven live in light, dark and RTL.
- Where a screen changes **behaviour**, an **operator lead from that screen's team also accepts
  it** before it ships. The prototype's notes name two changes so far: Delivery details moves
  Cancel Order and Force Cancel into More, and Call center drops the fixed 260px customer rail.
  Any behaviour change a screen's prototype ticket adds falls under the same rule.

**Effect on the map:**

- The "other screens" fog patch is resolved and removed.
- Adopting shared pieces on the other screens is added to **Out of scope**.
- No new tickets are needed: the existing blocking edges already give this order.
