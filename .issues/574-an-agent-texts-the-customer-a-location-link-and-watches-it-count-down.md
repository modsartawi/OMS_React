---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2482-the-call-centre-texts-the-customer-a-location-link-spec.md
blocked-by: — (live: BackOffice 2483–2491, merged pricing2 357c549ea)
---

# 574 — An agent texts the customer a location link and watches it count down

## What to build

**The tracer for the location link on the web seat** (BackOffice spec 2482). While the customer is on
the phone, the agent texts them a 15-minute link. The customer drops a pin on a public page, and the pin
then reaches this console. This slice sends the link and shows the **waiting strip**. The card (575)
and the edge cases (576) build on it.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\2482-location-link-web-seat-contract.md` (§1, §2,
§4, §5). The card's wording and rules: `C:\Work\DMSCO\BackOffice\.issues\2468-the-agents-location-received-card.md`.

- **Models (contract v1.12)** in `core/models/callcenter.ts`:
  - `capabilities.canSendLocationLink`;
  - `header.address.line2` / `shortAddress` / `gpsLat` / `gpsLon` (each nullable);
  - the link-call shapes (`Send`, `Status`, `capture`, `Discarded`, `Retire`);
  - `LOCATION_LINK_REFUSED`;
  - the `CCL-` codes the console words (contract §4).
  - Type 575's `applyLocation` body too, so the models land once.
- **The action.** **Send location link** sits beside **Change address** in the delivery-address section,
  shown only while `canSendLocationLink` is true. **Hidden, never disabled**: false means the order is
  not an open delivery, or the feature is not configured on this SIS.Api.
- **The send dialog:**
  - The number is pre-filled from the attached customer's mobile, or empty when there is none.
  - The agent may type another number; `mobileWasTyped` is true when it differs from the customer's.
  - `seatKind: "OMSWEB"`, `orderContextId` = the session's `transactionId`.
  - `CCL-00004` shows inline at the number; `CCL-00008` / `00009` / `00020` show in the dialog.
- **The waiting strip** (a `ConsoleCard`, in the same section):
  - *"Location link sent to <maskedMobile> - waiting (mm:ss)"*, ticking every second from `secondsLeft`.
  - **Resend** goes to the same number without the dialog. It is disabled for 30 s after any send,
    showing the seconds left (counted client-side).
- **The poll.** React-query on `GET .../{token}/Status`:
  - `refetchInterval: 3000`, enabled only while a live token is held, and paused while the tab is hidden.
  - It follows the **latest** token, so a Resend restarts it on the new one.
  - Failed polls retry quietly. After 30 s of continuous failure, the strip shows *"Can't reach the
    server - still trying"* in place of the countdown.
  - `Lapsed` → *"Link expired - the customer didn't send a location"* with **Send again** (which opens
    the dialog).
  - `Superseded` → *"This link was replaced - send a new one"* with **Send again**.
  - `Captured` stops the poll and hands over to 575. Until 575 lands, show a plain *"Location received"*
    line.
- **Retire.** When the order in progress is submitted, abandoned or cleared, call `Retire` with the
  `transactionId`. Fire and forget: a failure is logged, never shown, and the link lapses on its own.
  The server does **not** retire for us.
- i18n: EN + AR keys in the `callcenter` namespace.

## Spine reach

UI → app (BackOffice doors, stubbed until 577)

## Proof (→ `tdd` red-green cycles)

- [ ] `location-link-view.ts` (pure): status + clock → strip state (waiting / expired / replaced /
  unreachable / received); mm:ss formatting; the 30 s unreachable rule; Resend's cooldown seconds (vitest)
- [ ] `mobileWasTyped` (vitest): the same number in another form (`05…` / `9665…` / spaces) counts as
  **not** typed
- [ ] the action shown/hidden per `canSendLocationLink`; the send body field for field (vitest)
- [ ] `tools/callcenter-location-drive.mjs` against stubs, LTR and RTL: send, countdown, Resend cooldown,
  lapse → Send again, superseded, the unreachable note, the refusals inline, Retire on submit and on abandon
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

oms-react only. No feature flag: `canSendLocationLink` is the switch, and it stays false until SIS.Api's
`CallCenter:LocationLink:PublicBaseUrl` is configured (the go-live act, BackOffice 2492). The doors are
built (BackOffice 2483–2491, merged on pricing2) but not yet on staging. Prove against stubs that emit
**exactly** the contract's fields and the real envelope.

## Done when

The pure modules and the drive are green, and the strip runs end to end against stubs.

## Blocked by

None. It can start immediately (live: BackOffice 2483–2491).
