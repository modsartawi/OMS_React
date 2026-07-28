---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: done
blocked-by: —
---

# 178 — The transaction absorbs the sidecar

## Question

**Owner ruling, 2026-07-28**, given while resolving
[175](175-nothing-enters-an-unaddressed-order.md):

> *"We will need to expand our `PosTransactionOrder` model to include these data — like we will need
> `PosTransactionAddress` for example, to have the address in the pre-order object (`PosTransaction`).
> As you know the WPF is in-memory and in-process, but since we are moving to web and it's stateless,
> we should save everything inside the `PosTransaction` object."*

That reopens the most load-bearing structural decision on this map.
[136](136-session-api-contract.md) froze `SessionState` as a **join of two stores**
([CONTRACT.md §1.2](assets/136-cc-contract/CONTRACT.md)): the engine snapshot in the HQ store DB
holds plant, origin, lines, pricing, promotions and version; a **`CallCenterSession` sidecar** in
SIS.Api's own DB holds customer, address, slot, document source, source reference, order note,
`hasBelowAtp`, the `requestId` ledger and the confirm tokens. 136 called the write ordering across
those two stores *"the single most fragile thing in the contract"* ([§6.4](assets/136-cc-contract/CONTRACT.md)).

**The owner's instinct has real ground under it.** The engine snapshot already carries 1:1
companions of exactly this shape:

- `PosTransactionSnapshot.Loyalty` (`LoyaltyInfo`), `.Insurance` (`TransactionInsurance`), `.Order`
  (`TransactionOrder`) — each *"a separate table/document, not inlined on the header"*.
- `TransactionOrder` persists as `PosTransactionOrderEntity` (PK == FK == `TransactionId`), written
  through `IPosTransaction.SetOrderInfoAsync`, `RequireOpen`-guarded, audit-logged, and
  **round-tripping through `ResumeAsync`** — proven by `PosTransactionOrderInfoPersistenceTests`.
- It already holds `DeliveryType` — the very field v1.1 put in the sidecar.

So a `TransactionAddress` sibling is an **extension of a shipped pattern**, not a new mechanism. And
resume-per-request ([127](127-engine-session-lifecycle.md)) already resumes the whole snapshot on
every mutation, so the sidecar buys no round-trip it saves.

## What this ticket must actually decide

Not *"is the owner right"* — they have ruled. What is undecided is how far the absorption goes and
what it costs:

- **Which fields move, and which cannot.** Customer, address, slot, document source, source
  reference, order note and `deliveryType` are all order data and look like they belong. But the
  **`requestId` ledger and the confirm tokens are not order data** — they are SIS.Api's protocol
  state, and §4's ledger is a bounded ring the engine has no concept of. If they stay behind, the
  sidecar does not disappear and §6.4's ordering problem does not either; it only shrinks. Is a
  sidecar holding *nothing but protocol* still worth having, or does the ledger become an engine
  concern too?
- **Does §6.4's write ordering dissolve or just move?** The rule exists because a crash between two
  stores can double-apply a line on a real order. One store means one `SaveAsync` — but only if
  everything in the same user action lands in that one save. Prove it, or name the residue.
- **What does the engine door look like?** `SetOrderInfoAsync` is the precedent, but it takes a
  whole `OrderInfo` and is `RequireOpen`. Do address / customer / note get one door each, one
  `SetOrderContextAsync`, or does `TransactionOrder` simply grow fields? A door per field is a
  BackOffice change per field forever.
- **Does the snapshot schema version bump, and what does that cost the tills?**
  `PosTransactionSnapshot.SchemaVersion` is real, and this snapshot is the *same* snapshot every till
  writes. A companion that is null for walk-in sales is the pattern (`Order` already is) — confirm
  that is genuinely free and not a migration across live till data.
- **What happens to [133](133-submission-path-server-side.md)'s builder input?**
  `Cc2DocumentHeaderBuilder` is fed from the sidecar row today. If the fields move into the snapshot,
  the builder's input moves with them — possibly *simplifying* 133, possibly invalidating the part of
  it that was reasoned on the sidecar.
