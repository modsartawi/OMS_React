---
status: done
spec: 180
blocked-by: —
---

# 187 — theAgentCreatesAndCorrectsAnAddressMidCall

⚠ **A genuinely undrawn surface, and the largest ticket in this spec.** `AddressPicker` today is
**pick-only** — there is no create form, no edit form and no district picker.
[179](179-the-address-editor-and-its-capture-contract.md) was a decision session, not a prototype, so
nothing here is wired-but-unmounted the way 182's and 189's components are.

## What to build

A caller with no address on file, or one who corrects their street mid-call, is served without
leaving the console.

**One modal, two views (list ↔ form).** `AddressPicker`'s own comment already rejects modal-on-modal,
so the form replaces the list inside the existing dialog rather than opening on top of it.

- **Create** collects CC2's nine fields plus label and **auto-applies** via `setAddress` — the new
  `addressNumber` comes back on the create, and the only reason to create an address mid-call is to
  deliver to it.
- **Edit** of an address the order is **not** using is a pure book act and this ticket's ordinary
  path. Editing the one the order **is** using is [188](188-editing-re-pins-deleting-is-refused.md).
- **The district picker is CC2's one box, not a city→district cascade** — a caller who names their
  district is answered in one step. The ~1,000-district list is already fetched at
  `staleTime: Infinity` for Screen 2's picker; reuse that cache rather than adding a read.
- A district with **no delivering store is visibly greyed**. The client asks *whether* there is a
  store, never *which* — so `address-book.ts`'s no-derivation rule stays literally true (the
  predicate goes in a new module, not that file) and **the server refusal stays authoritative**.
- The current pick is **pinned above the results** rather than force-kept inside the filtered array.

🚩 **Two capture rules that a mapper written from the endpoint signature alone would get backwards:**

1. The payload **narrows** to the nine fields plus label, with the three constants server-stamped.
   Safe because `UpdateCustomerAddress` is a **null-coalescing merge** — an omitted field is
   preserved, so a narrow `PUT` cannot blank an SAP-synced column.
2. That merge's flip side: **a field can never be emptied by omission.** The client sends `""` and
   **never `null`** for a field the agent cleared, and the mapper must **not** tidy blanks to null —
   which is exactly the reflex when writing one.

SPL stays **format-only with no verified affordance**; live SPL verification is out of scope on the
map.

## Spine reach

api (address create / update, through 801's shipped routes) · logic (district predicate module,
`address-book` extension) · component (the form view + district picker) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `districtChoice` — a district with neither `StoreCode` nor `TempStoreCode` is greyed; the
      module answers *whether*, never *which*, so no store code ever leaves it · pure
      — `district-choice.test.ts`, 20 cases, including the negative read back off the whole
      projection as text
- [x] `addressPayload` — the body narrows to ten fields; a field the agent cleared serialises as
      `""` and **never `null`**; the three constants are absent (server-stamped) · pure
      — `address-capture.test.ts`, 20 cases. ⚠ **ten → twelve**, see comment 1
- [x] `address-book` — `addressChoices` still projects correctly with the new form present · pure
      — extended: the editor's five new wire fields reach neither the composed line nor the choice
- [x] new `tools/address-editor-drive.mjs` — creating an address auto-applies it to the order;
      editing a **non-current** address updates the book and leaves the order alone; a store-less
      district is visibly unpickable · flow (Playwright) — **51/51**, plus §6.5's named
      consequence (a create the order refuses)

## Boundaries

**Server:** BackOffice [878](C:\Work\DMSCO\BackOffice\.issues\878-cc-address-capture-and-order-acts.md)
+ [801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md) — ✅ the five
`CallCenterWeb/CustomerAddresses*` routes **already ship**; what 878 adds is the narrowing and the
stamping. Envelope codes: `NO_DELIVERY_STORE_FOR_DISTRICT`, `NO_CUSTOMER_ATTACHED`.
**i18n:** existing namespace; the form's ten labels, the district picker, its greyed-district note.
⚠ The address book is **unreachable before customer attach** ([§6.3](assets/136-cc-contract/CONTRACT.md))
— the routes are scoped to the session's attached customer.
⚠ Residual, knowingly inherited: `staleTime: Infinity` makes an ops `TempStoreCode` flip invisible
for the shift. The direction that matters is still caught server-side.

## Done when

In the running app an agent can create an address for an attached caller and see it applied to the
order in one step, and can correct an address the order is not using without touching the order.

## Blocked by

None — can start immediately.

## Comments

