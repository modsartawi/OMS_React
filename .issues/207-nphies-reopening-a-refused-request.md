---
type: wayfinder-ticket
wayfinder: research
map: 196
status: done
blocked-by: —
---

# 207 — Reopening a refused request: what can the form be prefilled from?

## Question

[203](203-nphies-screen-shape.md) established what `Failed` means and what the screen owes the agent:
**NPHIES refused the request on validation before the payer ever saw it** — a missing principal
diagnosis, a diagnosis incompatible with the patient's gender — and the remedy is to *fix the
request and submit again*, not to retry it. On the form that is free: the agent never left the page,
so the state is still in the browser.

It is **not** free from the list. A `Failed` row found the next morning offers "open the refusal",
and the agent then has to rebuild a request that already exists — diagnoses, items, encounter
fields, attachments — by hand, unless the server can hand it back. That is the difference between a
minute and a re-keying session, and it is unpriced.

Establish, from source:

1. **What does `auth/AuthResponse/{id}` actually return?** `GetAuthResponse(id)`'s shape is not the
   thin `AuthResponse` DTO used by the submit path (`Features/Auth/Dtos/AuthResponse.cs` carries
   only outcome/disposition/error — no items, no diagnoses).
   [201](201-nphies-rejection-detail.md) established the detail carries per-line verdict data, so it
   returns *something* richer; the question is whether it carries the **request** side —
   diagnoses, encounter fields, item lines as requested — or only the payer's answer.
2. **What is `GET auth/AuthJson/{id}`?** (`AuthController.cs:590`, not among
   [198](198-nphies-proxy-contract.md)'s fifteen.) `NAuthJson.RequestJson` is the stored FHIR bundle
   that `RetryAuth` re-POSTs verbatim — so the request *is* persisted. Whether this endpoint exposes
   it, and whether parsing FHIR back into a form model is work anyone should sign up for, are both
   part of the answer.
3. **Is there a cheaper seam on our side?** The request the web form builds is SIS.Api's own model
   on the way in ([198](198-nphies-proxy-contract.md) owns every translation). Storing that model
   next to the Nphies id — so a reopen reads back what the *browser* sent rather than reconstructing
   it from FHIR — may be cheaper than either of the above. Price it as an option, don't assume it.

The output the map needs is a plain statement of **which of the three paths a "reopen this refused
request" affordance takes, and what it costs** — including "none of them, the agent re-keys it",
if that is what the evidence supports. Feeds [204](204-nphies-the-estimate.md) directly.

Findings as a linked asset under `.issues/assets/196-nphies/`.

## Answer

**Path 3 — SIS.Api's own store — and it is already paid for.** The ticket priced path 3 as the
speculative one ("price it as an option, don't assume it"); it turns out to be the option that
costs nothing, because [208](208-nphies-the-auth-is-an-engine-document.md) put the web on spec
301's orchestration recipe, and that recipe's **write-ahead journal row already carries the whole
request**. `IntegrationAttemptLog.StartAsync` inserts `RequestJson =
JsonConvert.SerializeObject(request)` into `PosIntegrationAttempt` on a fresh connection, committed
*before* the payer is called — so it exists on a refusal, on a rejection, and on a transport
failure alike, in the flat model the form built it in. `StringMaxType`, so
[202](202-nphies-attachments-in-a-browser.md)'s attachments ride inside it. Findable by
`SubmissionReference == authId`, which 301 stamps on **any** response carrying an id, refusals
included. **No new table, no new column, no new write.**

**Path 1 (`auth/AuthResponse/{id}`) is richer than the ticket suspected and is the free fallback**
for rows the web did not raise. It returns `AuthHeaderDto`, not the thin submit DTO — eagerly
fetching `AuthLines` and `AuthSupportingInfos`, and carrying the request side almost completely:
all nine deductible-rate fields, policy, every header flag, per-line quantity / days supply /
selection reason / diagnosis index / deductible group, and attachments as base64. **Two gaps.**
`MaxCoverage` is on `NAuthLine` but **missing from `AuthLineDto`** — and 205 makes it one of the
agent's five inputs, so path 1 alone would drop an override (one property, a Nphies-service change,
priced but not taken). And `NAuthDiagnosis` is **dead code** — entity present, both DTOs commented
out, never written — so diagnoses round-trip as the header `Diagnosis` string plus per-line
`Diagnosis`/`DiagnosisIndex`, and the web owns parsing its own encoding back.

