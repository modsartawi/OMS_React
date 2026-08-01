---
status: open
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

- [ ] `verdictIsBlankUntilTheRequestIsComplete` — the derivation returns no verdict for
      `Cancelled` / `Failed` / `Pending`, and the mapped verdict for `Complete` · pure
- [ ] `siteEligibilityQualifiesTheVerdictInline` — an out-of-network eligible result renders as one
      qualified verdict, not as two separate facts · pure
- [ ] `submitIsBlockedUntilAProviderIsChosen` — the blocker is present with no provider and absent
      with one; no default is ever supplied · pure
- [ ] the nav leaf is hidden for an agent without the grant and present with it; the check submits
      and renders both axes · flow (Playwright, new `tools/nphies-eligibility-drive.mjs`) —
      RTL is not installed, so screen behaviour is verified by driving the app plus `typecheck`

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
