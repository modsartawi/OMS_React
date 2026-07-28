---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: done
blocked-by: —
---

# 175 — The order opens, and nothing may go into it yet

## Question

**Owner gap review #2, 2026-07-28**, driving the built console. Two of the four findings are the
same finding from two sides: **the console opens ready to take items, and it should not be.**

The facts, verified in the code and in the v1.2 captures:

- **Items are enterable with no caller.** `01-open-empty.json` ships `canAddItem: true` on an order
  with `customer: null`, and `CallCenterConsolePage.tsx:1391` passes `onAdd` straight through from
  it. Nothing anywhere gates the search panel on an attached customer.
- **The store is chosen for the agent and never explained.** The same fixture seeds `plant` from the
  agent's entry store with `plantSource: "operatorOverride"` — its own note says *"an operatorOverride,
  not yet derived"* — and `header-chips.ts:68` only draws the *derived* parenthetical for
  `derivedFromAddress`. So the one chip that exists to make an unchosen store read as **explained**
  (135's progressive-collapse ruling) says nothing at all in the case that is true at open. [154](154-fulfilment-mode-and-store-choice.md)
  recorded this as contract hygiene; the owner has now raised it as the behaviour itself.

**Owner rulings, 2026-07-28** — the inputs, not the answer:

1. **The caller comes first, as in CC1/CC2.** Attaching the customer is the first act of every
   order; items are blocked until then.
2. **The agent should pick the store**, not be given one.

Ruling 2 is the hard one, because it reopens **map note 6**: the engine binds `PcHeader.Plant`
**once at open** (`PosTransaction.cs:883`), and [129](129-rebind-store-door.md)'s whole door exists
because that binding is expensive to move. An order with no plant is not a thing the engine can hold.
So this ticket is not "stop seeding the plant" — it is:

- **What does `open` bind, and what does the console show?** If the engine must have a plant, the
  seeded entry store stays *inside* the transaction while the console treats it as **not yet chosen**
  — a chip in an `unset`/attention state, not a settled fact. Is that honest, or is it a lie by
  omission on the one field that decides every price and every ATP read?
- **What actually gates `canAddItem`?** Today it is the door's answer. If the console needs *caller
  attached* **and** *store confirmed* before the first line, that predicate belongs on the server
  (the same reasoning that keeps `submitBlockers` the only thing that dims *Place order*), which
  makes it a contract change and not a client rule.
- **`plantSource` needs a vocabulary that covers the truth.** It has no value meaning *seeded at
  open, nobody chose it* and none meaning *chosen for pickup* (154's own open note). Adding values is
  additive (§9 minor); changing what `canAddItem` **means** is not.
- **Does confirming the seeded store count as choosing it?** An agent whose caller is collecting from
  the store they are sitting in should not have to re-pick it — but a one-click *Yes, this store* is a
  different act from a chip that was already settled, and only one of them leaves a record.
- **What does the console look like in the gap?** 135 already drew *customer attached, no address
  yet*; this adds **order open, nothing attached** as the console's true opening state, and 137's
  ordering constraint (the address book is server-side unreachable before attach) already points the
  same way. The centre column must read as *intended sequence*, never as *everything is disabled*.

⚠ **Contract impact.** New `plantSource` values are additive; *"items are refused until a caller and
a store exist"* changes the meaning of `canAddItem`, which is a **major** under §9 and needs a dated
amendment with the owner's ruling, not a quiet edit. Coordinate with
[177](177-v1.2-captures-land-on-the-client.md) — the contract is mid-revision from first integration.

Deliverable: the ruling on the opening sequence, written as the contract amendment plus whatever
BackOffice issue the server half needs, and the console states 135's list gains.

---

## Answer — 2026-07-28

**An order opens holding a plant it cannot yet be trusted with, and refuses items until a human has
supplied both halves of the header that decides every price.** Contract goes to **v1.3, additive**:
[CONTRACT.md §2.3](assets/136-cc-contract/CONTRACT.md), dated in §10. Server half: BackOffice
[871](C:\Work\DMSCO\BackOffice\.issues\871-cc-opening-gate-and-plant-source.md).

### The ruling, in one predicate

```
canAddItem  =  status == "open"  &&  customer != null  &&  plantSource != "seededAtOpen"
```

The ticket asked three questions and they collapse into that line.

**"What does `open` bind, and what does the console show?"** — `open` still binds the plant, seeded
from the agent's `entryStore`. It has to: the engine binds `PcHeader.Plant` once
(`PosTransaction.cs:883`) and an order with no plant is not a thing it can hold, so map note 6 and
[129](129-rebind-store-door.md)'s whole premise are untouched. What was dishonest was never the
seeding — it was that the console reported the seeded value as a **settled fact**. The fix is a
label, not a rebind: `plantSource: "seededAtOpen"` says *nobody chose this*, and the chip reads as
unchosen because the wire says so.

That answers the ticket's own sharpest question — *"is that honest, or a lie by omission on the one
field that decides every price?"* It was a lie by omission, and the omission was a **missing
vocabulary word**, not a missing mechanism. `plantSource` had four states in reality and two names.

**"What actually gates `canAddItem`?"** — the server, in SIS.Api's session service. The ticket
predicted this ("the same reasoning that keeps `submitBlockers` the only thing that dims *Place
order*") and it holds for the same reason: a console that re-derives the rule is a second
implementation that can disagree with the server on a live basket.

**"Does confirming the seeded store count as choosing it?"** — yes, and it is **pick-in-store only**.
`setStore` carrying the store the order already holds advances `plantSource` to `chosenForPickup`;
the plant does not move, so §5.1 raises no confirmation and nothing re-prices. The entire effect is
that a choice is now on the record — which is precisely the difference the ticket named between "a
chip that was already settled" and "a one-click *Yes, this store*": **only one of them leaves a
record**, and now it does. Under delivery there is no shortcut, because the address is what chooses
the store.

### 🚩 The correction that mattered most

Session 1 recorded a hope: *"`IsCustomerRequired = false` sits right beside the GS1 flag — the engine
already carries the flag that expresses ruling 1, so the server half may be far smaller than this
ticket assumed."*

**That is wrong, and acting on it would have broken every web `open`.** `IsCustomerRequired` is an
**open-time** validation of `options.CustomerId` that throws `InvalidOperationException`
(`PosTransaction.cs:916`) — evaluated once, before any line exists. It cannot express *caller before
items*; it expresses *caller before the transaction*. And the `CallCenterOrder` catalogue row sets it
`false` deliberately, with the reason written down: *"the CC customer rides a `LoyaltyCustomer` line
+ `SetLoyaltyAsync`, not `options.CustomerId`; requiring one would brick `OpenAsync`"*
(`DocumentTypeCatalog.cs:735`). Flipping it `true` makes `open` throw for every agent.

871 carries this as a **negative Done-when** — assert the flag is unchanged — so the next reader who
spots it does not "fix" it. The lesson generalises: a flag whose *name* matches your rule is not
evidence; the enforcement site is.

### The other rulings, as landed

| | |
|---|---|
| `plantSource` | four values: `seededAtOpen` · `derivedFromAddress` · `operatorOverride` · `chosenForPickup` |
| Refusals | reuse `NO_CUSTOMER_ATTACHED`; add `STORE_NOT_CHOSEN` (409) |
| The chip | says *not chosen* through a `STORE_NOT_CHOSEN` **submitBlocker** — never a client rule, so `header-chips.ts`'s one-table discipline holds |
| Gate shut | the item command line is **absent, not disabled** — a control the door refuses is worse than none, and search prices its estimate at the order's plant |
| 135's states | gains `opening` and `storeUnchosen`; **`empty` is re-defined** as gate-open, basket-empty |
| Arrangement | **variant 4** — v3's chip bar at rest, v2's full section when one opens, one command line reaching both; `Ctrl+K` **folds into** the `/` grammar rather than being a second surface |
| Version | **minor, v1.3** — reasoning in §10's *"Why 1.3 and not 2.0"* |

### The owner's four rulings this session

1. **`NO_DELIVERY_STORE_FOR_DISTRICT`** — the owner did not confirm the code as asked; they answered
   the question underneath it: 🚩 ***"we will not save the storeCode in the customer address, it will
   be identified while we are creating the order."*** That confirms the CC2 reading
   ([inventory §0.1](assets/175-cc2-inventory/CC2-INVENTORY.md)) — the address is pure customer data,
   the store is a property of the geography resolved at pick time — and it is *why* the hard block
   needs a code at all: the failure is a **derivation failure at order-creation time**, not a bad
   address. So the code ships (409, business, on `setAddress`), and the district row stays visible
   and unpickable. ⚠ It also means the same saved address can derive a different store next week,
   which is exactly why `plantSource` is a property of **the order** and not of the address.
2. **The order note is in** — and the owner's answer went much further than the question (below).
3. **P2E-forces-online and the delivery-only sources are IN**, and *"already there, in the
   `PosTransactionOrder` (`DocumentSource`)"*. Source rules are not kind rules; phase 1 has sources.
   ⚠ *"but we might need the payment type"* — that lands on
   [155](155-payment-type-cod-or-online.md), which now has a forcing input it did not have.
   The density toggle and the launch seeds were **not** selected — ruled out of scope.
4. **`removeCustomer` with lines keeps the lines.** Clears caller and address, keeps the basket and
   the plant, does **not** rewind `plantSource`. The gate shuts, the command line disappears,
   re-attaching re-opens it. The ordinary "wrong caller, same items" correction must not cost the
   basket. No WPF precedent — CC2 has no basket, so the state cannot arise there; the web creates it,
   the same way 154's mid-basket fulfilment flip was created.

### 🚩 The finding that outgrew this ticket

Answering the order-note question, the owner ruled on something much larger:

> *"we will need `PosTransactionAddress` for example, to have the address in the pre-order object
> (`PosTransaction`) … since we are moving to web and it's stateless, we should save everything
> inside the `PosTransaction` object."*

That is a ruling against [CONTRACT.md §1.2](assets/136-cc-contract/CONTRACT.md)'s **two-store join** —
the `CallCenterSession` sidecar — and it has real ground under it: `PosTransactionSnapshot` already
carries 1:1 companions of exactly that shape (`Loyalty`, `Insurance`, `Order`), and `TransactionOrder`
persists as `PosTransactionOrderEntity` through `SetOrderInfoAsync`, round-tripping via `ResumeAsync`
and **already holding `DeliveryType`** — the field v1.1 put in the sidecar. So `PosTransactionAddress`
extends a shipped pattern rather than inventing one, and absorbing the sidecar would dissolve §6.4's
two-store write ordering, which 136 named *"the single most fragile thing in the contract."*

**It is not resolved here, and it did not need to be.** Every field is projected into `SessionState`
identically whichever side stores it — the client never sees the storage — so v1.3 shipped without
waiting. But deleting a hazard is a bigger claim than adding a field, and §6.4 is a live
acceptance-test obligation on
[804](C:\Work\DMSCO\BackOffice\.issues\804-cc-session-contract-server-obligations.md). Minted as
[178](178-the-transaction-absorbs-the-sidecar.md), with the residue questions the ruling leaves open
(the `requestId` ledger and confirm tokens are **protocol**, not order data; the snapshot schema
version is shared with every till; 133's builder input moves with the fields). §1.2 carries a flag
pointing at it.

### What else came out of the CC2 read-through

- **The two-list correction to [154](154-fulfilment-mode-and-store-choice.md)** — recorded on that
  ticket. Delivery reads the address book + the district's assignment; collection reads the estate.
  154's *"whole estate, unfiltered"* stands **for collection only**.
- **`plantName` stays server-supplied** — a delivery-only store (e.g. `1402`) is in no client-held
  list, so a client-side lookup cannot name it. Noted in §2.
- **The address editor is a hole** — nine fields, a server label catalogue, SPL format-only
  validation, and the one-box location search that is *not* a cascade. Minted as
  [179](179-the-address-editor-and-its-capture-contract.md). Loyalty-customer **creation** was
  already [159](159-coupon-and-loyalty-signup-drawn.md)'s — the read-through only added three details
  to it (`BranchId` is the agent's store, the language choice is the *customer's*, the referral rule
  is verbatim legacy), recorded on 179 rather than duplicated as a ticket.
- **BackOffice [872](C:\Work\DMSCO\BackOffice\.issues\872-callcenter-order-inherits-gs1-required.md)**
  — `DocumentTypeCatalog.cs:739` never sets `IsGs1Required`, whose default is `true`, so the engine
  demands a scan for a serial-controlled article on an order captured over the phone. Live on the WPF
  path too; the web is just the first thing that will trip over it. One line, in the shape the row's
  own *"silence is not neutral"* comment already demands.

### What this unblocks

[176](176-fulfilment-mode-drawn.md) — its drawing is already done in the prototype (fulfilment as two
full-sentence choices, not a toggle) and the opening sequence it was waiting on is now ruled.

---

## Comments

### Session 1, 2026-07-28 — rulings taken, prototype built, ticket left OPEN

Released back to `open` at the owner's request; the **written deliverable is still
owed** (the ruling, the contract amendment, the BackOffice issues). Everything
below is settled input for whoever picks it up — none of it needs re-deriving.

**Owner rulings taken:**

1. `canAddItem = status open && customer != null && plantSource !== 'seededAtOpen'` —
   caller *and* a store somebody chose, as one predicate on the server.
2. `plantSource` gains **four** values: `seededAtOpen | derivedFromAddress |
   operatorOverride | chosenForPickup`.
3. The one-click *Yes, this store* confirm is **pick-in-store only**. Under delivery
   the address is what chooses the store, which makes [137](137-callcenter-web-door.md)'s
   ordering constraint enforce caller-first by construction.
4. The store chip says *not chosen* through a new **`STORE_NOT_CHOSEN` submitBlocker** —
   never a client-side rule, so `header-chips.ts`'s one-table discipline holds.
5. **Minor, v1.3.** `canAddItem`'s definition ("what the server will accept right now")
   is unchanged; only its answer moved. Same reasoning that made 154 a 1.1. Dated §10
   amendment anyway.
6. Refusals: reuse **`NO_CUSTOMER_ATTACHED`**, add **`STORE_NOT_CHOSEN`** — one new code.
7. Gate shut ⇒ the item command line is **absent, not disabled** (a control the door
   refuses is worse than none, and search prices its estimate at the order's plant).
8. 135's state list gains **`opening`** and **`storeUnchosen`**; **`empty` is re-defined**
   as gate-open, basket-empty.
9. **Arrangement: variant 4** — v3's chip bar at rest, v2's full section when one opens,
   one command line reaching both. `Ctrl+K` **folds into** the command line's `/` grammar
   rather than being a second surface.
10. A district with **no `StoreCode` and no `TempStoreCode` is a HARD BLOCK** — the row
    stays visible and unpickable, saying why.

**The prototype** — `/prototype/callcenter-header`, files
`src/features/callcenter/__prototype__/header/`, drive `tools/header-175-drive.mjs`
(129 assertions), captures in [assets/175-header-prototype](assets/175-header-prototype/).
Commits `8df107b`, `5ad5f5b`, `df1abb9`. The add loop is **interactive** — type,
`Enter`, `3*panadol`, `Ctrl+Z`, `/` — because no screenshot can argue it.

**Read the CC2 inventory first:**
[assets/175-cc2-inventory/CC2-INVENTORY.md](assets/175-cc2-inventory/CC2-INVENTORY.md).
Three of its findings correct rulings this map already took.

### What is still OWED

- **The `## Answer`** — none of the above is written up as the ticket's ruling yet.
- **CONTRACT v1.3** — the four `plantSource` values, `STORE_NOT_CHOSEN` (blocker *and*
  §7 code), the tightened `canAddItem`, plus a dated §10 amendment.
- 🚩 **A §7 code for the hard block.** *"This district has no delivery store"* is a
  refusal `setAddress` must make and the contract cannot currently express. Proposed
  `NO_DELIVERY_STORE_FOR_DISTRICT` (409, business) — **not yet owner-confirmed.**
- 🚩 **An address-capture contract.** `CallCenterWeb/CustomerAddresses*`
  ([801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md)) must carry the
  **nine** fields CC2 writes, the **server label catalogue**, and the SPL format check.
  Nothing on the frozen contract covers creating or editing an address.
- 🚩 **The two-list correction to [154](154-fulfilment-mode-and-store-choice.md)** —
  delivery reads the address book + district assignment, collection reads the estate.
  154's *"whole estate, unfiltered"* stands for collection only.
- **BackOffice issues for the server half**, including two found on the way:
  - `DocumentTypeCatalog.cs:739` — the `CallCenterOrder` row never sets
    **`IsGs1Required`**, so it inherits the catalogue default `true` and the engine
    demands a scan for a serial-controlled article. Nothing physical exists to scan on a
    call-centre order. One line, same treatment training/internal-transfer doctypes get.
  - Beside it, **`IsCustomerRequired = false`** — the engine already carries the flag that
    expresses ruling 1, so the server half may be far smaller than this ticket assumed.
- **`plantName` must stay server-supplied** — a delivery-only store (e.g. `1402`) is in no
  client-held list, so a client-side lookup cannot name it.
- **Unticketed CC2 features** to raise or waive: the **order note**, the **density
  toggle**, and the **launch seeds** (`KindLocked` / `SourceLocked` / `DeliveryOnly`).
- **Open boundary question:** order *kinds* are out of phase 1 by owner ruling, but
  **P2E-forces-online** and the **delivery-only sources** are *source* rules and phase 1
  has sources. Kept in scope pending confirmation.
- **`removeCustomer` with lines on the order** — the gate makes this reachable and it has
  no WPF precedent (CC2 has no basket). Never put to the owner.
- [176](176-fulfilment-mode-drawn.md) is blocked on this ruling and its drawing is already
  done in the prototype (fulfilment as two full-sentence choices, not a toggle).

### Session 2, 2026-07-28 — the owed list, closed

Everything under **What is still OWED** above is discharged by the `## Answer`. Line by line, so
nobody re-derives it:

| Owed | Where it went |
|---|---|
| The `## Answer` | written |
| CONTRACT v1.3 | [CONTRACT.md](assets/136-cc-contract/CONTRACT.md) §2.3 + §6.3 + §7 + §10 |
| 🚩 §7 code for the hard block | owner-ruled; `NO_DELIVERY_STORE_FOR_DISTRICT` ships |
| 🚩 Address-capture contract | outgrew this ticket → [179](179-the-address-editor-and-its-capture-contract.md) |
| 🚩 Two-list correction to 154 | written onto [154](154-fulfilment-mode-and-store-choice.md), with the owner's *store-is-not-on-the-address* ruling as its reason |
| BackOffice server half | [871](C:\Work\DMSCO\BackOffice\.issues\871-cc-opening-gate-and-plant-source.md) |
| `IsGs1Required` | [872](C:\Work\DMSCO\BackOffice\.issues\872-callcenter-order-inherits-gs1-required.md) |
| `IsCustomerRequired` "may be far smaller" | 🚩 **wrong** — see the Answer's correction; 871 asserts the flag unchanged |
| `plantName` server-supplied | noted in CONTRACT §2 |
| Order note / density / launch seeds | owner: note **in** (v1.3 field + verb); density and seeds **out of scope**, on the map |
| P2E-forces-online + delivery-only sources | owner: **in**; payment-type consequence → [155](155-payment-type-cod-or-online.md) |
| `removeCustomer` with lines | owner: **keeps the lines**; CONTRACT §6.3 |
| 176 blocked | unblocked |

One thing the session added that was not on the list: the owner's sidecar ruling, carried whole to
[178](178-the-transaction-absorbs-the-sidecar.md).
