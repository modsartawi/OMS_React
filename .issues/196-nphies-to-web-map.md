---
type: wayfinder-map
status: done
---

# 196 — Nphies to web

> **Closed 2026-08-01.** Both halves of the destination exist: the sized estimate is
> [204](204-nphies-the-estimate.md) (**35–46 developer-days, two teams**) and the spec is
> [209](209-nphies-web-spec.md) (`status: ready`). Twelve tickets, no fog left toward the
> destination. Next step is `/to-tickets` against 209 — and the decision the map was chartered to
> inform, *whether to build*, is now the requester's to take on evidence rather than on a guess.

## Destination

A **sized estimate** for porting the WPF Nphies module's four screens to oms-react, backed by a
`/to-spec`-ready specification. "Sized" means defensible: every figure traces to a resolved ticket,
and the one genuine unknown — who computes the money on an authorization line — is answered rather
than assumed. Reaching the end of this map, someone can decide *whether* to build and hand the spec
to `/to-tickets` if they do.

## Notes

**Domain.** NPHIES is the Saudi national health-insurance exchange. The two acts in scope are
**check eligibility** (is this patient covered, by which policy, at what copay) and **authorization
request** (will the payer approve these items, at what benefit). Both are followed up by their own
list screen showing status, and — for authorizations — why a payer rejected. `CONTEXT.md` does not
yet carry this vocabulary; `/domain-modeling` adds it as tickets resolve.

**The source.** `C:\Work\DMSCO\BackOffice\Sartawi.POS\Nphies\` — 12.8K lines of WPF/DevExpress,
of which the four named controllers are 6.3K:

| Controller | Lines | Path |
|---|---|---|
| `NphiesEligibilityController` | 1346 | `Eligibility\CheckEligibility\` |
| `NphiesEligibilityResponsesController` | 448 | `Eligibility\EligibilityResponses\` |
| `NphiesAuthRequestController` | 2508 | `Auth\AuthRequest\` |
| `NphiesAuthResponsesController` | 1961 | `Auth\AuthList\` |

**The single most important fact, established while charting:** `NphiesService.cs` (804 lines) is
*nothing but* `HttpClient` calls to a standalone REST service at `http://172.23.27.40:8065/`
(staging `:8077`, dev `localhost:5000`). No NPHIES/FHIR logic lives in the WPF client. Endpoints
already in production use: `Eligibility/CheckEligibility`, `Eligibility/LastEligibility/{id}`,
`eligibility/EligibilityResponses`, `eligibility/EligibilityResponse/{id}`, `Auth/Auth`,
`auth/AuthResponses`, `auth/AuthResponse/{id}`, `Auth/StatusCheck`, `Auth/Retry`,
`auth/Communications/{id}`, `auth/ClinicalEditValidate`, `core/payers`, `core/providers`,
`core/codeSystem`, `core/diagnoses`, `core/morphs`. **This is a UI port, not an integration build.**

**The counterweight:** the WPF controllers are not thin. `NphiesAuthRequestController.
BuildAuthRequestForSubmit()` (line 1762) builds `authRequest.Items[]` from the **live POS basket** —
`POSCommon.CurrentPOSController.ViewModel.Lines` — reading `ExtendedPrice`, `UnitPrice`,
`VatAmount`, `InsuranceMaxCoverage`, `InsuranceActualDeductibleAmount`, `InsuranceDeductibleAmount`,
`InsuranceItemCategory`. Every one of those is a POS pricing-engine output. `CompleteRequest()`
(line 1511) literally opens a retail transaction (`CreateNewDoc(RetailTrxType.Sales,
RetailDocumentType.NphiesAuthRequest)`). Porting the *form* is days; porting *what fills the form*
is the cost. **Lightened by [197](197-nphies-pricing-machinery.md):** those outputs are the
*engine's*, not the till's, and the engine's insurance pass is already reachable over HTTP — the
counterweight is a contract-and-grant question, not an engine rebuild.

