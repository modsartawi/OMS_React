# HITL — ticket 216 (the detail shows the payer's reason per line, in words)

Unattended run, 2026-08-02. Every decision below was taken conservatively against the frozen
contract `.issues/assets/209-nphies-contract/CONTRACT.md` v1.0 and, where the contract was silent,
against the **Nphies service's own source** (`C:\Work\DMSCO\nphies\Service\NphiesService`) and the
**parallel SIS.Api slice** (BackOffice
[916](C:\Work\DMSCO\BackOffice\.issues\916-nphies-auth-reads-and-acts.md), which is `done` and whose
`NphiesAuthHeaderDto` / `NphiesAuthLineDto` / `NphiesAuthSupportingInfoDto` were on disk and readable
during this run). SIS.Api itself is down — expected, and the screen is driven against stubbed
envelopes built from those DTOs.

## Q: Which DTO is authoritative for the detail's field names — the Nphies service's `AuthHeaderDto` or SIS.Api's `NphiesAuthHeaderDto`?

**Decision taken:** **SIS.Api's** `NphiesAuthHeaderDto`
(`Sartawi.Retail.Data\Modules\Nphies\Services\Models\AuthView\`), read field by field.
**Why:** it is what the browser actually receives — `NphiesEndpoints.cs:249` answers
`service.AuthResponseForWeb(id)`. It is a near-copy of the upstream DTO; the two differences that
matter are that it **adds** `contractVersion` (law 10) and that its line DTO carries a WPF-leftover
`selected` the client ignores. Every name the client declares appears on both.
**Revisit if:** §8 revises the detail's shape, or 922's fixtures serialize something different.

## Q: The detail carries no `isDispensed`. Does the detail render the dispensed marker?

**Decision taken:** **No.** The detail renders the **payer-query** marker only.
**Why:** `IsDispensed` is on `AuthForListDto` (the list row) and is **absent from
`AuthHeaderDto`/`NphiesAuthHeaderDto`**. §5 calls it a fact owned by the till; a detail that showed
one would have to source it from a field the endpoint does not answer with — the exact failure this
wave warns hardest against. `NeedComm` **is** on the header DTO, so the payer-query marker is real
here and it is the one that stalls the row on the web.
**Revisit if:** SIS.Api projects `isDispensed` onto the detail (an additive §8 revision).

## Q: Are header `Disposition` / `ProcessNote` gated on `Request == Complete`, the way the dual-meaning field is?

**Decision taken:** **No gate — rendered whenever they are non-empty.**
**Why:** §5's rule is about `ErrorMessageShort` and only about it, because that one field carries
*either* a transport error *or* the decoded adjudication display. `Disposition` and `ProcessNote` are
single-meaning: they are the payer's own words and exist only when the payer answered. The ticket's
wording is "the payer's disposition and process note, **when they sent them**" — presence, not
state. (The sibling eligibility `CheckResult` does gate its disposition on `complete`; that is a
different DTO and a harmless extra condition there, not a rule this ticket inherits.)
**Revisit if:** a `Failed` authorization is ever observed carrying a `Disposition` sourced from the
transport layer rather than the payer.

## Q: A line's `AdjudicationOutcome` — is it blank until the **header's** Request is `Complete`?

**Decision taken:** **Yes.** `projectAuthLines` blanks every line verdict unless
`deriveAuthAxes(detail).request === 'complete'`.
**Why:** §5's blank-until-Complete rule is about *"a request that never reached the payer has no
verdict to report"*, and a line of such a request reached the payer exactly as little as its header
did. `ProcessAuthResponse` writes both from the same response, so a stale line outcome on a `Failed`
header is the same lie the list's blank verdict cell exists to prevent — one axis, one rule, applied
at both altitudes.
**Revisit if:** the contract ever states a per-line Request axis distinct from the header's.

## Q: `attachmentType` is not a MIME type. What content type does the detail render an attachment as?

**Decision taken:** the service's **own** mapping, mirrored exactly — `"image"` → `image/jpeg`,
anything else → `application/pdf` — with one hedge: a value that already contains a `/` is passed
through verbatim as the MIME it plainly is.
**Why:** ⚠️ **This is a genuine contract gap.** §3.5 says the submit body carries
`contentType: "image/jpeg"`, but the field that comes **back** on
`AuthSupportingInfoDto`/`NphiesAuthSupportingInfoDto` is `attachmentType`, and both
`ProcessAddAuthRequest.cs:216` (`ContentType.StartsWith("image") ? "image" : "pdf"`) and
`Extensions.cs:725` (`AttachmentType == "image" ? "image/jpeg" : "application/pdf"`) treat it as a
**two-valued** flag. Reproducing the service's own coercion is the only reading that renders what
the payer was actually sent; inventing a MIME would be worse, and refusing to render would drop a
whole ticket bullet. The `/` hedge exists because §3.5's wording means SIS.Api may yet forward a
real MIME once 920 lands.
**Revisit if:** §8 reconciles §3.5's `contentType` with the DTO's `attachmentType` — the naming gap
is named here so the revision has something to cite.

## Q: What identifies an attachment among the supporting infos?

**Decision taken:** a **non-empty `attachment`** (the base64), not `category === 'attachment'`.
**Why:** the supporting-info collection also carries `days-supply`, `reason-for-visit` and
`morphology` rows, none of which has base64. Filtering on the payload is filtering on the fact that
matters; filtering on the category string would depend on a spelling
(`ClaimInformationCategoryConstants.Attachment == "attachment"`) that the contract does not freeze.
**Revisit if:** a non-attachment supporting info is ever written with base64 in that column.

## Q: How is the detail opened, given 214 shipped no link to it?

**Decision taken:** an **Open** column on the authorization list, a real `<Link>` to
`/nphies/authorizations/{id}`, mirroring the eligibility list's own first column exactly.
**Why:** the ticket's Blocked-by says *"the detail is opened from the list"* and spec 209 story 9's
reasoning for the eligibility detail (right-clickable, copyable, middle-clickable — a row-click
handler is none of those) applies unchanged. Mirroring the sibling screen also means an agent learns
one gesture.
**Revisit if:** the two lists ever diverge on how a row is opened.

## Q: Money on the detail — is rendering per-line amounts a law-1 violation?

**Decision taken:** rendered, **display-only**, with **no total, no sum and no derived figure
anywhere** — every number on the screen is a field the server sent, formatted to 2dp.
**Why:** law 1 forbids the client *sending* money and forbids it *computing* the engine's numbers.
"Amounts are one-way: engine → client, **display only**" is the law's own sentence, and §3.4 lists
`Rejected`, `Benefit` and `Copay` as things the detail carries. A per-line rejected amount an agent
cannot see is the rejection they cannot explain to a patient.
**Revisit if:** a reviewer reads any figure on this screen as computed rather than echoed — there is
deliberately no `reduce`, no `+` and no `toFixed` on anything but a single server field.

## Q: The unknown-id path — 916 says the door answers `AUTH_NOT_FOUND`. What does the screen do?

**Decision taken:** the ordinary `ErrorBanner` with `apiErrorMessage(err, …)` — the server's own
sentence, no special-casing on the code.
**Why:** §6 kind 2 says a guardrail refusal renders its **server-supplied** message as data; the
client branches on `apiErrorCode` only when it must *behave* differently, and here it does not.
916's own note is that the danger was a **blank** detail from the upstream's 204, which
`AuthResponseForWeb` already closed server-side.
**Revisit if:** the screen ever needs to offer an act on a not-found (it does not — there is nothing
to act on).
