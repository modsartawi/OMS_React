---
type: wayfinder-ticket
wayfinder: research
map: 126
status: done
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

---

## Answer

**The rule already moved. This ticket was two days out of date, and what it actually found is on the
console side, not the server's.**

Full evidence: [research note](assets/156-delivery-fee/RESEARCH.md).

### The question this ticket was raised to answer is closed

BackOffice [786](C:\Work\DMSCO\BackOffice\.issues\786-web-cc-submission-path.md) §2 — minted by
[133](133-submission-path-server-side.md), now `done` — extracted
`Sartawi.Retail.Data/…/CallCenter/CallCenterDeliveryFeePolicy.cs`, a **pure static** taking `now` and
its options as arguments and reading nothing ambient. Three callers, one copy:

- the till, through `POSCommon.ShippingAmount` / `ShippingMinimumAmount`, now thin readers
  (`POSCommon.cs:377-435`);
- SIS.Api's **live quote** (`CallCenterSessionService.Harness.cs:277-305`);
- SIS.Api's **submit** (`CallCenterSubmissionService.cs:101-117`).

Both SIS.Api calls pass `BasketTotal = transaction.BalanceDue` and resolve options through the same
`CallCenterDeliveryFeeOptionsStore` over the same HQ store DB — so the quoted fee and the charged fee
are the same computation over the same inputs, and 133's *"or the web quotes a different fee from the
till"* is closed. Fifteen tests in `Tests/Data.Tests/CallCenterDeliveryFeePolicyTests.cs`, no DB, no
WPF.

Each owed item, answered:

- **The compiled-in campaign window** became **configuration, not a deletion**:
  `CallCenter.DeliveryFee.FreeFrom` / `.FreeUntil` `PosConfig` rows, `"NONE"` closing the window
  without deleting the row, invariant-culture exact-format local dates, and a fat-fingered value
  leaving the shipped default standing rather than zeroing a fee or opening an endless promotion.
  The shipped defaults reproduce the old literal (`2026-06-20` → `2026-06-28` exclusive) byte for
  byte, so an unconfigured estate behaves exactly as today. Three more numbers moved with it.
- **`thresholdGross` is real** — `ShippingMinimumAmount` → `MinimumOrderAmount`, **100 SAR**; the
  dead pre-2022 `50m` branch was deliberately not carried. The contract invented nothing.
- **Pick-in-store carries no fee by rule**, and it is the policy's *first* predicate — with `waived`
  deliberately **false** there, because a fee that never existed was not waived.
- **The no-manual-waiver ruling is honoured by construction**: no waiver control exists anywhere in
  `features/callcenter/`, no verb takes a fee, and `receiptView` is not given the lines, so it could
  not compute one if a later edit wanted to.

⚠ One correction to this ticket's own text: the standard fee is **12.0**, not 10. `POSCommon`
annotated it `// 10m` and the constant was 12; the question above inherited the stale comment.

### 🚩 What it actually found — A: `waived: true` says nothing about why

`Harness.cs:301` collapses every cause into `Waived = isDelivery && amount == 0m`. Two are live in
phase 1 (the threshold, the promotional window) and a third exists in the policy (a configured
override of zero). The console makes it worse than the wire does: `ConsoleShell.tsx:546` shows the
*"free over SAR 100"* line **only when `!waived`**, so the one sentence that would explain the waiver
disappears at the exact moment it becomes true. An agent asked *"why is my delivery free?"* has
nothing to read, and during a campaign will say *"because you're over 100"* — which may be false.
That is the support call this ticket predicted.

**The client cannot honestly derive it.** It holds `gross` and `thresholdGross` and could compare
them — but that is the client recomputing a server rule against §2.1's *engine truth, read and not
computed*, and it is wrong the moment the third branch is reachable. The server already knows which
branch it took, so it ships the branch: **contract v1.5 §2.5**, `deliveryFee.waivedReason`
(`ThresholdReached | PromotionalWindow | ConfiguredOverride`, the third reserved and unreachable in
phase 1), non-null **exactly** when `waived` is true. Additive under §9 — no verb, no code, no
capability — so it needed no owner ruling. Precedence is the policy's existing order (threshold
before window) and is now documented on the wire rather than incidental. Server work minted as
BackOffice [874](C:\Work\DMSCO\BackOffice\.issues\874-cc-delivery-fee-waived-reason.md).

### 🚩 B: under pickup the console draws `Delivery SAR 0.00` and promises free delivery

Capture-confirmed, not hypothesised: `09-fulfilment-flip.json` line 206 has the pickup state as
`amount: 0, waived: false, thresholdGross: 100`. Against that, `ConsoleShell.tsx:524` draws a
**Delivery 0.00** row on an order nobody is delivering, and `:546` — `!waived && thresholdGross !==
null`, both true — puts **"free over SAR 100"** underneath it.

Not visible yet, only because the mode axis is undrawn. It becomes visible the day
[176](176-fulfilment-mode-drawn.md) lands, so it is recorded there as a requirement rather than left
to be found as a bug: the fee region is **absent** under `PickInStore`, the same absent-not-disabled
posture 175 chose for the item command line. The block still ships on the wire so the flip back
re-quotes instantly; the console simply does not draw it. No wire change.

### Residual, named and not designed

The quote and the submit **recompute rather than pin**, so a call crossing a campaign boundary — or
an ops `PosConfig` edit landing between them, past the 5-minute options cache — quotes one number and
charges another. Rare, real, and *not* a till-vs-web parity break, since both hosts share the source.
Deliberately not fixed: pinning would contradict §8.3's *quoted live, never computed at submit*.
Also worth somebody knowing before the first campaign: **nothing in the estate edits these
`PosConfig` rows through a UI** — ending a promotion is a SQL row edit.

🚩 **The pattern worth keeping.** This ticket owed a decision that another ticket's *implementation*
had already made. 133 flagged the fee in one line, minted 786, 786 shipped — and 156 sat open for two
days holding a question with a shipped answer, while the two things nobody had looked at were both in
the console. Reading the shipped code first, rather than the WPF the ticket pointed at, is what
turned a research ticket into two findings.
