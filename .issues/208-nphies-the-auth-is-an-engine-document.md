---
type: wayfinder-ticket
wayfinder: grilling
map: 196
status: done
blocked-by: —
---

# 208 — The authorization is an engine document, not a form post

## Question

**The premise this map has been sizing against is wrong, and the correction came from the
requester.** Every ticket so far has treated a web-raised authorization as *assemble a JSON body,
POST it through SIS.Api*. In the **new POS** it is already something else: a real
`PosTransaction` under a seeded `NphiesAuth` document type, on the **Till Submission Platform**
(spec 301 / ADR-0005, tickets 303/304 of the BackOffice tracker).

The evidence, all of it recent, deliberate, and guarded by source-contract tests:

- **The doc type is seeded and non-transacting.** `DocumentTypeCatalog.NphiesAuthDocumentTypeId`
  (`Sartawi.Retail.Data\Modules\Pos\Data\DocumentTypeCatalog.cs:54`); `AllowedTenderTypes` empty =
  block every tender ("an authorization request takes no payment"), `IsReturnAllowed = false`
  (`Tests\Data.Tests\DocumentTypeCatalogNphiesAuthTests.cs:16-31`).
- **`AllowsSubmission = true`, `IsSimulation = false`, and the two are mutually exclusive** — with
  the reason stated in the test: *"the transaction MUST persist for the audit trail — terminal
  SUBMITTED, not simulation, is what retires the 249 OPEN-claim litter"*
  (`DocumentTypeCatalogNphiesAuthTests.cs:40-52`).
- **Items are engine lines.** Ticket 303 removed the `NphiesAuthRequest` carve-outs from both intake
  doors, so *"the auth-request basket books ENGINE lines like every other doc type"*
  (`SIS.Pricing.Tests\Pos\NphiesAuthSubmitSourceContractTests.cs:86-109`).
- **The lifecycle is explicit orchestration**: `OpenAsync(NphiesAuth)` → `ScanAsync` → journal
  `StartAsync` → `CompleteSucceededAsync` + **`MarkSubmittedAsync(authId)`**, or on transport failure
  `CompleteFailedAsync` with **no mark, leaving the tx OPEN and its claim held**
  (`NphiesAuthRequestSubmissionEndToEndTests.cs:13-30`). The journal is the standard
  `IIntegrationAttemptLog` under the app-side integration type `"NPHIES_AUTH_REQUEST"`.
- **The lodgement rule (304)**: *any returned verdict* — approved, pended or **rejected** — is a
  lodgement and commits SUBMITTED; only a thrown POST or a null return keeps it OPEN
  (`NphiesAuthSubmitSourceContractTests.cs:66-84`).

**Why it exists, from the requester:** the agent can change what the engine landed — modify the
deductible, swap or replace items — and the business needs to answer *later* what the deductible was
when the engine computed it and what the agent changed it to. The transaction is the event history
that answers that. The `AllowsSubmission` flag is the same gate call centre uses, and
`MarkSubmittedAsync` links the Nphies authorization id, so an agent's work is traceable end to end.

### What this collides with

1. **[198](198-nphies-proxy-contract.md)'s central conclusion.** "The whole surface is JSON in / JSON
   out" and **5–7 developer-days** assume a passthrough. An engine transaction per authorization is a
   *session* surface — open, resume, book lines, lodge — which is a different and larger contract.
   Does 198's figure survive? Say so explicitly.
2. **[205](205-nphies-who-computes-the-money.md)'s door.** 205 was heading for `Pricing/Simulate`
   because it is order-free and session-free. But `IsSimulation = false` is the catalog row
   *deliberately rejecting* exactly that: a simulation leaves no audit trail, which is the whole
   point. If the web books engine lines on a real transaction, the money arrives the same way the
   till's does and 205's Q1/Q2 largely dissolve. **205 is blocked on this.**
3. **[203](203-nphies-screen-shape.md)'s form.** A stateless form that POSTs once becomes a
   **resumable draft carrying a transaction id** — with everything that implies (an abandoned draft
   is an OPEN claim, and 249's "OPEN-claim litter" is a named problem this platform already fixed
   once). Interestingly it *reinforces* 203's ruling that a failed submit keeps the agent on the
   form: the platform already says a transport failure leaves the tx OPEN. Where it may collide is
   the item grid re-pricing model.

### Decide

1. **Does the web open a `NphiesAuth` `PosTransaction` at all** — or is the web deliberately a
   second, lighter path that forgoes the audit trail? (The requester's framing says it should not
   forgo it; this is asked so the answer is recorded, not assumed.)
