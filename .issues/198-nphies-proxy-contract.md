---
type: wayfinder-ticket
wayfinder: grilling
map: 196
status: done
blocked-by: —
---

# 198 — The shape of the SIS.Api passthrough

## Question

It is settled that the browser reaches the Nphies service **through SIS.Api** rather than directly,
so [api-envelope](../.claude/rules/api-envelope.md) holds and the screens get session auth and the
standard 401 handling for free. What is *not* settled is the shape of that passthrough. Decide:

1. **Transparent proxy or re-modelled endpoints?** Either SIS.Api forwards `Nphies/*` verbatim and
   wraps the reply in `HttpGeneralResponse<T>`, or it exposes purpose-built endpoints that speak the
   web screens' language. Transparent is cheaper and keeps the two teams decoupled; re-modelled lets
   SIS.Api own paging, filtering and the store guard. The Nphies service's own list endpoints take a
   flat query string and return an unbounded `List<T>` with **no paging** — that alone may force the
   answer, given [ticket 148](148-ua-users-pager.md) established that this app pages at 50.

2. **Which endpoints, minimally?** From `NphiesService.cs`, the in-scope set is roughly:
   `Eligibility/CheckEligibility`, `Eligibility/LastEligibility/{id}`,
   `eligibility/EligibilityResponses`, `eligibility/EligibilityResponse/{id}`, `Auth/Auth`,
   `auth/AuthResponses`, `auth/AuthResponse/{id}`, `Auth/StatusCheck`, `auth/ClinicalEditValidate`,
   `core/payers`, `core/providers`, `core/codeSystem`, `core/diagnoses`, `core/morphs`. Confirm the
   list against what [199](199-nphies-scope-of-acts.md) rules in, and name any that are *not*
   proxied.

3. **Who chooses the environment?** WPF picks the backend URL off `POSCommon.NphiesEnvironment`
   (dev `localhost:5000` / staging `172.23.27.40:8077` / prod `172.23.27.40:8065`) — a **client**
   decision today. Under a proxy it becomes server configuration. Confirm that is acceptable and
   that a web tester can still reach staging.

4. **Error taxonomy.** The Nphies service returns a bare body on failure and `NphiesService` turns
   every one into `throw new Exception("Error !" + body)`. Several responses instead return HTTP 200
   with `Success == false` and an `ErrorMessage` (`NphiesAuthResponse`, `NphiesRetryResponse`,
   `NphiesCheckStatusResponse`). Both must land as **business** outcomes with a readable message
   under `apiErrorMessage`, not as `unknown`. Decide where the translation happens — SIS.Api or the
   feature's `api.ts`.

5. **Timeouts.** `Auth/Auth` is a synchronous call to a national exchange; the WPF client leaves it
   on the default 100 s (only the PBM call is capped, at 60 s, with a comment explaining why). A
   browser tab holding a 100-second POST needs a deliberate answer — proxy timeout, and what the
   screen shows while it waits.

6. **Cost.** Name roughly how much SIS.Api work this is, in the same units as the rest of the
   estimate. It is a term in the final figure, not a free precondition.

## Answer

**The passthrough is not greenfield — it is half-built, and the Nphies service's own source is on
disk.** Two findings reframe the whole ticket:

- SIS.Api already ships `Endpoints/Insurance/Nphies/NphiesEndpoints.cs` with one live
  `POST Nphies/CheckEligibility`, going through `NphiesHttpService`
  (`Sartawi.Retail.Data/Modules/Nphies/Services/NpihesHttpService.cs`). The module is registered
  (`AddApplication` → `AddNphiesApplication`, `ApplicationServiceCollectionExtensions.cs:157`), has a
  named `HttpClient` bound to `configuration["Nphies:BaseUrl"]`, an `HttpLogService` audit wrapper,
  and server-side models already ported for eligibility, auth-request, auth-view, list, cancellation
  and link-auth.
