---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: done
blocked-by: 127, 129, 130, 133
---

# 136 — The session API contract that lets both tracks run free

## Question

Note 15 makes this the map's most important single artifact: the frozen contract both tracks build
against. It is deliberately blocked — its verbs come from the session model (127), its store-change
verb from the rebind door (129), its promotion payload from what the server can actually return
(130), and its submit verb and failure taxonomy from the submission path (133).

Specify, completely enough that neither side has to guess:

- **Every verb** from map Note 5, as an endpoint: route, request body (intent only — Note 3 forbids
  any amount on the wire), response, and idempotency behaviour under a retried request.
- **`getState()` — the projection the whole UI renders.** Lines with per-line pricing and
  conditions, basket totals, fired promotions, near-misses with prerequisites and eligible items
  (130), per-line frozen ATP and its soft-gate warning (Note 8), header echo, transaction status,
  and a version/etag so a stale client cannot act on an old basket.
- **The error taxonomy**, mapped onto this repo's existing `ApiError` kinds
  (`auth | business | server | network | unknown`, per `.claude/rules/api-envelope.md`). A guardrail
  refusal — coupon rejected, item not sellable, claim lost, second-order refused — is a **business**
  outcome carrying a machine code, never a crash. Enumerate the codes.
- **Concurrency and staleness.** What the client does on `ClaimConflictException` / `ClaimLostException`,
  and what a second tab sees.
- **Fixtures.** Captured payloads committed to `__fixtures__` so the client can be built and
  unit-tested before the server exists — this repo's ticket 098 (`sim-payload-capture`) is the
  pattern to copy.
- **The revision protocol.** A frozen contract is a forecast; name how a change is proposed and
  landed once both tracks are moving, so the first integration does not become a negotiation.

Deliverable: the contract document, linked from this ticket and from the BackOffice side, plus the
fixture set. After this resolves, the two tracks are unblocked to `/to-spec` independently.

### Settled by [137](137-callcenter-web-door.md) — inherited, do not re-open

- **The session verbs live on `CallCenterWeb/*`**, behind the one `CallCenterGrantEndpointFilter` and
  the one `{ canOpenConsole }` probe that gates the header routes and 131's `ItemSearch`. They have no
  WPF twin, so they are born cookie-gated and need **no sibling**. 132 §7's second open question is
  therefore closed before you start; the tag is not yours to re-pick.
- 🚩 **A new ordering constraint the contract must carry.** The five `CustomerAddresses` routes are
  scoped server-side to the session's attached customer, so the address book is **unreachable before
  customer attach** and its refusal is a real wire state. `attachCustomer` therefore gates more than
  the basket, and the contract needs a typed refusal for "no open session / no attached customer /
  address belongs to someone else".

## Answer

Grilled with the owner 2026-07-27. **The contract is frozen at v1.0** and lives as an asset of this
ticket: **[CONTRACT.md](assets/136-cc-contract/CONTRACT.md)** — every verb, the whole `SessionState`
projection, the enumerated error taxonomy, concurrency and staleness, the fixture set, and the
revision protocol. Eight provisional fixtures sit beside it. Server obligations minted as BackOffice
[804](C:\Work\DMSCO\BackOffice\.issues\804-cc-session-contract-server-obligations.md).

**Both tracks are now unblocked to `/to-spec` independently.**

### The eleven rulings

| | Decision |
|---|---|
| **Verb result** | **Every mutating verb returns the whole `SessionState`.** The server has just resumed, mutated and persisted — the projection is in hand, so returning it costs one serialization, not one round trip. `getState` exists only for refresh, recovery, reload, second tab. No delta protocol, no client-side patching of a basket whose prices the server owns. |
| **Idempotency** | **Client-minted `requestId` (ULID) on every mutation**, resent verbatim on retry. A repeat returns the *current* state with `replayed: true`, never re-applies. Ledger = a ring of the last 50 on the sidecar row. |
| **Transaction id** | **Explicit on every verb**, validated as the caller's *and* `Open`. Implicit "my current order" resolution does not exist. |
| **Confirmation** | **"Are you sure" is a success, not a failure**: `200` + the *unchanged* state + a `pendingConfirmation` block with a `confirmToken`; re-sending the same verb with the token commits exactly what was previewed. One pattern for both two-phase acts on this map. |
| **Rebind** | Confirm-token on the **acting** verb (`setAddress` — the plant is usually *derived*, not chosen — and `setStore` for an override). No separate preview verb: the token **pins** the diff, so the agent provably commits what they approved. Empty basket or unchanged plant applies inline. |
| **ATP** | Same pattern. The token **is** the audit record behind the 285/286 fraud flag — it proves the agent was shown `available: 2` before accepting, which a client-set boolean cannot. Unknown ATP raises no confirmation at all (287). |
| **Guidance** | **Near-misses inline** (free from `BuildSimulationResult`), **eligible items on demand** via `GET ResolvePrereq` on the same door. Keeps 134's "no `Bby/*` route" ruling true while keeping the hot path off a grouping expansion + stock read per keystroke. |
| **Busy** | `SESSION_BUSY` is a **business** outcome with `retryAfterMs`; the bounded retry (`0·400·800·1600·3200 ms`, ~15 s ceiling) lives in **`features/callcenter/api.ts`, never `core/api.ts`** — lease semantics must not enter the layer every back-office grid shares. |
| **Header home** | A **`CallCenterSession` sidecar in SIS.Api**, keyed by `transactionId`. `SessionState` is the join of it and the engine snapshot. |
| **Fixtures** | Hand-authored **and marked provisional**, replaced by captures under a backend **conformance test** at first integration. |
| **Revision** | One document, here. `contractVersion` on every response; additive ⇒ minor bump, ship server-first; breaking ⇒ owner ruling + dated amendment + major bump + **client hard stop**. |

