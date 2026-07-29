---
status: open
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

- [ ] `districtChoice` — a district with neither `StoreCode` nor `TempStoreCode` is greyed; the
      module answers *whether*, never *which*, so no store code ever leaves it · pure
- [ ] `addressPayload` — the body narrows to ten fields; a field the agent cleared serialises as
      `""` and **never `null`**; the three constants are absent (server-stamped) · pure
- [ ] `address-book` — `addressChoices` still projects correctly with the new form present · pure
- [ ] new `tools/address-editor-drive.mjs` — creating an address auto-applies it to the order;
      editing a **non-current** address updates the book and leaves the order alone; a store-less
      district is visibly unpickable · flow (Playwright)

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
