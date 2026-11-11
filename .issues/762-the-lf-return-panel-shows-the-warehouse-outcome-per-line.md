---
status: done
spec: 759
blocked-by: 760
---

# 762 — The LF return panel shows the warehouse outcome per line

## What to build

Spec 759 F4. Opening the **return** delivery of an LF return on Document Details shows an *LF
return* section — the warehouse watch — fed by 3369's LF return detail read (by return delivery
no.), drawn only for a session holding grant 03.

- **Outcome** as a status chip (`open`, `refunded`, `short`, `nothingReceived`, `unanswered`,
  `forced`) with its meaning in words. **Booked / collected / confirmed** dates in local wall-clock.
- **An attention banner** at the top for `unanswered`, `nothingReceived` and `short` — saying action
  is needed and what kind.
- **One row per line:** item · SKU · asked · confirmed · refunded · restocked · reason. A
  not-yet-confirmed quantity reads as pending, never `0`.
- `forced` shows who forced it and why (`forcedBy`, `forcedReason`).
- Read-only. Force refund is 763's.

Bidi: numbers, dates and SKUs in `Ltr`; reason names and `forcedReason` in `<bdi>`.

## Spine reach

api (the detail read in the feature's `api.ts`) · model (`core/models/` LF return detail type) ·
logic (pure projection: outcome → chip tone + banner key, pending vs zero) · component (the panel,
placed beside the existing Document Details sections) · i18n (en + ar) · test (pure vitest + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `each outcome projects to its chip and meaning` · pure
- [x] `only unanswered, nothingReceived and short raise the banner` · pure
- [x] `an unconfirmed quantity is pending, not zero` · pure
- [x] `the panel is drawn only on an LF return delivery with grant 03` — not on the forward delivery, not on a bonded return, not without 03 · pure
- [x] `lf-return-drive` — stubbed detail read, one fixture per outcome, banner + lines + forced-by read in en and ar (RTL) · flow (Playwright)

## Boundaries

- Server read: BackOffice 3376, stubbed. Its exact name and spellings are 759's transcription.
- How the screen knows a return's forward delivery is LF follows what 3376's read gives; do not
  infer it from store codes.
- No new route, no new namespace — `document`.

## Done when

All Proof boxes are ticked, gates green.

## Blocked by

- 760 (the grant 03 flag)

## Comments

**2026-11-04 — done** on `spec/759-lf-return` (3734fc69, review fixes 5407d1ad; merged to main 015d7fac 2026-11-05, unpushed). `lf-return-drive` 156/156 LTR+RTL (incl. 763). ⚠ Guessed read route `GET SdDocumentWeb/Delivery/{no}/LfReturn`; `data:null`/404 = not an LF return. 765 must correct it. Outcome reads go through `core/oms/lf-return-outcome.ts` (accepts `nothingReceived` and `nothing-received`). Confirmed reads Pending until `confirmedAt`; refunded/restocked read Pending while open/unanswered. Open: the banner says "force the refund" to a 03-only operator who cannot.
