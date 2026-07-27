---
type: wayfinder-ticket
wayfinder: research
map: 126
status: open
blocked-by: —
---

# 156 — The delivery fee stops living in WPF

## Question

[133](133-submission-path-server-side.md) flagged this in one line — *"the delivery-fee **rule** is
WPF-only and must become shared code"* — and the owner's 2026-07-27 gap review says look at it
properly. Reading it is worse than the flag suggests, in two independent ways.

### 1. The amount rule is a WPF property with a hardcoded date in it

`POSCommon.cs:394-435`, `DeliveryFees`:

- A **hardcoded free-shipping window — `>= 2026-06-20 && < 2026-06-28` returns `0`.** A campaign
  compiled into the till binary.
- `RetailDocumentType.Credit && CustomerID == NUPCOCustomer` → the Wasfaty rate (15), else the
  standard rate (10), off `DeliveryFeesConstants`.
- P2E reads a per-document-type `DeliveryFees` out of `GetP2EConfgs()`.

The contract already quotes `totals.deliveryFee { amount, waived, thresholdGross, conditionType:
"DFEE" }` live as lines change (§8.3). ~~**Nothing computes it**, and `thresholdGross` implies a
threshold rule this property does not contain — so either the threshold lives somewhere else and
must be found, or the contract invented a field. Establish which.~~ The `DFEE` condition itself is
unchanged; it is the *rule that decides the amount* that has no shared home.

> **Correction, 2026-07-27 — answered by [154](154-fulfilment-mode-and-store-choice.md), which went
> looking for the mode's effect on the fee and found the rest.** The threshold is **not** missing and
> the contract invented **nothing**. `POSController.NewPos.cs:8951`
> `RefreshSubmissionDeliveryFeeFromNewPos()` implements the whole thing for the `CallCenterOrder`
> doctype: `fee = subSourceCarriesFee && isDelivery && underThreshold ? POSCommon.ShippingAmount : 0m`,
> with `underThreshold = ViewModel.Balance < POSCommon.ShippingMinimumAmount` (`POSCommon.cs:377`) —
> so `thresholdGross` quotes `ShippingMinimumAmount`, and the rule already recomputes on every
> `RefreshSummary`, idempotent, app-local, as the contract describes. It **also** already keys on the
> fulfilment mode (`isDelivery = order.IsDelivery`) and already excludes the Wasfaty/Insurance
> sub-sources.
>
> What survives of this section: the **amount** getter (`POSCommon.cs:394-435`) is still a WPF
> property with a campaign date compiled into it, and it is still the piece with no shared home. The
> `DeliveryFees` property this ticket opened on sits *below* `RefreshSubmissionDeliveryFeeFromNewPos`
> — the caller was found; the callee is still the problem. Scope this ticket to the amount rule, not
> to a missing threshold that exists.

### 2. The agent can waive it today — and phase 1 removes that

`NewOrderView.xaml:192-200` is a radio pair, **"Add Delivery Fees" / "No Fees"**, bound to
`HasDeliveryFees` / `HasNoDeliveryFees`. Rules drive it on some paths (`NewOrderController.cs:810-819`:
Wasfaty ≥ 500 → no fee) but the control is the operator's.

🚩 **Map note 4's justification is now false as written.** It claims removing price-affecting
operator power *"removes nothing agents have today"*, verified by finding zero occurrences of
`ChangePrice` / `ManualCondition` / `Discount` / `OpenPrice` / `SetPrice` in `CallCenter/` and
`CallCenter2/`. The fee waiver is none of those names, so the search could not have found it. The
claim needs amending: note 4 **does** remove one power agents hold today.

**Owner ruling, 2026-07-27: rule-driven only, no manual waiver.** The fee is computed server-side
from the shared rule and `waived` is an **outcome the agent is shown, never a control**. Note 4 holds
as a principle; its supporting claim gets corrected rather than the principle bent. A manual waiver,
if the business ever wants one back, arrives as its own effort with its own authorization design —
it is not smuggled in as a checkbox.

### What this ticket owes

- Where the shared rule lands so the web and the till quote the **same** fee (133's requirement), and
  what happens to the compiled-in campaign window when it does.
- Whether `thresholdGross` is real, and what the threshold is.
- The interaction with [154](154-fulfilment-mode-and-store-choice.md): a **pick-in-store order has
  no delivery fee**, which is a rule, not a UI decision.
- The console's side: how a fee that the agent cannot change is shown so it never reads as an
  input — and how a *rule-waived* fee explains itself (`waived: true` with no reason is a support
  call).

Deliverable: a research note with file:line evidence, and the BackOffice issue for the shared rule.