- The Nphies service source is at `C:\Work\DMSCO\nphies\Service\NphiesService\` — 8 controllers,
  ~60 endpoints. Its behaviour is now readable rather than inferred.

### 1. Shape — split by kind, and the lists force it

- **Acts and lookups pass through** as near-transparent typed calls wrapped in
  `HttpGeneralResponse<T>`. The request shape *is* the Nphies contract; re-modelling it buys only
  drift. The existing `CheckEligibility` endpoint is the template.
- **The two list endpoints are re-modelled in SIS.Api**, which owns sort, page and total itself.
  Forced by the source: `GetAuthResponses` ends `query.Take(20000).ToList()` with the
  `OrderByDescending` **commented out** (`Features/Auth/AuthService.cs:1479`) — no paging, no
  ordering, no count. An unordered 20 000-row list cannot reach a grid that pages at 50
  ([148](148-ua-users-pager.md)), and adding paging upstream is a cross-team change on the Nphies
  team's release train.
- **Accepted consequence:** SIS.Api holds up to 20 000 rows in memory per list call and pages
  in-process. Fine for a back-office screen filtered by provider + payer + date range; it is a real
  ceiling and the one place the "cheap passthrough" story breaks.

### 2. Endpoints — 14 proxied, plus a rule

*Acts:* `Eligibility/CheckEligibility` · `Auth/Auth` · `Auth/StatusCheck` ·
`Auth/ClinicalEditValidate` · `auth/Cancellation`
*Details by id:* `eligibility/EligibilityResponse/{id}` · `Eligibility/LastEligibility/{patientId}` ·
`auth/AuthResponse/{id}`
*Lists (re-modelled):* `eligibility/EligibilityResponses` · `auth/AuthResponses`
*Lookups:* `core/payers` · `core/providers` · `core/codeSystem` · `core/diagnoses` · `core/morphs`

**The rule for anything added later:** acts and lookups pass through, lists get re-modelled,
dispensing never crosses.

**Not proxied, decided here:**

- `auth/Dispense` — stays in the store; it involves real physical item scanning.
- `PaymentController` (whole) and `Auth/Claim` — **not ported at all**.
- `Auth/AuthResponses2` / `AuthResponses3` / `AuthLineResponses` — later generations of the same
  list; **one list only**. (`AuthResponses3` also hard-rejects a missing date range with a
  bare-string 400.)
- `hidp/Hidp` — **obsolete, will not be ported.** This closes the map's HIDP fog item permanently.
- `Auth/UploadAuthRequest` and its `[FromForm]` siblings — a special case never needed on the web.

**Attachments need no multipart.** They ride as a base64 string in
`AuthSupportingInfoRequest.Attachment` inside the `Auth/Auth` JSON body
(`Features/Auth/Dtos/AuthSupportingInfoRequest.cs:14`). So **the entire proxy surface is JSON in,
JSON out** — the one shape that didn't fit the envelope is gone, and [202](202-nphies-attachments-in-a-browser.md)
loses nothing by dropping the upload endpoints.

The endpoint set is closed for the acts we know; it stays open on one hinge —
[199](199-nphies-scope-of-acts.md) ruling claims or the Bahrain / BUPA-SABIC variants in would grow
both the endpoint count and the model surface.

### 3. Environment — server-side only, and a staging deployment is coming

`NphiesServiceCollectionExtensions.cs` already binds the client to `configuration["Nphies:BaseUrl"]`
at startup: this is **already server configuration**, and WPF's client-side
`POSCommon.NphiesEnvironment` switch gets no web counterpart. A browser must never name which
national exchange it talks to — no selector, no header, no per-request override. One Nphies backend
per SIS.Api deployment.

**Gap to close (a line item in the cost):** `Nphies:BaseUrl` exists only in the *deployed*
`appsettings.json`, pointing at production `http://172.23.27.40:8065/`. It is **absent from source**,
so a fresh clone hits `new Uri(null)` at startup. It goes into source `appsettings.json` and
`appsettings.Development.json`.

