---
status: done
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

- [x] `oneCoverageIsSelectedWithoutAsking` — a single coverage yields a selection and no picker,
      **including when it is expired** · pure
      → `src/features/nphies/eligibility/coverage-choice.test.ts`. Carries the two cases the rule's
      shape invites getting wrong: a lone coverage stays selected however the agent clicks (there is
      no state in which it is unselected), and a lone coverage with a **blank member id** is still
      selected and still cannot be raised — `MemberId` is nullable and §7.1's `Open` takes one.
- [x] `twoCoveragesRefuseToProceedWithoutAChoice` — no default is supplied and the raise action is
      blocked until the agent picks · pure → same file. Asserts the absence of a default explicitly
      (not the first row, not the in-force one) and that an **out-of-range pick is no pick** — a
      clamp there would silently answer the one question this ticket exists to ask.
- [x] `theSeamCarriesTheEligibilityAndTheChosenMember` — the target URL carries both ids, so the
      form can be reached cold days later · pure → same file, plus the escaping and the refusal to
      build a **half-addressed** URL (`null`, rendered as a withheld act, never a dead link).
- [x] the detail lists every coverage; a two-coverage patient cannot raise until one is picked ·
      flow (Playwright, extended `tools/nphies-eligibility-drive.mjs`) — RTL is not installed, so
      screen behaviour is verified by driving the app plus `typecheck`
      → **108/108 green** (81 from 211+212, 27 new): the list's `Open` **anchor** carrying the id,
      one coverage with no picker and a live seam, a **lone expired** coverage auto-selected with
      the verdict saying so, three coverages with **all three radios unchecked** and the raise
      withheld-with-its-reason, picking releasing it and the seam moving with each re-pick, the two
      unraisable cases (no member id, no coverages), a **reload landing on the same response with
      no pick restored**, a refused read surfacing the server's own message, and the grant gate.
      ⚠ Against a **mocked** `Nphies/EligibilityResponse/{id}` — SIS.Api is down and the endpoint is
      unbuilt. `npm test` 888 green (55 files), `typecheck`, `lint` and `build` clean.

## Boundaries

**Server dependency (SIS.Api):** eligibility **response by id**, carrying every coverage.

The detail is a **route, not a modal** — no modal opens anywhere in this feature. It must survive a
refresh and be linkable, which is half the reason the seam is a URL.

## Done when

`/nphies/eligibility/:id` lists every coverage, auto-selects a lone one (expired included), forces a
pick on two or more, and **Raise authorization** navigates carrying both ids — drive green.

## Blocked by

[212](212-the-eligibility-list-opens-on-a-visible-window.md) — the detail is opened from the list.

## Comments

**Built 2026-08-02, unattended.** Eight decisions in `.afk/HITL-213.md`. `/nphies/eligibility/:id`
joins the area behind the same single probe; the list grew an **Open** column of real anchors,
because spec 209 story 9 asks for a response that can be *linked to* and a row-click handler is not
right-clickable, copyable or middle-clickable.

### The two decisions that shaped the rule

1. **The pick token is the coverage's index; the member id is what the seam carries.**
   `EligibilityCoverageResponse.MemberId` is nullable and nothing guarantees it is unique across one
   patient's policies — the same collision `CheckResult`'s list key already worked around. A picker
   keyed on the member id could not tell two blank-id coverages apart.
2. **An out-of-range pick resolves to NO pick, never to the first row.** A clamp is the quiet way
   this ticket fails: a stale index would silently select a policy the agent never chose, which is
   precisely the outcome the forced pick exists to prevent.

### What is deliberately NOT gated

**The verdict.** A not-in-force or not-eligible check can still raise an authorization. The ticket
keys the rule on the count and story 21 makes the same point for the lone expired coverage — the
Verdict column is what tells the agent, and a gate would say the same thing worse. Nothing in the
spec or the contract makes a payer's answer a precondition of asking for approval.

### Contract notes

- §1.1 #4 answers **the same `EligibilityResponse` DTO** the check act does, so the detail shares
  `EligibilityCheckResponse` rather than growing a second model — the detail is the check's answer
  read back days later, and two models would drift on exactly the fields (`coverages`,
  `notInForceReason`) the detail exists to show.
- The seam's parameters are spec 209 §1's verbatim —
  `/nphies/authorizations/new?from=<eligId>&coverage=<memberId>`. The route lands in
  [217](217-a-live-engine-session.md); `RAISE_AUTHORIZATION_ROUTE` is a named constant with its own
  assertion, so a moved route fails a test rather than leaving an agent on a dead link.
- **No contract gap found on this slice.** Every field the detail reads is one §3.1's response
  already carries.

### Two corrections applied before the commit

- **The pick is stamped with the response id it was made on.** Nothing links one detail straight to
  another today, so every arrival remounts — but the moment such a link exists the id would change
  under a mounted component and an in-range index would select one of the *next* patient's policies
  with no click and no prompt. The drive's scenario 24b says out loud that it cannot fail today.
- **`CoverageList` and `formatStamp` were extracted rather than copied.** The six coverage facts and
  the timestamp format now have one home each across the list, the check result and the detail — a
  second copy would have drifted the moment either screen gained a field.