**Path 2 (`auth/AuthJson/{id}`) is dropped as a prefill seam.** It exists, and **WPF already calls
it** — `NphiesAuthListController.cs:487` pipes it straight into a raw-text `NphiesJsonFilesController`
window. It is a support dialog, not a seam; nothing anywhere parses FHIR back into a form. Writing
that parser would be new work no one has done once, to recover a payload we already hold twice in
flat form. Worth ~0.5 day later as a **View JSON** affordance; not v1.

**A reopen is a replay, not a restore.** 208 ruled out resumable drafts and the refused transaction
is terminal `SUBMITTED`, so the affordance opens a **fresh** session and replays the stored request
through verbs that already exist — `ScanAsync`, `ChangeQty`, and 205's header/line setters.
**No new session verb.** And it must not pretend to be silent: an item may since be blocked or
repriced, and a scan that refuses is the information the agent needs, so the screen reports what
did not come back.

**Cost: ~1.5 developer-days** — ~0.5 SIS.Api (read the attempt row by auth id), ~1 web
(`?copyOf=<authId>` on [203](203-nphies-screen-shape.md)'s existing `new` route, the replay loop,
the did-not-come-back reporting). **Zero Nphies-service change, zero new storage.**

🚩 **Corrects [203](203-nphies-screen-shape.md) on what `Failed` means.** 203 had it as "NPHIES
refused on validation before the payer saw it". That is one of *two* sources: the service's own
guards — unknown item (`AuthService.cs:402`), item with no Nphies category (`:514`), unconfigured
provider (`:576`) / payer (`:581`), prescription ref over 40 chars (`:219`) — throw before the POST
and produce an identically-shaped `Failed`. This strengthens 203's "a form state the agent fixes in
place": *these* are more fixable than a diagnosis incompatibility. It also carries a caveat —
lines are built at `:562`, after those guards, so a locally-guarded refusal leaves a **header-only**
row that path 1 cannot prefill. Path 3 covers exactly that case, which is the second reason it wins.

🚩 **One consequence for the list:** `GetAuthResponses` filters `if (!showAll) → Where(c => !c.Error)`
(`AuthService.cs:1377`). **The web list must send `showAll=true`** or refused requests never appear
— and a reopen on a row you cannot see is worth nothing.

[Findings](assets/196-nphies/reopening-a-refused-request.md).

## Comments

**2026-08-01, from [206](206-nphies-does-the-service-check-the-money.md)** — one of this ticket's
three paths is already settled by the service's source (`C:\Work\DMSCO\nphies\Service\NphiesService`):
**`GET auth/AuthJson/{id}` exists** at `AuthController.cs:590`. This ticket is right that it is absent
from [198](198-nphies-proxy-contract.md)'s fifteen, but the endpoint itself is there to proxy — so the
question narrows from "can the request be recovered at all" to "is proxying it cheaper than parsing
`NAuthJson.RequestJson`'s FHIR back, or than SIS.Api keeping its own model".

Also relevant: 206 established the service stores the submitted money verbatim on `NAuthLine`
(`ExtendedPrice`, `Amount`, `MaxCoverage`, `DeductibleG`, `DeductibleGroupName` never reach NPHIES —
they exist only for read-back), so a refused request's *lines* may be recoverable from the ordinary
`auth/AuthResponse/{id}` without touching the stored FHIR at all.
