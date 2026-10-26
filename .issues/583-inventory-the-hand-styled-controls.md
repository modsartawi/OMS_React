---
type: wayfinder-ticket
wayfinder: task
map: 580
status: done
blocked-by: —
---

# 583 — Inventory the hand-styled controls

## Question

Nothing to decide — the sweep strategy ([588](588-how-the-screens-move-onto-the-shared-controls.md))
waits on this. **What patterns do the 422 hand-written `<button>`s and 550
`<input>`/`<select>`/`<textarea>`s in `src/features/` actually fall into?**

Classify every occurrence (a script, not a read-through), and file the result under
`assets/583-control-inventory/` as a table plus the script:

- **Buttons:** which already match a `core/ui/Button` variant by class string, which are icon
  buttons, links-styled-as-buttons, chips/toggles, menu items, grid-cell actions, or one-offs.
- **Fields:** text/number/date inputs, selects, textareas, checkboxes/radios, search boxes, file
  inputs — and how many distinct class strings each kind uses.
- **Shape tokens:** where `rounded-md/lg/xl`, `border-input` and `shadow-*` land (control, card,
  dialog, badge).
- **Per-screen counts**, so the heaviest screens are visible, and which ones already copy a shared
  constant (as the login's `inputClass` did) rather than spelling classes inline.

Resolved when every occurrence is in exactly one bucket and the table gives counts per bucket and
per screen.

## Answer

**2026-10-26.** Full tables in [assets/583-control-inventory/inventory.md](assets/583-control-inventory/inventory.md)
(script `inventory.mjs`, raw rows `inventory.json`; TypeScript-AST parse of 505 `.tsx` files, className
constants and imports followed). Every occurrence lands in exactly one bucket, 0 unclassified, sums
checked.

- **Buttons (435** = 419 `<button>` + 16 links styled as buttons): 88 carry a `core/ui/Button`
  variant's colour signature (none with its exact `h-7 rounded-md px-3 text-xs` shape), 72
  chips/toggles/tabs, 59 icon buttons, 56 text-link/bare text buttons, 41 neutral outlined
  look-alikes (the `border-border/60 hover:bg-muted` pill repeated across toolbars), 31 row/tile
  pickers, 25 grid-cell actions, 5 menu items, 42 one-offs. 307 distinct class strings.
- **Fields (543)**: 140 text, 86 search, 55 date, 26 number, 123 select, 36 textarea, 47 checkbox,
  12 radio, 15 file, 3 dynamic-type; 224 distinct class strings (159 ignoring width/margin/flex).
  302 fields already go through a named constant (`INPUT`, core's `RULE_INPUT`, …), against 80
  buttons.
- **Shape tokens**: 1,432 elements; 760 are controls, 465 cards/panels, 31 dialogs/popovers, 12
  badges, 164 other.
- **Heaviest**: `campaigns/workspace` 92, `callcenter/__prototype__` 78, `collection/inquiry` 74,
  `callcenter/console` 70, `admin/sync-console` 48 — 37% of 978 controls across 56 features.
