# 132 — Header capture: what it actually requires

Research asset for wayfinder ticket [132](../132-header-capture-inventory.md), map
[126 — The call center goes to the web](../126-web-call-center.md).

Sources read in full (every claim below carries a `file:line` cite):

- `C:\Work\DMSCO\BackOffice\Sartawi.POS\CallCenter\NewOrder\NewOrderController.cs` (1556 lines) + `NewOrderView.xaml`
- `C:\Work\DMSCO\BackOffice\Sartawi.POS\CallCenter2\` — `Services/` (25 files), `ViewModels/` (11 files), `OrderKinds/`, `PLAN.md`, `GAP_ANALYSIS.md`, `REFACTOR_NEXT.md`, `RESEARCH.md`
- `C:\Work\DMSCO\BackOffice\Services\SIS.Api\Endpoints\` (full route audit, 487 route registrations)
- `C:\Playground\oms-react\src\` — the lookups and slot code this repo already ships

---

## The headline

**Note 6 overstated the cost.** Header capture was charted as "roughly half the client build" with an
implied backend build behind it. It is not. Of the twelve header fields the phase-1 CLCN order needs,
**eleven are already served by live SIS.Api endpoints**, and five of those are *already consumed by
this repo today*. There is exactly **one** true server-side gap in header capture, and it is not a
data gap — it is a **door** gap: every one of those endpoints is gated by
`ApiKeyEndpointFilter`, and a browser must not carry the API key.

So the real shape of the work is:

| | |
|---|---|
| New server **data** work for header capture | ~none |
| New server **door** work | one `CallCenterWeb/*` sibling route table, ~15 routes, zero business logic (the `SdDocumentWeb` pattern, verbatim) |
| New **client** work | real, and still large — but it is UI over contracts that already exist |

A second, smaller correction: **CC1 and CC2 disagree about how an address becomes a store**, and CC2
is the one that is right. This repo already implements CC2's rule (see §4).

---

## 1. The mandatory set — CC1's `CreateOrder` gate

`NewOrderController.CreateOrder()` (`NewOrderController.cs:1370-1497`) branches on `OrderFormStatus`.
All real validation is in the `New` branch (`:1382-1472`), in this order:

| # | Check | Rule | Cite | Kind | **Phase 1 (CLCN)** |
|---|---|---|---|---|---|
| 1 | `SelectedDocumentSource` | `IsNullOrEmpty` → `"You need to choose the Document Source"` | `:1384-1387` | all kinds | **KEEP** |
| 2 | `SourceReference` | `IsNullOrWhiteSpace` → `"You need to enter the Source Reference"` | `:1393-1396` | all kinds | **KEEP** |
| 3 | `Customer` | `== null` → `"Choose Customer"` | `:1398-1401` | all kinds | **KEEP** |
| 4 | `CustomerAddress` | `== null` → `"Choose Address"` | `:1403-1406` | all kinds | **KEEP — but see §4** |
| 5 | `Order.StoreCode` | `IsNullOrEmpty` → `"Select Store!"` | `:1408-1409` | all kinds | **KEEP** |
| 6 | Nphies panel | opens a dialog when `SelectedDocumentType == "NPHS" && !IsP2E` | `:1412-1416` | NPHS only | **CUT** (out of scope) |
| 7 | **Time slot** | see below | `:1417-1426` | **OMS-Wasfaty-delivery only** | **CUT as a hard gate — see §5** |
| 8 | `CreateNewDoc` returns false | silent `return`, no exception | `:1445` | the `else` (cash) branch | **KEEP** (becomes the engine `open` refusal) |

### The `1283` / `1154` finding — it is not a CLCN rule at all

The ticket's premise was that a time slot is mandatory "for OMS/Wasfaty delivery outside stores
`1283`/`1154`". Read literally in the code (`NewOrderController.cs:1417-1426`):

```csharp
else if (IsOmsWasfatyDelivery && IsP2E == false)
{
    if (!Order.StoreCode.IsOneOfValues(new []{"1283", "1154"}))
    {
        if (SelectedTimeSlotDay == null || SelectedTimeSlotTime == null)
            throw new Exception("You should select a time slot");
    }
}
```

This is an `else if` on `IsOmsWasfatyDelivery`. **A plain CLCN cash order never reaches it** — it
falls to the `else` at `:1431`. So the slot gate, and with it the `1283`/`1154` exemption, is
**Wasfaty-specific and out of phase 1's scope**. The two store codes appear nowhere else in the tree
as a named constant and nothing in the code says what they mean operationally — a magic-value smell
worth flagging, but not phase 1's problem.

What *does* apply to a CLCN delivery is CC2's softer rule (§5).

### Validation gaps in CC1 worth not reproducing

- **`Edit` re-validates only the document source** (`:1475-1478`); `SelectAddress` re-validates only
  customer + address (`:1484-1492`). An edited order never re-checks `SourceReference`, `StoreCode`,
  or the slot — so CC1 can persist an order that would have failed creation. The web design should
  validate on submit, not on dialog-close.
- **Inconsistent strictness**: document source uses `IsNullOrEmpty`, source reference uses
  `IsNullOrWhiteSpace` (`:1384` vs `:1393`). Whitespace-only document source passes today.
- **Partial side effects before the guard**: `ViewModel.Order` and `StockStore` are written at
  `:1440-1442`, *before* the `CreateNewDoc` refusal check at `:1445`.

---

## 2. The field inventory

Per header field: where the value comes from, its server contract, its rule, and the phase-1 verdict.
"Repo" = this repo already calls it today.

| Field | Source | Server contract | Rule | Phase 1 |
|---|---|---|---|---|
| **Document source** | operator picks; list filtered to `DocumentSourceCategory == "C"`; a per-user forced source locks the picker | `GET SdDocument/DocumentSources` ✅ **Repo** (`core/services/lookups.ts:35-40`) · `GET SdDocument/DocumentSourceUsers/{userId}` ✅ | mandatory; sticky per user | **KEEP** |
| **Source reference** | operator free text, `MaxLength=40` (`NewOrderView.xaml:135`) | none — rides on the submitted header, verbatim to `AddSdDocumentHeader.SourceReference` | mandatory, whitespace-only rejected | **KEEP** |
| **Document type** | derived from order kind; CLCN is the cash default (`NewOrderController.cs:126-132`) | `GET SdDocument/DocumentTypes` ✅ **Repo** | fixed `CLCN` in phase 1 | **KEEP, but constant** |
| **Customer** | operator types a mobile; single lookup key | `GET Loy/MemberByMobile/{mobile}` ✅ (`OmsHttpService.cs:1449-1457`) · `GET Loy/Member/{loyId}` ✅ | mandatory | **KEEP** |
| **Customer (create)** | 2-step OTP signup, mobile-only | `POST Loy/SignUpByBranch` → `POST Loy/ConfirmSignUpByBranch` ✅ (`CustomerCreateService.cs:25-65`) | mobile + country, then OTP | **KEEP** (see §6) |
| **Address** | picked from the customer's address book | `GET/POST/PUT/DELETE SdDocument/CustomerAddresses` ✅ · `POST .../SetDefault` ✅ · `POST .../Touch` ✅ · `GET SdDocument/AddressLabels` ✅ (`SdDocumentEndpoints.cs:378-398`) | mandatory for delivery | **KEEP** |
| **Address reference data** | city + district pickers inside the address editor | `GET SdDocument/Cities` ✅ · `GET SdDocument/Districts` ✅ **Repo** (`lookups.ts:53-59`) | — | **KEEP** |
| **Fulfilment store** | **derived** from the address's district in delivery mode; operator-picked in pick-in-store mode | derivation is client-side over `Districts`; store list is `GET SdDocument/StoreDetails` ✅ **Repo** | mandatory; see §4 | **KEEP** |
| **Fulfilment mode** (delivery / pick-in-store) | operator radio, constrained by document source | `DocumentSourcePolicyService` — client-side table, see §3 | — | **KEEP** |
| **Time slot** | picked after the store is known | `GET Slots/AvailableSlots/{storeCode}` ✅ **Repo** (`features/oms/document/api.ts:60-62`) · `GET Slots/SlotIsActive` ✅ | soft, see §5 | **KEEP, soft** |
| **Payment type** (COD / online) | operator radio; default COD (`NewOrderController.cs:50`) | none — a header field | forced online for P2E only | **KEEP, COD default** |
| **Note** | operator free text | none — a header field | optional | **KEEP** |
| ~~`NoOfBoxes`~~ | bound in XAML but the row is `Visibility="Collapsed"` (`NewOrderView.xaml:103`) and it never writes to `Order` | — | dead | **DROP** |
| ~~ID/Iqama, Reference/`EPrescriptionNo`, insurance company, patient/approval identity~~ | operator-typed | — | prescription/insurance kinds | **DROP** (out of scope) |

**Twelve live fields. Eleven have a server contract. Five are already wired in this repo.**

---

## 3. Document source → fulfilment mode: the policy is nearly a no-op

`DocumentSourcePolicyService` (`CallCenter2/Services/DocumentSourcePolicyService.cs:23-43`) is the
whole matrix, and it is far smaller than the ticket assumed:

- `SupportsDelivery(source)` → **always `true`**, for every source (`:31-37`). Nothing is delivery-banned.
- `SupportsPickInStore(source)` → `true` **unless** the source is one of exactly three:
  `WSFD`, `P2E`, and the literal `"DKSW"` (`:23-29, :39-43`). Blank source → `true` (permissive).
- Every other enumerated source (`CLCN`, `HYBS`, `MGNT`, `WEB`, `ROID`, `IOS`, `SNSR`, `HNGR`,
  `BKOF`, `PH` — `DocumentSourceConstants.cs:5-31`) permits both modes.

The service's own comment says it is deliberately permissive "because the operator-visible behavior
should not regress" until OMS documents channel policy (`:9-15`).

**All three delivery-only sources are out of phase 1's scope.** So for CLCN, the policy service
reduces to: *both fulfilment modes are always permitted*. Phase 1 should carry the shape (a
source→mode predicate) but ship it as a constant, and not invent a matrix that does not exist.

---

## 4. Address → store: CC1 and CC2 disagree, and CC2 is right

This is the finding that matters most for [129 — The plant-rebind door](../129-rebind-store-door.md).

**CC1 derives from the address's CITY** (`NewOrderController.cs:623-663`):
`GetDeliveryCity(_customerAddress.City)` → `GET SdDocument/DeliveryCity/{city}`
(`SdDocumentEndpoints.cs:190, :1269-1281`) → `DeliveryCityModel { City, StoreCode, TempStoreCode,
InsuranceStoreCode, WasfatyStoreCode, ShippingMethod, … }`
(`Sartawi.Retail.Data/Modules/Sd/Services/Models/Delivery/DeliveryCityModel.cs:9-20`), then
overrides `Order.StoreCode` up to three times in one property setter (`:649`, `:652`, `:659`).

**CC2 derives from the address's DISTRICT** (`StoreSelectionVM.cs:457-503`):
address `CityCode` + `DistrictCode` → `GET SdDocument/Districts?cityCode=…` → match the
`SdDistrictModel` → `OrderKindStrategyBase.DeriveStoreCode` (`OrderKinds/OrderKindStrategyBase.cs:39-48`):

```csharp
if (!string.IsNullOrWhiteSpace(district.TempStoreCode)) return district.TempStoreCode;
return PreferredStoreCode(district) ?? string.Empty;   // base: district.StoreCode
```

District is a far finer grain than city, and `TempStoreCode` is the ops failover override
(`OrderKindStrategyBase.cs:5-7`). Neither path involves geocoding, distance, or SAP — both are
reference-table lookups. `Stores/Nearest` / `Stores/Nearby` exist (`StoresEndpoints.cs:23-51`) but
**nothing in either call center uses them**.

### This repo already implements CC2's rule

`src/features/oms/document/change-store.ts:43-47` is `deriveStoreCode(district)` —
`tempStoreCode || storeCode`, returning `''` to signal "block, don't post an empty store". It is
already unit-testable pure code with the Insurance refinement deliberately excluded (D-22), and the
district lookup is already a session-cached query (`core/services/lookups.ts:53-59`).

**Recommendation:** phase 1 takes the district path, and `deriveStoreCode` / `districtCityName`
graduate from `features/oms/document/` to `@/core/` — the same graduation Note 13 already
schedules for `promo-view.ts` (a feature may never import a feature).

### The 129 hazard, made concrete

CC2 blocks rather than rebinding: a bad district sets `IsValid = false` with a message
(`StoreSelectionVM.cs:476-498`) and the order cannot submit. Because CC2 assembles the header
*before* handing off to POS, it never has to rebind a live basket.

**The web design does not have that luxury.** The engine binds `PcHeader.Plant` once at open
(Note 6), so the store must be chosen before the first item — which means an address correction
mid-call *is* the rebind case. Concretely, ticket 129's door is triggered by:

1. the operator picking a different saved address,
2. the operator **editing** the selected address's district in place (`PUT
   SdDocument/CustomerAddresses`) — a silent trigger CC2 never had to think about, because it had
   no open transaction,
3. ops flipping `TempStoreCode` on the district between two requests — a rebind with **no operator
   action at all**.

Case 3 is new information for 129 and should be written into its question: the door's trigger set is
not only "operator changed the store".

---

## 5. Slots: the same contract this repo already calls, and a soft gate

`CC2/Services/SlotService.cs:59-63` → `GET Slots/AvailableSlots/{storeCode}` →
`TimeSlotsModel { Slots: [ { Day, Date, FullDay, Times: [ { Time, Status, SlotId, SlotFrom, SlotTo } ] } ] }`.

**This is byte-for-byte the contract this repo already consumes.** `src/core/models/slots.ts:8-33` is
the camelCase mirror, field for field, and `features/oms/document/api.ts:60-62` already calls the
route. Same server handler backs both (`SlotEndpoints.cs:26-28, :47-60`). **No new slot contract is
needed.** The only CC2 call this repo lacks is `GET Slots/SlotIsActive` (`SlotEndpoints.cs:38-40`) —
a global, store-less on/off flag, cached for the app session.

**The gate is soft, not hard** (`SlotSelectionVM.cs:168-219`). The slot section is required only when
*all* of: the kind requires a slot (`RequiresSlot(isDelivery)`, base = `isDelivery`, so pick-in-store
never requires one — `OrderKindStrategyBase.cs:22`), a store is known, `SlotIsActive()` is true, and
the store actually returned days. Any of those failing sets `_requiresSelection = false` and the
order submits **without** a slot, carrying an explanatory message. Past-today windows are filtered
client-side (`:234-248`).

Note the difference in how the two consumers treat `status:false`: this repo's reschedule dialog
shows full windows only to *urgent* documents (`RescheduleDialog.tsx:38, :59-61`). Order creation has
no urgency concept — a phase-1 decision for the console prototype, not a contract question.

---

## 6. Customer create/edit depth — the map's fog patch, resolved

The map listed "Customer create/edit depth" under *Not yet specified*, flagging 132 to sharpen it.
It is smaller than feared:

**Create** is not a customer form at all. It is a two-step loyalty OTP signup collecting exactly
**country + mobile**, then **OTP** (`CustomerCreateSectionVM.cs:128-175`,
`CustomerCreateService.cs:19-65`). No name, no email, no gender. Both steps are live endpoints.
`CustomerCreateResult` returns `{ Success, ErrorMessage }` and, on confirm, the fully-built customer
(`CustomerCreateResult.cs:9-20`).

**Edit** does not exist in CC2. There is no customer-update path — only the address book is editable.
(`PUT LoyaltyCustomers/{loyaltyId}` exists on SIS.Api but no call center calls it.)

**Address book** is full CRUD and all of it is live: list, add, edit, delete, set-default, touch,
labels. The editor writes only a subset of `BusinessAddress` — `CityCode/Name`,
`DistrictCode/Name`, `Street1/2`, `BuildingNumber`, `Phone1/2`, `ShortAddress`, `GpsLat/Lon` — and
hardcodes `CountryKey="SA"`, `LanguageKey="A"`, `AddressType="H"` (`AddressSectionVM.cs:1007-1027`).
National-address validation is the regex `^[A-Z]{4}[0-9]{4}$` (`:939-940`).

Two client rules worth porting, both pure and testable:
- **`MobileNumberHelper`** (`Services/MobileNumberHelper.cs:20-70`): strip a leading `+`; match the
  dialling code **longest-first** so `1242` is not eaten by `1`; strip a leading `0` for `SA` only;
  re-parse defensively at submit so a pasted dialling code does not double up.
- **Default-address auto-select**: on load, pick `IsDefault`, else the sole address if there is
  exactly one, else nothing — and fire a *distinct* event for it so the UI can show it was automatic
  (`AddressSectionVM.cs:409-417`). List order is `IsDefault desc, LastUsedOn desc` (`:426-435`).

`SdDocument/CustomerAddresses/Touch` is deliberately **not** called on selection — only after the
order commits (`ICustomerAddressBookService.cs:20-24`). Phase 1 should keep that, which makes it a
server-side post-submit step, not a client call.

**Verdict: phase 1 keeps all of it.** It is one lookup, one 2-step signup, and an address CRUD — all
already served. This fog patch does not need a ticket.

### Identity: no ambiguity

The address book's `customerId` **is the loyalty id** — `Address.LoadAsync(customer.LoyaltyID)`
(`MainCallCenter2ViewModel.cs:808, :975, :1104`). One identity, not two.

But note SIS.Api has **two** customer APIs: `Loy/*` (what the call center uses) and
`LoyaltyCustomers/*` (`Endpoints/Loyalty/LoyaltyCustomerEndpoints.cs`, with its own
`GetByMobile/{mobile}`, create, update). They are not the same handlers. **The web client must mirror
`Loy/*`**, because that is the path with the branch-scoped OTP signup the call center actually uses.
Worth pinning explicitly in [136](../136-session-api-contract.md) so the contract does not pick the
wrong one by name-similarity.

---

## 7. The one real gap: every header endpoint is behind the API-key door

Every route in §2 carries `.AddEndpointFilter<ApiKeyEndpointFilter>()` and nothing else — verified on
`SdDocument/Cities`, `Districts`, `CustomerAddresses` ×6, `AddressLabels`
(`SdDocumentEndpoints.cs:364-398`), all of `Slots/*` (`SlotEndpoints.cs:26-44`), and all of `Loy/*`
(`LoyEndpoints.cs:63-253`). A browser must not carry the API key, so **none of these are callable
from the web client as they stand.**

This is a solved problem in this codebase, with the pattern documented at length in
`SdDocumentWebEndpoints.cs:12-50`. Quoting the decisive part:

> WHY A NEW DOOR AND NOT A FILTER ON THE OLD ONE: `SdDocumentEndpoints` carries
> `ApiKeyEndpointFilter` and nothing else … but it is NOT web-only: `OmsHttpService.cs` drives the
> same routes from the WPF OMS screen with `x-api-key`. Hanging a grant filter there would
> grant-check the API key's service account and 403 the WPF screen.
>
> NO BUSINESS LOGIC LIVES HERE. Every handler delegates to the matching `SdDocumentEndpoints`
> handler verbatim … a path swap for the client and nothing else.

The WPF call center is going to keep running beside the web one through phase 1, so this reasoning
applies with full force — `SdDocumentEndpoints`, `SlotEndpoints`, and `LoyEndpoints` must not be
edited.

**Shape of the work:** one `CallCenterWeb/*` sibling route table, cookie + CSRF + a screen grant,
fail-closed, every handler delegating verbatim, mirroring roughly these routes:

`Cities` · `Districts` · `CustomerAddresses` (GET/POST/PUT/DELETE) · `CustomerAddresses/SetDefault` ·
`AddressLabels` · `DocumentSources` · `DocumentSourceUsers/{userId}` · `DocumentTypes` ·
`StoreDetails` · `AvailableSlots/{storeCode}` · `SlotIsActive` · `MemberByMobile/{mobile}` ·
`Member/{loyId}` · `SignUpByBranch` · `ConfirmSignUpByBranch`

Two live questions this raises, both for the new ticket rather than this note:

1. **Which grant?** 125 keyed OMS to `BackOfficeScreen[DocumentList|DocumentDetails,03]`. The call
   center mints real orders, so it wants its own screen key — and 134 is already deciding who may
   open the console. The door and the probe should share one key.
2. **Does the *session* API need the same door, or its own?** The session verbs (Note 5) are new
   routes with no WPF twin, so they can be born cookie-gated and need no sibling. That is
   [136](../136-session-api-contract.md)'s call, not this door's.

Note `SdDocumentWebEndpoints.cs:44-47` already ruled that `Slots/AvailableSlots/{storeCode}` stays on
its old path for the OMS reschedule dialog "because it exposes slot availability for a store, not
document data (750 OQ2)". That ruling was made for a *read* in a screen already behind a grant; it
does not automatically extend to the call center, and the new door should decide it on its own terms.

---

## 8. What CC2 built that is worth keeping

Assessed across all 25 services + 11 view models.

### Keep as domain

- **`MainCallCenter2ViewModel`'s interdependency rules** (`:166-196`) — kind ↔ store ↔ source ↔ slot
  ↔ payment cross-derivation. This is the richest domain surface in the module and the thing a
  rebuild most needs. In phase 1 it collapses hard (one kind, one type, a constant policy), but the
  *shape* — "changing X re-derives Y and invalidates Z" — is the header state machine.
- **`Cc2DocumentHeaderBuilder`'s rules, not its location** (`Services/Cc2DocumentHeaderBuilder.cs:20-119`).
  It sets: `DocumentType`, `DocumentSource`, `SourceReference`, `DocumentDate = Today`, `StoreCode`,
  `DeliveryType`, `PaymentType`, `Note`, customer `{Id, Name, Phone, Email}`, shipping
  `{CityName, Street1, Street2, GpsLat, GpsLon}` (delivery only), slot
  `{TimeSlotDay, TimeSlotDescription, TimeSlotId, DeliveryScheduleFrom/ToTime}`, and prescription
  identity. It explicitly leaves `Lines` / `Conditions` / `NetTotal` empty (`:13-14`).
  **This is the server-side builder's spec.** That it runs client-side today is exactly what Note 3
  moves; the field derivations are the reusable asset. Hand this list to
  [133](../133-submission-path-server-side.md).
- **`HandOffContext`'s submit-preconditions** — kind + customer required, delivery requires a
  resolved address (`PosHandOffService.cs:17-76`). The rule survives; the mechanism does not.

### Keep as UX pattern

- **Command registry + palette + shortcuts + cheat sheet** (`Cc2Command`, `Cc2CommandRegistry`,
  `Cc2CommandPaletteVM`, `Cc2ShortcutDispatcher`, `Cc2CheatSheetVM`). Zero domain content, but one
  registry feeding four consumers, with focus/modal gating so single-letter shortcuts don't fire into
  a text box (`Cc2ShortcutDispatcher.Decide` is deliberately WPF-free and pure). A 12-hour-a-day
  agent desktop wants this. → [135](../135-agent-console-prototype.md).
- **Live order-summary panel** (`OrderSummaryVM.cs:12-154`) — a sticky derived "what is about to
  submit" projection. `RESEARCH.md:100` independently identifies it as the industry pattern. → 135.
- **Density toggle** (idea only), **snackbar queue**, **sticky last-used document source**
  (`ICc2UserPreferences`) — all portable ideas, none with WPF-portable mechanisms.
- **Resume / Discard / Cancel** as a three-state draft prompt (`CallCenter2Launcher.cs:121-127`) —
  notably including "Cancel means don't even open the screen". 127 already answered the *server*
  side of resume (the transaction is the draft; a second `open` is refused with the existing id), and
  the map correctly parks the *look* of that choice with 135. This three-state contract is the
  precedent for it.

### Drop

- **`Cc2LaunchSeed` / `Cc2LaunchSeeds`** — a genuine domain idea (non-telephone intake pre-locks
  compliance-bound fields), but its three factories are `WasfatyDelivery`, `Nphies`, and `P2E`, all
  out of scope. The fourth caller, `CashClearance`, **passes no seed at all** — which is precisely
  the phase-1 CLCN case. **Phase 1's order intake is the cold-call case and needs no seed.** Record
  the idea; build nothing.
- **`PosHandOffService` / `PosHandOffTarget` / `IPosHandOffTarget`** — bridges two in-process WPF
  controllers by mutating `POSCommon.CurrentPOSController.ViewModel`. There is no legacy carrier in a
  browser. Note this is *not* CC→till and not CC1→CC2; it is CC2 → the POS controller in the same
  process.
- **`Cc2DraftAutoSave` / `Cc2JsonDraftStore`** — a debounce timer over `PropertyChanged` writing a
  JSON sidecar to `%AppData%`. 127 removed the need entirely: the server-side transaction *is* the
  draft. The one idea worth keeping from `Cc2DraftSnapshot.cs:9-14` is "store identifiers, not object
  graphs, so restore re-resolves against fresh server state" — which is what resuming from the engine
  snapshot already does by construction.
- **`Cc2LegacyExtras`** — self-described as "Dies with the legacy submit path" (`:12`).
- **`Cc2Motion`**, **`Cc2RegistryUserPreferences`** (HKCU), **`Cc2DensityService`**'s merged-dictionary
  mechanism, **`CallCenter2Launcher`** — WPF plumbing.

---

## 9. What this changes on map 126

- **Note 6 should be read down, not up.** Header capture is mostly UI over existing contracts. The
  "roughly half the client build" estimate may still hold for the *client*; the implied backend build
  does not exist.
- **Note 7 / ticket 129 gains two silent rebind triggers** — an in-place address edit, and an ops
  flip of `TempStoreCode` with no operator action at all.
- **Ticket 131 is confirmed** — item search is the one genuine data gap. Everything header-shaped is
  served; nothing catalogue-shaped is (`Materials/MaterialsBySfda`, `Sig/Items`, `Stock/ItemPlant`
  are all exact-code lookups).
- **Ticket 133 gets `Cc2DocumentHeaderBuilder`'s field list** as the spec for the server-side header
  assembly Note 3 requires.
- **Ticket 136 must pin `Loy/*` over `LoyaltyCustomers/*`** and decide whether the session verbs sit
  on the new web door or their own.
- **The "Customer create/edit depth" fog patch resolves here** (§6) and needs no ticket.
- **One new ticket:** the `CallCenterWeb/*` door (§7).
