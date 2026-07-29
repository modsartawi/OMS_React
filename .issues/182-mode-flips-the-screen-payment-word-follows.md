---
status: open
spec: 180
blocked-by: —
---

# 182 — theModeFlipsTheScreenAndThePaymentWordFollowsIt

**Slice 0.** The widest spine reach in this spec, and the slice that retires the shared unknown
behind five others: *does an unwired prototype component mount in the real page against a real
mutation?*

## What to build

The order can say how it arrives and how it is paid for.

**Fulfilment** is the **first** chip in the header row and always settled; **payment** is near the
last, settled and collapsed, with a real default (`CashOnDelivery`) and **no submit blocker**. Both
open the modal every other chip opens. `FulfilmentPicker`, `PaymentPicker`, `fulfilment-view` and
the chips themselves already exist and are proved by `fulfilment-176-drive.mjs`; `ConsoleShell`
already accepts `onChangeFulfilment` / `onChangePayment`. **`CallCenterConsolePage` supplies
neither** — that, plus the two verbs, is the work.

The flip's consequences are the slice, not the toggle:

1. The customer rail's second block is **one block with two faces** — *Address* under delivery,
   *Collecting from* under collection — **at the same pixels** (226 px in both modes, measured).
2. The slot chip is **absent** under `PickInStore` — not empty, not disabled — and **nothing** is
   drawn where it was.
3. The receipt draws **no delivery region at all** under `PickInStore`.
4. The store chip drops its *(derived)* parenthetical under collection **whatever `plantSource`
   says** — a capture keeps `derivedFromAddress` in a response that also carries `address: null`.
5. `header.retainedAddressLabel` draws one muted line in the collection block. It is
   **server-supplied by ruling** — a client that remembers the last address it saw is blank after a
   refresh and in a second tab.
6. A shut `canChangeFulfilment` **removes the chip's handler** and prints
   `capabilityReasons.canChangeFulfilment` beside the row (the delivery-only sources). Same for
   `canChangePaymentType` — ⚠ unreachable in phase 1, implemented anyway.
7. Under pickup the payment chip reads **Pay on collection** while the wire value never changes.
   This is why the two chips cannot be built independently.
8. `STORE_NOT_CHOSEN` becomes a real submit blocker with real words — 175 ruled it onto the contract
   and this client never got it, so the one blocker 175 exists to raise would print the *unknown
   blocker* phrase.
9. A `paymentType` the client cannot word (a future `Receivable`) draws **no wording**, never a
   wrong one.

## Spine reach

model (already present) · api (`setFulfilment`, `setPaymentType`) · logic (`fulfilment-view`,
`header-chips`, `submit-blockers`) · component (page wiring, rail, receipt) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `fulfilment-view` — mode in, block face and payment word out; *Pay on collection* under pickup
      while `paymentType` is unchanged · pure
- [ ] `capabilityGate` — a shut capability yields no handler and a reason; a missing reason degrades
      to a vague sentence, never a wrong refusal · pure
- [ ] `header-chips` — `slot` absent under pickup; `(derived)` suppressed under collection **even
      when `plantSource` says `derivedFromAddress`**, driven by the capture that contains exactly
      that contradiction · pure
- [ ] `submit-blockers` — `STORE_NOT_CHOSEN` resolves to real words on the `store` chip; an unknown
      code still degrades to the unknown phrase · pure
- [ ] `fulfilment-176-drive.mjs` **re-pointed at the wired console** — the rail block's height is
      **identical across the flip** (asserted, not eyeballed); the drive fails if anything below it
      moves · flow (Playwright)

## Boundaries

**Server:** BackOffice [877](C:\Work\DMSCO\BackOffice\.issues\877-cc-fulfilment-drawn-server-half.md)
+ [871](C:\Work\DMSCO\BackOffice\.issues\871-cc-opening-gate-and-plant-source.md). Contract v1.8 /
v1.4, additive — build against stubs and say so in the drive's output.
Envelope codes to handle: `STORE_NOT_CHOSEN`, `NO_CUSTOMER_ATTACHED`, `SESSION_BUSY` (existing
retry), `SESSION_CLOSED`.
**i18n:** existing `callcenter` namespace; the two chips' modals and the `capabilityReasons`
wordings.

## Done when

In the running app, flipping the mode moves the rail block by zero pixels, removes the slot chip and
the receipt's delivery region entirely, and changes the payment chip's word without changing its
wire value — and the re-pointed drive asserts all of it.

## Blocked by

None — can start immediately.
