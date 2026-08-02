# HITL log — ticket 220 (a refused submit keeps the agent on the form)

Unattended run. Every decision below is the most conservative reading of the ticket, spec 209 and
the frozen contract v1.0 that I could take without inventing a server shape.

## Q: The contract freezes `POST Nphies/ClinicalEditValidate` as "→ findings, typed `F`/`W`" (§1.1 #10, §3.7) but freezes no request or response shape. What body does it take?

**Decision taken:** Read the shapes from the Nphies service's own source rather than inventing them
— `C:\Work\DMSCO\nphies\Service\NphiesService\NphiesService\Features\ClinicalEditValidator.cs`
(read 2026-08-02). Request is `ClinicalEditRequest` (`:285`):
`{ serviceDate, patientBirthDate, patientGender, diagnoses: [{ diagnosisCode, diagnosisType }] }`.
Answer is `ClinicalEditResult` (`:299`): `{ findings: [{ restrictionType, message }] }`.
`ClinicalEditRestrictionTypeConstants` (`:319`) is `F` / `W`. Declared in
`core/models/nphies.ts` with the file and line cited.
**Why:** §1.1 calls it a **passthrough**, so the shape on the wire *is* the service's DTO — reading
it is the same move 219 made for the diagnosis and morphology lookups, not an invention.
**Revisit if:** SIS.Api decides to re-model this endpoint (it re-models only the two lists today), or
BackOffice 912–922 freezes a different body in a §8 revision.

## Q: The ticket calls the clinical-edit gate "the gate **dialog**". Spec 209 rules that **no modal opens anywhere in the flow**.

**Decision taken:** Rendered it as an **inline panel** (`role="group"`, no `<dialog>`), one surface
in two shapes, at the foot of the same scrolling page. The drive re-asserts "no `dialog` anywhere".
**Why:** The spec's Solution section makes "no modal opens anywhere in this flow" one of the three
things that make the screen feel unlike the tool it replaces; 219's attachment lightbox already
resolved the same tension the same way. "One dialog, two shapes" is a statement about the *surface's
identity*, and the panel keeps it — the fatal shape is the warning shape with the confirm button
removed.
**Revisit if:** the owner wants a genuinely blocking surface for the fatal case specifically.

## Q: §7.3's `inFlight` carries `authId: null`, so there is nothing to status-check by id. Where does "the agent is sent to status-check" actually go?

**Decision taken:** A link to `/nphies/authorizations` (the list, where 215's per-row status-check
act lives) reading *Open the authorizations list*, with the **patient named in a sentence beside
it** rather than in the link text. Submit is **removed**, not disabled — and the leave interception
is exempted while locked, so following that link neither warns nor abandons a request that may
already be at the payer.
**Why:** The list page holds its criteria in local state and reads no URL parameters today
(`AuthorizationListPage.tsx`), so a `?patientId=` deep link would be a URL contract nobody
implements. Naming the patient in the sentence costs nothing and invents nothing.
**Revisit if:** the list gains URL-addressable filters — then this becomes a prefiltered link.

## Q: Should the client set its own timeout on the submit leg? §1 says "Explicit **100 s** on the submit leg; the named client configures none today and must."

**Decision taken:** **No client-side abort.** `SUBMIT_TIMEOUT_SECONDS = 100` is declared and used
only to *state* the window on screen (story 63) and in the in-flight sentence. Any transport failure
on that leg — timeout, dead socket, un-enveloped 5xx — is read as `inFlight` by
`readSubmitFailure`.
**Why:** The 100 s is SIS.Api's timeout on its upstream leg, and §7.3 makes `inFlight` a *server*
answer. A browser abort shorter than the server's would manufacture an in-flight verdict for a
request SIS.Api was about to answer properly; a longer one buys nothing. Adding a timeout option to
`core/api.ts` is core surface this ticket did not ask for.
**Revisit if:** a real integration shows the browser hanging well past 100 s — then the abort belongs
in `core/api.ts` as a general option, not here.

## Q: An unrecognised `restrictionType` (neither `F` nor `W`) — fatal or warning?

**Decision taken:** **Warning.** Fatal is exactly `"F"` (trimmed, case-folded).
**Why:** Reproduces the service: `ValidateClinicalEditForAuth` throws only on
`RestrictionType == Fatal` and lets every other value through, and the field is filled straight from
the raw `RareRestrictionType` / `GenderRestrictionType` / `AgeRestrictionType` columns on
`NDiagnosis`, so a third value is a data edit away. A web screen that refused what the till allows
would disagree with the till about what may be sent.
**Revisit if:** the constants class gains a third value with a defined meaning.

## Q: The server's `submitBlockers` (§2) vs the client's own gate — one list or two?

**Decision taken:** **One list.** `submitBlockers()` returns client-derived blockers plus the
server's entries, and a server entry whose code the client already states is dropped
(`NO_ATTACHMENTS` ↔ `noAttachment`). A server entry with an empty `message` is rendered through a
key that *quotes* the code rather than showing the bare machine code as English.
**Why:** The ticket's own words — "the submit-blockers module states, **in one place**, every reason
Submit is unavailable". Showing the same fact twice is exactly the hunting the module exists to end.
**Revisit if:** the server starts emitting blockers the client also derives under a different code.

## Q: 217's drive stub returned a permanent `NO_ATTACHMENTS` in the projection's `submitBlockers`. Keep it?

**Decision taken:** Removed — the stub now defaults to `[]`, with a scenario toggle that serves a
real server blocker (`PROVIDER_NOT_CONFIGURED`) so that path is still driven.
**Why:** §3.5 makes the mandatory attachment a **client** form state precisely because attachments
only exist inside the submit body — the engine has no way to see one. A stub that asserted otherwise
was modelling a server that cannot exist.
**Revisit if:** the server contract gains a pre-declaration of attachments.

## Q: Proof bullet `aTimeoutIsReportedAsInFlightNotFailed` — is the *transport* variant driven as well as unit-tested?

**Decision taken:** The drive covers the transport variant (a raw 502 with no envelope, scenario
36); the **server-supplied** `{ outcome: 'inFlight' }` is covered by the pure suite only.
**Why:** The in-flight lock is permanent by design, so each in-flight path in a browser costs a full
session rebuild. Both paths converge on the same `SubmitLanding` and the same rendering, and the
pure suite asserts they do.
**Revisit if:** the two ever render differently.

## Q: "Accepted → the authorization lodges and **the agent lands on its detail**" — a link, or a navigation?

**Decision taken:** A **navigation**. After the closed state is admitted the page goes to
`/nphies/authorizations/{authId}`; the success panel stays as what the transition renders and as the
fallback if the navigation does not happen. (Raised by the spec review; the first cut offered a link
the agent had to click.)
**Why:** The ticket's and §7.3's word is *lands*. It is safe by construction — the transaction is
`submitted`, so the leave interception is inert and nothing is abandoned on the way out, which the
drive now asserts by counting `Session/Abandon` calls across the transition.
**Revisit if:** the owner wants the preauth reference confirmed on the form before moving.

## Q: SIS.Api is down and no Nphies endpoint is live.

**Decision taken:** Stubbed the network at Playwright against the contract's shapes, as the wave
brief requires; `tools/nphies-authorization-session-drive.mjs` grows scenarios 31–37 and its stubbed
engine grows `ClinicalEditValidate` and `Session/Submit`. Code-complete / runtime-blocked, stated in
the ticket's Proof.
**Why:** The wave brief's standing instruction. No slice stops on it.
**Revisit if:** SIS.Api's Nphies door lands — then this drive is re-run against it.
