---
status: open
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

- [ ] `chipsSayWhatTheyStillNeed` — pure: header + `capabilities.submitBlockers` in, chip states out
      — settled / needs attention / derived, with *derived* set only when the plant came from the
      address, and an unknown blocker code never rendering as a raw code · pure
- [ ] `anAddressOnAnEmptyBasketAppliesInline` — drive: picking an address on an empty basket sets the
      store with **no confirmation modal**, and the chip says it was derived · flow (Playwright,
      extends `tools/callcenter-drive.mjs`)

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
