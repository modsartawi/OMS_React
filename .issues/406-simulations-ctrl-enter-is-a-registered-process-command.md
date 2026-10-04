---
status: done
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

- [x] `process refusal reason: no items → add-item reason, run in flight → in-progress reason, otherwise enabled` (a pure module) · pure
- [x] `tools/sim-process-drive.mjs`: light, dark and RTL; Ctrl+Enter runs a simulation (stubbed); under an open dialog it does nothing; with no items it toasts once even when held; the palette lists Process with its hint · flow (Playwright)
- [x] Existing `tools/sim-rtl-drive.mjs` and `tools/sim-density-drive.mjs` still pass under the foundation · flow (Playwright)

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

## Comments

**2026-10-04 — built AFK (ticket done; the owner's S5 sign-off is still open).**

- **What shipped.**
  - The pure `process-command.ts`: `processRefusal({ itemCount, pending })` gives the reason
    as an i18n key (a run in flight first, then an empty basket), and `processCommand` builds
    the registered `Process` command: `keys: 'Ctrl+Enter'`, label `simulation:actions.process`,
    and a handler only when there is no reason (K2).
  - `SimulationPage` registers it through `useCommands`. A denied session registers nothing.
    The window-level Ctrl+Enter listener is gone. The core key layer now binds the chord, keeps
    it inert under any open dialog, skips a held key's repeats, and toasts a refused press's
    reason under its one coalesced toast id.
  - The `▶ Process ⌃⏎` button keeps its glyph hint and now carries
    `aria-keyshortcuts="Control+Enter"`. Its tooltip reads "Process (Ctrl+Enter)", with the
    chord isolated as one unit, or gives the refusal reason when Process can't run. The page
    computes the reason once, and the button, the palette row and the toast all use it.
  - The result line's own Enter/Space now ignores modified presses. Without that, Ctrl+Enter
    on a focused line would have been prevented and skipped by the key layer, so "from
    anywhere" (102 §6) holds.
  - **The retheme:** Simulation's buttons dropped the pill and are now 6px (`rounded-md`).
    That covers Process, Clear, Clear cache, Add item, Add condition and the failure banner's
    settings route. Chips and badges stay round, and heights are unchanged. See HITL-406.
  - `tools/sim-rail-drive.mjs`: the Promotion checkbox locator is now `exact`, because the
    navy rail's "Pricing & Promotions" button (385) matched the loose label and hung the drive.
  - i18n: `simulation:process.refused.noItems` and `process.refused.running`.
- **Proof.**
  - `npm test`: 192 files, 3521 tests passed, including `process-command.test.ts` (8).
  - `npm run typecheck` clean. `npm run lint`: all four gates clean. `npm run build` green.
    `node tools/check-sim-keys.mjs` 8/8.
  - `tools/sim-process-drive.mjs`: **51/51** in light, dark and RTL, with the network
    stubbed. It covers:
    - the refusal tooltip and `aria-keyshortcuts`;
    - Ctrl+Enter held on an empty basket toasting once and posting nothing;
    - runs from the quantity box and from a focused result line;
    - the in-flight refusal;
    - inert under Clear cache's confirm dialog;
    - the palette's This screen row with its isolated Ctrl Enter hint, both greyed with its
      reason and enabled, where Enter runs it;
    - the shortcuts sheet listing Process alone;
    - no single keys;
    - Plex, 6px run controls, and the chip strip, Items, money foot and rule cards rendering.
    Screenshots are in `tools/.sim-process-shots/` (gitignored).
  - The existing drives still pass under the foundation, all on port 5280:
    - `sim-density` 33/33
    - `sim-rtl` 29/29
    - `sim-strip` 51/51
    - `sim-states` 27/27
    - `sim-responsive` 47/47
    - `sim-rail` 35/35, after the locator fix
    - `sim-bby-gate` 22/22
- **Noticed, not changed.** `SimRunStrip`'s own Esc window listener predates this ticket and
  is outside its scope. It collapses the expanded form on any Esc, even one that closes a
  dialog, and it ignores `defaultPrevented`. Moving it onto the key layer would change 102 §6
  ("Esc collapses from anywhere"): Esc in a text box would only blur. That is the owner's call.
- **Outstanding (not AFK):**
  - the owner's live S5 sign-off, including the HITL calls (refusal order, pill → 6px with
    32px heights kept, 34px result lines kept);
  - a human eye on real Arabic copy;
  - a run against a live SIS.Api.
