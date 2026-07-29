---
type: spec
status: ready
---

# 193 — The caller's open request becomes this order (spec)

> **Phase 3 of the client track of map [126](126-web-call-center.md).** Server half is BackOffice
> [880](C:\Work\DMSCO\BackOffice\.issues\880-cc-linked-sales-request.md), contract **v1.11**.
> Settled by owner grilling 2026-07-29/30; the nine decisions are recorded at the point each governs.

## Problem

A pharmacist standing with a customer raises a **sales request** (category `'Q'` / SREQ) — the
customer wants an item the store cannot sell them right now, or has paid through Tamara and will
collect. The request is unpriced and open, and something has to turn it into a real order.

WPF does this and the web console cannot. `NewOrderController.RequestLookup` (`:1066-1114`) opens a
customer-scoped picker, and the picked request's number and reason ride onto the child order's
`RefDocumentNo` / `DocumentReason` at submit, where the 055b spine links the request to the order and
completes it. On the web the fields exist all the way down to `AddSdDocumentHeader` and **nothing
fills them**, so a web-placed order can never convert a request: the caller rings, the agent rebuilds
the basket by hand, and the request stays open forever with a real order sitting beside it.

The commercial edge is TMRA. Tamara takes a large commission, so a picking fee is charged to justify
it — the OMS applies that fee off the reason code, and it only ever gets applied if the reason
reaches the document.

## Solution

Attach the caller → the rail says **"2 open requests · view"** → a picker lists them with their lines,
their reason in words and the pharmacist's note → pick one → the order is linked.

The link is **one compound act** on the server (`linkRequest`, one `requestId`):

| | |
|---|---|
| Always | stamps the request number + reason, copies the **store**, copies the **items**, prefills `sourceReference` if empty |
| TMRA only | also forces **PickInStore** and **paid online** |
| Never | touches `documentSource`, or copies the request's note into the order note |

Three rules make it safe, and each one buys something specific:

1. **Linkable only on an empty basket** (`LINES_EXIST`). Kills the plant re-price, the copied-meets-typed
   merge, and every quantity ambiguity in one restriction.
2. **Unlink is a full undo** — copied lines removed, store gate re-shut. Forced by rule 1: if unlink
   left the lines behind, a mis-click could never be corrected, because the basket would no longer be
   empty and the re-link would be refused.
3. **`removeCustomer` clears the link**, exactly as it already clears the address. That closes the
   swap vector without locking the customer.

## User stories

- **The agent sees there is one.** Attaching a caller with open requests puts a count in the rail. An
  unnoticed request is the failure this whole spec exists to prevent, so the console volunteers it.
- **The agent reads it to the caller.** The picker shows each request's lines, its reason in words and
  the pharmacist's note — enough to confirm "this is the Mounjaro you paid for on Tuesday" without
  leaving the console.
- **The agent links it and the order is ready.** Store, items, and for TMRA the pickup and the online
  payment, all land at once; the mandatory source reference fills itself.
- **The agent who linked the wrong one unlinks it** and the order is exactly as it was before.
- **The agent whose request was converted by somebody else mid-call** is told which request and can
  unlink and place the order anyway, rather than being told to retry a submit that will never work.

## Implementation decisions

**The customer is NOT locked.** The owner's first instinct was that attaching a caller should be
final — change means abandon. It is not built, because `removeCustomer` clearing the link closes the
same vector (link A's request, swap to B, submit, and A's request completes against B's order) while
871 §6's ruling stands: "the ordinary *wrong caller, same items* correction must not cost the basket".

**The picker shows the lines; it does not reuse `DocumentDetailsPage`.** WPF drilled into its own OMS
details screen with `ViewOnly = true` (`FindRequestController.cs:271-275`). The react page has **no
view-only mode**, so reusing it would hand an agent mid-call the change-store, reschedule and
close-request commands; it also lives under the full-chrome layout while `/callcenter` is
`chromeless`, and `features/callcenter → features/oms` is a boundary violation. The console needs the
lines anyway to copy them, so the picker shows what it is about to copy and links out for the rest.

**Scoped by loyalty id only.** One household number is one household, and phone scoping would surface
a relative's request. Named cost, accepted: a request raised without enrolling the customer is
invisible.

**Nothing opens by itself.** The count is drawn, the modal is not — the agent is mid-greeting, and a
picker over the basket hijacks the call.

**The reason is never shown as a code.** The read returns the description resolved server-side; the
agent must not read `TMRA`, and the console must not call a second door to translate it.

**The address still wins the plant.** On a delivery order, picking the caller's address re-derives the
store through the existing store-move preview. The request's store was only ever where the pharmacist
stood. The move is named, never silent.

**Copied lines pass the same gate a typed line does.** A refused or below-ATP line is **not** added —
it is reported, and the agent adds it deliberately. A below-ATP line may never be auto-confirmed:
`HasBelowAtp` is a fraud signal and a flag nobody saw proves nothing.

## Testing decisions

Pure modules carry the rules — a `linked-request` view model (what the card says, when the link is
offered, what the skipped-line report reads as) plus the picker's own projection. The screen slice is
proved by a Playwright drive against `/callcenter` with the wire stubbed, per the standing ruling that
RTL is not installed and a UI slice is verified by driving the app.

The two assertions that only a drive can make: the link goes out as **one** `LinkRequest` with **one**
`requestId` (never N `addItem` calls), and the unlink leaves the basket empty with the store gate shut.

## Out of scope

- **Creating or cancelling a request** from the console. Read and convert only; the request's own
  lifecycle stays on the OMS screen (059).
- **More than one request per order.** `RefDocumentNo` is singular and 055c makes conversion one-shot.
- **Editing the copied lines as a batch.** Once copied they are ordinary basket lines.
- **The picking fee.** Applied by the OMS off the reason code; nothing here prices it.
- **Requests for a caller who is not attached.** Unreachable by construction (§6.3).

## Tickets

- [194](194-the-callers-open-request-becomes-the-order.md) — the count, the picker, the link
- [195](195-unlinking-and-the-request-that-went-away.md) — unlink as full undo, and the two refusals
