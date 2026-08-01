# HITL — ticket 211 (spec 209, contract v1.0)

Decisions taken unattended while building slice 0 of the Nphies wave. Each one is the most
conservative reading of the ticket + the frozen contract; none invents a server shape.

## Q: Where does the two-axis (Request / Verdict) derivation live?

**Decision taken:** `src/core/nphies/status.ts`, not inside `features/nphies/eligibility/`.
**Why:** 214 builds the *authorizations* feature and reuses the same derivation, and
`.claude/rules/feature-structure.md` forbids feature → feature imports — so the module 212's prose
places "in this feature" would have to be lifted a ticket later anyway. The wave runner's standing
instruction says the same. 211 is the first ticket that needs the derivation (its first two Proof
bullets are about it), so it is minted here, in its final home.
**Revisit if:** the authorization verdict turns out to need a genuinely different derivation rather
than the same shape over a second value set — then two feature-local modules would be honest and
`core/` would be a false sharing.

## Q: What is the eligibility feature's i18n namespace called?

**Decision taken:** `eligibility` (file `src/locales/en/eligibility.json`, calls `t('eligibility:…')`).
**Why:** the rule is "namespace name == feature name", and the feature is
`features/nphies/eligibility`. The area does not enter the namespace (the `pricing/*` features are
`simulation`, `coupons`, … not `pricing-simulation`).
**Revisit if:** 214's `authorizations` namespace reads ambiguously next to it — then both would be
renamed together with the area prefix, which is a rename of two call-site prefixes and nothing else.

## Q: How does the agent supply the payer code on a cold check form?

