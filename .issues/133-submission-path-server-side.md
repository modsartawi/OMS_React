---
type: wayfinder-ticket
wayfinder: research
map: 126
status: done
blocked-by: —
---

# 133 — How the web submit reuses 278's orchestration, server-side

## Question

The submission spine already exists and works — but it is orchestrated **in the WPF client**.
Establish exactly what moves and what is reused verbatim when the caller is SIS.Api itself.

The shipped WPF sequence
([278](C:\Work\DMSCO\BackOffice\.issues\278-cc-submit-explicit-wpf-orchestration.md)):

1. Build the CLCN document from engine state via `CallCenterOrderDocumentBuilder`.
2. Write-ahead `IIntegrationAttemptLog.StartAsync(IntegrationTypes.CallCenterOrder, transactionId,
   request, storeCode, operatorId)` — a `Pending` row committed **before** the POST.
3. POST `OmsHttpService.SubmitCallCenterOrder` → `CallCenter/SubmitOrder` (once-only per submission
   identity, returns `OrderNo`).
4. Success: `CompleteSucceededAsync` → `tx.MarkSubmittedAsync(DocumentNo)` → Open→SUBMITTED.
5. Failure: `CompleteFailedAsync` → bilingual "temporarily unavailable" → **transaction stays
   OPEN and retryable**.

Answer:

- Does SIS.Api call `CallCenter/SubmitOrder` **over HTTP to itself**, or call the underlying
  document-creation path in-process? Once-only semantics and the attempt log must survive either
  way — say which and why.
- `CallCenterOrderDocumentBuilder` — where does it live, and is it reachable from SIS.Api or does it
  need to move? This is the component that enforces Note 3 (the document is built from engine state,
  never from client input), so its placement is a security property, not a packaging detail.
- The **once-only key** — 269's open question was `TransactionId` alone versus
  `TransactionId + doctype`. What did it actually ship as?
- **Operator identity.** 269 takes it from `staffid`/`storecode`/`user` claims, "never the body."
  What does a web agent's call present, given Note 12's synthetic register?
- **Failure UX.** What the agent sees, what retry does, and how a `Pending` attempt orphaned by a
  server crash is recovered (`RecoverStale` flips it to `Unknown` on the WPF side — what is the web
  equivalent?).
- **Delivery fees** stay an OMS-post condition, not an engine line (map 244 note 7) — confirm that
  holds and where the fee is computed for a web order.

Deliverable: a linked note plus the list of server-side changes, minted as BackOffice issues.
Blocks the API contract (136) — the submit verb's shape and failure taxonomy come from here.

## Answer

Researched against the BackOffice tree 2026-07-27. The submission spine moves **less** than the
question assumed — the mint, the builder, and the attempt journal all already live in
`Sartawi.Retail.Data`, the assembly SIS.Api project-references. What is genuinely missing is the
builder's *input*, the fee *rule*, and an orphan reconciler that **was never written**. Server work
is minted as BackOffice [786](C:\Work\DMSCO\BackOffice\.issues\786-web-cc-submission-path.md).

### The six answers

| Question | Answer |
|---|---|
| **HTTP-to-self or in-process?** | **In-process.** SIS.Api calls `SdDocumentService.SubmitCallCenterOrder(request, userContext)` directly. The HTTP endpoint stays byte-identical for the till. |
| **Where does the builder live?** | `Sartawi.Retail.Data/Modules/Pos/Data/CallCenterOrderDocumentBuilder.cs` — **already server-side, no move**. Deliberately pure (no WPF/`POSCommon`, `vatRate`+`trxDate` passed in, `StockStore` never read). What must move is its **input**, the issue-198 line mirror. |
| **Once-only key** | Shipped as **`(OrderNo, DocumentType)` with `OrderNo := TransactionId`** — not `TransactionId` alone. Backed by the filtered unique index `UX_SdDocumentHeader_CLCN_OrderNo`. Web inherits it unchanged. |
| **Operator identity** | **Nothing new.** `ApiKeyEndpointFilter` sets `userid` = `staffid` = `session.UserId`, `storecode` = `session.CurrentStoreCode`, and ignores browser-supplied headers. `operatorId` = the OMS login id, consistent with [127](127-engine-session-lifecycle.md)'s `WEB-<loginId>`. One decision: `EntryStore`. |
| **Failure UX / orphans** | Retry, **not reconciliation** — once-only makes a repeated submit self-healing. The real orphan (minted, never stamped SUBMITTED) is closed by a **hosted reconciler**, which also disarms the sweeper. |
| **Delivery fees** | Confirmed a `DFEE` **document condition**, never an engine line (map 244 note 7 holds). But the **rule** computing it is WPF-only and must become shared code, not a restatement. |

