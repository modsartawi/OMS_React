---
status: done
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

- [x] `withdrawReasonsFrom`: the server's order is kept; `noteRequired` is honoured by `canConfirmWithdraw`; absent,
      empty or malformed → none (Withdraw hidden). · pure (vitest)
- [x] `canWithdrawOn`: it needs `withdrawCategories` to hold the category (a bare string refused), plus the tab gate
      and a non-empty reason list. · pure (vitest)
- [x] `order-attachments-drive` gains:
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

## Comments

**Built 2026-09-27 (AFK).** Decisions are in `.afk/HITL-331.md`.

**Pre-flight.** BackOffice 2061, 2062 and 2063 are `status: done` on pricing2. BackOffice 2077 is `status: open`
(expected); the drive keeps stubbing `attachmentCategory` exactly as its `## Web contract` says.

**Contract cross-check (pricing2): no drift.**
- `AttachmentOwnerListResponse.WithdrawReasons` is a list of `AttachmentWithdrawReason`, each
  `{ code, label, labelArabic, noteRequired }`.
- `POST AttachmentWeb/{attachmentId}/Withdraw` takes `{ reasonCode, note }`. The grant filter's 403 has no body.
- `AttachmentWithdrawResult` answers 400 `reasonCode` / `note`, 404 `NOT_FOUND` and 503 `NOT_SET_UP`.
- `AttachmentAccess` carries `withdrawCategories`.

**What was built.**
- **`withdrawReasonsFrom`** (`core/attachments/rules.ts`) reads ByOwner's `withdrawReasons` in the order sent, keeping
  only the four fields the picker reads. It is all or nothing: absent, empty, not a list, a code sent twice, or one
  malformed reason all read as none (HITL).
- **The owner list.** `attachmentOwnerList` sets an optional `withdrawReasons` only when that list is usable, so the
  moved slip assertion in `api.test.ts` passes unchanged.
- **The slip drawer** still passes its own five reasons and ignores the server's.
- **`canWithdrawOn`** (`oms/document/attachments-tab.ts`) is the tab's gate AND `holdsCategory(withdrawCategories,
  attachmentCategory)` AND a non-empty reason list. It shares one private `admittedTarget` with `attachmentsTabGate`.
  An ERX order never offers Withdraw, because 2062 seeds no ERX withdraw grant.
- **`useOrderAttachments`** takes the reasons from the one ByOwner read (no extra request) and returns
  `withdrawReasons` and `withdrawOffered`. `AttachmentsTab` passes them into the shared panel. The panel already had
  the dialog, the EN·AR labels, `withdrawAnswer`, the re-read on a 200 or a 404, and the bare-403 removal (323/326).
- **Words.** No new keys. The button is the panel's frozen "Withdraw" (no ellipsis; HITL). The dialog's order words
  are 327's drafts in `document`. The reason labels are the server's.

**Proof.**
- `npm test`: 153 files, **2645** tests green. 16 are new:
  - `withdrawReasonsFrom` ×7 and the owner list ×2;
  - `canWithdrawOn` ×7.
- `typecheck`, `lint` (boundaries 672 files, contrast 129 pairs, palette 677 files) and `build` are clean.
- `order-attachments-drive` **210/210** (was 152). It checks:
  - Withdraw sits beside Download only with the grant;
  - the dialog lists the server's five reasons in the order sent, each label beside its `labelArabic` exactly;
  - Other stays disabled for no note or a blank note, and goes live once a note is typed;
  - a 400 keeps the input;
  - a codeless 500 can be pressed again;
  - a 200 posts exactly `{ reasonCode: "WRONG_ORDER", note }` with the Arabic note trimmed. It makes one ByOwner
    re-read, the file leaves the list, the badge drops by one, and Withdrawn (n) shows it first with who, when, the
    server's two labels and the note;
  - a 404 says so and re-reads once;
  - a 503 `NOT_SET_UP` offers no resend;
  - a bare 403 removes Withdraw from every file, across a tab switch and the page's Refresh;
  - nothing else is POSTed (the `ATWD` line is the server's);
  - there is no Withdraw when read-only, with a bare-string `withdrawCategories`, on an ERX order, with no
    `withdrawReasons`, or with an empty `withdrawReasons`.
- A mutation (Withdraw offered whatever the reasons) failed 2 of those checks and was restored.
- The four slip drives pass **unedited**: `slip-count` 64/64, `slip-drawer` 63/63, `slip-add` 52/52,
  `slip-withdraw` 68/68.
- The document drives: `detail` 39/39, `cards` 45/45, `rail` 25/25, `rtl` 53/53, `band` 34/34, `items` 23/23.
  `document-actions` still fails the same 3 checks it failed before this wave (7358a84; see HITL-327).

**Reviews.**
- `/code-review` found no correctness findings.
- `/standards-review`, standards axis, found no hard violations. Applied: `canWithdrawOn` no longer computes the
  target twice or reads the probe without a guard (`admittedTarget` + `probeList`). Kept:
  - the name `canWithdrawOn`, because the ticket names it;
  - the reasons parameter accepting null or undefined, because the Proof lists "absent";
  - the page passing four props;
  - 2062's reasons as test data in the tests and the drive, where they are the stub, never web code.
- `/standards-review`, spec axis, found nothing missing, no scope creep and nothing wrong. It noted an inherited point:
  the dialog's title, final sentence and confirm words are the caller's (`document`), not `attachments`. That is
  326/327's panel shape, logged in HITL for the owner.

**Outstanding (not AFK's).**
- The owner's hand walk against a live SIS.Api, with a user bound to read + withdraw (2071's Proof: Withdraw as
  `WRONG_ORDER`, the trail, the `ATWD` line on the Log tab).
- BackOffice 2077 actually served.
- The owner's read of the dialog's words and of 2062's drafted Arabic labels.
