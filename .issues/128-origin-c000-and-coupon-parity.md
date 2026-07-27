---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: done
blocked-by: —
---

# 128 — Origin becomes a real field, and coupons move with it

## Question

Note 11 establishes the bug. This ticket specifies the fix precisely enough to become a BackOffice
build ticket spanning `SIS.Pos` + `SIS.Coupons` (Note 14) — it ships to the tills too.

Evidence, so the next session does not re-derive it:

- `PcHeader.Origin` exists (`SIS.Pricing.Core/Models/PcHeader.cs:26`) and `BbyProcess` reads it —
  but **falls back to `Header.Plant` when empty**, which is why this has been invisible.
- `IsOriginAllowed` is a **prefix** match over a delimited list; empty filter allows all, non-empty
  filter with empty origin allows none.
- `Origin` is assigned in exactly three places engine-wide — `BillingService`,
  `BonusBuySimulationEndpoints`, `SimulationService`. **`PosTransaction` never sets it.**
- `CouponService` calls `IsOriginAllowed(template.OriginFilter, request.StoreCode)` — passing the
  *store code* as origin. Map 244 records CC coupons burning headless "sending StockStore", i.e.
  the fulfilment store. Same bug.
- `OriginFilterMatcher`'s own doc-comment: a coupon template and the BBy that pays it out are
  expected to share an origin filter, and "any divergence here silently unpairs them."

To decide:

- Where `Origin` enters — `TransactionOpenOptions.Origin`, threaded to `PcHeader.Origin`. Who
  supplies it for each caller: web (`C000`), physical CC device (its registered `C00n`), till (its
  own store).
- **Persistence** on `PosTransactionHeader` (owner: yes) — column, migration, and what the snapshot
  carries so a resume restores it.
- The **empty-origin fallback to Plant**: keep as a compatibility shim, deprecate, or remove. State
  the path and what breaks at tills if it goes.
- The **coupon call-site** change, and the paired-behaviour test proving a CC coupon and its paying
  BBY match the same origin. Shipping half of this is worse than shipping none.
- The **physical CC device fix** the owner flagged: setup store becomes `C001`-style while the
  plant stays the target store.
- Blast radius: are there BBYs or coupon templates authored with origin filters **today** that are
  silently mis-applying? Someone must look before the fallback changes.

## Answer

Grilled with the owner 2026-07-27. Every bullet resolved. The shape that emerged is **two layers,
both permanent**: an explicit `Origin` set at transaction open, and a `Plant`/`StoreCode` fallback
underneath it that exists for `PcHeader`s assembled *outside* the transaction engine. The bug was
never that the fallback exists — it is that nothing above it ever set the field.

Server work minted as BackOffice
[788](C:\Work\DMSCO\BackOffice\.issues\788-origin-seat-axis-and-coupon-parity.md).

### 1. Where `Origin` enters — engine-defaulted, never required

`TransactionOpenOptions.Origin` → `_origin` → `_context.Header.Origin`, assigned in
`InitializeTransactionAsync` using the same idiom as every other identity field there
(`PosTransaction.cs:883-891`):

```
_origin = !string.IsNullOrEmpty(options.Origin) ? options.Origin
        : (_environment?.Device?.StoreId ?? _storeId);
```

Rejected: making it **required** (a hard throw shipped to every till, for a value the engine can
derive) and leaving it **optional/empty** (the status quo, which is the bug). The default moves the
inference from the *pricing* layer — where it is invisible and applies to a value nobody set — up to
the *transaction-open* layer, where "this seat is the store it stands in" is a true and legible
statement about a till.

Per caller: **web** = `C000`, a server-side constant (785), never client-sent — the client has no
say in its own origin, exactly as it has no say in price (map Note 3). **Till** = defaulted to its
own store, so `Origin == Plant` there by construction rather than by downstream accident.
**Physical CC device** = defaulted to the call-center store code, which is already correct (see 5).

### 2. Persistence — sticky, "the real place where it was generated"

Owner ruling. `Origin` is written at open, carried on the snapshot, and restored **from the
snapshot** on resume. It is explicitly *not* re-derived from the claimant.

This matters because `ResumeAsync` splits identity deliberately (`PosTransaction.cs:1091-1098`):
`_storeId` comes from the snapshot, but `_registerId`/`_operatorId` are overwritten with whoever
just claimed, so audit attributes correctly. `Origin` is seat-shaped and would look like it belongs
on the register side — but its effect is on *pricing*, and under resume-per-request (Note 2) the
basket reprices on every request. Claimant-derived would make the set of eligible promotions a
function of who refreshed last. Sticky also means the persisted row records the seat that actually
took the order, which is what audit and the fraud signal want.

