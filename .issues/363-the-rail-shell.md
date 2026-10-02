---
type: wayfinder-ticket
wayfinder: prototype
map: 358
status: done
blocked-by: 362
---

# 363 — The rail shell

## Question

How does today's `AppShell` fold into the Ops Console's navy icon rail and top bar? It has to hold:

- the menu groups from `menu-model.ts`, including permission-gated items (`accessProbe`);
- the store switcher;
- the notification bell;
- the user menu;
- the broadcast entry.

Also decide:

- **Collapsed vs expanded rail**, and labels for occasional users.
- **The active-screen marker.**
- **Narrow widths.**
- **RTL mirroring.**

Prototype it in the live app on
[Ops Console colours, density and grid look](362-ops-console-colours-density-and-grid-look.md)'s tokens.

**From 362** (see its Answer, "Findings handed on"):

- Rename `--sidebar*` to `--rail*`. `callcenter/console/CustomerRail.tsx` uses `bg-sidebar` and
  must not go navy.
- `text-sidebar-active` is link ink in `LoginPage.tsx` and `ua-admin/cards.ts`. Under the gold rail
  token it would be gold on white at 1.56:1.
- Group labels take `--sidebar-muted`.
- The active marker must be logical, not an inset shadow.
- The prototype branch `prototype/362-ops-console-tokens` already paints today's sidebar navy to
  build on.

## Answer

**D, "Expanding rail", collapsed by default** — picked by the owner on the live app over A (icon
rail + flyout, Far as drawn), B (labelled 72px rail) and C (rail + docked group panel). Prototype:
branch `prototype/363-rail-shell` (`acd5564`, stacked on `prototype/362-ops-console-tokens`; flip
with the floating bar or `?shell=A|B|C|D&rtl=1&cmd=1&stub=1`). [Captures](assets/363-shots/) — all
four in light, dark, RTL, 1100px, a deep page, plus the phone drawer and both user-menu placements.

**Why D.** Far's drawing has one icon per *screen*; the app has **8 groups and ~30 leaves** (one
sub-group, Settlement). D's collapsed state *is* A — the Far look, and the width the Deliveries list
+ its 360px inspector need — while one click pins the labelled tree for occasional users. B's labels
truncate ("Administration", "Pricing & Promotions") and would need new short keys; C costs 264px on
every screen. The phone drawer needs the labelled tree anyway, so D's expanded state is nearly free.

### The frame

- **Rail:** navy, full height, sticky. Top: the brand mark (links `/`; the name shows when
  expanded). Then one row per **visible group** from `useVisibleMenu(MENU)` — gating is unchanged,
  a group whose leaves all hide disappears. Foot: expand/collapse toggle, then the user avatar.
- **Collapsed (default, 56px):** group icons, tooltip = group label. Clicking one opens a **navy
  flyout** (240px, full height, continues the rail) with the group label and its leaves; the
  Settlement sub-group draws as header link + indented leaves, always open. While a flyout is open,
  hovering another group switches to it (menu-bar behaviour); Esc, outside click or navigating
  closes it; focus moves to its first link. Flyout is `role="dialog"` labelled by the group.
- **Expanded (240px):** today's accordion tree on navy — group headers in `--sidebar-muted`
  uppercase (white when they hold the active screen), the active group open, others collapsible.
- **State:** collapsed/expanded is a **per-user preference in localStorage**, default collapsed.
  It is never forced open on any route.
- **Active marker:** a 3px gold bar on the rail's **inline-start edge** — a `::before` with
  `inset-inline-start`, never an inset shadow — on the group icon (collapsed) or the leaf (tree,
  flyout). Gold is on navy only (362's rule). The active row also takes `--sidebar-accent` + white
  ink. Driven: the marker lands flush on the rail edge in LTR and RTL.
- **Top bar (44px, `--card`):** breadcrumb (group / [sub-group] / leaf / record number in mono,
  derived from the menu), then — **from the keyboard step only** (361: no Ctrl+K hint before it)
  — the centred palette field, then the **store chip** and the **bell**. Nothing else.
- **Store chip:** the acting store moves **out of the account popup** into its own chip ("Acting
  store `1001`"), opening today's `StoreSwitcher`. With no store it takes the attention tone — the
  Nphies "store not resolved" dead end (2026-08-02) becomes visible from every screen.
- **User menu (owner):** avatar at the **rail foot**; its menu holds name + user id, the theme
  toggle, the shortcuts sheet (from the keyboard step), sign out, and the **build stamp**. **Today's
  footer row is dropped** — the stamp lives in the menu (`/version.json` stays the machine read).
- **Broadcast (owner):** stays **an Administration leaf only** (plus the palette's Go to). No
  top-bar button.
- **Call center (owner): joins the shell, rail collapsed.** `chromeless` stops being the call
  center's layout; it gets the rail + top bar like every screen. It ships with 361's **Call center
  step**, not the foundation, and the operator lead accepts it with the 260px-rail change. Print
  routes keep their own chromeless layout.

### Narrow widths

- **≥1280px:** as above.
- **640–1279px:** always collapsed; the toggle *overlays* the tree (scrim, page doesn't reflow)
  instead of pushing, and closes on navigation. Today's 992px breakpoint goes.
- **<640px:** no rail. A hamburger at the top bar's start opens a navy drawer with the full
  labelled tree (brand, every group, every leaf). Body scroll locks.

### RTL

Everything is logical: rail on the inline-start side, flyout via `inset-inline-start`, marker via
`::before` `inset-inline-start`, chevrons that point "forward" take `rtl:-scale-x-100`. Driven
under `dir="rtl"`: rail, marker, crumb, store chip and bell all mirror. **Finding for the RTL
review:** the Deliveries grid body did not mirror in the same capture — check that
`ag-grid-theme`'s `enableRtl` reaches every grid.

### Tokens and consumers (from 362)

- **Rename `--sidebar*` → `--rail*`** (`--rail`, `--rail-foreground`, `--rail-accent`,
  `--rail-active` = gold, `--rail-muted`) with the shell, in foundation step 1. The contrast-gate
  pairs 362 listed move with the names.
- **`callcenter/console/CustomerRail.tsx`** takes `bg-card-2`, not the rail token.
- **`text-sidebar-active` as link ink** (`LoginPage.tsx`, `ua-admin/cards.ts`) moves to
  `text-primary` before the rail token turns gold (1.56:1 on white).
- **Print (from 375):** rail and top bar take `print:hidden`.

### Left to the build, not decided here

The prototype's copy is literal (dev chrome); the build adds keys for "Collapse menu", "Expand
menu", the flyout close and the store chip under `common:topbar.*`. The prototype's `useDismiss` and
`useMedia` are throwaway; the expand state wants a small zustand store beside `theme.ts`.
