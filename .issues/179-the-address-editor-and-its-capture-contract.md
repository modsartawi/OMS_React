---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: open
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
