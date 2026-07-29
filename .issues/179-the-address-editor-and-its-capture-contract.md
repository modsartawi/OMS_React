---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: done
blocked-by: —
---

# 179 — The address the agent creates, and the contract that carries it

## Question

Surfaced by [175](175-nothing-enters-an-unaddressed-order.md)'s CC2 read-through
([inventory §1–3](assets/175-cc2-inventory/CC2-INVENTORY.md)). The map has ruled the whole address
*selection* path — the book is the delivery picker, the district derives the store, the ordering
constraint makes attach come first. **Nothing on this map covers creating or editing an address**,
and the agent does it on a large share of calls: a first-time caller has no address book at all.

The frozen contract does not touch it — [137](137-callcenter-web-door.md) put the five
`CallCenterWeb/CustomerAddresses*` routes on the door and delegated their shape to BackOffice
[801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md), which specifies *scoping*
(session's attached customer) but not *payload*.

## What CC2 actually does, as the input

- **Nine fields, not two.** `BuildBusinessAddress` writes `CityCode`+`CityName`,
  `DistrictCode`+`DistrictName`, `Street1`, `Street2`, `BuildingNumber`, `Phone1`, `Phone2`,
  `ShortAddress`, `GpsLat`, `GpsLon`, plus three hard constants (`CountryKey "SA"`,
  `LanguageKey "A"`, `AddressType "H"`). `BusinessAddress` has 25 fields; the other sixteen CC2 never
  fills — **and the web must not fill them either**, or it puts empty columns into SAP that the WPF
  path never wrote.
- **The delivery phone is not the loyalty mobile.** `Phone1`/`Phone2` are the driver's number.
- **`ShortAddress` is the Saudi National Address**, `^[A-Z]{4}[0-9]{4}$`, upper-cased on set, empty
  is valid, malformed is an inline error. 🚩 The check is **format-only** — CC2's own comment says
  live verification against the SPL API *"is a separate integration that needs an API contract /
  credentials"* and is not wired. The web inherits the same check and the same absence; the question
  is whether it inherits it *knowingly* or quietly ships a validator that looks authoritative.
- **Labels are server data**, not an enum: `GetAddressLabels()` → `{LabelCode, LabelNameAr,
  LabelNameEn}`, default `"HOME"`, display `LabelNameEn ?? LabelCode`.
- 🚩 **`TouchLastUsed` fires at hand-off, never on selection** — picking an address must not disturb
  the book's ordering until an order is actually placed with it. The web's equivalent of "hand-off"
  is `submit`, which puts this on the server side of the line, not the client's.

## What must be decided

1. **The payload contract for create/edit.** Nine fields, the three constants, the label code. Whose
   shape — 801's, or does it become part of the session contract because the address is order state?
   🚩 This interacts with [178](178-the-transaction-absorbs-the-sidecar.md): if the address moves into
   the `PosTransaction` snapshot, "the address book entry" and "the order's address" stop being the
   same object, and the create path has to say which one it writes.
2. **The location picker is one search box, not a cascade** (inventory §0.2/§3). CC2 fetches
   **every** district once (~1,000 rows, `GetDistricts("")`) behind a single box matching district
   name EN/AR **or** city name EN/AR; picking a row commits both. The agent types `olaya` or
   `العليا` and is done. Two rules ride with it: the side panel **snapshots and reverts** unless the
   pick is explicit, and **a search that would hide the current pick must not clear it**. Confirm the
   one-fetch cost is acceptable on the web and that Arabic matching inherits CC2's
   `OrdinalIgnoreCase` limitation *knowingly* (no diacritic or hamza folding — CC2 calls it *"good
   enough for a dropdown filter"*).
3. **Where `NO_DELIVERY_STORE_FOR_DISTRICT` surfaces in the editor.** v1.3 makes it a `setAddress`
   refusal ([CONTRACT.md §2.3](assets/136-cc-contract/CONTRACT.md)) and the district row stays
   visible-and-unpickable. But an agent **creating** an address picks the district *before* any
   `setAddress` call exists to refuse it — so either the picker knows which districts are
   undeliverable (a new read), or the agent keys a whole address and is refused at the end.
4. **NOT this ticket: creating the loyalty customer.** [159](159-coupon-and-loyalty-signup-drawn.md)
   already owns the two-step OTP signup and is live. Three details the CC2 read-through adds to it,
   recorded here so they are not lost: `BranchId` is the **agent's own store**, not the order's
   plant; the preferred-language choice is the **customer's** contact language, not the agent's UI
   language; and the referral rule is carried verbatim from the legacy controller
   (`ReferralCode = "W"` when the active POS controller sits on customer `0001100135`).
   The two tickets meet at one point only — a caller created by 159's flow has an **empty address
   book**, which is the state this ticket's editor exists to serve.

Deliverable: the ruling on the capture contract and the picker, written as whatever amendment 136
needs plus the payload spec 801 is missing.

---

## Answer

**Contract v1.9, additive — [§6.5](assets/136-cc-contract/CONTRACT.md), one new error code, no new
verb and no new field.** Server work minted as BackOffice
[878](C:\Work\DMSCO\BackOffice\.issues\878-cc-address-capture-and-order-acts.md).

Three of the ticket's four questions moved before a single decision was taken, and the fourth was
not the hard one. What the session was actually for is underneath them: **the address book is a
customer store reached through a different door, and two of its writes reach into the order.**

### What the ticket already inherited

1. 🚩 **Q1's payload is not missing — it shipped, and it shipped WIDE.**
   [801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md) is `done` and it built
   `CallCenterWebAddressRequests.cs`. The body is `{ LabelCode, Address: BusinessAddress }` — the
   **whole 25-field model** — handed straight to `addressService.AddAddress`. So the create/edit
   contract exists on the wire. What does not exist is any narrowing to CC2's nine, which makes the
   inventory's *"the web must not fill them either, or it puts empty columns into SAP"* a **client
   discipline with zero server enforcement**. The question was never *whose shape* — 801's, settled,
   and the session contract has no business holding a customer-store payload. It was **how wide**.
   Good consequence found alongside it: `AddCustomerAddress` returns the full
   `CustomerAddressBookModel` including the new `AddressNumber`, so a create can hand straight to
   `setAddress` with no re-read.

2. **Q2's "confirm the one-fetch cost is acceptable on the web" is already paid.**
   `src/core/services/lookups.ts:53` already fetches **every district** (`SdDocument/Districts`,
   ~1.7k rows) session-cached at `staleTime: Infinity`, for Screen 2's Change Store picker — and
   [137](137-callcenter-web-door.md) ruled `Districts` **off** the door, so it stays where it is.
   CC2's *"one upfront fetch for type-anything-anytime UX"* is not a new cost here; it is an
   existing shared cache key this feature joins.

3. 🚩 **Q3 dissolves — the undeliverable district is already on the row the picker renders.**
   `SdDistrictModel` carries `StoreCode` **and** `TempStoreCode`, and the client already holds every
   row. §2.3's *"visible and unpickable, saying why"* needs **no new read**, and the ticket's
   either/or (*a new read, or the agent keys a whole address and is refused at the end*) was a false
   choice.

4. **Q1's flagged [178](178-the-transaction-absorbs-the-sidecar.md) interaction is dead.** 178
   resolved the other way: the sidecar stays, holding `AddressNumber` only, and the book remains the
   system of record. "The book entry" and "the order's address" therefore stay two objects — which
   is what makes the two rulings below necessary rather than optional.

### The rulings

**1. Editing the address the order holds re-pins the store — by re-issuing `setAddress`, not by a
new verb.** The map had already ruled the derivation *"pinned at the moment the operator picks **or
edits** an address"* (126, Out of scope) and the contract had no way to express the second half:
`setAddress` carries only an `addressNumber`, and an edit does not change it. So a `PUT` moving an
address from Al Malqa to Al Olaya changes the book row while the order keeps a plant derived from a
district that address has left, with `header.address.line` still rendering the old composition —
[797](C:\Work\DMSCO\BackOffice\.issues\797-resume-drops-pcheader-plant.md)'s silent wrong price
arriving through a door nobody was watching. The rule: **after a successful `PUT` of the address
whose number the order holds, the console re-issues `setAddress` with that same number.** It already
carries the whole re-derivation, already raises §5.1's `storeChange` preview when there are lines,
already refuses `NO_DELIVERY_STORE_FOR_DISTRICT`.
🚩 **The server obligation is a NEGATIVE one** — a same-`addressNumber` `setAddress` must not be
short-circuited as a no-op. It is the one call on this contract that looks idempotent and is not,
and the optimisation is the obvious one to reach for. ⚠ Named consequence: an edit can leave the
book row **saved** and the order **refusing** it (the caller's district really does carry no store);
the order keeps what it had and the console says why, rather than rolling back a correction the
caller just made.

**2. Deleting the address the order holds is refused — `ADDRESS_IN_USE_BY_ORDER` (409).** Grounded,
not assumed: the sidecar holds an `AddressNumber` while
`Cc2DocumentHeaderBuilder.ApplyShippingAddress:81` copies address **fields** onto the CLCN document,
so the web submit path re-reads the book — and `SdAddressService.GetCustomerAddresses` filters
`IsDeleted = 0`. A delete of the current address produces a delivery order that **cannot build a
shipping address at submit**, broken at its last step by an act on a different door. The console
also omits the control on that row (`AddressChoice.isCurrent` already exists), but **the refusal is
the guard and the omission is the courtesy** — a client-side rule alone is the second implementation
this contract keeps refusing to have. Rejected alternative: allow it and clear the order's address,
which cascades a book act into order state, silently shutting §2.3's opening gate mid-call and, under
`Delivery`, discarding the store derivation with it. `SetDefault` has no order effect and stays free.

**3. Narrow the capture payload server-side to CC2's nine + label; stamp the three constants.**
801's own reasoning, applied one field-set wider: it removed `CustomerId` from the wire rather than
ignoring it because *"a field the client can send and the server silently discards is
indistinguishable, from the client's side, from one it honours."* The same sentence holds for
`PoBox`, `FloorNumber`, `Name1` and thirteen others, and a client that can send `AddressType` can
send `"B"`.
✅ **The risk that could have sunk this is not present**: `SdAddressService.UpdateCustomerAddress:486`
is a **null-coalescing merge** — `existing.PostalCode = address.PostalCode ?? existing.PostalCode`,
twenty-five times over — so an omitted field is **preserved**, and a narrow `PUT` cannot blank a
column an SAP sync wrote.
🚩 **And the flip side of that merge is a capture rule nobody would have guessed**: because it
coalesces on null, **a field can never be emptied by omitting it**. An agent clearing `Street2` must
send `""`; `null` means *keep what is there*. CC2 gets this right by accident (`BuildBusinessAddress`
builds a fresh object from bound text boxes, so an emptied box arrives as `""`). The mapper must
therefore **not** normalise `""` to `null` — which is precisely the tidying reflex when writing one.

**4. The picker is CC2's one-box unified search, and the deliverability test is not a store
derivation.** One search box over the already-cached districts, matching `districtNameEn/Ar` and
`cityNameEn/Ar`, a pick committing **both** city and district; the panel snapshots and reverts unless
the pick is explicit; the current pick is **never** filtered away (on the web there is no WPF
`SelectedItem`/`ItemsSource` coupling, so this is achieved by pinning the current pick above the
results rather than by force-keeping it in the filtered array). Arabic matching inherits CC2's
no-folding limitation **knowingly** — no diacritic or hamza folding, *"good enough for a dropdown
filter"* — recorded so it is not re-discovered.
A district carrying neither `tempStoreCode` nor `storeCode` draws **visible and unpickable**, and the
client is allowed to compute that: it asks *whether there is a store*, never *which store*.
[`address-book.ts`](../src/features/callcenter/console/address-book.ts)'s standing rule (*"Nothing
here derives a store"*) stays literally true — the predicate belongs in a new pure module, not that
file — and the server refusal remains authoritative, the same advisory-but-authoritative shape as
`capabilities`. ⚠ **Residual, named**: the district list is session-cached at `staleTime: Infinity`,
so an ops flip to `TempStoreCode` is invisible for the agent's whole shift. In the direction that
matters (a district that became undeliverable) the server refusal still catches it; in the other (one
that became deliverable stays greyed) it is a nuisance, and it is the same pin the map already ruled
into Out of scope.

**5. The SPL check ships format-only, and the UI must not dress it as verified.**
`^[A-Z]{4}[0-9]{4}$`, upper-cased on set, empty valid, CC2's own inline wording. **No green tick, no
"verified" affordance** — the field reads as a code the agent typed, never as an address the system
confirmed. CC2's comment is explicit that live verification against `splonline.com.sa` *"is a separate
integration that needs an API contract / credentials"* and is unwired; ruling it **Out of scope** on
the map is what makes the inheritance knowing rather than quiet.

**6. The surface: one modal, two views.** The book list gains a per-row *Edit* and a foot *Add
address*; either swaps the existing `AddressPicker` modal's body to the form, with Back/Save. Not a
second modal — `AddressPicker`'s own doc comment already rejected modal-on-modal (*"a
select-then-confirm step here would be a modal in front of a modal"*), and 135's ruling is that the
rail and receipt never move. **A create auto-applies**: `AddCustomerAddress` returns the new
`AddressNumber` and the only reason an agent creates an address mid-call is to deliver to it — which
is the first-time-caller state this ticket exists to serve. Under `PickInStore` the editor is
unreachable for free: `canOpenAddressBook` is already false there (§6.3).

### 🚩 The pattern worth keeping

**Three of four questions were answered by things already built.** The payload by 801's shipped
request types, the fetch cost by a cache key this repo has had since Screen 2, and the undeliverable
district by two columns already on the wire. The session's whole value was in what the questions were
hiding: two writes on a *different door* that mutate *this* order, which no question on the ticket
asked about because the ticket was organised around the **editor** and the harm was in the
**book-to-order seam**.

That is the same move as [156](156-delivery-fee-shared-rule.md), [157](157-price-check.md),
[158](158-stock-in-other-stores.md) and [176](176-fulfilment-mode-drawn.md) — read what the ticket
already inherited before designing anything — **five tickets running to that shape now**, and it is
no longer a coincidence worth remarking on: it is how a ticket written weeks before it is worked
should be opened.

One more, narrower: 🚩 **the null-coalescing merge was found by reading the service, not the
endpoint.** It de-risked the narrowing *and* produced a capture rule (`""`, never `null`) that a
mapper written from the endpoint signature alone would have got exactly backwards.
