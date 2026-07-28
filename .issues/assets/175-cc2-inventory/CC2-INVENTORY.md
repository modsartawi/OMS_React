# CC2, read whole — the feature inventory the web console owes

> Asset of [175](../../175-nothing-enters-an-unaddressed-order.md), map [126](../../126-web-call-center.md).
> Source: `C:\Work\DMSCO\BackOffice\Sartawi.POS\CallCenter2` (~7,600 lines of VM + service).
> Owner instruction, 2026-07-28: *"study well the CC2 for whole features, we need it all
> (except for other Order Type in other phase)."*
>
> [132](../../132-header-capture-inventory.md) inventoried the header **fields**. This inventories
> the **behaviour** — which is where the corrections are, because three of them contradict what this
> map already ruled.

---

## 0. The three corrections, first

Everything else here is inventory. These change decisions already taken.

1. 🚩 **The store is not on the address, and the address does not know its store.**
   `CustomerAddressBookModel` has no store field, and neither does `BusinessAddress`. When the agent
   picks a saved address, CC2 takes its `DistrictCode`, finds that district, and reads
   `TempStoreCode ?? StoreCode` off the **district** (`StoreSelectionVM:457-524`). The address is
   pure customer data; the store is a property of the geography, resolved at pick time. Which means
   the district→store table can change under a saved address, and the same address can derive a
   different store next week. [154](../../154-fulfilment-mode-and-store-choice.md) never said this.

2. 🚩 **CC2 has TWO location mechanisms, and the better one is not a cascade.**
   The cascade (city combo → district combo, each with its own search text) still exists, but
   `AddressEditingForm` also carries `AllDistricts` — **every district across every city**, ~1,000
   rows, fetched **once per session** via `GetDistricts("")` — behind **one search box** that matches
   district name EN/AR **or** city name EN/AR. Picking one row commits **both** city and district
   (`PickLocation`, `AddressSectionVM:731`). The comment is explicit about the trade:
   *"one upfront fetch for type-anything-anytime UX."* An agent types `olaya` or `العليا` and is
   done; they never choose a city first.

3. 🚩 **An address is nine captured fields, not two.** City and district are the two that decide the
   store; the rest are what a driver actually needs. Full list in §2.

---

## 1. The address book

**Model** — `CustomerAddressBookModel` (`Sartawi.Retail.Data/Modules/Sd/SdAddress/Services/Models/`):

| Field | Note |
|---|---|
| `AddressNumber` | identity; what `setAddress` is given |
| `CustomerId` | the address belongs to the **loyalty customer**, not to an order |
| `LabelCode` / `LabelNameAr` / `LabelNameEn` | Home, Work, … — a **server-held list**, not an enum |
| `IsDefault` | one per customer |
| `LastUsedOn` | drives ordering |
| `CreatedOn` / `UpdatedOn` | audit |
| `Address` | nested `BusinessAddress` — §2 |

**Ordering is `IsDefault desc, LastUsedOn desc`** and the view surfaces the first two as tiles with a
Manage-Addresses side panel for the rest (`AddressSectionVM:143-176`).

**Operations** — `ICustomerAddressBookService`:

| Call | Note |
|---|---|
| `GetCustomerAddresses(customerId)` | the book |
| `AddCustomerAddress(customerId, labelCode, address)` | |
| `UpdateCustomerAddress(addressNumber, labelCode, address)` | |
| `DeleteCustomerAddress(addressNumber)` | |
| `SetDefaultCustomerAddress(customerId, addressNumber)` | |
| `GetAddressLabels()` | the label catalogue |
| `TouchLastUsed(addressNumber)` | 🚩 fires **at hand-off, never on selection** — the comment is explicit: picking an address must not disturb the ordering until an order is actually placed with it |

## 2. What an address actually captures

`BusinessAddress` carries 25 fields. **CC2's editor writes nine of them** plus three constants
(`BuildBusinessAddress`, `AddressSectionVM:1007`):

| Captured | Kind |
|---|---|
| `CityCode` + `CityName` | from the location pick |
| `DistrictCode` + `DistrictName` | from the location pick — **this is what derives the store** |
| `Street1` | free text |
| `Street2` | free text |
| `BuildingNumber` | free text |
| `Phone1`, `Phone2` | free text — a **delivery** phone, distinct from the loyalty mobile |
| `ShortAddress` | Saudi National Address — §2.1 |
| `GpsLat`, `GpsLon` | decimal |
| `CountryKey = "SA"`, `LanguageKey = "A"`, `AddressType = "H"` | hard constants |

