---
type: wayfinder-ticket
wayfinder: research
map: 126
status: done
blocked-by: —
---

# 132 — What header capture actually requires (CC1 + CC2 inventory)

## Question

Note 6 puts header capture in phase 1, and it is roughly half the client build. Before any of it is
designed, inventory what it genuinely needs — from the code, not from memory.

Read `Sartawi.POS/CallCenter/NewOrder/NewOrderController.cs` (1556 lines; `CreateOrder` at ~:1325
is the validation gate) and `Sartawi.POS/CallCenter2/` (`ViewModels/`, `Services/`), and answer:

- **The mandatory set.** `CreateOrder` throws on: document source, **source reference** (free text,
  whitespace-only rejected, flows verbatim to `AddSdDocumentHeader.SourceReference`), customer,
  customer address, store code, and a time slot for OMS/Wasfaty delivery outside stores
  `1283`/`1154`. Confirm which of these survive the CLCN-only cut and which were kind-specific.
- **Customer.** What `FindCustomer` / `CustomerCreateService` / `ICustomerAddressBookService`
  actually call server-side, and whether those endpoints exist on SIS.Api or only in the WPF client.
- **Address.** `ISdAddressLookupService`, `ManageAddress`, and how a delivery address **derives the
  fulfilment store** — the rule matters because an address correction mid-call silently triggers a
  plant rebind (129).
- **Store.** `FindStore` / `StoreSelectionVM` and `DocumentSourcePolicyService` — which sources
  permit which fulfilment modes, and when the operator picks the store versus when it is derived.
- **Slots.** `ISlotService` / `SlotService` versus this repo's existing
  `Slots/AvailableSlots/{storeCode}` (already consumed by the OMS deliveries feature for
  rescheduling) — same contract or different?
- **What CC2 built that is worth keeping** — `Cc2LaunchSeed`, `HandOffContext`, the draft store,
  the command palette — and what was WPF scaffolding with no web meaning.

Deliverable: a linked inventory note listing, per header field: its source, its server contract
(existing endpoint or gap), its validation rule, and whether phase 1 keeps it. Gaps become
BackOffice issues.

## Answer

Full inventory: [132-header-capture-inventory.RESEARCH.md](assets/132-header-capture-inventory.RESEARCH.md).

**Note 6 overstated the cost.** Of the twelve header fields the phase-1 CLCN order needs, **eleven
are already served by live SIS.Api endpoints**, and five are already consumed by this repo today
(`DocumentSources`, `DocumentTypes`, `StoreDetails`, `Districts`, `Slots/AvailableSlots`). There is
**no new server data work** for header capture. The client build is still real; the backend build
behind it largely is not.

**The mandatory set survives the CLCN cut almost intact** — document source, source reference
(whitespace-only rejected, verbatim to `AddSdDocumentHeader.SourceReference`), customer, address,
and store are all-kinds checks (`NewOrderController.cs:1384-1409`). **The time-slot rule does not.**
It sits behind `else if (IsOmsWasfatyDelivery && !IsP2E)` (`:1417-1426`), so a plain CLCN order never
reaches it — and with it, the `1283`/`1154` exemption is Wasfaty-only and out of scope. What applies
to CLCN is CC2's *soft* rule: the slot section is required only when the kind wants one AND a store
is known AND `SlotIsActive()` AND the store returned days; otherwise the order submits without a slot
(`SlotSelectionVM.cs:168-219`).

**CC1 and CC2 disagree about address → store, and CC2 is right.** CC1 derives from the address's
**city** (`GET SdDocument/DeliveryCity/{city}`, overriding `StoreCode` up to three times in one
setter). CC2 derives from its **district** — `tempStoreCode || storeCode`
(`OrderKindStrategyBase.cs:39-48`). District is the finer grain and `TempStoreCode` is the ops
failover. **This repo already implements CC2's rule exactly**, as pure code
(`features/oms/document/change-store.ts:43-47`); it should graduate to `@/core/` alongside
`promo-view.ts`. Neither path uses geocoding, distance, or SAP — `Stores/Nearest` exists and no call
center calls it.

