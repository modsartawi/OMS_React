---
type: wayfinder-ticket
wayfinder: grilling
map: 358
status: done
blocked-by: —
---

# 369 — How a delivery's state maps to timeline steps

## Question

The prototype's record page shows a **step timeline** for a delivery. Which steps are they?

- **Which states and job outcomes** exist, in what order, and which ones end the timeline?
- **How do these appear on it:** cancellation, a cancellation request, a failed job, a retried job?
- **Where does each step's time come from?**

This is a domain rule. Use `/domain-modeling` and record the words in `CONTEXT.md`.

## Answer

Grilled with the owner on 2026-10-02. All four calls followed the recommendation. The evidence
(status codes, the actions that write them, and time sources, from SIS.Oms source) is in
[369-delivery-state-sources.md](assets/369-delivery-state-sources.md).

**1. The steps are the backend's lifecycle, not the prototype's five.**

- A delivery shows **Created → Ready → Out for delivery → Delivered**.
- A pick-in-store delivery (`deliveryType 'P'`) shows **Created → Ready → Delivered**. It is the
  same state machine with the same ending (`DDLR`), and there is no "collected" state.
- A step is **reached** from the current status columns, not from the log:

  | Step | Reached when |
  |---|---|
  | Created | always |
  | Ready | `readyStatus` is R or C |
  | Out for delivery | `deliveryStatus` is O |
  | Delivered | `deliveryStatus` is D |

  Delivered completes the timeline.
- **Payment is not a step.**
  - `PaymentStatus` lives on the order header only, and no partially-paid code exists.
  - Cash on delivery pays *at the door*, after Out for delivery. A "Paid" step would sit unpaid in
    the middle of a delivery that is moving normally.
  - The record header carries a **due/paid tag** instead: `Due 72.50` while `amountDue > 0`, and
    `Paid` when it is 0. The prototype's "Part paid" step is dropped.

**2. A cancellation replaces the next step.**

- The steps already reached stay done. The step where the delivery stopped becomes:
  - **Cancellation requested** (amber) when `closeStatus` is R.
  - **Cancelled** (red) when `closeStatus` is C, N or X. That covers Close (`DCLS`, usually the
    `AutoClose` worker), Force close (`DFCL`), Close not invoiced (`DCNI`) and Cancelled after
    delivery (`DCAD`).
- The steps after it are **dropped, not greyed**: a cancelled delivery is not "still heading for
  Delivered".
- *Cancellation requested* is drawn as **final, never pending-reversible**. The server refuses
  withdrawal (`CloseRequestIsFinal.cs`), and the owner retired Withdraw Request on 2026-09-25
  (BackOffice 2022).
- *Cancelled after delivery* (`X`) follows the same rule. Its timeline reads
  Created → Ready → Out → **Cancelled**: the delivery happened, but the cancellation is the fact
  that stands.

**3. A rewind shows the current position plus a marker; the full path lives in the feed.**

- The timeline is drawn from **where the delivery is now**. When an action has moved it backwards,
  the step it fell back to carries a **marker**:
  - *Returned by driver · needs reschedule*: `DRBK` (delivery status B, ready status S).
  - *Rescheduled*: `DRSC`, which clears the ready and delivery statuses.
  - *Courier changed*: `DCHC`, which also clears them.
- The marker also needs the action's time, so it is shown only where the Log or row data can say
  what happened.
- Every pass back and forth is **not** replayed on the timeline. That history belongs to the
  activity feed (Log + Jobs) that
  [The Delivery details record page](371-the-delivery-details-record-page.md) arranges.
- On the inspector (row data only, no fetch) the rewind marker comes from `rescheduled` /
  `rescheduledTime` on the row.

**4. Times come from the Log now, with a BackOffice ask to replace that.**

- **On Delivery details,** a step's time is the `entryTime` of the **latest Log row whose
  `actionType` reached it**:

  | Step | Log action types |
  |---|---|
  | Created | `DCRT` |
  | Ready | `DRDY` / `DTXC` |
  | Out for delivery | `DOFD` |
  | Delivered | `DDLR` |
  | Cancellation requested | `DRCL` |
  | Cancelled | `DCLS` / `DFCL` / `DCNI` / `DCAD` |

  A step reached with no matching log row shows **no time**, never a guess.
- **On the inspector** (no details fetch, per
  [What the delivery reads give us](360-what-the-delivery-reads-give-us.md)), only the row's fields
  can be used:
  - Created ← `entryTime`
  - Out for delivery ← `outForDeliveryTime`
  - Delivered ← `actualDeliveryTime`

  Every other step shows no time.
- The next step, when it isn't reached yet, may show the **slot window** (`deliveryScheduleFrom/ToTime`)
  as an expectation, styled as an expectation and never as a timestamp.
- **These are never time sources:**
  - `statusHistory`: its row time is hard-coded to `MaxValue`.
  - `DeliveryDateTime` and `EstimateDeliveryTime`: never assigned, or `0001-01-01`.
  - `changedOn`: it moves on every action.
- **BackOffice ask, carried into the spec:** expose `SdDocumentHeaderAction`'s milestone times
  (Ready, OutForDelivery, Delivered, CloseRequested, Closed, ReturnedBack, Rescheduled) on
  `SdDocumentHeaderModel` and `DeliveryDocumentModel`. When they land, they replace the Log
  derivation on both surfaces. The timeline does not block on them.

**5. A failed job is not a step** (the default, which the owner did not object to).

- Outbox jobs are side effects (courier, shop-system, SMS and SGH pushes). A job with status `F` is
  terminal after 5 attempts.
- It renders as an **attention banner beside the timeline**, as in the prototype. It never colours
  or blocks a step.
- What the banner offers is decided in
  [Retry job: drop it or ask BackOffice](370-retry-job-drop-it-or-ask-backoffice.md).

**Recorded in `CONTEXT.md`:** **Delivery timeline**, **Reached** (step), **Rewind** and
**Milestone time**. The **Close** entry is corrected too: *cancel close request* is retired and
refused by the server, so a cancellation request is final.

**Amended 2026-10-02 by [The Deliveries list as one screen](368-the-deliveries-list-as-one-screen.md):**
*Cancellation requested* is drawn **indigo** (082's `--fam-cancel-request`, the same as its command),
not amber. Amber stays reserved for attention. The rule above (final, replaces the next step) is
unchanged.