**⚠ 2026-07-31 — that lightening was half right, and the half it missed is now
[208](208-nphies-the-auth-is-an-engine-document.md).** The retail transaction above is not
incidental scaffolding. In the **new POS** it is a first-class `PosTransaction` under a seeded
`NphiesAuth` document type on the Till Submission Platform (spec 301 / ADR-0005, BackOffice tickets
303/304): `AllowsSubmission = true`, `IsSimulation = false` *because the transaction must persist
for the audit trail*, items booked as engine lines by `ScanAsync`, lodgement stamped
`MarkSubmittedAsync(authId)`, the attempt journalled under `"NPHIES_AUTH_REQUEST"`. It exists so the
business can reconstruct **what the engine landed versus what the agent changed** — the agent may
modify the deductible or swap items. 197 answered "where does the money come from"; it did not ask
"what records what the agent did to it". If the web raises authorizations the same way, this map's
cheapest term ([198](198-nphies-proxy-contract.md), 5–7 days of passthrough) grows an engine-session
surface — mitigated by the call-centre effort (map 126) having already built exactly that shape for
the browser.

**Scoping answers taken at charting time** (from the requester, so they are premises, not findings):

- Line items come from a **standalone item picker inside the Nphies screen** — not from an
  oms-react basket, not omitted.
- The browser reaches the Nphies service **through a SIS.Api proxy**, keeping
  [api-envelope](../.claude/rules/api-envelope.md) intact.
- The audience is **both insurance back-office and call-centre agents**, working to leave an
  authorization *ready for a pharmacist to dispense at the till*. **Dispensing stays on WPF.**

**Skills.** `/grilling` and `/domain-modeling` on every decision ticket; `/research` for the two
AFK investigations; `/prototype` for the two shape questions. This map is **plan, not do** — the
one exception is the tracer slice, which is not chartered here.

## Decisions so far

<!-- appended one line per resolved ticket -->

- [What pricing and deductible machinery already exists server-side](197-nphies-pricing-machinery.md)
  — the money is the SIS.Pricing engine's, not the till's, and its insurance pass is already
  reachable over HTTP both ways (`Pricing/Simulate` takes the deductible inputs, `SimulationResultItem`
  returns `CalculatedDeductible` / `PatientShare` / `MaxPayerShare`); of the fifteen line fields
  **5 are free today, 10 need a server change, 0 have no source**, and nine of the ten collapse into
  two changes — an insurance-capable pricing call and `InsuranceItemCategory` on the item picker.
  `NphiesDeductibleManager`'s second overload is already pure, so lifting it server-side is a move
  not a rewrite. The call-centre price-check path is *not* reusable (open transaction, qty-1,
  insurance explicitly off). Whether the Nphies service checks the money is unknowable from source —
  it became [206](206-nphies-does-the-service-check-the-money.md).
  [Findings](assets/196-nphies/pricing-machinery-research.md).
