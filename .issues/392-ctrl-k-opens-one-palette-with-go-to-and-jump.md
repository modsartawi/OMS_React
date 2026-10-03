---
status: done
spec: 380
blocked-by: 391
---

# 392 — Ctrl+K opens one palette with Go to and Jump to number on every screen

## What to build

This is the first ticket of S2, the keyboard layer, and its Slice 0. Pressing **Ctrl+K** on any
signed-in screen opens **one app-wide command palette**.

- **Groups.** With an empty box the order is **This screen → Go to**. Typing a number adds the
  **Jump to number** rows *Open delivery N* and *Open document N*. These navigate straight to the
  existing `oms/delivery/:deliveryNo` and `oms/document/:documentNo` routes with no read, and the
  destination page answers not-found or denied.
- **Gating.**
  - Go to reads the **same `useVisibleMenu` result** the rail draws.
  - Jump to number shows only when `canOpenDetail` holds.
  - **Pending or errored probes fail closed.**
- **This screen** is fed by pages through `useCommands([...])`, which registers while the page is
  mounted and unregisters on unmount. Enablement is the handler being present. A command the page
  would refuse right now is a **greyed row carrying its reason**, and Enter on it does nothing.
- **Where it lives.**
  - The palette UI and a **command registry** live in a new `@/core/commands`. The UI graduates
    from `features/callcenter/console/CommandPalette.tsx` and `highlight.ts`, which **stay in place
    for the console until 395**.
  - `layout/` composes the app-wide groups.
  - The palette is hosted at **`ProtectedLayout`**.
- **Opt-out.** **Print routes opt out** through an explicit route flag (for example
  `handle.print`), never through `chromeless`. **`/callcenter` opts out through the same mechanism**
  until 395 moves the console onto the core palette, so a screen never has two Ctrl+K handlers.
- **Carried over from the console:** each open starts with an empty box, the chosen act runs after
  the palette closes, focus returns where it came from, and Ctrl+K is `preventDefault`ed and inert
  while any `dialog[open]` exists.
- **Ctrl+K matches on `event.code` (`KeyK`)**, so it works on an Arabic layout. Meta counts as
  Ctrl.
- **The top bar's centred palette field** (F11, held back from S1) appears in this ticket and opens
  the palette on click.
- **Live search is not in S2** (376). Recent is 394, keys and the help sheet are 393, and the
  `terminal` flag arrives with 395.

**Implements:** spec 380 **K1, K2** (without `keys`), **K7, K8, K10–K13, K18**, and the
palette-field half of F11.

**Rulings:** [364](364-what-the-command-palette-holds.md) §1–§4 and [375](375-printed-output-under-the-ops-console-tokens.md)
R4. The firing guard for Ctrl+K is in [365](365-keyboard-shortcuts-that-work-for-everyone.md) §3.

## Spine reach

store/logic (`@/core/commands` registry and palette composition, pure) · component/route
(palette dialog at `ProtectedLayout`, top-bar field, route flag on print and console routes) ·
i18n (`common:palette.*`) · test

## Proof (→ `tdd` red-green cycles)

- [x] `paletteGroupsComposeInOrderAndFailClosed`: given the registered commands, the visible menu
  and the probe states (granted, denied, pending, errored), the composed groups come out in the
  order This screen → Go to → Jump. The Jump rows appear only for a numeric term and only with
  `canOpenDetail` granted. A pending or errored probe hides its group · pure
- [x] `disabledCommandCarriesItsReason`: a registered command without a handler composes as a
  disabled row carrying its reason, and choosing it is a no-op · pure
- [x] `ctrlKMatchesOnCodeNotKey`: the chord matcher accepts `{code:'KeyK', ctrlKey:true}` whatever
  `key` is (including an Arabic character), and accepts Meta as Ctrl · pure
- [x] `tools/command-palette-drive.mjs`, extended. Ctrl+K opens the palette from a text box and from
  a grid cell. It is inert while a dialog is open. It is absent on `/collection/receipt/:id`. On
  `/callcenter`, only the console's own palette opens. Go to navigates. *Open delivery 8000000174*
  lands on Details. The drive runs in light, dark and RTL · flow (Playwright)

## Boundaries

- No new API endpoint.
- New `@/core/commands` module. The palette UI is shared, so it may not import any feature.
- New keys under `common:palette.*` for the group names, the Jump rows and the empty state.
- The console keeps its own palette and its own Ctrl+K until 395.
- No React Testing Library.

## Done when

Ctrl+K opens the core palette on every signed-in screen except print routes and `/callcenter`.
Go to and Jump to number work and are gated fail-closed. The proof tests and the drive are green.

## Blocked by

[391](391-the-other-screens-hold-under-the-foundation.md) (S1 ships first, per 361).

## Comments

**Done 2026-10-03 (AFK).**

