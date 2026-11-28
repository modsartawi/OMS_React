---
type: spec
status: ready
---

# 1006: Wasfaty and Nphies orders from the call-center console

Settled by the owner on 2026-11-28 in a grilling session (BackOffice session, three rounds), after the
phase-1 console (spec 160, map 126) shipped the ordinary phone order (`CLCN`) only. Map 126 ruled every other
order type out of phase 1: *"Each returns as its own effort"*. This is that effort for **Wasfaty** and
**Nphies**.

The wire is the call-center session contract (`assets/136-cc-contract/CONTRACT.md`). This spec proposes
**v1.15, additive**, served by BackOffice tickets 4484–4488.

## Problem Statement

A caller with a Wasfaty prescription or an insurance (Nphies) approval cannot be served from the web
console. The agent goes back to CC2 on a till, or creates an ordinary phone order and loses the type:
- the order is priced with promotions it should not have;
- it carries a delivery fee it should not carry;
- it can be paid online, which it should not be;
- OMS and the store cannot tell it is a prescription order.

The store pharmacist then searches for the prescription again, because nothing on the order says which
one it is.

## Solution

The agent picks the order type on the console: **ordinary phone order, Wasfaty or Nphies**. A Wasfaty or
Nphies order:
- asks for the **patient's ID** and the **prescription reference**;
- prices any items **without promotions or coupons**;
- is **cash on delivery, locked**;
- carries **no delivery fee**;
- routes a delivery by its own store rule;
- reaches OMS as **`WSFD`** or **`NPHS`**, with the patient ID and reference on the order.

The store's prescription session (BackOffice spec 2994, story 11) then fills in its *find the
prescription* step from those fields. The agent can switch type at any time while the order is open.

## Decisions (owner, 2026-11-28)

| # | Decision |
|---|---|
| D1 | **Cold call only.** The web never opens from an approved prescription or calls Nphies or Wasfaty. Starting from an approval stays on the till: the prescription session's *Create the order*, and CC2's seed. |
| D2 | **Items are optional, with no promotions or coupons.** The agent may add what the caller reads out, at the shelf price. An order with no items may be submitted; the pharmacist completes it from the approved prescription. |
| D3 | **Document type on the wire:** Wasfaty → `WSFD`, Nphies → `NPHS`. Ordinary stays `CLCN`. |
| D4 | **Required: a patient ID and a reference.** The ID is exactly 10 digits. The reference (eRx number or PreAuthRef) is required and trimmed. Both are submit blockers on these types only. |
| D5 | **Duplicate prescription: a warning.** If OMS already holds an active prescription for this patient and reference (`CheckActivePrescription`, as CC1 and CC2 check), submit stops with a confirmation naming the existing order. The agent may confirm and submit anyway. |
| D6 | **Payment: cash on delivery, locked.** Online is refused and the chip says why (`paymentTypeForcedReason`). |
| D7 | **Document source:** the agent's own list, unchanged, opening on their default source (ticket 993). Delivery-only sources (WSFD, DKSW, P2E) keep refusing pick-in-store. |
| D8 | **Store, delivery only:** **Wasfaty → the address's regular store** (today's CLCN rule). **Nphies → the district's `InsuranceStoreCode`.** Pick-in-store is unchanged: the agent picks the store, as today. |
| D9 | **Delivery fee: none.** The real type goes into `CallCenterDeliveryFeePolicy`, which already gives no fee for the Wasfaty and insurance sub-sources. |
| D10 | **Switching type:** allowed at any time while the order is open. Lines stay and are repriced: promotions stop, and coupons come off with a one-line notice. Payment, store (delivery only) and fee are re-derived. The patient ID and reference stay filled in. Back to ordinary restores promotions (coupons are not re-added). |
| D11 | **Delivery slot:** the soft rule of the phone order (a lapsed slot warns, never blocks). No `1283`/`1154` exemption on the web. |
| D12 | **Prescription-session status on the order** (2994 story 67): **later**, its own ticket once sessions are live at stores. |

