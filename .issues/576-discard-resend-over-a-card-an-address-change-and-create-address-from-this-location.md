---
status: done
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

- [x] the state transitions (vitest), extending `location-link-view.ts`:
  - card → discarded → Send again;
  - card + Resend → confirm → discard then send;
  - chip + address change → cleared;
  - chip + Resend → no confirm.
- [x] the `AddressForm` pre-fill mapping from a capture (vitest)
- [x] the drive against stubs, LTR and RTL: Discard, Resend-over-card confirm (yes and no), address
  change after Apply, Create address from this location
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

**Done 2026-10-26.** `location-link-view.test.ts` 46/46 (13 new: `stripAct`, `discardRefusal`,
`resendSteps`, `chipAfter`), `location-card.test.ts` 35/35 (4 new: the save row split into
`saveToCustomer` / `createAddress`, and `stampAfterCreate`), `address-capture.test.ts` 22/22 (3 new:
`addressFormFromCapture`); full suite 6502/6502; lint's four gates clean; the drive 267/267 **stubbed**
(LTR + RTL, 575's 207 checks kept; `…/{token}/Discarded` stubbed body-less with `{ stamp, stampedAt }`,
a refusal the contract's 400 + `CCL-` code; the book, `SetAddress` (861: the pin comes from the row),
districts and labels stubbed for the address change and the create). Rulings, all overrulable:

1. **Open question 1 — the stamp after Create address: the recommended option.** Once the order holds
   the created address, the card calls `ApplyLocation` with `applyPin`, `applyShortAddress` and
   `applyDetails` all `true` and `saveToCustomer: false` (`stampAfterCreate`), through the same verb
   path as Apply. The ticks are sent raw, not ANDed with the card (the card now compares against the
   address the capture itself filled; the server's rules make it idempotent). **For the owner to
   confirm or overrule** (the alternative was stamping Discarded).
2. **The stamp waits for the created `addressNumber` to be on the order**, not for the create's
   answer — so a basket that previews a store move stamps only after the agent confirms it, and a
   refused rebind (a store-less district) stamps nothing and leaves the card open. Any create saved
   from the dialog the card opened counts (the agent may edit every pre-filled field); closing the
   dialog or picking an existing row instead stamps nothing.
3. **The save row is split**: *Also save to this customer address* needs a customer AND an address;
   *Create address from this location* needs a customer AND no address (and `canOpenAddressBook`,
   since it opens the book). No customer → neither.
4. **Resend over an unapplied card sends only after the discard lands.** A refused discard is drawn
   exactly as Discard's own and nothing is sent; *No* ("Keep it") calls nothing. The question is a
   core `Modal`: title *Resend location link*, body 2468's sentence, *Keep it* / *Discard and send*.
5. **Discard's refusals** (a link call, so the `CCL-` code is `errors[0]` itself): `CCL-00031` re-reads
   the order and the link, and the capture's stamp draws the chip or the discarded strip (575 ruling
   5's path); `CCL-00006` → the `gone` strip; `CCL-00001` hides the panel; anything else stays on the
   card in the server's words (`location.card.discardFailed` when it gave none).
6. **"Location cleared - address changed" is sticky**: going back to the first address keeps it
   cleared — that row refills its own pin, and the chip cannot tell whether the capture was saved to
   it. The cleared chip drops the Maps link.
7. **Resend now sits on the card's footer and beside the chip** (with the strip's 30 s cooldown); 2468
   names Resend from both but 575 drew it on neither.
8. **One act at a time on the card**: Apply, Discard and Create are disabled while an Apply or a
   Discard is in flight, and while the post-create stamp waits.

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
