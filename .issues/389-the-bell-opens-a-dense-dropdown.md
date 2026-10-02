---
status: open
spec: 380
blocked-by: 388
---

# 389 — The bell opens a dense dropdown

Step S1 (Foundation) of [spec 380](380-ops-console-rebuild-spec.md). Spec decision **F17**. The
values are in [377](377-notifications-toasts-and-dialogs-in-the-ops-console.md) §3. The prototype is
branch `prototype/377-overlays` (`?bell=`), with its captures in
[377-shots](assets/377-shots/).

## What to build

The same anchored dropdown as today (`role="dialog"`, outside click or Esc closes it, and opening it
marks nothing read), redrawn at the console's density on 388's card recipe:

- **Size:** 360px wide, max 440px tall.
- **Header (36px):** "Notifications", an **"N new"** count chip (`primary-050` / `primary-800`), and
  Mark all as read as a 24px text control.
- **Rows:**
  - 8px × 12px padding, `--divider` rules, `--card-2` hover;
  - the title at 12.5px (600 when unread; 500 and `muted-foreground` when read);
  - the relative time at 11px in `--ink-3` at the inline end;
  - the body at 12px in `muted-foreground`, **clamped to two lines**.
- **The type tag goes on its own line** under the body: squared (4px), 10px uppercase. **BROADCAST
  takes the primary tier, not amber.** JOB stays `--muted`.
- **Unread** is a 6px `--primary` dot, not the cursor bar.
- **The bell's badge** is **gold with navy ink in both modes**, with a `--card` ring against the top
  bar.
- **i18n:** the "N new" chip is a plural key in the notifications namespace (or `common`), with the
  count isolated by kind.

## Spine reach

`layout/notifications` (panel, bell) · locale · drive.

## Proof (→ `tdd` red-green cycles)

- [ ] `new count chip counts unread items only` (if not already pinned by an existing helper test) —
  pure · vitest
- [ ] `tools/foundation-drive.mjs` (extend), in light, dark and RTL, with stubbed notifications:
  - the panel is 360px with two-line clamped bodies;
  - a BROADCAST tag computes the primary tier;
  - the badge computes gold with navy ink;
  - opening the panel marks nothing read.

  · flow (Playwright)

## Boundaries

- One plural key. No endpoint changes; the panel reads today's notification store.

## Done when

The bell panel matches 377 §3 in the drive in both modes and both directions.

## Blocked by

[388](388-overlays-share-one-recipe-and-toasts-sit-bottom-end.md)