### Why the two that were not obvious

**Why confirmation rides the success path.** The first draft made `STORE_CHANGE_REQUIRED` a 409
carrying the preview. Then `src/core/api.ts:110-120` decided it: a non-2xx-with-envelope becomes
`ApiError(kind:'business')` carrying `message` and `errors[0].errorCode` — and it **drops
`body.data`**. The rebind preview and the token would have arrived with their payload thrown away.
The fix could have been a core change, but the better reading is that nothing *failed*: the state is
unchanged, the version has not moved, and the server is asking a question. So `pendingConfirmation`
is a state of the basket the console renders, not an exception it catches to draw a dialog — and
`ApiError` keeps meaning *refused*. Genuine refusals (`REBIND_REFUSED`, `ITEM_NOT_SELLABLE`, …) stay
on the error path where the repo's rule already puts them.

**Why the transaction id is explicit even though the server could infer it.** One order per agent
means the server can always resolve "this caller's open order" from the cookie. But then the
nastiest sequence on this map is silent: the agent abandons order A, opens B for a **new caller**,
and a forgotten tab still showing A fires an add — which implicit resolution would land on B.
Caller A's item ships to caller B. That is precisely the harm 127 refused auto-resume to prevent;
explicit, ownership-validated ids close it on the other side, as `SESSION_CLOSED(reason: abandoned)`.

### Findings this ticket surfaced

1. 🚩 **The write ordering across two stores is the contract's most fragile part.** The engine
   snapshot is in the HQ store DB, the sidecar in SIS.Api's, and there is no distributed
   transaction. The `requestId` must be **reserved before the engine mutation, recording the version
   it is about to mutate from**, and marked applied after. Reverse those and a crash in between makes
   the retry double-apply — a duplicate line on a real order, found at delivery. Both crash windows
   are named acceptance tests in [804](C:\Work\DMSCO\BackOffice\.issues\804-cc-session-contract-server-obligations.md).
2. 🚩 **`core/api.ts` drops `data` on a non-2xx** (`:110-120`). Nothing in this contract now depends
   on it — that is a design consequence, not a workaround — but any future refusal that wants to
   carry a payload needs a core change first.
3. 🚩 **`SUBMIT_UNAVAILABLE` must carry the envelope on its 503.** `core/api.ts` maps a bare
   `status >= 500` to `kind:'server'` — "unexpected" — which would turn 133's routine, retryable,
   transaction-stays-Open outcome into a crash on screen. An assertion, not a note.
4. 🚩 **`promo-view.ts:368` prints a percent as money** (`wouldSave = discount.value`, rendered
   through `formatMoney`), live today in `features/pricing/simulation/`. The contract carries **no
   `wouldSave` field at all** (spec 574 US26 — the discount *definition*, never a fabricated total),
   so the defect must be resolved as `promo-view.ts` graduates to `@/core/` per map note 13, not
   inherited by the call center.
5. ⚠ **The 098 precedent cuts against this ticket's own brief.** `payloads.ts` states that a
   hand-copied fixture is "a rule tested against a hypothesis" — an earlier effort's synthetic
   condition data had to be thrown away. Here there is no server to capture from, which is the whole
   point of the map. Resolved by labelling the hypothesis (`_contract.provisional`) and giving it a
   named, owned death: the conformance test. Until then **no client test may treat a fixture *value*
   as evidence of engine behaviour — only its shape.**

### Editorial calls (not decisions, recorded so neither track re-opens them)

- `resolvePrereq` is a **`GET`**, not the `POST` sketched during grilling — it is a pure read and
  carries no `requestId`.
- The eight reference reads 137 left off the door are **not** part of this contract; the nine gated
  PII/write routes are specified by [801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md),
  and this contract states only their ordering constraint.
- `SessionState.capabilities` (with `submitBlockers[]`) is included so the console never
  re-implements a server rule to decide what to enable. It is advisory-but-authoritative: ignoring
  it earns a typed refusal, not a wrong order.

### What this hands the two tracks

**Client (`/to-spec` in this repo):** the whole projection to render, the eight fixtures to build
against, `features/callcenter/api.ts` as the only place lease semantics live, and two states 135
must draw that only exist because of this contract — `pendingConfirmation` (both kinds) and the
`refusedExisting` open. **Server (BackOffice):** [804](C:\Work\DMSCO\BackOffice\.issues\804-cc-session-contract-server-obligations.md),
blocked on 785/786/787/798/801 — the sidecar, the ledger and its ordering, the tokens,
`ResolvePrereq`, and `CcContractFixtureTests`.
