---
status: open
spec: 209
blocked-by: 212
---

# 213 — A patient with two coverages must pick one before an authorization can be raised

## What to build

The eligibility response detail, and the seam out of it.

The detail lists **every coverage the patient holds** — member id, in-force, network, plan, class,
policy holder — because choosing a policy is really choosing *which member id an authorization is
raised under*. There is no coverage id in the request; there is a member id.

The rule is keyed on the **count, not on in-force**:

- **Exactly one coverage → auto-selected, no picker.** The 99% case costs no click.
- **A lone expired coverage is still auto-selected** — the Verdict column is what tells the agent it
  is not in force, and hiding it behind a picker would say the same thing worse.
- **Two or more → the agent must pick, with no default**, before an authorization can be raised.

The seam: **Raise authorization** navigates to the authorization form route carrying the
**eligibility id and the chosen member id** in the URL. This is the decision that makes the two
features independently buildable — WPF carried the response object in a controller field, and the
web fetches it by id instead. It is chosen because an authorization is often raised days after the
check, from a row on the list rather than in the same sitting; a wizard step would serve only the
same-sitting case and then need a second entry point anyway.

The route it points at does not exist until [217](217-a-live-engine-session.md). Build the seam
here, pointing at the route; landing on it is 217's job.

## Spine reach

model/api (response by id, with coverages) · store/logic (the coverage-selection rule, the seam's
parameters) · component/route (`/nphies/eligibility/:id`) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `oneCoverageIsSelectedWithoutAsking` — a single coverage yields a selection and no picker,
      **including when it is expired** · pure
- [ ] `twoCoveragesRefuseToProceedWithoutAChoice` — no default is supplied and the raise action is
      blocked until the agent picks · pure
- [ ] `theSeamCarriesTheEligibilityAndTheChosenMember` — the target URL carries both ids, so the
      form can be reached cold days later · pure
- [ ] the detail lists every coverage; a two-coverage patient cannot raise until one is picked ·
      flow (Playwright, extend `tools/nphies-eligibility-drive.mjs`)

## Boundaries

**Server dependency (SIS.Api):** eligibility **response by id**, carrying every coverage.

The detail is a **route, not a modal** — no modal opens anywhere in this feature. It must survive a
refresh and be linkable, which is half the reason the seam is a URL.

## Done when

`/nphies/eligibility/:id` lists every coverage, auto-selects a lone one (expired included), forces a
pick on two or more, and **Raise authorization** navigates carrying both ids — drive green.

## Blocked by

[212](212-the-eligibility-list-opens-on-a-visible-window.md) — the detail is opened from the list.
