---
type: wayfinder-map
status: open
---

# 126 — The call center goes to the web

## Destination

Every decision resolved so the phase-1 web call center can be built on two parallel tracks —
concretely: a **`ready` spec in this repo** for the web client (`features/callcenter/`), and the
backend decisions **minted as BackOffice issues** for the engine (`C:\Work\Pricing\SIS.Pricing`,
shipped as an `SIS.Pos` pack) and SIS.Api. The map is done when nothing is left to investigate or
choose before `/to-spec` → `/to-tickets` on this side and the equivalent on the BackOffice side.

Phase 1 replaces the WPF call center (CC1 `NewOrderController` + CC2) for the **plain CLCN cash
order only**. The web client becomes the main call-center surface once it matures.

## Notes

Charting decisions (owner, grilling 2026-07-27) — constraints every session on this map respects.
These are **settled**; a session may implement them, not re-open them.

1. **Engine-as-a-service, not a client engine.** SIS.Api opens a real server-side
   `CallCenterOrder` `PosTransaction`. SIS.Api already ships the engine (`SIS.Pos 26.4.113`, and
   `RefundLedgerEndpoints` already touches `IPosTransaction`) — the substrate exists.
   ⚠ **Corrected by 127:** the package reference is real, but SIS.Api has **never constructed** an
   `IPosTransaction` — `RefundLedgerEndpoints` only mentions it in a comment, and its only POS
   connection (`PosServer`) is the read-only sync *sink*. The decision stands; the substrate is
   thinner than this note implied. Built so a
   future web till can stand on it, but **the till is out of scope** (see Out of scope).
2. **Resume-per-request, never a pinned session.** Every mutation is `TryClaimAsync` (lease) →
   `ResumeAsync` from the persisted snapshot → mutate → persist → `ReleaseClaimAsync`. SIS.Api
   stays stateless and horizontally scalable; the existing claim/lease/heartbeat/
   `StaleTransactionSweeperService` machinery *is* the session management. Latency accepted by the
   owner as the price of those properties.
3. **The client sends intent, never money.** Wire vocabulary is `{itemNumber, qty}`,
   `{lineId, newQty}`, `{couponCode}`, `{customerId}`, `{storeCode}` — never a price, discount,
   condition amount, or total. The CLCN document posted to `CallCenter/SubmitOrder` is built
   **server-side from engine state**, never from anything the browser sent. Amounts are one-way:
   engine → client, display only. Strictly stronger than WPF today, where
   `CallCenterOrderDocumentBuilder` runs on the client machine.
4. **No price-affecting power.** No verb on the session API accepts an amount —
   `AddManualConditionAsync` and friends are never exposed. Verified faithful: `ChangePrice`,
   `ManualCondition`, `Discount`, `OpenPrice`, `SetPrice` have **zero occurrences** anywhere in
   `Sartawi.POS/CallCenter/` or `CallCenter2/`.
   > 🚩 **Corrected 2026-07-27** (owner gap review → [156](156-delivery-fee-shared-rule.md)). The
   > sentence that stood here — *"so this removes nothing agents have today"* — is **false**. The
   > verification grepped five method names, and the power it missed does not carry any of them:
   > `NewOrderView.xaml:192-200` gives the agent a radio pair, **"Add Delivery Fees" / "No Fees"**,
   > which changes what the caller pays. Note 4 **does** remove one power agents hold today.
   > Owner ruling at the review: the principle stands and the fee becomes **rule-driven, with no
   > manual waiver** — `waived` is an outcome the agent is shown, never a control. A waiver, if the
   > business wants it back, returns as its own effort with its own authorization design.
5. **The verb list** (each mapping to a door on `IPosTransaction`):
   open · abandon (`VoidTransactionAsync`) · submit · `addItem` (`ScanAsync` +
   `ScanOptions.AtpAtScan`) · `changeQty` (`ChangeQuantityAsync`) · `voidLine` · `changeUom` ·
   `attachCustomer` / `removeCustomer` (`SetLoyaltyAsync` / `ClearLoyaltyAsync`) ·
   `applyCoupon` (`AddCouponAsync`) · `getState`. **Ruled out of phase 1:** `replaceLine`
   (`ReplaceItemAsync`), placeholder/text lines (`AddPlaceholderLineAsync`), prescription controls
   (`SetLineControlAsync` / `SetTransactionControlAsync` / prescribed quantity).
6. **Header capture is in phase 1** — customer, address, fulfilment store, slot, document source,
   mandatory source reference. Not optional: the engine binds `PcHeader.Plant` **once at open**
   (`PosTransaction.cs:883`, `:950`), so the store must be known before the first item, and it
   drives every price and every ATP read.
7. **Store change mid-basket is a plant rebind, not a void+replay.** Owner ruling. Requires a NEW
   engine door — verified absent: `_storeId` is written in exactly two places in
   `PosTransaction.cs` (`OpenAsync:883`, `ResumeAsync:1096`), and `IPosTransaction` has
   `RebindShiftAsync` but no store equivalent. The door must carry five re-derivations, not just a
   re-price (ticket 129).
