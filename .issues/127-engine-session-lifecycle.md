---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: done
blocked-by: —
---

# 127 — What a web agent's engine session is, precisely

## Question

Map Note 12 settles the shape (synthetic register, no `POSMachine` row, shiftless flag moves
server-side, one active order per agent). This ticket turns that into a specification precise
enough for both the engine ticket and the API contract (136).

- **Identity.** What exactly is `register` for a web seat — staff id, a per-browser-session id, or
  a provisioned seat code? `TryClaimAsync(transactionId, register, operatorId, lease)` makes
  `register` the claim holder, so the choice decides who can steal whose transaction and what
  happens when the same agent opens a second tab.
- **Origin binding.** `Origin` is fixed `C000` for web (Note 11) — is that a constant, config, or
  per-seat? Decide here; 128 implements it.
- **The shiftless flag.** ADR-0001 keys shiftless on the WPF device type. What replaces it
  server-side — a property of the doctype, of the open options, or of the caller's channel? Name
  it, and state what an accidental non-CC doctype on that channel does (the engine's armed shift
  gate refusing loudly is the current design, per 279 item 4).
- **Lease mechanics.** Lease duration, heartbeat cadence (or whether resume-per-request makes
  heartbeats unnecessary), what an expired lease means mid-call, and how `ClaimConflictException` /
  `ClaimLostException` surface to an agent.
- **Single-active-order enforcement.** Refuse the second `open`, or offer to resume the first?
  What the API returns either way.
- **Abandonment.** When does an untouched transaction die — the existing
  `StaleTransactionSweeperService` (which auto-voids via `ResumeAsync(id, "SYSTEM", "SYSTEM:AUTO_VOID", …)`),
  a CC-specific window, or explicit only? Coupon reversal must ride whatever is chosen.
- **`PosEnvironment` / login.** 279 keeps `env.SetLoggedInAsync(staffId)` on shiftless devices so
  HQ telemetry survives. What is the web equivalent, and does an agent "log in" to the engine at
  all or only per transaction?

Deliverable: the session model written down, and the engine-side changes it implies minted as a
BackOffice issue (Note 14).

## Answer

Grilled with the owner 2026-07-27. The session model below is settled; the server-side work it
implies is minted as BackOffice
[785](C:\Work\DMSCO\BackOffice\.issues\785-web-cc-engine-session.md).

### The model

| | Decision |
|---|---|
| **Identity** | `register` = `WEB-<loginId>` — **per agent, not per tab, not a provisioned seat**. `operatorId` = staff id. No `POSMachine` row. Fits `ClaimedByRegister VARCHAR(26)` (`001_create_pos_mvp.sql:61`), which a raw GUID would not. |
| **Origin** | `C000`, a **server-side constant** bound in SIS.Api's CC open path. Never client-sent, never per-seat, never a `TransactionOpenOptions` default (a till must not inherit it). |
| **Shiftless** | **Not a flag.** SIS.Api resolves the lock-store-less `BuildCallCenterSubmissionFactory`, **keyed on doc type** `CallCenterOrder`. Non-CC doctype is refused at the endpoint before the engine; the engine's armed gate stays the loud backstop. |
| **Lease** | **15 s**, held for one request, released in `finally`. **No heartbeats.** |
| **Concurrency** | **Strict claim**: same register + unexpired lease ⇒ **conflict, not grant**. This is the cross-pod mutex. |
| **One order per agent** | Server **refuses** the second `open` and returns the existing `transactionId`; the client offers *resume* or *abandon-and-open-fresh*. **Never silent auto-resume.** |
| **Abandonment** | Explicit abandon (`VoidTransactionAsync`) is the path. Existing sweeper, armed in the HQ DB, `OpenTtlHours = 12`. No CC-specific idle window. |
| **Engine login** | **None.** No `IPosEnvironment`, no LOGIN/LOGOUT events; options built explicitly. |
| **Persistence** | Live web CC transactions land in the **same HQ store DB** as today's WPF CC orders. |

### Why, and the evidence

**Per-agent register.** `TryClaimAsync` grants when no lease is held, when it expired, *or when the
caller already holds it*. A per-tab id makes an agent's second tab a different register, so their
own order throws `ClaimConflictException` against themselves and we'd have to build steal-from-self
machinery for a problem we created. A provisioned seat code reintroduces exactly the `POSMachine`
provisioning Note 12 deleted. Per-agent also makes the conflict message name a *person* — the only
thing an agent or supervisor can act on.

**Origin as a constant.** `OriginFilterMatcher` scopes by **prefix** (`"C"` ⇒ `C*`), so every `C0xx`
prices identically — the digits carry identity, not pricing. Per-seat would silently create a
per-agent pricing axis the day someone writes a promo filtered to `C00`. Config invites a
whole-channel pricing outage from one appsettings edit. `C000` *is* the web channel, so a future
web-only promotion filters on it exactly. ⚠ `TransactionOpenOptions` has **no `Origin` field at
all** today — binding it is a new engine door, and it belongs to [128](128-origin-c000-and-coupon-parity.md), not here.

