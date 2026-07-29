---
status: done
spec: 180
blocked-by: 187
---

# 188 — editingTheOrdersAddressRePinsTheStoreAndDeletingItIsRefused

Split from [187](187-agent-creates-and-corrects-an-address.md) because these two rules are sharp,
independently testable, and carry the real risk in the address work. **The address book is a
CUSTOMER store on a DIFFERENT door, and two of its ordinary writes reach into the order** — which is
why the rule has to be written on the session contract or nowhere.

## What to build

**1. Editing the address the order holds re-pins the store.**

`setAddress` carries only an `addressNumber`, and an edit does not change it — so a `PUT` that moves
an address from one district to another changes the **book row** while the order keeps a plant
derived from a district that address no longer sits in, with `header.address.line` still rendering
the old composition. Nothing on the wire would say so.

> After a successful `PUT` of the address whose `addressNumber` equals
> `header.address.addressNumber`, the console **re-issues `setAddress` with that same number.**

No new verb. `setAddress` already carries the whole re-derivation, already raises the `storeChange`
confirmation when there are lines, and already refuses `NO_DELIVERY_STORE_FOR_DISTRICT` — so the
agent sees exactly the store-move preview a *different* address would have shown them.

⚠ **Consequence to draw, not to prevent:** an edit can leave the book row **saved** and the order
**refusing** it — the caller corrects their address into a district carrying no store, the `PUT`
succeeds and the re-pin answers `NO_DELIVERY_STORE_FOR_DISTRICT`. The order keeps the plant and
address it had; the book keeps the edit. That is the honest outcome, and the console says the order
cannot be delivered from it rather than rolling back a correction the caller just made.

**2. Deleting the address the order holds is refused.**

The sidecar holds an `addressNumber` while the submit builder copies address **fields**, and
`GetCustomerAddresses` filters `IsDeleted = 0` — so deleting the current address produces an order
that **cannot build a shipping address at submit**, broken at its last step by an act on a different
door.

The console **omits the delete control** on that row (`AddressChoice.isCurrent` already exists) and
the server refuses with `ADDRESS_IN_USE_BY_ORDER`. 🚩 **The refusal is the guard and the omission is
the courtesy** — a client-side rule alone is the second implementation this contract keeps refusing
to have, so the client must handle the code even though its own UI should never provoke it.

Clearing the order's address instead was **rejected**: it cascades a book act into order state,
silently shutting the opening gate mid-call.

## Spine reach

api (address delete; `setAddress` re-issue) · logic (`address-book` — `isCurrent`, refusal mapping) ·
component (the picker's row controls + the re-pin sequence) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `address-book` — `isCurrent` suppresses the delete control on exactly one row · pure
- [x] `addressRefusalKey` — `ADDRESS_IN_USE_BY_ORDER` maps to its own phrase; an unknown code still
      degrades · pure
- [x] `rePinAfterEdit` — an edit of the **current** `addressNumber` yields a re-issue; an edit of any
      other address yields none. A test that would fail if anyone treated the two alike · pure
- [x] `address-editor-drive.mjs` extension — editing the order's own address into another district
      raises the **store-move preview**; editing it into a store-less district leaves the book edited
      and the order refusing, with both facts on screen; the delete control is absent on the current
      row · flow (Playwright)

## Built

`rePinAfterEdit` (`address-book.ts`) — the one predicate that turns a book `PUT` into an order act,
and the whole of rule 1. `CallCenterConsolePage`'s `updateAddress.onSuccess` asks it and, on a match,
fires **the ordinary rebind** (`beginStoreMove('address', …)`) — so §5.1's preview, the
`CONFIRM_TOKEN_STALE` re-preview and `REBIND_REFUSED` all arrive through the paths that already
existed. No new verb, no new confirmation mechanism, no second path to `setAddress`.

The comparison is trim/case-insensitive because `CallCenterAddressScope`'s is; what it hands **back**
is the ORDER's spelling, because it is the order being re-pinned.

Rule 2: `api.del` (new on `core/api.ts` — params, not a body, because 801's route names its target on
the query string) → `deleteCustomerAddress` → `deleteAddress`, plus `ADDRESS_IN_USE_BY_ORDER` on
`addressRefusalKey`. The delete control is **absent** on the row the order holds and asks a second
time **in place** on every other — a dialog would be the modal-on-modal `AddressPicker`'s own comment
rejects, and it would ask the question away from the address it is about.

🚩 **187's own drive assertion flipped with this ticket**, deliberately: *"the edit control is ABSENT
on the address the order is using"* becomes *"is offered"*, and the absent-control assertion moves to
DELETE. That is the shape of the split — 187 withheld the editor on that row precisely until the
re-pin existed.

⚠ §6.5's named consequence is drawn as **two facts, not one**: `address.savedNotMoved` renders beside
the refusal, because an agent shown only *"no store delivers there"* would conclude the correction
was lost and key it a second time. It is deliberately shown **only** beside a refusal — on its own it
would announce a state the rail already shows.

Proof: **8 new pure** in `address-book.test.ts` (18 green in the file) +
`address-editor-drive` **79/79** (was 51/51), covering the re-pin on the wire and in order, the
preview it raises, the saved-but-refused pair, the two-press delete with its target on the query
string, and `ADDRESS_IN_USE_BY_ORDER` reaching the agent as a sentence. `callcenter-drive` at HEAD
re-run against these changes: **460/461**, its one failure the header chip-row order, which belongs to
183's uncommitted note chip and not to this ticket. typecheck, lint and build clean.

⚠ Not driven live: no SIS.Api ran beside the drive, so the book, the write answers and both refusals
are the drive's stubs over the contract's own committed session fixtures (177's rule).

## Boundaries

**Server:** BackOffice [878](C:\Work\DMSCO\BackOffice\.issues\878-cc-address-capture-and-order-acts.md).
Envelope codes: **`ADDRESS_IN_USE_BY_ORDER`** (new, 409), `NO_DELIVERY_STORE_FOR_DISTRICT`.
🚩 **The one server obligation here is a negative one**: a same-number `setAddress` must **not** be
short-circuited as a no-op. It is the only call on this contract that looks idempotent and is not —
same `addressNumber` in, a different plant possibly out. (`requestId` replay is unaffected: a
*replay* returns the recorded answer, which is correct; a *fresh* request must re-derive.)
**i18n:** existing namespace; the refusal phrase and the saved-but-refused explanation.

## Done when

In the running app, editing the order's own address into a different district shows the store-move
preview before anything moves; editing it into a store-less district keeps the correction and says
the order cannot be delivered from it; and the delete control does not exist on that row.

## Blocked by

[187](187-agent-creates-and-corrects-an-address.md)
