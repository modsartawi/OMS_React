---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: done
blocked-by: —
---

# 155 — Payment type: cash on delivery, or paid online

## Question

**Owner-reported gap, 2026-07-27.** Same shape as [154](154-fulfilment-mode-and-store-choice.md) and
found the same way: the CLCN document carries a payment type, and contract v1.0 has no field for it.

- `Cc2DocumentHeaderBuilder.cs:36-38`:
  `PaymentType = ctx.Strategy.ForcesOnlinePayment || !ctx.CashOnDelivery ? Online : CashOnDelivery`.
  An operator radio, with a strategy override (P2E is online-only and hides the picker).
- CC1 `NewOrderController.cs:50` defaults `CashOnDelivery = true` at construction.

🚩 **Why this was easy to miss, and worth recording.** Map 126 says phase 1 is the *"plain CLCN
**cash** order"*. That "cash" is the order **kind** — not Wasfaty, not Nphies, not insurance, not
P2E — and reads as though the payment question is already settled. It is a **different axis**:
a plain CLCN order can be cash-on-delivery *or* paid online. The map's own phrasing hid a real
header field for the whole of the charting.

What to settle:

- **Is it in phase 1 at all?** P2E is the only kind that forces online and P2E is out of scope, so
  every phase-1 order is the operator's pick. Shipping the constant `CashOnDelivery` would match
  CC1's default and be wrong the first time a caller pays online.
- **Does it violate note 4?** No amount is involved — this is a *classification* of how money will
  be collected, not a change to how much. It should be a plain header field like `documentSource`,
  not a confirmed verb. Confirm that reading before it ships, because "payment" and "no price-
  affecting power" sit close enough to be worth stating explicitly in the spec.
- **What, if anything, does it interact with?** Cash-on-delivery on a *pick-in-store* order is
  either meaningless or means "pay at the counter" — 154 and this ticket meet there, and one of the
  two must own the combination. Also check whether `Cc2DocumentHeaderBuilder`'s downstream consumers
  (fee, submission, OMS document) branch on it.
- **Where does it live in 135's layout?** It is a header fact, so the chip row — but a chip that
  changes how the caller pays may not read as settled-and-collapsed the way `documentSource` does.

Deliverable: the ruling plus the contract field (additive, §9 minor) for 136 to carry.

## Two inputs added 2026-07-28 (from [175](175-nothing-enters-an-unaddressed-order.md) / [178](178-the-transaction-absorbs-the-sidecar.md))

1. **The owner expects this field.** Asked whether the source rules were in phase 1, they ruled them
   in and added: *"it's already there, in the `PosTransactionOrder` (`DocumentSource`) — but we might
   need the payment type."* So the field is wanted; what it holds is still this ticket's to decide.
2. 🚩 **There is now a forcing rule to carry, and it arrived from the source axis.** CC2's
   `DocumentSourcePolicyService` makes **P2E force online payment**, and marks WSFD / P2E / DKSW
   **delivery-only**. Order *kinds* are out of phase 1, but these are **source** rules and phase 1
   has sources — owner-ruled **in** while resolving 175. So `paymentType` is not merely a free
   choice: it can be **forced by the document source**, which is exactly CC2's `IsPaymentForced` /
   `ShowPaymentChip` vs `ShowPaymentRadios` split. Whatever this ticket rules must say what the
   console shows when the source has already decided.
3. **Storage and the value domain are settled — only the behaviour is left.**
   [178](178-the-transaction-absorbs-the-sidecar.md) ruled `CallCenterSession` the home for every
   non-engine field, and the owner then specified the codes (2026-07-29): the sidecar stores what the
   OMS document stores, so `PaymentType` is **`"C"` = cash on delivery, `"O"` = online**
   (`DocumentPaymentTypeConstants`). ⚠ The owner said *"P for PaidOnline"* — **online is `"O"`**;
   `"P"` is `PickInStore` on the *delivery* axis. Corrected before it reached anything.
   ⚠ There is a **third** value, `Receivable = "R"`, out of phase 1 — so do not rule this a boolean.
   The column lands on BackOffice
   [871](C:\Work\DMSCO\BackOffice\.issues\871-cc-opening-gate-and-plant-source.md); this ticket rules
   what fills it.

4. 🚩 **What this replaces is a placeholder, and it is wrong in BOTH directions.**
   `CallCenterSessionService.Submit.cs:196` sets `CashOnDelivery = isDelivery` — commented *"Phase 1
   web is plain CLCN cash on delivery"*. Owner ruling 2026-07-29: **payment type is not linked to
   delivery type at all.** *"Any order could be paid online or cash on delivery."* So the current
   derivation is not merely wrong for pickup — it is an arbitrary value taken off an unrelated axis,
   and it fails both ways: a **pick-in-store** order is stamped **online-paid**, and a **delivery**
   caller who wants to pay online **cannot be given the option at all**. There are values going onto
   real documents right now that nobody picked.

