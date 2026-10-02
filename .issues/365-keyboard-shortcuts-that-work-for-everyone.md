---
type: wayfinder-ticket
wayfinder: grilling
map: 358
status: done
blocked-by: 364
---

# 365 — Keyboard shortcuts that work for everyone

## Question

Which shortcuts exist: Ctrl+K, `/`, J/K, `?`, Esc, per-screen keys?

Constraints:

- **Arabic layout.** Match on `event.code`, so a shortcut still works on an Arabic keyboard layout.
- **Typing.** Shortcuts never fire while typing in an input, inside an AG Grid cell editor, or
  with a dialog open.
- **Conflicts.** Avoid clashes with browser keys and with AG Grid's own navigation keys.

**Discovery:** how do occasional users find shortcuts? Options: a `?` sheet, key hints in tooltips
and palette rows, nothing more.

## Answer

Grilled with the owner on 2026-10-02. **A key is a field on a command.** Single keys exist on the
Deliveries list and Delivery details only, behind a per-user switch. No key ever writes, and the
call center's ruling 153 stands whole.

**Facts the code settled before grilling:**

- **There is no shortcut layer today.** Three ad-hoc listeners exist, all matching on `event.key`:
  the console's Ctrl+K (`ConsoleShell.tsx:432`), Simulation's Ctrl+Enter (`SimulationPage.tsx:253`,
  window-level, no dialog guard, a quiet no-op when it can't run) and the Columns popover's Esc
  (`GridToolbar.tsx:55`).
- 🚩 **The console's Ctrl+K probably fails on an Arabic layout.** Chrome reports the Arabic
  character in `event.key` for the K key, so `key !== 'k'` rejects it, while Chrome's own omnibox
  shortcut still fires. This is suspected, not driven. The keyboard-layer step should check it, and
  matching on `event.code` fixes it.
- **The Far prototype contradicts 153 on the console.** It gives Ctrl+Enter = place order and `/`
  slash commands, both of which [153](153-console-keyboard-grammar.md) ruled out.
- **AG Grid Community reserves its own keys** on a focused cell: arrows, Tab, Enter, Space,
  PageUp/PageDown, Home/End, Ctrl+A and Ctrl+C. On an editable cell, any printable key starts
  editing. J, K, R, C, N, `/` and `?` are not AG Grid keys.
- **WCAG 2.1.4 (Level A)** says a letter- or symbol-only shortcut must be possible to turn off,
  possible to remap, or active only while a control has focus.

### 1. Where a key lives — a field on a registered command

- A command registered through `useCommands([...])` in `@/core/commands` (from
  [364](364-what-the-command-palette-holds.md)) carries an optional **`keys`** field. That one
  registration binds the key while the page is mounted, shows the hint on the palette row and feeds
  the help sheet. **A key can only do what a palette row does.**
- **J/K are hidden navigation commands.** The screen registers them, and they are not listed in the
  palette.
- **Collisions:** two mounted commands claiming one key is a dev-time error.
- **Reserved keys are refused by the registry:**
  - any Alt chord
  - any Ctrl chord other than Ctrl+K (core) and Ctrl+Enter (screen)
  - AG Grid's own keys: arrows, Tab, Space, Enter in the grid, PageUp/PageDown, Home/End, Ctrl+A,
    Ctrl+C
- The app-wide keys (Ctrl+K, Esc, `?`) belong to the core layer.

### 2. Single keys — the list and details only, behind a switch

- Letters, `/` and `?` exist on the **Deliveries list and Delivery details only**. Simulation has
  none, because its resting focus is its form. The call center has none, because 153 stands. Every
  other screen gets Ctrl+K, dialog Esc, and its own Ctrl+Enter where one is ruled.
- **A per-user "Single-key shortcuts" switch, default on.** It sits in the user menu next to dark
  mode and inside the help sheet, and is stored like `oms.darkMode` (`localStorage`). When it is
  off, letters do nothing, while chords, the palette and the mouse still work. This is how we meet
  WCAG 2.1.4.
- The rejected alternative was "letters armed only while focus is in the grid". It meets the rule
  with no setting, but it dies the moment an operator clicks a header button.

### 3. When a key fires — three tiers, enforced in core

| Tier | Keys | Fires when |
|---|---|---|
| **Chords** | Ctrl+K, a screen's Ctrl+Enter | **from anywhere**, text boxes and grid cells included; **inert while any `dialog[open]` exists**. Ctrl+K always calls `preventDefault`, even when inert. |
| **Esc** | Escape | goes to the **topmost layer**: native dialog → open popover/menu → in-box clear → the screen's Esc command. The screen command runs only if nothing above took the press (`defaultPrevented`). |
| **Single keys** | letters, `/`, `?` | only if all of the following hold: focus is not in an input, textarea, select, contenteditable or `role=textbox/combobox/searchbox` (which covers AG Grid floating filters); not in an AG Grid cell editor or editable cell; no `dialog[open]`; no Ctrl/Alt/Meta (Shift only as part of `?`); the switch is on; and `!event.isComposing`. J/K repeat while held, but acts never repeat. |

**Matching:** letters, `/` and `?` use **`event.code`** (`KeyJ`, `Slash`, Shift+`Slash`). Enter
and Escape use `event.key`, which is the same on every layout. Meta counts as Ctrl.

### 4. Acts open, they never write

- **An act key presses its button and nothing more.** It opens the same dialog or form, and every
  commit stays a deliberate click or Enter inside that dialog. On the list, "open" is
  [367](367-what-the-inspector-shows-for-a-selected-delivery.md)'s **deep link** to Delivery
  details, which opens the dialog through Details' own gate.
- **A refused key toasts the reason** the button's tooltip and the palette row carry, such as a
  disabled act or nothing selected. It is never a silent dead key. Toasts are coalesced, so a held
  key can't stack them.
- **No key writes directly**, on any screen. Ctrl+Enter inside an open form is that form's own
  submit.

### 5. The Deliveries list

| Key | Does |
|---|---|
| `J` / `K` | Next / previous row. The same as ↓/↑ in the grid, and they work from outside the grid. |
| ↓ / ↑ | Kept. **Selection follows focus** on this list, so arrows and J/K move **one current row** and the inspector follows it (row fields only, per 367). |
| `Enter` | Opens Delivery details for the current row. Ignored on a button or link. Inside the query bar, Enter stays the deliberate "search". |
| `R` / `C` / `N` | Reschedule, Request cancellation and Add note for the current row, through the deep link in §4. A letter is bound **only if the list offers that act**. |
| `/` | Focuses the query bar (`preventDefault`, so Firefox's quick-find stays shut). |
| `?` | The help sheet. |

Space, Ctrl+A and Ctrl+C stay AG Grid's, so native copy is untouched.

### 6. Delivery details

| Key | Does |
|---|---|
| `Esc` | **Back to the list**, restoring its query and current row: history-back when we came from the list, otherwise `/oms/deliveries`. **Two-step:** Esc inside a text box only blurs it, and a second Esc goes back. **Refused while the note composer holds unsent text**, with a toast. |
| `R` / `C` | Open Reschedule and Request cancellation for this delivery. |
| `N` | Focuses the note composer. |
| `Ctrl+Enter` (in the composer) | Posts the note. This is the form's own submit. |
| `?` | The help sheet. |

There is **no J/K next/previous delivery** on details. It would need the list's results kept alive
behind the record page, and [371](371-the-delivery-details-record-page.md) may ask for it later.

### 7. The call center — 153 stands whole

- The prototype's **Ctrl+Enter = place order is rejected.** It is a terminal act one chord away
  from a text box. 🚩 **A command with the `terminal` flag can never carry `keys`**, and the
  registry refuses it.
- The prototype's **`/` slash commands are rejected.** They would be a second palette inside the
  item search, and Ctrl+K already lists every order verb, gated and with reasons.
- The console's keys stay [153](153-console-keyboard-grammar.md)'s table: Ctrl+K, then ↓/↑ and
  Enter in the search box, then Esc. Its Ctrl+K becomes the core one, which brings the `event.code`
  fix.

### 8. Simulation

Ctrl+Enter = Process stays, as a **registered `Process` command with `keys`**. A simulation is a
read, so §4's no-write rule does not apply. The press now:

- is **inert while a dialog is open**, which it is not today
- **toasts its refusal** ("Add an item first", "A run is already in progress"), coalesced. This
  replaces today's quiet no-op.

The `▶ Process ⌃⏎` hint stays on the button.

### 9. Discovery

1. **Palette rows show their key**, right-aligned `kbd`. This comes free from §1.
2. **Buttons carry it too:** the tooltip reads "Reschedule (R)", and the button carries
   `aria-keyshortcuts`. Letter hints hide when the switch is off.
3. **A "Keyboard shortcuts" sheet**, a native dialog **generated from the registry** (app-wide keys
   plus the mounted screen's commands), so it cannot drift. That answers 153's objection to a second
   surface. It is reached three ways:
   - `?` on the single-key screens
   - a **palette row** everywhere, including the console, where `?` would type into the box
   - the **user menu**

   The single-key switch also sits inside the sheet.

There is **no tour, banner or coach marks**.

### 10. Arabic and RTL

- **Letters and symbols show their Latin legend** (`R`, `J`, `/`, `?`), derived from the code
  (`KeyR` → `R`). It is printed on the cap on either layout, and it is data, not a translatable
  string.
- **Named keys go through `t()`:** `common:keys.ctrl`, `keys.enter`, `keys.esc`, `keys.shift`.
- **One key set for both languages.** The English mnemonic is lost in Arabic, and that cost is
  accepted.
- **Chord hints sit in an LTR-isolated span** (`<Ltr>`), so `Ctrl` `K` never reads `K Ctrl`. J/K
  and ↑↓ are vertical, so RTL doesn't flip them.
- **The hint always says Ctrl**, with Meta accepted (a Windows back office).

**Amended 2026-10-02 by [The Deliveries list as one screen](368-the-deliveries-list-as-one-screen.md):**
the list gains **`I`** (`KeyI`), which collapses and expands the Delivery inspector. It is list-only,
sits behind the single-key switch and never writes. It is the key 367 asked this ticket to assign.