**Never captured** by CC2 though the model has them: `PostalCode`, `PoBox`, `HouseNumber`,
`FloorNumber`, `ApartmentNumber`, `Name1/Name2`, `TitleCode/TitleDescription`, `Phone1Ext/Phone2Ext`.
The web console should carry the same nine — adding fields CC2 never filled would put empty columns
into SAP.

### 2.1 `ShortAddress` is the Saudi National Address, and it is validated

`^[A-Z]{4}[0-9]{4}$` — four letters, four digits, e.g. `RIMA6904`. Normalised to upper-case on set.
Empty is valid (it is optional); malformed is an inline error:
*"National Address must be 4 letters followed by 4 digits (e.g. RIMA6904)."*

🚩 **The validation is format-only.** The code says live verification against the SPL national-address
API (`splonline.com.sa`) *"is a separate integration that needs an API contract / credentials"* and is
**not wired**. The web console inherits the same format check and the same absence.

### 2.2 The label list is server data

`GetAddressLabels()` → `SdAddressLabelModel { LabelCode, LabelNameAr, LabelNameEn }`. A new address
defaults to `"HOME"` (`ResetForNewAsync`). Display falls back `LabelNameEn ?? LabelCode` — already
mirrored in this repo's `console/address-book.ts`, deliberately, so agents keep seeing the untranslated
code they already know.

## 3. Picking a location — the unified search

`EnsureAllDistrictsLoadedAsync` loads every district once (`GetDistricts("")` returns all with
`City*` populated). `FilteredLocations` matches on four fields: `DistrictNameEn`, `DistrictNameAr`,
`CityNameEn`, `CityNameAr`, case-insensitively.

Behaviours worth copying:

- **Picking commits both** city and district, resolving the district against the reloaded per-city list.
- **The side panel snapshots and reverts.** Opening `FindLocationPanelBody` snapshots the current
  city/district; closing by X / scrim / Esc restores them. Only an explicit Pick commits.
- **The picked row is never filtered out.** `RebuildFilteredCities/Districts` force-keep the current
  selection in the filtered list, because WPF clears `SelectedItem` when it leaves `ItemsSource` — the
  agent typing `ji` to find Jeddah must not silently lose Riyadh. The web equivalent is the same rule:
  a search that would hide the current pick must not clear it.
- **Arabic matching is `OrdinalIgnoreCase`**, no diacritic or hamza folding — the comment calls it
  *"good enough for a dropdown filter"* and flags full collation as a later fix. Inherit the limitation
  knowingly; do not re-discover it.

## 4. The customer — find, and create

**Find**: mobile + a country (`LoyCountry` list, `SelectedCountry`), `FindByMobileCommand`, with
`NotFound` as its own state. `MobileNumberHelper` owns normalisation — strips a leading `0` for SA and
strips a pasted dialling code — then `BuildFullNumber(country, mobile)`.

**Create is a two-step OTP signup** (`ICustomerCreateService`), mirroring `LoyCreationController`:

1. `StartSignUpAsync(country, mobile, preferredLanguage)` → `SignUpByBranch { Mobile, CountryCode,
   BranchId = the agent's store, PreferredLanguage, RequestId }`
2. `ConfirmSignUpAsync(…, otp)` → `ConfirmSignUpByBranch { …, Otp, ReferralCode }` → returns the
   loyalty member, mapped to a `LoyaltyCustomer`

Details that are rules, not incidentals:

- **Preferred language is a choice on the form** (`IsArabic` / `IsEnglish`) — it is the language the
  customer is contacted in, not the agent's UI language.
- 🚩 **The referral-code rule**: `ReferralCode = "W"` when the active POS controller sits on customer
  `0001100135`, otherwise empty. Carried forward from the legacy controller verbatim.
- `BranchId` is the **agent's own store**, not the order's plant.
- Both calls carry a client-minted `RequestId` — the same idempotency instinct contract §4 formalises.
- The create form lives **inline** (`CustomerCreateSectionVM`) and also in a side panel
  (`QuickCreateInPanelCommand`), with `OtpRequested` flipping the form between step 1 and step 2.

