---
type: wayfinder-ticket
wayfinder: prototype
map: 358
status: open
blocked-by: —
---

# 378 — The foundation in Arabic/RTL

## Question

What does the Ops Console **foundation** (362's tokens and density, 359's Plex incl. Plex Sans
Arabic, 363's rail shell) need to hold up under `dir="rtl"` with Arabic text, before step 1 ships?
The four screens get their own RTL passes in their steps (361); this ticket is the shared layer.

- **AG Grid:** in 363's RTL capture the Deliveries grid body did **not** mirror while the shell did.
  Does `ag-grid-theme`'s `enableRtl` (read once at module load) reach every grid, and what is the
  rule for a grid in a page whose direction changes?
- **Plex Sans Arabic at 12px / 26px rows:** legibility, line-height and vertical centring in grid
  cells and 6px controls (359 checked Latin only).
- **Mono IDs and codes in RTL:** 359 put IDs in Plex Mono; do they need `Ltr` isolation everywhere
  (crumb record number, store chip, grid cells), and does the breadcrumb separator read right?
- **Logical-only:** sweep the foundation diff for physical utilities and icons that must or must not
  flip (chevrons, the expand/collapse toggle, arrows in buttons).
- **The keyboard legends** 365 made LTR-isolated: do they sit right in the RTL top bar and palette?

- **Time windows and other digit ranges.** From [the sentence ticket](373-the-call-center-order-header-as-a-sentence.md):
  `Ltr`'s documented rule (a value breaks only with a space and a leading or trailing digit) is
  incomplete. `15:00–18:00` reverses to `18:00–15:00` under RTL with no space in it. **The shipped
  call center slot chip already does this** (`ConsoleShell` `Chip`, `${from}–${to}` unwrapped).
  Restate the rule and sweep for ranges. See `assets/373-shots/C-arabicRtl-light.png`.

Drive it on the 363 prototype branch (`?rtl=1`) with an Arabic locale stub for the shell's strings.

- **From [The Deliveries list as one screen](368-the-deliveries-list-as-one-screen.md):** under
  `dir="rtl"`, the inspector's **slot value** (`02 Oct 2026 · 10:00 - 12:00`, a day plus a window) and
  its **courier line** (`JAH · Khalid N.`) reorder. Add both to the sweep. See
  `assets/368-shots/A-rtl.png`.
