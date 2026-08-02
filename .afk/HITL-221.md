# HITL log — ticket 221 (reopening replays and reports)

Unattended run. Every decision below is the most conservative reading of the ticket, spec 209 and
the frozen contract v1.0 that I could take without inventing a server shape.

## Q: The contract names `GET Nphies/AuthRequestJournal/{authId}` (§3.9) and what it reads — `PosIntegrationAttempt.RequestJson` — but freezes **no response shape** for it. What does the browser receive?

**Decision taken:** The service's own `AuthRequest`, camel-cased by the envelope like every other
passthrough. Field names read from
`C:\Work\DMSCO\nphies\Service\NphiesService\NphiesService\Features\Auth\Dtos\AuthRequest.cs`,
`AuthItemRequest.cs` and `AuthSupportingInfoRequest.cs` (read 2026-08-02) and declared in
`core/models/nphies.ts` as `AuthRequestJournal` / `AuthJournalItem` / `AuthJournalSupportingInfo`,
each citing its file. Declared narrower than the DTO, the way every other model in that file is.
**Why:** §3.9 says the endpoint reads `RequestJson`, and `RequestJson` is
`SerializeObject(request)` of exactly that `AuthRequest` — so the stored shape *is* the answer.
Designing a friendlier "reopen DTO" would be the one thing the wave's brief forbids: a screen built
against a guessed shape fails silently on the fields that were guessed.
**Revisit if:** BackOffice's half of this slice projects the row instead of forwarding it, in which
case this is an additive §8 revision naming the projection.

## Q: §3.5's attachments ride **inside** the journal row (§3.9 says so explicitly). Should the replay restore them?

**Decision taken:** **No.** They are counted and **reported** as not carried across
(`attachmentsNotReplayed`), with the sentence telling the agent to attach them again and why
(Submit is refused without at least one).
**Why:** the journal stores `AttachmentType` as `image` | `pdf` — a two-valued flag, not a MIME type
(`ProcessAddAuthRequest.cs:216`, `Extensions.cs:725`, the same trap 216 logged). §3.5's submit body
takes a real `contentType` derived from the file's own MIME. Rebuilding one from `image` would mean
choosing a MIME nobody recorded and sending it to a national exchange. Reporting the gap is the
ticket's own rule — *what did not come back is named* — and is strictly better than a silent
`image/jpeg`.
**Revisit if:** the journal row is ever extended to carry the original `ContentType`, or §3.5 pins
one MIME per `attachmentType`.

## Q: The header diagnoses round-trip as `AuthRequest.Diagnosis`, a string. What is the encoding, and what is lost?

**Decision taken:** Parsed as `type|code` rows joined by `,`, in `decodeDiagnoses`. Not guessed:
`ProcessAddAuthRequest.cs:266` writes `string.Join(',', … $"{c.Type}|{c.Code}")` and
`Models/NphiesDiagnosis.cs`'s `GetDiagnosisList` reads it back, taking column **0** as the type and
column **1** as the code. The **description is not in the encoding**, so it comes back empty and the
screen renders the code. A row that is not a `type|code` pair is dropped and **reported**
(`diagnosisUnreadable`).
**Why:** §3.4 says `NAuthDiagnosis` is dead code upstream and "the client owns parsing its own
encoding back", so this parse is the contract's instruction. Filling the description from the
diagnosis lookup would be this client asserting a mapping the request never carried.
**Revisit if:** `NAuthDiagnosis` is revived server-side and diagnoses round-trip as rows.

## Q: The morphology code — where is it in the journal?

**Decision taken:** The supporting info whose `category` is `morphology`, read from its **`code`**
field, attached to the principal diagnosis. `Extensions.cs:705-710` reads `nInfo.Code` against the
`Morphology` value set; `ClaimInformationCategoryConstants.Morphology` is the literal `"morphology"`.
**Why:** read from the source, like everything else here. `valueString` would have been the natural
guess and is wrong.

## Q: The URL. The form route already takes `?from=&coverage=`. Does a reopen carry those too?

