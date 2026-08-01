---
status: done
spec: 209
blocked-by: —
---

# 211 — A granted agent runs an eligibility check and gets an answer in two axes

## What to build

**The tracer bullet.** An agent with the Nphies grant sees a **Nphies** group in the nav, opens the
check form, picks the provider they are acting for, fills the patient block from that patient's last
check, submits, and reads the answer as **Request state** and **Verdict** — the two axes every act
on this screen carries.

Chosen as slice 0 because the check is the one act whose endpoint **already ships** in SIS.Api
today, so this slice proves the whole spine — area, namespace, route, nav, access probe, envelope,
model, render — against a real server rather than a stub.

What the form does:

- **Provider is a free per-act pick** from the providers lookup: no default, no memory of the last
  pick, submit blocked until one is chosen. Only unblocked providers are offered. It is the only
  place in the whole feature a provider is ever picked.
- **Fill** takes a patient id and completes the identity block from that patient's last check.
  It works on a cold form, not only from a selected row — that is what makes it better than the
  row-driven prefill it replaces.
- The result renders **Request** (`Cancelled` · `Failed` · `Pending` · `Complete`) and **Verdict**
  (`Eligible` · `Not in force` · `Not eligible`), with **site eligibility qualifying the verdict
  inline at result time** — "Eligible · outside network" — rather than being discovered later.
  Verdict is blank unless Request is `Complete`.

No claim-type or request-type selector exists anywhere: v1 is one of each, both constants.

## Spine reach

model/api (eligibility check request + response, feature `api.ts` over `core/api.ts`) ·
store/logic (the two-axis derivation, provider-required gate) · component/route
(`/nphies/eligibility/new`, new `features/nphies/` area) · i18n (new namespace, registered
centrally) · nav (new top-level group + access probe) · test

## Proof (→ `tdd` red-green cycles)

- [x] `verdictIsBlankUntilTheRequestIsComplete` — the derivation returns no verdict for
      `Cancelled` / `Failed` / `Pending`, and the mapped verdict for `Complete` · pure
      → `src/core/nphies/status.test.ts`. Includes the trap: a `Failed` row carrying
      `isEligible: true` still reports **no** verdict, because the service stores that flag whatever
      happened.
- [x] `siteEligibilityQualifiesTheVerdictInline` — an out-of-network eligible result renders as one
      qualified verdict, not as two separate facts · pure
      → same file. `verdictCellKeys` returns the ONE cell's parts in order, so the decision is not
      re-made at the render site; the drive asserts the qualifier is inside the verdict badge.
- [x] `submitIsBlockedUntilAProviderIsChosen` — the blocker is present with no provider and absent
      with one; no default is ever supplied · pure
      → `src/features/nphies/eligibility/check-form.test.ts`, plus `fill does NOT choose a
      provider` — the last check names one and copying it would be memory of the last pick.
- [x] the nav leaf is hidden for an agent without the grant and present with it; the check submits
      and renders both axes · flow (Playwright, new `tools/nphies-eligibility-drive.mjs`) —
      RTL is not installed, so screen behaviour is verified by driving the app plus `typecheck`
      → **33/33 green**, ten scenarios: no-default provider, blocked submit, Fill on a cold form,
      Complete+Eligible·outside-network, not-in-force with its reason, Failed with a blank verdict
      and the message under a failure label, Pending, a `PROVIDER_NOT_CONFIGURED` business refusal,
      no-grant (leaf hidden + backstop) and an **errored probe failing closed**. It also asserts the
      body on the wire carries no server-stamped identity and no claim/request type.
      ⚠ Against **mocked** `Nphies/*` envelopes — SIS.Api is down and all four server dependencies
      are unbuilt (BackOffice 912–922, in flight). Every stubbed field name is read from CONTRACT.md
      or the Nphies service's own DTOs. `npm test` 845 green (53 files), `typecheck`, `lint`
      (boundaries · contrast · palette) and `build` all clean.

## Boundaries

**Server dependency (SIS.Api, not ticketed in this repo):**

- **A grant filter on the eligibility check endpoint.** It ships today with the API key and **no
  grant filter at all** — this slice is what closes that, not what inherits it.
- **An access probe** for the nav leaf and the in-page backstop, one grant for the whole area
  (no read/write or per-audience split).
- **A providers lookup** passthrough. The service already filters blocked providers out.
- **A last-eligibility-by-patient** passthrough, for Fill.

New i18n namespace — register it centrally in the same change that uses it, or every `t()` renders
its raw key. New **area** folder: the first `features/nphies/` files, so the import-boundary lint
gate sees a new area for the first time.

Follow the call-centre group in the menu model as the precedent for a new top-level nav group with
its own probe. **Fail closed**: a pending or errored probe hides the leaf rather than revealing it.

## Done when

An agent with the grant reaches `/nphies/eligibility/new` from the nav, cannot submit without
choosing a provider, fills a patient block from a patient id, submits, and sees both axes rendered —
with the drive green and `npm run lint` passing the boundary and i18n gates.

## Blocked by

None in this repo — can start as soon as the four server additions above exist.

## Comments

**Built 2026-08-02, unattended.** Ten implementation decisions are logged in `.afk/HITL-211.md`;
four of them matter to the next slices:

1. **The two-axis derivation landed in `src/core/nphies/status.ts`, not in the feature.**
   [212](212-the-eligibility-list-opens-on-a-visible-window.md)'s prose places the shared status
   module "in this feature", but [214](214-an-authorization-row-states-both-facts.md) builds a
   *second* feature over it and features may not import features — so it is in `core/` from the
   first consumer rather than lifted a ticket later. 212 and 214 take it as-is; 214 adds the auth
   verdict as a sibling function over the same `RequestState`.
2. **Contract gap — §5 does not name the eligibility-side Request sources.** The section names
   `Cancelled` / `Error` / `Queued` / `ClaimProcessingCodes`, which are `NAuth`'s columns.
   `EligibilityResponse` carries `Outcome` / `Success` / `ErrorMessage` instead, so the axis is
   derived from those (`queued→Pending`, `error→Failed`, `complete`/`partial`→`Complete`,
   no-outcome-and-`success:false`→`Failed`). **An eligibility check is never `Cancelled`** — there
   is no act and no field for it. A §8-additive revision should state this.
3. **The payer is a typed code, not a lookup pick.** This ticket's Boundaries name four server
   dependencies and the payers lookup (§1.1 #11) is not among them, so wiring it here would be
   scope creep into a later slice's list. Fill prefills it.
4. **`EligibilityPurpose` is pinned to `'benefits'`.** The contract pins `ClaimType` and
   `ClaimRequestType` but is silent on this one; the service resolves it by display name and then
   leaves the resolved code out of the bundle (`EligibilityService.cs:144` is commented out), so it
   is echo-only and never reaches the exchange.

Also landed, because the code that uses them landed: **eligibility check** and **provider** (with
its explicit not-a-**store** clause) in `CONTEXT.md`, per spec 209 §13.
