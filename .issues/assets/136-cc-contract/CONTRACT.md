# The web call-center session API — frozen contract v1.1

> Asset of [136](../../136-session-api-contract.md), map [126](../../126-web-call-center.md).
> Frozen 2026-07-27 at v1.0; **v1.1** adds the fulfilment-mode axis
> ([154](../../154-fulfilment-mode-and-store-choice.md), additive — see [§10](#10-amendments)).
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
| **Method** | `POST` for every mutating verb (they all carry a `requestId` body). `GET` for the four pure reads |
| **Ids** | `transactionId` is the engine's ULID (26 chars). `requestId` is a client-minted ULID. `lineId` is the engine line identity as projected — opaque to the client |

### 1.1 The verb table

| Verb | Method + route | Body / query | Returns |
|---|---|---|---|
| open | `POST CallCenterWeb/Open` | `{ requestId }` | `OpenResult` |
| abandon | `POST CallCenterWeb/Abandon` | `{ transactionId, requestId }` | `AbandonResult` |
| submit | `POST CallCenterWeb/Submit` | `{ transactionId, requestId }` | `SubmitResult` |
| addItem | `POST CallCenterWeb/AddItem` | `{ transactionId, requestId, itemNumber, qty, confirmToken? }` | `SessionState` |
| changeQty | `POST CallCenterWeb/ChangeQty` | `{ transactionId, requestId, lineId, newQty, confirmToken? }` | `SessionState` |
| voidLine | `POST CallCenterWeb/VoidLine` | `{ transactionId, requestId, lineId }` | `SessionState` |
| changeUom | `POST CallCenterWeb/ChangeUom` | `{ transactionId, requestId, lineId, uom }` | `SessionState` |
| attachCustomer | `POST CallCenterWeb/AttachCustomer` | `{ transactionId, requestId, customerId }` | `SessionState` |
| removeCustomer | `POST CallCenterWeb/RemoveCustomer` | `{ transactionId, requestId }` | `SessionState` |
| applyCoupon | `POST CallCenterWeb/ApplyCoupon` | `{ transactionId, requestId, couponCode }` | `SessionState` |
| setAddress | `POST CallCenterWeb/SetAddress` | `{ transactionId, requestId, addressNumber, confirmToken? }` | `SessionState` |
| setStore | `POST CallCenterWeb/SetStore` | `{ transactionId, requestId, storeCode, confirmToken? }` | `SessionState` |
| setFulfilment | `POST CallCenterWeb/SetFulfilment` | `{ transactionId, requestId, mode }` | `SessionState` |
| setSlot | `POST CallCenterWeb/SetSlot` | `{ transactionId, requestId, slotId \| null }` | `SessionState` |
| setDocumentSource | `POST CallCenterWeb/SetDocumentSource` | `{ transactionId, requestId, documentSource, sourceReference }` | `SessionState` |
| getState | `GET CallCenterWeb/State` | `?transactionId=` | `SessionState` |
| resolvePrereq | `GET CallCenterWeb/ResolvePrereq` | `?transactionId=&offerId=` | `PrereqResolution` |
| itemSearch | `GET CallCenterWeb/ItemSearch` | `?transactionId=&query=` | `ItemSearchResult` ([799](C:\Work\DMSCO\BackOffice\.issues\799-cc-item-search-endpoint.md)) |
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
                                                                 hasBelowAtp, requestId ledger,
                                                                 confirm tokens
```

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
    "plantName": "Al Malqa",
    "plantSource": "derivedFromAddress",   // derivedFromAddress | operatorOverride
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
    "deliveryFee": { "amount": 15.00, "waived": false, "thresholdGross": 200.00, "conditionType": "DFEE" },
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
    "canAddItem": true, "canSubmit": false, "canChangeStore": true,
    "canOpenAddressBook": true,
    "canChangeFulfilment": true,  // v1.1 — true whenever status is open (§2.2)
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
can answer "when can I collect?". And `plantSource` says `operatorOverride` at `open` when nobody
overrode anything (it is the seeded entry store); pickup makes that value do double duty. Both are
recorded on 154 rather than invented here.

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
| `NO_CUSTOMER_ATTACHED` | 409 | business | Address book / `setAddress` before `attachCustomer` (§6.3) |
| `ADDRESS_NOT_FOR_CUSTOMER` | 403 | business | Address belongs to a different customer |
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
submit — 🚩 and its rule is WPF-resident (`POSCommon`) today, so it must become shared code or the
web quotes a different fee from the till (133).

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

Nine scenarios, committed beside this document. Each is `{ _contract, request, response }` — the
provenance block mirrors 098's `_capture` but declares itself **provisional**, because unlike 098
these are hand-authored against a server that does not exist yet.

| File | Scenario |
|---|---|
| [`01-open-empty.json`](01-open-empty.json) | `open` on a clean agent — the empty basket every other fixture starts from |
| [`02-two-lines-priced.json`](02-two-lines-priced.json) | Two priced lines, a fired promotion, a delivery fee, full header |
| [`03-near-miss-buy-side.json`](03-near-miss-buy-side.json) | A buy-side near-miss + its `resolvePrereq` resolution, and a `NOT_DISCOVERED` skip |
| [`04-below-atp-confirm.json`](04-below-atp-confirm.json) | `addItem` → `pendingConfirmation: belowAtp` → confirmed commit |
| [`05-rebind-preview.json`](05-rebind-preview.json) | `setAddress` → `pendingConfirmation: storeChange` with a full diff |
| [`06-rebind-refused.json`](06-rebind-refused.json) | The atomic `REBIND_REFUSED` with `unpriceableLines[]` |
| [`07-submit-already-submitted.json`](07-submit-already-submitted.json) | The already-submitted success carrying the first `documentNo` |
| [`08-session-busy.json`](08-session-busy.json) | `SESSION_BUSY` and the `replayed: true` response to the retried `requestId` |
| [`09-fulfilment-flip.json`](09-fulfilment-flip.json) | v1.1 — `setFulfilment` to `PickInStore` on a basket with lines: plant unchanged, no confirmation, address retained but header-absent, slot cleared, fee to 0 |

Fixture 09 exists because the other eight are **all delivery-path**. Nothing in 01–08 would catch a
server that raised a `storeChange` confirm on the flip, or one that cleared the retained address —
the two ways [§2.2](#22-deliverytype--the-fulfilment-axis-v11) is most likely to be implemented wrong.

**They are provisional until the conformance test replaces them.** At first integration the captures
overwrite these files, the `_contract.provisional` flag is deleted, and the block becomes a
`_capture`. Until then, no client test may treat a fixture *value* as evidence of engine behaviour —
only its **shape**. (098's `payloads.ts` states the standing rule this qualifies: a hand-copied
fixture is a rule tested against a hypothesis.)

Wiring them into `src/features/callcenter/__fixtures__/payloads.ts` is build work for `/implement`,
following the 098 pattern — imported from `.issues/assets/`, test-only, never in the bundle.
