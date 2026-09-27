---
status: open
spec: 324
blocked-by: 327
---

# 331 — Withdraw… offers the server's reasons, and a bare 403 takes it away

## What to build

**Withdraw…** on the previewed file in the Attachments tab, beside Download, as for slips (spec 324 → "Withdraw").

- **The gate:** 327's tab gate **and** `withdrawCategories` holding `attachmentCategory`, by the same
  `holdsCategory` membership test. Nobody is bound on day one (2062), so it stays hidden until an admin binds someone.
- **The reasons are the ByOwner response's `withdrawReasons`**, in the order sent, each
  `{ code, label, labelArabic, noteRequired }`, passed into 326's reason-list parameter.
  - Show `label` beside `labelArabic`.
  - **Do not copy 2062's table into the web.** There are no client fallback reasons.
  - If `withdrawReasons` is absent (an older SIS.Api) or empty, Withdraw is hidden.
- **Confirm** is live when a reason is picked and, where `noteRequired`, the note has something in it. The body is
  `{ reasonCode, note }`, with the note through the shared clamp (trimmed, 200, surrogate pair whole).
- **Answers** are the slip rules (`withdrawAnswer`):
  - 200 drops the preview and re-reads ByOwner (the file moves to Withdrawn (n), and the badge follows);
  - 400 keeps the input and shows the message;
  - 404 says so and re-reads;
  - a **bare 403** takes Withdraw away for the rest of the page visit;
  - 503 `NOT_SET_UP` shows the message with no resend;
  - anything else shows the message, and pressing again is safe.
- The order's `ATWD` history line is the server's. The web sends nothing for it. The Log tab shows it on its next
  load.
- **Withdrawn (n)** rows show `withdrawnBy`, `withdrawnAt`, `reasonLabel` beside `reasonLabelArabic`, and the note.
  If 327 drew these already, assert them here.

The slip drawer keeps its client five-code list (moving slips onto the server's reasons is out of scope).

## Spine reach

store/logic · component · i18n · test (the model type for `withdrawReasons` landed in 327)

## Proof (→ `tdd` red-green cycles)

- [ ] `withdrawReasonsFrom`: the server's order is kept; `noteRequired` is honoured by `canConfirmWithdraw`; absent,
      empty or malformed → none (Withdraw hidden). · pure (vitest)
- [ ] `canWithdrawOn`: it needs `withdrawCategories` to hold the category (a bare string refused), plus the tab gate
      and a non-empty reason list. · pure (vitest)
- [ ] `order-attachments-drive` gains:
      - Withdraw with the server's reasons (EN·AR labels shown as sent), with `WRONG_ORDER` posted;
      - Other disabled until a note is typed;
      - a bare 403 removing Withdraw for the visit;
      - no Withdraw without the grant, or without `withdrawReasons`;
      - the withdrawn file in Withdrawn (n) after the re-read.

      `slip-withdraw-drive` stays unmodified and green. · flow

## Boundaries

- **Endpoint:** the existing `AttachmentWeb` withdraw route, the one the slip uses.
- **Codes:** `NOT_SET_UP`, a bare 403, 404, the field 400s.
- **i18n:** "Withdraw…" and the dialog chrome come from `attachments`. The reason labels are the server's (no keys).

## Done when

A stubbed user holding the withdraw grant withdraws a prescription as `WRONG_ORDER` with the server's labels, sees it
move to Withdrawn (n), and the pure tests and drives are green.

## Blocked by

[327](327-opening-the-attachments-tab-lists-the-orders-files-once.md)
