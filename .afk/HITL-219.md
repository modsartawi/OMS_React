# HITL — ticket 219 (supporting material: diagnoses and attachments)

Decisions taken unattended. Each is the most conservative reading of the frozen contract
(`.issues/assets/209-nphies-contract/CONTRACT.md` v1.0) and the Nphies service's own source that
was available; every one is cheap to revisit.

## Q: What does "the principal diagnosis is a neoplasm" mean in code?

**Decision taken:** the authority is **`isNeedMorph`** on the diagnosis lookup row
(`NDiagnosis.IsNeedMorph` → `DiagnosisModel.IsNeedMorph`, `GET Nphies/Diagnoses?query=`), fetched for
the principal's own code. No ICD code range is spelled into the browser.
**Why:** it is a per-code column in the same table the exchange is validated against; a `C00–D48`
range in the client would disagree with it silently and only for the codes nobody tested.
**Revisit if:** SIS.Api's passthrough drops the flag from the row, or the requester wants morphology
offered for codes the table does not mark.

## Q: The diagnoses and morphs lookups are not in the contract as shapes — what do they answer?

**Decision taken:** modelled from the service's own DTOs read 2026-08-02 —
`DiagnosisModel { diagnosisCode, diagnosisDescription, genderRestriction, genderRestrictionType,
ageLow, ageHigh, ageRestrictionType, rareRestrictionType, isNeedMorph, isUnacceptedAsPrincipal }`
and `MorphModel { morphCode, morphDescription }` — and both are read through the existing
`unwrapLookup`, so a `{ contractVersion, items }` wrapper and a bare array both work.
**Why:** §1.1 rows 14 and 15 say only "lookup". Reading the service's source is what this wave's
brief asks for in place of inventing a shape.
**Revisit if:** §3.8's wanted clarification freezes a different envelope.

## Q: Both lookups take a `query` parameter — is there a whole-catalogue read?

**Decision taken:** no. Both are typed searches (min 2 characters, 250 ms debounce);
`CoreService.GetDiagnosesAsync` answers `[]` for an empty query and `Take(500)` otherwise.
**Why:** there is no endpoint that lists the ICD catalogue, and a client-side cache of one would be
a fiction. The parameter name `query` is the controller's own.
**Revisit if:** SIS.Api re-models these two the way it re-models the lists.

## Q: What values does the diagnosis **type** dropdown offer?

**Decision taken:** `secondary` and `differential`, spelled from the service's own
`NphiesTypes/DiagnosisTypes.cs`. `principal` is deliberately absent — it is the row's radio.
**Why:** the alternative was fetching the `DiagnosisType` value set through `Nphies/CodeSystem`, which
would be a second guess about a door the contract does not name for it — and an empty answer there
would leave the agent unable to add a diagnosis at all. These three constants were read from source,
which is what the brief asks for.
**Revisit if:** the `DiagnosisType` value set turns out to carry values the service's constants do not.

## Q: Is a duplicate diagnosis code refused?

**Decision taken:** yes, refused in the row ("That diagnosis is already on this request").
**Why:** unlike a duplicate attachment title — which the ticket explicitly protects, because
`sequence` distinguishes two prescriptions — two rows with the same diagnosis code have nothing to
tell them apart and say the same fact twice.
**Revisit if:** an agent needs the same code under two different types.

## Q: What happens to the morphology when the principal moves?

**Decision taken:** `choosePrincipal` clears `morphology` on any row that stops being principal, so
the value leaves with the field that carried it.
**Why:** a morphology on a secondary diagnosis is not a thing the shape means, and it would ride to
the exchange attached to a diagnosis that never required one.
**Revisit if:** the service starts reading a morphology off a non-principal row.

## Q: A file whose MIME the browser cannot type (`''`)?

**Decision taken:** refused as `unsupportedType` — "Attach a JPEG, a PNG or a PDF".
**Why:** the alternative is sniffing the extension, which is a second, weaker source of the one fact
§3.5 says the file itself supplies. Refusing is recoverable in one act; guessing wrong is not.
**Revisit if:** scanners in the field produce untyped files often enough to be a support cost.

## Q: Is there a size cap on images, as there is on PDFs?

**Decision taken:** no. Images are downscaled to 2000 px / q0.85 and whatever that produces is what
is sent; only PDFs are capped, at 5 MB.
**Why:** §3.5 caps PDFs alone, and the downscale is what makes an image's size a non-question.
**Revisit if:** a 200 MP source image is found to stall the canvas on the back-office hardware.

## Q: Submit exists on this form now — does 219 wire the act?

**Decision taken:** **no.** 219 renders the Submit control and its **gate** (disabled while a blocker
holds; each blocker names itself) and leaves the button with no handler. The act — the clinical-edit
check, the 100 s submission and its three outcomes — is 220's, and `authSessionApi` still carries no
`submit`.
**Why:** the ticket's Done-when requires "Submit is disabled while there are no attachments", which is
a statement about the gate. Wiring a partial submit here would put a request on a national exchange
without the gate that is contractually supposed to precede it (§3.5: "before it runs, the client calls
`clinicalEditValidate`").
**Revisit if:** 220 slips — an enabled button with no handler is inert but is not a shipping state.

## Q: Which blockers does this slice's list carry?

**Decision taken:** only its own three — `noPrincipal`, `morphologyMissing`, `noAttachment` —
composed on the page from the two pure modules. The named submit-blockers module, `no items`,
`coverage unpicked` and `provider unpicked` are 220's.
**Why:** 220 says "two of the blockers are its [219's]" and owns the module. Building the module here
would pre-empt a design that has to hold six.
**Revisit if:** 220 would rather extend a module than write one.

## Q: Where do prepared attachments live before submit?

**Decision taken:** in page state on the form, never in the projection, and untouched by `Refresh`.
**Why:** the engine has never heard of them (§1.2: attachments are not a verb), so a state read must
not clear what the agent attached.
**Revisit if:** the abandoned-tab sweep is ever expected to preserve them — it cannot, and law 9 says
it should not.

## Q: The preview is a lightbox, but 217 asserts no modal opens in this flow.

**Decision taken:** an overlay `div` with `role="group"`, not a `<dialog>`; the drive's
"no modal anywhere" assertion is left in place and still passes.
**Why:** the ticket asks for an inline lightbox off the same data URL; the ruling 217 carries is about
dialogs as a *surface for decisions*, which this is not.
**Revisit if:** an accessibility pass wants a real focus trap here.
