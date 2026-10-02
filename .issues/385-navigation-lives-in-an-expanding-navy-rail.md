---
status: open
spec: 380
blocked-by: 381
---

# 385 — Navigation lives in an expanding navy rail, collapsed by default

Step S1 (Foundation) of [spec 380](380-ops-console-rebuild-spec.md). Spec decisions **F5** (the
rename), **F10**, **F14** and **F20**. The owner's pick, shell **D**, is
[363](363-the-rail-shell.md) §"The frame". The prototype is commit `acd5564`, reachable through
branch `prototype/377-overlays` or `prototype/378-rtl`
(`/oms/deliveries?stub=1&palette=navy&shell=D&rtl=1`).

## What to build

Today's top-bar menu is replaced by a navy rail on the inline-start side of every non-chromeless
screen.

- **Collapsed (default, 56px):**
  - one icon per **visible group**, from `useVisibleMenu(MENU)`, so gating is unchanged and a group
    whose leaves all hide disappears;
  - the tooltip is the group label;
  - the brand mark at the top links `/`.
- **The flyout.** Clicking a group opens a 240px navy flyout continuing the rail:
  - `role="dialog"`, labelled by the group;
  - focus moves to its first link;
  - hovering another group while one is open switches to it;
  - Esc, an outside click or navigation closes it;
  - the Settlement sub-group draws as a header link plus indented leaves, always open.
- **Expanded (240px):** today's accordion tree on navy. Group headers are in the rail-muted ink,
  uppercase, and white when they hold the active screen.
- **Remembered.** The expand/collapse toggle at the rail foot is a **per-user preference**. Keep it
  in a small zustand store beside the theme preference, persisted to `localStorage` and parsed
  defensively. It is never forced open on any route.
- **The active marker:** a 3px gold `::before` on the rail's **inline-start edge**
  (`inset-inline-start`, never an inset shadow). The active row also takes the rail-accent ground
  with white ink.
- **Token rename (F5).** `--sidebar*` → **`--rail*`** (`--rail`, `--rail-foreground`,
  `--rail-accent`, `--rail-active` = gold, `--rail-muted`). The contrast-gate pairs move with the
  names. Today's consumers:
  - `AppShell` and `HomePage`;
  - `IdentityBand`, still using it until 402 redraws Details;
  - **`text-sidebar-active` used as link ink** in `LoginPage` and `ua-admin/cards.ts`, which moves to
    `text-primary` **before** the token turns gold (1.56:1 on white);
  - `callcenter/console/CustomerRail`, which takes `bg-card-2`.

  Leave the `__prototype__` folders alone or update them mechanically.
- **Print (F20, [375](375-printed-output-under-the-ops-console-tokens.md) R3):** the rail `<aside>`
  takes `print:hidden`.
- **The call center stays chromeless** in this step (F14). It joins the shell in 407. Print routes
  keep their own chromeless layout.
- **i18n:** `common:topbar.*` (or a `common:rail.*` sub-tree) gets keys for "Collapse menu", "Expand
  menu" and the flyout's close label. No literals.
- **Logical utilities only.** Chevrons that point forward take `rtl:-scale-x-100`.

The top bar's content (crumb, store chip, bell) and the user menu are **386**. This ticket keeps
today's top-bar items reachable so nothing is lost between the two.

## Spine reach

`layout/` shell (rail component, flyout, expand store) · global tokens (rename) · the consumers
above · `common` locale · lint gate (renamed pairs) · drive.

## Proof (→ `tdd` red-green cycles)

- [ ] `rail expand preference reads collapsed when missing or malformed` — pure · vitest
- [ ] `npm run lint`: `check-contrast` carries `--rail-muted` on `--rail` and `--gold` on `--rail`,
  and no longer checks `--foreground` on the rail · lint gate
- [ ] `tools/foundation-drive.mjs` (extend), in light, dark and RTL:
  - the collapsed rail shows only the granted groups;
  - clicking a group opens its flyout with focus on the first link;
  - hover switches the group, and Esc closes the flyout and returns focus;
  - the expand toggle persists across a reload;
  - the gold marker sits flush on the inline-start edge in both directions;
  - Ctrl+P emulation hides the rail.

  · flow (Playwright)

## Boundaries

- New `common` keys only. No endpoints.
- No narrow-width behaviour; that is 387.
- No overlay restyle; that is 388.

## Done when

Every shell screen navigates through the collapsed or expanded navy rail with the same gating as
today, `--sidebar*` no longer exists, and the drive passes in light, dark and RTL.

## Blocked by

[381](381-every-screen-paints-in-palette-b-with-ibm-plex.md)
