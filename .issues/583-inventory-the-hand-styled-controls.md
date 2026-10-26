---
type: wayfinder-ticket
wayfinder: task
map: 580
status: open
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
