---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2482-the-call-centre-texts-the-customer-a-location-link-spec.md
blocked-by: 575
---

# 576 — Discard, Resend over a card, an address change, and Create address from this location

## What to build

The rest of BackOffice ticket 2468's rules, on top of 574's strip and 575's card. Wire shapes:
`C:\Work\DMSCO\BackOffice\.issues\assets\2482-location-link-web-seat-contract.md`.

- **Discard** on the card calls `POST .../{token}/Discarded`, with no confirmation. The strip then reads
  *"Location discarded"* with **Send again**. A `CCL-00031` (already stamped) refetches the session.
- **Never two cards.** Resend or Send again while an **unapplied** card is open asks *"Discard the received
  location and send a new link?"*. Yes stamps the discard, then sends. Resend **after** Apply is free:
  the new card compares against the order's current values, which already include the first capture.
- **Changing the address after Apply.** On this seat, `setAddress` refills the session's pin from the
  newly picked book row (BackOffice 861), so the applied pin goes with the old address. The chip then
  reads *"Location cleared - address changed"*.
  - Detect it by the `addressNumber` changing after the chip was shown. Do not use `gpsLat`/`gpsLon`:
    the new book row may have a pin of its own.
- **Create address from this location.** When the order has **no** address, the save row becomes this
  button. It opens the existing `AddressForm` (create), pre-filled with the captured pin, Short Address and
  details (Street2). The agent fills the city, district and line. The existing create flow then saves
  and auto-applies the address.
  - See open question 1 for whether the capture is then also stamped.

## Spine reach

UI → app (BackOffice doors, stubbed until 577)

## Proof (→ `tdd` red-green cycles)

- [ ] the state transitions (vitest), extending `location-link-view.ts`:
  - card → discarded → Send again;
  - card + Resend → confirm → discard then send;
  - chip + address change → cleared;
  - chip + Resend → no confirm.
- [ ] the `AddressForm` pre-fill mapping from a capture (vitest)
- [ ] the drive against stubs, LTR and RTL: Discard, Resend-over-card confirm (yes and no), address
  change after Apply, Create address from this location
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

oms-react only. No server change: the address-change behaviour comes from 861's `setAddress`, and the
create path is the existing `AddressForm`.

## Done when

Every rule above runs against stubs, and the pure modules and the drive are green.

## Blocked by

575.

## Open questions

1. **After Create address from this location, should the capture be stamped?** The address now carries
   the pin, but the capture stays unstamped, so the trail never says what happened to it.
   - **Recommended:** follow the create with `ApplyLocation`, ticking the pin, Short Address and details,
     with `saveToCustomer: false`. It is idempotent against the values just written, and stamps Applied
     in the same transaction.
   - **Alternative:** stamp Discarded, which reads wrong in the trail.
   - This is the owner's call at implement time.