2. **If yes, where does the session live?** The call-centre effort already solved this exact shape
   for the browser — **engine-as-a-service + resume-per-request** (map 126) — and oms-react already
   drives an engine session that way (`features/callcenter/console/api.ts`: every mutating verb
   sends `{ transactionId, requestId, … }` and gets whole state back). Reuse that machinery or mint a
   parallel one? This is the question that most moves the estimate, and it may move it **down**,
   because the pattern exists rather than needing invention.
3. **What does the agent actually get to override, and what records it?** The deductible, a line
   price, an item swap — name each override, and say whether the record is the engine's own event
   history, the integration-attempt journal, or both.
4. **What happens to an abandoned draft?** A form the agent closes at 5pm leaves an OPEN engine
   transaction. Call centre and 249 both had to answer this; say what this screen does.
5. **Does the `AllowsSubmission` gate mean anything different on the web** than at the till?

The output is a **decision on the transaction, plus a revised premise line for
[198](198-nphies-proxy-contract.md) and [205](205-nphies-who-computes-the-money.md)**, precise enough
that [204](204-nphies-the-estimate.md) can re-price the seams this changes. Consult the call-centre
map 126 and its shipped console before designing anything new.

## Answer

**Yes — the web drives a live `NphiesAuth` engine transaction, the same way the till does. The
authorization screen is a session, not a form.** The requester's reasoning is the owner's own from
spec 301: the audit trail must show *what the engine landed versus what the agent changed*, and a
trail of "added then voided" cannot be reconstructed from a payload that only ever carried the
survivors.

### 1 · The web opens the transaction, and drives every basket act through it

| Agent act | Engine call | Recorded |
|---|---|---|
| form opens | `Open(NphiesAuth, shift-less)` | tx OPEN |
| add item | `ScanAsync` | engine line |
| change qty | `ChangeQty` | engine line |
| void a line | `VoidLine` | **VOIDED line, kept** |
| submit | `StartAsync` → POST → `MarkSubmittedAsync(authId)` | attempt journal + SUBMITTED |
| leave | `Abandon` | tx VOIDED |

The submit leg is **not new work** — it is ADR-0005's recipe verbatim, already shipped for the till
by BackOffice 303/304, including the `"NPHIES_AUTH_REQUEST"` integration type and the
`SubmissionReference = ` Nphies authorization id. **The web's addition is the session in front of
it.**

**Shift-less, per ADR-0001 / ADR-0005.** A browser is the call-centre-device case, and the path
already exists: `CallCenterEngineSession.cs:501-503` — *"a call-center caller has no shift and
nothing reads one before submission"*. `Origin` is the web seat, not the store
(`CallCenterEngineSession.cs:494-495`).

### 2 · A parallel Nphies session, same recipe — about eight verbs

Not a generalisation of the call-centre machinery. That code is doc-type-**aware** but call-centre-
**bound**: `OpenAsync` takes a `DocumentTypeId` and then guards it against
`CallCenterOrderDocumentTypeId` (`CallCenterEngineSession.cs:103`), with the id hard-coded again at
`:336`, `:373`, `:413`, `:500`. Refactoring ~600 KB of shipped, working call-centre services to
serve a second consumer buys one implementation at the price of destabilising a live screen; the
requester chose the parallel build.

```
Nphies/Session/Open      Nphies/Session/AddItem
Nphies/Session/State     Nphies/Session/ChangeQty
Nphies/Session/Submit    Nphies/Session/VoidLine
Nphies/Session/Abandon
```

Roughly **eight verbs against call centre's twenty-five** — no fulfilment, address, slot, coupon,
customer, stock-elsewhere or prereq machinery. The *pattern* is what is reused (resume-per-request,
claim-and-release leases, whole-state-back on every verb, typed refusals), and it is proven twice
over. What it is not is a configuration flag.

### 3 · What the agent may change — and the two rules that follow

**In:** the **header deductible rates** (G1/G2/G3 and their caps), **line quantity**, and **voiding
a line after scanning it**.
**Out:** item swap/replace, and unit-price or discount override. The agent corrects the *insurance*
terms, never the merchandise or its price.

The deductible override is at the **header**, which is exactly where `UpdateDeductible` writes
(`NphiesDeductibleManager.cs:103-171` — it never touches `request.Items`). So one edit re-prices the
whole basket through the engine, and the line amounts stay derived rather than hand-set. **This
makes [203](203-nphies-screen-shape.md)'s deductible-rate block editable, not read-only** — it is
inherited from the coverage and then correctable, and the correction is what the audit trail exists
to catch.

