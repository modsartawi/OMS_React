---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3072-the-location-link-confirms-the-short-address-with-spl-spec.md
blocked-by: 575 (live: BackOffice 3075)
---

# 578 — The location card shows what SPL said and whether the pin agrees

## What to build

The web seat's half of BackOffice [3077](C:\Work\DMSCO\BackOffice\.issues\3077-the-cc-v1-card-shows-the-spl-check.md).
The status poll's capture gains eight fields (BackOffice 3075; the contract asset
`C:\Work\DMSCO\BackOffice\.issues\assets\2482-location-link-web-seat-contract.md` is updated there):
`splStatus`, `splBuildingNumber`, `splStreet`, `splDistrict`, `splCity`, `splPostCode`,
`splAdditionalNumber`, `pinCheck`.

On 575's card:

- beside the Short Address: **Confirmed by SPL** (`CONFIRMED`) / **Not known to SPL** (`UNKNOWN`) /
  **Not checked** (`UNCHECKED`, or `''` with a Short Address);
- when confirmed: the parts on one line, and the additional number;
- the pin check: **Pin is on this building** (`MATCH`) / ⚠ **Pin is not on this building, ask the
  customer** (`MISMATCH`) / **Pin is on a street, not checked** (`NO_PARCEL`) / **Not checked**
  (`UNCHECKED`); nothing for `''`;
- ⚠ **SPL says {city}, the order's city is {city}** when `splCity` differs from the session's city name
  (trimmed, case-insensitive).

Apply, Discard and the ticks are unchanged. An unknown `splStatus` or `pinCheck` value renders as
**Not checked**, never as an error. Arabic and English strings.

## Spine reach

UI → app (the poll already made).

## Proof

- [ ] component tests for each SPL status, each pin check and the city warning, against stubs
- [ ] a capture without the eight fields (a v1.12 server) renders exactly as 575's card does
- [ ] screenshots under `.issues/assets/578-*`

## Boundaries

No new call. Never paper over a contract gap client-side; raise it against BackOffice.

## Done when

The Proof is green against stubs.

## Blocked by

575; live: BackOffice 3075.
