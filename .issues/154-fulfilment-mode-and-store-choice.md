---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: done
blocked-by: —
---

# 154 — Fulfilment mode, and how the store gets chosen when nothing derives it

## Question

**Owner-reported gap, 2026-07-27.** The console draws neither fulfilment mode nor a manual store
pick, and the reason is upstream of the drawing: **contract v1.0 has no fulfilment-mode axis at all.**
No verb, no `header` field, no `capabilities` flag. It is not on 126's out-of-scope list either — it
fell between [132](132-header-capture-inventory.md), which established the fact, and
[136](136-session-api-contract.md), which froze without it.

The fact, with evidence:

- `Cc2DocumentHeaderBuilder.cs:29-31` writes `DeliveryType = DocumentDeliveryTypeConstants.Delivery`
  or `.PickInStore` onto the CLCN document header. It is a real, persisted field.
- CC1's `NewOrderController.cs:447-481` — `IsDelivery` sets `ShippingMethod = "shipping_shipping"`
  and **collapses** the store picker; `IsPickInStore` sets `"storepickup_storepickup"` and **shows**
  it. The store is derived under delivery and chosen under pickup, exactly as the owner described.
- 132 already ruled the policy side a no-op: *"For CLCN both modes are always permitted. Carry the
  shape, ship the constant"* (`DocumentSourcePolicyService.cs:23-43`).

So the mode itself is cheap. What is not cheap is that **pick-in-store unwinds four settled
rulings**, because every one of them was reasoned on the delivery path:

- **[129](129-rebind-store-door.md) pinned plant derivation at the address act.** Under pickup there
  is no address to derive from, so the store becomes the **primary input**, not an override. Is
  `setStore` still a rebind-with-confirmation when it is the agent's *first* act, or does mode
  selection precede the first line and make the confirm path unreachable?
- **Map note 6** requires the store known before the first item (`PcHeader.Plant` binds once at
  open). Under pickup that means picking a store before anything can be priced — a different opening
  move for the whole console, and 135's caret-on-phone-field ruling assumes the delivery one.
- **[137](137-callcenter-web-door.md)'s attach-before-address ordering constraint** was built around
  the delivery path. Does a pickup order need an address at all? If not, `capabilities` needs to say
  so or the console will demand one.
- **Slot and delivery fee both presuppose delivery.** A pickup order with a delivery fee is a bug;
  a pickup order with a delivery slot is a question ([156](156-delivery-fee-shared-rule.md) owns the
  fee half).

Also settle: **can the mode change mid-basket?** CC1 gates it (`CanEditOrderType = false` outside
`OrderFormStatus.New`). If it can, a delivery→pickup flip is a plant rebind by another name and must
ride 129's door; if it cannot, that is a `capabilities` flag and a much smaller contract.

⚠ **Contract impact.** New optional fields are additive (§9 minor bump), but *"address optional,
store chosen not derived, no delivery fee"* changes the meaning of fields already frozen — which is
a **major** under §9 and needs the owner's ruling as a dated amendment, not a quiet edit.

Deliverable: the ruling on the mode axis and the pickup store-choice flow, written up as the
contract amendment 136 must carry, plus whatever BackOffice issue the server half needs.

## Answer — 2026-07-27

**Both modes ship in phase 1** — owner ruling, *"these are the bare minimum"*. Contract goes to
**v1.1, additive**, with a dated §10 amendment: [CONTRACT.md §2.2](assets/136-cc-contract/CONTRACT.md)
plus fixture [09](assets/136-cc-contract/09-fulfilment-flip.json). Server half: BackOffice
[826](C:\Work\DMSCO\BackOffice\.issues\826-cc-fulfilment-mode.md).

### The reframing: three facts that dissolved most of the question

The ticket's premise was that pick-in-store unwinds four settled rulings. Read against CC1/CC2, three
of the four never had to unwind — the question was sharper *and* smaller than it looked.

1. 🚩 **The WPF console has no basket.** CC2's view models contain **no line or item entry at all**;
   the header is captured and `PosHandOffTarget` hands off to POS, which rings the items afterwards.
   So in WPF the mode is *always* chosen before a single line exists. **"Can the mode change
   mid-basket?" has no WPF precedent — the situation cannot arise there.** It is a question the web
   *creates*, by making the engine session live from the first keystroke.
2. 🚩 **The gate the ticket cited is edit-mode, not basket state.** `CanEditOrderType = false` fires
   on `OrderFormStatus != New` (`NewOrderController.cs:805-808`) — `New | Edit | ManageCustomer |
   SelectAddress` — and CC2 mirrors it as `IsFulfillmentEnabled => IsNewMode && !IsDeliveryOnly`
   where `IsNewMode => !IsEditMode`. Neither gates on lines. Read as "WPF locks the mode once you get
   going" it argues for a lines-exist gate; read correctly it argues for nothing of the kind.
3. 🚩 **The plant already exists at `open`, under either mode.** Fixture 01's own note: plant is
   seeded from the agent's `entryStore` with `canAddItem: true` in the same response. So map note 6
   (`PcHeader.Plant` binds once at open) is satisfied *before* fulfilment is even chosen. **Pickup
   needs no new opening move**, and 135's caret-on-the-phone-field ruling is untouched — the ticket's
   worry that pickup means "a different opening move for the whole console" was unfounded.