**Duplicate items are refused at scan time.** WPF refuses them at *submit*
(`ValidateDuplicateItems`, `NphiesAuthRequestController.cs:1737-1755`: *"should be exists only one
time per authorization request, consider change quantity"*). On the web the same rule moves forward
to the scan — a second scan of an item already on the basket is refused, and the remedy named in the
refusal is the quantity control. Same instinct as 203's morphology block: state the rule where it
applies, rather than refusing after the fact. (`lines.Count == 0` → "No Items selected" stays a
submit-time check; there is nowhere earlier to put it.)

### 4 · The plant — this ticket corrects [200](200-nphies-identity-and-context.md)

**The engine binds `PcHeader.Plant` from `StoreId` once at open and it can never change**
(`CallCenterEngineSession.cs:491-493`). An engine transaction cannot exist without a store, and the
store prices every line — which is the money the payer adjudicates.

200 ruled that "the acting store plays no part" and `StoreSwitcher` is irrelevant to this screen.
That was correct **about the Nphies payload** and wrong **about the engine**. The ruling:
**the agent's acting store from `StoreSwitcher` is the plant.** So `StoreSwitcher` is not
irrelevant to this screen after all — it is invisible in the request and decisive in the pricing.

Consequences to carry into the spec: the plant is **fixed at open**, so switching stores mid-request
is not a thing the screen can offer; and the acting store must be resolved *before* the first item,
not at submit. There is no store↔provider mapping to lean on — `NProvider` carries only
`ProviderCode`, `ProviderId`, `License`, credentials, `IsBlocked` and `DistributionChannel`
(`nphies\Service\NphiesService\NphiesService\Data\NProvider.cs`), so provider and store are two
independent choices and the provider does not imply the plant.

### 5 · Abandoned drafts: abandon eagerly, sweep the rest — no resumable drafts

Leaving the screen calls `Abandon` and the transaction is VOIDED; anything that escapes that — a
crashed tab, a closed laptop — is swept after a timeout. **Drafts are deliberately not resumable**:
a half-built authorization is not work worth keeping, and BackOffice **249** named unswept OPEN
transactions plus their claims as a real defect that spec 301 set out to retire. Re-creating them on
the web would reintroduce the litter the till just finished cleaning up.

So the authorizations list shows no "Draft" row, and the six routes of
[203](203-nphies-screen-shape.md) are unchanged — but navigating away from a part-built
authorization **discards it**, which the screen owes the agent a warning about.

### What this hands forward

- **To [200](200-nphies-identity-and-context.md):** corrected on the store. Commented there.
- **To [203](203-nphies-screen-shape.md):** the rate block becomes **editable**; the item grid is
  engine lines over a session, not local state; duplicate scans are refused at the scan; leaving
  discards. Everything else in that answer stands. Commented there.
- **To [205](205-nphies-who-computes-the-money.md):** its Q1/Q2 largely dissolve — the money arrives
  the way the till's does, through engine lines on a real transaction, so there is no "which pricing
  door" to pick and no coverage→buckets algorithm to re-home in TypeScript. What survives is
  narrower: `InsuranceItemCategory` on the picker (Q3), the five non-engine fields (Q4), and Q5,
  which this ticket has now half-answered (the agent overrides header rates and quantity, never a
  price). **Unblocked.**
- **To [198](198-nphies-proxy-contract.md):** add the eight session verbs to the fifteen proxied
  endpoints. The passthrough was not wrong, it was incomplete; its other conclusions stand.
- **To [207](207-nphies-reopening-a-refused-request.md):** a sharper question than it was written
  with. Under ADR-0005 a *thrown* POST leaves the tx OPEN and retryable, while any *returned* verdict
  lodges SUBMITTED — and `MarkSubmittedAsync` falls back through auth id / HIDP / eligibility
  references so that even an id-less verdict lodges. So whether a NPHIES **validation refusal**
  leaves the agent on a still-open transaction (fix in place, resubmit) or a lodged one (a new
  authorization) depends on whether that refusal arrives as a non-2xx — which
  `NphiesService.cs:499-504` turns into a thrown exception — or as a 2xx body. 207 should settle
  that; it decides whether "fix and resubmit" is the same transaction or a new one.
- **To [204](204-nphies-the-estimate.md):** the map's cheapest term grows a session surface
  (~8 endpoints, a session store, claim/release, refusals, a sweeper) — but against a proven recipe,
  not a design problem. This is the figure most worth a second opinion.