**What was built:**
- **`@/core/commands`** (new, imports no feature):
  - `palette-model.ts`: `Command`, `PaletteRow` and `commandRow`. A command with no handler becomes a disabled row carrying its reason.
  - `composePalette`: This screen → Go to → Jump. An emptied group drops out, and the Jump rows are not filtered by the query that made them.
  - `jumpNumberOf`: wholly digits, with Arabic-Indic and Persian digits folded to ASCII.
  - The aim and `Enter`, graduated from 192.
  - `paletteOptedOut` over route `handle`s.
  - `chord.ts`: `isPaletteChord` on `event.code === 'KeyK'`, with Meta counted as Ctrl and no Alt or Shift. `paletteChordAction` returns open, inert or ignore. `keyLegend`.
  - `registry.ts`: `useCommands` / `useRegisteredCommands` (zustand). A page's commands are replaced in place on each render and removed on unmount.
  - `palette-store.ts`: open state, the focus to return to, and `usePaletteHost`, the one Ctrl+K listener. It always prevents the default, and is inert under `dialog[open]` or an `aria-modal` dialog.
  - `CommandPalette.tsx`: a native `<dialog>` on the overlay card recipe, grouped listbox, `--cursor` bar on the aimed row, `Ltr` around Jump numbers and the arrow hints.
  - `highlight.ts` is copied from the console. The console's own palette and `highlight.ts` stay until 395.
- **`layout/`:**
  - `palette-groups.ts` builds Go to from `useVisibleMenu(MENU).items`, the very result the rail draws. It builds Jump from `canOpenDetail` on the shared OMS probe, failing closed on pending, errored or malformed.
  - `CommandPaletteHost.tsx` composes the groups. It reads through the new `omsAccessQuery()` in `@/core/oms/api`, with the same key and options as the menu leaf, so the palette costs no request of its own.
- **Hosting:** `ProtectedLayout` mounts the host on every signed-in route unless a matched route opts out. `router.tsx` gives the two print routes `handle: { print: true }` and `/callcenter` `handle: { ownPalette: true }` (until 395).
- **F11:** the top bar's centred palette field (`TopBar.tsx`) opens the palette on click. Its `Ctrl` + gold `K` hint is isolated as one unit. It renders only while a host is mounted.
- **i18n:** `common:palette.*` (title, field, placeholder, empty, groups, Jump rows, foot) and `common:keys.{ctrl,enter,esc}`.
- **`core/ui/Kbd.tsx`** draws the key caps.

**Proof:**
- **Pure tests:**
  - `layout/palette-groups.test.ts`, including `paletteGroupsComposeInOrderAndFailClosed` (granted / denied / pending / errored / malformed for both the menu probes and the detail grant).
  - `core/commands/palette-model.test.ts`, including `disabledCommandCarriesItsReason`, plus Jump parsing and the print/console opt-out.
  - `chord.test.ts`, including `ctrlKMatchesOnCodeNotKey` (an Arabic `key` with code `KeyK`, and Meta).
  - `registry.test.ts` and `highlight.test.ts`.
- **Drive:** `tools/command-palette-drive.mjs` was extended and runs **122/122** (the console's 49 untouched). It ran on a stubbed network, port 5280, in light, dark and RTL. It checks:
  - Ctrl+K from a text box and from a grid cell, with focus returned to each, and from an Arabic-layout key event.
  - The field opening the palette.
  - "Ctrl K" reading left to right under RTL.
  - Go to holding the rail's leaves and navigating.
  - *Open delivery 8000000174* landing on Details (crumb record), with the number isolated LTR.
  - Inert over the Add Note… dialog and over the hand-drawn Save view dialog.
  - Jump hidden while the detail grant is denied, errored, or pending (then appearing when it confirms).
  - Ctrl+K absent and no field on `/collection/receipt/:id`.
  - On `/callcenter`, only the console's own palette (one dialog).
  - Captures in `tools/.palette-core-shots/` (gitignored).
- **Gates:** typecheck clean; `npm test` 177 files / 3233 tests; lint all four gates (745 files, 22 grid mounts, 148 contrast pairs, 750 files); build green.

**Reviews:**
- `/code-review` (medium) found two low-severity bugs, both fixed:
  - Ctrl+K opened over hand-drawn `aria-modal` dialogs.
  - A drag-select that ended on the backdrop closed the palette and lost the query.
- `/standards-review` found no hard violation on either axis. Applied:
  - a shared `omsAccessQuery()` for the host;
  - the grant read as `OmsAccessResult`;
  - the redundant `useCallback` dropped.

  Left as judgement calls:
  - `PaletteRow.enabled` beside `run`, which keeps 192's model;
  - the per-site OMS query options in the two OMS pages and the menu, which are untouched;
  - `group`/`hidden` deferred (HITL);
  - bubble-phase listener (HITL).

**Not here, by design:**
- Recent (394), `keys` + help sheet (393), `terminal` + the console's migration (395), live search (411).
- No page registers a command yet, so This screen and the greyed row are proven by pure tests only. 393, 400 and 406 bring the first registrations.

**Outstanding (owner, not AFK):**
- The S2 live sign-off at 395.
- A human eye on Arabic rendering.

8 decisions are in `.afk/HITL-392.md`.