**Shiftless needs nothing new.** The mechanism already exists and is composition-time, not a flag:
`BuildCallCenterSubmissionFactory` (`PosServiceCollectionExtensions.cs:334`) is the shared factory
with `lockStore: null`, and `EnsureShiftAcceptingTransactionsAsync` no-ops precisely when
`_lockStore` is null. Keeping it **doc-type-keyed** preserves ADR-0001 item 4's deliberate posture
so WPF and web state the same rule: a channel flag would say "this caller may skip shift gates" —
a permanent hole the next endpoint on that channel inherits silently.

**Strict claim, because there is no other mutual exclusion.** 🚩 `PosTransactionStore.SaveAsync`
writes `Version = Header.Version + 1` — a **blind increment, not a predicated update**. So the claim
is the *only* protection, and per-agent registers mean two tabs both get granted: both resume at
version *N*, both save *N+1*, and the second write wins wholesale — a line the customer asked for
silently vanishing, discovered at delivery. An in-process mutex is insufficient (two tabs, two
pods), so the lease itself becomes the cross-pod lock. **15 s, not 60**: strict claim turns the
lease into the self-lockout window when a request dies after claiming and before its `finally`, and
15 s comfortably exceeds a healthy resume→mutate→persist round trip while capping the lockout at
something the client can ride out with an automatic retry.

**No heartbeats, no expiry mid-call.** `HeartbeatAsync` exists for a pinned desktop session holding
a claim across think-time. Resume-per-request has no think-time inside the lease, so there is no
"your session expired" state to design.

**Refuse the second open.** Auto-resume means an agent who has just picked up a **new caller** and
clicked "new order" silently inherits the **previous** caller's basket — and since the header rebind
is a separate step they may not revisit, items from caller A can ship to caller B. The refusal names
the situation ("order in progress for <customer>, N lines") and makes them choose; only they know
how the last call ended. Enforcement is one indexed read (`PosTransactionHeader.RegisterId` +
`Status = Open` + doctype). *Consequence accepted:* after a crash or closed tab the agent's next
action is always this refusal — which **is** the reconnect story, and gives "what do I see on
refresh" a server-side answer instead of client-side draft storage (why CC2's `Cc2DraftAutoSave` has
no web equivalent).

**Sweeper as hygiene only.** 🚩 The predicate is **age since `OpenedAt`**, not idle-since-last-touch
(`StaleTransactionLookupService.cs:60-63`), and it skips only rows with a **live claim** — which
under resume-per-request is dead between requests. So a call running past `OpenTtlHours` is
sweepable **mid-conversation**. Tight reclamation buys nothing (the single-active-order refusal
already unblocks the agent, so nobody waits on the sweeper) and its failure mode is catastrophic: a
basket vanishing while the agent is on the phone. Hence 12 h, and no new idle-based predicate — that
is a small follow-on if orphan rows ever actually hurt. ✅ Coupon reversal rides for free:
`CollectReversalContexts()` walks `_coupons` and emits a `ReversalContext` per coupon on **any**
void, including the sweeper's `SYSTEM:AUTO_VOID` — *provided the host running the void has the
reversal handlers registered*, which is a composition requirement on SIS.Api.

**No engine login.** `PosEnvironment` is a stateful desktop object: it holds `_operator` in a field
and throws if one is already logged in, and its `Device` carries a **fixed `StoreId`** — which a web
agent does not have (the plant is per-order and rebinds mid-basket, [129](129-rebind-store-door.md)).
A per-request environment on a stateless API would emit a LOGIN audit event on *every* mutation.
What ADR-0001 was protecting survives anyway: `operatorId` is stamped on the header and on every
audit event including reversals, so per-transaction attribution is complete; and session-level
telemetry already lives better on the web side (this repo's Active Sessions screen, map 001) than a
synthetic device row with an identity for a `RegisterId`, a lie for a `StoreId`, and no logout when
a tab closes. If HQ ever wants the one-query union back, the honest form is a deliberate
web-agent-session feed — a separate effort.

### Findings this ticket surfaced

1. 🚩 **`SaveAsync` has no optimistic-concurrency predicate** — blind `Version + 1`. The claim is
   the only mutual exclusion in the engine. Drives the strict-claim change.
2. 🚩 **The sweeper cannot protect a live web order** — its claim guard is dead between requests and
   its TTL is age-since-open, not idle. Drives the 12 h window.
3. ⚠ **SIS.Api has never constructed an `IPosTransaction`.** Note 1 overstates the substrate:
   `SIS.Api.csproj` references `SIS.Pos 26.4.113` and `Sartawi.Retail.Data`, but
   `RefundLedgerEndpoints` only *mentions* `IPosTransaction` in a comment — the work runs through
   `ParkedReturnResumeService`. The first web session is the **first server-side engine
   transaction**, and SIS.Api's only POS connection today (`PosServer`) is the read-only sync
   **sink**, not a live engine store. A live HQ-DB connection is new composition.
4. ⚠ **`TransactionOpenOptions` has no `Origin`** — [128](128-origin-c000-and-coupon-parity.md) owns
   the door; this ticket only fixes the value and where it is bound.

### What this hands 136

The contract needs: `open` returning a conflict-shaped refusal carrying the existing
`transactionId`; every mutation carrying `transactionId` and tolerating a **busy** business refusal
(strict-claim collision) that the client retries automatically within ~15 s; `getState` as the
universal recovery action after any conflict; and no session/login verb at all — the "session" is
the transaction, and the agent's identity rides the auth token.