**A staging SIS.Api environment is planned** (requester's own commitment) and gets
`Nphies:BaseUrl = http://172.23.27.40:8077/`. Until it exists, a tester runs SIS.Api locally —
oms-react's dev proxy already points at `localhost:5111` (`vite.config.ts:73`). Without this, QA on a
shared environment would be submitting to the **live national exchange**.

### 4. Error taxonomy — SIS.Api owns all of it; and it is three-way, not two

The ticket assumed `Success == false` conflates payer rejection with failure. It does not:
`Success` is set from `nAuth.Error` (`AuthService.cs:734-739`) — a transport/processing failure. A
payer *rejection* returns `Success = true` with the verdict in `AdjudicationOutcome` / `Outcome` /
`Disposition` / `ProcessNote`.

| Nphies service says | oms-react sees | Why |
|---|---|---|
| `Success = true`, `AdjudicationOutcome` rejected/partial | **success envelope, data** | A payer saying no is the screen's *content*. It renders; it does not toast. [201](201-nphies-rejection-detail.md) owns how. |
| `Success = false` + `ErrorMessage` (HTTP 200) | **`business`** — `DomainException` + code | The submission genuinely failed; `ErrorMessage` is readable via `apiErrorMessage`. |
| bare-string 400 (lock collision, date range, claim block) | **`business`** — `DomainException` + code | "A request for this record is already processing." is actionable. |
| 500 / unreachable | **`server`** / `network` | Already handled by `core/api.ts`. |

**Translation happens in SIS.Api (`NphiesHttpService`), never in the feature's `api.ts`.** Forced:
`EndpointHelpers.ExecuteAsync` maps **only** `DomainException` to a `success:false` envelope and
rethrows everything else into a 500 — a client-side translation would be re-labelling something that
already arrived as `unknown`. It also keeps [api-envelope](../.claude/rules/api-envelope.md) honest,
and the WPF client inherits the same fix. Concretely: today's
`throw new Exception("Error !" + body)` becomes a `DomainException` carrying the body as `Message`
plus a machine `ErrorCode`, and every act checks `Success` before returning.

**Accepted brittleness:** the lock-collision 400 is an untyped English string, so giving it a
machine code (`ALREADY_PROCESSING`) requires **string-matching** in SIS.Api, which breaks silently if
the Nphies team rewords it. Accepted deliberately — the alternative is an uncoded message the screen
cannot offer a targeted Retry against.

### 5. Timeout — explicit 100 s, synchronous, and a timeout means *in flight*

Nothing sets a timeout today: the named client configures only `Accept` and `BaseAddress`, and
SIS.Api's `ConfigureHttpClientDefaults` block is commented out (`Extensions/Extensions.cs:19`) — so
it inherits `HttpClient`'s default 100 s, the same figure WPF lives with.

- Set `c.Timeout` **explicitly** on the Nphies named client so the number is a decision in source.
  100 s for the acts.
- **A timeout is never an error toast.** `SaveNAuth` runs in the method's `finally`
  (`AuthService.cs:758`), *after* the exchange round-trip, and the service takes no
  `CancellationToken` — so if the proxy gives up, **the submission keeps running and still
  persists**. The row appears in the list when the exchange returns, not when we disconnected.
  Telling the agent "it failed" invites a resubmit that duplicates or collides.
- The screen says the authorization is **in flight** and sends the agent to the list, where
  `Auth/StatusCheck` and the row are the source of truth. The submit button is **disabled and the
  form locked** while waiting — our own guard, not only the Nphies service's.
- The service's lock on `Auth_{ClaimType}{PatientId}` (released in the controller's `finally`) means
  an immediate resubmit gets the collision 400. That is protection against double-submitting to a
  national exchange, not a bug.