Reach: `TransactionOpenOptions.Origin` · a `_origin` field on `PosTransaction` · `TransactionHeader`
(the snapshot model) · `PosTransactionHeaderEntity.Origin` + `PosTransactionHeaderMap` + SQL
migration **076** (`Sartawi.Retail.Data/Modules/Pos/Sql/`, 075 is the current head). Unlike
`RecalledAt`/`SuspendedAt` — store-local provenance the engine never mints, which `CopyFrom`
deliberately leaves untouched — `Origin` **is** engine-minted, so it rides `ToEntity`/`CopyFrom`
normally.

No re-assert door. Ticket 129's rebind is about `Plant`; nothing requires moving a *seat*
mid-order, and if that ever appears it is its own door with its own re-derivations.

### 3. The `BbyProcess` fallback — **keep it, permanently**

Owner ruling, and it inverts the ticket's framing. `BbyProcess.cs:36-40` is not a compatibility shim
awaiting deprecation: it serves callers that never touch `PosTransaction` and legitimately arrive
with no origin — `SimulationService` (`:109`, `Origin = dto.Origin` from a caller-supplied DTO),
`BillingService`, `BonusBuySimulationEndpoints`, each assembling a `PcHeader` directly.

So the two layers have different jobs and both stay: the engine default (1) guarantees a
`PosTransaction`-opened header never *relies* on the fallback; the fallback covers headers built
outside the engine. Document each pointing at the other, or the next reader deletes one of them.

### 4. The coupon call-site — `Origin` alongside `StoreCode`, same fallback expression

`CouponService.cs:400` (`RedeemAsync`) and `:839` (`ValidateCouponAsync`) both pass
`request.StoreCode` into `IsOriginAllowed`. Fix: add an `Origin` field to the coupon requests and
match on `request.Origin ?? request.StoreCode`. `StoreCode` keeps its real job — audit, reporting,
which store burned the code.

The fallback is written as **the same expression** as `BbyProcess.cs:36-40`, with a comment on each
pointing at the other. This is the whole point: `OriginFilterMatcher`'s own doc-comment says a
coupon template and the BBY that pays it out are expected to share an origin filter, and "any
divergence here silently unpairs them" — so the two matchers must see the same string or we have
rebuilt the bug one layer over.

Non-breaking: every existing WPF till caller and the `POST coupons/redeem` API contract are
unchanged, because a till's origin genuinely is its store. Rejected: **requiring** `Origin` (a
contract break shipped to the tills for no gain) and **redefining `StoreCode`** to mean origin —
that is precisely how this bug was born, and it would destroy the field's audit sense.

**The pairing test** (the ticket's "shipping half of this is worse than shipping none"): given a
coupon template and a BBY carrying the *same* `OriginFilter`, assert a transaction with
`Origin = C000` gets **both or neither** — driven through `BbyProcess` *and* `CouponService` in one
test, not two unit tests that can drift apart.

### 5. The physical CC device — **ruled out of scope**

Owner ruling. The `Store` table already holds the call center **as a store**; `POSSetup` points the
device at it and the machine code comes from the registry. So under (1) a physical CC device already
opens with `Origin` = the call-center store code — seat-like, not a trading store. No defect
survives, and any device/WPF change is a BackOffice concern outside map 126's destination.

### 6. Blast radius — **no survey needed**

Owner: the new POS / new engine is **not live**. No production transaction reaches `BbyProcess`
through `PosTransaction` today, so the one live behaviour change this fix could have caused has no
traffic to change. Nothing to query, nothing blocking.

### 7. The submitted CLCN document does not carry `Origin`

`CallCenterOrderHeaderInput` has `DocumentSource` + `SourceReference`
(`CallCenterOrderDocumentBuilder.cs:19-20`), but those are Note 6's *header capture* — the
business-level "how did this order arrive", chosen by the agent. `Origin` is the technical seat.

No new document field: the engine transaction row holds `Origin` (sticky, persisted) and the
document links back to it via `SubmissionReference`/`OrderNo` — owner: "we will have a linked copy
of the `PosTransaction` that uses submission reference / orderNo". Reusing `DocumentSource` to carry
`C000` was rejected outright — it is this ticket's own mistake a third time, and `DocumentSource` is
agent-chosen so it would be wrong as often as right.
