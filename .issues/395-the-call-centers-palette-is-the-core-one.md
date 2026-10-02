---
status: open
spec: 380
blocked-by: 393
---

# 395 — The call center's palette is the core one

## What to build

The call center console stops running a second palette.

- **Registration.** Its offers, order verbs and its two terminal acts (*Place order*, *Abandon
  call*) become its **This screen** rows through `useCommands`. `palette-model.ts` becomes that
  registration, and its pure tests keep pinning the rows, labels, disabled reasons and order.
- **Removals.** The console's own `CommandPalette.tsx`, its `highlight.ts` copy and its Ctrl+K
  listener in `ConsoleShell` (which matches on `event.key`) are removed. The core palette's
  `event.code` match brings the **Arabic-layout fix**.
- **The core palette gains a generic `terminal` flag.** A terminal row **sorts last and is never
  auto-highlighted**, and the registry **refuses `keys` on a terminal command**. This keeps ruling
  192's safety rule (Place order and Abandon call are never one stray Enter away) as a property any
  screen can use.
- **The opt-out goes.** `/callcenter`'s route opt-out from 392 is removed, so the console gets the
  core palette, including Go to, Jump to number and Recent.
- **153 stands whole.** The console has no single keys, no slash commands and no place-order chord.
  Its keys stay Ctrl+K, then ↓/↑ and Enter in the search box, then Esc. `?` is not bound on the
  console, because it would type into the box. The help sheet is reached by its palette row.
- **Carried over unchanged:** each open starts empty, the act runs after the palette closes, focus
  returns, and the palette is inert under a dialog.

**Implements:** spec 380 **K14, K19**, and the `terminal` part of **K2/K3**.

**Rulings:** [364](364-what-the-command-palette-holds.md) §5,
[365](365-keyboard-shortcuts-that-work-for-everyone.md) §7, and the call center's 153 and 192.

## Spine reach

store/logic (`terminal` sorting and the refusal in the registry; `palette-model` as a registration)
· component/route (`ConsoleShell` registers; the console's palette, highlight copy and listener are
removed; the route flag is removed) · i18n (existing `callcenter` keys, re-pointed) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `terminalRowsSortLastAndNeverAutoHighlight`: with a terminal row matching best, the
  highlighted index is still the first non-terminal row, and terminal rows render last · pure
- [ ] `registryRefusesKeysOnTerminalCommand`: registering `{ terminal: true, keys: 'Ctrl+Enter' }`
  is a dev error · pure
- [ ] `palette-model.test.ts`, kept green: the console's rows, labels, disabled reasons and order are
  unchanged as a `useCommands` registration · pure
- [ ] `tools/callcenter-drive.mjs` and `tools/command-palette-drive.mjs`, extended. On `/callcenter`,
  Ctrl+K opens the core palette with the console's verbs plus Go to. Typing "place" does not
  auto-highlight Place order. Ctrl+K fires with an Arabic `key` on `KeyK`. The drive runs in light,
  dark and RTL · flow (Playwright)

## Boundaries

- No new API endpoint.
- No new namespace. The console's row labels stay in its namespace.
- `features/callcenter` imports `@/core/commands` only, never `layout/`.
- The console still renders `chromeless` until 407.

## Done when

One palette serves the console. The terminal rows are safe, the console's own palette code is gone,
and the proof tests and drives are green.

## Blocked by

[393](393-a-key-is-a-field-on-a-command.md).