### The rulings

- **Mode is flippable whenever `status: open`** — no lines-exist gate. A caller who says "actually
  I'll collect it" after items are rung is a real call, and forcing abandon-and-re-key would be a
  regression against a console that never had the problem (finding 1).
- **The flip never moves the plant**, which is what keeps this additive. `setFulfilment` changes the
  mode and nothing else; the order keeps its plant, so it does not re-price and cannot refuse.
  Pickup→delivery re-derives from the retained address, and *that* reaches 129's door through
  `setAddress`'s **existing** rule — no second confirm kind, no second refusal path.
- **Pickup store = the whole estate, unfiltered**, through the existing `setStore` verb. CC2's
  `GetStoreAreas()` is an unfiltered `StoreDetails` read and agents hold this power today; removing
  it would be a regression the cutover has to explain. **134's no-store-dimension ruling stands** —
  its reasoning was that a derived store left nothing to constrain, and under pickup the material
  constraint becomes 129's atomic refusal instead. `StoreDetails` is already off 137's door, so the
  picker needs **no server work**.
- **Address hidden and retained; slot hidden.** Both are WPF-explicit, not inferred:
  `Cc2DocumentHeaderBuilder.cs:81-83` (*"Pick-in-store has no shipping address (legacy parity)"*),
  `RequiresSlot(bool isDelivery) => isDelivery`, and `CallCenter2View.xaml:322` collapses the address
  region outright. `submitBlockers` carries neither `NO_ADDRESS` nor `MISSING_SLOT` under pickup.
  Shown-but-optional was rejected because the builder **discards** it — the agent would watch data
  they keyed vanish from the order.
- **Fee 0 under pickup by a predicate that already exists** — see the 156 correction below.

### 🚩 A correction 156 must take

156 records that the contract quotes `totals.deliveryFee.thresholdGross` and *"nothing computes any
of it, so either the threshold lives elsewhere or the contract invented a field."* **The field is not
invented and the threshold is not missing.** `POSController.NewPos.cs:8951`
`RefreshSubmissionDeliveryFeeFromNewPos()` implements the whole rule for the `CallCenterOrder`
doctype:

```
fee = subSourceCarriesFee && isDelivery && underThreshold ? POSCommon.ShippingAmount : 0m
```

with `underThreshold = ViewModel.Balance < POSCommon.ShippingMinimumAmount` (`POSCommon.cs:377`) and
`isDelivery = order.IsDelivery`. So (a) the threshold is real and named, (b) **the mode already
suppresses the fee** — "a pickup order with a delivery fee" is already impossible in the WPF path,
and the web reuses this predicate rather than authoring a rule. 156's flag stands only for the
*amount* rule's hardcoded June-2026 free-shipping window, which this code sits above.

### Open, recorded rather than invented

- **A pickup order has no collection time.** Neither WPF nor the contract can answer the caller's
  "when can I collect?" — slots are delivery-only by `RequiresSlot`. A real product gap, outside this
  ticket; it belongs to whoever owns the pickup call script.
- **`plantSource` does double duty.** It says `operatorOverride` at `open` when nobody overrode
  anything (it is the seeded entry store), and there is no value meaning *chosen for pickup* —
  fixture 09 keeps `derivedFromAddress` across the flip because that genuinely is how the plant got
  there. A third value would be additive; it is contract hygiene, not a fulfilment question.
  ✅ **Resolved by [175](175-nothing-enters-an-unaddressed-order.md)** (contract v1.3), and it was not
  hygiene after all — the owner raised it as the behaviour. Four values now:
  `seededAtOpen | derivedFromAddress | operatorOverride | chosenForPickup`, and the first one **shuts
  the item gate**.

## Corrections taken 2026-07-28 (while resolving [175](175-nothing-enters-an-unaddressed-order.md))

Two rulings above need narrowing. Neither reverses this ticket; both were stated wider than the
evidence supports.

1. 🚩 **"Pickup store = the whole estate, unfiltered" stands for COLLECTION ONLY.** As written, that
   bullet reads as *the* store-choice rule, and the build downstream can read it that way. There are
   **two lists**, and they answer different questions:

   | Mode | The list | Where it comes from |
   |---|---|---|
   | `Delivery` | the customer's **address book**, and the store falls out of the picked district's assignment (`tempStoreCode \|\| storeCode`) | the address book + the district table |
   | `PickInStore` | the **whole estate, unfiltered** — CC2's `GetStoreAreas()` | `StoreDetails` |

   Under delivery the agent never sees a store list at all; they pick an address and the geography
   decides. The unfiltered estate is the *pickup* picker. 🚩 And the owner's ruling of 2026-07-28
   sharpens why: **the store code is never saved on the customer's address** — it is resolved while
   the order is being created, from the district, at pick time. So the same saved address can derive
   a different store next week, and the order records which one it actually got. That is why
   `plantSource` belongs to the **order**, not to the address.

2. **A district carrying neither `StoreCode` nor `TempStoreCode` is a hard block** — owner ruling.
   `setAddress` refuses it (`NO_DELIVERY_STORE_FOR_DISTRICT`, contract v1.3 §7) rather than attaching
   an address that leaves the order unfulfillable, and the district row stays **visible and
   unpickable** saying why. This ticket's derivation rule never said what happens when it derives
   nothing.
