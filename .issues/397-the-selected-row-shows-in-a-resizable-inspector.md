---
status: done
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

- [x] `inspectorWidthClampsAndParses`: 360 by default. Values are clamped to 320–560 and to 40% of
  the viewport. Arrow/Home/End steps work. A malformed stored value reads as the default, open
  · pure
- [x] `inspectorSectionsFromRowOnly`: given a `DeliveryDocumentModel`, the section view-model holds
  the listed fields, a banner only when `failedJobsCount > 0`, and never `customerOtp` · pure
- [x] `tools/deliveries-list-drive.mjs`. J/K and ↓/↑ move the current row, and the inspector follows
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

## Comments

**Built 2026-10-03 (AFK).** Judgement calls are in `.afk/HITL-397.md`.

- **`@/core/oms/delivery-window.ts`:** `deliveryWindow()` moved here unchanged from
  `document/fields.ts`, because the list is its second reader. It takes the four schedule fields
  both models carry. It also exports `hasScheduledWindow` (From < To, both real) and
  `slotDayAndWindow` (`02 Oct 2026 · 10:00–12:00`, else the slot's own day · text).
- **The timeline (D1):** `TimelineInput.slotWindow` comes from `deliveryWindow()` in both mappers.
  `timeline()` puts it on the `next` step only, as `expectedWindow`, so a live capture with
  From == To falls back to the slot and never shows a zero-length window.
- **`deliveries/inspector-model.ts`:** `inspectorView(row)` builds the sections from the row
  alone, in 367's order:
  - the header (numbers, status, document and delivery type, Dawaa Now, due tag);
  - the steps;
  - `failedJobs` (`null` at 0);
  - customer;
  - fulfilment: store, not active, slot, rescheduled (reason, then time · user), source, courier;
  - money and the note;
  - `openTo`.

  `customerOtp` is never read. The slot and the courier are `IsolatedValue`s (`{ text, machine }`),
  so the pane isolates each once by kind: `Ltr` for a schedule window or a code-led courier, and
  `<bdi>` for the slot's free-text fallback or a driver with no code.
- **`deliveries/inspector-pane.ts`:**
  - Width is 360 by default, 320–560, and capped at 40% of the viewport. The 320 floor wins
    below 800px (logged).
  - The separator keys: the arrow toward the inline start grows the pane, Home/End jump to
    min/max.
  - The prefs are parsed defensively, field by field, and stored as `oms.deliveries.inspector.v1`.
  - `nextRowIndex` holds the J/K step. It stops at the ends and does not wrap.
  - The key constants live here too.
- **`DeliveryInspector.tsx`:** the pane is sticky and full height on the inline-end edge, under
  the top bar.
  - The `role="separator"` handle sits on its inline-start edge, with `aria-valuenow/min/max`,
    a drag, the keys, and a double-click that resets to 360.
  - A chevron collapses it.
  - The timeline is the inspector variant: dots per state, Cancellation requested in indigo,
    milestone times in `Ltr`, the expectation through a `<Trans>` slot, and the amber rewind
    marker.
  - The failed-jobs banner reads "N jobs failed" (plural, the count in a `<Trans>` slot).
  - With no row it shows the empty prompt. The J/K caps there come from `legendText` and hide
    while the single-key switch is off.
- **`DeliveriesPage`:**
  - Selection follows focus (`onCellFocused`).
  - Enter on `onCellKeyDown` opens the record, but not with a modifier, while composing, or on a
    button or link. A double-click opens it too.
  - `useCommands` registers J/K (hidden, repeat while held, refused with a reason before a
    search) and `I` (a Hide/Show the Delivery inspector palette row). A denied session registers
    nothing.
  - A search now also clears the grid's own selection, so a failed re-search never shows a
    highlighted row beside an empty inspector.
  - `InspectorToggle` sits in `GridToolbar.tsx`, shown always at the inline end of the results
    header (tooltip "Inspector (I)", `aria-keyshortcuts`, `aria-pressed`).
- **A core fix (`layout/CommandPaletteHost.tsx`):** the refusal effect now reads `registeredNow()`.
  Before, leaving the list reported its J/K/I as refused `single-key-screen` against the next
  route, which made `foundation-drive.mjs` fail "no page errors" 12 times. This is a race in
  393's host that only showed once a single-key screen registered keys.
- `STATUS_TONE` moved to `status-tone.ts`, shared by `StatusCell` and the inspector's header.

**Proof:**
- `inspector-pane.test.ts` (`inspectorWidthClampsAndParses` and `selectionFollowsFocusRowIndex`,
  18 cases) and `inspector-model.test.ts` (`inspectorSectionsFromRowOnly`, 12 cases). Plus 5 new
  `nextStepExpectation` cases in `timeline.test.ts`. `fields.test.ts` still pins
  `deliveryWindow()`, now imported from core.
- `tools/deliveries-list-drive.mjs` is extended and runs **106/106** in light/ltr, light/rtl,
  dark/ltr and dark/rtl, with the network stubbed at Playwright. Per pass it checks:
  - the empty prompt at 360 before a search;
  - J, ↓, K, ↑, J from outside the grid, J on an Arabic layout and J held each move one current
    row, and the inspector follows;
  - the request log is **empty** while stepping;
  - the header (mono 18px, gold-on-navy Dawaa Now, Due 72.50);
  - the timeline expectation and the marker;
  - fulfilment, money and note, with the OTP absent and the reschedule lines at the inline start;
  - the slot and courier as one ltr isolate each, read in order, including an Arabic driver name
    under RTL;
  - the banner only on the failed row, and the indigo requested step;
  - Enter opens Details and Back restores the current row;
  - a double-click opens Details, and Enter on a button stays the button's;
  - `I`, the chevron and the toggle fold and unfold the pane, and the grid takes the width back;
  - the separator on the inline-start edge: arrows ±16, Home/End, double-click, a drag;
  - width and folded state survive a reload, and a malformed store reads 360, open;
  - J before a search toasts its reason.
- **Other drives:**
  - `command-palette-drive.mjs` **366/366**. Its sheet check now expects This screen's J, K
    and I.
  - `grid-theme-drive.mjs` **125/125**.
  - `foundation-drive.mjs` **1294/1302**. That is the baseline: the 8 known failures recorded at
    393 (the stale topbar check and the bell's wall-clock drift).
- **Gates:** typecheck clean. `npm test` 185 files / 3374 tests. Lint: 4 gates clean (767 files,
  22 grid mounts, 150 contrast pairs, 772 files). Build green.

**Reviews:**
- `/code-review` (medium) found 2 issues, both fixed:
  - A failed re-search left the grid highlighting a row beside an empty inspector. Fixed with
    `deselectAll` when a search starts.
  - The slot's free-text fallback was forced ltr. Fixed by isolating by kind.
- `/standards-review` found 1 hard violation, fixed: the empty prompt's sentence was built from
  JSX pieces and is now one `<Trans>` with a `<keys/>` slot.
- I applied these too:
  - a driver name with no code is isolated as free text;
  - `expect`/`window` renamed to `expectedWindow`/`slotWindow`;
  - the key constants moved to `inspector-pane.ts`;
  - the glossary copy ("the Delivery inspector");
  - the reschedule pair now leads with its time.
- Not taken:
  - the leftover `text()` duplicates;
  - `documentType` and `source` stay `<bdi>`, because the list sends descriptions (see
    `columns.ts`).

**Left for the owner (logged in HITL):**
- the 320 floor vs the 40% cap below 800px;
- the toggle's interim place until 398/399's grid bar;
- the banner's "way to the full record" is its hint plus the pane's Open full record button,
  not a link inside the banner;
- the separator binds ←/→, not ↑/↓;
- Enter on a row with no delivery no. does nothing.

S3's owner sign-off (401) and a human eye on real Arabic data remain the owner's.
