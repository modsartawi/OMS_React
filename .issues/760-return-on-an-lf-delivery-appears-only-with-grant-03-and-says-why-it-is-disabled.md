---
status: done
spec: 759
blocked-by: —
---

# 760 — Return on an LF delivery appears only with grant 03 and says why it is disabled

## What to build

Spec 759 F1 + F2. An operator opening a **local fulfillment** delivery (`LF`) sees Return Document
only if they hold **LocalFulfillmentReturn 03**; with it, Return is enabled exactly when the server
says `canReturn`, and when disabled its tooltip says the server's own reason — for the window, *until
when* it was open.

- **The access probe** gains the two flags of 3369 (`canCreateLocalFulfillmentReturn`,
  `canForceLocalFulfillmentReturnRefund`), read the same strict way as every OMS flag: only an
  explicit `true` grants. 04 is read only beside 03 — a probe answering 04 without 03 grants neither.
- **The delivery model** gains `returnRefusal` and `returnWindowEndsOn` (optional, additive).
- **The command gate gains an LF arm.** For an `LF` delivery: not drawn without 03; otherwise
  `disabled` follows `canReturn` **alone** (strictly `true`, absent fails closed — 290's rule); the
  reason is `returnRefusal` mapped to a `document` namespace key, with `returnWindowEndsOn`
  interpolated (isolated with `fsi`, it is a tooltip) for `outsideWindow`. An unknown or absent
  refusal on a disabled LF Return gets a generic "the server refused" reason, never a bonded one.
- **The bonded arm is untouched.** The bonded grant (`canCreateReturn`) keeps drawing Return on
  non-LF deliveries; the LF grant draws it on LF ones. Every existing `commands.test.ts` case stays
  green **without edits**.

## Spine reach

model (header refusal fields; access flags) · logic (`core/oms/access` flags, the LF arm of the
command gate) · component (the action bar renders the new reasons — no new component) · i18n (four
refusal keys + the generic one, en + ar) · test (pure vitest + the action-bar drive)

## Proof (→ `tdd` red-green cycles)

- [x] `omsGrants reads both LF flags strictly` — absent, `null`, `"true"` all deny · pure
- [x] `04 without 03 grants nothing` · pure
- [x] `commandBar leaves Return off an LF delivery without 03` — and still draws it on a bonded delivery with `canCreateReturn` · pure
- [x] `commandBar enables LF Return only when canReturn is true` — and fails closed when absent · pure
- [x] `each LF refusal maps to its own key` — `outsideWindow`, `notDelivered`, `nothingRemaining`, `returnOpen`, plus unknown/absent → generic · pure
- [x] `the window refusal carries the end date` · pure
- [x] `the bonded tests pass unchanged` — `git diff` of `commands.test.ts`'s existing cases is empty · pure
- [x] `document-actions-drive.mjs` — a stubbed LF delivery: hidden for an ungranted session, each refusal read on hover and focus for a granted one · flow (Playwright)

## Boundaries

- **Server dependency, not built:** BackOffice 3373 (refusals on the delivery read) and 3376 (the
  probe flags). Both stubbed; field spellings are 759's transcription, corrected by 765.
- How the screen knows a delivery is LF: the delivery type `LF` as 3369 names it. If the read model
  carries it elsewhere, follow the model — do not re-derive it from the store code.
- No dialog change; pressing an enabled LF Return opens today's dialog unchanged until 761.

## Done when

All Proof boxes are ticked, `npm run typecheck`, `npm run lint` and `npm test` are green.

## Blocked by

None (can start immediately).

## Comments

**2026-11-04 — done** on `spec/759-lf-return` (1a95c9c7, review fixes 5407d1ad; merged to main 015d7fac 2026-11-05, unpushed). All Proof boxes proven against stubs; `document-actions-drive` 84/84. Decisions (overrulable): LF = `deliveryDocumentType === 'LF'` (trim/upper); flags live outside `OMS_SCREEN_FLAGS`; window date formatted by `formatDay` and `fsi`-wrapped; `outsideWindow` with no date gets its own no-date sentence. Copy (en + ar) needs owner sign-off. Live spellings wait on 765.
