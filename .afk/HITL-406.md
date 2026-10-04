# HITL log — ticket 406 (Simulation's Ctrl+Enter is a registered Process command)

## Q: Which refusal wins when the basket is empty AND a run is in flight?
**Decision taken:** "A run is already in progress" first, then "Add an item first".
**Why:** The in-flight run is the reason the press does nothing right now; the items entry is disabled while a run is out, so the two only coincide transiently.
**Revisit if:** the owner wants the basket reason to win (one line in `process-command.ts`).

## Q: The Process command's label — a new `process.label` key, or the button's existing word?
**Decision taken:** Reused `simulation:actions.process` ("Process"). Only the two refusal keys are new (`process.refused.noItems`, `process.refused.running`).
**Why:** The ticket says reuse existing keys where they already say this; one label per act (detail-keys.ts does the same with its bar's labels).
**Revisit if:** the palette row ever needs words the button doesn't carry.

## Q: The disabled Process button's tooltip
**Decision taken:** A refused Process shows its reason as its tooltip ("Add an item first" / "A run is already in progress"); an enabled one reads "Process (Ctrl+Enter)". `aria-keyshortcuts="Control+Enter"` is always present. The `⌃⏎` glyph hint stays on the button.
**Why:** K2: the disabled reason is "the same words as its button's tooltip"; K15 gives "Label (key)" on enabled buttons.
**Revisit if:** the owner wants the key hint in the tooltip even while refused.

## Q: Does "6px controls" in the S5 retheme mean Simulation's buttons drop the pill?
**Decision taken:** Yes, radius only: Process, Clear, Clear cache, Add item, Add condition and the failure banner's "Open the run settings" go `rounded-full` → `rounded-md`. Heights (32px), paddings and widths are unchanged. Chips, the chip-set control, badges, the status-slot pill and the near-miss meter stay round.
**Why:** 372's answer lists "6px controls" as part of Simulation's retheme, F7 says buttons drop the pill, and HITL-391 deferred Simulation's pills to S5 explicitly. Height stayed so 119's measured strip widths and every sim drive's geometry hold.
**Revisit if:** the owner reads F7's "keep a 28px height" as applying here too (h-8 → h-7 on the three run controls; re-run sim-responsive-drive).

## Q: "The 26px density" on Simulation
**Decision taken:** No change. Simulation mounts no AG Grid; its result lines are 116's plain table at 34px, which `sim-density-drive.mjs` asserts and the ticket requires to stay green.
**Why:** 26px is the grid row height (F7); M1 is retheme-only and keeps 116's line expansion whole.
**Revisit if:** the owner wants the result lines themselves tightened — that is a density change to 116, with its drive updated.

## Q: A Ctrl+Enter on a focused result line
**Decision taken:** The result line's own Enter/Space handler now ignores modified presses, so Ctrl+Enter there reaches the key layer and runs Process (and toggles nothing).
**Why:** The key layer skips a press a control already prevented (368); the old window listener ignored that and fired from the line. "From anywhere" (102 §6) is kept.
**Revisit if:** nothing.
