---
status: done
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

- [x] `new count chip counts unread items only` (if not already pinned by an existing helper test) —
  pure · vitest
- [x] `tools/foundation-drive.mjs` (extend), in light, dark and RTL, with stubbed notifications:
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

## Comments

**Done 2026-10-02.**

**What was built:**
- `NotificationPanel` is redrawn on the `POPOVER` card recipe:
  - 360px wide, max 440px tall, with a 36px header: the title, the "N new" chip (`primary-050` / `primary-800`) and a 24px Mark all as read;
  - rows 8×12 on `--divider` rules with a `--card-2` hover, and 12.5px titles (600 unread; 500 and `muted-foreground` read). Titles wrap rather than truncate (story 30);
  - an 11px `--ink-3` time at the inline end, a 12px body clamped to two lines, and the type tag on its own line: 4px, 10px uppercase, BROADCAST in the primary tier, JOB `--muted`;
  - a 6px `--primary` unread dot, held on the title's first line.
- The badge is `bg-gold text-gold-foreground ring-card` in both themes.
- Isolates, per `.claude/rules/bidi.md`:
  - the title and body are `<bdi>`;
  - the chip's, the time's and the badge's counts are `Ltr`, through `<Trans>` slots;
  - the plural key is `notifications:panel.newCount_one/_other`, and the `relative.*` templates gained the `<n>` slot.
- New pure `unreadItems` in `layout/notifications/helpers.ts`: the chip, the badge (`unreadCount`) and Mark all as read share one rule.
- No endpoint or store change.

**Proof:**
- `helpers.test.ts`: 6 vitest cases.
- `DRIVE_ONLY=bell` passes 106/106 in light/dark × LTR/RTL, with stubbed notifications. It covers:
  - the panel width, the clamp, the BROADCAST tier, the badge's gold and navy, and that opening calls no Read;
  - Esc and outside click, a row click, and Mark all as read;
  - a wrapped title's dot;
  - the body's stop under RTL, with a control.
- The whole foundation drive passed 752/752 before the review fixes; afterwards the overlays part passed 118/118.
- typecheck, `npm test` (3170 tests), lint (148 pairs) and build are green.

**Reviews:**
- `/code-review` found nothing.
- `/standards-review` found no hard violation introduced by this slice. Applied:
  - the relative time's count is isolated through a `<Trans>` slot, and `tabular-nums` is restored;
  - the unread dot is anchored to the first title line when a title wraps.

  Left on purpose: the drive's per-part `box`/`resolve` helpers, and under RTL the clamp's ellipsis on an English body sitting at the line's start (as the prototype draws it). Decisions are in `.afk/HITL-389.md`.

**Outstanding (owner):**
- The S1 live sign-off is at 391.
- The Arabic-rendering eye check needs a human.
