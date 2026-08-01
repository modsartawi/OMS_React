# Reopening a refused request — what the form can be prefilled from

Findings for [207](../../207-nphies-reopening-a-refused-request.md). Sources read: the Nphies
service on disk (`C:\Work\DMSCO\nphies\Service\NphiesService\`), the WPF client
(`C:\Work\DMSCO\BackOffice\Sartawi.Retail\Nphies\`), and the Till Submission Platform
(`Sartawi.Retail.Data\Modules\Pos\`, BackOffice spec 301).

---

## 0. The framing was slightly wrong, in our favour

The ticket asked "can the request be recovered from the *Nphies service*". Since it was written,
[208](../../208-nphies-the-auth-is-an-engine-document.md) ruled that the web raises an
authorization as a **live engine transaction** on the Till Submission Platform, following spec
301's orchestration recipe. That recipe includes a **write-ahead journal row** carrying the
serialized request. So the cheapest source of "what was requested" is not the Nphies service at
all — it is **our own side, and it is written whether the request succeeds, is refused, or never
reaches the payer.**

Path 3 was the ticket's "price it as an option, don't assume it". It turns out to be the option
that costs nothing, because the storage it needs already exists for a different reason.

---

## 1. Path 1 — `GET auth/AuthResponse/{id}` (already proxied)

`AuthController.cs:534` → `AuthService.GetAuthResponse` (`:1595`) returns **`AuthHeaderDto`**, not
the thin `AuthResponse` submit DTO the ticket suspected. It fetches lines and supporting infos
eagerly:

```csharp
session.Query<NAuth>()
    //.Fetch(c => c.AuthDiagnosis)      // commented out
    .Fetch(c => c.AuthLines)
    .Fetch(c => c.AuthSupportingInfos)
```

**It carries the request side, almost completely.** Comparing `AuthRequest` (what we send) against
`AuthHeaderDto` (what comes back) field by field:

| Group | Round-trips? |
|---|---|
| Patient identity (`PatientId/IdType/Name/Gender/BirthDate`, `MemberId`) | ✅ all |
| Coverage (`PayerCode`, `PolicyNumber/Start/End`, `EligibilityId`, `AuthRef`) | ✅ all |
| Provider + dates (`ProviderCode`, `ServiceDate`) | ✅ |
| The nine deductible-rate fields (`DeductibleG1/2/3` + `Max` + `Paid`) | ✅ all nine |
| Header flags (`ExceptionPrescription`, `Newborn`+weight, `IsMaternity`, `IsReferral`, `IsReferenceToDocument`/`RefDocumentNo`) | ✅ all |
| Header text (`Occupation`, `MaritalStatus`, `PolicyHolder`, `PrescriptionRef`, `Diagnosis`) | ✅ all |
| Lines — `ItemNumber`, `ItemDescription`, `Quantity`, `DaysSupply`, `SelectionReason`, per-line `Diagnosis`/`DiagnosisIndex`, `DeductibleG`, `DeductibleGroupName`, and every money field | ✅ |
| Attachments (`AuthSupportingInfos`: `Category`, `Code`, `Attachment` base64, `AttachmentType`, `AttachmentTitle`, `ValueString/Boolean/Decimal`) | ✅ all |

**What does not come back:**

- **`MaxCoverage` per line.** It is on the entity (`NAuthLine.cs:18`) but **absent from
  `AuthLineDto`**. This is the one gap that matters — [205](../../205-nphies-who-computes-the-money.md)
  makes Max Coverage one of the agent's five inputs (the editable cell writing `MaxPayerShare`).
  Cost to close: one property on `AuthLineDto` — a Nphies-service change, so not free.
- `Episode`, `InvoiceNo`, `ReasonForVisit`, `ReferralDisplay`, `OfflineDateRef`, `UserId`,
  `SourceCode`, `OriginalProviderCode` on the header. Of these, `SourceCode` is the constant
  `'WEB'`, `UserId` is the reopening agent's own session id, `OriginalProviderCode` died with
  claim type 1, and `OfflineDateRef` belongs to claim type 4 — all four are **reconstructible or
  dead** per [200](../../200-nphies-identity-and-context.md)/[199](../../199-nphies-scope-of-acts.md).
  `Episode`, `InvoiceNo` and `ReasonForVisit` are genuinely lost, and none is a v1 form field.
- **`NAuthDiagnosis` is dead code.** The entity exists, its DTO and its request DTO are both
  commented out in full, and `AuthService` never writes one (`grep NAuthDiagnosis` → two commented
  lines). Diagnoses travel as the header `Diagnosis` **string** plus per-line `Diagnosis` /
  `DiagnosisIndex`. Whatever encoding [203](../../203-nphies-screen-shape.md)'s diagnosis rows
  serialize into, it round-trips verbatim — but the web owns parsing its own format back.

**Persistence on failure is guaranteed.** `AuthService.Auth()` wraps everything in
`try/catch/finally`, and the `finally` calls `SaveNAuth(session, nAuthJson, nAuth, nLines,
nSupportingInfos)` unconditionally (`:743-758`). A refused request is fully stored.

⚠ **With one ordering caveat.** Supporting infos are built at `:350`, lines at `:562`, the NPHIES
POST at `:689`. A refusal *from NPHIES* therefore has lines and attachments; a **service-local
guard throw** — unknown item (`:402`), item with no Nphies category (`:514`), unconfigured
provider (`:576`) or payer (`:581`), prescription ref over 40 chars (`:219`) — fires before the
lines are built and leaves a **header-only row**. Path 1 cannot prefill those. This is the same
mechanism as [206](../../206-nphies-does-the-service-check-the-money.md)'s orphan header.

🚩 **Correction of record for [203](../../203-nphies-screen-shape.md).** 203 ruled that `Failed`
means "NPHIES refused on validation before the payer saw it". That is one of two sources — the
service's own guards above produce an identically-shaped `Failed` without NPHIES being involved at
all. This *strengthens* 203's ruling that `Failed` is a form state the agent fixes in place:
"item X doesn't exist" and "provider not configured" are more fixable in the form than a diagnosis
incompatibility is.

---

## 2. Path 2 — `GET auth/AuthJson/{id}` (exists; not a prefill seam)

`AuthController.cs:590` → `GetAuthJson` (`:1643`) returns a `JsonFileDto` of two raw strings:
`NAuthJson.RequestJson` (the FHIR bundle `RetryAuth` re-POSTs verbatim) and `LastResponseJson`.

**WPF already calls it, and shows it in a text viewer.**
`NphiesAuthListController.cs:487` and `NphiesAuthLineListController.cs:435` both do:

```csharp
var json = NphiesService.AuthJson(SelectedItem.Id);
new NphiesJsonFilesController { Request = json.Request, Response = json.Response, ... }.Show();
```

That is a **support/diagnostic dialog** — raw FHIR in a window — not a prefill. There is no
consumer anywhere in WPF that parses it back into a form (`grep -i "reopen|resubmit|CopyAuth"`
across `Sartawi.POS\Nphies\` → nothing; **WPF has no reopen affordance at all**).

Writing a FHIR-bundle → form-model parser to serve a reopen would be **new work no one has done
once**, to recover a payload we already hold twice in flat form. Dropped as a prefill seam. It is
worth ~half a day as a **View JSON** support affordance on the detail screen (one proxied
endpoint, one `<pre>`), and that is a v1+ nicety, not a v1 line item.

---

## 3. Path 3 — our own store, which already exists

Spec 301 §Solution step 4: before the payer POST, the orchestration does a **write-ahead**

```csharp
StartAsync(IntegrationTypes.NphiesAuthRequest, reference, request, storeCode, operatorId)
```

and `IntegrationAttemptLog.StartAsync` (`Repositories/IntegrationAttemptLog.cs:41`) inserts:

```sql
INSERT INTO PosIntegrationAttempt
    (AttemptId, IntegrationType, TransactionReference, StoreCode, OperatorId,
     CreatedAt, RequestJson, Status)
```

with `RequestJson = JsonConvert.SerializeObject(request)` — **the whole outbound auth request, in
the flat model we built it in** — on a fresh connection committed *before* the partner is called.
`RequestJson` is mapped `StringMaxType` (`IntegrationAttemptMap.cs`), so size is not a constraint;
[202](../../202-nphies-attachments-in-a-browser.md)'s downscaled attachments ride inside it.

The row is findable: `PosIntegrationAttempt.TransactionReference` → the engine transaction, whose
`SubmissionReference` is stamped with the Nphies authorization id by `MarkSubmittedAsync(authId)`
on any response that returns one — and per 301 that includes **rejected and refused** verdicts
("Lodged = SUBMITTED whatever the verdict"). The service sets `eResponse.Id` before its `try`
(`AuthService.cs:121`), so even a locally-guarded throw returns an id.

So path 3 covers **exactly the cases path 1 loses**: header-only refusals, and `MaxCoverage`.
And it needs **no new table, no new column, and no new write** — provided SIS.Api follows 301's
recipe, which it should anyway, because the audit trail is the owner's stated motivation for the
whole platform and [208](../../208-nphies-the-auth-is-an-engine-document.md) already committed
the web to it.

One note: `IntegrationAttemptLog.PublishAttemptAsync` deliberately **skips** the HQ sync mirror
when there is no `PosEnvironment.Device.StoreId`, calling out "HQ-side call-center / **Nphies**
flows — is not a sync context". A web-raised auth writes its journal row in the server database
directly, so there is nothing to mirror and nothing to wait for; the read is local.

---

## 4. What a reopen actually does

Not "restore a draft" — [208](../../208-nphies-the-auth-is-an-engine-document.md) ruled **no
resumable drafts**, and the refused transaction is terminal `SUBMITTED`. A reopen **opens a fresh
Nphies engine session and replays the stored request through the verbs that already exist**:
`ScanAsync` per item, `ChangeQty`, then the header rate / paid-outside setters and the three line
setters (Max Coverage, Selection Reason, Days Supply) that 205 added. **No new session verb.**

Replay is not a silent restore, and must not pretend to be: an item may since have been blocked,
delisted, or repriced, and a scan that refuses is exactly the information the agent needs. The
screen reports what did not come back and lets the agent fix it — which is the same affordance
`Failed` already requires.

## 5. Cost

| | |
|---|---|
| SIS.Api — read the attempt row by auth id, return the stored request | **~0.5 day** |
| Web — `?copyOf=<authId>` on the existing `/nphies/authorizations/new` route ([203](../../203-nphies-screen-shape.md)'s seam, one more param), replay loop, "these lines did not come back" reporting | **~1 day** |
| Write-ahead journal row | **0** — already required by 301 |
| Nphies-service change | **0** |
| **Total** | **~1.5 developer-days, no new storage, no new endpoint on the Nphies side** |

Optional, not in v1: `MaxCoverage` on `AuthLineDto` (~0.25 day, Nphies service) — only needed if
we ever prefill from path 1 rather than path 3; a **View JSON** support dialog (~0.5 day).

## 6. One consequence for the list

`GetAuthResponses` filters `if (!showAll) query = query.Where(c => !c.Error)`
(`AuthService.cs:1377`), and `showAll` is a query parameter on `GET auth/AuthResponses`. **The web
list must send `showAll=true` or refused requests are invisible** — and a reopen affordance on a
row you cannot see is worth nothing. This is a one-line consequence for
[203](../../203-nphies-screen-shape.md)'s list, not a cost.
