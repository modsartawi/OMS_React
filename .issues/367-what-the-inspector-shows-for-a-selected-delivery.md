---
type: wayfinder-ticket
wayfinder: grilling
map: 358
status: done
blocked-by: 360
---

# 367 — What the inspector shows for a selected delivery

## Question

The prototype opens an **inspector** beside the grid for the selected delivery. Choose what it
shows:

- **Row fields only:** instant, no fetch.
- **The details read on each selection** (items, Log, Jobs): this depends on the cost found by
  [What the delivery reads give us](360-what-the-delivery-reads-give-us.md), and on debouncing
  while J/K steps through rows.

Also decide:

- **What belongs in the inspector** versus what is left to Delivery details.
- **Can it be closed or resized**, and does the grid get the width back?

## Answer

Grilled with the owner on 2026-10-02. Every call followed the recommendation except width, where
the owner chose **drag-resizable** over a fixed width.

**Facts the code settled before grilling:**

- The list row (`DeliveryDocumentModel`) already carries identity, the four status columns,
  customer, address, slot, courier and driver, money, the reschedule fields, the note and
  `failedJobsCount`.
- Only two things in the prototype's inspector need a second read: **Items · sample**, and the
  failed job's name and attempt count. Per
  [What the delivery reads give us](360-what-the-delivery-reads-give-us.md), `Delivery/{no}` costs
  10–12 DB trips, plus one per line, and runs pricing twice.
- Add note and Request cancellation post only `documentNo` + note (`buildUpdateHeader`).
  Reschedule reads `isUrgent` and `storeCode` from the header. All three dialogs live in the
  `document` feature, and the deliveries feature may not import it.
- The list is a one-shot search with no per-row refresh. A row acted on in place would go stale.

### 1. It reads the row, nothing else

- Selecting a row renders the inspector **from the row alone: no request, ever**. Stepping with
  J/K is free.
- The prototype's **Items · sample is dropped.** Items, Log and Jobs live on Delivery details.
- The **failed-jobs banner** comes from `failedJobsCount` only: *"N jobs failed"* plus the way to
  the full record. It never names the job or its attempts, which the row doesn't carry.
- No BackOffice "light summary read" is asked for. Nothing in the inspector needs one.

### 2. What it shows, and what it leaves to Delivery details

Shown, all from row fields:

| Section | Content |
|---|---|
| Header | Delivery no. (mono), order no. and document no. (mono), the status, tags (document type, delivery type, express) |
| Timeline | Per [How a delivery's state maps to timeline steps](369-how-a-deliverys-state-maps-to-timeline-steps.md), inspector variant. Times come from `entryTime` / `outForDeliveryTime` / `actualDeliveryTime` only. The rewind marker comes from `rescheduled` / `rescheduledTime`. The slot window is shown as an expectation for the next step. |
| Attention | The failed-jobs banner, when `failedJobsCount > 0` |
| Customer | Name, mobile, address (street, district, city) |
| Fulfilment | Store (+ not-active-in-store), slot day + window, rescheduled with reason / user / time, source, courier + driver |
| Money | Net total, paid, delivery fees, **amount due** (the due/paid tag's figure) |
| Note | The row's `note`, when present |
| Commands | Reschedule · Request cancellation · Add note, as deep-links (see 3), then **Open full record** (Enter) |

Left to Delivery details: items, the activity feed (Log + Jobs), any job detail and Retry
([Retry job: drop it or ask BackOffice](370-retry-job-drop-it-or-ask-backoffice.md)), and every
command that posts.

**`customerOtp` is never shown in the inspector.** It is a handover secret, and the inspector is
the always-on panel that would show it for every row stepped through. The existing grid column is
untouched. Delivery details doesn't show it either.

### 3. Read-only; R / C / N deep-link to Delivery details

- The inspector posts **nothing**. Its Reschedule, Request cancellation and Add note buttons, and
  the list's **R / C / N** keys, navigate to `/oms/delivery/:deliveryNo` with **one-shot router
  state** (`{ open: 'reschedule' | 'request-close' | 'add-note' }`).
- Delivery details opens that dialog **once**, after its header has loaded, **through its own
  command gate**. A disabled command, such as Request cancellation with a request already open,
  opens the page showing its reason rather than the dialog.
- Router state, not a URL param, so a refresh or a pasted link never pops a write dialog.
- Back returns to the list with the search, layout and selection restored (the existing R-8
  store).
- **Why:** commands keep one implementation, with spec 083's evidence-only gates and the
  supersede warnings from ticket 352. Nothing moves up from the `document` feature, and no list
  row is left stale by an act it can't see.
- The buttons stay **mouse-reachable** as well as keyed, per the prototype's own risk note.
  Whether R, C and N collide with anything is for
  [Keyboard shortcuts that work for everyone](365-keyboard-shortcuts-that-work-for-everyone.md).

### 4. Collapsible and drag-resizable; the grid takes the width back

- **Width:** default **360 px**, min **320**, max **560**, and never more than **40% of the
  viewport**.
- **The handle** sits on the inspector's **inline-start edge**, so it mirrors in RTL. It is a
  focusable `role="separator"` with `aria-valuenow/min/max`:
  - Arrow keys step 16 px.
  - Home/End jump to min/max.
  - Double-clicking resets to 360.
- **Collapse:** a toggle button plus a shortcut (the key is 365's to assign). Collapsed, the grid
  takes the **full width** back. Expanding restores the last width.
- **Remembered** per browser in `localStorage`: width + open/closed, parsed defensively (a
  malformed value reads as the default). It **opens by default**.
- **With no row selected** (no search yet, or zero results), the open inspector shows the empty
  prompt.

### Consequences for other tickets

- [The Deliveries list as one screen](368-the-deliveries-list-as-one-screen.md) arranges the
  inspector to this content and these bounds.
- [The Delivery details record page](371-the-delivery-details-record-page.md) must accept the
  one-shot `open` intent.
- **Build note for the spec:** the inspector and Details read **different models**
  (`DeliveryDocumentModel` vs `SdDocumentHeaderModel`). What they share is the **pure timeline
  derivation**, which moves up to `@/core` with an input both can feed, not a shared component.

**Recorded in `CONTEXT.md`:** **Delivery inspector**, kept apart from the IDoc Inspector screen.
