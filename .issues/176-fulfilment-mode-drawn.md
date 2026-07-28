---
type: wayfinder-ticket
wayfinder: prototype
map: 126
status: done
blocked-by: —
---

# 176 — Fulfilment mode, drawn where the agent asks the question

## Question

**Owner gap review #2, 2026-07-28**: *"I don't see where we can choose the delivery type (Pick In
Store or Delivery)."* They are right, and the reason is not that it was forgotten twice.

The state of play:

- [154](154-fulfilment-mode-and-store-choice.md) **ruled both modes into phase 1** on 2026-07-27 —
  contract **v1.1**, `setFulfilment`, flippable while `status: open`, the flip never moving the plant,
  pickup hiding the address and the slot and forcing the fee to 0. Fixture
  [09](assets/136-cc-contract/09-fulfilment-flip.json) carries the exchange.
- Spec [160](160-callcenter-console-spec.md) **carved 154 out** of the build and says so out loud
  ("this spec assumes the delivery, cash-on-delivery defaults"), so tickets 161–174 built a console
  with no mode axis at all: `header-chips.ts:67-75` draws store · slot · source · ref and nothing else.

So the wire is settled and the **surface is simply undrawn** — the same shape
[159](159-coupon-and-loyalty-signup-drawn.md) is in. What is left is a drawing job with real
consequences, because the mode changes what the rest of the screen *is*:

- **Where does the control live?** It is not a settled-then-collapsed fact like the source chip —
  it is asked at the top of the call and can be flipped at any point, and 135's chip row is a row of
  things that are *done*. A fifth chip, a segmented control above the chips, or part of the customer
  rail beside the address are three different claims about how often it is touched.
- **What does the flip do to the screen the agent is looking at?** Under pickup the address block
  (the customer rail's only interactive region) and the slot chip both **disappear**, and the receipt
  loses a line when the fee goes to 0. That is a lot of furniture moving on a console whose one
  winning property is that the furniture never moves (135). Does the region collapse, or stay and
  read as not-applicable?
- **The pickup store picker is the same `setStore` verb** (154), which means it reaches
  [129](129-rebind-store-door.md)'s door and can be **refused** — so the mode control has a failure
  mode, and it needs 135's banner treatment rather than a control that silently does nothing.
- **The retained address.** 154 ruled it hidden-and-kept so a pickup→delivery flip re-derives from
  it. An agent who cannot see it has no way to know a flip back will move the store — the diff arrives
  as a confirmation about a store they never chose. Does the hidden address get a trace?
- **A pickup order has no collection time** — 154's own recorded product gap (`RequiresSlot` is
  delivery-only). Whatever the console draws where the slot chip was must not imply one.

Blocked by [175](175-nothing-enters-an-unaddressed-order.md): if the store becomes something the
agent picks rather than something they are given, the pickup store picker is no longer a special
case — it is the ordinary path — and where the mode sits depends on where the store already sits.

Deliverable: the mode drawn into 135's console as a prototype (this repo's `/prototype` convention,
built inside the real console like 138's was), the layout ruling it settles, and the states it adds
to the spec's acceptance surface.

## Two additions from [155](155-payment-type-cod-or-online.md) — 2026-07-29

Both are handed here rather than minted as a seventh drawing ticket, because they land in the same
row of the same screen as the mode control.

1. **The payment chip is drawn here too.** Contract **v1.4**
   ([§2.4](assets/136-cc-contract/CONTRACT.md)) adds `header.paymentType` with the owner's ruling that
   it draws as a **chip, settled and collapsed** — it has a real default (`CashOnDelivery`) and no
   `submitBlocker`, so unlike the mode it genuinely *is* a settled fact. 🚩 It carries one wording
   rule that ties it to this ticket: under `PickInStore` the chip reads **Pay on collection**, not
   *Cash on delivery*, while the wire value never changes — so **the mode control and the payment
   chip cannot be drawn independently**. Also draw `canChangePaymentType: false` (chip settled,
   non-interactive, carrying the reason) knowing it is **unreachable in phase 1** and provable only
   from a stubbed state.
2. 🚩 **The delivery-only sources are yours, not 155's.** 175 ruled *"P2E forces online payment + the
   delivery-only sources"* into phase 1 as one item; 155 found the two halves sit on **different
   axes**. The payment half is a *kind* rule and every forcing kind is out of scope. The half that
   survives is `DocumentSourcePolicyService`'s: **WSFD / P2E / DKSW are delivery-only**, a rule on
   *this* axis. If such a source can reach an agent's `MyDocumentSources` list, the mode control must
   be able to say *pick-in-store is unavailable for this source* — which is a `capabilities` answer
   (the §2.2 sibling of `canChangePaymentType`), not a client-side list.

