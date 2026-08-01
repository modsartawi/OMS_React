# HITL — ticket 213 (a patient with two coverages must pick one)

Unattended run, 2026-08-02. Decisions a human would normally have weighed in on.

## Q: What is the pick token — the member id, or the coverage's position?

**Decision taken:** the **index** into `coverages` is what the picker holds and what
`resolveCoveragePick` takes; the **member id** is what the seam carries.
**Why:** `EligibilityCoverageResponse.MemberId` is nullable and nothing guarantees it is unique
across a patient's policies, so a picker keyed on it could not tell two blank-id coverages apart —
the same collision `CheckResult`'s list key already works around.
**Revisit if:** the contract ever states `MemberId` is non-null and unique per response.

## Q: A lone coverage carrying a blank member id — auto-selected, or blocked?

**Decision taken:** auto-selected (the count rule is honoured), but **Raise authorization is
blocked** with its own stated reason: *this coverage carries no member ID*.
**Why:** §7.1's `Open` takes `{ eligibilityId, memberId }` and the ticket says it out loud — "there
is no coverage id in the request; there is a member id". A seam URL with `coverage=` empty would
carry the agent to a form that cannot open, and it would fail there rather than here.
**Revisit if:** SIS.Api ever accepts a coverage id or a sequence in place of the member id.

## Q: Should Raise authorization be gated on the verdict (not eligible, not in force, Failed)?

**Decision taken:** **no.** The only gates are the count rule and the member id. A not-in-force or
not-eligible check can still raise.
**Why:** the ticket states the rule is "keyed on the **count**, not on in-force", and spec 209 story
21 makes the same point for the lone expired coverage — the Verdict column is what tells the agent,
and hiding the act behind a verdict gate would say the same thing worse. Nothing in the spec or the
contract makes eligibility a precondition of raising.
**Revisit if:** the exchange refuses a `WithReferenceToEligibility` authorization against a
not-in-force coverage, at which point the block belongs here with that as its reason.

## Q: Zero coverages — picker, or nothing?

**Decision taken:** no picker, no selection, Raise blocked with *the payer returned no coverages*.
**Why:** a picker with nothing in it is a control that cannot be satisfied. The count rule has
nothing to select from, and the blocker names the fact rather than the control.
**Revisit if:** a coverage-less eligibility is ever a legal basis for an authorization.

## Q: How does the list open the detail?

**Decision taken:** a first column of real `<Link>`s to `/nphies/eligibility/{id}` (an **Open**
cell), not a row click and not a toolbar button.
**Why:** spec 209 story 9 — "open a past eligibility response as its own page, so that I can link
someone to it". A real anchor is right-clickable, copyable and middle-clickable; a row-click handler
is none of those. The deliveries toolbar precedent (`GridToolbar`) exists but was built for a
selection-plus-command screen, which this list is not.
**Revisit if:** the grid grows a selection model for a bulk act.

## Q: Does the detail re-render the check result, or share it?

**Decision taken:** the coverage list is extracted to `CoverageList.tsx` and rendered by both
`CheckResult` (read-only) and the detail (selectable); `CheckResult` itself is reused whole on the
detail.
**Why:** the same six facts per coverage on two screens, and the ticket's own boundary — the agent
learns one vocabulary. A second copy would drift the moment one screen gains a field.
**Revisit if:** the two lists ever need to differ by more than selectability.

## Q: The detail's Raise action points at a route nobody has built.

**Decision taken:** built as stated — the seam is a `<Link>` to
`/nphies/authorizations/new?from=<eligId>&coverage=<memberId>`, and landing on it is 217's job.
**Why:** the ticket says so explicitly ("Build the seam here, pointing at the route"). The URL shape
is spec 209 §1's, verbatim.
**Revisit if:** 217 changes the parameter names — the builder is one pure function and one test.

## Q: No `Nphies/EligibilityResponse/{id}` endpoint exists to drive against.

**Decision taken:** stubbed at Playwright against contract §1.1 #4's shape (`EligibilityResponse` +
coverages — the same DTO `CheckEligibility` answers with), exactly as 211 and 212 shipped.
**Why:** SIS.Api is down and BackOffice 912–922 are being written in parallel; the runner's own
instruction is to stub the network at Playwright rather than stop the slice.
**Revisit if:** the endpoint lands and its shape differs — the model type is shared with the check
response, so a drift shows up on both screens at once.
