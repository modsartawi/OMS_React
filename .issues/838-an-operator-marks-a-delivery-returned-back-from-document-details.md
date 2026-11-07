---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3433-back-office-marks-an-out-for-delivery-delivery-returned-back-spec.md
blocked-by: —
---

# 838 — An operator marks a delivery returned back from Document Details

## What to build

The oms-react half of **Marked returned back** (BackOffice spec 3433, ADR 0126). It is the sibling of
Mark delivered (BackOffice ticket 2422) and reuses its cluster, dialog pattern and pure-logic module
shape.

- **The command** sits in the existing Mark delivered cluster ("Delivery") on Document Details, as its
  own button.
  - It is drawn only when the access probe says `canMarkReturnedBack` **and** the document's category is
    `D`; otherwise it is hidden, not disabled. Each command in the cluster is drawn for its own grant
    alone, so a user with only one of the two grants sees only that command.
  - When drawn, it has the same state gate as Mark delivered: disabled with a reason key when
    `deliveryStatus !== 'O'` or `closeStatus` is not blank.
  - It has a neutral icon (no check mark) and never takes the promoted commit slot.
  - Its label is "Mark returned back" (AR: تحديد كمُعاد إلى الفرع). Never call it "Return": that word
    means Create return on this screen.
- **The Mark returned back dialog**, on the Mark delivered dialog's pattern:
  - a required reason select, loaded from `SdDocumentWeb/MarkReturnedBackReasons` and labelled from
    locale keys by code in English and Arabic. codes `CARB`, `DAPB`, `STOR`, `OTHB` (distinct from Mark delivered's, because `ReasonCode` alone is the table's key);
  - a note field capped at 100 characters, required on "Other";
  - an **always** shown line: the store must now reschedule or cancel this delivery;
  - on `isExpressDelivery`, a warning that the order will be requested closed automatically in five
    minutes;
  - **no** amount-due line;
  - commit is locked while the request is pending, and dismiss is blocked while it is in flight;
  - a server refusal is shown inline from its machine code (BackOffice 3435's codes, each with an i18n
    string in en and ar);
  - a 403 closes the dialog with a toast and revokes only `canMarkReturnedBack` on the cached access;
  - success shows a toast and reloads the document, so the `B` status and the new log row show at once.
- **The guardrail amendments:** oms-react's `CONTEXT.md` and the command-panel guardrail comments that
  name Mark delivered as the single exception now name **both** back-office corrections and point at
  BackOffice ADR 0126 beside ADR 0065. Returned back is not a positive outcome, so the commit slot stays
  empty.
- Follow `.claude/rules/`: feature structure, zero i18n literals, the API envelope, logical Tailwind, bidi.

## Spine reach

UI: probe → command cluster → dialog → API client. It runs against BackOffice 3434–3436's endpoints.

## Proof (→ `tdd` red-green cycles)

- [x] `markReturnedBack hidden without canMarkReturnedBack or off category D` · Vitest (beside `mark-delivered.test.ts`)
- [x] `each grant draws only its own command in the Delivery cluster` · Vitest
- [x] `markReturnedBack disabled with reason key on each non-O status and on a pending cancellation; enabled on O with blank closeStatus` · Vitest
- [x] `the express warning shows only on isExpressDelivery; the reschedule line always shows` · Vitest
- [x] `dialog commit requires a reason, and a note on Other; the note is capped at 100` · Vitest (pure logic module)
- [x] `every refusal code from BackOffice 3435 maps to an i18n key in en and ar` · Vitest
- [x] Stubbed Playwright drive (the `tools/mark-delivered-drive.mjs` precedent): happy path with reload, both disabled states, hidden for no grant / older API / category T, a refusal worded inline, and a 403 that closes the dialog and revokes access.
- [ ] Manual walk against a local SIS.Api with 3434–3436 and both seeds applied: a granted user marks an `O` delivery returned back and sees `B`, the toast, the reload and the `DRBK` log row; on an express delivery the close request follows; an ungranted user sees no command.

## Boundaries

- Separate repo. There is no backend change in this ticket.
- Release order: seeds, then SIS.Api (BackOffice 3434–3436), then oms-react.
- The Arabic wording needs an owner read, as 2422's did.

## Done when

The Vitest proofs and the stubbed drive are green, typecheck and all lint gates pass, the manual walk
succeeds, and the guardrail amendments are in.

## Blocked by

BackOffice [3435](C:\Work\DMSCO\BackOffice\.issues\3435-mark-returned-back-refuses-anything-but-a-clean-out-for-delivery-delivery-with-a-valid-reason.md), BackOffice [3436](C:\Work\DMSCO\BackOffice\.issues\3436-document-details-learns-the-mark-returned-back-grant-and-its-reasons.md)

## Comments

- 2026-11-07: built on `impl/838-mark-returned-back` and fast-forwarded into `main` at `2744310e`. Vitest 9647/9647, typecheck clean, `tools/mark-returned-back-drive.mjs` 48/48, `mark-delivered-drive.mjs` 40/40. Refusal codes mapped to BackOffice 3435 as shipped (SDD-02225..02230). BackOffice 3434-3436 done and merged into pricing2 (b1a44ea89), so the blockers are cleared. Still owed: the manual walk (needs both HQ seeds applied) and an owner read of the Arabic. Cosmetic: `MARK_RETURNED_BACK_REASONS` and its test still list CARB, DAPB, OTHB, STOR; the server now serves Other last (CARB, DAPB, STOR, OTHB) and the dialog renders the server order.
