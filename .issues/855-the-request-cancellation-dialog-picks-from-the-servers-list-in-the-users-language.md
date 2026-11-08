---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3461-cancellation-reasons-are-one-maintained-list-and-a-delivery-is-cancelled-only-by-request-spec.md
blocked-by: BackOffice 3462
---

# 855 — The Request cancellation dialog picks from the server's list, in the user's language

## What to build

`RequestCloseDialog` stops using the hard-coded `core/constants/cancel-reasons.ts`, and that file is deleted.
On open, the dialog loads the active cancellation reasons from BackOffice 3462's web read door and shows each
reason's `nameAr` or `nameEn` according to the UI language, in the server's order. On commit it posts
`reasonCode` plus `note = nameEn` (always English, whatever language was shown).

It keeps clearing the pick on every open. A load failure shows an inline error with commit disabled. A
server refusal (a reason retired while the dialog was open) surfaces through the existing 400 handling.

The "no codes … Risk R-2" comments are removed.

## Spine reach

UI → web API client → SIS.Api (3462)

## Proof (→ `tdd` red-green cycles)

- [x] `the request carries the code and the English name` — even when the Arabic name was shown · vitest (pure request builder)
- [x] `names follow the UI language` · vitest
- [x] `a failed load disables commit and says why` · vitest / component test per local precedent
- [x] `the pick is cleared on every open` (kept)

## Boundaries

🚩 Do not deploy before BackOffice 3462 is live on the target SIS.Api, or the dialog can't load and no
cancellation can be requested.

## Done when

The Proof tests are green, `cancel-reasons.ts` is gone, and against a dev SIS.Api with 3462 a request reads
back its code.

## Blocked by

BackOffice [3462](C:/Work/DMSCO/BackOffice/.issues/3462-a-cancellation-request-records-an-active-cancellation-reasons-code.md)

## Comments

**Done 2026-11-08 (stubbed; live read-back owed).** As built, on `impl/3461-855` off `spec/3461-cancellation-reasons`:

- `documentApi.cancellationReasons()` → `GET SdDocumentWeb/CancellationReasons` (`CancellationReasonModel { code, nameEn, nameAr }`,
  field names checked against 3462's C# `CancellationReasonModel`). `UpdateSdDocumentHeader` gains optional `reasonCode`;
  `buildUpdateHeader`'s extras carry it, included only when non-empty, so every other action's body is unchanged.
- Pure module `request-close.ts`: `cancellationReasonName` (Arabic under `ar*`, English otherwise, each falling back to the
  other), `requestCloseUpdate` (note = `nameEn`, extras = `{ reasonCode }`), `requestCloseCommit` (commit only on a loaded
  list holding the pick; `loadFailed` on error) and `requestCloseRefusalKeyOf` (`SDD-02235` → `requestClose.refused.unknownReason`).
- `RequestCloseDialog` reads the list on every open (`staleTime: 0`, `retry: false`), server order, option text through `fsi`
  (native option = string-only sink), select disabled until loaded, inline `ErrorBanner` on a load failure with commit disabled;
  the pick is still cleared in `onShow`. Its confirm hands back the reason; the page posts `postUpdate('request-close', nameEn,
  { reasonCode })`. An `SDD-02235` refusal is toasted in this client's words (en + ar) by code — Mark returned back's precedent —
  any other failure keeps `notify.apiError`.
- `core/constants/cancel-reasons.ts` deleted (only the dialog imported it); the "no codes … Risk R-2" comments are gone.
- New `requestClose.*` keys in `en` and `ar` `document.json`.

Proof: `request-close.test.ts` 9/9 (vitest); full suite 716 files / 9806 tests green; typecheck clean; lint gates grid-base,
contrast, palette, controls pass — the boundary gate's 4 violations are pre-existing (`insurance-rules/aliases/door-shapes.test.ts`,
3271), untouched here. New drive `tools/request-close-drive.mjs` 10/10 (stubbed wire): server order, commit gating, clear on open +
re-read per open, `SDD-02235` worded by code, the RTL-booted post carrying `reasonCode: CMIS` + `note: 'Order placed by mistake'`
on `UpdateDelivery` / `DRCL`, and the load-failure banner with select and commit disabled. `document-actions-drive` 84/84.

Owed:
- **Live read-back** against a dev SIS.Api with 3462 (no SIS.Api on :5111 this session; staging/prod deliberately not hit).
- The Arabic names are proven at the pure seam only: `@/core/i18n` boots `lng: 'en'` and nothing switches it at runtime
  (`oms.locale` sets only `<html dir>`), so the running app shows `nameEn` under RTL until the Arabic language switch exists.
- 🚩 Do not deploy before 3462 (and its Sd 080) is on the target SIS.Api.