- [The shape of the SIS.Api passthrough](198-nphies-proxy-contract.md) — the passthrough is **not
  greenfield**: SIS.Api already ships `Nphies/CheckEligibility` over a registered `NphiesHttpService`
  with a configured client, audit wrapper and most models, **and the Nphies service's own source is
  on disk** (`C:\Work\DMSCO\nphies\Service\NphiesService\`), so its behaviour is now readable rather
  than inferred. Shape is **split by kind** — acts and lookups pass through, the two lists are
  re-modelled in SIS.Api, forced by `Take(20000)` with the ordering commented out. **14 endpoints**;
  dispense, payment, claim, HIDP and the multipart uploads are never ported, and attachments turn out
  to be base64 inside the auth JSON, so **the whole surface is JSON in / JSON out**. Environment is
  already server config (a staging `:8077` deployment is planned). The error taxonomy is **three-way,
  not two** — a payer rejection arrives as `Success = true` *data* and must render, not toast — and
  SIS.Api owns every translation. Submission stays synchronous at an explicit 100 s, and **a timeout
  means in-flight, never failed**. The SIS.Api port is async all the way down. **5–7 developer-days,
  SIS.Api team** — the cheap term in the estimate.
- [Which acts and which claim types the web actually raises](199-nphies-scope-of-acts.md) — v1 is
  **one claim type (0, prior authorization), one request type (`WithReferenceToEligibility`, a
  constant), and nine acts**, on the requester's strategy of shipping the smallest thing the team can
  react to. **Both mode dropdowns leave the screen** and **nothing is hand-typed identity** — those
  two structural savings exceed everything they drop. Eligibility: search, display, new (prefilled by
  a patient-id **Fill** off `Eligibility/LastEligibility/{patientId}`, superseding new-with-reference).
  Auth: search, display, status check, retry, cancel, clinical-edit validate — which turns out to be a
  **submit**-time gate, not a dispense-time one. Later: claim types 2/4/6, follow-up, the
  communication loop, update-auth-from-eligibility, update-advance. Never: claims (1), direct
  dispense (3). **Exception prescription is in** — it means one item group for the whole request, and
  all its scary-looking branches died with claim type 3. The line: *v1 sees an authorization through,
  it does not negotiate with the payer* — a `NeedComm` authorization **stalls on the web** by explicit
  ruling, provided the list shows that state honestly. Adds `Auth/Retry` to
  [198](198-nphies-proxy-contract.md), making it **fifteen** endpoints.

- [Provider, staff and store: what the web supplies that the till supplied implicitly](200-nphies-identity-and-context.md)
  — **the acting store plays no part**; `StoreSwitcher` is irrelevant to this screen. `ProviderCode`
  is a **free per-act pick** from `core/providers` (no default, no memory, submit blocked until
  chosen) — because providers get blocked, and the service already filters `IsBlocked == false`, so
  WPF's disabled-combo-holding-null trap cannot occur. Inherited **read-only** onto the auth
  (v1 being `WithReferenceToEligibility`-only, the provider is picked once per episode and the pair
  can never disagree); on the two lists it is a filter defaulting to **all** providers, the opposite
  of the till. `distributionChannel` never leaves the browser — SIS.Api pins `"20"`, because the only
  other channel is `"21"` = **Bahrain**, and the WPF "inconsistency" this ticket flagged turns out to
  be *correct*. `UserId`/`StaffId` are the session user id verbatim (`UaSessionEndpointFilter` stamps
  both claims from `session.UserId`) and are stored-never-read on the Nphies side. `SourceCode` is
  the constant **`'WEB'`** — its `OriginalProviderCode` twin died with claim type 1. Access is **one
  grant** for the whole screen, no audience split; the ungated `Nphies/CheckEligibility` gets it too.
  **Estimate moves down:** store entitlement and channel plumbing are *removed*, not reduced.

- [What a status is, and what "the details in case of rejection" shows](201-nphies-rejection-detail.md)
  — a status is **two columns, not seven fields and not one word**: **Request** (`Cancelled` /
  `Failed` / `Pending` / `Complete` — did we get an answer) and **Verdict** (blank until Complete —
  what they said), the same pair on both lists; `NeedComm` and `IsDispensed` ride as **markers**,
  being neither axis. The row **does not** assert "ready to dispense" — the predicate is already
  authoritative in the service's `Dispense()` and its `HasFollowUp` clause is absent from
  `AuthForListDto`, so a browser copy could only lie. **There is no rejection view**: `BenefitReason`
  is already *decoded display text* per line and already inside the proxied `auth/AuthResponse/{id}`,
  so the ordinary detail carries per-line verdict/approved-qty/rejected/reason always — which also
  covers the **partial** the brief forgets. `ErrorMessageShort` carries a transport error *or* the
  adjudication display depending on branch, so the Request state picks its label and source and it is
  never rendered on a `Complete`. Eligibility takes the same two axes with `SiteEligibility` folded
  into the verdict **at result time**, not WPF's throw-on-a-later-button. Multi-coverage: one coverage
  auto-selects, two or more force an explicit `MemberId` pick. **Estimate moves down** — no new
  endpoint (the communication thread is *not* the reason), no Nphies-service change, no second
  surface.

- [The shape of the screens: four modals become what?](203-nphies-screen-shape.md) — **six routes in
  one new area** `features/nphies/`: two lists, each with a detail route and a form route. The seam
  is a **route transition carrying an id** (`/nphies/authorizations/new?from=<eligId>`), chosen
  because the auth is often raised days after the check — the object WPF *carried* becomes a fetch by
  id. Items arrive on an **inline add-row** that prices in place; **no modal opens anywhere in the
  flow**. The eight visibility booleans need no replacement — 199 and 200 had already dissolved all
  of them, and `ViewOnly` was just WPF reusing one dialog as both form and detail; **one checkbox and
  one conditional block** survive. Principal diagnosis is a **radio in the row** (uniqueness becomes
  structural) and **morphology appears with its cause** instead of refusing after the fact. Two
  corrections of record: **`Failed` means NPHIES refused on validation before the payer saw it**, so
  it is a *form* state the agent fixes in place — and **Retry belongs to `Pending`, not `Failed`**
  (`RetryAuth` re-POSTs the stored JSON verbatim: "ask again, take the newer answer"). Acts are
  state-driven with the reason on hover. Lists default to **last 7 days as a removable chip**, which
  is what actually tames `Take(20000)`. Surfaced [207](207-nphies-reopening-a-refused-request.md).
  [Prototype](assets/196-nphies/screen-shape-prototype.html).

- [The authorization is an engine document, not a form post](208-nphies-the-auth-is-an-engine-document.md)
  — **yes: the web drives a live `NphiesAuth` engine transaction, like the till.** The screen is a
  **session, not a form** — open on entry, `ScanAsync` / `ChangeQty` / `VoidLine` per act, `Abandon`
  on leaving — because the owner's motivation for the whole platform is an audit of *what the engine
  landed versus what the agent changed*, and "added then voided" cannot be reconstructed from a
  payload carrying only the survivors. Shift-less per ADR-0001/0005 (a browser is the call-centre
  device case, and that path is proven). **A parallel Nphies session, ~8 verbs against call centre's
  25** — the `CallCenter*` services are doc-type-aware but call-centre-**bound** (the guard at
  `CallCenterEngineSession.cs:103`, the id hard-coded at `:336/:373/:413/:500`), so the *recipe* is
  reused, not the code. Agent may override **header deductible rates + line qty + void**; never an
  item swap, a price or a discount — which makes 203's rate block **editable**. **A duplicate item is
  refused at the scan**, moving WPF's submit-time `ValidateDuplicateItems` forward to where it
  applies. **No resumable drafts** — abandon eagerly, sweep the rest, because BackOffice 249's
  OPEN-claim litter is a defect the till just retired. 🚩 **Corrects
  [200](200-nphies-identity-and-context.md): the acting store IS the pricing plant**, bound once at
  open (`CallCenterEngineSession.cs:491-493`) — invisible in the payload, decisive in the money.
  Shrinks [205](205-nphies-who-computes-the-money.md) to its picker/fields half and unblocks it;
  grows [198](198-nphies-proxy-contract.md) by the session surface.

- [Attachments in a browser](202-nphies-attachments-in-a-browser.md) — **the only ticket so far that
  adds no server work at all: ~1 browser-day, no Nphies-service change, no SIS.Api change.**
  `NphiesHelpers.ConvertImage` turns out to do *nothing* beyond base64 (`Save(m, image.RawFormat)` is
  a same-format re-encode), and **the size cap the map assumed exists does not** — nothing configured
  in either hop and the column is `Length(4002)` = `NVARCHAR(MAX)`; the only ceiling is the
  un-configured ~28.6 MB default. So the browser is free to be *better* than WPF: **canvas-downscale
  images to 2000 px / JPEG q0.85** (6 MB phone photo → ~250 KB), PDFs untouched and refused over
  5 MB. **File picker only, no camera** — both audiences already hold the file. **The type dropdown
  dissolves** (MIME derives it), and the title becomes a **closed 7-value select** with duplicates
  allowed — the opposite of [208](208-nphies-the-auth-is-an-engine-document.md)'s duplicate-item
  refusal, because `Sequence` already distinguishes the rows. Mandatory becomes a **form state**
  (banner + Submit disabled), not a submit-time throw. The detail screen shows submitted attachments
  **for free** — `AuthMapper.cs:28` already maps the base64 back on `auth/AuthResponse/{id}`.
  🚩 Found a live WPF defect: `Extensions.cs:725` hardcodes `ContentType = "image/jpeg"` while the
  file filter admits PNG, so **WPF sends PNGs to the national exchange mislabelled** — report it,
  don't fix it here. "A real upload endpoint" is **priced at zero and dropped**.
  [Prototype](assets/196-nphies/attachments-prototype.html).

- [Who computes the money on a web-raised authorization line](205-nphies-who-computes-the-money.md)
  — **nobody does, on the web.** The engine computes all of it; the agent supplies **five inputs** —
  header deductible rates, header paid-outside, line quantity, line Max Coverage, line Days Supply
  (plus Selection Reason, a code not an amount). Everything else on the line is derived and
  read-only. **Q3 dissolves at zero cost**: `InsuranceItemCategory` rides the engine line and
  `ResolveDeductibleGroupForLine` already maps category→G1/G2/G3 server-side, so 197's second
  server change — the item picker — is **priced at zero and dropped**. 🚩 **`DeductibleGroupName`
  *is* `InsuranceItemCategory`** — same value, two names, so Q3 and a fifth of Q4 were one question.
  **`Factor` is omitted** (the service recomputes it as `Amount/ExtendedPrice`), and
  **`MaxCoverage` / `DeductibleG` / `DeductibleGroupName` never reach NPHIES** — they are stored on
  `NAuthLine` for the *dispensing till* to read back, so getting them wrong is a mispriced dispense,
  not a rejected claim; only `ActualPatientShare` is adjudicated. 208's override list was short by
  three, all now ruled **in**: Max Coverage (editable cell writing `MaxPayerShare`), Selection Reason
  (the WPF rule exactly — disabled on `Generic` **only**, quirks included), Days Supply (header
  default + per-line, **one 1–100 rule** replacing WPF's three, which deletes the submit-time sweep
  rather than porting it). Paid-outside is **included and persisted** — a new `PaidAmount` column,
  because a stored cap cannot distinguish *300* from *500 with 200 already spent*, and that is
  exactly 208's rationale. **Cost: three session verbs (8→11) and one schema column** — the auth
  header was already modelled on the transaction by migration 015. Audit is complete for the money
  and **final-value-only** for the two line-meta codes. 🚩 Three defects found and reported, not
  fixed (div-by-zero at `AuthService.cs:450`; the stray-semicolon parse in both
  `NphiesDeductibleManager` copies; SIS.Pos silently ignoring `MaxPayerShare <= 0`).

- [Does the Nphies service check the money it is sent](206-nphies-does-the-service-check-the-money.md)
  — **no: not one of its guards touches an amount**, and the ticket resolved **AFK from source**, the
  probe it was chartered as never being needed. `Auth/Auth` is a **transcription layer** — copies
  every money field onto `NAuthLine`, rounds seven to 2dp, recomputes exactly one
  (`Factor = Amount/ExtendedPrice`), POSTs. **Whatever the caller sends is what the national exchange
  sees.** A wrong `ExtendedPrice` is accepted *silently* (it never leaves the service; it only skews
  the sent `Factor`), and a header/line deductible mismatch is **unobservable** — neither side is
  mapped to NPHIES and the outbound `Claim` carries no `Total` at all. The one case that could have
  cut the estimate — zeroed money — does the opposite: it **throws div-by-zero** and leaves an orphan
  header, so real money is required from day one and [205](205-nphies-who-computes-the-money.md)'s
  engine-computes-everything ruling is **load-bearing** rather than merely safe. Adds one required
  guard (SIS.Api refuses `ExtendedPrice = 0`) and one rounding rule (`ActualPatientShare` — the only
  adjudicated field — is *not* rounded by the service; the web rounds to 2dp, matching the till).
  🚩 **Deletes the map's last unknown and the "staging unreachable" risk**: NPHIES-side validation
  stays unprobed, but the production formula is empirically valid, so the web's obligation is to
  reproduce it, not discover it. [Findings](assets/196-nphies/service-money-checks.md).

- [Reopening a refused request: what can the form be prefilled from](207-nphies-reopening-a-refused-request.md)
  — **path 3, and it is already paid for.** The ticket priced SIS.Api keeping its own model as the
  speculative option; it is the one that costs nothing, because
  [208](208-nphies-the-auth-is-an-engine-document.md) put the web on spec 301's orchestration and
  that recipe's **write-ahead journal row already carries the whole request** —
  `IntegrationAttemptLog.StartAsync` writes `RequestJson` on a fresh connection *before* the payer
  is called, so it survives refusal, rejection and transport failure alike; findable by
  `SubmissionReference == authId`, which 301 stamps on any response carrying an id. **No new table,
  column or write.** Path 1 is **richer than suspected and free as a fallback** —
  `auth/AuthResponse/{id}` returns `AuthHeaderDto` with lines and attachments eagerly fetched,
  losing only `MaxCoverage` (on the entity, absent from `AuthLineDto`) and three dead header fields;
  `NAuthDiagnosis` turns out to be **dead code**, diagnoses riding as strings. Path 2 is **dropped**
  — `auth/AuthJson/{id}` exists and **WPF already calls it into a raw-text viewer**; no FHIR→form
  parser exists anywhere and writing one recovers what we hold twice in flat form. **A reopen is a
  replay, not a restore** (208 banned drafts): a fresh session, existing verbs, **no new verb**, and
  it reports what did not come back rather than restoring silently. **~1.5 developer-days.**
  🚩 **Corrects [203](203-nphies-screen-shape.md): `Failed` has two sources**, not one — the
  service's own guards throw before the POST, and *before the lines are built*, leaving a
  header-only row only path 3 can prefill. 🚩 The list must send **`showAll=true`** or refused rows
  are invisible. [Findings](assets/196-nphies/reopening-a-refused-request.md).

- [The estimate](204-nphies-the-estimate.md) — **35–46 developer-days, engineering-complete, across
  two teams**: ~15–20 server (SIS.Api) + ~19–25 web (oms-react). One developer end to end is 7–9
  weeks; the two tracks in parallel are **≈ 5 weeks elapsed**, which is the shape to quote. **Zero
  Nphies-service days** — not one ticket on this map found work for the service team. The term the
  map opened calling *"the one that can move the total by a multiple"* — the pricing machinery —
  closed as **three session verbs and one column**, both its candidate server changes priced at zero
  and dropped. The riskiest figure is now [208](208-nphies-the-auth-is-an-engine-document.md)'s
  **engine-session surface at 8–12 days, which could be 6 or 18**: a *parallel* build, because the
  call-centre services are doc-type-aware but call-centre-bound. A ~2-day de-risking spike was priced
  and declined; the term is carried as a range with its swing flagged. Staging `:8077` is a
  **schedule dependency, not an effort figure**. QA, UAT and deploy are deliberately outside the
  number — a 30–50% tail, to be quoted as a tail and not read as a discount — as are View JSON,
  camera capture, and before/after audit on the two line-meta codes (final-value-only accepted).
  **The spec is not in this ticket**: `/to-spec` against this map is the closing act and its own
  session.

## Not yet specified

<!-- "Freshness of status" resolved by 203 — the Nphies service's own `PollRequestWorker` already
     polls NPHIES every 15 s server-side, so a Pending row resolves itself; the requester ruled
     manual refresh only, no browser polling. Not graduated: the answer removed the design. -->
<!-- "Access control" resolved by 200 — one grant, whole screen, no audience split. Not graduated
     into a ticket: the answer was the whole of it. -->

- **Provider list scoping, if a third distribution channel ever appears.** Dim, and deliberately
  left so by [200](200-nphies-identity-and-context.md): channel is a constant only because `"20"` and
  Bahrain's `"21"` are the only two `NProvider` carries. A third would make it a real input and the
  provider picker would need scoping. A spec line today, a ticket only if it happens.

## Out of scope

<!-- ruled beyond the destination; never graduates -->

- **Dispensing and invoicing.** `CreateInvoice`, `Dispense`, `RobotDispense`, `LinkToOms`,
  `LinkToOmsP2E`, GS1 serial scanning (`Gs1DocumentController`, `HandleGs1`, `TryFill`) and the
  direct NHibernate reads (`session.Query<RetailTrx>()`, `Query<Customer>()`) — roughly 75% of
  `NphiesAuthResponsesController`. The pharmacist keeps the till; the web screen's job ends when
  the authorization is approved and ready. Out of scope by the requester's own framing of the
  audience.
- **HIDP.** The national insurance-directory lookup is **obsolete and will not be ported** — ruled by
  the requester while resolving [198](198-nphies-proxy-contract.md). `hidp/Hidp` is not proxied. This
  was a fog item; it is now closed rather than graduated.
- **Payment reconciliation and claim submission.** `PaymentController` in full
  (`PaymentNotice`, `PaymentReconciliations`, `PaymentReconciliationDetails`) and `Auth/Claim` —
  **not ported at all** ([198](198-nphies-proxy-contract.md)).
- **The multipart auth upload.** `Auth/UploadAuthRequest` and its `[FromForm]` siblings served a
  special case that the web version does not need ([198](198-nphies-proxy-contract.md)). Costs
  nothing: attachments ride as base64 inside the auth JSON.
- **Everything [199](199-nphies-scope-of-acts.md) put outside v1.** *Never:* claim type 1 (Claim,
  demo-only) and claim type 3 (direct dispense — a till act). *Deferred past v1, to be planned after
  the team sees the first cut:* claim types 2 (advance), 4 (offline/direct claim) and 6 (BUPA-SABIC);
  **direct auth** (raising an authorization with no eligibility — it would restore a hand-typed
  identity form); **follow-up**; the **payer communication loop** (a `NeedComm` authorization stalls
  on the web by explicit ruling); **update-auth-from-eligibility**; **update-advance**. These are
  scope boundaries for *this* map, not permanent rulings — the deferred set is the requester's stated
  next planning round.
- **Bahrain and Vitality.** Bahrain is a *deployment* fork (different id type, optional member id,
  offline approval number, its own view) and this screen serves the Saudi back-office; Vitality is
  visibly being retired in WPF (every list-controller use is commented out). Both ruled out while
  resolving [199](199-nphies-scope-of-acts.md); this closes the map's "Variant flows" fog item.
  Exception prescriptions, the third item in that patch, went the other way — **in v1**.
- **Rebuilding the POS pricing engine in the browser.** Whatever [197](197-nphies-pricing-machinery.md)
  finds, the answer is not "port `PosPricingService` to TypeScript". Money is computed server-side
  or it is not computed.
