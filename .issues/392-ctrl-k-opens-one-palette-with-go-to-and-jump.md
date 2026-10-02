---
status: open
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

- [ ] `paletteGroupsComposeInOrderAndFailClosed`: given the registered commands, the visible menu
  and the probe states (granted, denied, pending, errored), the composed groups come out in the
  order This screen → Go to → Jump. The Jump rows appear only for a numeric term and only with
  `canOpenDetail` granted. A pending or errored probe hides its group · pure
- [ ] `disabledCommandCarriesItsReason`: a registered command without a handler composes as a
  disabled row carrying its reason, and choosing it is a no-op · pure
- [ ] `ctrlKMatchesOnCodeNotKey`: the chord matcher accepts `{code:'KeyK', ctrlKey:true}` whatever
  `key` is (including an Arabic character), and accepts Meta as Ctrl · pure
- [ ] `tools/command-palette-drive.mjs`, extended. Ctrl+K opens the palette from a text box and from
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
