# The web call-center session API — frozen contract v1.9

> Asset of [136](../../136-session-api-contract.md), map [126](../../126-web-call-center.md).
> Frozen 2026-07-27 at v1.0; **v1.1** adds the fulfilment-mode axis
> ([154](../../154-fulfilment-mode-and-store-choice.md), additive — see [§10](#10-amendments));
> **v1.3** adds the opening gate — nothing enters an order with no caller and no chosen store
> ([175](../../175-nothing-enters-an-unaddressed-order.md), additive);
> **v1.4** adds the collection axis — cash on delivery or paid online
> ([155](../../155-payment-type-cod-or-online.md), additive);
> **v1.5** makes a waived delivery fee say why it was waived
> ([156](../../156-delivery-fee-shared-rule.md), additive);
> **v1.6** adds the price check — what an item costs, without adding it
> ([157](../../157-price-check.md), additive);
> **v1.7** adds stock at other stores, read-only
> ([158](../../158-stock-in-other-stores.md), additive);
> **v1.9** names the two address-book writes that are order acts
> ([179](../../179-the-address-editor-and-its-capture-contract.md), additive).
> **This document is the single source of truth for both tracks.**
> Client track: `oms-react` `features/callcenter/`. Server track: SIS.Api + `SIS.Pricing`
> (BackOffice [785](C:\Work\DMSCO\BackOffice\.issues\785-web-cc-engine-session.md),
> [786](C:\Work\DMSCO\BackOffice\.issues\786-web-cc-submission-path.md),
> [787](C:\Work\DMSCO\BackOffice\.issues\787-web-cc-promotion-guidance-engine.md),
> [798](C:\Work\DMSCO\BackOffice\.issues\798-plant-rebind-door.md),
> [799](C:\Work\DMSCO\BackOffice\.issues\799-cc-item-search-endpoint.md),
> [801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md),
> [804](C:\Work\DMSCO\BackOffice\.issues\804-cc-session-contract-server-obligations.md)).
> Change it only through [§9 Revision protocol](#9-revision-protocol).

---

## 0. The ten laws

Everything below is a consequence of these. If an example and a law disagree, the law wins.

1. **The client sends intent, never money.** No verb accepts a price, discount, condition amount,
   fee, or total. Amounts are one-way: engine → client, display only. (Map note 3.)
2. **Every mutating verb returns the whole `SessionState`.** The server has just resumed, mutated
   and persisted the transaction — the projection is in hand. `getState` exists for refresh,
   recovery, reload and second-tab only. There is no delta protocol and no client-side patching.
3. **Every mutating verb carries a client-minted `requestId` (ULID).** A retry resends the *same*
   id and is never re-applied; it returns the current state with `replayed: true`.
4. **Every verb carries an explicit `transactionId`**, validated as the caller's and as `Open`.
   Implicit "my current order" resolution does not exist.
5. **"Are you sure" is a success, not a failure.** A verb that needs confirmation returns `200`
   with the **unchanged** state plus a `pendingConfirmation` block carrying a `confirmToken`.
   Re-sending the verb with that token commits exactly the previewed change.
6. **A guardrail refusal is a business outcome**, never a crash — non-2xx carrying the SIS.Api
   envelope with `success:false` and a machine code from [§7](#7-error-taxonomy).
7. **`SESSION_BUSY` is routine.** The 15 s strict claim is the cross-pod mutex; a collision is a
   business outcome with `retryAfterMs`, retried by the client automatically and bounded.
8. **The transaction is the draft.** There is no save, no draft store, no session/login verb. The
   agent's identity rides the auth cookie; the "session" is the engine transaction.
9. **One active order per agent.** A second `open` is refused with the existing order's identity;
   the agent chooses resume or abandon-and-open-fresh. Never a silent auto-resume.
10. **Every response carries `contractVersion`.** Unknown fields are ignored by rule; a major
    mismatch is a client hard stop.

---

## 1. Transport, door, and shape

| | |
|---|---|
| **Tag / prefix** | `CallCenterWeb/*` — one tag, one filter, one probe ([137](../../137-callcenter-web-door.md)) |
| **Auth** | Cookie session **only**. The filter requires the cookie branch *explicitly* — an `IsNullOrEmpty(UserId)` check alone grant-checks a service account ([134](../../134-access-and-authorization.md)) |
| **Grant** | `CallCenterConsoleView` = `BackOfficeScreen[CallCenter,03]`, role `CALL_CENTER_AGENT`. One grant admits every verb including submit |
| **Envelope** | The universal `HttpGeneralResponse<T>` — `{ statusCode, success, message, errors[], data }`. All client access through `src/core/api.ts` per `.claude/rules/api-envelope.md` |
| **Method** | `POST` for every mutating verb (they all carry a `requestId` body). `GET` for the five pure reads (four before v1.6's `PriceCheck`) |
| **Ids** | `transactionId` is the engine's ULID (26 chars). `requestId` is a client-minted ULID. `lineId` is the engine line identity as projected — opaque to the client |

### 1.1 The verb table

| Verb | Method + route | Body / query | Returns |
|---|---|---|---|
| open | `POST CallCenterWeb/Open` | `{ requestId }` | `OpenResult` |
| abandon | `POST CallCenterWeb/Abandon` | `{ transactionId, requestId }` | `AbandonResult` |
| submit | `POST CallCenterWeb/Submit` | `{ transactionId, requestId }` | `SubmitResult` |
| addItem | `POST CallCenterWeb/AddItem` | `{ transactionId, requestId, itemNumber, qty, uom?, confirmToken? }` | `SessionState` |
| changeQty | `POST CallCenterWeb/ChangeQty` | `{ transactionId, requestId, lineId, newQty, confirmToken? }` | `SessionState` |
| voidLine | `POST CallCenterWeb/VoidLine` | `{ transactionId, requestId, lineId }` | `SessionState` |
| changeUom | `POST CallCenterWeb/ChangeUom` | `{ transactionId, requestId, lineId, uom }` | `SessionState` |
| attachCustomer | `POST CallCenterWeb/AttachCustomer` | `{ transactionId, requestId, customerId }` | `SessionState` |
| removeCustomer | `POST CallCenterWeb/RemoveCustomer` | `{ transactionId, requestId }` | `SessionState` |
| applyCoupon | `POST CallCenterWeb/ApplyCoupon` | `{ transactionId, requestId, couponCode }` | `SessionState` |
| setAddress | `POST CallCenterWeb/SetAddress` | `{ transactionId, requestId, addressNumber, confirmToken? }` | `SessionState` |
| setStore | `POST CallCenterWeb/SetStore` | `{ transactionId, requestId, storeCode, confirmToken? }` | `SessionState` |
| setFulfilment | `POST CallCenterWeb/SetFulfilment` | `{ transactionId, requestId, mode }` | `SessionState` |
| setPaymentType | `POST CallCenterWeb/SetPaymentType` | `{ transactionId, requestId, paymentType }` | `SessionState` |
| setSlot | `POST CallCenterWeb/SetSlot` | `{ transactionId, requestId, slotId \| null, day?, description?, from?, to? }` | `SessionState` |
| setDocumentSource | `POST CallCenterWeb/SetDocumentSource` | `{ transactionId, requestId, documentSource, sourceReference }` | `SessionState` |
| setOrderNote | `POST CallCenterWeb/SetOrderNote` | `{ transactionId, requestId, note \| null }` | `SessionState` |
| getState | `GET CallCenterWeb/State` | `?transactionId=` | `SessionState` |
| resolvePrereq | `GET CallCenterWeb/ResolvePrereq` | `?transactionId=&offerId=` | `PrereqResolution` |
| itemSearch | `GET CallCenterWeb/ItemSearch` | `?transactionId=&query=` | `ItemSearchResult` ([799](C:\Work\DMSCO\BackOffice\.issues\799-cc-item-search-endpoint.md)) |
| priceCheck | `GET CallCenterWeb/PriceCheck` | `?transactionId=&itemNumber=` | `PriceCheckResult` (v1.6, [§3.4](#34-pricecheck--what-an-item-costs-without-adding-it)) |
| stockElsewhere | `GET CallCenterWeb/StockElsewhere` | `?transactionId=&itemNumber=` | `StockElsewhereResult` (v1.7, [§3.5](#35-stockelsewhere--who-else-has-it-read-only)) |
| access | `GET CallCenterWeb/Access` | — | `{ canOpenConsole: boolean }` |

**Ruled out of phase 1** (map note 5): `replaceLine`, placeholder/text lines, prescription controls.
**No verb accepts an amount** — map note 4 is enforced by the absence of any such field here.

The header *reference* reads (`Cities`, `Districts`, `AddressLabels`, `DocumentSources`,
`DocumentTypes`, `StoreDetails`, `AvailableSlots`, `SlotIsActive`) stay on their existing shared
routes and are **not** part of this contract — 137 ruled them off the door. The nine PII/write
routes that *are* on the door (`CallCenterWeb/CustomerAddresses*`, `MyDocumentSources`, loyalty
lookup) are specified by [801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md), not
here; this contract only states their ordering constraint ([§6.3](#63-the-attach-before-address-ordering-constraint)).

### 1.2 Where the state comes from

`SessionState` is a **join of two stores** ([§6.4](#64-two-stores-one-projection)):

```
PosTransactionHeader + lines   (engine snapshot, HQ store DB)  → plant, origin, lines,
                                                                 pricing, promotions, version
CallCenterSession              (SIS.Api, keyed by transactionId) → customer, address, slot,
                                                                 documentSource, sourceReference,
                                                                 orderNote, hasBelowAtp,
                                                                 requestId ledger, confirm tokens
```

> ✅ **This split was reviewed and STANDS** —
> [178](../../178-the-transaction-absorbs-the-sidecar.md), 2026-07-28. It was reopened on an owner
> ruling to move everything into the `PosTransaction` snapshot, and the grounding argued the other
> way: the `requestId` ledger and the confirm tokens **cannot** live in the snapshot, because §5's
> ask half deliberately never flushes (the previewed instance *"must be discarded without
> `SaveAsync`"*) — so a sidecar would survive holding them, and [§6.4](#64-two-stores-one-projection)
> would survive with it. Absorption would have paid engine risk and removed no hazard. The owner
> withdrew the ruling: **the sidecar is the home for every non-engine field, extended by adding
> columns, and the engine is not touched.** Add a field here by adding a column, not by reshaping the
> snapshot.

---

## 2. `SessionState` — the projection the whole UI renders

```jsonc
{
  "contractVersion": "1.0",
  "transactionId": "01JC8Q4KYZ3M7N2P5R8T1V6W9X",
  "version": 12,                  // engine header version; strictly increasing
  "etag": "01JC8Q…-12",           // transactionId + version; opaque staleness token
  "status": "open",               // open | submitted | abandoned
  "replayed": false,              // true when this response is a requestId replay (§4)

  "header": {
    "deliveryType": "Delivery",   // Delivery | PickInStore — v1.1, §2.2
    "plant": "1101",              // fulfilment store — engine-bound, rebindable (§5)
    "plantName": "Al Malqa",               // server-supplied always — a delivery-only store (1402) is
                                           // in no client-held list, so the client cannot name it
    "plantSource": "derivedFromAddress",   // v1.3, four values — §2.3
                                           // seededAtOpen | derivedFromAddress | operatorOverride | chosenForPickup
    "origin": "C000",             // sticky, server constant (128)
    "documentType": "CLCN",
    "register": "WEB-a.alharbi",
    "operatorId": "a.alharbi",
    "entryStore": "1001",         // the agent's switcher store, unmodified (133)
    "openedAt": "2026-07-27T09:14:03Z",
    "customer": {                 // null until attachCustomer
      "customerId": "0001234567",
      "name": "…",
      "mobile": "+9665…",
      "loyaltyAttached": true
    },
    "address": {                  // null until setAddress; unreachable before customer (§6.3)
      "addressNumber": "77120",
      "label": "Home",
      "cityCode": "0021", "cityName": "Riyadh",
      "districtCode": "R-114", "districtName": "Al Malqa",
      "line": "…"
    },
    "slot": { "slotId": "2026-07-28#S3", "from": "18:00", "to": "21:00", "isActive": true },
    "documentSource": "CALLCENTER",
    "sourceReference": "CRM-889231",
    "paymentType": "CashOnDelivery",       // v1.4 — CashOnDelivery | Online | Receivable — §2.4
                                           // Receivable is RESERVED: no phase-1 path produces it
    "paymentTypeForcedReason": null,       // v1.4 — null while the agent may choose; a typed code
                                           // when the server has decided for them (§2.4)
    "orderNote": null,            // v1.3 — free text, CC2's OrderNote; never price-affecting
  "retainedAddressLabel": null, // v1.8 — the LABEL of the address the sidecar holds while the
                                // order collects; non-null only under PickInStore (§2.6)
    "hasBelowAtp": true           // any line added or re-frozen below availability (§5.2)
  },

  "lines": [
    {
      "lineId": "L1",
      "itemNumber": "100001",
      "description": "…", "description2": "…",
      "qty": 2,
      "uom": "EA",
      "uomOptions": ["EA", "BOX"],
      "unitPrice":   { "net": 12.00, "gross": 13.80 },   // display only
      "lineTotal":   { "net": 24.00, "gross": 27.60 },
      "conditions": [                                    // per-line pricing detail
        { "type": "ZVKP", "description": "Store price", "value": 12.00, "isStatistical": false },
        { "type": "MWST", "description": "VAT 15%",     "value": 3.60,  "isStatistical": false }
      ],
      "promotions": [ { "offerId": "BBY-4471", "description": "70% 2nd PCS", "amount": -8.40 } ],
      "atpAtScan": { "quantity": 5, "frozenAt": "2026-07-27T09:15:41Z", "known": true },
      "belowAtpAtScan": false,
      "warnings": []
    }
  ],

  "totals": {                     // display only, engine-computed
    "net": 24.00, "vat": 3.60, "gross": 27.60,
    "deliveryFee": {
      "amount": 15.00, "waived": false,
      "waivedReason": null,       // v1.5 — non-null exactly when waived is true — §2.5
      "thresholdGross": 200.00, "conditionType": "DFEE"
    },
    "payable": 42.60
  },

  "firedPromotions": [
    { "offerId": "BBY-4471", "description": "70% 2nd PCS", "amount": -8.40, "lineIds": ["L1"] }
  ],

  "nearMisses": [                 // §3 — items resolved on demand, never inline
    {
      "offerId": "BBY-5510",
      "description": "Buy 2 get 1 free — oral care",
      "isReady": false,
      "progress": { "have": 1, "need": 2 },
      "prereq": { "kind": "grouping", "groupingId": "G-8812", "eligibleCount": 42 },
      "skipReason": null          // §3.2 typed category when the offer was not evaluated
    }
  ],

  "pendingConfirmation": null,    // §5 — a confirm-token block, or null

  "capabilities": {               // what the server will accept right now — drives enablement
    "canAddItem": true,           // v1.3 — caller attached AND store chosen (§2.3)
    "canSubmit": false, "canChangeStore": true,
    "canOpenAddressBook": true,
    "canChangeFulfilment": true,  // v1.1 — true whenever status is open (§2.2)
    "canChangePaymentType": true, // v1.4 — open AND paymentTypeForcedReason == null (§2.4)
    "canConfirmSeededStore": false, // v1.3 — the one-click "yes, this store", PickInStore only (§2.3)
    "canPriceCheck": true,        // v1.6 — same predicate as canAddItem (§3.4); also gates §3.5
    "capabilityReasons": {},      // v1.8 — why a can* above is false, keyed by its name (§2.6)
    "submitBlockers": ["MISSING_SLOT"]
  }
}
```

### 2.1 Field rules

- **`version` / `etag`.** `version` is the engine header version, blind-incremented on every
  `SaveAsync` (127 finding 1). The client stores the latest and **never acts on an older one**: a
  response whose `version` is lower than the one already rendered is discarded, not applied. This
  is what keeps a slow response that arrives after a fast one from rewinding the screen.
- **`replayed`.** True only on a `requestId` replay. The client renders identically; it exists so
  the console can suppress a duplicate toast and so the fixture/conformance test can assert it.
- **Money is never client-computed.** `totals` is engine truth. The client must not sum `lines`.
- **`unitPrice`/`lineTotal` carry `net` and `gross`** because `MWST` is a separate 15% condition —
  the same fact that makes item search's `estimatePriceExVat` read ~13 % under the basket line
  ([131](../../131-item-search-endpoint.md)). The console labels the two differently.
- **`atpAtScan` is frozen** at add and re-frozen on rebind ([129](../../129-rebind-store-door.md)),
  never live. `known:false` means the stock service degraded — never a block (287's rule).
- **`capabilities`** is advisory-but-authoritative: it is derived from the same predicates the verbs
  enforce, so the console never has to re-implement a rule. A client that ignores it gets a typed
  refusal, not a wrong order.
- **Get-side promotion fields** (`nearMisses[].prereq.kind === 'condition'`) ship in v1.0 but stay
  **absent** until 787-C lands; the client degrades, the pattern `AppliedBonusBuy.applications?`
  already uses in this repo ([130](../../130-potential-bby-prerequisites.md)).
- **`wouldSave` does not exist and will not be added.** Spec 574 US26: carry the discount
  *definition*, never a fabricated savings total. 🚩 This repo's `promo-view.ts:368` currently
  prints a percent as money — it must be fixed before `promo-view.ts` graduates to `@/core/`.

### 2.2 `deliveryType` — the fulfilment axis (v1.1)

Added by [154](../../154-fulfilment-mode-and-store-choice.md); both modes are in phase 1. Written to
the CLCN header exactly as `Cc2DocumentHeaderBuilder.cs:29-31` writes it today. For CLCN both modes
are always permitted — [132](../../132-header-capture-inventory.md) ruled the policy side a no-op.

**The flip never moves the plant.** This is the whole reason the axis is additive rather than a new
door. `setFulfilment` changes the mode and nothing else; the order keeps the plant it already has, so
it does not re-price and cannot refuse. Every money-affecting consequence rides machinery that
already exists:

| | Delivery → PickInStore | PickInStore → Delivery |
|---|---|---|
| Plant | unchanged | **re-derived** from the retained address |
| Confirmation | none — nothing moved | the existing `storeChange` ([§5.1](#51-kind-storechange)) **if** the plant moves and lines exist |
| Address | retained in the sidecar, **not written** to the header | back in force |
| Slot | cleared | reloadable |
| Delivery fee | 0 | recomputed |

- **`canChangeFulfilment` is true whenever `status` is `open`** — there is no lines-exist gate. WPF
  has none either: its gate is `OrderFormStatus != New` (`NewOrderController.cs:805-808`) and CC2's
  `IsFulfillmentEnabled => IsNewMode && !IsDeliveryOnly`, both of which mean *edit mode*, not basket
  state. The question could not arise in WPF at all — CC2's view models hold **no line entry**; the
  header is captured and handed to POS, which rings the items afterwards. A caller who says "actually
  I'll collect it" after items are rung is a real call, and forcing an abandon-and-re-key would be a
  regression against a console that never had the problem.
- **Under `PickInStore` the store is chosen, not derived.** It is the existing `setStore` verb
  unchanged — no new verb — over the **whole estate, unfiltered**, which is CC2's behaviour today
  (`GetStoreAreas()` is an uncached-once, unfiltered `StoreDetails` read). 134's ruling that the grant
  carries no store dimension **stands**: its reasoning was that there was nothing to constrain
  because the store was derived, and under pickup the material constraint becomes 129's atomic
  refusal instead — a store where any line does not price refuses the whole rebind.
- **No new opening move.** Map note 6 (`PcHeader.Plant` binds once at open) is already satisfied
  regardless of mode: `open` seeds the plant from the agent's `entryStore` and returns
  `canAddItem: true` (fixture 01). Pickup does **not** require the agent to choose a store before the
  first item, and 135's caret-on-the-phone-field opening ruling is untouched.
- **Address and slot are absent under pickup, not optional.**
  `Cc2DocumentHeaderBuilder.cs:81-83` — *"Pick-in-store has no shipping address (legacy parity)"* —
  and `RequiresSlot(bool isDelivery) => isDelivery` on `OrderKindStrategyBase`. The console hides both
  regions (CC2 collapses the address `LayoutItem` outright, `CallCenter2View.xaml:322`), and
  `submitBlockers` therefore carries neither `NO_ADDRESS` nor `MISSING_SLOT` while the order is
  pickup. Showing an optional address would be worse than hiding it: the builder discards it, so the
  agent would watch data they keyed vanish from the order.
- **The retained address is why the flip back is cheap.** CC2 keeps `_lastAddress` and re-derives
  from it (`StoreSelectionVM.ReDeriveAsync()`), so a caller changing their mind twice costs no
  re-keying. The sidecar holds it; the header does not.
- **`deliveryFee` is 0 under pickup by a predicate that already exists**, not by a new rule:
  `POSController.NewPos.cs:8977` computes
  `fee = subSourceCarriesFee && isDelivery && underThreshold ? ShippingAmount : 0m` for the
  `CallCenterOrder` doctype. The server half reuses that predicate against the session's mode.
  ([156](../../156-delivery-fee-shared-rule.md) owns the rule's move into shared code.)

⚠ **Open, not ruled here:** a pickup order has **no collection time** — neither WPF nor this contract
can answer "when can I collect?". Recorded on 154 rather than invented here.

⚠ **Superseded by v1.3:** 154's second open note — *"`plantSource` says `operatorOverride` at `open`
when nobody overrode anything"* — is answered by [§2.3](#23-the-opening-gate-v13). The value at open
is now `seededAtOpen` and pickup's chosen store is `chosenForPickup`; neither does double duty.
**§2.2's "No new opening move" bullet is narrowed**: `open` still seeds the plant, so map note 6 is
still satisfied without a new opening move — but `canAddItem` is no longer `true` in that same
response.

---

### 2.3 The opening gate (v1.3)

Added by [175](../../175-nothing-enters-an-unaddressed-order.md). **An order opens holding a plant it
cannot yet be trusted with, and refuses items until a human has supplied both halves of the header
that decides every price.**

```
canAddItem  =  status == "open"
            && header.customer != null
            && header.plantSource != "seededAtOpen"
```

**Why the plant is still bound at open.** The engine binds `PcHeader.Plant` once
(`PosTransaction.cs:883`) and an order with no plant is not a thing it can hold, so `open` keeps
seeding it from the agent's `entryStore` — map note 6 and [129](../../129-rebind-store-door.md)'s
whole premise are untouched. What changes is that the seeded value is now **labelled as unchosen**
rather than presented as settled. The engine's state and the console's claim were the same sentence
in v1.2 and they were not the same fact.

**`plantSource` — the four values.** Three of them mean *somebody chose this*; exactly one does not.

| Value | Set by | Gate |
|---|---|---|
| `seededAtOpen` | `open`, from `entryStore` | **shut** — nobody chose it |
| `derivedFromAddress` | `setAddress`, via the district's `tempStoreCode \|\| storeCode` | open |
| `operatorOverride` | `setStore` under `Delivery` — an explicit override of a derived plant | open |
| `chosenForPickup` | `setStore` under `PickInStore` | open |

**The gate is server-side, and it had to be.** 🚩 The engine's own
`PosDocumentType.IsCustomerRequired` looks like it already expresses ruling 1 and **does not**: it is
an *open-time* validation of `options.CustomerId` that throws `InvalidOperationException`
(`PosTransaction.cs:916`), not a per-add predicate, and the `CallCenterOrder` catalogue row sets it
`false` with a comment saying why — *"the CC customer rides a `LoyaltyCustomer` line +
`SetLoyaltyAsync`, not `options.CustomerId`; requiring one would brick `OpenAsync`"*
(`DocumentTypeCatalog.cs:735`). Flipping it `true` would make every web `open` throw. The gate is
therefore SIS.Api's, projected through `capabilities.canAddItem` and enforced by `addItem` itself,
for the same reason `submitBlockers` is the only thing that dims *Place order*: a console that
re-derives the rule is a second implementation that can disagree with the server on a live basket.

**Refusals** — `addItem` against a shut gate returns the first that applies:
`NO_CUSTOMER_ATTACHED` (existing, §7) then `STORE_NOT_CHOSEN` (new, §7).

**The store chip says *not chosen* through `submitBlockers`, never a client rule.** While
`plantSource == "seededAtOpen"`, `submitBlockers` carries `STORE_NOT_CHOSEN`. This keeps
`header-chips.ts`'s one-table discipline: the chip's attention state is read from the wire like every
other, and no client-side predicate duplicates the gate.

**Confirming the seeded store is a real act — and only under pickup.** An agent whose caller collects
from the store the agent is sitting in should not have to re-pick it, so `setStore` with the store
the order already holds is legal and **advances `plantSource` to `chosenForPickup`**. The plant does
not move, so [§5.1](#51-kind-storechange) raises no confirmation and nothing re-prices — the whole
effect is that a choice is now on the record. `capabilities.canConfirmSeededStore` is true exactly
when `deliveryType == "PickInStore" && plantSource == "seededAtOpen" && status == "open"`.

Under `Delivery` there is **no such shortcut**: the address is what chooses the store, so the only
way out of `seededAtOpen` is `setAddress`. Combined with
[§6.3](#63-the-attach-before-address-ordering-constraint) — the address book is unreachable before
`attachCustomer` — the delivery path enforces **caller first by construction**, not by a second rule.

**No verb but `addItem` is gated.** `attachCustomer`, `setAddress`, `setStore`, `setFulfilment`,
`setSlot`, `setDocumentSource` and `setOrderNote` are all how the gate gets opened; `abandon` and
`getState` always work. `submit` was already unreachable on an empty basket.

**A district that derives no store is a hard refusal.** Delivery's derivation reads
`tempStoreCode || storeCode` off the district ([132](../../132-header-capture-inventory.md)); a
district carrying **neither** cannot be delivered to at all. `setAddress` refuses it —
`NO_DELIVERY_STORE_FOR_DISTRICT` (§7) — rather than attaching an address that leaves the order
unfulfillable. The console keeps the row **visible and unpickable** saying why, because hiding it
makes the agent hunt for a district they can see on the caller's lips.

> 🚩 **The store is not stored on the address.** Owner ruling, 2026-07-28: the store code is never
> saved onto the customer's address record — it is resolved **while the order is being created**,
> from the district, at the moment the address is picked. This confirms the CC2 reading
> ([175's inventory §0.1](../../assets/175-cc2-inventory/CC2-INVENTORY.md)) and is why `plantSource`
> is a property of *the order*, not of the address: the same saved address can derive a different
> store next week, and the order records which one it actually got.

---

### 2.4 `paymentType` — the collection axis (v1.4)

Added by [155](../../155-payment-type-cod-or-online.md). It answers **how the money will be
collected**, and it is the last of `Cc2DocumentHeaderBuilder`'s header fields to reach this contract
(`Cc2DocumentHeaderBuilder.cs:36-38`).

🚩 **It is not a tender and no money moves on the console** — owner ruling, 2026-07-29: *"nothing
will be paid there, no tender."* The field is an **instruction to OMS**: `Online` tells OMS to send
the customer a payment-gateway link, which the customer completes elsewhere. The console never sees a
gateway, a card, an amount or a result. That is why it creates **no price-affecting power** and
leaves [map note 4](../../126-web-call-center.md) untouched — it is a routing flag in the same family
as `documentSource`, not a payment. It is also why it is a **plain header field with its own verb**
and not a `pendingConfirmation` kind: nothing is previewed, nothing re-prices, nothing can refuse.

**The agent's whole act is one spoken question** — *"Would you like to pay online, or pay once you
receive the order?"* — with no amount, no confirmation and no consequence to explain.

#### The value domain — three values, one reserved

| Wire | Column (`CallCenterSession.PaymentType`, → CLCN header) | Phase 1 |
|---|---|---|
| `"CashOnDelivery"` | `"C"` | **default at `open`** |
| `"Online"` | `"O"` | agent-selectable |
| `"Receivable"` | `"R"` | **reserved — no phase-1 path produces or accepts it** |

The wire spells the values out and the column stores `DocumentPaymentTypeConstants`' letters, exactly
as `deliveryType` does since [178](../../178-the-transaction-absorbs-the-sidecar.md) — the projection
maps, so the agent never reads a letter. ⚠ **`Receivable` is named now on purpose.** Modelling this
as a boolean, or freezing a two-value enum, makes the third value a **§9 major** the day the business
wants it; naming it costs nothing today and a client that never receives it is never wrong. Phase 1
servers must **refuse** `setPaymentType` with `Receivable` — reserved is not the same as accepted.

#### The rulings

- **Default is `CashOnDelivery`.** Owner, 2026-07-29 — WPF parity: CC1 sets
  `_order.CashOnDelivery = true` at construction (`NewOrderController.cs:50`) and CC2's view-model
  field initialiser does the same. 871 already lands the column defaulting to `"C"`.
- **It is an independent axis** — not derived from `deliveryType`, not from anything. All four
  combinations are legal: delivery+online, delivery+COD, pickup+online, pickup+COD.
  🚩 This *replaces* a live wrong value: `CallCenterSessionService.Submit.cs:196` currently derives
  `CashOnDelivery = isDelivery`, which fails **both ways** — a pick-in-store order is stamped
  online-paid, and a delivery caller who wants to pay online cannot be offered it. That derivation is
  deleted, not adjusted.
- **Flippable whenever `status == "open"`**, like `setFulfilment` and for a stronger reason: the flip
  moves no plant, touches no line, and re-prices nothing, so there is no lines-exist gate to argue
  about. `deliveryFee` is unaffected — its predicate
  (`subSourceCarriesFee && isDelivery && underThreshold`, `POSController.NewPos.cs:8951`) contains no
  payment term at all.
- **`canChangePaymentType == status == "open" && paymentTypeForcedReason == null`.** The verb refuses
  a forced order with `PAYMENT_TYPE_FORCED` (§7), so a client that ignores the capability gets a
  typed refusal rather than a wrong order — §2's advisory-but-authoritative rule, unchanged.

#### The forcing rule: carried, but empty in phase 1

🚩 **Nothing in phase 1 can force this field, and the map recorded otherwise.** 175 carried
*"P2E forces online payment"* onto this ticket as a **source** rule. Read at the enforcement sites, it
is a **kind** rule:

- CC2: `IsPaymentForced => DocumentType.SelectedType.ForcesOnlinePayment`
  (`MainCallCenter2ViewModel.cs:413-414`) — the **order-kind strategy**, `true` only on
  `P2eOrderStrategy`.
- CC1, the same shape from the other side: `OnlinePayment`'s setter opens
  `if (!IsCash && value) { … return; }` (`NewOrderController.cs:504-519`) — insurance and Wasfaty
  **refuse** online and re-assert COD. The one kind where the operator is free is the **cash** kind.
- `DocumentSourcePolicyService` — the service 175 named — forces **nothing** about payment. Its whole
  content is `SupportsPickInStore`: WSFD / P2E / DKSW are **delivery-only**. That is a fulfilment
  rule, and it belongs to [§2.2](#22-deliverytype--the-fulfilment-axis-v11) /
  [176](../../176-fulfilment-mode-drawn.md), not here.

Phase 1 is the cash kind only, so **`paymentTypeForcedReason` is `null` on every phase-1 order**.
The field ships anyway (owner ruling): a forcing rule that arrives later — a P2E-category
`documentSource` reaching the agent's `MyDocumentSources` list, or a kind entering scope — becomes a
**server data change**, not a §9 revision plus a client change. ⚠ `DocumentSourceCategory == "C"`
membership is **table data**, not code, so "can a P2E source land on a cash-kind order" cannot be
answered by reading the source; the server-side forcing table is the honest place for it.

⚠ **This makes the forced rendering an unreachable client path, and it must be named as such** —
177's lesson. The console still implements `canChangePaymentType: false` (chip settled,
non-interactive, carrying the reason phrase), because a capability the client ignores is precisely
the failure §2's rule exists to prevent; it is proved from a stubbed state in the drive, never from a
live server, and the drive says so.

#### Where it draws

**The chip row, settled and collapsed** — owner's pick, and CC2's own answer
(`ShowPaymentChip => !_isPaymentExpanded && !IsPaymentForced`; GAP_ANALYSIS item 9: *"collapse
Payment to chip when COD"*). It is the smallest act on the console and it has a real default, so it
reads as settled rather than outstanding. It carries **no `submitBlocker`**: the order always holds a
valid value, so there is nothing for submit to wait on.

🚩 **One console-wording rule, which never touches the wire.** Under `PickInStore`, a chip reading
*Cash on delivery* describes an order nobody delivers. The value's meaning is "not prepaid", so the
console words it per mode — *Cash on delivery* under `Delivery`, *Pay on collection* under
`PickInStore` — while `paymentType` stays `"CashOnDelivery"` on the wire and `"C"` in the column.
Wording follows the caller's experience; the value follows OMS.

---

### 2.5 `deliveryFee.waivedReason` — why the fee fell away (v1.5)

Added by [156](../../156-delivery-fee-shared-rule.md). **The rule itself is settled and shipped** —
`CallCenterDeliveryFeePolicy` (BackOffice 786 §2) is the one copy both hosts call, so §8.3's old flag
that the rule was WPF-resident is gone. What this revision adds is the *sentence the agent reads*.

```jsonc
"waivedReason": null | "ThresholdReached" | "PromotionalWindow" | "ConfiguredOverride"
```

**Non-null exactly when `waived` is `true`, and null otherwise** — including under `PickInStore`,
where `waived` is already `false` because a fee that never existed was not waived.

- `ThresholdReached` — the basket is at or above `thresholdGross`.
- `PromotionalWindow` — a free-delivery campaign is running.
- `ConfiguredOverride` — a per-document-type configured fee of zero. **Unreachable in phase 1** (it
  is WPF's P2E path and phase 1 is plain CLCN cash); typed now so it never has to be added later, the
  same posture `Receivable` took in [§2.4](#24-paymenttype--the-collection-axis-v14).

**Precedence is the policy's own order and is documented, not incidental**: the threshold is tested
before the window, so a basket that is both over the threshold *and* inside a campaign reports
`ThresholdReached`. Both are true; the client never has to arbitrate.

🚩 **Why a field and not a client comparison.** The console holds `gross` and `thresholdGross` and
could infer the reason by comparing them. It must not. That is the client recomputing a server rule
against §2.1's *engine truth, read and not computed*, and it is wrong the moment `ConfiguredOverride`
becomes reachable — a zero fee under the threshold would be reported as a promotion that is not
running. The server already knows which branch it took; it ships the branch.

**Unknown values degrade, never throw** (§9): a client that does not recognise a future category
falls back to saying the fee is waived without a reason — which is exactly what v1.4 says today.

**What the console does with it.** The waived state stops being a bare green word: it carries its
reason, and the *"free over …"* line — which today vanishes at the instant it would explain itself
(`ConsoleShell.tsx:546` gates it on `!waived`) — is what `ThresholdReached` replaces rather than
hides. Under `PickInStore` the whole fee region is **absent, not zero**: `amount: 0` with a live
`thresholdGross` would otherwise draw *Delivery SAR 0.00* and a free-delivery promise on a collection
order. That display rule needs no wire change and belongs to
[176](../../176-fulfilment-mode-drawn.md), which draws the mode axis.

---

### 2.6 What the flip does to the screen (v1.8)

Added by [176](../../176-fulfilment-mode-drawn.md), which **drew** the axis §2.2 froze. §2.2 settled
what the server does on a flip; this settles what the agent sees, and adds the two fields the drawing
could not do without. Everything else here is a **rendering rule with no wire change** — recorded on
the contract because both tracks' fixtures assert it.

| Region | Under `Delivery` | Under `PickInStore` |
|---|---|---|
| Chip row | `fulfilment` · `store` · `slot` · `source` · `reference` · `payment` | the same row **minus `slot`** |
| Customer rail, 2nd block | *Address* | *Collecting from* — same place, same pixels |
| Receipt | delivery line + threshold sentence | **no delivery region at all** |
| Payment chip word | *Cash on delivery* | *Pay on collection* — the wire value is unchanged |

- **The mode chip is FIRST and always settled.** The order always holds a mode, so it is never
  *unset*; and everything to its right is a consequence of it — two of them (the slot, the delivery
  fee) stop existing when it flips.
- 🚩 **Absent, not zero; absent, not disabled.** The slot chip and the whole delivery region are
  **removed** under collection rather than emptied. Capture 09's pickup state is
  `{ amount: 0, waived: false, thresholdGross: 100 }`, which drawn literally is *`Delivery SAR 0.00`*
  plus *"free over SAR 100"* on an order nobody is delivering. The block still ships on the wire so
  the flip back re-quotes instantly.
- 🚩 **The rail's two blocks are one block.** *Address* and *Collecting from* occupy the same pixels,
  so a flip moves no furniture — 135's one winning property, and the reason the mode is a chip rather
  than a region of its own. Measured, not asserted: `tools/fulfilment-176-drive.mjs` reads both blocks'
  offsets and fails if they differ.
- **The store chip drops its *(derived)* parenthetical under collection.** Capture 09 keeps
  `plantSource: derivedFromAddress` across a flip whose response also carries `address: null`, so the
  word would point at something the console cannot show.
- **A shut capability is not a control, and it says why.** The chip stays — the order still HAS a
  mode — and loses its handler; `capabilityReasons` supplies the sentence. An unrecognised code
  degrades to a general phrase, never to silence and never to a guess.
- ⚠ **A collection order has no collection time, and the console says nothing about it.** Owner
  ruling, 2026-07-29: where the slot chip was, nothing is drawn. `RequiresSlot` is delivery-only and
  neither WPF nor this contract can answer *"when can I collect?"* — that gap belongs to whoever owns
  the pickup call script ([154](../../154-fulfilment-mode-and-store-choice.md)), and inventing an
  answer here would be this map promising something no system behind it can keep.

---

## 3. Promotion guidance

### 3.1 Two surfaces, one pass

`firedPromotions` and `nearMisses` both come from a single `BuildSimulationResult` projection of the
**live** transaction — no re-price ([130](../../130-potential-bby-prerequisites.md)). Modelled on
`AvailableOffer` / `AvailablePrereq`, not raw `PotentialBonusBuy`. Sorted **ready-first**.

### 3.2 `skipReason`

When a candidate offer was not evaluated, it still appears with a **typed** category so the console
can say why rather than silently omitting it:

`ORIGIN_FILTERED` · `PLANT_FILTERED` · `VALIDITY_WINDOW` · `CUSTOMER_SEGMENT` · `NOT_DISCOVERED`

`NOT_DISCOVERED` is 130's headline blocker made visible: BBY lookup keys on the condition-side
access tables only, so a basket holding only the *buy*-side item never loads the promotion at all.
Until 787-C, the honest wire answer is this category — which is exactly what lets 128's
origin change ship without blocking this contract.

### 3.3 `resolvePrereq` — the on-demand half

```
GET CallCenterWeb/ResolvePrereq?transactionId=…&offerId=BBY-5510
→ {
    "offerId": "BBY-5510",
    "prereq": { "kind": "grouping", "groupingId": "G-8812" },
    "items": [
      { "itemNumber": "200145", "description": "…", "description2": "…",
        "estimatePriceExVat": 9.13, "atp": 12 }
    ],
    "truncated": false,
    "topN": 25
  }
```

- **ATP-filtered at the order's plant, server-side**, and ranked. Rows with no availability are not
  returned. `atp: null` where the stock read degraded — never a non-200.
- A grouping is **a set, not an item.** Both BackOffice builders currently collapse eligible
  materials to `[0]` (a live WPF defect, 130); this contract requires the full set. `eligibleCount`
  on the near-miss and `items[]` here are the same population.
- **Not on `Bby/*`.** 134 ruled the console touches no Bonus-Buy-Inquiry-gated route; this read
  lives on the call-center door and reuses `Bby/GroupingMembers`' logic server-side.
- **Never inline.** Resolving every near-miss on every add would pay a grouping expansion plus a
  stock read per keystroke to populate cards the agent mostly never opens.

### 3.4 `priceCheck` — what an item costs, without adding it

**v1.6, additive** ([157](../../157-price-check.md)). *"How much is X?"* is asked on every call and
answered before X is in the basket. It lives in §3 because its second half is the same guidance
projection, over the same `skipReason` vocabulary, as the rest of this section.

```
GET CallCenterWeb/PriceCheck?transactionId=…&itemNumber=100001
→ {
    "contractVersion": "1.6",
    "itemNumber": "100001",
    "description": "…", "description2": "…",
    "uom": "EA",
    "plant": "1101", "plantName": "Al Malqa",
    "pricedAt": "2026-07-29T11:02:14Z",
    "unitPrice": { "net": 12.00, "gross": 13.80 },     // ENGINE money, qty 1 — §2.1's rules apply
    "conditions": [
      { "type": "ZVKP", "description": "Store price", "value": 12.00, "isStatistical": false },
      { "type": "MWST", "description": "VAT 15%",     "value": 1.80,  "isStatistical": false }
    ],
    "offers": [
      { "offerId": "BBY-4471", "description": "70% 2nd PCS",
        "isReady": false, "progress": { "have": 0, "need": 2 }, "skipReason": null }
    ],
    "offersComplete": false                            // false while 787-C is outstanding
  }
```

**The eight rules.**

1. **It is engine money, and it is the point.** The number comes from a real pricing run at the
   **order's own plant, origin, customer and loyalty**, VAT-inclusive. It is therefore §2.1 money:
   the console renders `gross` in a money column with `SAR`, exactly like a basket line — and
   **`unitPrice.gross` must equal the basket line's `unitPrice.gross`** for the same item under the
   same header. That equality is the whole ticket.
2. **It is not the search row's estimate, and must never silently become it.** `ItemSearchResult`'s
   `estimatePriceExVat` reads **~13% under** what the caller pays
   ([131](../../131-item-search-endpoint.md)); a price check exists to be **read out loud**, with no
   basket line beside it to correct it. A pricing failure is a typed refusal (rule 7), never a
   fallback to the estimate. The two numbers coexist on one screen and never swap places
   ([168](../../168-search-in-arabic-no-estimate-as-money.md)'s spatial rule is untouched — the `≈`
   estimate keeps its meta-line home on every row, and engine truth appears only in the expanded
   panel).
3. **The client sends `transactionId` and `itemNumber`. Nothing else.** No quantity, no plant, no
   sales org, no material attribute, no condition. Map note 3 is enforced by the request having no
   other field. The server composes the whole pricing request from the order's own header.
4. **Always one unit.** Owner ruling. *"How much is X"* is a unit question; quantity-scaled
   conditions and tier offers that only bite higher up are deliberately invisible rather than paying
   a second control on a panel opened mid-call.
5. **The gate is `canAddItem`'s predicate** — caller attached **and** a store somebody chose
   ([§2.3](#23-the-opening-gate-v13)) — projected as `capabilities.canPriceCheck` and enforced with
   the same `NO_CUSTOMER_ATTACHED` / `STORE_NOT_CHOSEN` 409s. Quoting at a seeded store nobody chose
   is [797](C:\Work\DMSCO\BackOffice\.issues\797-resume-drops-pcheader-plant.md)'s silent wrong
   price, said out loud. A useful consequence: the customer is always attached, so **loyalty is
   always known** and the quote is never accidentally a non-member price.
6. **The offers half carries the definition, never a figure.** Same promise language as
   [138](../../138-near-miss-guidance-design.md): the discount *definition* (`20% off`, `3rd free`),
   `progress`, `isReady`. **No `wouldSave`, and no figure formatted as money anywhere in the offers
   region** — 135 amendment 1 as 138 restated it. The region holds no engine money at all, so it can
   guarantee that absolutely.
7. **`offersComplete` is 130's blindness, made visible.** A one-item pricing run of a *"buy X get Y"*
   whose X is the priced item never loads the promotion at all — BBY lookup keys on the
   condition-side access tables ([130](../../130-potential-bby-prerequisites.md)). So the field is
   `false` until [787](C:\Work\DMSCO\BackOffice\.issues\787-web-cc-promotion-guidance-engine.md)-C
   lands, and the panel says *offers were not fully checked* rather than letting silence read as
   *no offer exists*. It flips to `true` with **no client change**. Per-offer `skipReason` reuses
   [§3.2](#32-skipreason)'s five categories unchanged.
8. **It takes no claim.** Like `getState`, this is a pure read: the engine prices it in a throwaway
   context that is never persisted, so a price check **cannot collide with the agent's own basket**
   and never queues behind the 15-second lease ([§6.1](#61-the-claim)). It is the only read on this
   contract with that property, and it is why *"how much is that?"* never pauses order entry.

**No new error codes.** §7's `ITEM_NOT_FOUND`, `ITEM_NOT_SELLABLE`, `NO_PRICE_AT_PLANT`,
`NO_CUSTOMER_ATTACHED` and `STORE_NOT_CHOSEN` already say everything this read can refuse.

**Not here:** availability. The search row already carries `atp` at the order's plant (131, folded in
server-side), and stock at *other* stores is [§3.5](#35-stockelsewhere--who-else-has-it-read-only) —
which shares this surface but not this shape, and is a **separate call** for the reason given there.

### 3.5 `stockElsewhere` — who else has it (read-only)

**v1.7, additive** ([158](../../158-stock-in-other-stores.md)). When the order's store cannot supply
an item, the agent needs to know who can. Same panel as [§3.4](#34-pricecheck--what-an-item-costs-without-adding-it),
same gate, **separate call**.

```
GET CallCenterWeb/StockElsewhere?transactionId=…&itemNumber=100001
→ {
    "contractVersion": "1.7",
    "itemNumber": "100001",
    "originPlant": "1101",
    "distanceKnown": true,          // false ⇒ every distanceKm is null and the order is by code
    "available": true,              // false ⇒ the stock hop did not answer; stores is [] and means UNKNOWN
    "stores": [
      { "plant": "1204", "city": "Riyadh", "areaName": "North Riyadh",
        "address": "…", "atp": 6, "distanceKm": 4.2 }
    ],
    "withStock": 23,                // honest total with atp > 0 before the cap
    "truncated": true               // withStock > stores.length
  }
```

**The seven rules.**

1. **It is read-only, and that is a ruling, not an omission.** No control in this block moves the
   order. A store change is the **order's** act, not an item's: [129](../../129-rebind-store-door.md)'s
   door re-prices every line, re-freezes every ATP and refuses atomically — a blast radius that
   cannot live inside a per-item disclosure. The list is also ranked *from* the order's plant, so a
   one-click rebind would invalidate the list it was clicked from. The store still moves through
   `setStore` and [§5.1](#51-kind-storechange)'s confirm, and the panel may name that path in words.
   The WPF till agrees by construction: the only action on its equivalent grid sends the customer an
   SMS map link, never a move.
2. **One availability number, and it is ATP.** `atp` here is the *same definition* as
   `ItemSearchResult.atp` — `UnrestrictedPos − active orders (11 days)`, one formula, one source
   ([research §4](../158-stock-elsewhere/RESEARCH.md)). The till's grid shows on-hand **and** ATP in
   adjacent columns; this contract carries only ATP, because two availability numbers read down a
   phone is how the larger one gets promised.
3. **Only stores that can supply, nearest first, capped.** Rows with `atp <= 0` are dropped
   server-side and the order's **own** plant is excluded — its number is already on the search row
   (131) and one number belongs in one place. The cap is 10 with `withStock` + `truncated`
   ([131](../../131-item-search-endpoint.md)'s shape): the till's 200-row grid is a mouse artifact,
   not a phone conversation.
4. **Unknown distance is a value, never a missing store.** `distanceKm: null` when the origin plant
   or the row has no coordinate — and `distanceKnown: false` when it is the *origin*, in which case
   every row is null and the list is ordered by store code, honestly unranked. It must never be a
   plausible ranking measured from `(0,0)`; the estate already refuses that exact fiction by name
   (`NearestStoreFinder.cs:65-70`, `NearestStoreService.cs:81-85`). A store is never omitted for
   want of a coordinate.
5. **`available: false` means unknown, not empty.** The read is a **remote HTTP hop out of SIS.Api**
   — the only one on this contract — so it degrades exactly as
   [§2.1](#21-field-rules)'s `atp` does and as `CallCenterAtpAnnotator` already does: race a
   timeout, never throw, never a non-200. The console must render *we could not check* differently
   from *nobody has it*, per [135](../../135-agent-console-prototype.md)'s three-way ATP rule.
6. **Separate from `priceCheck` on purpose.** The price is a lock-free engine run in SIS.Api's own
   process; this is somebody else's service over the network. Different failure modes, different
   budgets, and a stock outage must not cost the agent the price they asked for. They render in one
   panel and fail independently.
7. **Gate and identity.** `capabilities.canPriceCheck` gates both — same panel, same predicate
   (caller attached **and** a store somebody chose, [§2.3](#23-the-opening-gate-v13)), and the
   ranking *needs* a chosen plant to rank from, so the gate is a prerequisite rather than a
   coincidence. A store is named by `plant` + `city` + `areaName`, all of which the underlying row
   already carries — no join, and 137 left `StoreDetails` off the door.

**No new error codes, no new capability.** §7's `ITEM_NOT_FOUND`, `NO_CUSTOMER_ATTACHED` and
`STORE_NOT_CHOSEN` already say everything this read can refuse; a stock outage is rule 5, not an
error.

**Not here:** the SMS referral. The till can text the customer a map link to the chosen pharmacy;
that is a new outbound-messaging power with its own consent design and is out of phase 1.

---

## 4. Idempotency — `requestId`

Every mutating verb carries a client-minted ULID. **One user action = one `requestId`**, reused
verbatim across every retry of that action, including a retry that carries a `confirmToken`.

```
1st   POST AddItem { requestId: R }        → 200 SessionState(v12) replayed:false
retry POST AddItem { requestId: R }        → 200 SessionState(v12) replayed:true   // not re-applied
new   POST AddItem { requestId: R' }       → 200 SessionState(v13)                 // a real second add
```

- The ledger is a **bounded ring of the last 50 applied `requestId`s on the `CallCenterSession`
  sidecar row** — not a new table, not the engine snapshot. Fifty comfortably exceeds any plausible
  in-flight window on a single call.
- A replay returns the **current** state, not the state as of the original apply. The client renders
  latest truth; it is not replaying history.
- **Ordering across the two stores is load-bearing** ([§6.4](#64-two-stores-one-projection)).

---

## 5. Confirmation — `pendingConfirmation`

A verb that needs the agent to accept something returns `200`, `success:true`, the **unchanged**
state, and:

```jsonc
"pendingConfirmation": {
  "kind": "storeChange",              // storeChange | belowAtp
  "confirmToken": "01JC8QF…",
  "expiresInMs": 120000,
  "detail": { /* kind-specific, below */ }
}
```

Re-sending the **same verb** with the **same `requestId`** plus `confirmToken` commits exactly what
was previewed. The token pins the previewed change: the server re-derives it and, if the basket has
moved underneath, refuses `CONFIRM_TOKEN_STALE` — the agent is re-shown a fresh preview rather than
committing a diff they never saw. Tokens are single-use and expire in 2 minutes.

Nothing else on this map is two-phase. A verb never returns both a mutation and a
`pendingConfirmation`.

### 5.1 `kind: "storeChange"`

Raised by `setAddress` (the usual path — the plant is *derived* from the address district via
CC2's `tempStoreCode || storeCode` rule, [132](../../132-header-capture-inventory.md)) and by
`setStore` (explicit operator override) **whenever lines exist and the plant would move**. An empty
basket or an unchanged plant applies inline with no confirmation at all.

v1.1: `setFulfilment` **never raises this** — the flip does not move the plant ([§2.2](#22-deliverytype--the-fulfilment-axis-v11)).
It is raised on the *re-derivation* a `PickInStore → Delivery` flip triggers, which reaches this path
through `setAddress`'s existing rule, not through a second one.

```jsonc
"detail": {
  "fromPlant": "1101", "toPlant": "1204",
  "lineDiffs": [ { "lineId": "L1", "fromGross": 27.60, "toGross": 25.30 } ],
  "promotionsMoved": [ { "offerId": "BBY-4471", "fromAmount": -8.40, "toAmount": -6.00 } ],
  "unpriceableLines": [ { "lineId": "L3", "itemNumber": "300921", "reason": "NO_PRICE_AT_PLANT" } ],
  "atpReFreeze": [ { "lineId": "L1", "fromQty": 5, "toQty": 2, "belowAfter": false } ]
}
```

- The preview is the engine door **run and not persisted** — free under resume-per-request, which is
  why there is no `dryRun` flag ([129](../../129-rebind-store-door.md)).
- If `unpriceableLines` is non-empty the commit **refuses atomically** with `REBIND_REFUSED`; the
  agent must void those lines first. Nothing partial is ever persisted.
- The rebind re-prices with `"C" NewPricingAndKeepManual`, so the coupon line and `DFEE` survive.
- ATP is **re-frozen** from a caller-supplied per-line map (the engine never reads stock); old→new
  is kept in the audit and shown as `atpReFreeze`.
- Promotion *selection* does not change on a rebind — only its value (`Plant` occurs once in
  `SIS.Pricing.Core`; BBY keys on Origin, which is sticky).

### 5.2 `kind: "belowAtp"`

Raised by `addItem` and `changeQty` when the requested quantity exceeds availability at the order's
plant. ATP is a **soft** gate: the confirm always succeeds, it is never a block.

```jsonc
"detail": { "itemNumber": "100001", "requested": 5, "available": 2, "plant": "1101" }
```

On commit the line carries `belowAtpAtScan: true` and the header `hasBelowAtp: true` — the
BackOffice fraud signal (285/286). **The token is the audit record**: it proves the agent was shown
the number they accepted, which a client-set boolean could not. Where the stock read degraded
(`known:false`) there is no confirmation at all — unknown ATP never gates entry (287).

---

## 6. Concurrency, staleness, ordering

### 6.1 The claim

15 s strict lease, held for one request, released in `finally`, no heartbeats
([127](../../127-engine-session-lifecycle.md)). A collision returns `SESSION_BUSY` with
`retryAfterMs`. The client retries with backoff `0 · 400 · 800 · 1600 · 3200 ms` — a ~15 s ceiling
matching the worst-case self-lockout — **in `features/callcenter/api.ts`, never in
`src/core/api.ts`**: lease semantics must not enter the layer every back-office grid shares. After
the ceiling the console draws a "still busy" state offering a manual retry, and `getState` is the
universal recovery action after any conflict.

### 6.2 The second tab, and the stale tab

One order per agent, per-agent `register`, so a second tab is *granted* the claim, not refused —
the two tabs serialize through the lease and both see the same basket via `version`. A response
carrying a lower `version` than the one on screen is discarded ([§2.1](#21-field-rules)).

The dangerous case is the **stale tab on a dead order**: the agent abandoned A, opened B for a new
caller, and a forgotten tab still showing A fires an add. Because `transactionId` is explicit and
validated, that add is refused `SESSION_CLOSED` with `reason: "abandoned"`. It can never land on B.
This is the same harm 127 refused auto-resume to prevent, closed on the other side.

### 6.3 The attach-before-address ordering constraint

137 scoped the five `CustomerAddresses` routes **server-side to the session's attached customer**,
because the originals are unscoped (`DeleteCustomerAddress` takes only an `addressNumber`). So the
address book is **unreachable before `attachCustomer`** and `setAddress` before attach is a real
wire state, not a UI nicety:

- `capabilities.canOpenAddressBook` is `false` until a customer is attached.
- `setAddress` without a customer → `NO_CUSTOMER_ATTACHED`.
- An address belonging to someone else → `ADDRESS_NOT_FOR_CUSTOMER` (never "not found" — the
  distinction matters for support, and both are refusals rather than silent empties).
- `removeCustomer` **clears the address, the derived plant is retained**, and any subsequent
  `setAddress` re-derives it through the normal confirm path.
- v1.3: `removeCustomer` **with lines already on the order keeps the lines** — owner ruling. The
  basket stays priced at the plant it has; only the gate shuts, so the item command line disappears
  ([§2.3](#23-the-opening-gate-v13)) and re-attaching a caller re-opens it. `plantSource` is **not**
  rewound to `seededAtOpen`: a store that was chosen stays chosen, and the ordinary "wrong caller,
  same items" correction costs nothing. This state has **no WPF precedent** — CC2 has no basket, so
  the situation cannot arise there; it is one the web creates by making the engine session live from
  the first keystroke, the same way 154's mid-basket fulfilment flip was.
- v1.1: under `PickInStore` the address book is unreachable for a **second, independent** reason —
  the order has no address at all ([§2.2](#22-deliverytype--the-fulfilment-axis-v11)). Both gates
  report through the same `capabilities.canOpenAddressBook: false`, so a client that only reads the
  capability needs no mode-specific branch.

### 6.4 Two stores, one projection

The engine snapshot lives in the **HQ store DB**; the `CallCenterSession` sidecar lives in
**SIS.Api's** DB. There is no distributed transaction. The ordering rule is therefore part of the
contract, not an implementation detail:

```
1. reserve requestId on the sidecar   (state = inFlight)
2. claim → resume → mutate → persist  (engine)
3. mark requestId applied + write any sidecar header field
4. release claim
```

- A crash **between 1 and 2** leaves an `inFlight` marker: the retry sees it, cannot know whether the
  engine applied, and answers `SESSION_BUSY` until it can resolve by reading the engine version
  recorded at step 1. It never blindly re-applies.
- A crash **between 2 and 3** leaves the engine ahead of the sidecar: the retry finds the recorded
  pre-mutation version *below* the engine's current version, concludes the mutation applied, and
  completes step 3 idempotently. This is why step 1 records the version it is about to mutate from.
- Reversing 1 and 2 would let a crash produce a double-apply on retry. 🚩 **This ordering is the
  single most fragile thing in the contract and belongs in 804's acceptance tests.**
- Sidecar-only fields are never price-affecting, so an orphaned sidecar row is recoverable and an
  orphaned engine transaction is swept at 12 h (127).

### 6.5 The two address-book writes that are order acts (v1.9)

Added by [179](../../179-the-address-editor-and-its-capture-contract.md). The address book is a
**customer** store reached through [801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md)'s
five `CallCenterWeb/CustomerAddresses*` routes — not through this contract. Three of the five are
pure book acts and this document has nothing to say about them (create a *new* address, edit one the
order is **not** using, set a default). **Two of them reach into the order**, and because they arrive
on a different door than the verb that would notice, the rule has to be written here or nowhere.

**1. Editing the address the order holds re-pins the store.** The map has already ruled that the
district→store derivation is *"pinned at the moment the operator picks **or edits** an address"*
([126](../../126-web-call-center.md), Out of scope). But `setAddress` carries only an
`addressNumber`, and an edit does not change it — so a `PUT` that moves an address from Al Malqa to
Al Olaya changes the **book row** while the order keeps a plant derived from a district that address
no longer sits in, and `header.address.line` keeps rendering the old composition. Nothing on the
wire would say so.

> **The rule: after a successful `PUT` of the address whose `addressNumber` equals
> `header.address.addressNumber`, the console re-issues `setAddress` with that same
> `addressNumber`.** No new verb — `setAddress` already carries the whole re-derivation, already
> raises the [§5.1](#51-kind-storechange) `storeChange` confirmation when there are lines, and
> already refuses `NO_DELIVERY_STORE_FOR_DISTRICT`. An edit is a book write followed by a re-pin,
> and the agent sees exactly the store-move preview a different address would have shown them.

🚩 **The server must not short-circuit a same-number `setAddress` as a no-op.** This is the one place
where a call that looks idempotent is genuinely state-changing: same `addressNumber` in, a different
plant possibly out. An early-return on *"they already have this address"* would make the edit silent
in exactly the case the rule exists for. (`requestId` replay is unaffected — a *replay* returns the
recorded answer, which is correct; a *fresh* request must re-derive.)

⚠ Consequence worth naming: an edit can leave the book row saved and the order **refusing** it —
the agent edits their own current address into a district carrying no store, the `PUT` succeeds and
the re-pin answers `NO_DELIVERY_STORE_FOR_DISTRICT`. The order keeps the plant and address it had;
the book keeps the edit. That is the honest outcome (the customer's address really is what they
said) and the console says the order cannot be delivered from it, rather than rolling back a
correction the caller just made.

**2. Deleting the address the order holds is refused.** The order's sidecar keeps an
`AddressNumber`, not a copy of the fields — and the submit builder copies address **fields** onto the
document (`Cc2DocumentHeaderBuilder.ApplyShippingAddress`), so the web's submit path re-reads the
book. `SdAddressService.GetCustomerAddresses` filters `IsDeleted = 0`. A delete of the current
address therefore produces a delivery order that **cannot build a shipping address at submit** — an
order broken at the last step by an act on a different door.

> **The rule: `DELETE CallCenterWeb/CustomerAddresses` refuses when the target is the session's
> current `addressNumber` — `ADDRESS_IN_USE_BY_ORDER` (409, §7).** The console also omits the delete
> control on that row (`AddressChoice.isCurrent` already exists), but the refusal is the guard and
> the omission is the courtesy: a client-side rule alone is the second implementation this contract
> keeps refusing to have.

The alternative — allow the delete and clear the order's address — was rejected: it cascades a
**book** act into **order** state, silently shutting the opening gate ([§2.3](#23-the-opening-gate-v13))
mid-call and, under `Delivery`, discarding the store derivation with it. A caller tidying their
address book must not lose the order they are placing.

---

## 7. Error taxonomy

Every refusal is a non-2xx carrying the envelope with `success:false`, `message` (human, server-
supplied — the client passes it through as data, no key needed) and `errors[0].errorCode` (machine).
`src/core/api.ts` already maps this shape to `ApiError(kind:'business')`; `apiErrorCode()` is how the
console branches.

| Code | HTTP | `ApiError` kind | Meaning / client action |
|---|---|---|---|
| `SESSION_BUSY` | 409 | business | Claim collision. **Auto-retry** with `retryAfterMs`, bounded (§6.1) |
| `NOT_YOUR_SESSION` | 403 | business | The transaction belongs to another register. Hard stop; offer `getState` on own order |
| `SESSION_CLOSED` | 409 | business | Carries `reason: submitted \| abandoned \| swept`. Stale tab; console returns to the start |
| `SESSION_ALREADY_OPEN` | — | — | **Not an error.** `open` answers this on the success path as `OpenResult.outcome = 'refusedExisting'` (§8.1) |
| `CONFIRM_TOKEN_STALE` | 409 | business | The basket moved under a preview. Re-issue: the client re-sends without the token and re-shows the fresh preview |
| `CONFIRM_TOKEN_INVALID` | 400 | business | Unknown, expired, or already-used token |
| `REBIND_REFUSED` | 409 | business | Atomic refusal; carries `unpriceableLines[]`. Agent voids those lines and retries |
| `NO_CUSTOMER_ATTACHED` | 409 | business | Address book / `setAddress` before `attachCustomer` (§6.3). v1.3: also `addItem` against the opening gate (§2.3) |
| `STORE_NOT_CHOSEN` | 409 | business | **v1.3** — `addItem` while `plantSource == "seededAtOpen"`. Also the `submitBlockers` entry that puts the store chip in its attention state (§2.3) |
| `NO_DELIVERY_STORE_FOR_DISTRICT` | 409 | business | **v1.3** — `setAddress` on a district carrying neither `StoreCode` nor `TempStoreCode`. A hard block: the row stays visible and unpickable (§2.3) |
| `PAYMENT_TYPE_FORCED` | 409 | business | **v1.4** — `setPaymentType` on an order whose `paymentTypeForcedReason` is non-null. Unreachable in phase 1 (no forcing rule is configured — §2.4); typed now so it never has to be added later |
| `PAYMENT_TYPE_INVALID` | 400 | business | **v1.4** — a value outside `CashOnDelivery \| Online`. Covers `Receivable`, which is **reserved and refused** in phase 1 (§2.4) |
| `ADDRESS_NOT_FOR_CUSTOMER` | 403 | business | Address belongs to a different customer |
| `ADDRESS_IN_USE_BY_ORDER` | 409 | business | **v1.9** — `DELETE CallCenterWeb/CustomerAddresses` against the address the open order currently holds ([§6.5](#65-the-two-address-book-writes-that-are-order-acts-v19)). The console omits the control too, but this is the guard |
| `ITEM_NOT_SELLABLE` | 409 | business | Fails CC1's whitelist / blocked / wrong `ItemType` (131) |
| `ITEM_NOT_FOUND` | 404 | business | Unknown item number at this client |
| `NO_PRICE_AT_PLANT` | 409 | business | The item does not price at the order's store |
| `UOM_NOT_AVAILABLE` | 409 | business | Requested UoM not valid for the item |
| `LINE_NOT_FOUND` | 404 | business | `lineId` no longer exists (usually a stale screen) |
| `QTY_INVALID` | 400 | business | Zero, negative, or beyond the per-line cap |
| `COUPON_REJECTED` | 409 | business | Carries the engine's own reason sub-code; never a crash |
| `COUPON_ALREADY_APPLIED` | 409 | business | Idempotent-ish duplicate the agent should see |
| `SLOT_UNAVAILABLE` | 409 | business | Slot no longer active (CLCN's *soft* gate — a warning path, not a submit blocker) |
| `SOURCE_REFERENCE_REQUIRED` | 400 | business | Mandatory source reference missing |
| `SUBMIT_REFUSED` | 409 | business | 133's `refused`. Carries `field` naming what to fix. Transaction stays Open |
| `SUBMIT_UNAVAILABLE` | 503-with-envelope | business | 133's `unavailable`. Transient; transaction stays **Open and retryable**. Deliberately *not* mapped to `server` |
| `CONSOLE_NOT_GRANTED` | 403 | business | The grant probe failed. The console draws its own way home (134 — it is chrome-less) |
| — | 401 | auth | Handled entirely by `core/api.ts`'s `handle401`; feature code never catches it |

**There is no `unknown` submit state.** 133's in-process ruling removes the in-flight gap that would
produce one. **`SUBMIT_UNAVAILABLE` returns 503 but must carry the envelope**, or `core/api.ts` maps
it to `kind:'server'` and the console shows "unexpected" for a routine retryable outcome —
a conformance-test assertion, not a note.

---

## 8. The three non-`SessionState` results

### 8.1 `OpenResult`

```jsonc
{ "outcome": "opened", "state": { /* SessionState */ }, "existing": null }
```
```jsonc
{ "outcome": "refusedExisting", "state": null,
  "existing": { "transactionId": "01JC8…", "customerName": "…", "lineCount": 4,
                "openedAt": "2026-07-27T08:41:00Z", "plant": "1101" } }
```

A refusal, but on the **success path** — it is a choice, not a failure. The console offers *resume*
(`getState` on that id) or *abandon-and-open-fresh* (`abandon` then `open`). **Never silent
auto-resume**: an agent who has just picked up a new caller must not inherit the previous caller's
basket (127). This is also the reconnect story after any crash, refresh, or closed tab.

### 8.2 `AbandonResult`

```jsonc
{ "outcome": "abandoned", "transactionId": "01JC8…" }
```

`VoidTransactionAsync`. Coupon reversal rides for free via `CollectReversalContexts()` — **provided
SIS.Api registers the reversal handlers** (a composition requirement, 127). No state is returned:
there is nothing left to render.

### 8.3 `SubmitResult`

```jsonc
{ "outcome": "submitted",        "documentNo": "0090012345", "state": { /* status:"submitted" */ } }
{ "outcome": "alreadySubmitted", "documentNo": "0090012345", "state": { /* status:"submitted" */ } }
```

Both are **successes and the client treats them identically** — once-only is `(OrderNo, DocumentType)`
with `OrderNo := TransactionId`, and on the already-submitted path the server still completes the
local tail (133). `refused` and `unavailable` are the error path (§7).

Submit takes **only the transaction id**: no document, no lines, no amounts, no fee. The CLCN
document is built server-side from engine state by `Cc2DocumentHeaderBuilder` over the sidecar row
(map note 3). The **delivery fee is quoted live in `totals` as lines change**, not computed at
submit.

⚠ **v1.5 clears the flag that stood here.** The rule is no longer WPF-resident: BackOffice 786 §2
extracted it to `CallCenterDeliveryFeePolicy`, a pure static both hosts call — the till through
`POSCommon.ShippingAmount`, SIS.Api through both `QuoteDeliveryFeeAsync` and the submit — over the
same `PosConfig`-backed options in the same HQ store DB. The quote and the charge are the same
computation over the same inputs, so 133's *"or the web quotes a different fee from the till"* is
closed. See [156](../../156-delivery-fee-shared-rule.md) and its
[research note](../156-delivery-fee/RESEARCH.md); the residual is that the two calls **recompute
rather than pin**, so a call crossing a campaign boundary can quote one number and charge another —
named there, deliberately not fixed here, because pinning would contradict *quoted live*.

---

## 9. Revision protocol

The contract is **this document**, in `oms-react`, linked from every BackOffice issue on the map.

- **Every response carries `contractVersion` (`"major.minor"`).** The client checks it on the first
  response of a session.
- **Additive changes** — a new optional field, a new error code, a new `skipReason` category — bump
  the **minor** and land by either track editing this document. No ceremony, no owner ruling. Clients
  **ignore unknown fields by rule**, so an additive change can ship server-first.
- **Breaking changes** — a removed or renamed field, a changed meaning, a changed status code — bump
  the **major**, require an **owner ruling**, and land as a dated entry in
  [§10 Amendments](#10-amendments), appended, never rewritten in place.
- **Major mismatch is a client hard stop**: the console refuses to run and asks to be updated rather
  than mis-rendering money. Minor drift in either direction is fine.
- **Conformance is the enforcement.** The backend track owes `CcContractFixtureTests` — the eight
  scenarios of [§11](#11-fixtures), serialized from real responses and diffed against the committed
  fixtures. A drift that the version rules permit shows up there as a diff to accept; one they don't
  shows up as a failing build.
- Note 15 expects **one deliberate revision after first integration**. That revision is the moment
  the provisional fixtures are replaced by captures — one event, not a negotiation.

---

## 10. Amendments

| Version | Date | Change | Kind | Ruled by |
|---|---|---|---|---|
| 1.0 | 2026-07-27 | Frozen. | — | [136](../../136-session-api-contract.md) |
| 1.1 | 2026-07-27 | **The fulfilment-mode axis.** New `header.deliveryType`, new `setFulfilment` verb, new `capabilities.canChangeFulfilment`, new fixture 09. Both modes in phase 1. | **minor — additive** | [154](../../154-fulfilment-mode-and-store-choice.md) |
| 1.2 | 2026-07-28 | **Two optional request fields, from the server build.** `addItem.uom?` — `ScanOptions.Uom` already exists, and an agent adding a box rather than a strip should not have to add-then-change; absent ⇒ the engine's own default unit, exactly as before. `setSlot.day? / description? / from? / to?` — the CLCN header stamps all five slot fields (`CreateDocument :18730-18734`) and the slot catalogue is deliberately **not** on this door ([137](../../137-callcenter-web-door.md) kept the reference reads on their existing routes), so the client passes back the slot it already picked rather than the server re-resolving it through a route that would have to be added. Neither field is price-affecting and both are optional, so a client that sends neither is unchanged. | **minor — additive** | [804](C:\Work\DMSCO\BackOffice\.issues\804-cc-session-contract-server-obligations.md) |
| 1.2 | 2026-07-28 | **The fixtures became CAPTURES** ([§11](#11-fixtures)). Driven live against the real `CallCenterWeb/*` handlers, the engine and the serializer; `_contract.provisional` deleted, `_capture` in its place. **No wire change** — the shapes the eight v1.0 fixtures hand-authored all held, and the one difference every diff shows is `contractVersion` reading `1.2` rather than `1.0`, which is these two additive amendments, not drift. Three legs are recorded as unreachable (858 / 859 / 860) and the §5.1 diff basis is settled: `lineDiffs[].fromGross` / `toGross` are the ENGINE's gross — **pre-discount and ex-VAT** (`RepricingItemDiff.Old/NewGrossValue`), NOT the line's VAT-inclusive `lineTotal.gross`; carried as-is because the preview is what the confirm token PINS, and a computed number would pin a figure the engine never produced. `promotionsMoved` is always `[]` for the same reason: the engine's rebind diff is per LINE, not per offer. | **documentation — no wire change** | [857](C:\Work\DMSCO\BackOffice\.issues\857-cc-contract-fixture-conformance.md) |

| 1.3 | 2026-07-28 | **The opening gate** ([§2.3](#23-the-opening-gate-v13)). `canAddItem` tightens to *caller attached AND a store somebody chose*; `plantSource` gains **`seededAtOpen`** and **`chosenForPickup`** (four values); new `capabilities.canConfirmSeededStore`; new `header.orderNote` + `setOrderNote` verb; new codes `STORE_NOT_CHOSEN` and `NO_DELIVERY_STORE_FOR_DISTRICT`; `removeCustomer` keeps the lines ([§6.3](#63-the-attach-before-address-ordering-constraint)). | **minor — additive** | [175](../../175-nothing-enters-an-unaddressed-order.md) |

| 1.4 | 2026-07-29 | **The collection axis** ([§2.4](#24-paymenttype--the-collection-axis-v14)). New `header.paymentType` (`CashOnDelivery \| Online \| Receivable`, the third **reserved**), new `header.paymentTypeForcedReason`, new `setPaymentType` verb, new `capabilities.canChangePaymentType`, new codes `PAYMENT_TYPE_FORCED` and `PAYMENT_TYPE_INVALID`, new fixture 11. Default `CashOnDelivery`; an axis **independent** of `deliveryType`; not a tender — it instructs OMS to send a gateway link. | **minor — additive** | [155](../../155-payment-type-cod-or-online.md) |
| 1.5 | 2026-07-29 | **A waived delivery fee says why** ([§2.5](#25-deliveryfeewaivedreason--why-the-fee-fell-away-v15)). New `totals.deliveryFee.waivedReason` (`ThresholdReached \| PromotionalWindow \| ConfiguredOverride`, the third **reserved and unreachable in phase 1**), non-null exactly when `waived` is true. No new verb, no new code, no new capability — the console could not derive this without recomputing a server rule, and would get it wrong the day the third value becomes reachable. ⚠ The rule itself needed **no change**: [786](C:\Work\DMSCO\BackOffice\.issues\786-web-cc-submission-path.md) §2 had already extracted `CallCenterDeliveryFeePolicy` as the one copy both hosts call, which is why §8.3's *"WPF-resident"* flag is cleared in the same revision. 🚩 **Re-baselines every capture** — the field lands inside `totals`, which every fixture carries. | **additive** — a v1.4 client ignoring it renders exactly what it renders today | [156](../../156-delivery-fee-shared-rule.md) |

| 1.6 | 2026-07-29 | **The price check** ([§3.4](#34-pricecheck--what-an-item-costs-without-adding-it)). New `priceCheck` read (`GET CallCenterWeb/PriceCheck`) returning a new `PriceCheckResult`, new `capabilities.canPriceCheck`, new fixture 12. **No new error code, no change to any existing field.** The answer is a real pricing run at the order's own header — VAT-inclusive **engine money**, equal to the basket line — because the engine prices in a throwaway context that takes **no claim** (`SimulationService.Simulate`), so the read cannot collide with the agent's own basket. Always qty 1; the client sends `transactionId` + `itemNumber` and nothing else. Offers ride the §3.2 vocabulary with a new `offersComplete` flag carrying 130's discovery blocker honestly. | **minor — additive** | [157](../../157-price-check.md) |

| 1.8 | 2026-07-29 | **Two fields the drawn mode needs** ([§2.6](#26-what-the-flip-does-to-the-screen-v18)). New `header.retainedAddressLabel` — the LABEL, never the address — non-null only under `PickInStore` where an address was ever picked, so *switching back may move the store* is known before the confirmation arrives. New `capabilities.capabilityReasons` — a map keyed by capability name, valued as a typed code, carrying **why** a `can*` is false; its first use is `canChangeFulfilment: false` on a delivery-only document source (`DocumentSourcePolicyService.SupportsPickInStore` — WSFD / P2E / DKSW), and it also serves the already-shipped `canChangePaymentType`. 🚩 The client alternative to the first field was **built and rejected** by the owner: a console that remembers the last address IT saw is blank after a refresh and in a second tab, so one order reads two ways. No verb changes, no code changes, nothing frozen moves. | **minor — additive** | [176](../../176-fulfilment-mode-drawn.md) |

| 1.7 | 2026-07-29 | **Stock at other stores, read-only** ([§3.5](#35-stockelsewhere--who-else-has-it-read-only)). New `stockElsewhere` read (`GET CallCenterWeb/StockElsewhere`) returning a new `StockElsewhereResult`, new fixture 13. **No new error code, no new capability** — `canPriceCheck` gates both halves of the one "about this item" panel. It is the **only read on this contract that is a remote HTTP hop out of SIS.Api**, so `available: false` means *unknown*, never *nobody has it*, and it is a separate call from `priceCheck` precisely so a stock outage cannot cost the agent the price. `atp` is the same definition the search row already carries. Ruled **read-only**: a store change is the order's act through `setStore` + §5.1, never a one-click from an item's panel. | **minor — additive** | [158](../../158-stock-in-other-stores.md) |

| 1.9 | 2026-07-29 | **The two address-book writes that are order acts** ([§6.5](#65-the-two-address-book-writes-that-are-order-acts-v19)). One new code, `ADDRESS_IN_USE_BY_ORDER`. **No new verb, no new field, no new capability** — an edit of the order's current address re-pins the store by re-issuing the `setAddress` this contract already has, which is why the map's *"pinned at the moment the operator picks **or edits** an address"* ruling needed a rule here rather than a mechanism. 🚩 The one server obligation is a **negative** one: a same-`addressNumber` `setAddress` must not be short-circuited as a no-op, because it is the single call on this contract that looks idempotent and is not. The capture payload itself is [878](C:\Work\DMSCO\BackOffice\.issues\878-cc-address-capture-and-order-acts.md)'s, on 801's door, not this document's. | **minor — additive** | [179](../../179-the-address-editor-and-its-capture-contract.md) |

**Why 1.6 and 1.7 are not 2.0.** Nothing frozen moves. Each is one new read, one new result shape,
and at most one new capability — a v1.5 client that has never heard of `priceCheck` or
`stockElsewhere` renders exactly what it renders today.
The one thing that *looks* like a meaning change is the relationship between `estimatePriceExVat` and
this number, and it is not one: §3.4 rule 2 keeps both, in different places, saying different things.
The estimate does not become truth and truth does not move onto the row.

**Why 1.4 and not 2.0.** Every part of 155 is a new field, verb, capability or code; nothing frozen
changes meaning. A v1.3 client that ignores all of it renders an order without saying how it will be
paid — wrong, but not *mis-rendered money*, which is the hazard the hard stop exists for. The one
value that would genuinely break a client is `Receivable`, and it is reserved and refused rather than
emitted, which is why naming it now is cheaper than a major later. Same reasoning as 1.1 and 1.3.

**Why 1.3 and not 2.0.** 175 was raised expecting a major, on the reading that *"items are refused
until a caller and a store exist"* changes what `canAddItem` **means**. It does not. §2's own
definition of `capabilities` is *"what the server will accept right now"* — the **answer** moved, the
**definition** did not, and a definition whose answer is not allowed to change is a constant, not a
capability. A v1.2 client that reads `canAddItem` — as §2's *"advisory-but-authoritative"* rule
already requires it to — is correct on the first response with no change at all; one that ignores it
gets `STORE_NOT_CHOSEN`, which is §7's typed refusal doing exactly its job. The two new `plantSource`
values are the one place a v1.2 client is genuinely wrong, and it is wrong the *safe* way: it fails
to draw the derived parenthetical on a store nobody chose, which is the bug 175 exists to fix, not a
new one. No money is mis-rendered, so the major's client hard stop would buy nothing and cost a
re-baseline of all nine captures. Same reasoning that made 154 a 1.1. Dated here anyway, because the
reasoning is the part worth keeping.

**Why 1.1 and not 2.0.** 154 was raised expecting a major: *"address optional, store chosen not
derived, no delivery fee"* reads like three changed meanings. Checked against the frozen text, none
of them is. `address` was **already** nullable (§2: *"null until `setAddress`"*). §5.1 **already**
defines `setStore` as an explicit operator override, so a chosen store was never outside the
contract. `submitBlockers` was **already** a varying list, and `totals.deliveryFee.amount` a varying
amount. Every v1.1 change is a **new** field, verb or capability, and a v1.0 client that ignores all
three — as §9 requires it to — renders a pickup order as a delivery order with no address and no
slot, which is wrong but is not *mis-rendered money*, the hazard the hard stop exists to prevent.
So the major's client hard stop would buy nothing and cost a re-baseline of all eight fixtures.
Recorded here as a dated amendment anyway, though §9 asks for one only on a major, because the
reasoning is the part worth keeping.

---

## 11. Fixtures

Nine scenarios, committed beside this document. **They are CAPTURES** (857, 2026-07-28), no longer
hand-authored: each opens with a `_capture` provenance block — the 098 pattern — and was taken off
the real `CallCenterWeb/*` handlers running against a live store DB and the real pricing engine, with
the response produced by ASP.NET Core's own result execution so the status code and the JSON bytes
are the wire's. The `_contract.provisional` flag is gone.

⚠ **Fixtures 10 and 11 are owed, not written.** They are specified here and captured — never
hand-authored — when the server side that produces them lands
([871](C:\Work\DMSCO\BackOffice\.issues\871-cc-opening-gate-and-plant-source.md)). A hand-authored
file beside nine captures would be indistinguishable from a capture and is exactly what 177 found
costs two client defects.

| File | Scenario |
|---|---|
| [`01-open-empty.json`](01-open-empty.json) | `open` on a clean agent — the empty basket every other fixture starts from |
| [`02-two-lines-priced.json`](02-two-lines-priced.json) | Two priced lines, a fired promotion, a delivery fee, full header |
| [`03-near-miss-buy-side.json`](03-near-miss-buy-side.json) | A near-miss inline and its on-demand `resolvePrereq` — which currently 404s (859) |
| [`04-below-atp-confirm.json`](04-below-atp-confirm.json) | `addItem` → `pendingConfirmation: belowAtp`; the commit leg is a no-op (858) |
| [`05-rebind-preview.json`](05-rebind-preview.json) | `setStore` → `pendingConfirmation: storeChange` with a full diff; the commit leg is a no-op (858) |
| [`06-rebind-refused.json`](06-rebind-refused.json) | The atomic `REBIND_REFUSED` with `unpriceableLines[]` |
| [`07-submit-already-submitted.json`](07-submit-already-submitted.json) | The first submit success, and the `SESSION_CLOSED` a retry currently gets instead of §8.3's replay success (860) |
| [`08-session-busy.json`](08-session-busy.json) | `SESSION_BUSY` (a real held claim), the `replayed: true` retry, the stale tab, and the second `open` |
| [`09-fulfilment-flip.json`](09-fulfilment-flip.json) | v1.1 — `setFulfilment` to `PickInStore` on a basket with lines: plant unchanged, no confirmation, address retained but header-absent, slot cleared, fee to 0 |

| [`11-payment-type.json`](11-payment-type.json) | **v1.4** — the collection axis: `open` answering `paymentType: "CashOnDelivery"` with `paymentTypeForcedReason: null` and `canChangePaymentType: true`, `setPaymentType` to `Online` and back with the plant, the lines, the totals and the delivery fee **all unchanged**, all four `deliveryType` × `paymentType` combinations round-tripping, and `Receivable` refused with `PAYMENT_TYPE_INVALID` |
| [`10-opening-gate.json`](10-opening-gate.json) | **v1.3** — the gate: `open` refusing an `addItem`, `attachCustomer` leaving it shut on `STORE_NOT_CHOSEN`, `setAddress` opening it, and the pickup `setStore`-confirm advancing `plantSource` to `chosenForPickup` with no confirmation raised |

🚩 **v1.3 makes captures 01 and 09 go red, correctly.** `01-open-empty.json` ships
`canAddItem: true` on an order with `customer: null` and `plantSource: "operatorOverride"` — both are
now wrong answers, and the diff that fails is the gate working. They are **re-captured, not edited**
(`CC_CONTRACT_CAPTURE=1`, §11's rule) once BackOffice
[871](C:\Work\DMSCO\BackOffice\.issues\871-cc-opening-gate-and-plant-source.md) lands; the captures
follow the server, never the other way round. Until then `01` and `09` are the same honest-fixture
situation as `03`/`04`/`05`/`07`: they record what the server really answers.

Fixture 09 exists because the other eight are **all delivery-path**. Nothing in 01–08 would catch a
server that raised a `storeChange` confirm on the flip, or one that cleared the retained address —
the two ways [§2.2](#22-deliverytype--the-fulfilment-axis-v11) is most likely to be implemented wrong.

### What the capture changed, and what it found

`CcContractFixtureTests` (BackOffice, `Pricing/SIS.Pricing.Tests/Pos/CcContract/`) drives all nine
against the real handlers and then **diffs** them: every key at every depth and the JSON kind of every
leaf, so a renamed or dropped field is red. Re-capturing is opt-in (`CC_CONTRACT_CAPTURE=1`) so it
cannot happen by accident — the file is a gate, not a snapshot that re-blesses itself. Values that
move between runs (ids, timestamps, prices, tokens) are not diffed; each scenario asserts the values
that ARE contract explicitly. Customer identity is replaced by stable placeholders on the way out, so
the standing "no real identity in any fixture" rule holds against a live database.

Three fixtures record a leg the server **cannot currently reach**, captured as it really answers
rather than as the contract promises — an honest fixture that goes red the day the fix lands:

| Fixture | Leg | Blocked by |
|---|---|---|
| `03` | `resolvePrereq` answers **404**: `nearMisses[].offerId` is blank, and §3.3 addresses an offer by exactly that field | [859](C:\Work\DMSCO\BackOffice\.issues\859-near-miss-offer-id-is-blank.md) |
| `04`, `05` | The **commit** half of both two-phase verbs is a no-op: the ask's own claim advances the engine version past the ledger's reservation, so the confirming retry (same `requestId`, as §0 law 3 requires) resolves as "already applied" and never touches the engine | [858](C:\Work\DMSCO\BackOffice\.issues\858-confirm-retry-swallowed-as-replay.md) |
| `07` | The retry gets `SESSION_CLOSED`, not §8.3's `alreadySubmitted` success — the session's liveness gate refuses before the once-only path runs, so a client that lost the first response cannot recover the `documentNo` | [860](C:\Work\DMSCO\BackOffice\.issues\860-already-submitted-replay-unreachable.md) |

Two defects the capture found were **fixed** in the same pass and are not visible as divergences: the
submit sent the POS engine's document-type id where the OMS catalogue needs `CLCN` (every submit died
as `SUBMIT_UNAVAILABLE`), and `setFulfilment` answered with the PRE-flip `deliveryFee` / `payable`
because the projection ran before the sidecar patch. A third, the shipping short address being filled
from the customer's second street line, is carried as
[861](C:\Work\DMSCO\BackOffice\.issues\861-web-cc-short-address-filled-from-street2.md).

Also confirmed as **expected, not drift**: `lines[].uomOptions` ships empty in phase 1 (`changeUom`
works; only the picker is missing), `nearMisses[].skipReason` can never be `NOT_DISCOVERED` until
buy-side BBY discovery lands (855), and `atpAtScan.known` is `false` wherever no stock service is
reachable — `null` is an honest answer the console renders differently from `0` (287).

Wiring them into `src/features/callcenter/__fixtures__/payloads.ts` is build work for `/implement`,
following the 098 pattern — imported from `.issues/assets/`, test-only, never in the bundle.
