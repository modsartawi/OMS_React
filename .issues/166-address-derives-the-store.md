---
status: done
spec: 160
blocked-by: 165
---

# 166 — pickingAnAddressDerivesTheStoreAndSaysSo

## What to build

Picking the caller's address is what decides where the order is fulfilled from. On an **empty
basket** that applies inline with no confirmation at all — there is nothing to re-price — and the
store appears as a chip in the header row.

🚩 **A store the agent did not choose must read as explained, not arbitrary.** The chip carries
*derived* as a parenthetical (from `header.plantSource`), so the agent can answer "why that branch?"
without opening anything.

**The client does not derive the store.** The district→store rule runs server-side at `setAddress`
and the answer comes back in the projection. A second client-side derivation is exactly how the
console and the engine start disagreeing about which branch serves an address.

This slice also lands the **chip row** the rest of the header capture hangs on: settled sections
collapse to a chip and re-open in place, and each chip carries one of three states — *settled*
(neutral), *needs attention* (attention ground), *derived* (the parenthetical). 🚩 *Needs attention*
is computed from `capabilities.submitBlockers`, **not** from a second client rule about what an order
needs — the console never re-implements a server predicate.

Two refusals must be explained rather than shown raw, because the distinction matters to support:
an address act before a caller is attached, and an address that belongs to **someone else** — never
"not found".

## Spine reach

api (`SetAddress`) · logic (pure chip-state module over `capabilities` + header) · component (chip
row, address picker, store chip) · i18n · test (pure + flow)

## Proof (→ `tdd` red-green cycles)

- [x] `chipsSayWhatTheyStillNeed` — pure: header + `capabilities.submitBlockers` in, chip states out
      — settled / needs attention / derived, with *derived* set only when the plant came from the
      address, and an unknown blocker code never rendering as a raw code · pure
      (`header-chips.test.ts`, 5 cases — the unknown-code case is this ticket's; the derived and
      attention cases landed with the module at 162 and are re-asserted here)
- [x] `anAddressOnAnEmptyBasketAppliesInline` — drive: picking an address on an empty basket sets the
      store with **no confirmation modal**, and the chip says it was derived · flow (Playwright,
      extends `tools/callcenter-drive.mjs`, boxes 22–25 — **192/192**)
- [x] Added beyond the named seam: `address-book.test.ts` (9 cases) over the book's projection —
      ordering, the composed line, the label fallback, and the two refusals mapped to **different**
      explanations. The pure module is where the regression would be silent (spec 160's testing
      ruling), so it got a test even though the Proof did not name one.

## Boundaries

**Endpoints:** `POST CallCenterWeb/SetAddress` and the customer-scoped `CallCenterWeb/CustomerAddresses*`
reads (BackOffice [801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md)). Codes:
`NO_CUSTOMER_ATTACHED` (409), `ADDRESS_NOT_FOR_CUSTOMER` (403) — both explained, both refusals rather
than silent empties. Reference reads (`Cities`, `Districts`, `AddressLabels`) are **off the door** and
already served by `@/core/services/lookups.ts` — reuse, don't re-add. A basket **with lines** takes
the confirm path, which is [167](167-store-move-shows-the-diff.md)'s.

## Done when

An address picked on an empty basket sets the fulfilment store inline, the chip explains that the
store was derived rather than chosen, and a chip that still needs something looks like it does.

## Blocked by

[165](165-attach-caller-fills-the-rail.md) — the address book is unreachable before a caller is
attached.

## As built

- **`address-book.ts`** is the pure module: it orders the book (**default first**, server order
  after — a book that reshuffled between two calls would cost the agent the one thing a short list
  gives them), composes the display line in CC2's own piece order, and maps the two refusals to
  their explanations. 🚩 It composes **book rows only** — the address already ON the order arrives
  composed as `header.address.line` and is rendered verbatim, so there is one derivation per source
  rather than two per address.
- **`AddressPicker.tsx`** applies on **one click**: an empty basket has nothing to re-price, so
  §5.1 raises no confirmation and a select-then-confirm step here would be a modal in front of a
  modal for a change that costs nothing. The book is read **when it is opened**, not when a caller
  is attached — an agent who never changes an address costs the door nothing — and a failed read
  offers a retry rather than being a dead end.
- **The store is never derived here.** The drive proves the negative rather than asserting it: the
  `SetAddress` body carries no `plant`/`storeCode`, and **no district, city or store lookup is
  fetched at all** during the flow. A console that worked the branch out itself would have had to
  read one.
- **`canOpenAddressBook` is read on the way in, once.** The page passes `onPickAddress` only while
  the capability holds, so the rail draws the offer without re-testing the rule and the same
  condition mounts the dialog.
- 🚩 **A change of caller closes the book.** Attaching or removing clears it, so an agent who opened
  it, dropped the caller and picked up the next one does not have the new caller's addresses spring
  open off the previous call's intent.
- **Deferred, deliberately.** The chips do **not** become clickable in this slice: the only section
  behind a chip today is the store, and re-opening that is an explicit override
  ([167](167-store-move-shows-the-diff.md)'s `setStore`) — the slot, source and reference sections
  do not exist until [173](173-header-complete-before-submit.md). A basket **with lines** answers
  `pendingConfirmation: storeChange`; the diff is 167's, so until it lands the picker states that
  nothing moved rather than reporting a change that did not happen. `confirmToken` is already on
  `setAddress`'s signature (the contract's request shape) with no caller yet.