**Synchronous for v1.** The honest alternative — SIS.Api returns an id immediately and the screen
polls — is a materially bigger build, and the Nphies service offers no async submit to lean on (its
`Poll` machinery is internal to its own retry workers). The map's freshness fog item may revisit it.

**Risk, named not hidden:** if SIS.Api sits behind IIS or any reverse proxy in production, that
proxy's idle timeout can cut the connection well before 100 s. Must be checked on the actual
deployment.

**Constraint on the port (requester):** the SIS.Api-side code is **async all the way down — no
sync-over-async**. WPF's `NphiesService.cs` blocks on `.Result` / `.GetAwaiter().GetResult()`
throughout; that pattern does not come across, even though the Nphies service's own controllers are
synchronous. `NphiesHttpService` is already `async Task` and stays that way.

### 6. Cost — 5–7 developer-days, owned by the SIS.Api team

| Part | Days | Why that size |
|---|---|---|
| Config: `Nphies:BaseUrl` into source + Development + staging `:8077`, explicit timeout | 0.25 | Lines, not design |
| Model gaps | 1 | Auth-request, auth-view, list, cancellation, eligibility, link-auth models **already exist**; missing are status-check, clinical-edit, the five `core/*` lookups, eligibility-list DTO |
| `NphiesHttpService` → 14 endpoints, async, `HttpLogService` audit on the acts | 1.5 | 3 methods today; the rest are the same shape |
| Error translation: `DomainException` helper + collision string-match + 14 call sites | 0.5 | One helper, mechanical after |
| 14 minimal-API endpoints + `NphiesGrantEndpointFilter` | 1 | `NphiesEndpoints.cs` has one endpoint as template |
| List re-modelling: sort + page + total over the unordered `Take(20000)`, twice | 1 | The only genuinely new logic here |
| Testing against staging `:8077` | 1 | Needs the planned staging environment |

**Headline for [204](204-nphies-the-estimate.md): the proxy is the cheap term.** It is
skeleton-extension, not a build — client, DI registration, audit wrapper, envelope helper and most
models already exist, and the endpoint list is 14 near-identical handlers with exactly one piece of
real logic.

**Auth filter shape is settled by precedent**, not by this ticket: every oms-react-facing endpoint
uses `ApiKeyEndpointFilter` **plus** a per-feature grant filter deriving from
`OmsGrantEndpointFilterBase` (`BbyInquiryGrantEndpointFilter`, `PricingCacheGrantEndpointFilter`,
`UaUsersGrantEndpointFilter`). A `NphiesGrantEndpointFilter` is that shape; *which* grant it checks
is [200](200-nphies-identity-and-context.md)'s call. Note the existing `Nphies/CheckEligibility` has
the API key but **no grant filter** — it needs one.

**Excluded from the figure:** the pricing/deductible endpoint
([197](197-nphies-pricing-machinery.md) / [205](205-nphies-who-computes-the-money.md)), a different
and larger term; deciding which grant gates the screen ([200](200-nphies-identity-and-context.md));
and all oms-react client work.

**What would move it:** [199](199-nphies-scope-of-acts.md) ruling claims or the Bahrain /
BUPA-SABIC variants in grows both the endpoint count and the model surface — the variants fork
request-building, and that lands on this table.

## Comments

**2026-07-31 — [199](199-nphies-scope-of-acts.md) settled the hinge; the count is now fifteen.**
The variants all went out or later (Bahrain and Vitality out of scope, claim types 2/4/6 later,
claims never), so the model surface does **not** grow. One endpoint is added: **`Auth/Retry`**, ruled
into v1 as the paired half of this ticket's timeout story — a transport failure gets resent without
rebuilding the request. `Auth/HasFollowUp`, `auth/Communications/{id}`, `POST auth/Communication` and
`Auth/UpdateAuthFromEligibility` stay **unproxied**: follow-up and the payer communication loop are
post-v1. The day figure is unchanged — one more handler of the same shape.

