---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: open
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
