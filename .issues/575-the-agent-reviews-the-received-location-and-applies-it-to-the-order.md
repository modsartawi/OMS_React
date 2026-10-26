---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2482-the-call-centre-texts-the-customer-a-location-link-spec.md
blocked-by: 574 (live: BackOffice 2489 + 861)
---

# 575 — The agent reviews the received location and applies it to the order

## What to build

When the poll answers `Captured`, the waiting strip becomes the **card**, in the same place. The agent
ticks the rows they want and presses **Apply**, and the card becomes the **chip**. The rows, wording and
rules are BackOffice ticket 2468's. Wire shapes: the contract's §3
(`C:\Work\DMSCO\BackOffice\.issues\assets\2482-location-link-web-seat-contract.md`).

- **The card.** One row per field, each with its tick. It compares against `header.address` as it stands now:

  | Row | Shows | Tick |
  |---|---|---|
  | Pin | *"Pinned by the customer's phone (±N m)"* (`DEVICE`) or *"Placed by hand on the map"* (`MANUAL`); the coordinates as copyable text; **Open in Google Maps** (`https://www.google.com/maps/search/?api=1&query=<lat>,<lon>`, new tab) | ticked. When the order already has a different non-null pin: *"Replaces the earlier pin"* |
  | Short Address | the captured code, plus *"Order has: XXXX9999"* when it differs | ticked. When the customer gave none: *"Not given - the order's Short Address is kept"*, and no tick |
  | Details | the customer's text | ticked *"into Address line 2"* only when `header.address.line2` is null. Otherwise no tick, a **Copy** button, and *"Address line 2 is already filled - copy by hand"* |
  | Save to customer | *"Also save to this customer address"* | **unticked** by default. Hidden when no customer is attached or the order has no address (576 adds *Create address from this location* there) |

- **Apply** sends `POST CallCenterWeb/ApplyLocation` with the token, the four ticks and a fresh
  `requestId`, through the console's existing verb path (busy strip, `SESSION_BUSY` retry, replay). It
  renders the returned `SessionState`. **The values are never sent**, only the ticks.
- **Refusals:**
  - `LOCATION_LINK_REFUSED`: word it from `detail.code`.
    - `CCL-00031` (already stamped): refetch, then show the chip or strip.
    - `CCL-00030`: keep the card and retry once on the next poll.
    - `CCL-00006` / `CCL-00001`: drop the card and offer Send again.
  - `NO_CUSTOMER_ATTACHED` / `ADDRESS_NOT_FOR_CUSTOMER`: inline on the save tick. The card stays open,
    so the agent can untick and Apply again.
- **The chip:** *"Location applied hh:mm · Open in Google Maps"*. It stays until the order in progress
  ends.

## Spine reach

UI → app → BackOffice `ApplyLocation` (stubbed until 577)

## Proof (→ `tdd` red-green cycles)

- [ ] `location-card.ts` (pure): capture + `header.address` → rows, default ticks and notes: replaces the
  earlier pin, Short Address absent or different, line2 filled vs empty, save-to-customer shown/hidden (vitest)
- [ ] the Apply body field for field, with no captured values in it (vitest)
- [ ] the refusal → screen mapping for the four `detail.code`s and the two save refusals (vitest)
- [ ] the drive (`tools/callcenter-location-drive.mjs`, extended) against stubs, LTR and RTL: captured →
  card → untick a row → Apply → chip, with the body asserted; every refusal; Open in Google Maps' URL
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

oms-react only. The server decides every rule again (contract §3), so the card's rules are display only.
They must match the server's, and must never be the only guard.

## Done when

The card and chip run end to end against stubs, and the pure modules and the drive are green.

## Blocked by

574.
