---
status: done
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

- [x] `location-card.ts` (pure): capture + `header.address` → rows, default ticks and notes: replaces the
  earlier pin, Short Address absent or different, line2 filled vs empty, save-to-customer shown/hidden (vitest)
- [x] the Apply body field for field, with no captured values in it (vitest)
- [x] the refusal → screen mapping for the four `detail.code`s and the two save refusals (vitest)
- [x] the drive (`tools/callcenter-location-drive.mjs`, extended) against stubs, LTR and RTL: captured →
  card → untick a row → Apply → chip, with the body asserted; every refusal; Open in Google Maps' URL
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

**Done 2026-10-26.** `location-card.test.ts` 31/31 and `location-link-view.test.ts` 33/33 (3 new for the
poll's `CCL-00006`); full suite 6482/6482; lint's four gates clean; the drive 207/207 **stubbed** (LTR +
RTL, the 574 checks kept; `ApplyLocation` stubbed with the contract's seven-field body, the whole
`SessionState` back, and the session verbs' refusal shape — `detail` = `{ code }` on the envelope's
`data`, as `CallCenterWebEndpointHelpers.Refusal` writes it). Rulings, all overrulable:

1. **No details given** — 2468 is silent. The Details row reads *"No details given"* with no tick and
   no Copy (`mode: 'none'`).
2. **A pre-1.12 address (no `line2` at all) reads as filled** — Copy, not a tick: a tick the server might
   ignore is worse than a Copy.
3. **"A different pin" is compared at six decimals** (the server's `DECIMAL(9,6)`); the coordinates and
   the Maps URL are written at six decimals too.
4. **`CCL-00030` retries once, automatically, one poll interval (3 s) later, with the same body** (same
   `requestId` — the refused press recorded nothing). A second `CCL-00030` says *"The server has no
   location for this link yet - try Apply again in a moment"* on the card; the agent can press Apply again.
5. **`CCL-00031` re-reads both** the order (`getState`) and the link's status; the capture's own stamp
   then draws the chip (at the capture's `appliedAt`) or a **"Location discarded"** strip with Send again.
   That `discarded` strip kind lands here (576 owns the Discard button that stamps it).
6. **`CCL-00006` is a new strip kind, `gone`**: *"This link is no longer available - send a new one"* with
   Send again — on Apply AND on the status poll, where it is no longer a failed poll (574's open point):
   the poll stops at once instead of reaching the 30 s note. `CCL-00001` on either hides the panel for
   the order, as on Send.
7. **The chip's hh:mm is the console's clock at the Apply answer** — `SessionState` carries no
   `appliedAt`; only the `CCL-00031` path has the server's stamp.
8. **The save refusals are in the console's words** (`location.card.refused.*`), not the server's
   "not found", each ending "untick it and Apply again"; unticking clears the line.
9. **Apply rides `runGuarded` with no `again`** — the card draws its own failure (164's ruling); a spent
   `SESSION_BUSY` schedule lands on the card in the server's sentence. Apply is never disabled by the
   ticks: everything unticked is a legal Apply that records the review (§3).
10. **A capture already stamped never shows the card** — the chip or the discarded strip instead.

## Boundaries

oms-react only. The server decides every rule again (contract §3), so the card's rules are display only.
They must match the server's, and must never be the only guard.

## Done when

The card and chip run end to end against stubs, and the pure modules and the drive are green.

## Blocked by

574.
