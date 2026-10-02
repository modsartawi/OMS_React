---
status: done
spec: 380
blocked-by: 386
---

# 388 — Overlays share one recipe, and toasts sit bottom-end in 082's colours

Step S1 (Foundation) of [spec 380](380-ops-console-rebuild-spec.md). Spec decisions **F15, F16**,
plus the toast half of **F26**. The values are in
[377](377-notifications-toasts-and-dialogs-in-the-ops-console.md) §1 and §2. The prototype is branch
`prototype/377-overlays` (worktree removed; recreate with `git worktree add`, run
`npx vite --port 5277`, open `/oms/deliveries?stub=1&palette=navy&shell=D&cmd=1`, and use the dev
bar's `?fam=&toast=&pos=` axes).

## What to build

- **Overlays by origin (F15).**
  - **From the rail → navy.** The group flyout and the rail-foot user menu use the `--rail` ground,
    `--rail-foreground` ink, `--rail-muted` secondary text, `--rail-accent` hover with white ink,
    dividers and edge `rgb(255 255 255 / .12)`, and a **gold focus ring**.
  - **Everything else → the card recipe.** This covers the store chip's popover, the bell panel, the
    column chooser, the saved-view menus, every `Modal` and future palette surfaces:
    - `--card` ground, **`--border-strong`** edge, `--foreground` ink;
    - 8px popovers and menus, 10px dialogs;
    - **one shadow token, `--shadow-pop`**, and **one scrim token, `--backdrop`**, used by
      `::backdrop` and by any hand-drawn scrim (values in 377 §1);
    - menu items 28px at 12.5px with a 6px radius, and the dialog title 13px semibold.

    It replaces today's mix of `shadow-md`/`-lg`/`-2xl`, `rounded-md`/`-lg` and the
    `bg-black/50`/`bg-black/30` scrims.
- **Toasts (F16).**
  - Keep sonner's `richColors`, but **point sonner's variables at 082's tiers**: success, warning
    (`attention`) and error (`danger`) use their `-050` ground, `-border` edge and `-800` ink, and
    **info uses the primary tiers**. Neutral toasts use the card recipe.
  - Plex, `--radius`, `--shadow-pop`, 340px wide, a 12.5px/600 title and a 12px description.
  - Action buttons use `--primary`, cancel uses `--muted`, both as 6px controls.
  - The styling lives in the global stylesheet on `[data-sonner-toaster]`, not at call sites. No new
    tokens beyond the two above.
- **Position:** **bottom-end, offset 16px, mapped by direction.** The Toaster takes `bottom-left`
  under RTL and `bottom-right` otherwise, re-read when the direction changes. This replaces today's
  physical `top-right`, which sits on the top bar's chip and bell.
- **Server text in toasts and confirms** renders with `dir="auto"`, or through 384's FSI helper for
  string-only sinks, so an English message's punctuation doesn't flip under RTL.

## Spine reach

Global tokens and stylesheet · `core/ui/Modal` and existing popovers · `layout/` (rail-origin menus,
Toaster host) · drive.

## Proof (→ `tdd` red-green cycles)

- [x] `toaster position maps bottom-end by direction` — pure · vitest
- [x] `tools/foundation-drive.mjs` (extend), in light, dark and RTL:
  - a success, a warning and an error toast compute 082's `-050` ground and `-800` ink and Plex;
  - they land at the inline-end bottom corner, clear of the store chip, the bell and the open bell
    panel;
  - a `Modal` computes `--border-strong`, the 10px radius and the `--backdrop` scrim;
  - the user menu is navy with a gold focus ring.

  · flow (Playwright)
- [x] `npm run lint` stays green: neither new token is a text pair · lint gate

## Boundaries

- No new i18n keys.
- The bell panel's layout is 389. The dialog-failure rule is 390.

## Done when

Every overlay follows the origin rule, toasts render in 082's tiers at bottom-end in both directions,
and the drive passes.

## Blocked by

[386](386-the-top-bar-carries-crumb-store-chip-and-bell.md)

## Comments

**Done 2026-10-02 (AFK).** Unattended decisions are in `.afk/HITL-388.md`.

**What was built:**
- **The recipe:** `@/core/ui/overlay.ts` holds class strings, so each overlay keeps its own placement and behaviour.
  - Card: `POPOVER` (8px), `DIALOG` (10px, `backdrop:bg-backdrop`), `SHEET`, `DIALOG_TITLE` (13px semibold) and `SCRIM`.
  - Rail-origin: `RAIL_POPOVER` (navy, white 12% edge via `--rail-accent-foreground/12`, gold `--ring`), `RAIL_EDGE` and `RAIL_MENU_ITEM` (28px / 12.5px / 6px).
  - Shared: `OVERLAY_SHADOW` (`shadow-(--shadow-pop)`).
- **Token:** `--shadow-pop` (377 §1 light and dark values) sits beside 387's `--backdrop`. It is declared non-colour in `check-contrast.mjs`, so the gate stays at 148 pairs.
- **Where the recipe went:**
  - Card: `Modal`, the store chip's panel, the bell panel's surface (389 owns its layout), the column chooser, ViewManager's hand-drawn Save-view dialog and scrim (400 moves it onto `Modal`), the command-reason tooltip, StatusRail's popover sections, `SlipDrawer` (sheet) and the nphies lightbox (scrim).
  - Rail-origin: the flyout, the overlaid tree, the phone drawer and the user menu.
  - Every `bg-black/50` scrim is gone, and so are its four palette-gate allowances.
- **Toasts:** `layout/ToasterHost.tsx` replaces `main.tsx`'s Toaster. It uses `richColors` and `offset={16}`, and takes `position` from the pure `toasterPositionFor(dir)` in `@/core/theme/direction`. `dir` is re-read from `<html dir>` through a MutationObserver.
- **Toast look:** `global.css` on `[data-sonner-toaster]`:
  - success, warning and error map to `-050` / `-border` / `-800`; info maps to the primary tiers; a neutral toast is card / `--border-strong` / `--foreground` with a `--muted-foreground` description;
  - Plex, `--radius`, `--shadow-pop`, 340px, a 12.5px/600 title over a 12px description;
  - the action is `--primary` and the cancel `--muted`, both 6px.
- **Server text:**
  - Toast titles and descriptions take `unicode-bidi: plaintext`, which gives each line `dir="auto"`.
  - The confirm message is a `<bdi>`.
  - `.claude/rules/bidi.md` notes that `fsi()` still isolates interpolated values.

**Proof:**
- **vitest** `src/core/theme/direction.test.ts` › `toaster position maps bottom-end by direction`. It was red first (no export), then green. Full suite: 171 files, 3164 tests.
- **`tools/foundation-drive.mjs`, new `overlays` part** (`DRIVE_ONLY=overlays`): **118/118** across light/dark × LTR/RTL. The whole drive is **654/654**.
  - Each toast is raised by the Deliveries list's own code path: a failed lookup (warning), a refused search carrying an English server message (error), Save view (success) and Delete (info).
  - Each computes its tier's `-050` / `-border` / `-800`, renders in IBM Plex Sans (CDP), and is 340px, 8px, `--shadow-pop`, 12.5px/600 over 12px.
  - Toasts land at the bottom inline-end corner, 16px in (bottom-left under RTL), clear of the store chip, the bell and the open bell panel.
  - The server message keeps its full stop at its end under RTL, and a control without the per-line direction sees it flip.
  - Flipping `<html dir>` live moves the corner, and flipping it back restores it.
  - The bell panel, the store panel and the column chooser are the 8px card. The Save-view dialog is 10px over `--backdrop`. A `Modal` (Change store) computes `--card`, `--border-strong`, 10px, `--shadow-pop` and a `::backdrop` of `--backdrop`, with a 13px/600 title.
  - The user menu is navy with the white 12% edge, and its keyboard-focused item shows the GOLD ring. The flyout is navy with a white 12% inline-end edge.
  - A broadcast arriving on the bell's poll is a neutral card toast, with View as a 6px `--primary` control and Dismiss as a 6px `--muted` one.
  - No page errors.
- **`npm run lint`:** all four gates green (730 files; 22 grid mounts; 148 contrast pairs; 735 files, 1 exclusion, down from 5). `npm run typecheck` is clean and `npm run build` is green.
- **Regression drives:** `return-dialog` 105/105, `slip-drawer` 63/63, `settlement-change` 337/337, `document-rail` 25/25.
  - `nphies-authorizations` is 119/121 and `ua-users-scale` 83/85. Their failures are a nav leaf (collapsed rail, 385) and label copy, and touch nothing this slice changed.

**Reviews:**
- `/code-review` found no correctness bugs.
- `/standards-review` found no hard violation. Applied:
  - `<bdi>` for the confirm message;
  - one `documentDirection()` shared by boot and the host;
  - the `SHEET` recipe for SlipDrawer;
  - `RAIL_DIVIDER` renamed `RAIL_EDGE`;
  - `MENU_ITEM` made internal;
  - the tooltip listed in the recipe's doc;
  - StatusRail's sections on the card edge;
  - the bidi rule note;
  - drive coverage for the neutral toast, its buttons and the live `dir` re-read.

  Left on purpose, with reasons in the HITL file: the toast close-button, padding and focus extras (from the 377 prototype), the lighter lightbox scrim, and not folding the six dismiss effects into one hook.

**Outstanding (owner):**
- The S1 live sign-off is at 391.
- The Arabic-rendering eye check needs a human.
- Deliveries' in-page `ErrorBanner` still flips an English server message's full stop under RTL. It is not a toast or a confirm, and is noted for the 390/391 sweep.