**Two new rebind triggers for [129](129-rebind-store-door.md).** CC2 never had to rebind because it
assembled the header before the transaction existed; the web design binds `Plant` at open, so an
address correction mid-call *is* the rebind case. Beyond "operator picked a different store", the
door is also triggered by (a) an in-place edit of the selected address's district, and (b) ops
flipping `TempStoreCode` between two requests — **a rebind with no operator action at all**.

**Slots need no new contract.** `Slots/AvailableSlots/{storeCode}` is byte-for-byte what this repo
already calls and models (`core/models/slots.ts:8-33`). Only `Slots/SlotIsActive` is unwired here.

**The one real gap is a door, not a contract.** Every header endpoint carries `ApiKeyEndpointFilter`
and nothing else — `SdDocument/*`, `Slots/*`, `Loy/*` alike — and a browser must not carry the API
key. The fix is the documented `SdDocumentWeb` pattern (a cookie + grant sibling table delegating
verbatim, old door untouched because WPF still drives it). Minted as
[137 — The header-capture routes need a web door](137-callcenter-web-door.md).

**Fog resolved, not ticketed: customer create/edit depth.** CC2's "create" is a two-step loyalty OTP
signup collecting **country + mobile, then OTP** — no name, no email. Customer *edit* does not exist
in CC2 at all. The address book is full CRUD and every route is live. Phase 1 keeps all of it; there
is nothing to build server-side. Two pure client rules are worth porting: `MobileNumberHelper`'s
longest-dialling-code-first parse and SA-only leading-zero strip (`MobileNumberHelper.cs:20-70`), and
the default-address auto-select (`AddressSectionVM.cs:409-417`).

**Identity is unambiguous** — the address book's `customerId` *is* the loyalty id
(`Address.LoadAsync(customer.LoyaltyID)`). But SIS.Api has **two** customer APIs, `Loy/*` (what the
call center uses, with the branch-scoped OTP signup) and `LoyaltyCustomers/*`. [136](136-session-api-contract.md)
must pin `Loy/*` explicitly so the contract does not pick the wrong one by name-similarity.

**Document source → fulfilment mode is nearly a no-op.** `SupportsDelivery` is unconditionally true;
`SupportsPickInStore` is true except for `WSFD`, `P2E`, `DKSW` — all three out of scope
(`DocumentSourcePolicyService.cs:23-43`). For CLCN both modes are always permitted. Carry the shape,
ship the constant.

**What CC2 built that is worth keeping.** Domain: `MainCallCenter2ViewModel`'s kind↔store↔source↔slot↔payment
interdependency rules, and `Cc2DocumentHeaderBuilder`'s field derivations — which are the *spec for the
server-side builder* Note 3 requires, and should be handed to [133](133-submission-path-server-side.md).
UX, for [135](135-agent-console-prototype.md): the command registry + palette + shortcuts + cheat
sheet with focus-aware gating, the live order-summary panel, and the Resume/Discard/Cancel three-state
draft prompt. Dropped: the whole `PosHandOffTarget` layer (bridges two in-process WPF controllers),
`Cc2DraftAutoSave`/`Cc2JsonDraftStore` (127 made the transaction the draft), `Cc2LegacyExtras`, and
the WPF chrome. **`Cc2LaunchSeed` is dropped for phase 1**: its three factories are Wasfaty, Nphies,
and P2E, and the one cash caller passes no seed at all — phase-1 intake is exactly the cold-call case.

**Ticket 131 is confirmed as the only genuine data gap** — every item endpoint on SIS.Api
(`Materials/MaterialsBySfda`, `Sig/Items`, `Stock/ItemPlant`) is an exact-code lookup; there is no
free-text catalogue search anywhere.