## The owner's rulings on what this field IS — 2026-07-29

These close most of this ticket's open questions and should not be re-derived.

- **It is an independent axis.** Not derived from `deliveryType`, not derived from anything. Every
  combination is legal: delivery + online, delivery + COD, pickup + online, pickup + COD.
- 🚩 **It is not a tender, and no money moves on the console.** *"Nothing will be paid there, no
  tender."* The field is an **instruction to OMS**: it tells OMS the customer wants to pay before
  delivery, and **OMS sends the customer a payment-gateway link** to complete it. The console never
  sees a gateway, a card, an amount or a result. That settles this ticket's *"does it violate note
  4?"* outright — it is not a payment, it is a routing flag on the document, so no price-affecting
  power is created and note 4 is untouched.
- **The agent's act is one question, asked out loud.** *"Would you like to pay online, or pay once
  you receive the order?"* A tick or a two-way choice — no amount, no confirmation, no consequence
  the agent has to explain. That is the smallest interaction on the whole console, and it argues for
  the chip row rather than anything heavier.
- **Values: `C` = cash on delivery, `O` = online** (`DocumentPaymentTypeConstants`), owner-confirmed.
  ⚠ `R` (`Receivable`) exists and is out of phase 1 — model the domain, not a boolean.

### What is left for this ticket

- **The default.** A new order has to start somewhere, and with the axis independent there is no
  longer a "derive it" answer. Cash on delivery is the WPF-parity guess; confirm it.
- **The forcing rule.** P2E forces online and some sources are delivery-only (owner-ruled into phase
  1 while resolving [175](175-nothing-enters-an-unaddressed-order.md)) — so the choice can be
  **made for the agent** by the document source. CC2 already models exactly this as
  `IsPaymentForced` / `ShowPaymentChip` vs `ShowPaymentRadios`. The console must say *why* it is
  fixed, not just disable it.
- **Where it draws**, given how small the act is.
- Whether it needs a `capabilities` flag (`canChangePaymentType`) for the forced case, or whether the
  forcing rides `documentSource` alone.

## Answer — 2026-07-29

**Contract v1.4, additive**: [CONTRACT.md §2.4](assets/136-cc-contract/CONTRACT.md) — new
`header.paymentType` + `header.paymentTypeForcedReason`, new `setPaymentType` verb, new
`capabilities.canChangePaymentType`, new codes `PAYMENT_TYPE_FORCED` / `PAYMENT_TYPE_INVALID`,
fixture 11 specified-and-owed, dated §10 entry. Server half folded into BackOffice
[871](C:\Work\DMSCO\BackOffice\.issues\871-cc-opening-gate-and-plant-source.md), which was already
landing the column and explicitly deferred the behaviour here.

### 🚩 The finding that changed the question: the forcing rule is not a source rule

This ticket was handed a forcing rule by [175](175-nothing-enters-an-unaddressed-order.md) —
*"P2E forces online payment, and it arrived from the **source** axis, so it survives the kind
carve-out."* Read at the enforcement sites, it does not:

- CC2 forces on the **kind**: `IsPaymentForced => DocumentType.SelectedType.ForcesOnlinePayment`
  (`MainCallCenter2ViewModel.cs:413-414`), and `ForcesOnlinePayment` is `true` on exactly one
  strategy, `P2eOrderStrategy`.
- CC1 says the same thing from the other side, and it is the stronger evidence because it is the
  console being replaced: `OnlinePayment`'s setter opens `if (!IsCash && value) { … return; }`
  (`NewOrderController.cs:504-519`) — insurance and Wasfaty **refuse** online outright and re-assert
  COD (`:352`, `:380`). **The one kind where the operator is free is the cash kind** — the only kind
  in phase 1.
- `DocumentSourcePolicyService`, the service 175 named, forces **nothing** about payment. Its entire
  content is `SupportsPickInStore`: WSFD / P2E / DKSW are **delivery-only**. That is a *fulfilment*
  rule and it belongs to §2.2 / [176](176-fulfilment-mode-drawn.md), not to this axis.

So **nothing in phase 1 can force this field.** The confusion has a specific, forgivable source:
CC1 calls the *kind* axis `OrderSource` (`CallCenterOrderTypes.OrderSourceInsurance` /
`OrderSourceWasfaty`), and `P2E` is simultaneously a kind strategy **and** a
`DocumentSourceConstants` code. Two axes, one word, in the codebase itself.

