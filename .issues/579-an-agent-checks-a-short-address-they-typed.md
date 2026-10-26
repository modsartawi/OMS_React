---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3072-the-location-link-confirms-the-short-address-with-spl-spec.md
blocked-by: — (live: BackOffice 3074)
---

# 579 — An agent checks a Short Address they typed on the web seat

## What to build

The web seat's half of BackOffice [3078](C:\Work\DMSCO\BackOffice\.issues\3078-a-cc-v1-agent-checks-a-short-address-they-typed.md).

- A **Check** button beside the Short Address field in the call-centre address form (`AddressForm`).
- It calls `GET CallCenterWeb/NationalAddress/{code}?language=A|E` (BackOffice 3074) in the console's
  language and shows the answer inline:
  - `FOUND`: the parts on one line, plus the additional number, and the city warning when SPL's city is
    not the form's;
  - `UNKNOWN`: **Not known to SPL**;
  - `UNAVAILABLE` or any failure: **SPL is unavailable, not checked**.
- A malformed code (`CCL-00014`) is shown as the field's own error.
- It never blocks saving. Hidden while the session's capabilities say SPL is not configured (the
  capability's name comes with BackOffice 3074; record it in the contract asset).

## Spine reach

UI → app → SIS.Api → SPL.

## Proof

- [x] component tests for each outcome and the hidden state, against stubs — React Testing Library
  is not installed (CLAUDE.md), so: the pure view `short-address-check.ts` under vitest (22 tests:
  hidden state, language, each outcome, CCL-00014 → field error, any failure → unavailable, a stale
  answer, the city comparison) **and** `tools/callcenter-location-drive.mjs` §13 against stubs
  emitting the exact envelope, LTR and RTL (drive 349/349)
- [ ] a run against a dev SIS.Api with the owner's key

## Boundaries

Read only: nothing from SPL's answer is saved by this ticket.

## Done when

The Proof is green.

## Blocked by

None against stubs; live: BackOffice 3074.

## Comments

**2026-10-26 — client half built, stubbed. Ticket stays `open`:** the second Proof box (a run against
a dev SIS.Api with the owner's key) waits on BackOffice 3074, which is not built.

What landed: `canCheckShortAddress` + `ShortAddressCheck`/`ShortAddressParts` + `CCL.shortAddressMalformed`
(`core/models/callcenter.ts`); `callCenterApi.checkShortAddress(code, language)`; the pure view
`short-address-check.ts`; **Check** beside the Short Address in `AddressForm` (handed the capability
through `AddressPicker`); EN + AR keys under `callcenter:location.shortAddressCheck.*`; drive §13.

Decisions (overrulable):

1. **Capability name `capabilities.canCheckShortAddress`** — 3074 says the seats' capabilities carry it
   but does not name it. Read strictly: absent = false → Check hidden (never a dead control).
2. **Parts on the wire are camelCase and nullable**: `buildingNumber, street, district, city, postCode,
   additionalNumber` (spec 3072 spells them as SPL's PascalCase). `parts` is read only on `FOUND`.
3. **City warning**: spec 3072's comparison (by name, trimmed, case-insensitive) against the **form's**
   city — matched against *either* of the form city's names from the district list (English and
   Arabic), because SPL answers in the console's language and the form's `cityName` is the English
   master-data name. No warning while the form has no city or SPL gave none. Worded
   "SPL says {city}, the form's city is {city}".
4. **Language** = the console's i18n language: `A` under Arabic, else `E`. Today `lng` stays `en`
   even under RTL (`core/i18n.ts`), so the web seat asks `E` until Arabic is switched on.
5. **Check is disabled** on a blank box or one the offline `AAAA9999` check already refuses (that
   box already shows its error; no call is spent). A `CCL-00014` from the server still lands as the
   field's own error.
6. **Any failure is unavailable** — a non-CCL-00014 refusal, a 500, a network fault, an outcome
   outside the three, or a `FOUND` without parts. Only the server's `UNKNOWN` reads "Not known to SPL".
7. **The answer belongs to the code it was asked for**: editing the box drops it. Each press is a
   fresh call (a mutation, not a cached query — the server caches 15 min).
8. **Display**: the parts line is SPL's free text, isolated once as a `<bdi>` and joined with the
   pair's ` · `; the additional number is `Ltr`. Answers are drawn quiet; only the city warning
   takes attention styling. When Check is offered, the hint drops "the address itself is not
   verified".

**BO ask (BackOffice 3074):** confirm the capability name (`canCheckShortAddress`) and the parts'
casing (camelCase, nullable) in the contract asset `assets/2482-location-link-web-seat-contract.md`.
If either differs, only `core/models/callcenter.ts`, `short-address-check.ts` and the drive's stub move.

Owner sign-off wanted: the Arabic wording (SPL rendered "سبل").

**2026-10-26 — code-review fixes (`579 review fixes`).** A business refusal other than `CCL-00014`
now shows the server's message + code (`apiErrorMessage`/`apiErrorCode`, fixed key only when the
message is blank); only server/network/unknown faults, an all-blank `FOUND` and no parts read
*unavailable* (supersedes decision 6). The held answer is keyed by code **and** language, a late
answer for an older code is dropped, and Check is held only while *this* code's call is in flight
(supersedes 5's "disabled while checking"). The picker re-keys `AddressForm` on every address load.
The FOUND line is isolated once with `Ltr` when led by the building number (supersedes 8's `<bdi>`),
joined by the new `formatParts` (`@/core/util/bidi`). `CCL-00014` moved out of the location-link
`CCL` into `NATIONAL_ADDRESS_CCL`; the districts read is gated on the capability; the api JSDoc is
back on its own functions. Gates green; drive 363/363 stubbed (LTR + RTL).