**2026-07-31, from [200](200-nphies-identity-and-context.md) — what SIS.Api stamps rather than
passes through.** The grant policy is decided: **one** `NphiesGrantEndpointFilter` applied uniformly
to all fifteen endpoints, no read/write or per-audience matrix — the cheapest shape, already inside
this ticket's 5-7 days. The existing `Nphies/CheckEligibility` (`NphiesEndpoints.cs:28-30`), which
ships today with the API key and **no grant filter at all**, is included.

Four values are **server-stamped and must not be trusted from the body**, which slightly narrows the
passthrough this ticket called "JSON in / JSON out":

- `distributionChannel` - the constant `"20"` (`"21"` is Bahrain, out of scope). Never sent.
- `UserId` / `StaffId` - from `GetUserAction()`; `UaSessionEndpointFilter` stamps both claims from
  `session.UserId`, so no mapping is needed.
- `SourceCode` - the constant `'WEB'`. Worth confirming the column takes three characters:
  `NAuthMap.cs:104` maps it unlengthed and it has only ever held store codes.
- `ProviderCode` is the exception - it **is** operator input, passed through unvalidated. The Nphies
  service is the authority (`EligibilityService.cs:375` throws `"Provider doesn't configured!"`), so
  that refusal is one more case for this ticket's three-way error taxonomy.

## Comments

**2026-07-31 — this ticket's headline figure is now in question. See
[208](208-nphies-the-auth-is-an-engine-document.md).**

"The whole surface is JSON in / JSON out" and **5-7 developer-days** were reasoned on the premise
that a web-raised authorization is an assembled JSON body POSTed through SIS.Api. The requester
established that the new POS raises one as a real `PosTransaction` under a seeded `NphiesAuth`
document type on the Till Submission Platform (spec 301 / ADR-0005) - `AllowsSubmission = true`,
`IsSimulation = false`, items booked as engine lines by `ScanAsync`, lodgement stamped with
`MarkSubmittedAsync(authId)`, the attempt journalled through `IIntegrationAttemptLog` under
`"NPHIES_AUTH_REQUEST"` - so that the audit trail can show what the engine landed versus what the
agent changed.

If the web does the same, SIS.Api owes an **engine-session surface** (open, resume, book lines,
lodge) on top of this ticket's fifteen proxied endpoints, and the figure has to be re-derived. The
mitigation is that the shape is not new: the call-centre effort (map 126) already built
engine-as-a-service + resume-per-request for the browser, and oms-react already drives it. Whether
that machinery is reused is 208's question; the estimate impact is [204](204-nphies-the-estimate.md)'s.

**Nothing else in this ticket is affected** - the fifteen endpoints, the three-way error taxonomy,
the 100 s synchronous submit, "a timeout means in-flight never failed", and the never-ported set all
stand. The passthrough is not wrong; it may be incomplete.

**2026-08-01, from [205](205-nphies-who-computes-the-money.md) — the session surface is eleven
verbs, not eight.**

208 sketched eight (`Open` / `State` / `AddItem` / `ChangeQty` / `VoidLine` / `Submit` /
`Abandon`). 205's per-field pass adds three, all of them things the agent actually does:

```
+ Nphies/Session/SetInsurance          group rates + caps + paid-outside  -> SetInsuranceAsync
+ Nphies/Session/UpdateLineInsurance   DeductibleGroup at scan; MaxPayerShare on override
+ Nphies/Session/UpdateLineMeta        DaysSupply, PharmacistSelectionReason
```

`UpdateLineInsurance` is needed even with no agent override — the category to G1/G2/G3 assignment
runs on every scan (`ResolveDeductibleGroupForLine`).

**One thing this does not add: an item-picker change.** 197 costed
`InsuranceItemCategory` onto the picker response as one of two server changes; 205 found it already
rides the engine line, so the lookup contract is untouched and that term is zero.

The fifteen proxied endpoints and everything else in this ticket still stand.