**Decision taken:** `?copyOf=<authId>` **alone**. On a reopen the eligibility id and the member id
come from the journal row, not from the URL.
**Why:** spec 209 §1 freezes the reopen seam as `?copyOf=<authId>`. A URL that also carried the two
ids could disagree with what was actually submitted about which policy the request was raised under
— and `memberId` **is** the policy choice (§2). One source, and it is the record of the submission.
**Revisit if:** a reopen ever needs to be re-pointed at a different coverage, which would be a new
act, not a longer URL.

## Q: `row-acts` had a `reopenNotWiredYet` withheld reason, rendered by 215 as an inert button. What happens to it?

**Decision taken:** Removed — both the reason and its i18n key — and `openRefusal` is now **offered**
on `Failed` and withheld as `notRefused` everywhere else. 215's test that asserted the inert state is
rewritten to assert the live one.
**Why:** 215 wrote the reason precisely so 221 would make it live, and it says so in its own doc
comment. Leaving a dead value in the union would be a reason no row can ever carry.

## Q: The detail page (216) is "what the agent reads before deciding to reopen". Should the act be there too, or only on the list row?

**Decision taken:** Both. The detail's failure block now carries the same link, with a hint saying the
source authorization is not changed.
**Why:** the ticket's blocked-by note names 216 as the screen the decision is made on. Sending an
agent back to the grid to find the row again would be the screen forgetting why they opened the
detail. It is the same route and the same act — no second code path.
**Revisit if:** a reviewer reads the ticket's "the affordance on a `Failed` row that 215 rendered" as
list-only.

## Q: What counts as "did not come back", and how is it decided?

**Decision taken:** The report is built by comparing the **plan against the engine's own state**
after the replay, never by counting successful verbs. Kinds: `refused` (the door's own sentence),
`missing`, `repriced`, `recategorised`, `quantityDiffers`, `capNotApplied`, `metaNotApplied`,
`notPricedYet`, plus the plan's own gaps. The replay ends with a `State` read so the money has
settled before the comparison.
**Why:** a verb that answered `200` and landed a line at a new price is exactly the case a
success-counting replay would call clean — and it is the case that has the agent resubmit a quietly
different request (story 84). `notPricedYet` exists for the same reason: reading an unsettled price
as "unchanged" is a silent restore by another route.

## Q: A cap of 0 in the journal — re-send it?

**Decision taken:** No. `updateLineInsurance` is only sent when `maxCoverage > 0`.
**Why:** §4 — SIS.Pos ignores `<= 0` in `UpdateLineInsuranceInternalAsync`, so the value would not
apply. The client refuses to send one everywhere else on this form (218's `maxCoverageEntry`), and a
replay is not a licence to send what an agent may not.

## Q: A refusal mid-replay — stop, or carry on?

**Decision taken:** Carry on to the next line, keeping the refusal.
**Why:** the agent needs the whole picture of what changed, not the first thing that did. Stopping at
the first blocked item would hide the reprice on the line after it.

## Q: `tools/nphies-authorization-session-drive.mjs` was **already red at HEAD** — scenario 27's `getByRole('checkbox').check()` fails with "Clicking the checkbox did not change its state". Fix it, or leave it?

**Decision taken:** Fixed, as a one-line harness change: `.click()` plus a wait, instead of
`.check()`. Verified red at HEAD (stashed this ticket's work and re-ran) and green after.
**Why:** the box is **controlled by the engine's state**, so it does not flip until `setHeader`
answers; Playwright's `check()` asserts the new state before the round trip lands. Nothing about the
product changed, and the assertion that follows — which reads the verb's body — is what was always
doing the verifying. Leaving the drive red would have made this ticket's own flow bullet unverifiable.
**Revisit if:** the same pattern appears elsewhere; it is a drive idiom, not a one-off.

## Q: SIS.Api is down and `Nphies/AuthRequestJournal` does not exist. Ship or block?

**Decision taken:** Shipped code-complete, verified against stubbed envelopes built from the
contract's and the service's own shapes — the same posture 210–220 shipped under. The drive's stub
serves the journal row, a refused list row (visible only because the list sends `showAll=true`), and
a header-only variant.
**Why:** the wave's standing instruction. No endpoint on this door is live during this run.