**Built 2026-07-29.** `district-choice.ts` + `address-capture.ts` (pure), `AddressForm.tsx` (the
form view and CC2's one-box district picker), `AddressPicker.tsx` grown to two views, the two verbs
on `api.ts`, the create/update wiring on `CallCenterConsolePage.tsx`, `SdAddressLabelModel` +
`lookupQueries.addressLabels()` in `core/`, and `tools/address-editor-drive.mjs`.
Proof: **46 pure** (20 + 20 + the extended book suite) · drive **51/51** · `callcenter-drive`
**461/461** (unchanged by the picker's new DOM) · typecheck + lint + build clean.

**1. 🚩 The Proof's "ten fields" is superseded — the shipped capture is TWELVE plus the label.**
BackOffice [878](C:\Work\DMSCO\BackOffice\.issues\878-cc-address-capture-and-order-acts.md) is
`done`, and its `CallCenterWebAddressCapture` carries `CityCode`, `CityName`, `DistrictCode`,
`DistrictName`, `Street1`, `Street2`, `BuildingNumber`, `Phone1`, `Phone2`, `ShortAddress`,
**`GpsLat`, `GpsLon`** — with `LabelCode` on the enclosing request. Ten was CC2's field *count*
(city, district and GPS each being a pair); the wire's key count is twelve. Every assertion here is
written against the shipped type, read from the source rather than from the ticket.

**2. ⚠ And the GPS pair is why that matters — it is the ONE omission the merge cannot forgive.**
878 names it: `GpsLat`/`GpsLon` are non-nullable `decimal`s that `UpdateCustomerAddress` assigns
**unconditionally**, so an omitted pair writes `0` over a real fix instead of preserving it. The
console has no map and captures neither, so `AddressFormValues` **round-trips** them from the book
row (`addressFormOf` → `addressPayload`) and the drive asserts `24.7743 / 46.7386` arrive back
unchanged on the `PUT`. A mapper that sent only "the nine strings" would silently zero every edited
address's coordinates.

**3. The label is defaulted on a create and never on an edit** — found by `/standards-review`'s spec
axis. CC2's `HOME` default is `ResetForNewAsync`'s, i.e. a *new* address; defaulting in the mapper
meant a street correction silently relabelled a row the server had left blank. `emptyAddressForm()`
starts at `HOME`, `addressFormOf` takes the row verbatim (blank included), `addressPayload` passes
it through.

**4. `NO_DELIVERY_STORE_FOR_DISTRICT` now has a sentence.** The Boundaries named the code and
nothing worded it, so an agent who keyed a whole address met the server's raw `message`. It joins
`address-book.ts`'s refusal table — with the wording deliberately claiming nothing about the book
(*"Nothing has changed on this order"*), because it arrives in two shapes: a plain pick, and a
create's auto-apply where the address **is** saved. That is §6.5's named consequence, and the drive
now covers it.

**5. A create seeds the book rather than re-reading it.** 179's *"hand straight to `setAddress` with
no re-read"* is asserted by the drive (the `POST` is followed immediately by `SetAddress`) — but the
first cut then left a stale list on the refusal path, showing an agent a book **without** the
address they had just saved and inviting a duplicate. The create's own answer is the whole row, so
it is written into the cache; still no call, and nothing stale.

**Two additions worth naming, neither in the ticket's Boundaries:**

- **`GET SdDocument/AddressLabels`** — a new (ungated, customer-data-free) reference read, because
  179 §2.2 rules labels **server data, not an enum**. Verified present at
  `SdDocumentEndpoints.cs:416`; 801 deliberately left it off the `CallCenterWeb` door and gave it no
  sibling. It sits in `core/services/lookups.ts` beside its five neighbours, session-cached. A
  failed read degrades to the value the form already holds — an address stays creatable.
- **The district results are capped at 30 with an honest *showing the first of {{total}}* line.**
  The list is ~1,700 rows and an empty box would otherwise hand all of them to the DOM. No silent
  truncation.

**Deferred to [188](188-editing-re-pins-deleting-is-refused.md), by construction:** the edit control
is **absent** on the address the order is using (not disabled), and there is no delete control and
no delete verb. Offering an edit of the current row before the re-pin exists would be exactly the
silent wrong price §6.5 was written to prevent — the drive asserts the absence, and asserts that a
correction to any other row sends **no** `setAddress`.

⚠ **Unrelated red seen while working, not this ticket's:** `coupon-view.test.ts` (2) and
`guidance-view.test.ts` (3) fail against the working tree because a concurrent session is editing
`.issues/assets/136-cc-contract/01-open-empty.json` (it now carries `canApplyCoupon` /
`capabilityReasons`, which those suites assert absent). They pass at `HEAD`. That is
[189](189-coupon-names-itself-and-comes-off.md)'s ground.
