---
status: open
spec: 209
blocked-by: 218, 219
---

# 220 — A refused submit keeps the agent on the form, with the reasons on the rows that caused them

## What to build

Submit as a **gated path, not a button** — and the ruling that a refusal is a form state rather than
an error page.

**Before the request goes:** the submit-blockers module states, in one place, every reason Submit is
unavailable — no items · no attachment · no principal diagnosis · morphology required and unset ·
coverage unpicked where the patient has two or more. Each blocker names itself, so the agent reads
what is missing rather than hunting for it.

**The clinical-edit gate**, which is a *submit*-time check and not a dispense-time one:

- A **warning** restriction lists what it found, with `Back to the form` and `Submit anyway` — the
  agent may proceed on a judgement call.
- A **fatal** restriction is the same surface with the confirm button removed. One dialog, two
  shapes, so the rule reads identically and is simply not overridable.

**Then the submission**, synchronous and slow by design, and its three outcomes:

- **Accepted** → the authorization lodges and the agent lands on its detail.
- **Refused on validation** → `Failed`, and **the agent stays on the form** with each reason
  attached to the row or field that caused it. This is the correction of record this ticket carries:
  `Failed` does **not** mean a transport blip — it means the request was refused before the payer
  ever saw it, and it is *fixable by the agent, here*. There are **two sources** of it — the
  exchange's own validation, and the Nphies service's guards, which throw *before the lines are
  built*; the second kind is the more fixable of the two.
- **Timed out** → reported as **in flight, never failed.** The agent is sent to status-check, never
  invited to resubmit. Raising a second authorization for a request that already reached the payer
  is the worst outcome this screen can produce, and this rule is the whole of what prevents it.

## Spine reach

model/api (clinical-edit validate, submit) · store/logic (the submit-blockers module, the outcome
branch, refusal-to-row mapping) · component/route (the gate dialog, the failed-form state) · i18n ·
test

## Proof (→ `tdd` red-green cycles)

- [ ] `everyBlockerNamesItself` — the module returns each unmet condition with its own message; an
      unnamed blocker fails the test · pure
- [ ] `aFatalRestrictionCannotBeOverriddenAndAWarningCan` — the same surface, one button's
      difference · pure
- [ ] `aTimeoutIsReportedAsInFlightNotFailed` — and the offered next act is status check, never
      resubmit · pure
- [ ] `refusalReasonsLandOnTheRowsThatCausedThem` — including the header-only case, where the
      request failed before any line was built · pure
- [ ] both gate shapes render, a refused submit keeps the agent on the form with reasons attached ·
      flow (Playwright, extend `tools/nphies-authorization-session-drive.mjs`)

## Boundaries

**Server dependency (SIS.Api):** clinical-edit validate, and submit — the latter carrying an
explicit long timeout, with the in-flight semantics above owned by the server contract and mirrored
here.

**Envelope handling, three-way:** a payer rejection arrives as success-shaped **data** and must
render; a business refusal arrives as `success:false` with a code and is explained from that code; a
transport failure is the only case that is an error. Do not collapse the first two into the third.

**One required server guard is assumed:** a zero extended price is refused before submission,
because the service divides by it. If that guard is not in place, this slice can send a request that
fails with an unhandled exception and leaves an orphan header.

## Done when

Submit is unavailable while any blocker holds and each says why; both clinical-edit shapes behave;
an accepted submit lands on the detail; a refused one keeps the agent on the form with reasons on
the right rows; a timeout says in-flight and offers status check — drive green.

## Blocked by

- [218](218-five-money-inputs-and-nothing-else.md) — the money must be settable before it is sent.
- [219](219-supporting-material-diagnoses-and-attachments.md) — two of the blockers are its.