⚠ The delivery-only half of 175's ruling is **real and still in phase 1** — it is just not this
ticket's. Recorded on 176 below so it is not lost with the correction.

### The rulings (owner, 2026-07-29)

1. **Default `CashOnDelivery`** — WPF parity (`NewOrderController.cs:50`; CC2's field initialiser).
   871 already lands the column defaulting to `"C"`, so this confirms rather than changes it.
2. **The forcing flag ships with no forcing rule behind it.** `paymentTypeForcedReason` is `null` on
   every phase-1 order and `canChangePaymentType` is always `true`. It is carried anyway so a later
   rule — a P2E-category source reaching an agent's `MyDocumentSources`, or a kind entering scope —
   is a **server data change**, not a §9 revision plus a client change. Rejected: hard-coding
   P2E/WSFD/DKSW ⇒ online now, which no WPF path does and this map would have been *inventing*.
   ⚠ `DocumentSourceCategory == "C"` membership is **table data**, so the source cannot be read to
   answer "could P2E reach a cash order" — which is itself the argument for a server-side table.
3. **The chip row, settled and collapsed** — CC2's own answer
   (`ShowPaymentChip => !_isPaymentExpanded && !IsPaymentForced`; GAP_ANALYSIS item 9,
   *"collapse Payment to chip when COD"*). It has a real default and the smallest act on the console
   behind it, so it reads settled rather than outstanding, and it carries **no `submitBlocker`** —
   the order always holds a valid value.

### Ruled by construction, not asked

- **Not a `pendingConfirmation` kind, and note 4 is untouched.** The owner's grounding settles the
  ticket's own *"does it violate note 4?"* outright: *"nothing will be paid there, no tender"* — the
  field instructs OMS to send the customer a **payment-gateway link**. No amount, no gateway, no
  result reaches the console, so it creates no price-affecting power. It is a routing flag in the
  same family as `documentSource`.
- **Flippable whenever `status: open`**, on a stronger argument than 154's: the flip moves no plant,
  touches no line and re-prices nothing, so there is not even a candidate for a lines-exist gate.
- **The delivery fee is unaffected** — `subSourceCarriesFee && isDelivery && underThreshold`
  (`POSController.NewPos.cs:8951`) contains no payment term. The ticket's *"what does it interact
  with?"* has one honest answer: **nothing on this map**. Downstream, `CreateOmsOrder.cs:109-111` is
  the only consumer, and it maps the value onto the document rather than branching on it.
- **Three values, one reserved.** `Receivable = "R"` is named on the wire and **refused** by
  `setPaymentType` (`PAYMENT_TYPE_INVALID`). Freezing a two-value enum would make the third value a
  §9 **major** the day the business wants it; naming it costs nothing and a client that never
  receives it is never wrong. This is the ticket's *"model the domain, not a boolean"* made concrete.
- 🚩 **One console-wording rule that never touches the wire.** Under `PickInStore`, a chip reading
  *Cash on delivery* describes an order nobody delivers. The value means "not prepaid", so the chip
  is worded per mode — *Cash on delivery* under `Delivery`, *Pay on collection* under `PickInStore` —
  while the wire stays `"CashOnDelivery"` and the column `"C"`. Wording follows the caller's
  experience; the value follows OMS.
- ⚠ **The forced rendering is an unreachable client path and is named as such** (177's lesson). The
  console still implements `canChangePaymentType: false`, because a capability the client ignores is
  the exact failure §2's advisory-but-authoritative rule exists to prevent — proved from a stubbed
  state in the drive, never from a live server, and the drive says so.

### What this replaces

`CallCenterSessionService.Submit.cs:196` — `CashOnDelivery = isDelivery`, commented *"Phase 1 web is
plain CLCN cash on delivery"*. It is **deleted, not adjusted**: with the axes independent it is a
value taken off an unrelated axis, wrong in both directions, and going onto real documents today.

### Left open, recorded rather than invented

- **Nobody has drawn the chip.** [176](176-fulfilment-mode-drawn.md) is the undrawn-surface ticket
  for the fulfilment axis and this chip sits in the same row, under the same *settled-and-collapsed*
  discipline, with a mode-dependent word in it — so it is added to 176 rather than minted as a
  seventh drawing ticket.
- **What OMS does with `Online`** — when the gateway link is sent, what happens if the customer never
  pays, whether the order waits. Out of this map: the console's whole obligation is to record the
  instruction, and OMS owns everything after it. Worth the pickup call script knowing, alongside
  154's *"a pickup order has no collection time"*.
