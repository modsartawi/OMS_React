---
status: done
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

- [x] `terminalRowsSortLastAndNeverAutoHighlight`: with a terminal row matching best, the
  highlighted index is still the first non-terminal row, and terminal rows render last · pure
- [x] `registryRefusesKeysOnTerminalCommand`: registering `{ terminal: true, keys: 'Ctrl+Enter' }`
  is a dev error · pure
- [x] `palette-model.test.ts`, kept green: the console's rows, labels, disabled reasons and order are
  unchanged as a `useCommands` registration · pure
- [x] `tools/callcenter-drive.mjs` and `tools/command-palette-drive.mjs`, extended. On `/callcenter`,
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

## Comments

**Built 2026-10-03 (AFK).**

- **Core: `terminal` (K2, K3, K14).** `Command.terminal` and `PaletteRow.terminal`. `composePalette`
  lifts This screen's terminal rows out of it and lists them **last in the whole palette**, after
  Go to and Jump, in a trailing heading-less `terminal` group set apart by a rule. A screen reader
  still hears it as This screen. `paletteAim` rests on the first non-terminal row, or on nothing,
  so a query matching only terminals aims at nothing and reaching one costs a deliberate `↓`.
  `bindKeys` refuses `keys` on a terminal command (`KeyRefusal` `terminal`, before any collision
  check), so the dev error is raised through 393's `reportRefusals`.
- **Core: `detail`.** An optional `Command.detail` / `PaletteRow.detail` holds server free text.
  It renders in a `<bdi>` beside the label and the typed words match it, so an offer is still
  found by the server's own words (192). Logged in HITL.
- **Console registration (K19).** `features/callcenter/console/palette-model.ts` is now
  `paletteCommands(input): Command[]`. The rows, order (offers → verbs → *Place order*,
  *Abandon call*), handlers and reasons are 192's. The keys are re-pointed as `callcenter:…`. A
  server-named reason with no words falls back to its family's general sentence through an
  injected `known` (`i18n.exists`). `ConsoleShell` calls `useCommands(paletteCommands(…))`. No
  console command carries `keys`, so 153 stands whole: Ctrl+K, ↓/↑, Enter, Esc. `?` is not bound
  (`/callcenter` is not a `singleKeys` route), and the sheet is reached by its palette row.
- **Removed.** The console's `CommandPalette.tsx`, its `highlight.ts` + test copy (`ItemSearchPanel`
  and `AddressForm` now read `@/core/commands/highlight`), the `usePalette` Ctrl+K listener (it
  matched `event.key`), `/callcenter`'s `ownPalette` route flag and `PaletteRouteHandle.ownPalette`,
  and the dead `callcenter:palette.title/placeholder/empty/foot.*` keys. The core palette's own
  copy serves now.
- **Carried over** through the core palette with no change needed: each open starts empty, the
  act runs after the palette closes, focus returns, and it is inert under a dialog.
- **Proof.** The two core pure cases live in `src/core/commands/palette-model.test.ts` and
  `keys.test.ts`. `features/callcenter/console/palette-model.test.ts` is rewritten to assert the
  registration THROUGH the core path (`screenRows` → `composePalette` → `paletteAim`/`paletteRun`):
  the same rows, labels, reasons and order, plus a new `153StandsWhole` block. `npm test`
  182 files / 3309 tests. Typecheck, lint (all four gates) and build are green. Drives, network
  stubbed at Playwright:
  - `command-palette-drive` **366/366**. Its console section now runs on the core palette in light,
    dark and RTL, and the old "only the console's own palette" check is inverted.
  - `callcenter-drive` **528/529**. New block 44 passes in all three modes. The one failure is
    pre-existing block 4 ("the granted agent sees the Call center leaf"), which reads nav button
    text on `/`. That text has been gone since 385's icon-only rail; this slice touches no
    layout code.
  - `store-choice-drive` **11/11**, its palette selectors re-pointed.
  - The Arabic-layout Ctrl+K is a dispatched `keydown` (`key: 'ن'`, `code: 'KeyK'`), the same
    technique 392's drive uses.
- **Reviews.** `/code-review` found no bugs. `/standards-review` found no hard violation on either
  axis. Applied from it: the terminal group's accessible name, sweeping terminals from This screen
  only, and a stale `highlight.ts` header. Not applied: the drives overlap (the ticket asks for
  both to be extended), and `useCommands` is called from `ConsoleShell` rather than the Page (the
  shell holds every handler).
- **Open for the owner** (`.afk/HITL-395.md`): terminal rows sort last in the whole palette, below
  Go to, not last within This screen. That follows "terminal rows render last" and 192's
  list-final terminals. K8's "This screen → Recent → Go to" still holds for every non-terminal row.