- **Is `PosTransactionAddress` a new entity or a growth of `PosTransactionOrderEntity`?** The owner
  named the former. `BusinessAddress` is 25 fields of which CC2 writes nine
  ([175's CC2 inventory §2](assets/175-cc2-inventory/CC2-INVENTORY.md)) — a real table, not three
  columns. It also has to answer [179](179-the-address-editor-and-its-capture-contract.md)'s question
  about what the web actually captures.

⚠ **Contract impact.** This is invisible to the client — every field is projected into `SessionState`
identically either way, which is exactly why 175 could ship v1.3 without waiting for this. But it
**rewrites §1.2 and may delete §6.4**, and §6.4 is currently an acceptance-test obligation on
BackOffice [804](C:\Work\DMSCO\BackOffice\.issues\804-cc-session-contract-server-obligations.md).
Deleting a hazard is a bigger claim than adding a field: it needs the proof, not just the intent.

⚠ **Sequencing.** BackOffice
[871](C:\Work\DMSCO\BackOffice\.issues\871-cc-opening-gate-and-plant-source.md) is building against
the sidecar as it stands. That is deliberate and not wasted — 871's fields are projection-side. But
the longer both are in flight the more of 871 gets written twice.

Deliverable: the ruling on how far the absorption goes, written as the §1.2/§6.4 amendment plus the
BackOffice issue for the engine and store changes.

---

## Answer — 2026-07-28

**The absorption does not happen. `CallCenterSession` stays exactly where it is, it is the home for
every non-engine field the console needs, and the engine is not touched.** Owner ruling, withdrawing
the one that opened this ticket:

> *"You did a great job with the `CallCenterSession` and we can add columns there — any missing
> column that we might need — so we don't touch the engine. We just need to make sure we capture all
> needed information there."*

Contract §1.2's two-store join **stands as frozen**; the 🚩 under-review flag 175 put on it is
removed. No amendment, no BackOffice issue, no snapshot bump.

### The ruling is better-supported than a withdrawal

Four things surfaced while grounding the original ruling, and three of them argue for the sidecar
independently of who ruled what.

**1. 🚩 The protocol state cannot move, and it is what §6.4 protects.** The `requestId` ledger and the
confirm tokens are not order data — and they are physically unable to live in the snapshot.
`CallCenterEngineSession.ScopeAsync` deliberately **never flushes**: §5's ask half runs the engine
door and must not keep the result, and 798 requires the refused-rebind instance be *"discarded
without `SaveAsync`"*. Writing a confirm token into the snapshot would mean flushing precisely the
preview the design says must die with the scope — committing a re-price the agent never authorised,
and letting their confirmation read as a replay. So under **any** absorption the sidecar survives
holding the ledger and the tokens, which means **§6.4's two-store ordering survives too**. The
absorption would have paid engine risk and removed nothing. That is the finding that settles it.

**2. The `SaveAsync` companion guard collides with v1.3 on contact.** `PosTransactionStore` treats a
null companion as *"don't touch"*, not *"clear"* — an explicit guard protecting rows backfilled from
the legacy shadow by migration 057 (`PosTransactionStore.cs:171-179`). But
[175](175-nothing-enters-an-unaddressed-order.md) just ruled that `removeCustomer` **clears** the
customer and the address. The engine has no clear-flow, so absorption would have needed either a new
tombstone door or a relaxation of the exact guard whose comment warns it *"would silently erase the
backfilled provenance on any later resave."* A live legacy-data hazard, in exchange for tidiness.

**3. 804 had already written the reasoning down, and it held.** `CallCenterSession`'s own class
comment: *"785 is already SIS.Api's first server-side engine construction … reshaping the snapshot
that ships to every till in the same breath widens that risk for no gain. Nothing on this row is
price-affecting, which is what makes an orphaned sidecar row recoverable."* The ticket treated that
as an assumption to re-test. It survived the re-test.

**4. The one honest point for absorption, recorded so it is not lost.** The snapshot bump would
**not** have been the expensive part: `PosSnapshotSchema` is at v8 and **v4 was literally this
pattern** — *"order metadata — `PosTransactionSnapshot.Order`. Additive/nullable; legacy snapshots
load with `Order = null`."* A `TransactionAddress` companion is a well-worn, cheap move, and
`TransactionOrder` **already carries `DeliveryType`**. What absorption genuinely buys is
**provenance**: the address travelling inside the snapshot, visible to the sweeper, the reconciler,
FindInvoice and a future web till. That payoff is real and it is simply not worth findings 1 and 2.
If it is ever wanted, it returns as its own effort with its own design — not as a resumption of this.

### 🚩 The residue, and a cheap way to remove it

Ruling the absorption out leaves **§6.4's double-apply hazard exactly where it was** — the map's own
*"single most fragile thing in the contract."* One option removes it and **still does not touch the
engine**, so it sits inside the owner's ruling rather than against it:

> Move the `CallCenterSession` **row** onto the `CallCenterStore` connection (the HQ store DB), where
> the engine snapshot already lives. `CallCenterSessionMap` is on the same `DataAccess.SessionFactory`
> that `CallCenterStoreContext` opens its session over, so this is a table create plus a resolution
> change — **no entity change, no map change, no engine change**. And `PosUnitOfWork` is already
> **ambient-aware** (issue 029a): if the caller has opened a transaction on the same `IUnitOfWork`,
> the engine *joins* it and `CommitAsync` only flushes, *"so the engine terminal write + the legacy
> shadow + the shift record can land in ONE db transaction"* — the WPF per-sale bracket uses this
> today. One transaction means no reservation, no version arbitration, and no crash windows: §6.4
> would dissolve, and `CallCenterRequestLedger`'s two-store resolution logic would become dead code
> rather than an acceptance-test obligation.

**Not ruled here** — it is a different question from this ticket's, it was never put to the owner,
and it is not free (it moves a table between databases and changes what `ICallCenterSessionStore`
resolves over). Recorded on the map's **Not yet specified** rather than invented as a decision.

### The audit the owner asked for

*"We just need to make sure we capture all needed information there."* Against every ruling the map
now holds:

| Needed | Sidecar today | Action |
|---|---|---|
| customer id / name / mobile / loyalty | ✅ 4 columns | — |
| address number + display projection | ✅ 8 columns | — |
| plant + how it got there | ✅ `StoreCode`, `PlantSource` | ⚠ **default must change** — the property initialises to `OperatorOverride`, which is the exact defect [175](175-nothing-enters-an-unaddressed-order.md) closed. It becomes `SeededAtOpen`, and the two new values (`seededAtOpen`, `chosenForPickup`) join `CallCenterPlantSources`. Already on BackOffice [871](C:\Work\DMSCO\BackOffice\.issues\871-cc-opening-gate-and-plant-source.md) |
| fulfilment mode | ✅ `DeliveryType` | — |
| slot (5 fields) | ✅ 5 columns | — |
| document source + source reference | ✅ 2 columns | — |
| below-ATP flag + its audit | ✅ `HasBelowAtp`, `BelowAtpLedger` | — |
| protocol (version, ledger, tokens) | ✅ 3 columns | — |
| lifecycle + minted order no | ✅ 4 columns | — |
| **order note** (v1.3, owner-ruled in) | ❌ **missing** | **add `OrderNote`** — `StringMaxType`, free text, never price-affecting. On 871 with the `setOrderNote` verb |
| **payment type** (COD / online) | ❌ **missing** | **not yet** — [155](155-payment-type-cod-or-online.md) is unresolved and owns the ruling. The owner flagged it while resolving 175 (*"we might need the payment type"*), and the P2E-forces-online rule needs somewhere to land. Recorded on 155, not pre-built here |
| the nine fields CC2 **writes** when creating an address (`BuildingNumber`, `Phone1/2`, `ShortAddress`, `GpsLat/Lon`) | ❌ absent, **and correctly so** | **no columns.** The sidecar holds `AddressNumber` — the address book row is the system of record and the extra fields are read through it. They are a *capture* contract, which is [179](179-the-address-editor-and-its-capture-contract.md)'s question, not a session-state one |
| `plantName` | ❌ no column, **correctly** | server-supplied at projection time; a delivery-only store is in no client-held list, so it is looked up, not stored |

So the whole of "capture all needed information" reduces to **one new column** (`OrderNote`), **one
changed default** (`PlantSource`), and **one deferred** (payment type, awaiting 155). Both of the
first two are already on 871; its 178 caveat is removed.
