---
status: open
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

- [ ] `toaster position maps bottom-end by direction` — pure · vitest
- [ ] `tools/foundation-drive.mjs` (extend), in light, dark and RTL:
  - a success, a warning and an error toast compute 082's `-050` ground and `-800` ink and Plex;
  - they land at the inline-end bottom corner, clear of the store chip, the bell and the open bell
    panel;
  - a `Modal` computes `--border-strong`, the 10px radius and the `--backdrop` scrim;
  - the user menu is navy with a gold focus ring.

  · flow (Playwright)
- [ ] `npm run lint` stays green: neither new token is a text pair · lint gate

## Boundaries

- No new i18n keys.
- The bell panel's layout is 389. The dialog-failure rule is 390.

## Done when

Every overlay follows the origin rule, toasts render in 082's tiers at bottom-end in both directions,
and the drive passes.

## Blocked by

[386](386-the-top-bar-carries-crumb-store-chip-and-bell.md)
