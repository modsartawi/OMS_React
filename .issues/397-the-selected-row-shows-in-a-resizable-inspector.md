---
status: open
spec: 380
blocked-by: 396
---

# 397 — The selected delivery shows in a resizable inspector without a server read

## What to build

The Deliveries list gains the **Delivery inspector** at its inline-end edge. It renders the current
row **from the row alone**. There is **no request, ever**, so stepping is free.

**Content, in 367's order:**

- **Header:** the delivery no. in mono 18px, the order and document nos in mono, the status dot,
  and the tags. The tags are document type, delivery type, **Dawaa Now as a gold fill with navy
  ink**, and the **due/paid tag** (from 396).
- **The timeline**, inspector variant (396). The next step shows the slot window as an
  *expectation*.
- **The failed-jobs banner** when `failedJobsCount > 0` ("N jobs failed"). It never names a job.
- **Customer:** name, mobile and address.
- **Fulfilment:** store (+ not-active-in-store), slot day + window, rescheduled with reason / user /
  time, source, courier + driver.
- **Money · SAR:** net, paid, fees, and a ruled **Amount due**.
- **Note.**
- **Open full record ↵.** The Reschedule, Request cancellation and Add note rows are 401's.
- **`customerOtp` is never shown.**

**Selection follows focus.** Arrows and **J/K** (hidden registered commands, which repeat while
held) move **one current row**, and the inspector follows it. **Enter** opens Delivery details. It
is wired on the grid's **`onCellKeyDown`**, because AG Grid prevents Enter on a cell, and it is
ignored on a button or link. A double-click also opens Details.

**Width:**

- Default **360px**, min **320**, max **560**, and never more than **40% of the viewport**.
- The handle sits on the inspector's **inline-start edge**. It is a focusable `role="separator"`
  with `aria-valuenow/min/max`: arrows step 16px, Home/End jump to min/max, and a double-click
  resets to 360.
- **Collapse** by a chevron at its top, by the grid bar's Inspector toggle, or by **`I`** (`KeyI`,
  list only, behind the single-key switch). Collapsed, the grid takes the full width.
- Width and open/closed are remembered in `localStorage`, parsed defensively. It **opens by
  default**.
- With no row (no search yet, or zero results), the open inspector shows its empty prompt.

**RTL:** the slot ("02 Oct 2026 · 10:00 - 12:00") and the courier line ("JAH · Khalid N.") are each
formatted to one string and isolated once (384's helpers).

**Implements:** spec 380 **L6** (the inspector pane), **L13, L15, L18**, and the J/K/Enter/`I` part
of **L16**.

**Rulings:** [367](367-what-the-inspector-shows-for-a-selected-delivery.md) §1, §2 and §4,
[365](365-keyboard-shortcuts-that-work-for-everyone.md) §5,
[368](368-the-deliveries-list-as-one-screen.md) §1 (the inspector), §4 (`I`) and the Enter finding,
and [378](378-the-foundation-in-arabic-rtl.md) §3. Prototype: branch
`prototype/368-deliveries-list` (`9b7f32c`), variant A.

## Spine reach

store/logic (a pure width clamp and parse; the selection-follows-focus row index) · component/route
(the inspector pane, separator and collapse in `DeliveriesPage`; J/K/`I` via `useCommands`) · i18n
(`deliveries:inspector.*`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `inspectorWidthClampsAndParses`: 360 by default. Values are clamped to 320–560 and to 40% of
  the viewport. Arrow/Home/End steps work. A malformed stored value reads as the default, open
  · pure
- [ ] `inspectorSectionsFromRowOnly`: given a `DeliveryDocumentModel`, the section view-model holds
  the listed fields, a banner only when `failedJobsCount > 0`, and never `customerOtp` · pure
- [ ] `tools/deliveries-list-drive.mjs`. J/K and ↓/↑ move the current row, and the inspector follows
  with **no network request** (asserted on the request log). Enter opens Details. `I` collapses and
  expands. Dragging and the keyboard resize the separator, and the width survives a reload. The
  slot and courier read correctly under RTL. The drive runs in light, dark and RTL · flow
  (Playwright)

## Boundaries

- No new API endpoint.
- New `deliveries:inspector.*` keys.
- The `deliveries` feature reads the shared timeline from `@/core` and does not import `document`.

## Done when

The inspector shows the selected row with no request, resizes, collapses and is remembered. J/K,
Enter and `I` work, and the proof tests and the drive are green.

## Blocked by

[396](396-each-delivery-row-shows-its-derived-status.md).
