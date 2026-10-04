---
status: done
spec: 380
blocked-by: 406
---

# 407 — The call center console sits inside the rail shell, with the rail collapsed

## What to build

The first S6 slice (spec 380 **C1**; ruled in [363](363-the-rail-shell.md) "Call center" and
[379](379-does-the-call-center-customer-rail-collapse-into-a-caller-header.md) §1).

- **`/callcenter` stops being `chromeless`.** It mounts inside `AppShell` like every screen, with the
  navy rail and the 44px top bar (crumb, palette field, store chip, bell).
- **The rail is collapsed on this route by default**, but it is never forced. The per-user
  expanded/collapsed preference still applies if the agent pins it open.
- **The console fills the content area below the top bar.** Today's full-viewport sizing is reworked
  to the shell's content height, so the receipt and basket still scroll in their own columns. The
  layout stays three columns in this slice (the customer rail · centre · receipt). The rail goes in
  409.
- **The console's palette is already the core one (395)**, so no second Ctrl+K appears.
- **The print routes keep their own chromeless layout.**
- **Caret rules hold:** the `cc-phone` box still takes the caret on open (165/153). The shell's top
  bar must not steal initial focus.

## Spine reach

route (`app/router.tsx`: the console moves under the shell) · component (console height under the
shell) · test

## Proof (→ `tdd` red-green cycles)

- [x] `tools/callcenter-shell-drive.mjs`: light, dark and RTL at 1280 and 1440; the rail, top bar and store chip are present on `/callcenter`; the rail starts collapsed; the caret lands on `cc-phone` on open; the receipt and basket scroll independently with no page scroll; Ctrl+K opens the core palette once · flow (Playwright)
- [x] The existing `tools/callcenter-drive.mjs` still passes · flow (Playwright)

## Boundaries

- **No new endpoint and no new i18n namespace.** The crumb label for the console comes from
  `menu-model`.
- 🚩 **Behaviour change.** The console gains the shell, so **an operator lead from the call center
  team must accept it at S6 sign-off** (R2). Bundle that acceptance with 409's caller bar.

## Done when

`/callcenter` renders inside the rail shell with the rail collapsed, the caret on `cc-phone`, and
the drive green in light, dark and RTL.

## Blocked by

- [406](406-simulations-ctrl-enter-is-a-registered-process-command.md) — S5 closes first (step order
  R1). The real dependencies are 385/386 (the shell) and 395 (the console palette joins core).

## Comments

**Done 2026-10-04 (AFK).** Unattended decisions are in `.afk/HITL-407.md`.

- **Route.** `/callcenter` moved under the shell's `ProtectedLayout` subtree as `callcenter`,
  carrying a new explicit route flag, `handle: { fill: true }`. The flag lives in
  `layout/shell-route.ts`, beside the palette's `PaletteRouteHandle`.
  - On a flagged route, `AppShell` holds itself to the viewport, and its `<main>` drops the
    padding and becomes an `overflow-hidden` flex column. Every other screen is unchanged.
  - The print routes keep `<ProtectedLayout chromeless />` and `PRINT_ROUTE`.
- **The rail is not forced.** No route override: the one per-user preference applies, so the
  rail is collapsed unless the agent pinned it open.
- **Console height.** `ConsoleShell`, `ConsoleStatus` and `ConsoleCard` fill the area with
  `h-full flex-1` instead of `h-screen`. The card centres on auto margins, so a tall card
  scrolls instead of clipping.
  - The console's centre column is a `<div>`, not a second `<main>`.
  - The three columns stay (409 removes the rail). The console's own header row stays too
    (HITL).
- **Proof.**
  - `npm test`: 193 files, 3523 tests. That includes the new `shell-route.test.ts`.
  - `npm run lint`: the four gates are clean. `typecheck` and `build` are clean.
  - `tools/callcenter-shell-drive.mjs`: **123/123**, network stubbed at Playwright. It runs
    light, dark and RTL at 1280×720 and 1440×900, plus a pinned-open pass in LTR and RTL. It
    checks:
    - the rail, the top bar, the store chip and the crumb (Call center / Console);
    - the rail at the inline-start edge, the right under RTL;
    - collapsed at 56px by default, and 240px when the user pinned it;
    - the caret in `cc-phone` on open, and again after the palette's Esc;
    - the console filling below the 44px bar with no page scroll;
    - a long basket that wheel-scrolls in its own column while the receipt and *Place order*
      do not move;
    - one `main` landmark;
    - Ctrl+K opening the core palette once.

    ⚠ The long basket repeats capture 02's lines under fresh ids. The receipt never
    overflows at these sizes, so its own scroller is checked as a bounded `overflow:auto`
    column rather than scrolled.
  - `tools/callcenter-drive.mjs`: **531/531**. Its chromeless-era checks were moved to the
    shell ruling, not deleted:
    - "no nav chrome" became the rail and top bar being present, the console filling below
      the bar, and no page scroll;
    - the leaf checks read a collapsed group's aria-label.

    Before this change the drive was 525/529 against HEAD's chromeless expectations, and one
    of its 4 failures was the collapsed-rail leaf check, stale since 385.
  - `tools/foundation-drive.mjs`: its `/callcenter` chromeless carve-out was removed. The rail
    marker on `/callcenter` passes in all four modes. The whole drive is at its baseline,
    1294/1302, and the 8 failures are the known ones recorded at 393.
  - `tools/command-palette-drive.mjs`: 366/366.
  - Other call center drives:
    - green: `linked-request` 92/92, `fulfilment-176` 108/108, `item-panel`, `next-call`
      10/10, `section-175` 17/17, `store-choice` 11/11;
    - failing exactly as at HEAD (measured): `coupon-159` 99/103, `callcenter-guidance`
      105/107, and `address-editor`, which times out.
- **Outstanding (not AFK):**
  - the call center operator lead's acceptance of the console in the shell, bundled with
    409's caller bar at S6 (R2);
  - the owner's S6 sign-off;
  - a human eye on real Arabic copy;
  - a run against a live SIS.Api.
