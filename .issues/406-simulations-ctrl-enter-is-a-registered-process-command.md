---
status: open
spec: 380
blocked-by: 405
---

# 406 — Simulation's Ctrl+Enter is a registered Process command that is inert under a dialog and says why it can't run

## What to build

S5. Simulation is **rethemed only** (spec 380 **M1**, ruled in
[372](372-the-simulation-price-waterfall.md)): spec 110's arrangement stays whole (the chip strip,
Items, the 66/34 split, expand in place, the rail), and 116's line expansion is restyled by the
foundation alone. The one behaviour change is **M2**, ruled in
[365](365-keyboard-shortcuts-that-work-for-everyone.md) §8.

- **Replace the page's window-level Ctrl+Enter listener** with a registered **`Process` command**
  carrying `keys` through `useCommands`. A simulation is a read, so K5's no-write rule doesn't apply.
- **The press:**
  - is **inert while any dialog is open** (the core chord tier);
  - **toasts its refusal**, coalesced, when it can't run: "Add an item first", "A run is already in
    progress". This replaces today's silent no-op.
- **Process appears in the palette's This screen group** with its key hint. The `▶ Process ⌃⏎` hint
  stays on the button, and the button carries `aria-keyshortcuts`.
- **Simulation has no single keys.**
- **Verify the retheme holds** on Simulation: the chip strip, Items, the expansion, the money foot
  and the rule cards at the 26px density, in light, dark and RTL. Fix only what the foundation broke
  (391's rule).

## Spine reach

logic (Process enablement + refusal reason) · keys (`useCommands`) · component (button hint) · i18n
(`simulation`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `process refusal reason: no items → add-item reason, run in flight → in-progress reason, otherwise enabled` (a pure module) · pure
- [ ] `tools/sim-process-drive.mjs`: light, dark and RTL; Ctrl+Enter runs a simulation (stubbed); under an open dialog it does nothing; with no items it toasts once even when held; the palette lists Process with its hint · flow (Playwright)
- [ ] Existing `tools/sim-rtl-drive.mjs` and `tools/sim-density-drive.mjs` still pass under the foundation · flow (Playwright)

## Boundaries

- **No new endpoint.**
- **i18n (`simulation`):** `process.refused.noItems`, `process.refused.running` and the command
  label. Reuse existing keys where they already say this.
- **Out of scope:** the price waterfall, the inputs pane and Far's Simulation layout (372).

## Done when

Ctrl+Enter on Simulation runs through the registry, is inert under a dialog, toasts its refusal, and
the Simulation drives are green. This closes S5.

## Blocked by

- [405](405-a-note-is-posted-from-the-composer-at-the-now-line.md) — S4 closes first (step order R1).
  The real dependency is 393's key registry.
