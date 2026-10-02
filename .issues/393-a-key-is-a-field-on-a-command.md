---
status: open
spec: 380
blocked-by: 392
---

# 393 — A key is a field on a command: three firing tiers, a single-key switch and a generated help sheet

## What to build

A command registered through `useCommands` can carry an optional **`keys`** field. That one
registration binds the key while the page is mounted, shows the key's hint on the palette row and
feeds the help sheet. **A key can only do what a palette row does.**

**The registry refuses**, as a dev-time error:

- two mounted commands claiming one key;
- any Alt chord;
- any Ctrl chord other than Ctrl+K (core) and a screen's Ctrl+Enter;
- AG Grid's own keys: arrows, Tab, Space, Enter in the grid, PageUp/PageDown, Home/End, Ctrl+A and
  Ctrl+C.

It also supports a **hidden** flag, which J/K use from 397.

**Three firing tiers, enforced in core:**

| Tier | Fires when |
|---|---|
| **Chords** (Ctrl+K, a screen's Ctrl+Enter) | From anywhere. Inert while any `dialog[open]` exists. |
| **Esc** | It goes to the topmost layer: native dialog → popover/menu → in-box clear → the screen's Esc command. The screen command runs only if `!event.defaultPrevented`. |
| **Single keys** (letters, `/`, `?`) | Only when **all** of these hold: focus is not in an input, textarea, select, contenteditable, `role=textbox/combobox/searchbox` or an AG Grid cell editor; there is no `dialog[open]`; no Ctrl, Alt or Meta is held (Shift only for `?`); the switch is on; and `!event.isComposing`. |

- **Matching:** letters, `/` and `?` match on **`event.code`**. Enter and Escape match on
  `event.key`. Meta counts as Ctrl.
- **The layer skips `event.defaultPrevented`.** A key a control has already handled stays that
  control's (368 finding).
- **Keys only open.** An act key presses its button and nothing more. **A refused key toasts its
  reason**, and the toast is coalesced so a held key can't stack them.

**The single-key switch** is per user, defaults to on, and is stored like `oms.darkMode`. It sits in
the rail-foot user menu (from 386) and in the help sheet. When it is off, letters do nothing, while
chords, the palette and the mouse still work (WCAG 2.1.4).

**Discovery:**

- Palette rows show their key in a right-aligned `kbd`.
- Buttons wired to a keyed command show "Label (R)" in their tooltip and carry `aria-keyshortcuts`.
  Letter hints hide when the switch is off.
- **The "Keyboard shortcuts" sheet** is a native dialog **generated from the registry**: the
  app-wide keys plus the mounted screen's commands. It is reached by `?` on single-key screens, by a
  palette row everywhere, and from the user menu.

**Legends:**

- Letters and symbols show their Latin legend derived from the code (`KeyR` → `R`). This is data,
  not a translation.
- Named keys go through `common:keys.ctrl/enter/esc/shift`.
- A chord hint is isolated **as one unit** (one `Ltr` wrapper, not one per `<kbd>`).

This ticket binds no screen keys yet. The list (397, 401), Details (405), Simulation (406) and the
console (395) register theirs. The app-wide `?` and Esc layering land here.

**Implements:** spec 380 **K2** (keys, hidden), **K3–K6, K15–K17**.

**Rulings:** [365](365-keyboard-shortcuts-that-work-for-everyone.md) §1–§4, §9 and §10, and
[378](378-the-foundation-in-arabic-rtl.md) §5 (key legends).

## Spine reach

store/logic (registry key binding, a pure fire-tier decision, the switch preference) ·
component/route (key layer at `ProtectedLayout`, help sheet dialog, user-menu entry, palette `kbd`)
· i18n (`common:keys.*`, `common:shortcuts.*`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `registryRefusesReservedAndCollidingKeys`: an Alt chord, Ctrl+S, ArrowDown, Space, and a
  second command on an already-bound key are each refused with a dev error. The first binding wins
  · pure
- [ ] `fireTierDecision`: a pure `(event facts, focus kind, dialogOpen, switchOn) → fire | skip`
  covering chords from a text box, chords under a dialog, letters in an input, letters in a grid
  cell editor, `isComposing`, Shift only for `?`, the switch off, and `defaultPrevented` skipped.
  An Arabic `key` with a `KeyJ` code still fires · pure
- [ ] `legendDerivesFromCode`: `KeyR` → `R`, `Slash` → `/`, Shift+`Slash` → `?`, and named keys go
  through their i18n key · pure
- [ ] `tools/command-palette-drive.mjs`, extended. `?` opens the generated sheet, which lists the
  app-wide keys. A palette row and the user menu reach it too. Turning the switch off makes `?` type
  nothing and do nothing. Esc closes the topmost layer first. The drive runs in light, dark and RTL
  (the chord reads `Ctrl K`) · flow (Playwright)

## Boundaries

- No new API endpoint.
- New keys under `common:keys.*` and `common:shortcuts.*` (the sheet title, the switch label and the
  refused-key toast).
- The `terminal` + `keys` refusal lands with 395, where `terminal` arrives.
- The help sheet's look follows 388's card recipe.

## Done when

A command with `keys` binds, hints and lists itself in the generated sheet. The three tiers hold,
the switch turns letters off, and the proof tests and the drive are green.

## Blocked by

[392](392-ctrl-k-opens-one-palette-with-go-to-and-jump.md).