**Defaults taken by the agent (the owner may veto):**

| # | Default |
|---|---|
| A | The picker offers a type only when the seat may mint its document type (the OMS `DocumentTypes` list, as CC2's `DocumentTypeSelectorVM` filters). |
| B | No insurer-share payment condition (`PaymentPostToAccount`) is sent. A cold call has no approval or deductible, and the store's insured invoice settles the money. CC1's till-launched Wasfaty delivery sent the full total as the insurer's share, and that path is out of scope. |
| C | The submit stamps `PatientId`, `CustomerNationalId` (the patient ID) and `ApprovalNumber` (the reference), the fields CC2's header builder sets and find-for-order reads. `OrderSource` is what CC2 sends: `CallCenterWasfaty` for Wasfaty, `CallCenter` for Nphies. |
| D | For an Nphies delivery, the district's `TempStoreCode` still wins first, as in CC2's `OrderKindStrategyBase`. A district with no `InsuranceStoreCode` is refused, as a district with no store is today. |

## User Stories

1. As an agent, I want to pick *Wasfaty* or *Nphies* when the caller says they have a prescription, so that
   the order is the right kind from the start.
2. As an agent, I want the console to ask for the patient's ID and the reference, and to tell me which one is
   missing, so that I cannot submit a prescription order the store cannot match.
3. As an agent, I want items I add to show the shelf price with no offers, so that I don't promise the
   caller a promotion they will not get.
4. As an agent, I want to switch an ordinary order to Wasfaty mid-call without retyping the basket, and see
   what came off (the coupon, the promotions), so that I can tell the caller.
5. As an agent, I want to be warned when this prescription already has an open order, and still be able to
   go ahead, so that I don't create a duplicate by accident but am not blocked on a real repeat.
6. As an agent, I want payment fixed to cash on delivery with the reason shown, so that I don't send a
   payment link the caller should not get.
7. As a pharmacist, I want the order to arrive as `WSFD` / `NPHS` with the patient ID and reference, so that
   my prescription session fills in *find the prescription* by itself.
8. As the insurance team, I want an Nphies delivery to go to the district's insurance store, so that it is
   fulfilled where the insurance contract is.

## Implementation Decisions

**The order type is a session fact, set by one verb.**
- `CallCenterSession` (the sidecar) stores the type. It survives a resume, like the store and source.
- The seat profile's `DocumentType` stays the default (`CLCN`).
- A new verb `setOrderType { orderType: Ordinary | Wasfaty | Nphies }`.
- State gains `header.orderType` and `capabilities.orderTypes` (the offered set, default A).
- A type not offered is refused with `ORDER_TYPE_NOT_OFFERED`.

**Promotions are switched on the open engine transaction, not by reopening it** (BackOffice 4484).
- The engine already gates promotions on its document type (`PosDocumentType.IsPromotionAllowed` /
  `IsCouponAllowed`, read at open).
- `ApplyPromotionEngineAsync` already shows how to change promotion behaviour on an open transaction: drop
  the bonus-buy and promotion-engine conditions, set `IsPromotionApplicable`, then recalculate.
- A new SIS.Pos verb does the same for *promotions off / on*, and removes applied coupons when off.
- The call-center session calls it from `setOrderType`, and reports what came off.

**The prescription is a second verb.**
- `setPrescription { patientId, reference }`, held in `header.prescription`.
- It is refused with `PATIENT_ID_INVALID` (not 10 digits) or `REFERENCE_REQUIRED`.
- It is accepted on any type, so switching does not lose it, but only Wasfaty and Nphies send it or block on
  it.
- The new submit blocker is `prescription`.

**The per-type rules sit where the phase-1 hooks already are.**
- Payment: `CallCenterPaymentForcing.ReasonFor` returns a reason for Wasfaty and Nphies (it returns null
  today).
- Fee: `CallCenterDeliveryFeePolicy` is given the real type, where the web hard-codes
  `SubSourceCarriesFee = true` today.
- Store: the CLCN-only rule in `CallCenterSessionPorts` gains the Nphies branch (D8, default D).

**The submit carries the type** (BackOffice 4488).
- `DocumentType`, `OrderSource`, `PatientId`, `CustomerNationalId` and `ApprovalNumber` are set.
  `CallCenterOrderDocumentBuilder` already supports the fields.
- Before minting, it reads `CheckActivePrescription`. A hit returns `pendingConfirmation.kind:
  activePrescription`, carrying the existing order number and a `confirmToken`, through the same modal path
  as `belowAtp`.
- The once-only key (OrderNo + DocumentType) is unchanged.

**Proposed contract v1.15, additive.**

| Area | Additions |
|---|---|
| Verbs | `setOrderType`, `setPrescription` |
| State | `header.orderType`, `header.prescription`, `capabilities.orderTypes` |
| Payment | `paymentTypeForcedReason: orderType` |
| Submit | blocker `prescription`; `pendingConfirmation.kind: activePrescription` |
| `setOrderType` response | `removed { coupons[], promotions }` |
| Codes | `ORDER_TYPE_NOT_OFFERED`, `PATIENT_ID_INVALID`, `REFERENCE_REQUIRED`, `NO_INSURANCE_STORE_FOR_DISTRICT` |

An old client that never calls the new verbs keeps ordering `CLCN` exactly as today.

## Testing Decisions

| Layer | Tests |
|---|---|
| Engine | SIS.Pos tests on a live basket: a 1+1 fires, then promotions off un-fires it and drops a coupon, then promotions on fires it again. Payable before and after. |
| Server | `Data.Tests` `CallCenterWeb` through `CcWire`, against the real session: type switch, prescription refusals, payment reason, no fee, the Nphies store rule, a mint as `WSFD` / `NPHS` with the fields on the OMS row, and the duplicate warning with its confirm token. Mutation-check the store branch and the fee input. |
| Client | vitest on the pure modules (picker offering, blocker text, notice text), and a console test from a stubbed state per type. |
| Walk | on production (`ProdWalk`), the owner's test orders, as for spec 160 (ticket 1010). |

## Tickets

| Ticket | What | Blocked by |
|---|---|---|
| BackOffice 4484 | SIS.Pos: an open transaction turns promotions and coupons off and on | — |
| BackOffice 4485 | The order type is a session fact (`setOrderType`) | 4484 |
| BackOffice 4486 | The prescription on the order (`setPrescription`, blocker) | 4485 |
| BackOffice 4487 | Payment lock, no fee and the Nphies store rule | 4485 |
| BackOffice 4488 | The submit mints `WSFD` / `NPHS` with the prescription, and warns on a duplicate | 4486, 4487 |
| BackOffice 4489 | Finding: CC1's NewPos submit sends `CLCN` for its Insurance and Wasfaty types | — (triage) |
| oms-react 1007 | The order-type picker and the switch notice | BO 4485 |
| oms-react 1008 | The patient ID and reference fields, and the type's rules on screen | 1007, BO 4486, 4487 |
| oms-react 1009 | The duplicate-prescription confirmation | 1008, BO 4488 |
| oms-react 1010 | Walk Wasfaty and Nphies orders on production | 1009 |

## Out of Scope

- **P2E** and the old plain-insurance type (`CallCenterInsurance`, kept by CC2 only to reopen older
  documents).
- **Starting from an approval**, any call to Nphies or Wasfaty, the insurer's share and the deductible (D1,
  default B).
- **The prescription session's status on the order** (D12).
- **A Wasfaty source list or mapping** (D7), pending OMS confirming WSFD versus DKSW.
- **Editing a submitted order's type.**
