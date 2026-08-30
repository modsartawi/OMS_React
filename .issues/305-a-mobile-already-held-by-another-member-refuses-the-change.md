---
status: open
spec: 301
blocked-by: 303
---

# 305 — aMobileAlreadyHeldByAnotherMemberRefusesTheChange

## What to build

Changing a **loyalty member**'s mobile number — its own control, its own confirmation, and its own
vocabulary of refusals.

🚩 **This is deliberately not a field on the profile form.** The mobile is the programme's login
credential and one of only **two** ways a member can be found at all (the other is the loyalty id —
email and national id are fields *on* a member, never ways *to* one). It must never change as a side
effect of fixing a name, which is why 301 ruled the commands act-shaped.

The control takes the new number, confirms, and writes. Three refusals, each named as itself so the
analyst knows which problem they have:

- **The number is already held by another member.** A collision, not a format problem. 🚩 The
  server-side handler this delegates to **refuses** rather than taking the number from its current
  holder — the wipe-the-other-member path exists only on the customer-driven OTP flow, not here.
  A refusal changes **nothing**: the member is never left half-edited.
- **The number is the one the member already has.** Refused as such, so no **member update
  snapshot** records a change that did not happen.
- **The number is not a valid mobile.** Refused before anything is written — a typo must not become
  a member's credential.

On success the header and the Actions tab both reflect the new number with no reload.

⚠️ **A caveat to carry, not to fix here:** this path marks the new number **verified, with no OTP at
all** — the analyst asserts verification on the customer's behalf. That is existing server
behaviour, deliberately unchanged by 301, and flagged for an owner ruling. Do not quietly "improve"
it in this ticket; if the screen says anything about verification, it must say what is true.

## Spine reach

model/api (the change call) · store/logic (which refusals are named; the confirm precondition) ·
component (the control + confirmation) · i18n · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `eachRefusalIsNamedAsItselfRatherThanAsAFailure` — collision, same-number and invalid-number
      map to three distinct named outcomes; an unrecognised code falls back to the server's own
      sentence rather than to a generic one · pure
- [ ] `aRefusedMobileChangeLeavesTheMemberUntouched` — drive a collision refusal; assert the member
      on screen still carries the old number, the Actions tab gained no row, and the analyst is
      still in the confirmation with the number they typed · flow

## Boundaries

- **Endpoint dependency:** the existing no-OTP mobile-change handler, newly exposed on the web door
  and gated on *may edit*. 🚩 The route is unbuilt — stub the envelopes. **Nothing here meets a live
  SIS.Api.**
- **Envelope `success:false` codes to handle by name:** mobile already used · same mobile as now ·
  invalid mobile · member does not exist. Plus the grant refusal.
- **i18n:** new `loy` keys, one per named refusal.
- Grows `tools/loy-member-admin-drive.mjs`. Copies 303's idiom.
- **Not** contact removal. Removing a mobile is 307 and is gated differently.

## Done when

Driving a collision, a same-number and an invalid-number attempt each produces its own sentence and
leaves the member unchanged; a successful change updates the header and the Actions tab with no
reload. `typecheck`, `lint`, vitest green.

## Blocked by

[303](303-blocking-a-member-names-a-reason-and-unblocking-clears-it.md) — for the write idiom.

## Open questions

- ⚠️ **Owner ruling pending** (301 → Further Notes): the admin path marks a number verified with no
  OTP. Not this ticket's to change, but if the ruling lands mid-build it changes what the
  confirmation may claim.
