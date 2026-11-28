---
status: done
spec: 1006
blocked-by: BackOffice 4485
---

# 1007: The agent picks the order type and sees what a switch took off

Client half of spec 1006, decisions **D1**, **D10** and default **A**.

## What to build

- **The picker.** One segmented control in the header column, beside the source:
  - the options are *Phone order · Wasfaty · Nphies* (en and ar);
  - it shows only the types in `capabilities.orderTypes`, and is hidden when only `Ordinary` is offered;
  - choosing a type sends `setOrderType`.
- **Telling a prescription order apart.** A Wasfaty or Nphies order shows its type as a badge on the order
  title and the receipt, so it is never mistaken for a phone order mid-call.
- **The switch notice.** When `removed` is non-empty, one dismissible line reads, for example, *"Wasfaty
  order: 2 promotions and coupon SAVE10 were removed"*. Nothing shows for an empty `removed`.
- **The promotions panel** on a Wasfaty or Nphies order says *Offers don't apply to prescription orders*
  instead of listing near-misses.

## Proof

- [x] vitest: the picker's offering from capabilities, and the notice text for coupons, promotions, both and
  none (en and ar).
- [x] A console test from stubbed states: an Ordinary order with a fired offer, switched to Wasfaty, shows
  the notice, the badge and the empty-panel line.
- [x] typecheck, vitest, lint.

## Comments

**2026-11-28, built against the proposed v1.15 with stubs (BackOffice 4485 open).** Pure module
`src/features/callcenter/console/order-type.ts` (+ `order-type.test.ts`, en and ar); picker and badge
`OrderTypePicker.tsx` (core/ui `Chip`, no ratchet cost); the notice is `OrderTypeRemovedBanner` in
`ConsoleShell.tsx`; `promotionsPanel(...).prescription` drives the panel line. Drive
`tools/callcenter-order-type-drive.mjs`: 39/39.

**Contract guesses to reconcile when BO 4485 ships:**
1. **Enum naming.** `orderType` values are `'Ordinary' | 'Wasfaty' | 'Nphies'` (PascalCase, like
   `PaymentType`/`DeliveryType`), with `(string & {})` so an unknown value degrades. The verb body is
   `{ transactionId, requestId, orderType }`.
2. **Verb path.** `POST CallCenterWeb/SetOrderType`.
3. **Where `removed` sits.** Beside the state, `{ state, removed }`, as `LinkRequestResult` has it —
   not a field on `SessionState`.
4. **`removed`'s shape.** `{ coupons: string[] (the codes), promotions: number (a count of the fired
   promotions stopped) }`. If BO sends coupon objects (`AppliedCoupon`) or a promotion list, the notice
   helper reads the wrong thing.
5. **`capabilities.orderTypes`** is the offered set, including `Ordinary`. Absent means a pre-1.15
   server, so the picker is hidden. The order's own type stays listed even when it is not offered.
6. **`header.documentType`** may flip to `WSFD`/`NPHS` on switch. The raw document-type chip in the
   top bar is kept; the worded badge reads `header.orderType`.
7. **Refusal.** `ORDER_TYPE_NOT_OFFERED` is worded on the picker; any other refusal shows the server
   message (`apiErrorMessage`).

Placement: the picker is the first field of the header ledger, beside Source and Ref. The top bar's
*offers within reach* count is zero on a prescription order.

### 2026-11-28 — built (spec/1006-prescription-orders)

Done on stubs against the proposed contract v1.15; the shape guesses above must be reconciled when the BackOffice tickets ship. Code review of the branch (9 findings) fixed in df551341. Drives green at df551341: prescription 65/65, `callcenter-drive.mjs` 531/531 (duplicate-prescription 44/0 and order-type 39/0 on the fix branch). The live proof is ticket 1010.

### 2026-11-28 — Reconciled to BO pricing2 e1433bf00 (tickets 4484–4488, branch ticket/1006-reconcile-bo)

Each guess, against `CallCenterOrderTypes.cs`, `CallCenterSessionStateModels.cs`, `CallCenterSessionService.OrderType.cs`,
the route table and fixture scenario 16:
1. **Enum naming — confirmed.** `Ordinary | Wasfaty | Nphies`, PascalCase, matched ignoring case; `header.orderType` is
   never null (an old row reads `Ordinary`). Body `{ transactionId, requestId, orderType }` — **plus** `confirmToken?`.
2. **Verb path — confirmed.** `POST CallCenterWeb/SetOrderType`.
3. **Where `removed` sits — confirmed.** `{ state, removed }` (`CallCenterSetOrderTypeResult`).
4. **`removed`'s shape — confirmed.** `coupons: string[]` (the codes as typed), `promotions: int` (fired before, not
   after). Empty on a switch to Ordinary, on a replay and on an ask.
5. **`capabilities.orderTypes` — confirmed, narrowed.** Per order (`ForOrder`): Ordinary and the current type always,
   Wasfaty/Nphies only while OMS lists WSFD/NPHS, and **no prescription type on a Tamara-linked order**. The client's
   own "keep the current type" union is removed (`offeredOrderTypes(capabilities)`), the server does it.
6. **`header.documentType` — changed: it never flips.** The header keeps the seat's type; only the submit mints
   WSFD/NPHS. Stubs no longer flip it.
7. **Refusals — confirmed, one added.** `ORDER_TYPE_NOT_OFFERED` (409) and `NO_INSURANCE_STORE_FOR_DISTRICT` (409) are
   worded on the picker; `COUPON_REVERSAL_REFUSED` shows the server message.
8. **New, not guessed: the switch is two-phase.** To or from Nphies on a delivery re-derives the store, and a basket with
   lines answers a `storeChange` ask (unchanged state, nothing removed). The page now hands that ask to the rebind's
   sheet (`StoreMoveKind 'orderType'`); *Confirm* re-sends `SetOrderType` with the same `requestId` and the token, and
   the commit's `removed` is drawn. Ordinary ⇄ Wasfaty never moves the store. Drive scenario F.
9. **Also new:** `canApplyCoupon` reason `ORDER_TYPE` on a prescription order (worded `coupon.shut.ORDER_TYPE`, en+ar);
   `applyCoupon` there is refused `COUPON_REJECTED` before redeeming.

Drive `tools/callcenter-order-type-drive.mjs`: 49/49.
