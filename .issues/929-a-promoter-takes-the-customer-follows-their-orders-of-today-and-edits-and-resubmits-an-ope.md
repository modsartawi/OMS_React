---
status: done
spec: BO 4063 (E:\Projects\BackOffice\.issues\4063-mini-pos-promoters-sell-non-pharmacy-items-spec.md)
blocked-by: BO 4070, BO 4071, 928
---

# 929 — A promoter takes the customer, follows their orders of today, and edits and resubmits an open order

## What to build

The rest of the phone flow:
- **The customer step** before the basket: mobile number or Arbahi QR scan; a new mobile goes through sign-up with
  the customer's code; then the member's name or tier is shown.
- **My orders today,** with status.
- **Reopen and resubmit** an open order, showing the server's refusal while a till holds it or after billing.
- **A clear "no connection" state,** with no double submit.

## Spine reach

UI (PWA) → BackOffice SIS.Api (4070, 4071)

## Proof (→ `tdd` red-green cycles)

- [x] Component: customer required before the basket; refusal while held; no double submit offline · vitest
- [ ] Live walk against a SIS.Api with 4070/4071 — **owed** (stubbed drive only, see Comments)

## Boundaries

—

## Done when

The full phone flow works end to end against a test pharmacy.

## Blocked by

BO [4070](E:\Projects\BackOffice\.issues\4070-pricing-needs-a-member-a-new-mobile-signs-up-at-the-pharmacy-and-the-customer-gets-the-ord.md), BO [4071](E:\Projects\BackOffice\.issues\4071-a-promoter-edits-and-resubmits-their-open-order-and-the-edit-is-refused-while-a-till-holds.md), [928](928-a-promoter-installs-the-mini-pos-app-signs-in-unlocks-at-the-pharmacy-scans-a-basket-and-s.md)

## Comments

**2026-11-19, implementer (branch `t929`, worktree `E:\Projects\OMS_React-t929`)**, on `spec/4032-mini-pos`. Built
against BackOffice `spec4032` (read only): `MiniPosEndpoints.cs`, `MiniPosOrderEdits.cs`, `MiniPosRefusals.cs`,
`CallCenterWebSignUpRequests.cs`, `LoyConsumeScanCodeRequest.cs`, and the answers of 4070 and 4071. SIS.Api was not run.

- **Customer step before the basket.** `flow.ts` `basketView(state)`: a session with no `header.customer` shows
  `CustomerScreen`, one with a member shows the basket. This is the server's word, so an opened, resumed or reopened
  basket lands on the right step by itself. Mobile → `MiniPos/MemberByMobile/{mobile}` (as typed; `LOY-00100` is read
  as "not a member", as the console's lookup does). Arbahi QR → camera (`MEMBER_CODE_FORMATS`, `qr_code`) →
  `MiniPos/MemberByScanCode { scanCode }`, sent as read. Not a member → country (the console's six, SA first) and
  message language (asked, not defaulted) → `SignUpByBranch` → the code → `ConfirmSignUpByBranch`. No branch on the
  wire. Each sign-up action keeps its request id across a lost connection. The member found is attached at once
  (`MiniPos/AttachCustomer`). If the attach fails, the found card stays with "Take this customer", so a burnt Arbahi code
  need not be scanned again. The basket's `CustomerSlot` shows the session's name and mobile, plus the tier of the member
  the phone found when it is the same member. A reopened order's customer has no tier shown: the session does not carry
  one.
- **NO_CUSTOMER_ATTACHED** keeps the server's English and gets the phone's own Arabic line (`withPhoneArabic`,
  `phoneArabic.*`).
- **My orders today.** `OrdersScreen` (`MiniPos/MyOrdersToday`), reached from the header and from the submitted screen.
  It shows the server's status per order (open / at a till / paid / closed). Edit is offered on open and held orders.
  The server decides on the reopen, and its refusal (`MINIPOS_ORDER_AT_TILL`, `_PAID`, `_CLOSED`, `_BASKET_OPEN`, ...)
  is shown over the list in both languages.
- **Reopen and resubmit.** `MiniPos/Reopen { documentNo, requestId }` → the basket with `editing` = the order number.
  Its submit button reads "Resubmit order" and calls `MiniPos/Resubmit`. Success shows "Order updated" with the same
  barcode. Resubmit refusals stay on the basket. ⚠ A reopened basket resumed through `refusedExisting` (after leaving
  it) does not know its order number, so it shows "Submit order" and calls plain `Submit`. Per 4071 that also resubmits,
  so the outcome is the same and only the label differs.
- **No connection.** `networkMode: 'always'` in `minipos-main.tsx`, so an offline call fails at once instead of being
  paused and sent later unseen. A call that never reached the server (`isNoConnection`) moves no screen and shows
  `NoConnection`. While the browser is offline, submit is disabled. `createSubmitGuard` drops a second tap while a submit
  is in flight. After a lost connection it re-sends the SAME request id, so a submit that did land is replayed by the
  ledger and not minted twice. Once the server answers, the next submit is a new action. A basket read lost to the
  connection offers Try again.
- **Tests.** `flow.test.ts` (14), each proof mutation-checked red: customer gate off; a new id after a lost connection;
  in-flight drop off; offline submit enabled; the `LOY-00100` miss thrown. Whole suite green (831 files / 11261 tests).
  Typecheck clean. Lint: grid-base, contrast, palette, controls (no new hand-written control) and map-build OK.
  Boundaries fails only on the 4 known insurance-rules violations.
- **Drive.** `tools/minipos-drive.mjs` (stubbed, 390x844) passed **31/31**. It walks customer (new mobile → sign-up,
  wrong code refused, attached, name + tier) → basket → submit → my orders (statuses; held reopen refused in both
  languages) → reopen → edit → offline (resubmit held) → lost resubmit → retry with the same request id → "Order updated".

**Owed / for the owner:**
1. **Live walk** against a SIS.Api with 4070/4071 (and 096 applied), on a test pharmacy. The ticket's Done-when.
2. **Arbahi QR content.** The phone sends the camera's read verbatim. The till strips a `966` wedge prefix and the server
   does not. Confirm on the trial that the app's QR is the bare 26-character code.
3. **Sign-up country.** The phone offers the console's six countries with SA first. A pharmacy outside KSA has to pick
   its own each time. A default from the pharmacy's country would need the server to say it.
4. **Tier** shows only for a member the phone looked up. If the owner wants it on reopened orders too, the session's
   `customer` projection (or the reopen answer) has to carry it.