**Decision taken:** a typed payer code field, prefilled by **Fill** from the patient's last check.
No payers dropdown in this slice.
**Why:** 211's Boundaries name exactly four server dependencies — the grant filter, the access probe,
the **providers** lookup and last-eligibility. The payers lookup (contract §1.1 #11) is not among
them, and wiring it here would be scope creep into a later slice's dependency list.
**Revisit if:** driving the real endpoint shows agents cannot know a payer code by heart — then the
payers lookup joins, and the field becomes a select with the same `payerCode` value.

## Q: What does `EligibilityPurpose` carry, given no selector exists?

**Decision taken:** pinned to the constant `'benefits'`, never offered as a control.
**Why:** the contract sends `EligibilityRequest` verbatim but pins only `ClaimType` and
`ClaimRequestType`; v1 has one kind of check. In the service the value is looked up
(`GetCodeSystemByDisplayName(ValueSetTypes.EligibilityPurpose, …)`) and the resolved code is
**commented out of the bundle** (`EligibilityService.cs:144`) — it is echoed back on the response and
never reaches the exchange, so the constant is the low-risk choice and `benefits` is the NPHIES
value set's own word for *what is covered*.
**Revisit if:** SIS.Api's ticket 912 pins it server-side (then the client stops sending it), or the
code system's rows turn out to be display names with different spelling.

## Q: The contract's Request axis names auth-side fields. What does an eligibility derive it from?

**Decision taken:** from `outcome` (FHIR `queued` | `complete` | `error` | `partial`) plus `success`
and `errorMessage`; `queued → Pending`, `error → Failed`, `complete → Complete`,
`partial → Complete`, absent-outcome-with-`success:false` → `Failed`, absent otherwise → `Pending`.
**An eligibility check is never `Cancelled`** — there is no cancel act on it and no field to carry
one, so that member of the axis is unreachable on this side.
**Why:** §5 names `Cancelled` / `Error` / `Queued` / `ClaimProcessingCodes`, which are `NAuth`'s
columns; `EligibilityResponse` (read from the service's own source, `Dtos/EligibilityResponse.cs`)
carries `Outcome`, `Success`, `ErrorMessage`, `Inforce`, `Coverage`, `IsEligible`,
`NotInForceReason`, `SiteEligibility`. The mapping above is the same *question* ("did we get an
answer at all") asked of the fields that exist. **This is a contract gap** — §5 should state the
eligibility-side sources explicitly.
**Revisit if:** the server track answers `Nphies/CheckEligibility` with a projected `requestState`
rather than the raw DTO — then the client stops deriving and reads it.

## Q: `partial` — Complete or Pending?

**Decision taken:** `Complete`.
**Why:** the axis asks *did we get an answer*, and a partial answer is an answer; the Verdict axis is
where "what they said" is qualified. Calling it `Pending` would offer a status check for a payer that
has already replied.
**Revisit if:** a real capture shows the service re-polls `partial` eligibilities, which would make
`Pending` the truthful reading.

## Q: Is anything other than the provider a submit blocker on the check form?

**Decision taken:** yes — patient id and payer code, alongside the provider.
**Why:** the ticket names the provider gate because that is the *designed* one (no default, no
memory). The other two are not design, they are arithmetic: `EligibilityRequest` cannot be built
without them and the service throws `"Payer doesn't configured!"` on an empty payer. Blocking on the
form is this spec's own posture — "a required field appears with its cause" — rather than letting
the exchange refuse.
**Revisit if:** SIS.Api starts defaulting the payer from the patient, which would make it derived
rather than required.

## Q: SIS.Api is down and none of the four endpoints exist. How is the slice verified?

**Decision taken:** `tools/nphies-eligibility-drive.mjs` drives the real app in Chromium against
**mocked** `Nphies/*` envelopes shaped exactly as the contract and the service DTOs say, following
`tools/bby-inquiry-drive.mjs`. Plus `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
**Why:** the wave's standing instruction, and the same code-complete/runtime-blocked posture the
call-centre and BBY slices shipped under. Every stubbed shape is a field name read from
`CONTRACT.md` or from the Nphies service's own source, so the stub is a contract assertion and not a
convenience.
**Revisit if:** the endpoints land — then the drive is re-run against them and the mocks become
regression fixtures.

## Q: Does the access probe fail open (like `Bby/Access`) or closed (like `SdDocumentWeb/Access`)?

**Decision taken:** **closed** — a pending or errored probe hides the nav leaf and draws the in-page
refusal.
**Why:** the ticket says so in as many words ("Fail closed: a pending or errored probe hides the leaf
rather than revealing it"), and what is behind the leaf talks to a national exchange. The fail-open
probes exist only where a read-only screen outran its endpoint.
**Revisit if:** never, on this area.

## Q: Law 10 says every response carries `contractVersion`. This one does not. Add it?

**Decision taken:** **no** — nothing is sent, nothing is checked, and the gap is logged here
instead. `checkContractVersion` (shipped by 210) stays unused until a response actually carries one.
**Why:** the contract disagrees with itself here and it is not this slice's to resolve. Law 10 and
§8 say every response carries `contractVersion` and the client hard-stops on a major mismatch — but
§1.1 and §3.1 make `checkEligibility` a **passthrough** whose response is "`EligibilityResponse`
verbatim", and that DTO (read from the service's source) has no such property. §8's own wording
scopes the check to "the first response of **a session**", and a check is not a session. Adding a
field would be inventing a server shape; enforcing a check would hard-stop the screen on every real
response the endpoint can currently produce. **This is the gap the runner's instruction describes: a
HITL entry naming it, not a licence to make it up.**
**Revisit if:** BackOffice 912 stamps `contractVersion` onto the passthrough envelopes (then the
model gains the field and the page calls `checkContractVersion` on the first response), or §8 is
amended to say passthrough acts are exempt.

## Q: Does the check result render the coverages and the disposition, or is that 213's?

**Decision taken:** render both, read-only. **Nothing selects a coverage** — that stays 213's.
**Why:** both arrive on this very response (§3.1: "Response is `EligibilityHeaderResponse` +
`EligibilityCoverageResponse[]`"), and §5 names `Disposition` as one of the three places the payer's
own words live on a `Complete` act. A result that hid the coverages would read as though the patient
holds no policy at all. The line drawn is *display vs choice*: 213 owns the auto-select-one /
force-a-pick rule and the member id it commits to.
**Revisit if:** 213 wants the whole coverage block to move onto the detail route, in which case this
is deleted rather than adapted.

## Q: A `Pending` act renders its message under "could not reach the payer". Is that right?

**Decision taken:** yes — kept, per the contract, and pinned with a comment so it is not "fixed".
**Why:** §5 is explicit: "`Failed` / `Pending` → render under a **failure** label ('could not reach
the payer')" and "`Complete` → **never render it at all**". A review flagged it against `CONTEXT.md`'s
gloss that `Failed` means *we could not ask* — the glossary is right about `Failed` and the contract
is still the authority on which branch may read the field, because the point of the rule is that the
field's *meaning* changes on `Complete` and nowhere else.
**Revisit if:** the contract is amended to give `Pending` its own label.

## Q: Post-review — the blocker list grew and the identity defaults went away. Why?

**Decision taken:** `patientIdType` and `patientGender` open **unchosen** (not `PRC`/`male`), and
name, ID type, gender and date of birth join the blockers.
**Why:** the first cut defaulted them for convenience, which meant an agent who never touched the
gender control still shipped `male` to a national exchange — the same class of quiet wrong the
provider's no-default rule exists to prevent, and `PatientBirthDate` is a non-nullable `DateTime`
that would have gone out as `""`. The blockers are still arithmetic rather than invention: every one
of them is a field `EligibilityRequest` cannot be built without.
**Revisit if:** the exchange turns out to accept a partial patient (it does not — the FHIR Patient
carries all four).

## Q: Where does the access probe live?

**Decision taken:** `src/core/nphies/api.ts`, exporting `NPHIES_ACCESS_KEY` + `nphiesAccessApi`.
**Why:** contract §1 gives the whole area **one** grant and **one** probe, and its consumers are the
menu leaf plus every screen in both `nphies/*` features — which is exactly the three-consumer
situation that put the OMS and bonus-buy probes in `core/`.
**Revisit if:** the grant ever splits per feature, which §1 rules out.
