---
status: done
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

- [x] `registryRefusesReservedAndCollidingKeys`: an Alt chord, Ctrl+S, ArrowDown, Space, and a
  second command on an already-bound key are each refused with a dev error. The first binding wins
  · pure
- [x] `fireTierDecision`: a pure `(event facts, focus kind, dialogOpen, switchOn) → fire | skip`
  covering chords from a text box, chords under a dialog, letters in an input, letters in a grid
  cell editor, `isComposing`, Shift only for `?`, the switch off, and `defaultPrevented` skipped.
  An Arabic `key` with a `KeyJ` code still fires · pure
- [x] `legendDerivesFromCode`: `KeyR` → `R`, `Slash` → `/`, Shift+`Slash` → `?`, and named keys go
  through their i18n key · pure
- [x] `tools/command-palette-drive.mjs`, extended. `?` opens the generated sheet, which lists the
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

## Comments

**Done 2026-10-03 (AFK).**

**What was built** (all in `@/core/commands` unless named):
- **`keys.ts`** (pure): `Command.keys` is one string, modifiers first, base = `event.code` (`KeyR`, `Slash`, `Shift+Slash`) or `Enter`/`Escape` (by `event.key`), Meta as Ctrl.
  - `keyRefusal` / `bindKeys`: Alt chords; Ctrl chords but Ctrl+Enter; Ctrl+K and `?` (the core's); AG Grid's keys (arrows, Tab, Space, Enter, PageUp/Down, Home/End, Ctrl+A, Ctrl+C); anything not a letter, `/`, Esc or Ctrl+Enter; a letter off a single-key screen; and a collision. The first binding wins.
  - `legendOf` / `legendText` / `ariaKeyShortcuts`: Latin legend from the code, named keys through `common:keys.*`, Shift+Slash as the one cap `?`.
- **`fire-tier.ts`** (pure): `fireDecision(event facts, focus kind, dialogOpen, switchOn) → fire | skip | blur` and `focusKindOf`. `blur` is Esc in a text box (365 §6's two-step).
- **`key-layer.ts`**: the ONE `keydown` listener (on `window`, bubble, so every control and popover has the press first). It serves Ctrl+K (moved here from 392's `usePaletteHost`), `?` and every mounted command's keys, toasts a refused command's reason under one sonner id, and reports refusals as dev errors once each. `takesEscape(event, layer)` gives popovers their place in the Esc order.
- **`single-key-switch.ts`**: `oms.singleKeys`, on by default, stored like `oms.darkMode`.
- **`ShortcutsSheet.tsx`** + **`shortcuts-sheet.ts`**: a `Modal` (388's card recipe) generated from the registry. It lists the app-wide keys (Ctrl+K, `?` where live, Esc), then the bound screen commands (hidden ones included), plus the switch. It returns focus where it was opened from and resets when the host unmounts.
- **`KeyChord.tsx`**: the caps, isolated as ONE `Ltr`. **`key-hint.ts`**: `useKeyHint` for "Label (R)" tooltips and `aria-keyshortcuts`, with letter hints hidden while the switch is off.
- **Palette:** rows carry `keys` (a right-aligned `kbd`, letters hidden when off). Hidden commands are never rows. A "Show keyboard shortcuts" row closes This screen on every hosted screen.
- **`layout/`:**
  - The host binds the key layer and reads `handle.singleKeys`. `router.tsx` flags `oms/deliveries` and `oms/delivery/:deliveryNo`.
  - The user menu gains the switch (`menuitemcheckbox`) and Keyboard shortcuts.
  - The rail flyout, overlay and drawer, the user menu, the store chip, the bell and the list's Columns popover take Esc through `takesEscape` and `preventDefault` it.
- **i18n:** `common:keys.shift` and `common:shortcuts.*`.

**Proof:**
- **Pure:**
  - `keys.test.ts`: `registryRefusesReservedAndCollidingKeys`, `legendDerivesFromCode`, plus `eventKeys`, `tierOf` and `parseKeys`.
  - `fire-tier.test.ts`: `fireTierDecision`, all eight listed cases and the Arabic `key` + `KeyJ`, plus repeat and Esc layers; and `focusKindOf`.
  - `single-key-switch.test.ts`, `key-hint.test.ts`, `shortcuts-sheet.test.ts`.
  - Additions to `palette-model.test.ts` and `layout/palette-groups.test.ts`.
  - The tests were written alongside the modules, not strictly red-first.
- **Drive:** `tools/command-palette-drive.mjs` runs **200/200** on port 5280, network stubbed, in light, dark and RTL. It checks:
  - `?` from a grid cell opens the native sheet, which lists `app:palette`, `app:sheet` and `app:esc`. The chord reads `Ctrl K` left to right under one `bdi[dir=ltr]`.
  - Esc returns focus to the cell. `?` in a text box types `?`.
  - The palette row (`?` kbd) and the user menu open the sheet, with focus returned to the origin.
  - With the switch off (user menu, stored `false`), `?` changes nothing, Ctrl+K still opens the palette, and the row's hint hides. The sheet's own switch turns it back on.
  - **Topmost first:** with the sheet over the open bell panel, the first Esc closes only the sheet and the second closes the panel.
  - `?` works on Delivery details. On Home, `?` does nothing and the sheet omits `?`. Captures are in `tools/.palette-core-shots/sheet-*.png` (gitignored).
- **`tools/foundation-drive.mjs`:** its user-menu walk was updated for the two new items. It runs 1294/1302. The 8 failures are not this slice's:
  - 4 are "the bar's only controls…", stale since 392 added the palette field.
  - 4 are "the time's count… '21'", which drifts with wall-clock time over the long run.
- **Gates:** typecheck clean; `npm test` 182 files / 3284 tests; lint all four gates (758 files, 22 grid mounts, 148 contrast pairs, 763 files); build green.

**Reviews:**
- `/code-review` (medium) found one bug: the sheet's open state survived the host unmounting. Fixed with `resetShortcuts` on unmount.
- `/standards-review` found no hard violation. Applied:
  - the palette row uses `hintedKeys`;
  - the unreachable Alt and Digit legend branches were dropped (no literal "Alt");
  - the Close label moved under `common:shortcuts.close`.

  Left as judgement calls:
  - `bindKeys` is recomputed per consumer and per press (cheap and pure);
  - the repeated `takesEscape` stanza in six listeners;
  - `chord.ts`'s `isPaletteChord` / `keyLegend` beside `keys.ts`;
  - `useKeyHint` has no caller until the first keyed button (397/401/405/406).

**Not here, by design:** no screen binds a key yet (395, 397, 401, 405, 406). The `terminal` + `keys` refusal is 395's. The console still has its own palette, so it has no sheet row until 395.

**Outstanding (owner, not AFK):** the S2 live sign-off at 395, and a human eye on Arabic rendering.

10 decisions are in `.afk/HITL-393.md`.
