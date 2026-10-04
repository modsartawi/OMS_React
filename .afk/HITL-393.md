# HITL log — ticket 393 (a key is a field on a command)

## Q: How does `?` know it is on a "single-key screen" when no screen registers keys yet?
**Decision taken:** A route flag, `handle: { singleKeys: true }`, on `oms/deliveries` and `oms/delivery/:deliveryNo` (the same `handle` mechanism as 392's `print` / `ownPalette`). Only there is `?` live, and only there may a command bind a letter or `/`; elsewhere the registry refuses the letter (`single-key-screen`, a dev error).
**Why:** 365 §2 puts letters, `/` and `?` on the list and Delivery details only, and the drive must prove `?` in this ticket, before 397/401/405 register anything.
**Revisit if:** the owner wants single keys derived from "the page registered a letter", or wants Document details (`oms/document/:no`) to be a single-key screen too.

## Q: Where does the "Keyboard shortcuts" palette row sit, given K8's "no app-level actions in v1"?
**Decision taken:** Last row of **This screen**, on every screen with a palette host. It hints `?` only where `?` is live. This screen is therefore never empty, and 392's drive assertion became `["screen","goto"]`.
**Why:** K16 requires the row everywhere; a new group would contradict K8's group list, and the sheet it opens IS this screen's keys.
**Revisit if:** the owner wants a separate "Help" group, or the row at the end of the palette.

## Q: The key string format for `Command.keys`
**Decision taken:** One string, modifiers first, base = `event.code` (`KeyR`, `Slash`, `Shift+Slash`) or `Enter` / `Escape` (matched on `event.key`); `Ctrl+Enter` for a screen's chord. Meta counts as Ctrl at match time. Anything other than a letter, `/`, Esc and Ctrl+Enter is refused (`unsupported`) on top of K3's list.
**Why:** The narrowest set 365 rules; an allowlist is safer than enumerating every reserved key.
**Revisit if:** a later screen needs a digit or F-key.

## Q: What does a "dev-time error" mean for a refused key?
**Decision taken:** `console.error` once per refusal, in dev builds only; the refused key binds nothing and the first binding wins. No throw.
**Why:** "The first binding wins" implies the app keeps running; a throw would take the page down.
**Revisit if:** the owner wants refusals to fail loudly (throw) in dev.

## Q: Esc in a text box on a screen with an Esc command
**Decision taken:** The core layer blurs the box on the first Esc and lets the second reach the screen's Esc command (365 §6's two-step), for every screen. A cell editor's Esc is always the editor's.
**Why:** One key layer only (no second keydown layer in 405), and the two-step is the ruled behaviour for the only screen that binds Esc.
**Revisit if:** a screen needs Esc to fire straight from a box.

## Q: The Esc layering for existing popovers
**Decision taken:** A core `takesEscape(event, layer)` helper; the rail flyout/overlay/drawer, user menu, store chip, bell and the list's Columns popover now take Esc only when nothing above took it (no dialog opened over them) and `preventDefault` it. The key layer moved from `document` to `window` bubble so it runs after all of them (HITL-392 had `document` bubble — still bubble, still the last stop for Ctrl+K). Sim's form, nphies attachments, ServedByPicker and the call-center panels were not touched: none is on a single-key screen and none sits under a screen Esc yet.
**Why:** K4's "native dialog → popover/menu → in-box clear → screen Esc", proven in the drive (sheet over the bell panel: first Esc closes the sheet only).
**Revisit if:** 405/406 bind Esc on a screen that has one of the untouched overlays.

## Q: Should the help sheet hide or mute single keys when the switch is off?
**Decision taken:** Mute (listed in muted ink). Palette rows and button hints hide them, as K15 says.
**Why:** The sheet is the reference for what exists, and it holds the switch that turns them back on.
**Revisit if:** the owner reads K15's "letter hints hide" as covering the sheet too.

## Q: "Editable cell" in 365 §3
**Decision taken:** Only AG Grid's inline and popup editors (`.ag-cell-inline-editing`, `.ag-popup-editor`) count as the cell editor. A focused editable cell that is not editing is `other`.
**Why:** The ticket's table says "an AG Grid cell editor"; the DOM marks no editable-but-idle cell, and no single-key screen has an editable grid. The layer also skips any press the grid already prevented.
**Revisit if:** an editable grid lands on the list or Details.

## Q: Toast tier for a refused key
**Decision taken:** Sonner's neutral `toast(...)` under one id (`core-key-refused`), so a held key updates one toast.
**Why:** Amber stays reserved for attention; a refused key is not a status.
**Revisit if:** the owner wants refusals in the warning tier.

## Q: Button hints with no keyed button yet
**Decision taken:** `useKeyHint(keys)` in `@/core/commands/key-hint` returns the "Label (R)" tooltip (via `common:shortcuts.withKey`, chord `fsi`'d whole) and `aria-keyshortcuts`, hiding letter hints when the switch is off. No button uses it yet; 397/401/405/406 wire it.
**Why:** K15 is in this ticket; the first keyed buttons arrive in later slices.
**Revisit if:** a later slice wants the hint built into `core/ui/Button`.
