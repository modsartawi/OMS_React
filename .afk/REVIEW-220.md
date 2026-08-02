# Reviews — ticket 220 (a refused submit keeps the agent on the form)

Both reviews were run against the working tree before commit: the built-in correctness review
(`/code-review`) and `/standards-review`'s two axes. **Every finding below was fixed in the same
session**, and the drive and the pure suite were extended to cover the two that a browser could
reach.

## Correctness — 5 findings, all fixed

| # | Finding | Fix |
|---|---|---|
| C1 | **The `NO_ATTACHMENTS` de-dupe was inverted.** `stated` was built from the *live* client codes, so the server's entry was suppressed only while the client blocker held — i.e. it reappeared the moment the agent attached a file, and disabled Submit for the rest of the session over a fact the engine cannot see. | `submit-gate.ts` — `stated` is now `Object.values(SERVER_CODE_FOR)`, unconditional. New test `andItStaysQuietOnceTheAgentHASAttachedOne`. |
| C2 | **After an in-flight submit the form still offered to abandon the request.** `state.status` is still `open` (the server never answered), so `useBlocker` intercepted the one act the panel offers and answered it with a *Discard* button — voiding a transaction that may already be at the payer. The whole form also stayed editable during the 100 s leg. | `AuthorizationFormPage.tsx` — `locked = submitIsLocked(landing)` exempts the blocker and the leave warning; `frozen` (and `busy`, now including `submitting`/`checking`) disables every control. Drive asserts the exit sends **no** `Session/Abandon` and that the form is frozen. |
| C3 | **`checking` stayed true for the whole submission** — "Checking the diagnoses…" and "Submitting — 42s of 100s" rendered together. | `beginSubmit` closes the check in its own `finally` and calls `sendSubmit()` after it. |
| C4 | **A gate raised against the old diagnoses survived a header edit**, so *Submit anyway* could confirm a check that was never made. | `setHeader` clears `gate`. |
| C5 | The in-flight link promised a filtered list the list page cannot apply. | Reworded: the link says *Open the authorizations list*, and the patient is named in a sentence beside it. |

## Standards — clean, one nit fixed

All four documented rules clean (i18n zero-literal — 21 new keys all backed; logical Tailwind;
api-envelope; feature structure). Wave rules clean: every wire field verbatim from `CONTRACT.md`
§2 / §3.5 / §7.3, and the two shapes the contract does **not** freeze
(`ClinicalEditRequest`/`Result`) read from `ClinicalEditValidator.cs` and logged in
`.afk/HITL-220.md`. No money computed, no polling (the 1 s counter is a local elapsed display), no
modal, nothing shareable left in the feature.

*Nit, fixed:* `readSubmitFailure` used `error.message` directly; it now goes through
`apiErrorMessage(error, '')` as `.claude/rules/api-envelope.md` names.

## Spec — 4 findings, all fixed

- **S1** — the in-flight abandon. Same as C2; the graver reading of it, and the reason the drive now
  asserts the abandon count across that exit.
- **S2** — *"an accepted submit lands on its detail"* was a link the agent had to click. Now the page
  navigates to `/nphies/authorizations/{authId}` after admitting the closed state; the panel remains
  as what the transition renders. The drive asserts the **URL**, not an `href`.
- **S3** — the ticket file was not updated. Proof boxes ticked with their counts, `status: done`, and
  the code-complete / runtime-blocked posture stated in the Proof box.
- **S4** — the stub's `DUPLICATE_SUBMISSION` branch was dead. Scenario 36 now drives it: the
  service's own sentence renders, Submit stays available, and nothing says "in flight".

**No scope creep found on either axis.** `noProvider` and `noCoverage` are the contract's own
(§3.1's "submit is blocked until the agent chooses"; §2's "`memberId` **IS** the policy choice"),
and the `blocked` landing is the ticket's three-way envelope boundary.

## Note carried forward

The drive flaked once at 219's exception-prescription scenario (`locator.check` on a cold Vite
server) and passed on the warm re-run — a 450 ms `waitForTimeout` after a `setHeader` verb, not a
220 regression. Worth a longer wait when someone next touches that scenario.
