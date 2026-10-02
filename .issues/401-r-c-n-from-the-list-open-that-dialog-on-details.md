---
status: open
spec: 380
blocked-by: 400
---

# 401 — R/C/N from the list open that dialog on Delivery details, through its own gate

## What to build

The Delivery inspector's act rows and the list's **R / C / N** keys deep-link to Delivery details.
**Commands keep one implementation.**

**On the list side:**

- The inspector shows three rows with key caps: **Reschedule R**, **Request cancellation C** and
  **Add note N**, followed by **Open full record ↵**.
- Each row, and its key, navigates to `/oms/delivery/:deliveryNo` with **one-shot router state**
  `{ open: 'reschedule' | 'request-close' | 'add-note' }`.
- The keys are registered commands behind the single-key switch. **A letter is bound only if the
  list offers that act.** They never write.

**On the Details side:**

- The intent is consumed **once, after the header loads, through the existing command gate**.
  `reschedule` and `request-close` open their real dialogs.
- **Until 405's composer exists, `add-note` opens today's Add note path.**
- **A refused intent opens nothing.** For example, C when a cancellation request is already open.
  Instead:
  - the disabled button gets an **attention ring**;
  - its reason shows as a tooltip;
  - a **warn toast** repeats the reason.
- **The router state is replaced away on consumption.** A reload or Back never re-fires it, and a
  pasted link never pops a write dialog.

**Finishing the list screen:**

- **The status bar:** "N deliveries · 1 selected", the key hints (J K move · ↵ open · R C N act ·
  / search · ? keys · I inspector) and "Drag over text, Ctrl C copies". The hints hide when the
  switch is off.
- **The empty states overlay a still-mounted grid:** "No search yet — pick a view, or set criteria
  and Search", "No deliveries match this search", and the lens empty state from 398.
- **The grid columns:**
  - **Delivery no.** is pinned with `pinStart`, in mono 600, and the other IDs are mono;
  - **Failed jobs** is a danger count pill, or a muted "—" at 0;
  - the floating filters stay;
  - `enableCellTextSelection` + `ensureDomOrder` are kept.

**Implements:** spec 380 **L10** (the columns), **L11, L14**, the R/C/N part of **L16**, and **D9**.

**Rulings:** [367](367-what-the-inspector-shows-for-a-selected-delivery.md) §3,
[365](365-keyboard-shortcuts-that-work-for-everyone.md) §4 and §5,
[368](368-the-deliveries-list-as-one-screen.md) §1 (the status bar, empty states, grid), and
[371](371-the-delivery-details-record-page.md) (the one-shot `open` intent, proven in the
prototype). Prototypes: `prototype/368-deliveries-list` (`9b7f32c`, variant A) and
`prototype/371-delivery-details` (`bf0754d`, variant D).

## Spine reach

store/logic (a pure intent resolver: `(intent, command gate) → open | focus | refuse(reason)`) ·
component/route (the inspector act rows and R/C/N in `deliveries`; consumption in the `document`
feature's Details page; the status bar and empty states) · i18n (`deliveries:inspector.act.*`,
`deliveries:statusBar.*`, `deliveries:empty.*`; the refused-intent toast reuses the button's reason)
· test

## Proof (→ `tdd` red-green cycles)

- [ ] `intentResolvesThroughCommandGate`: an allowed `reschedule` resolves to open. A
  `request-close` with a request already open resolves to refuse carrying that command's reason.
  An unknown intent resolves to nothing · pure
- [ ] `tools/deliveries-list-drive.mjs` + `tools/document-actions-drive.mjs`, extended:
  - R on a row opens Reschedule on Details.
  - C on `8000000174` (request open) shows the ring, the tooltip and the warn toast, with no dialog.
  - Reload and Back do not re-open the dialog.
  - The inspector buttons do the same with the mouse.
  - The status bar and empty states read correctly over a mounted grid.

  The drive runs in light, dark and RTL · flow (Playwright)

## Boundaries

- No new API endpoint. Nothing posts from the list.
- **Spans two features:** `deliveries` (the sender) and `document` (the consumer). They share only
  the route and the router-state shape. Neither imports the other, so the intent type lives in
  `@/core`.
- New `deliveries:*` keys as listed.

## Done when

R/C/N and the inspector rows open the right dialog on Details through its own gate, never re-fire,
and say why when refused. The list's status bar and empty states are in. The proof test and the
drives are green.

## Blocked by

[400](400-an-operator-saves-defaults-and-manages-their-own-views.md).