## One addition from [156](156-delivery-fee-shared-rule.md) — 2026-07-29

🚩 **The receipt's delivery region is a live defect the day this ticket lands, and it is
capture-confirmed.** Capture [09](assets/136-cc-contract/09-fulfilment-flip.json) line 206 has the
pickup state as `amount: 0, waived: false, thresholdGross: 100`. Against exactly that,
`ConsoleShell.tsx:524` draws a **`Delivery   SAR 0.00`** row on an order nobody is delivering, and
`:546` — `!waived && thresholdGross !== null`, both true — puts **"free over SAR 100"** underneath
it: a delivery promise on a collection order.

It is invisible today only because there is no way to reach pickup. **Ruling, so it is not
rediscovered as a bug:** under `deliveryType == "PickInStore"` the fee region is **absent, not
zero** — the same absent-not-disabled posture [175](175-nothing-enters-an-unaddressed-order.md) chose
for the item command line. The block still ships on the wire (the flip back must re-quote instantly);
the console simply does not draw it. **No wire change**, and it belongs in the "what does the flip do
to the screen" question above rather than beside it — the receipt loses a line, which is furniture
moving on the one column 135 promised would not.

Note also that contract **v1.5** now gives a waived fee a reason
([§2.5](assets/136-cc-contract/CONTRACT.md)), so the *delivery* side of the flip has one more thing
to draw: the waived state is a reason, not a bare green word.

## Answer — 2026-07-29

**Contract v1.8, additive** — [§2.6](assets/136-cc-contract/CONTRACT.md) plus two new fields. The
mode is drawn into the **real** console on branch `prototype/176-fulfilment-mode`, eleven states
driven and captured ([assets/176-fulfilment](assets/176-fulfilment/)), 90/90 assertions, typecheck ·
550 tests · all three lint gates green. Server half minted as BackOffice
[877](C:\Work\DMSCO\BackOffice\.issues\877-cc-fulfilment-drawn-server-half.md).

### The reframing: the arrangement was never the open question

The ticket leads with *"where does the control live?"* and offers three answers. It was already
settled twice over, and re-opening it would have burned the session:

1. [175](175-nothing-enters-an-unaddressed-order.md) ruling 9 chose **variant 4** — a chip bar at
   rest, a full section when one opens — and its prototype already drew fulfilment as **two
   full-sentence choices, not a toggle**, on the owner's word.
2. Spec [160](160-callcenter-console-spec.md)'s build then settled where a chip opens *to*: a
   **modal**, like `StorePicker`, `SlotPicker` and `SourceForm` (tickets 167/173). 175's inline
   section lost to the build, not to an argument.

So the mode is **the first chip in the row**, opening a modal. First because the order always holds a
mode — the chip is never *unset* — and because everything to its right is a consequence of it: two
chips to its right (slot) and one region of the receipt (delivery) **stop existing** when it flips.

What was genuinely open is the other half of the ticket — **what the flip does to the screen** — and
that is what the session spent itself on.

### The rulings

- **Absent, not zero; absent, not disabled.** The slot chip and the whole delivery region are
  *removed* under collection, not emptied or greyed. This is [156](156-delivery-fee-shared-rule.md)'s
  ruling and [175](175-nothing-enters-an-unaddressed-order.md)'s posture, applied to the two things a
  collection order genuinely does not have. The blocks still ship on the wire, so the flip back
  re-quotes instantly.
- 🚩 **The rail's two blocks are ONE block.** *Address* and *Collecting from* occupy the same pixels,
  so a flip moves no furniture — 135's one winning property. This is the ruling that dissolved the
  ticket's own *"does the region collapse, or stay as not-applicable?"*: it does neither. The two
  modes ask the same question of two different orders (*where is this going* / *where are they
  collecting it*), so they get the same place and different words. **Measured, not asserted** — the
  drive reads both blocks' offsets from the rail's top and fails if they differ (226 px, both modes).
- **The store chip drops its *(derived)* parenthetical under collection.** Capture-driven: fixture 09
  keeps `plantSource: derivedFromAddress` across a flip whose response also carries `address: null`,
  so *from the address* would point at something the console can no longer show.
- **A collection order has no collection time and the console says NOTHING about it** — owner ruling,
  asked directly. Where the slot chip was, nothing is drawn. `RequiresSlot` is delivery-only and
  neither WPF nor this contract can answer *"when can I collect?"*; that gap belongs to whoever owns
  the pickup call script ([154](154-fulfilment-mode-and-store-choice.md)), and a reassuring sentence
  here would be this map promising something no system behind it can keep.