8. **ATP is a soft gate.** Below-availability adds are allowed but carry a **server-computed**
   warning the agent acknowledges, and the order carries a flag. `AtpAtScan` stays frozen at add
   for the BackOffice fraud signal (285/286); *displayed* availability is separately refreshable.
   Stock-service failure degrades to unknown-ATP and never blocks entry (287's rule preserved).
9. **Item search returns catalogue + ATP + price on every row.** Owner supplies the raw SQL
   (ticket 131). A row price is a **store list price**, not the basket-aware promoted price — the
   UI must label it so. No item-search endpoint exists in SIS.Api today.
   ⚠ **Corrected by 131:** the row price is **not** a store list price and will not become one —
   owner ruling. It is `Item.UnitPrice`, a **material-master** column (not plant-scoped, not
   engine-priced), served as an **ex-VAT estimate** and labelled as such. Because `MWST` is a
   separate 15% condition on top of the net, the row reads ~13% **below** the basket line, so the
   labelling requirement is stronger than this note implied, not weaker.
10. **Promotion guidance is actionable, not informational.** A near-miss resolves its unmet
    prerequisite to the **actual eligible items** (grouping members), ATP-filtered at the order's
    store, with one-click add. This is the highest-value feature on the map. Blocked on the server
    actually populating `potentialBonusBuys[].prerequisites` (ticket 130).
11. **Origin is a real axis and it is broken today.** `Origin` = the *seat* (CC physical devices
    are `C001`, `C002`…; **the web is fixed `C000`**; a till's origin is its own store, so
    `Origin == Plant` there). `Plant` = the fulfilment store. Promotions and coupon templates scope
    by **Origin prefix** (`OriginFilterMatcher`, filter `"C"` ⇒ `C*`). `PosTransaction` never sets
    `Origin`, and `BbyProcess` **falls back to Plant when it is empty** — correct by accident at a
    till, wrong both ways in the call center. Owner confirms this is a bug (ticket 128).
    ⚠ **Refined by 128:** the fallback itself is **not** the defect and is kept permanently — it
    serves `PcHeader`s built outside the transaction engine. The defect is only that nothing above it
    ever set `Origin`, which 128 fixes at transaction open.
12. **Web agent identity** = synthetic register (`register` = the agent's seat, `operatorId` = staff
    id), **no `POSMachine` row**. The shiftless decision moves from the WPF device predicate
    (ADR-0001, `POSType == PosType.CallCenter`) to a **server-side transaction-context flag**. The
    rule stands; only the predicate moves. **One active order per agent**, enforced server-side.
13. **Client lives here** — `features/callcenter/` under `oms-react`, per
    `.claude/rules/feature-structure.md`, **behind an access probe that fails closed** (ticket 125's
    pattern: one shared cache key for the nav leaf and the route guard; what is behind it mints real
    orders). It renders its **own full-viewport layout** — session/auth/theme from the shell, not its
    nav chrome. `promo-view.ts` graduates from `features/pricing/simulation/` to `@/core/` rather
    than being copied (a feature may never import a feature).
14. **Backend decisions are minted as BackOffice issues** (`C:\Work\DMSCO\BackOffice\.issues\`),
    linked from here by absolute path — the engine and SIS.Api ship to the tills too.
15. **Contract-first parallelism.** One early, blocking ticket (136) freezes the session API
    contract; both tracks then run free and meet at an integration slice. The frontend builds
    against captured fixtures — this repo's own ticket 098 (`sim-payload-capture`) is the pattern.
    A frozen contract is a forecast: expect one deliberate revision after first integration.

Prior art this map stands on — read before deciding anything adjacent:
BackOffice map [244](C:\Work\DMSCO\BackOffice\.issues\244-newpos-callcenter-order-entry.md) (done)
and spec [267](C:\Work\DMSCO\BackOffice\.issues\267-cc-order-entry-submission-spec.md) (ready)
already shipped the `CallCenterOrder` doctype, the `POST CallCenter/SubmitOrder` once-only mint
([269](C:\Work\DMSCO\BackOffice\.issues\269-sisapi-cc-submission-hook.md)), the explicit submit
orchestration ([278](C:\Work\DMSCO\BackOffice\.issues\278-cc-submit-explicit-wpf-orchestration.md)),
and the shiftless-device ADR ([279](C:\Work\DMSCO\BackOffice\.issues\279-cc-devices-shiftless.md)).
CC2's [RESEARCH.md](C:\Work\DMSCO\BackOffice\Sartawi.POS\CallCenter2\RESEARCH.md) is the agent-desktop
UX research the WPF build could never fully execute.

Skills: `/grilling` + `/domain-modeling` by default; `/research` for the AFK tickets; `/prototype`
for the console layout.

## Decisions so far

<!-- the index — one line per resolved ticket -->

- [What a web agent's engine session is, precisely](127-engine-session-lifecycle.md) — `register` is
  **per agent** (`WEB-<loginId>`), not per tab; `Origin C000` a server-side constant; shiftless stays
  **doc-type-keyed** (the lock-store-less factory already exists — no new flag); **strict claim** as
  the cross-pod mutex with a **15 s** lease and **no heartbeats**, because `SaveAsync` blind-increments
  `Version` and the claim is the only mutual exclusion; the second `open` is **refused** with the
  existing id, never silently resumed; sweeper armed at **12 h** (its predicate is age-since-open and
  its claim guard is dead between requests); **no `IPosEnvironment`, no engine login**; live rows land
  in the **HQ store DB**. Server work minted as BackOffice
  [785](C:\Work\DMSCO\BackOffice\.issues\785-web-cc-engine-session.md).
- [What header capture actually requires (CC1 + CC2 inventory)](132-header-capture-inventory.md) —
  **Note 6 overstated the cost**: eleven of twelve header fields already have live SIS.Api endpoints
  and five are already wired in this repo, so header capture needs **no new server data** — the one
  real gap is a **door** (every route is `ApiKeyEndpointFilter`-only), minted as
  [137](137-callcenter-web-door.md). The **time-slot rule and its `1283`/`1154` exemption are
  Wasfaty-only** and fall out of the CLCN cut; CLCN gets CC2's *soft* slot gate instead. **CC1 derives
  the store from the address's city, CC2 from its district — CC2 is right, and this repo already
  implements its `tempStoreCode || storeCode` rule** as pure code ready to graduate to `@/core/`.
  129 gains two silent rebind triggers (an in-place address edit; ops flipping `TempStoreCode`, with
  no operator action at all). Slots need no new contract. `Cc2DocumentHeaderBuilder`'s field list is
  133's server-side spec; `Cc2LaunchSeed` is dropped (all three seeds are out-of-scope kinds, and the
  cash caller passes none). Full inventory:
  [asset](assets/132-header-capture-inventory.RESEARCH.md).
- [How the web submit reuses 278's orchestration, server-side](133-submission-path-server-side.md) —
  **in-process, not HTTP-to-self**: once-only lives entirely *below* the HTTP boundary, so a loopback
  hop buys nothing and costs a forged principal plus a new timeout ambiguity; the till's endpoint
  stays byte-identical. The builder needs **no move** — already pure, already in the assembly SIS.Api
  references; what is WPF-resident is its **input**, the issue-198 line mirror, which already exists
  server-side as a private test helper to promote. Once-only shipped as **(OrderNo, DocumentType)
  with OrderNo := TransactionId**. Operator identity needs **nothing new** (session-row claims,
  browser headers ignored); `EntryStore` ruled = the agent's switcher store, unmodified. 🚩
  **`RecoverStaleAsync` has zero production callers** — there is no WPF recovery leg to port; 🚩 and
  127's 12 h sweeper would **auto-void a transaction whose order was actually minted**, firing coupon
  reversal on a live order ⇒ a hosted reconciler plus a sweeper guard. 🚩 The delivery-fee **rule** is
  WPF-only (`POSCommon`) and must become shared code or the web quotes a different fee from the till
  — the fee itself stays a `DFEE` document condition, so Note 7 holds. Server work minted as
  BackOffice [786](C:\Work\DMSCO\BackOffice\.issues\786-web-cc-submission-path.md).
- [Can the server tell an agent *which items* would fire a missed promotion?](130-potential-bby-prerequisites.md)
  — **yes for the buy side, no for the get side.** `prerequisites[]` is **not** dead: it is filled on
  every candidate; the captures read `[]` because both captured promotions carry **zero prereq rows**
  (second-piece promos whose rule is entirely condition-side, where `ApplyBby` bails recording
  nothing). BackOffice **already shipped the guidance projection** (spec 574 / 579
  `AvailableOffersBuilder` — "add N more", m/n progress, `IsReady`, ready-first sort), and
  `PricingContext.BuildSimulationResult` projects a **live** transaction with no re-price — that *is*
  `getState()`'s promotion seam. A prereq's eligible items are already exploded one-row-per-material
  and are the **same set** evaluation matches, but both builders **collapse them to `[0]`**, which
  also mis-types a grouping as a single material (a live WPF defect). 🚩 **The real blocker is
  discovery**: BBY lookup keys on the *condition-side* access tables only, so a basket holding only
  the buy-side item of a "buy X get Y" promotion **never loads that promotion at all** — the map's
  headline feature is half-blind until that changes, and the fix carries a correctness and a hot-path
  question. `Bby/GroupingMembers` already exists (⚠ gated on the Bonus-Buy Inquiry grant — 134's
  problem). ATP filtering ruled into **SIS.Api** beside 131's read. 128 shifts *which* promotions
  appear but does **not** block 136, provided the skip reason ships as a typed category. **No
  `wouldSave` on the wire** — the definition, never a savings total (US26); this repo prints a percent
  as money today. Server work minted as BackOffice
  [787](C:\Work\DMSCO\BackOffice\.issues\787-web-cc-promotion-guidance-engine.md); design graduated to
  [138](138-near-miss-guidance-design.md).
  [Research note](assets/130-potential-prereqs/RESEARCH.md).

- [The item search the agent actually types into](131-item-search-endpoint.md) — owner supplied the
  SQL: the plain `Item` master, `ItemType = 0`, whose value is the **projection** (it names six
  anonymous `SalesCategory` columns). 🚩 **`Client` is missing from it** — `Item`'s key is composite
  `(Client, ItemNumber)` and every existing caller gets it implicitly from the NHibernate session, so
  a raw Dapper read without it returns a wrong set. ⚠ **Amends note 9**: the row price is **not** a
  store list price and won't become one — it is `Item.UnitPrice`, a material-master column served as
  an **ex-VAT estimate**, and since `MWST` is a separate 15% condition on top of the net, the row
  reads **~13% under** the basket line, making *under*-quoting the failure mode; wire field is
  `estimatePriceExVat` and the label lands on 135. Good consequence: `POSCommon.VatRate` never has to
  graduate, unlike 133's delivery-fee rule. Search gains **Arabic** (`Description2`) — WPF never
  searched it at all — plus item-number prefix; barcode ruled out. Eligibility = CC1's own whitelist
  (`POSOrderController.cs:336-343`), so the agent never sees a row they can't add — the WPF lookup
  filters *nothing* and doesn't even read `IsBlocked`, so both the filter and the Arabic axis are
  upgrades over WPF, not ports. **ATP needs no new contract**: `Stock/ItemPlant` already exists and
  hits the same `GetCurrentStock`→`AtpQuantity` the WPF `FillStock` calls — folded in server-side at
  the **order's** plant, one round trip, degrading to `atp: null` (never non-200). **No paging** —
  cap + `truncated`; an agent retypes. 🚩 The `LIKE '%…%'` match is **non-sargable and unmeasured**
  (WPF partly escaped via a sargable first box) — left deliberately unsolved, with a p95 ≤ 500 ms
  target and full-text as the measured fallback. Server work minted as BackOffice
  [799](C:\Work\DMSCO\BackOffice\.issues\799-cc-item-search-endpoint.md).

- [Origin becomes a real field, and coupons move with it](128-origin-c000-and-coupon-parity.md) —
  **two permanent layers, not a fix-and-delete.** `Origin` enters as `TransactionOpenOptions.Origin`,
  **engine-defaulted** (`options` ⇒ device store ⇒ `_storeId`) and never required, so a till is right
  *by construction* and no caller breaks; and the `BbyProcess` empty-origin⇒`Plant` fallback **stays
  forever** — owner ruling, it serves `PcHeader`s assembled outside the transaction engine
  (`SimulationService`, `BillingService`, `BonusBuySimulationEndpoints`), so the bug was never the
  fallback but that nothing above it set the field. 🚩 `Origin` is **sticky** — written at open,
  restored from the snapshot, deliberately NOT on the claimant side of `ResumeAsync`'s identity split,
  because under resume-per-request a claimant-derived origin makes eligible promotions a function of
  who refreshed last; owner: "it represents the real place where it was generated." Persisted as
  `PosTransactionHeaderEntity.Origin` + migration 076. Coupons gain an `Origin` field and match
  `request.Origin ?? request.StoreCode` — the *same expression* as `BbyProcess`, because
  `OriginFilterMatcher` warns that divergence "silently unpairs" a template from the BBY that pays it
  — with **one pairing test** proving same-filter template + BBY give both-or-neither through both
  matchers. **No blast-radius survey** (the new engine is not live) and **no `Origin` on the CLCN
  document** (the linked `PosTransaction` copy joins via `SubmissionReference`/`OrderNo`). Server work
  minted as BackOffice
  [788](C:\Work\DMSCO\BackOffice\.issues\788-origin-seat-axis-and-coupon-parity.md).

- [The plant-rebind door and its five re-derivations](129-rebind-store-door.md) — 🚩 **found a till
  bug on the way**: `ResumeAsync` restores `_storeId` but the `PcHeader` it rebuilds
  (`PosTransaction.cs:1125-1141`) **never sets `Plant`**, and `EnrichHeader` wraps its whole body in
  `if (plant != null)`, so a resumed header also loses `DepartureCountry` / `LocalCurrency` /
  `TaxClassificationCustomer`. Invisible at a till until the next scan (resume ends in rescale-only
  `"A"`), at which point type-`"B"` redetermination misses `ZVKP` access 40 and the line takes the
  **national price instead of the store price, silently**. Existential here because 127 made every
  mutation a resume. Minted as BackOffice
  [797](C:\Work\DMSCO\BackOffice\.issues\797-resume-drops-pcheader-plant.md), **blocking** the door.
  The door itself: **one engine door run twice** by SIS.Api — preview is free under
  resume-per-request ("rebind and don't persist"), so no `dryRun` flag; it takes the **new plant's
  whole identity** (`SalesOrg`/`DistCh`/`DepartureCountry` are plant attributes and the other keys of
  `ZVKP` 40 / `YMWS` — a sixth re-derivation the ticket missed); re-prices with **`"C"`
  `NewPricingAndKeepManual`**, not `RecalculateAsync`, whose `"A"` only rescales — so the coupon line
  and `DFEE` are untouchable and the engine gains its **first redetermining mutation**; **refuses
  atomically** naming any line that no longer prices, with the refused instance documented as
  discard-never-save. ⚠ **Amends note 8** — ATP is **re-frozen** from a caller-supplied per-line map
  (the engine never reads stock), old→new kept in the audit. **Coupons: a documented non-event** (the
  engine never burns; after 128 the template matches a sticky `C000`). Re-derivation 4 shrank
  sharply: `Plant` occurs in `SIS.Pricing.Core` **once** (`BbyProcess.cs:39`), so BBY keys on Origin
  only and **promotion *selection* does not change on a rebind** — only its value. Transaction id
  survives (ULID ignores its context). 🚩 `RepriceDocument` looks made for this but its `CloneHeader`
  drops `Plant` — reuse the diff *shape* only. Door minted as BackOffice
  [798](C:\Work\DMSCO\BackOffice\.issues\798-plant-rebind-door.md).

- [Who may open the call center, and what the door refuses](134-access-and-authorization.md) —
  **one grant admits the whole console**: `CallCenterConsoleView` = `BackOfficeScreen[CallCenter,03]`,
  role `CALL_CENTER_AGENT`, covering every verb including submit — 749's own ruling reused, and note 4
  already stripped every price-affecting power so there is no dangerous verb left to single out. The
  probe therefore answers **one boolean**, `{ canOpenConsole }`. **No store dimension** — the store is
  derived and pinned at the address act, and 129's atomic refusal constrains an override *materially*,
  which is stronger than a permission list; there is also nothing to constrain against (`StoreDetails`
  is documented broader than real permissions, no per-user `Auth/Stores` exists). 🚩 The filter must
  require the **cookie branch explicitly** — `ApiKeyEndpointFilter` stamps a never-empty *service*
  `UserId`, so an `IsNullOrEmpty`-only guard grant-checks a service account; that check is exactly
  what keeps the WPF `CallCenter/SubmitOrder` alive, **unedited**, beside the web door. Both
  Bby-gated surfaces dissolved rather than gaining a second grant: grouping members ship **already
  resolved and ATP-filtered inside `getState()`** (a 136 contract ruling), and the SAP detail modal is
  **out of phase 1** — so the console touches no `Bby/*` route at all. 🚩 The console is chrome-less,
  so its refusal is a **dead end**: `ProtectedLayout` renders `AppShell` unconditionally, and a
  full-viewport denial has no nav to leave by ⇒ it carries its own way home, in the five-key copy form
  (a state 135 must draw). 🚩 **The cutover step is the likeliest failure and now has an owner**: seeds
  bind no holder, and the *only* path minting the `UaUser` shell is first role assignment in Authz
  Admin — until then every probe answers empty, silently, so an activated agent is refused. Bound per
  user, query-verified, before the SIS.Api deploy. Server work minted as BackOffice
  [800](C:\Work\DMSCO\BackOffice\.issues\800-call-center-console-grant.md) (the 749 analogue —
  deploys before 137's door).

- [The header-capture routes need a web door](137-callcenter-web-door.md) — 🚩 **132's premise was
  wrong and the correction halves the door**: `ApiKeyEndpointFilter` is *cookie-session OR api-key*
  (`ApiKeyEndpointFilter.cs:40-79`), not api-key-only, so every one of the ~15 routes is **already
  browser-reachable today** — `lookups.ts` drives five of them live. The door was never about
  **reachability**; it is about **gating**, which reframes the list to "which routes may any signed-in
  back-office session call". **Eight leave the door entirely** (`Cities` · `Districts` ·
  `AddressLabels` · `DocumentSources` · `DocumentTypes` · `StoreDetails` · `AvailableSlots` ·
  `SlotIsActive` — reference data, zero server work; 750 OQ2's slot ruling re-confirmed on this door's
  own terms, not inherited). **Nine stay**, gated for PII and writes. **One tag, `CallCenterWeb/*`,
  hosts everything** — header siblings, 131's `ItemSearch`, and 136's session verbs behind one filter
  and one `{ canOpenConsole }` probe, so **136 inherits the answer** and needs no sibling question.
  🚩 **The "delegates verbatim" law breaks twice, deliberately**: `DocumentSourceUsers/{userId}`
  becomes session-derived `MyDocumentSources` (no path param), and the five `CustomerAddresses` routes
  are **scoped to the session's attached customer** — because the originals are unscoped
  (`GetCustomerAddresses` trusts a query-string `customerId`; `DeleteCustomerAddress` takes **only an
  `addressNumber`**, no customer at all), so a verbatim sibling would let any agent delete any address
  in the estate. ⚠ That makes the address book **unreachable before customer attach** — a new ordering
  constraint 135 must draw and 136 must carry. `Touch` confirmed off the door (133's path). 🚩 The
  correction also exposed a **live PII hole predating the call center** — any signed-in session can
  already enumerate loyalty members by mobile and read/write address books — **ruled out of scope**
  and minted standalone as BackOffice
  [802](C:\Work\DMSCO\BackOffice\.issues\802-callcenter-pii-routes-ungated.md). Door minted as
  BackOffice [801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md).

- [The session API contract that lets both tracks run free](136-session-api-contract.md) — **the
  keystone is frozen at v1.0**: [CONTRACT.md](assets/136-cc-contract/CONTRACT.md) plus eight
  provisional fixtures. **Every mutating verb returns the whole `SessionState`** — under
  resume-per-request the projection is already in hand, so returning it costs a serialization, not a
  round trip, and the client becomes a pure render-of-latest-state with no delta protocol. A
  client-minted **`requestId`** on every mutation makes an ambiguous retry safe (`replayed: true`,
  never re-applied), and an **explicit, ownership-validated `transactionId`** closes the map's
  nastiest silent harm from the other side: a forgotten tab on an abandoned order can never write
  onto the agent's *new* caller's basket. 🚩 **"Are you sure" rides the *success* path** — `200` +
  the unchanged state + a `pendingConfirmation` token that **pins** the previewed diff — because
  `core/api.ts` drops `data` on a non-2xx *and* because nothing has failed; one pattern serves both
  the rebind preview and the below-ATP ack, whose token **is** the 285/286 audit record a client-set
  boolean could never be. **Near-misses ship inline, their eligible items on demand**
  (`ResolvePrereq`, on this door, never `Bby/*` — which is what makes 134's ruling true), with a
  typed `skipReason` so 130's discovery blocker is visible rather than silently omitted, and **no
  `wouldSave` field at all**. `SESSION_BUSY` is routine, retried in `features/callcenter/api.ts` and
  **never** in `core/api.ts`. Non-engine header fields live in a SIS.Api **`CallCenterSession`
  sidecar** and `SessionState` is the join — 🚩 which makes the **two-store write ordering** the most
  fragile thing on the map (reserve the `requestId` *with the version it is about to mutate from*
  **before** the engine mutation, or a crash between the two makes the retry double-apply a line on
  a real order). 🚩 Also found: `promo-view.ts:368` prints a percent as money and must be fixed as it
  graduates to `@/core/`. Fixtures are **provisional by construction** — 098's own rule says a
  hand-copied fixture is a hypothesis — and die at the backend's `CcContractFixtureTests`, which is
  also note 15's one budgeted revision. Server work minted as BackOffice
  [804](C:\Work\DMSCO\BackOffice\.issues\804-cc-session-contract-server-obligations.md).
  **Both tracks are now unblocked to `/to-spec` independently.**

- [What the agent console looks like](135-agent-console-prototype.md) — **three fixed columns**, owner's
  pick from three built-and-driven variants at a call-center desktop: a customer rail and a live receipt
  that **never move**, a centre column that is the only thing that grows (chips → search → basket →
  offer strip). B (inline offer cards) lost because it re-flows the basket while the agent types; C
  (input | truth split) lost because it spends half a monitor on chrome that is collapsed most of the
  call — but **C's principle won the ex-VAT argument**: 🚩 the estimate leaves the money column
  entirely, onto the item's second line beside the item number, and **`SAR` is reserved for engine
  money**, because A as drawn put `≈12.00 ex-VAT` and `27.60 SAR` in the same horizontal band 200 px
  apart. Two more amendments: the offer strip **wraps rather than scrolling sideways** (cards 4+ were
  invisible) with its actionable count mirrored in the top bar — that is 138's density budget; and the
  keyboard grammar, drawn everywhere and specified nowhere, graduates to
  [153](153-console-keyboard-grammar.md). Both `pendingConfirmation` kinds stay **modal** — B's inline
  card can be scrolled past, and a below-ATP acceptance *is* the audit record. CC2's optimistic hand-off
  is **ruled out** at submit: no optimism where a `documentNo` is the only proof. ATP renders three
  ways (`count` / `none at store` / `? stock unknown`) differing in ground, ink and wording, because
  unknown and zero are opposite decisions. Thirteen contract states drawn, no page errors, gates green;
  variants captured on branch **`prototype/135-callcenter-console`**, off main.
- [What actionable promotion guidance looks like, and what it promises](138-near-miss-guidance-design.md)
  — **awaiting owner ruling.** Three treatments built inside 135's console (branch
  `prototype/138-near-miss-guidance`, 91/91 drive). **The promise half is settled**: the discount
  *definition* at headline size (`20% off`, `3rd free`), `add N more`, the honest set count — and
  135 amendment 1's `SAR` rule had to be **restated**, because real BBY descriptions carry currency
  words the console may not edit (`"2 PC for 29.95 SR"` is in our own 098 captures), so the rule is
  *no figure formatted as money* in the region — which the region can guarantee absolutely, holding
  no engine money at all. 🚩 The drive's finding: **expansion, not offer count, breaks every shape** —
  at a handful of five, opening one offer pushed every other offer below the fold in both list
  variants, so **three is the number** and it belongs in the server's `topN`, not a client slice.
  Recommendation: variant 2 (one next best action, 246 px vs 318/302) taking variant 3's blocked-row
  treatment.
- [The owner gap review](INDEX.md) — 2026-07-27, on reviewing 138. **Six features the charting
  missed**, minted as [154](154-fulfilment-mode-and-store-choice.md)–[159](159-coupon-and-loyalty-signup-drawn.md).
  Two were **already in scope and simply never drawn** (coupon, loyalty signup — 159); two are
  **real holes in the frozen contract** (fulfilment mode 154, payment type 155 — neither is on the
  out-of-scope list, both are written by `Cc2DocumentHeaderBuilder` onto the CLCN document today);
  and two were **never charted at all** (price check 157, stock in other stores 158 — till features
  no CC1/CC2 path reaches, ruled into phase 1 by the owner). The delivery fee (156) is its own
  finding and it corrected note 4 above. 🚩 The pattern worth keeping: every one of the six is a
  thing the **agent does**, and the charting was organised around the **engine's verbs** — which is
  why the verb list looked complete and the console did not.

- [The second owner gap review](INDEX.md) — 2026-07-28, on driving the **built** console. Four
  findings, three of them minted as [175](175-nothing-enters-an-unaddressed-order.md)–[177](177-v1.2-captures-land-on-the-client.md).
  Two are the same finding from two sides — **the console opens ready to take items and it should
  not be**: nothing gates `addItem` on an attached caller, and the plant is seeded from the agent's
  entry store with the chip saying nothing about where it came from (154 had recorded exactly that as
  hygiene; the owner raised it as the behaviour). Owner rulings: caller first as in CC1/CC2, and the
  agent **picks** the store — which reopens **note 6**, since the engine binds `PcHeader.Plant` once
  at open. The third is [154](154-fulfilment-mode-and-store-choice.md)'s ruling **never drawn** — spec
  160 carved it out and the build has no mode axis at all. The fourth was a plain defect in the item
  search (no clear affordance, and the results list outliving the add that answered it), **fixed in
  the session**, recorded on [168](168-search-in-arabic-no-estimate-as-money.md). 🚩 The review also
  found note 15's budgeted contract revision sitting **half-landed in the working tree** — the nine
  fixtures are now real captures and this side never moved with them, so typecheck, vitest and both
  drives are down and three legs the console depends on are captured **unreachable**
  ([177](177-v1.2-captures-land-on-the-client.md)). 🚩 The pattern worth keeping: the first gap review
  found what the charting missed by organising around the engine's verbs; this one found what the
  **spec deliberately carved out** and nobody put back — a carve-out with a named ticket still reads
  as done to everyone downstream of it.

- [The v1.2 captures land on the client](177-v1.2-captures-land-on-the-client.md) — note 15's budgeted
  revision, landed on this side. The corpus is now **two tiers, named as such**: the wire's own bytes,
  plus an `unreachable-v1_0.json` block — deliberately NOT in `.issues/assets/`, so nobody mistakes it
  for a capture — holding only what [859](C:\Work\DMSCO\BackOffice\.issues\859-near-miss-offer-id-is-blank.md) blocks, read by the tests AND both drives so they cannot
  drift. 🚩 **07 ruled hold-both**: the client's *both successes are the same news* stays, because it
  is a claim about this repo that must hold the day [860](C:\Work\DMSCO\BackOffice\.issues\860-already-submitted-replay-unreachable.md) lands, and the capture's real
  `409 SESSION_CLOSED` is asserted beside it — including that **no order number survives anywhere**,
  which is 860's harm as one assertion. 🚩 **Ship-blocked ruled detect-and-say-so** (owner): two of the
  four blocked paths **lied to the agent** — a below-ATP acceptance and a plant-rebind confirm each
  returned `200` and did nothing, silently ([858](C:\Work\DMSCO\BackOffice\.issues\858-confirm-retry-swallowed-as-replay.md)) — so `commitWasSwallowed` draws a banner. 🚩 **Its first
  version was unsound and the review caught it**: §4's `replayed` means *not re-applied*, which is
  equally true of a commit that already landed — §6.4's crash resolution is by construction a replay
  answer over an APPLIED mutation — and a banner reading *nothing changed* over a basket that did move
  is worse than the silence it replaces. The captures killed both obvious repairs too: `version`
  advances on both swallowed commits (`SaveAsync` blind-increments it, §2.1) and fixture 04 answers
  `hasBelowAtp: true` over ZERO lines. The predicate now asks *did the accepted change actually happen
  in the returned projection* — the basket's own quantity for an add, the plant against the token's
  target for a rebind. No retry is offered and it disappears on its own when 858 lands. 859 and 860 ship as they are — both already say something honest. 🚩 **The
  pattern worth keeping**: driving the REAL projection found two client defects the illustration never
  could — a blank `offerId` is a real wire answer, and the guidance strip keyed React on it, so two
  distinct offers de-duplicated into one card and opening one opened both (fixed with a `cardId` that
  is a render key and never an offer identity, so 859 stays visible); the basket's promotion rows had
  the same defect. A hand-authored fixture is a hypothesis about SHAPE **and about population** — this
  one held every shape and none of the population.

## Not yet specified
- **Latency budget and its measurement.** Resume-per-request was accepted on the owner's word;
  nobody has measured a 30-line basket end-to-end. Needs a number and a place to watch it.
  131 adds a **second, independent latency surface on the same screen**: the item search's match
  clause is non-sargable (`LIKE '%…%'` over two description columns, a scan of `Item` per keystroke)
  and equally unmeasured. It carries its own proposed target (p95 ≤ 500 ms) inside
  [799](C:\Work\DMSCO\BackOffice\.issues\799-cc-item-search-endpoint.md), but the *place to watch
  both* is still the undecided part.
- **Observability and ops.** What an ops team watches: orphaned claims, sweeper activity, failed
  submissions, `PosIntegrationAttempt` in `Pending`/`Unknown`. 133 gave this a concrete reason to
  exist: web CC attempts **never reach `POS_Server.PosIntegrationAttempt`** — the mirror publish
  skips without a `PosEnvironment`, which 127 rules out — so the HQ table ops reconcile from will not
  see a single web order. Still fog because nobody has said what ops actually needs; the choice is
  between feeding that table another way and building the view on this side.
- **Price-parity assurance web vs till.** BackOffice's `CcQuoteParityHarnessTests` is the
  precedent; whether the web path needs its own harness is unresolved.
- **Arabic / RTL for the agent console.** This repo is zero-literal and RTL-ready, but an
  agent-desktop layout at 12-hour density is a different problem from a back-office grid.
- **Rollout.** Pilot seats, dual-running beside WPF, cutover criteria, training, and what happens
  to CC1/CC2 once the web is "mature."
  134 hands this a **hard, ordered prerequisite** rather than a preference: every call-center agent
  must be bound to `CALL_CENTER_AGENT` **in Authz Admin** (the only path that mints the `UaUser`
  shell) and verified by query, *before* the SIS.Api carrying the grant filter deploys — and the seed
  itself must land before that. Get the order wrong and the gate locks out the floor it exists to
  admit, silently. What is still fog is the *shape* of that rollout: who does the binding for a
  shift-staffed floor, how a new hire is admitted after cutover, and whether dual-running means an
  agent holds the grant while still working CC1.

## Out of scope

- **Every non-CLCN order kind** — Nphies (`NPHS`, spec 301), Wasfaty (302), Insurance, P2E. CC1's
  `CallCenterOrderTypes` and CC2's five `OrderKinds` strategies all reduce to the cash kind here.
  Each returns as its own effort.
- **Prescription controls, GS1/serialized items, placeholder/text lines, `replaceLine`** — ruled
  out of the verb list (Note 5).
- **The web till** — shift, tender, drawer, receipt, ZATCA, returns, exchange, refund, collection,
  scanning. The *substrate* is built to serve it later; none of it is charted here.
- **Any price-affecting operator power** — manual conditions, overrides, supervisor discounts. If
  the business ever needs one it arrives as a deliberate, separately-designed effort (Note 4).
- **The physical CC device's origin setup** — owner ruling while resolving
  [128](128-origin-c000-and-coupon-parity.md). The `Store` table already holds the call center *as a
  store*, `POSSetup` points the device at it and the machine code comes from the registry, so under
  128's open-time default a physical CC device already carries a seat-like origin. Nothing to fix,
  and any WPF/device change is a BackOffice concern past this map's destination.
- **Multi-call / multi-session agent shell** — one active order per agent (Note 12); CC2's
  `RESEARCH.md` §15 already parked this.
- **The legacy POS** — owner ruling: NewPos only.
- **Closing the pre-existing PII exposure on the shared `SdDocument/*` and `Loy/*` routes.** Owner
  ruling while resolving [137](137-callcenter-web-door.md): because `ApiKeyEndpointFilter` is
  *cookie-OR-api-key*, any signed-in back-office session can today enumerate loyalty members by mobile
  and read/write any customer's address book — true before the web call center exists and not its
  defect. 801's sibling door gates the *call center's* path; tightening the originals would touch the
  WPF OMS screen, the WPF call center, and the ecommerce integrations, a blast radius past this map's
  destination. Minted standalone as BackOffice
  [802](C:\Work\DMSCO\BackOffice\.issues\802-callcenter-pii-routes-ungated.md).
- **A store rebind with no operator action** — the trigger 132 raised, where ops flips a district's
  `TempStoreCode` and a live basket moves by itself. Owner ruling while resolving
  [129](129-rebind-store-door.md): the district→store derivation is **pinned at the moment the
  operator picks or edits an address**, not re-read per request, so the flip changes nothing until
  the next explicit address act. That makes every rebind operator-driven — which is what lets the
  door refuse and lets the client confirm. Re-reading per request is a different design, not a later
  step of this one.