## 5. The rest of the module, by feature

| Feature | Where | What the web owes |
|---|---|---|
| **Fulfilment** | `IsDelivery` / `IsPickInStore`, `IsFulfillmentEnabled => IsNewMode && !IsDeliveryOnly` | 176 |
| **Store selection** | `StoreSelectionVM` — derived branch vs operator-picker branch, `FindStorePanelBody` side panel, filter + `HasNoMatches` | 175 |
| **Slots** | `ISlotService` — an `IsActive` probe (cached) + `TimeSlots` by store; days → times | drawn |
| **Document source** | `OmsDocumentMetadataService`, category `"C"` = the call-centre bucket; a **user-forced source** exists | drawn |
| **Source reference** | `SourceReference` + `IsSourceReferenceValid` on the main VM | built (173) |
| **Payment** | `CashOnDelivery` / `OnlinePayment`, `IsPaymentForced`, chip-until-expanded (`ShowPaymentChip` / `ShowPaymentRadios`) | 155 |
| **Order note** | `OrderNote` on the main VM | 🚩 **undrawn anywhere, unticketed** |
| **Draft autosave + resume** | `Cc2DraftAutoSave` (750 ms debounce), `Cc2JsonDraftStore`, `Cc2DraftResumeWindow`; **edit mode opts out** | 🚩 the web's transaction *is* the draft (law 8) — this is the feature the engine-as-a-service substrate replaces |
| **Command palette** | `Ctrl+K`, `Cc2CommandRegistry`, stable ids (`cc2.store.find`, `cc2.payment.cash`, …) | 153 / v4's `/` line |
| **Cheat sheet** | `?` → `Cc2CheatSheetWindow` | 153 |
| **Density** | compact / comfortable, `Ctrl+D`, persisted per user in the registry | 🚩 undrawn, unticketed |
| **Snackbar** | `Info / Success / Warning / Danger` | sonner |
| **Side panels** | ManageAddresses · FindStore · FindLocation — a shared `Cc2SidePanel` chrome | v4's section |
| **Summary pane** | `OrderSummaryVM` — read-only, no edit controls; you go back to the section | the receipt rail |
| **Launch seeds** | `KindLocked`, `SourceLocked`, `DeliveryOnly` — an external caller can pin the order's shape | 🚩 undrawn; matters if anything deep-links into the console |
| **Hand-off** | `PosHandOffService` / `PosHandOffTarget` / `HandOffContext` | replaced by `submit` (133) |

### Deliberately out of phase 1 (owner, 2026-07-28: *"except for other Order Type"*)

`OrderKinds/` — `CashOrderStrategy`, `InsuranceOrderStrategy`, `WasfatyOrderStrategy`,
`NphiesOrderStrategy`, `P2eOrderStrategy`, and everything hanging off them: the kind picker
(`DocumentTypeSelectorVM`), the prescription-reference section (`PatientNationalId`,
`ApprovalNumber`, `IsPrescriptionRefVisible`), and `RequiresSlot` variation per kind. **Phase 1 is
`CashOrderStrategy` only** — which is the CLCN cash order map 126 already scoped.

⚠️ One thread escapes that boundary: **P2E forces online payment**, and `DocumentSourcePolicyService`
marks WSFD / P2E / DKSW **delivery-only**. Those are *source* rules, not kind rules, and phase 1 has
sources. Keep the forcing behaviour even though the kinds are out.

---

## 6. What this changes for the web

- **The address book is the delivery picker** — corrected, drawn, and already what
  [165](../../165-attach-caller-fills-the-rail.md)/[166](../../166-address-derives-the-store.md) shipped.
- **The address editor needs nine fields, a server label list, and SPL format validation** — the web
  has none of this today; `CallCenterWeb/CustomerAddresses*` ([801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md))
  is the door it lands behind.
- **The location picker is one search box, not a cascade** — and it must never filter away the
  current pick.
- **Creating a loyalty customer is a two-step OTP flow** and is not on the frozen contract at all.
- **A district with no `StoreCode` and no `TempStoreCode` is undeliverable** — owner-ruled a hard
  block; contract §7 has no code for it.
- **Order note, density, and launch seeds are unticketed** and should be raised rather than quietly
  dropped.