### Why in-process

`CallCenterSubmissionEndpoints.SubmitOrder` is a five-line wrapper over exactly that method
(`Services/SIS.Api/Endpoints/CallCenter/CallCenterSubmissionEndpoints.cs:36-45`), and once-only lives
**entirely below** the HTTP boundary — the pre-check SELECT, `AddDocument`, and the filtered unique
index (`Modules/Sd/Sql/022_unique_call_center_order_no.sql`). Idempotency is a property of the
*service and the database*, not of the transport, so it survives the collapse untouched.

A loopback POST would buy nothing and cost: a loopback dependency, double serialization, a fabricated
`ClaimsPrincipal` (the endpoint reads identity from `HttpContext`, so a self-call must forge one),
and — worst — a **new ambiguity class**. A loopback timeout is exactly the "did it commit?" state the
attempt journal exists to record, deliberately reintroduced against a partner that is *ourselves*.

⚠ **Consequence: the write-ahead journal's purpose shrinks.** In-process, "did the partner commit?"
collapses to "did the DB transaction commit?" — there is no in-flight network gap. Keep the journal
(it is the audit and ops record, and the reconciler's index), but `Unknown` becomes near-unreachable
on the happy path. That is a *strengthening*, and 136 should not model an "unknown" state for the
client.

### The builder is not the whole security boundary

Note 3 says the document is built from engine state, never from client input. The builder achieves
that **by construction** for lines and money. But its signature is
`Build(IEnumerable<RetailTrxDetail> lines, CallCenterOrderHeaderInput header, deliveryFee, vatRate, trxDate)`
— and `CallCenterOrderHeaderInput` is exactly where agent-entered facts (customer, address, slot,
note, source reference) legitimately reach the document.

So Note 3's precise statement for submit is: **lines, prices, discounts, and the fee come from engine
state and server policy; the header carries agent-entered facts that were captured earlier in the
session and stored server-side.** The submit call itself carries *no* payload beyond the transaction
id. That distinction is a direct input to [136](136-session-api-contract.md), and it is what makes
header capture ([132](132-header-capture-inventory.md)) a *session* concern rather than a submit
argument.

The line mirror is the missing piece: `RetailTrxDetail` comes from the WPF VM today
(`ResyncLinesFromNewPos` / `MergeLineFromTransaction`). ✅ But the server-side mapping already exists
and is tested — as a **private test helper**,
`CallCenterOrderBuilderEndToEndTests.MapEngineLineToDetail`
(`Pricing/SIS.Pricing.Tests/Pos/CallCenterOrderBuilderEndToEndTests.cs:79-99`), which drives a live
engine transaction with no WPF at all and diffs the builder output against the same
`LegacyClcnPost.json` fixture 269's contract test reads. Promote it; the oracle and production then
cannot drift.

### Findings this ticket surfaced

1. 🚩 **`IIntegrationAttemptLog.RecoverStaleAsync` has ZERO production callers.** A solution-wide grep
   finds it only in tests. 278's "on restart `RecoverStale` flips it to `Unknown`" sits inside its
   **unticked, OWNER-PENDING** manual smoke — the caller was never written. The question's premise
   ("what is the web equivalent?") has no WPF original to be equivalent *to*; the web builds the
   first one.
2. 🚩 **[127](127-engine-session-lifecycle.md)'s 12 h sweeper can auto-void a transaction whose order
   was actually minted.** If a pod dies between the mint and `MarkSubmittedAsync`, the transaction is
   still Open — so the sweeper's `VoidTransactionAsync` fires **coupon reversal against a real,
   delivered order**. This is the sharpest thing found, and it is a hazard the WPF path never had (a
   till is one process; there is no window where the order is minted and the client is gone). Fixed
   by the reconciler plus a sweeper guard that refuses to void a transaction whose id already exists
   as a CLCN `OrderNo`.
3. 🚩 **The delivery-fee rule is WPF-only.** `RefreshSubmissionDeliveryFeeFromNewPos()`
   (`POSController.NewPos.cs:8680-8717`) reads `POSCommon.ShippingMinimumAmount` (hardcoded **100
   SAR**) and `POSCommon.ShippingAmount`, and `ShippingAmount` reaches into `CurrentPOSController` for
   its P2E branch and carries a **hardcoded free-shipping window** (`2026-06-20`..`2026-06-28`).
   Restating it inside SIS.Api leaves two copies of the fee, and the web would quote a different
   delivery fee from the till on the same basket. Hence a shared `CallCenterDeliveryFeePolicy`, with
   the threshold and window in configuration. Only `DeliveryFeesConstants` (12.0 / 15.0) is already
   shared. ⚠ `POSCommon.cs:404` annotates that constant `// 10m`; it is `12.0m`.
4. 🚩 **WPF presents a fixable input error as a server outage.** A delivery order with no slot picked
   throws `"You should select a time slot"` *inside* the `AsyncBridge` lambda
   (`POSController.NewPos.cs:1519`), which lands in the outer catch and shows the bilingual
   "temporarily unavailable" message. The web must **not** inherit that conflation — a validation
   refusal the agent can fix is a different outcome from a transient failure.
5. ⚠ **Web CC attempts will never reach `POS_Server.PosIntegrationAttempt`.**
   `IntegrationAttemptLog.PublishAttemptAsync` returns early when there is no `PosEnvironment` —
   correct by design (its own comment names "HQ-side call-center / Nphies flows"), and 127 rules no
   `IPosEnvironment` for web. But that is the table HQ ops reconcile from (migration 069). This is the
   concrete reason the map's *Observability and ops* fog needs an answer.
6. ⚠ **Two catalogs, unconfirmed as one.** `IntegrationAttemptLog` writes via
   `IUnitOfWork.GetNewConnection()`; `SdDocumentService` via `_dataAccessFactory.GetNewConnection()`.
   Migration 022's target is **OMS-HQ** ("the SIS.Api server DB that hosts `SdDocumentHeader`"); 127
   places live web engine rows in the **HQ store DB**. Same catalog or not decides whether migration
   `012_create_integration_attempt.sql` must be applied engine-side and whether the reconciler's join
   is one query or two.
7. ✅ **The slot leg collapses too.** WPF calls `Slots/SlotIsActive` over HTTP; `SlotService.SlotIsActive()`
   is in `Sartawi.Retail.Data` — SIS.Api hosts it in-process.

### `EntryStore` — ruled

`AddDocument` stamps `EntryStore = userAction.StoreCode` (`SdDocumentService_Add.cs:224`). At a till
that is the selling store; for a web agent it is whatever store the OMS **store switcher** is on,
which has nothing to do with the fulfilment plant in `Document.StoreCode`.

**Ruled: leave it unmodified.** `EntryStore` genuinely means *where the order was entered*, and a
synthetic constant would be a lie in an audit column; an agent whose session carries no store yields
a null, which is what a till-less HQ operator *is*. Consequence to communicate: reports filtering
CLCN by `EntryStore` will start seeing agent/HQ codes and nulls.

### What this hands 136

- **`submit` takes only the transaction id.** No document, no lines, no amounts, no fee.
- **Four outcomes, not two.** `submitted` (carries `DocumentNo`); `alreadySubmitted` — **a success**
  carrying the first `DocumentNo`, and the server still completes the local tail, so the client
  treats it identically; `refused` — a validation/business failure the agent can fix (missing slot,
  missing header field), naming the field; `unavailable` — transient, transaction stays **Open and
  retryable**. Plus `busy` (strict-claim collision) from 127, which every verb carries.
- **No `unknown` state** for the client — in-process removes the in-flight gap that would produce one.
- **`getState` must carry the delivery fee** and its threshold reasoning, because the fee is quoted
  live as lines change, not computed at submit.
- **Header capture is a session concern**, not submit arguments — which is what makes
  [132](132-header-capture-inventory.md) load-bearing for this verb.