- **The mode's failure path is the existing one.** Going back to delivery re-derives the plant and can
  raise a `storeChange` confirmation or a `REBIND_REFUSED` banner — [129](129-rebind-store-door.md)'s
  door, unchanged. What the drawing adds is that the modal **says so before the agent presses**, so
  the confirmation arrives expected rather than alarming. No second confirm kind was invented.
- **`Receivable` is not offered.** It is on the contract, reserved and server-refused, so an option
  for it would be a control the door refuses.

### 🚩 The retained address: the client answer was built, and rejected

The ticket's sharpest question — *an agent who cannot see the kept address has no way to know a flip
back will move the store* — was first answered client-side: remember the last address this console
saw, and say *"Their Home address is kept."* It works, needs no server, and was **rejected by the
owner** once its cost was named: it is blank after a refresh, blank in a second tab and blank on a
resumed order, so **the same order reads two ways depending on how the agent arrived at it** — the
failure this map has ruled against everywhere else (127's resume-per-request, 136's
render-of-latest-state, 175's *never a client rule*).

So `header.retainedAddressLabel` ships — **the label, never the address**. It is not a field the agent
acts on and not one they read to the caller; the whole address would be a second copy of PII on a
projection that deliberately dropped it.

### 🚩 `capabilityReasons` — minted here, and 153 gets it for free

The delivery-only sources (WSFD / P2E / DKSW, `DocumentSourcePolicyService.SupportsPickInStore`) are
the **one rule in phase 1 that can shut this axis** — and, per
[155](155-payment-type-cod-or-online.md), the *only* surviving half of what 175 handed over as
*"P2E forces online + the delivery-only sources"*. The contract had `canChangeFulfilment` but no way
to say **why**, and an unexplained dead control teaches an agent nothing.

Owner ruling: a **`capabilityReasons` map** keyed by capability name, not a sibling field per rule.
[153](153-console-keyboard-grammar.md) had already named exactly this as the tidier answer to the
identical problem from the command palette's side and deliberately did not mint it — so one field now
serves both, and every future shut capability becomes a server data change. It also gives the
already-shipped `canChangePaymentType: false` the reason it otherwise could not carry.

A client-side list of delivery-only source codes was rejected: `DocumentSourceCategory` membership is
table data, so a console holding the list is a second opinion that goes stale silently.

### What this cost, in states

Thirteen drawn, eleven of them switchable in the prototype:

| | |
|---|---|
| **Capture** (the wire's own bytes) | `delivery` · `pickup` |
| Derived from the capture | `pickupUnchosen` · `pickupChosen` · `deliveryPaidOnline` · `pickupPaidOnline` |
| ⚠ **Stubbed — unreachable today** | `waivedThreshold` · `waivedCampaign` · `waivedUnknown` (874 unbuilt) · `lockedSource` · `lockedPayment` (§2.4: no phase-1 order can force it) |
| Interactive | the flip itself, both ways, and both modals |

The five stubs are named as stubs in the switcher, in the mock and in the drive — 177's rule that an
unreachable path is drawn **and said out loud**, never drawn and assumed.

### 🚩 Two findings on the way

1. **The import-boundary gate is why every previous prototype was an illustration.**
   `check-boundaries.mjs` treats `callcenter/__prototype__` and `callcenter/console` as two features,
   so a prototype in the usual place **cannot import the console it is about** — which is why 135's
   and 138's prototypes each re-drew the console as a `HostConsole`, and why 177 then found two
   defects in the real one that no illustration could have surfaced. This prototype lives at
   `console/__prototype__/` instead and mounts the real `ConsoleShell`. Worth a rule note: a
   prototype *about* a feature belongs inside it.
2. **`STORE_NOT_CHOSEN` had never reached this client.** 175 ruled it (v1.3) onto the contract and
   into 871, but `submit-blockers.ts`'s table never gained the code — so the store chip would have
   said nothing and the receipt would have printed the *unknown blocker* phrase on the one blocker
   175 exists to raise. Added with the rest; it is 175's implementation debt, not 176's design.

### What this does NOT settle

- **The store picker's shape under collection.** 175 drew three (grouped list · command palette ·
  city-then-store) and none was chosen; the built console has one modal (a search over the estate,
  ticket 167) and this ticket reuses it unchanged, because under collection it is the same `setStore`
  verb reaching the same door. If the floor finds the estate hard to search, that is a build ticket
  against the existing modal, not a fulfilment question.
- **The opening sequence card.** 175's variant 4 draws three steps while the gate is shut, and its
  second step differs by mode. It is 175's build, not drawn here.
