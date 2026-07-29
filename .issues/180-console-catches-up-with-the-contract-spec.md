---
type: spec
status: ready
---

# 180 — The console catches up with the contract (spec)

> **Phase 2 of the client track of map [126](126-web-call-center.md).** Spec
> [160](160-callcenter-console-spec.md) specified the **frozen v1.0 core**, and it shipped (tickets
> [161](161-percent-not-printed-as-money.md)–[174](174-placing-the-order.md)). It then carved out
> seven tickets by name. **All seven are now resolved**, together with four more the gap reviews
> found, and the contract has moved **v1.0 → v1.10**. This spec is what the console owes that
> movement.
>
> **The single source of truth for the wire is
> [CONTRACT.md](assets/136-cc-contract/CONTRACT.md) — now v1.10.** Where this spec and the contract
> disagree, the contract wins and this spec is wrong. Nothing here restates a wire shape that
> document fixes; it states what the *console* does with it.
>
> **Server track, in flight now.** BackOffice
> [804](C:\Work\DMSCO\BackOffice\.issues\804-cc-session-contract-server-obligations.md) (the
> contract's own obligations) and
> [879](C:\Work\DMSCO\BackOffice\.issues\879-cc-coupon-projection-removal-and-signup-branch.md) (the
> coupon + signup half) are **being implemented as this spec is written**. The rest of the server
> half is [871](C:\Work\DMSCO\BackOffice\.issues\871-cc-opening-gate-and-plant-source.md) ·
> [875](C:\Work\DMSCO\BackOffice\.issues\875-cc-price-check-endpoint.md) ·
> [876](C:\Work\DMSCO\BackOffice\.issues\876-cc-stock-elsewhere-endpoint.md) ·
> [877](C:\Work\DMSCO\BackOffice\.issues\877-cc-fulfilment-drawn-server-half.md) ·
> [878](C:\Work\DMSCO\BackOffice\.issues\878-cc-address-capture-and-order-acts.md). Each slice below
> names the issue it waits on. §9 of the contract ships **server-first and additive**, so every
> slice here can be built and driven against stubs before its server half lands — which is exactly
> how 160's own build shipped.

## Problem Statement

The console is live and an agent can take an order on it. But the screen the agent works and the
contract the server answers have drifted a full ten revisions apart, and every gap is a thing the
agent either cannot do or is told wrongly.

**They cannot say how the order arrives.** Every order the console places is a delivery, cash on
delivery, because those were the WPF defaults spec 160 assumed out loud and never drew. A caller who
wants to collect from a pharmacy has to be told to ring back, and a caller who wants to pay online
gets an order stamped cash whatever they said — `Submit.cs` derives *paid online* from *is a
delivery*, so today it is wrong in both directions at once.

**They cannot answer the two questions asked on every call.** *"How much is that?"* is answered off
a search row's `≈` estimate that reads about 13% under what the caller will actually pay — a number
built to sort a list, being read down a phone as a price. *"Do you have it anywhere?"* has no answer
at all, so the caller is told no by a screen that only ever looked at one store.

**They cannot fix an address without breaking the order.** The address book is on a different door
from the order, and two of its ordinary acts reach through: editing the address the order holds
leaves the order pinned to a store derived from a district that address no longer sits in, and
deleting it produces an order that cannot build a shipping address at its very last step.

**They cannot see or undo a coupon.** `applyCoupon` shipped in v1.0 and the projection deliberately
hides the voucher line it creates. Nothing replaced it, so an applied coupon moves the total and
names itself nowhere; the only way to discover one is to apply it again and read the refusal. There
is no way to take one off.

**They cannot enrol the caller who is not a member yet**, though both routes have been on the door
since 137 — and the routes as they stand let any agent credit any pharmacy in the estate with the
enrolment.

**And the headline feature is mouse-only.** Neither a search row's *Add* nor a guidance card's has
any keyboard path. The agent lives in a text box all day — the rail focuses the phone field at open,
the search box re-focuses itself after every add — and to put a line on the order they must take
their hand off the keys. At hour nine of a shift that is the ergonomic failure CC2 was raised on.

## Solution

Nine slices, all additive, all on surfaces the console already has. No new screen and no new route
in `app/router.tsx`.

**The header row gains its two missing axes.** *Fulfilment* becomes the **first** chip and *payment*
the **last**, both settled and collapsed, both opening the same modal every other chip opens. The
flip between delivery and collection is the drawn consequence, not a toggle: the customer rail's
second block becomes **one block with two faces** at the same pixels, the slot chip and the entire
delivery region go **absent rather than zero**, the store chip drops its *(derived)* parenthetical,
and `header.retainedAddressLabel` — server-supplied, because a client that remembers is blank after
a refresh — draws one muted line under collection.

**The delivery fee explains itself.** `deliveryFee.waivedReason` draws the reason a waiver happened
instead of a bare green word, and the console never derives it by comparing `gross` to
`thresholdGross`.

**A search row expands into one "about this item" panel**, holding two independent reads: the
**price check** — real engine money at the order's own plant, VAT-inclusive, one unit, equal by rule
to the basket line it would create — and **stock elsewhere**, a read-only, nearest-first list of the
stores that can supply it. They fail independently, because one is a lock-free run inside SIS.Api
and the other is the only remote hop on the whole contract.

**The address book becomes editable, and its two order-touching acts are handled.** An edit of the
address the order holds is followed by a re-issued `setAddress` on the same `addressNumber`, so the
agent sees the store-move preview a different address would have shown them. A delete of it is
refused by the server (`ADDRESS_IN_USE_BY_ORDER`) and its control is omitted on that row — the
refusal is the guard, the omission is the courtesy.

**The coupon gets a chip, a modal and a way off.** `header.coupons[]` names what is on the order;
`removeCoupon` takes one off by **reversing first and voiding only if the reverse landed**, which
makes `COUPON_REVERSAL_REFUSED` mean *nothing changed* — the opposite of what a failed remove
normally means, and a sentence the console has to say plainly. A coupon-gated near-miss stops being
offered as an add.

**The loyalty signup opens inline in the caller rail**, never a modal, because the wait for the OTP
is spoken and the agent is on the call for its whole length.

**And the keyboard grammar lands: four keys and a palette.** `Ctrl+K` · `↑↓` · `Enter` · `Esc`, no
single letters, no `Alt` chords, no `?`, no `F1`. `↓` then `Enter` in the search box adds the
highlighted row — two keys, because 131's non-sargable match makes the top row a relevance guess and
a one-key add of a guess puts a line on a live order. Nothing on the keyboard can end a call.

## User Stories

### The opening gate finishes landing (v1.3 · BO 871)

1. As an agent, I want the order note I type to be saved on the order, so that the packer reads what
   the caller told me rather than nothing.
2. As an agent, I want the order note to be a chip like every other header field, so that I do not
   have to learn a second place where order-level text lives.
3. As an agent, I want to clear an order note I typed by mistake, so that a stale instruction never
   travels with the order.
4. As an agent, I want a district that no store can deliver from to refuse the order plainly
   (`NO_DELIVERY_STORE_FOR_DISTRICT`), so that I tell the caller now rather than the order failing
   after the call.

### Fulfilment mode (v1.8 · BO 877)

5. As an agent, I want fulfilment mode as the first chip in the header row, so that the first
   question of the call is the first thing on the screen.
6. As an agent, I want the two modes offered as full sentences rather than two words, so that I read
   the caller a choice instead of decoding a label.
7. As an agent, I want the fulfilment chip always settled and never blank, so that an order can
   never be in an undeclared mode.
8. As an agent, I want the customer rail's second block to occupy exactly the same pixels under both
   modes, so that flipping the mode does not move the screen out from under my hand.
9. As an agent, I want the block to read *Address* under delivery and *Collecting from* under
   collection, so that the words match the order rather than the software.
10. As an agent, I want the slot chip **absent** under collection rather than empty or disabled, so
    that the screen does not imply a collection time this business has no system to keep.
11. As an agent, I want **nothing** drawn where the slot chip was, so that I do not go looking for a
    control that was deliberately removed.
12. As an agent, I want the receipt to draw no delivery region at all under collection, so that a
    fee of zero is never mistaken for a fee that was waived.
13. As an agent, I want the store chip to drop its *(derived)* parenthetical under collection, so
    that a store I chose is not described as derived from an address the order no longer holds.
14. As an agent, I want `header.retainedAddressLabel` drawn as one muted line in the collection
    block, so that I can still name the address on file without it reading as the order's address.
15. As an agent, I want the retained label to survive a refresh and be identical in a second tab, so
    that one order never reads two ways.
16. As an agent, I want a shut `canChangeFulfilment` to remove the chip's handler and print its
    reason beside the row, so that a delivery-only source is explained rather than silently
    unclickable.
17. As an agent, I want `STORE_NOT_CHOSEN` to be a named submit blocker with real words, so that the
    one blocker 175 exists to raise never prints the *unknown blocker* phrase.

### Payment type (v1.4 · BO 871)

18. As an agent, I want a payment chip that defaults to cash on delivery, so that the common case
    costs me nothing.
19. As an agent, I want the payment chip settled and collapsed with no submit blocker, so that a
    question I did not need to ask never holds up the order.
20. As an agent, I want to switch the caller to paying online, so that the order tells OMS to send
    them a payment link.
21. As an agent, I want the payment chip to read *Pay on collection* under pickup while the wire
    value never changes, so that the word matches the call without inventing a third payment kind.
22. As an agent, I want a `Receivable` value I cannot word to draw no wording at all rather than a
    wrong one, so that a reserved value the business has not asked for cannot be mis-sold.
23. As an agent, I want a forced payment type to say why (`paymentTypeForcedReason`), so that a
    control I cannot use is explained even though nothing in phase 1 can force it yet.

### The delivery fee explains itself (v1.5 · BO 786)

24. As an agent, I want a waived delivery fee to state its reason — threshold reached, or a
    promotional window — so that I can tell the caller why they are not paying it.
25. As an agent, I want the *free over …* line to keep appearing at the moment the waiver happens
    rather than vanishing exactly then, so that the screen explains itself instead of going quiet at
    the interesting moment.
26. As a developer, I want the console never to derive the waiver reason by comparing `gross`
    against `thresholdGross`, so that the rule stays in the one policy the till and the submit both
    call.

### About this item: the price check (v1.6 · BO 875)

27. As an agent, I want to expand a search row into a panel about that item, so that I can answer a
    question without adding a line to the order.
28. As an agent, I want the price check to give me the real VAT-inclusive price at the order's own
    plant, so that the number I read out is the number the caller pays.
29. As an agent, I want that number to equal the basket line's price for the same item under the
    same header, so that adding the item never contradicts what I just said.
30. As an agent, I want the `≈` estimate to stay exactly where it is on the search row, so that no
    row changes shape mid-list while I am scanning it.
31. As an agent, I want a pricing failure to be a plain refusal rather than a silent fall back to
    the estimate, so that I never read the wrong number believing it is the right one.
32. As an agent, I want the price check refused before a caller is attached and a store is chosen,
    so that I never quote a price from a store nobody picked.
33. As an agent, I want the offers on a price-checked item shown in the same promise language as the
    guidance strip, so that I learn one vocabulary and not two.
34. As an agent, I want the panel to tell me plainly when offers were **not fully checked**
    (`offersComplete: false`), so that silence never reads as *there is no offer*.
35. As an agent, I want asking *how much is that* never to pause my order entry, so that a price
    question mid-basket costs the call nothing.
36. As a developer, I want the request to carry `transactionId` and `itemNumber` and nothing else,
    so that map note 4 is enforced by the wire having no field to abuse.

### About this item: stock elsewhere (v1.7 · BO 876)

37. As an agent, I want the same panel to list which other stores hold the item, so that I can tell
    a caller where it is instead of only that we do not have it.
38. As an agent, I want that list nearest-first from the order's own store, so that the first row is
    the useful one.
39. As an agent, I want stores with no stock dropped and the order's own store excluded, so that the
    list is only ever news.
40. As an agent, I want an honest total and a *truncated* marker when there are more than ten, so
    that a capped list never reads as the whole estate.
41. As an agent, I want a store with no known distance still listed, with its distance blank, so
    that a missing coordinate never hides a pharmacy that has the item.
42. As an agent, I want a list that could not be ranked at all to say so and order by store code, so
    that I am never given a plausible ranking measured from nowhere.
43. As an agent, I want *we could not check* rendered differently from *nobody has it*, so that an
    outage is never reported to a caller as an absence.
44. As an agent, I want a stock outage not to cost me the price I asked for, so that the two reads
    fail independently in one panel.
45. As an agent, I want no control in this block that moves the order, so that an item-level
    disclosure can never re-price every line behind my back; the panel may name the store-change
    path in words.

### The address the agent creates and corrects (v1.9 · BO 878)

46. As an agent, I want to create a new address for the caller from inside the console, so that a
    new customer's order is not blocked on a screen I do not have.
47. As an agent, I want the district picker to be one searchable box rather than a city→district
    cascade, so that a caller who names their district is answered in one step.
48. As an agent, I want the ~1,000-district list fetched once and cached for the session, so that
    the picker is instant on the second call.
49. As an agent, I want a district with no delivering store visibly greyed, so that I steer the
    caller before the order refuses.
50. As an agent, I want the server's refusal to stay authoritative even when the client greys a
    district, so that there is never a second implementation of the derivation rule on this screen.
51. As an agent, I want to edit an address the caller corrects mid-call, so that a wrong street does
    not survive the order.
52. As an agent, I want editing the address **the order is using** to re-pin the store, so that the
    order never keeps a plant derived from a district the address has left.
53. As an agent, I want that re-pin to show me the same store-move preview a different address would
    have, so that a store change is always something I confirmed.
54. As an agent, I want an edit that lands in a store-less district to keep the caller's correction
    in the book and tell me the order cannot be delivered from it, so that a true address is never
    rolled back to protect an order.
55. As an agent, I want the delete control absent on the address the order is using, so that my hand
    never lands on it.
56. As an agent, I want a delete of that address refused by the server if it is ever attempted, so
    that no order reaches submit unable to build a shipping address.
57. As a developer, I want the capture payload narrowed to CC2's nine fields plus label, with the
    three constants server-stamped, so that no field the server discards looks like one it honours.
58. As a developer, I want the client to send `""` and never `null` for a field the agent cleared,
    so that the server's null-coalescing merge cannot silently preserve a value the agent deleted.

### The coupon (v1.10 · BO 879 — implementing now)

59. As an agent, I want the coupon to be the last chip in the header row, so that the one field an
    order need never fill sits at the end.
60. As an agent, I want the chip to carry the code and never the amount, so that the chip row goes
    on holding no money.
61. As an agent, I want to see every coupon on the order with what each one took off, so that I can
    read the discount back to the caller.
62. As an agent, I want to apply a coupon by typing its code and reading it back, so that a
    mis-heard code is caught before it is spent.
63. As an agent, I want a second, different coupon accepted, so that the console does not enforce a
    one-coupon rule the engine does not have.
64. As an agent, I want a duplicate code refused with `COUPON_ALREADY_APPLIED` in plain words, so
    that I stop hunting for a coupon that is already on the order.
65. As an agent, I want a rejected coupon refused plainly (`COUPON_REJECTED`), so that I tell the
    caller now.
66. As an agent, I want to remove a coupon the caller changed their mind about, so that they are not
    forced to abandon the whole order.
67. As an agent, I want a refused removal to tell me that **nothing changed** — the coupon is still
    on the order and still spent — so that I never tell the caller the discount has gone when it has
    not.
68. As an agent, I want the console to name `abandon` as the way out of a stuck coupon, so that the
    one path that reverses properly is not a secret.
69. As an agent, I want the coupon list to keep drawing even when applying is shut, so that I can
    read out a coupon on a call where a new one may not be added.
70. As an agent, I want applying a coupon refused before a caller and a chosen store, so that a real
    coupon is never burned against a store the order will not ship from.
71. As an agent, I want a shut coupon control to print its reason, so that I know whether to attach
    the caller or choose the store.
72. As an agent, I want a coupon-gated offer **stated and never offered as an add**, so that I
    cannot hand out a discount by adding a coupon SKU that burns nothing.
73. As an agent, I want a coupon-gated offer left out of the top bar's *offers within reach* count,
    so that the count keeps meaning *things I can do something about*.
74. As an agent, I want a coupon-gated offer to point me at the coupon chip, so that the card tells
    me what would actually satisfy it.

### The loyalty signup (v1.10 · BO 879 — implementing now)

75. As an agent, I want a *sign this caller up* action on the not-found lookup, so that a miss is
    the start of the next step rather than a dead end.
76. As an agent, I want the signup drawn inline in the caller rail and never as a modal, so that the
    basket stays on screen through a wait I spend talking to the caller.
77. As an agent, I want the number I already typed carried into the signup, so that I do not read it
    back twice.
78. As an agent, I want to collect two fields and no more, so that an enrolment on a phone call is
    over in one breath.
79. As an agent, I want the dialling-code line shown as a preview I can read back, so that the
    caller confirms the number that will actually be enrolled.
80. As an agent, I want the enrolled number built by the server and not by this screen, so that the
    console and CC2 can never enrol the same caller twice under two different numbers.
81. As an agent, I want to enter the code the caller reads me and confirm it, so that the enrolment
    completes on the call.
82. As an agent, I want no resend button and no countdown, so that the console never promises an
    expiry only the loyalty service knows.
83. As an agent, I want to **attach** the freshly enrolled member as a separate act, so that
    creating a caller and putting them on the order stay two decisions.
84. As an agent, I want the branch credited to the call centre and never chosen by my browser, so
    that no agent can credit an arbitrary pharmacy with an enrolment.

### The keyboard grammar (no server work)

85. As an agent, I want `↓` then `Enter` in the search box to add the highlighted row, so that I can
    put a line on the order without leaving the keyboard.
86. As an agent, I want nothing highlighted until I press an arrow, so that a one-key `Enter` can
    never add a relevance guess.
87. As an agent, I want the highlight to reset on every new search term, so that a stale highlight
    never adds the wrong item.
88. As an agent, I want the arrows inert while the item gate is shut or an add is in flight, so that
    the keyboard obeys exactly the same gate the button does.
89. As an agent, I want `Ctrl+K` to open a command palette from anywhere, including from inside a
    text box, so that my hands never have to leave where they already are.
90. As an agent, I want `Ctrl+K` inert while a confirmation sheet is open, so that a palette never
    covers a decision I have been asked to make.
91. As an agent, I want the palette to list the live actionable offers first, so that the offer strip
    finally has a keyboard path.
92. As an agent, I want the palette's offer rows read from the same view model as the strip and the
    top-bar count, so that the two can never disagree.
93. As an agent, I want a palette row for every order-level act — search, address book, change store,
    slot, source, note, attach/remove caller, fulfilment, payment, coupon, refresh — so that one key
    reaches everything the order can do.
94. As an agent, I want *Search items* in the palette, so that focus stranded on a chip has a way
    home.
95. As an agent, I want a refused verb shown as a **disabled row carrying its reason**, so that a
    question I deliberately asked gets an answer rather than silence.
96. As an agent, I want disabled rows still highlightable with `Enter` doing nothing, so that the
    reason I opened the palette for is not skipped past.
97. As an agent, I want *Place order* and *Abandon call* sorted last and never auto-highlighted, so
    that a mistyped `Enter` can never end a call.
98. As an agent, I want *Abandon* to still open its *Keep*-defaulted modal from the palette, so that
    the keyboard has no shortcut past a confirmation.
99. As an agent, I want `Esc` to close the palette or any sheet with focus restored, so that I land
    back where I was.
100. As an agent, I want `Esc` in the search box with text to clear the box and keep the caret, so
     that the next search starts without a click.
101. As an agent, I want `Ctrl+K` advertised in the search placeholder, so that the one key I have to
     memorise is written where my caret already is.
102. As an agent, I want the palette's foot to carry the four keys, so that there is no second cheat
     sheet to drift out of date.
103. As an agent, I want line verbs kept out of the palette, so that *void* stays aimed at a line I
     am looking at.

### Standing across every slice

104. As an agent, I want every new control to disappear rather than grey out when the door would
     refuse it, so that my hand never lands on something that cannot work — the palette being the one
     deliberate exception.
105. As an agent, I want every new verb to return the whole state and the screen to render it, so
     that nothing on this console is ever computed locally.
106. As a developer, I want every new mutation to mint one `requestId` and reuse it on retry and on
     confirm, so that an ambiguous retry can never double-apply.
107. As a developer, I want every new field the console does not recognise to be ignored rather than
     to break the render, so that §9's server-first shipping stays safe.
108. As a developer, I want every new surface driven against stubs before its server half lands, so
     that neither track waits on the other.
109. As a developer, I want every hand-authored fixture marked as a stub in the drive's own output,
     so that nobody mistakes a hypothesis for a capture.

## Implementation Decisions

### Where the work lands

Everything is inside `src/features/callcenter/console/`. **No new route**, no new feature folder,
one namespace (`callcenter`) throughout. `src/core/models/callcenter.ts` gains the v1.1–v1.10 field
additions; `api.ts` gains the missing verbs.

**Much of the drawing already exists and is unwired.** `FulfilmentPicker`, `PaymentPicker`,
`CouponPicker`, `SignupPanel` and their pure view models (`fulfilment-view`, `coupon-view`,
`signup-view`) were built by the prototype tickets and are proved by drives — but
`CallCenterConsolePage` passes no handler for them, so the chips do not open. **The first thing most
of these slices do is wire an existing component to a new mutation**, not draw a new one. Two
surfaces are genuinely undrawn: the *about this item* panel (price check + stock elsewhere) and the
command palette.

`api.ts` is missing eight verbs the contract now carries: `setOrderNote`, `setFulfilment`,
`setPaymentType`, `applyCoupon`, `removeCoupon`, `priceCheck`, `stockElsewhere`, plus the address
book's create/update/delete and the two signup routes. All go through `@/core/api`, all keep the
existing `withBusyRetry` discipline, and `SESSION_BUSY` stays retried here and never in `core/api.ts`.

### The chip row's final shape

The row is ordered `fulfilment · store · address|slot · source · note · payment · coupon` —
fulfilment **first** because it is the call's first question, payment and coupon **last** because
neither blocks a submit. `header-chips.ts` already owns this ordering and its `HeaderChip['id']`
union; the remaining work is the handlers.

Two chips are **conditionally absent, never empty and never disabled**: `slot` under `PickInStore`,
and the delivery region of the receipt with it. The `coupon` chip is the only chip an order may
legitimately never fill and carries no `submitBlocker`.

### The fulfilment flip is a measured invariant, not a layout

The rail's second block is **one block with two faces at the same pixels** — 226 px in both modes,
asserted by the drive rather than eyeballed. This is the acceptance test for the whole slice: if the
flip moves anything below it, the drawing is wrong.

The store chip's `derived` parenthetical is suppressed under collection **whatever `plantSource`
says**, because a capture shows `derivedFromAddress` surviving in a response that also carries
`address: null`. `header-chips.ts` already encodes this.

### `capabilityReasons` serves two consumers

One field, minted by 176, worded by both the chip row and the command palette — 153 had named
exactly this field for the palette's identical problem and deliberately not minted it. A shut
capability **removes the chip's handler** and prints its reason beside the row; in the palette the
same reason rides a disabled row. Enablement is always the `capabilities` boolean and the reason is
always a separate lookup, so a missing reason degrades to a vague sentence and never to a wrong
refusal.

### The coupon's three hard rules

**A shut gate is not a shut chip.** `canApplyCoupon` gates *applying*; the list projects regardless,
because an order may hold a coupon the agent must read out on a call where a new one may not be
applied. From the prototype's view model, which encodes exactly that split:

```ts
export function couponSurface(header, capabilities): CouponSurface {
  const coupons = appliedCoupons(header)          // always projected
  const canApply = capabilities.canApplyCoupon !== false
  return {
    coupons,
    canApply,
    applyReason: canApply ? null : (capabilities.capabilityReasons?.canApplyCoupon ?? null),
    canRemove: capabilities.canRemoveCoupon === true,   // never derived from coupons.length
  }
}
```

`canRemove` is deliberately **not** derived from `coupons.length` — whether a remote reversal hop can
be attempted is the server's answer, not a count.

**`COUPON_REVERSAL_REFUSED` means nothing changed.** The server reverses before it voids, so a
refusal leaves the order byte-identical and the coupon still on it — the opposite of what a failed
remove usually means. The console must say that in those words and name `abandon` as the escape.

**A coupon-gated near-miss is a fourth guidance class.** `guidance-view.ts` gained it as a class of
its own rather than folding it into `actionable`, so the top bar's count is unaffected:

```ts
export type GuidanceClass = 'actionable' | 'counted' | 'unavailable' | 'needsCoupon'

function classOf(miss: NearMiss): GuidanceClass {
  if (typeof miss.skipReason === 'string' && miss.skipReason !== '') return 'unavailable'
  if (miss.prereq?.kind === 'coupon') return 'needsCoupon'
  return miss.isReady === true ? 'counted' : 'actionable'
}
```

### The signup is a step machine in the rail

Four steps, no modal, from the prototype's view model: `'closed' | 'details' | 'otp' | 'created'`.
It hangs off the not-found lookup on ordinary ground (a miss is not a failure), carries the number
already typed, collects two fields, and **ends at an Attach button** — a freshly enrolled caller does
not skip 165's two steps. No resend, no countdown.

The dialling-code line is a **display preview only**. The console sends `{ countryCode, mobile }` as
typed and the server builds the enrolled number; `BranchId` leaves the wire entirely. Both are
server obligations on 879 — if the server has not yet moved, the console still must not implement
either rule locally.

### The about-this-item panel is one surface, two calls

The expansion of a search row. Two independent TanStack queries, gated together on
`capabilities.canPriceCheck` (= `canAddItem`'s predicate), rendered together and **failing
separately**: the price is a lock-free engine run inside SIS.Api, the stock is the only remote HTTP
hop on the contract.

- The price check renders `unitPrice.gross` in a money column **with `SAR`** — it is engine money and
  that is the point. The `≈` estimate keeps its meta-line home on the row and never moves into the
  money column; the two numbers coexist and never swap places.
- The offers region holds **no figure formatted as money at all** — the same promise language as the
  guidance strip, and the region can guarantee it absolutely because it holds no engine money.
- `offersComplete: false` prints *offers were not fully checked*. It flips to `true` with **no client
  change**.
- Stock renders three ways, matching 135's ATP rule: a count, *none at store*, and *we could not
  check* — `available: false` means **unknown**, not empty.
- `distanceKnown: false` orders by store code and says the list is unranked; a row's own null
  distance draws blank and the store is never dropped.

### The address book's two order-touching acts

After a successful `PUT` of the address whose `addressNumber` equals `header.address.addressNumber`,
the console **re-issues `setAddress` with that same number**. No new verb: `setAddress` already
carries the re-derivation, already raises the `storeChange` confirmation when there are lines, and
already refuses `NO_DELIVERY_STORE_FOR_DISTRICT`. The one server obligation is negative — that call
must not be short-circuited as a no-op.

The delete control is **omitted** on the current row (`AddressChoice.isCurrent` already exists) and
the server refuses it with `ADDRESS_IN_USE_BY_ORDER`. The refusal is the guard; the omission is the
courtesy.

The capture payload is CC2's nine fields plus label, three constants server-stamped. The client sends
`""` and never `null` for a cleared field, because `UpdateCustomerAddress` is a null-coalescing merge
— an omitted field is preserved, so a field can never be emptied by omission.

### The keyboard grammar

Two independent pieces:

**In-box.** `↓`/`↑` move a highlight over the search results; nothing is highlighted until the first
press; the highlight resets on every new term; both are inert while `add.onAdd` is null or an add is
in flight. `Enter` on a highlighted row calls the **same handler the row's button calls**, reading
`capabilities.canAddItem` from the same prop — never a second predicate.

**The palette.** A `core/ui/Modal` native `<dialog>`, so focus trap and restore are free. `Ctrl+K`
must `preventDefault()` (it is Chrome's omnibox key and is interceptable) and is **inert while any
dialog is open**. Rows come from `SessionState` in order: actionable offers (read from the strip's
own view model, so the palette and the top-bar count cannot disagree), then order verbs, then the two
terminal acts sorted last and never auto-highlighted.

No single letters, no `Alt` chords, no `?`, no `F1`. `Alt+1..3` for the offer strip was rejected
because the cards re-order, so the number is a position rather than an offer.

### New i18n keys

All under the existing `callcenter` namespace, added in the same change that uses them: the two axis
chips and their modals, `deliveryFee.waivedReason.*`, the about-this-item panel including its three
ATP wordings and its unranked/unavailable states, the address editor and its district picker, the
coupon modal (including a distinct key per shut reason and the *nothing changed* sentence), the
signup steps, the palette's rows and foot, and `guidance.needsCoupon`. `chips.coupon`, `coupon.*`,
`signup.*` and `guidance.needsCoupon` already exist from the prototype work.

### What ships against a stub, and what waits

Every slice can be built and driven now. What each needs from the server before it is *true*:

| Slice | Waits on | Already on the wire? |
|---|---|---|
| Order note | 871 | verb specified, unbuilt |
| Fulfilment + payment | 877 · 871 | v1.8/v1.4, unbuilt |
| Delivery fee reason | 786 §2 | v1.5, unbuilt |
| Price check | 875 | v1.6, unbuilt |
| Stock elsewhere | 876 | v1.7, unbuilt |
| Address create/edit/delete | 878 · 801 | routes shipped, rules unbuilt |
| Coupon | **879, implementing now** | `applyCoupon` shipped; projection, `removeCoupon` unbuilt |
| Signup | **879, implementing now** | ✅ both routes shipped and gated; `BranchId` still on the wire |
| Keyboard | — | **nothing** — every gate is a `capabilities` field already held |

The keyboard slice is the only one with no server dependency at all, which makes it the safest to
land first and the one whose value does not move if the server slips.

## Testing Decisions

A good test asserts **observable behaviour at a module's edge** — the class a near-miss projects, the
words a chip carries, the surface a capability opens, the step a signup machine advances to — and
never how the module got there. No test asserts internal state, call ordering, or a React detail.

**Ruled 2026-07-29, carrying 160's ruling forward: this spec does NOT bootstrap React Testing
Library.** Spec 083's standing ruling holds and every ticket since has followed it — the pure modules
carry the regression risk, the components are thin renderers, and a UI slice is verified by driving
the real app plus `typecheck`. The cost is named again: the modal flows and the in-flight states get
**flow coverage only**, with no fast component-level net.

**Tier 1 — pure, in-memory (`vitest`, `environment: node`, the existing runner).** The pattern is
established and half of these modules already exist with suites:

1. **`fulfilment-view`** *(exists)* — mode in, the block's face and the payment chip's word out;
   `Pay on collection` under pickup while the wire value is unchanged; `capabilityGate` over the
   three gated capabilities.
2. **`coupon-view`** *(exists)* — the list projects while `canApply` is false; `canRemove` is the
   server's boolean and **never** `coupons.length > 0` (a case that would fail if anyone derived it).
3. **`signup-view`** *(exists)* — the step machine's legal transitions; `mobilePreview` is display
   only and SA-only; `canSendCode` / `canConfirmOtp` predicates.
4. **`guidance-view`** *(exists, extended)* — the fourth class: a `coupon` prereq is `needsCoupon`,
   is **not** counted in the actionable total, and an unknown future kind still degrades safely.
5. **`header-chips`** *(exists, extended)* — the final ordering; `slot` absent under pickup; the
   `derived` parenthetical suppressed under collection **even when `plantSource` says otherwise** —
   driven by the real capture that contains exactly that contradiction.
6. **`submit-blockers`** *(exists, extended)* — `STORE_NOT_CHOSEN` resolves to real words and lands
   on the `store` chip; an unknown code still degrades to the unknown phrase.
7. **`price-check-view`** *(new)* — conditions and offers projected; the no-money-in-the-offers-region
   property asserted in the **narrow** form over a fixture whose BBY description deliberately contains
   a currency word; `offersComplete: false` produces the *not fully checked* state.
8. **`stock-view`** *(new)* — the three-way availability rendering; `distanceKnown: false` orders by
   code and marks itself unranked; a null row distance never drops a store; `available: false` is
   unknown and not empty.
9. **`palette-model`** *(new)* — row order (offers, verbs, terminals last); terminals never
   auto-highlighted; a disabled row is highlightable and inert; the highlight resets on a new query.
10. **`address-book`** *(exists, extended)* — `isCurrent` suppresses delete; the capture payload
    narrows to the ten fields; a cleared field serialises as `""` and never `null`.
11. **Fixture shape conformance** *(exists, extended)* — every v1.1–v1.10 payload parses into the
    model types and satisfies the contract's invariants; `wouldSave` still appears nowhere.

**Tier 2 — flow (Playwright drive, manual-run, against stubbed fixtures at the route layer).** Prior
art on this feature alone is now six drives: `callcenter-drive.mjs`, `callcenter-guidance-drive.mjs`,
`guidance-138-drive.mjs`, `header-175-drive.mjs`, `fulfilment-176-drive.mjs` (90/90) and
`coupon-159-drive.mjs` (84/84). The last two already cover their slices as prototypes and should be
**re-pointed at the wired console** rather than rewritten.

New drives: one for the about-this-item panel (both reads, both failure modes, all three ATP
wordings, the unranked list), one for the address editor and its two order-touching acts, and one for
the keyboard grammar — which must assert the **negative** cases as hard as the positive ones: `Enter`
with nothing highlighted adds nothing, `Ctrl+K` over an open sheet does nothing, and no key sequence
reaches submit or abandon without a modal.

Two assertions carried forward from 138 and 176 because both were learned the hard way:

- **A clamped region hides the cost of new content.** Assert what is **visible**, not how tall a
  region is.
- **Measure the flip, do not eyeball it.** The rail block's height is asserted identical across the
  mode flip; the drive fails if anything below it moves.

**Stubs are labelled as stubs.** 177's rule stands and 159 already applies it: a drive standing on
hand-authored fixtures says so in its own output. As the server slices land, each fixture is replaced
by a capture as one event per slice, and the `unreachable-*.json` tier stays outside
`.issues/assets/` so nobody mistakes it for a capture.

**Known red before this spec starts.** `tools/callcenter-drive.mjs` fails on a clean tree at
`[data-cc-search-add="200145"]` — 175's opening gate makes the search row's *Add* absent and the
drive predates it. It is a real broken gate, not a flake, and whichever ticket touches the search
surface first should fix the drive as part of its work.

## Out of Scope

**Ruled out and staying out** (map 126's own list, unchanged): every non-CLCN order kind (Nphies,
Wasfaty, insurance, P2E); `replaceLine`, placeholder/text lines and prescription controls; the web
till; **any price-affecting operator power**; the physical CC device's origin setup; a multi-call
agent shell; the legacy POS; the pre-existing PII exposure on the shared `SdDocument/*` and `Loy/*`
routes (BackOffice 802); and a store rebind with no operator action.

**Ruled out on their own tickets:**

- **The SMS referral** from the stock panel — the till can text a customer a map link; that is new
  outbound-messaging power with its own consent design.
- **The SAP bonus-buy detail modal** — out of phase 1, which is what keeps the console off `Bby/*`
  entirely.
- **Any control in the stock panel that moves the order** — read-only by ruling, not omission.
- **A manual delivery-fee waiver** — `waived` is an outcome shown, never a control.
- **Quantity on the price check** — one unit by owner ruling.
- **Single-letter and `Alt` keyboard chords, `?`, `F1`** — rejected with reasons on 153.
- **Line verbs in the palette** — the palette is one level deep and its object is the order.
- **Absorbing the sidecar into `PosTransaction`** — raised and withdrawn by the owner on grounding
  (178); returns as its own effort if ever wanted.

**Still fog on map 126, and not this spec's to answer**: the latency budget and where it is watched;
observability and ops (web CC attempts never reach `PosIntegrationAttempt`); price-parity assurance
web vs till; Arabic/RTL for the console as a whole **layout**; and rollout — whose hard prerequisite
is already ordered by 134 (every agent bound to `CALL_CENTER_AGENT` in Authz Admin, query-verified,
**before** the SIS.Api carrying the grant filter deploys).

## Further Notes

**Read the contract, not this spec, for any wire shape.** CONTRACT.md is at v1.10 with a full
amendment table and a §9 revision protocol. Every revision in this spec's range was **additive and
minor**, which is why the console can be built ahead of the server and why an unknown field must be
ignored rather than fatal.

**Three deploy-time verifications belong to the server track but will surface here first if they are
missed.** The call-centre store row must exist before signup stamping works (128 recorded it exists;
879 makes it a deploy step). The store-coordinate columns SIS.Stock reads are documented by another
team as present "in some environments but not others", so the stock ranking rests on a pair worth
query-verifying. And 134's grant binding must be query-verified per user **before** the SIS.Api
deploy, or every agent is silently refused.

**One open money question sits under the coupon slice and is 879's first job.** Capture 02 already
offers a coupon SKU (`COUPT173`) as an addable near-miss prerequisite. Adding it either qualifies the
bonus buy while burning nothing — the discount given away free — or is refused by the no-price
back-out. Which one happens depends on whether the campaign SKU carries a price. **Both are wrong**,
and the client's `prereq.kind: "coupon"` handling is correct either way, so this spec does not wait on
the answer.

**The pattern that produced most of these decisions**, worth carrying into the build: six tickets in a
row turned into findings rather than restatements by reading what the ticket already **inherited**
before designing anything — and 159 narrowed it further, because what had to be distrusted was the
ticket's own declaration that nothing was open. A claim of completeness written weeks before the work
is the sentence to check first.
