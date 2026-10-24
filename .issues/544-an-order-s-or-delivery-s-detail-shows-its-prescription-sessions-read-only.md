---
status: open
spec: C:\Work\DMSCO\BackOffice-2994\.issues\2994-prescription-session-spec.md
blocked-by: — (live: BackOffice 3016 + 3014 on branch spec2994)
---

# 544 — An order's or delivery's detail shows its prescription sessions, their next step and what happened after close, read-only

## What to build

**Slice 0** of the prescription-session web screens (BackOffice spec 2994; hand-offs in
`C:\Work\DMSCO\BackOffice-2994\.issues\3016-cc2-and-the-oms-web-see-a-session-s-status-on-its-order.md` "Hand-off -
oms-react" and `...\3014-after-close-events-and-re-sales.md` "oms-react hand-off"). Brief:
`C:\Users\MOHAME~1.SAR\AppData\Local\Temp\claude\C--Work-DMSCO-BackOffice\70da4869-dbae-4cea-9403-d9096ee8d47a\scratchpad\oms-react-prescription-session-brief.md`.

An OMS web user opening an order or a delivery (both are `DocumentDetailsPage`) sees, read-only, the prescription
sessions attached to it, so they can answer "where is my medicine?". They can advance nothing.

- **Model** `core/models/prescription-session.ts` from BackOffice
  `Sartawi.Retail.Data\Modules\PrescriptionSessions\Models\PrescriptionSessionOrderStatusModels.cs` and
  `PrescriptionSessionAfterCloseModels.cs` (camelCase on the wire):

  ```ts
  interface PrescriptionSessionOrderStatus {
    documentNo: string
    sessions: PrescriptionSessionStatus[]
    row: PrescriptionSessionStep | null   // the order's one line; null with no session
    isInvoiced: boolean
  }
  interface PrescriptionSessionStatus {
    sessionId: string; displayId: string            // PS-…
    sourceKind: string                              // NPHS | WSFT
    holdingStore: string; state: string; route: string | null   // COUNTER | DELIVERY | null = not chosen
    step: PrescriptionSessionStep | null
    afterClose: PrescriptionSessionAfterClose[]
  }
  interface PrescriptionSessionStep {
    code: string; label: string                     // label is SIS.Api English — shown as server text
    owner: string                                   // HOLDING_STORE | PAYER | CUSTOMER | DONOR_STORE | SYSTEM | NONE
    waitingOn: string | null                        // PS-… on a shared order
    isParked: boolean; parkNote: string | null
    badges: string[]                                // EXPIRES_TOMORROW
  }
  interface PrescriptionSessionAfterClose {
    kind: string                                    // RETURN | CORRECTION | RESALE
    originalSaleNo: string; documentNo: string; resaleNo: string | null
    storeCode: string; recordedAt: string; recordedBy: string
  }
  ```

  The step and after-close shapes are **shared with the HQ list** (545, 547), so they live in core.
- **Core words** (`@/core/prescription-session/…`): code → i18n key for state (12 states), owner, route, source kind,
  badge and after-close kind, EN + AR. An unknown code renders the code itself, never a raw key. These are reused by
  545–548; features never import each other.
- **Door** `documentApi.getPrescriptionSessions(documentNo)` → `GET SdDocumentWeb/Document/{documentNo}/PrescriptionSessions`
  on the existing detail gate (`GatedByDetail`, `BackOfficeScreen[DocumentDetails,03]`). A delivery number works too
  (SIS.Api reads it through its order). Same shape as 542's `getCallout`.
- **Panel** on Details: the `row` line first, then one line per session — `displayId`, source, holding store, state,
  route, `step.label`, owner, parked + note, badges — and under each session one line per `afterClose[]` event (kind,
  the sale / document / re-sale numbers, store, recorded at + by). Words per kind are the client's, in EN + AR
  (BackOffice `Describe()` is the English reference: "Returned R1 (sale S1)", "Patient share corrected on S1: reversal
  R1, re-invoice I2", "Re-sold as I2 (after sale S1)").
- **Empty `sessions` renders nothing** — no heading, no empty state (most orders have no session). A failed read
  hides the panel and blocks nothing on the page.
- Several sessions on one order (shared delivery) are listed in full.

## Spine reach

model · api · logic (code → words, panel lines) · Details panel · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [ ] code words: every state, owner, route, source, badge and after-close kind maps to a key; an unknown code
      renders itself; a null route reads "not chosen" (vitest, pure)
- [ ] panel lines: one session, a shared order with two sessions (one `waitingOn`), a parked session with its note
      and `EXPIRES_TOMORROW`, a closed session with RETURN, CORRECTION and RESALE lines; empty `sessions` → no lines
      (vitest, pure)
- [ ] drive script, LTR and RTL, against a stub serving the door for those cases, opened both as an order and as a
      delivery: the panel shows / is absent, no button on it, a failed read leaves the page working
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Door: BackOffice 3016 + 3014, built on branch `spec2994` (`C:\Work\DMSCO\BackOffice-2994`), **not merged to
  `pricing2`, not deployed** — stubbed until 549. Needs OMS SQL `Modules/PrescriptionSessions/Sql/019` on the live side.
- Read only, no act. No new grant, no new route.
- Times are local wall-clock (UTC+3 estate): show them as they come, no zone conversion.
- Bidi: `displayId`, store codes, sale / document numbers and times are machine values (`Ltr`); `step.label`,
  `parkNote` and `recordedBy` are free text (`<bdi>`). A "code · name"-style pair is formatted once (`formatPair`).

## Done when

The Proof boxes are ticked: on the running app (stubbed), an order or delivery with sessions shows them and their
after-close events read-only, and one without shows nothing.

## Blocked by

None — can start immediately.
