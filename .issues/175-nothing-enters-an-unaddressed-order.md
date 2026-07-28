---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: claimed
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
