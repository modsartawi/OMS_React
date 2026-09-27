---
status: done
spec: 324
blocked-by: —
---

# 325 — The slip rules, reads and upload store live in `core/attachments`, and every slip suite passes unchanged

## What to build

**Prefactor, first half of the lift** (spec 324 → "The lift into `core/attachments/`"). There is no behaviour change.
The ECR-slip drawer's non-visual body moves up out of `features/collection/inquiry` into `src/core/attachments/`,
so the order page (a different feature) can use it without importing a feature (2050 G3).

**Moves, parameterised by owner kind / key / category / kind instead of the slip constants:**
- **The pure rules.**
  - From `slips.ts`: `holdsCategory`, the preview kind, `wallClockText`, the withdrawn ordering, the owner-list
    projection, and the content-failure codes (`NOT_FOUND`/`FILE_SERVER_MISSING` → gone/lost/other).
  - From `slip-upload.ts`: the upload check (10,485,760 bytes; jpg/jpeg/png/pdf by extension **or** type), the upload
    form builder and `isRetryableUpload` (by code, never status).
  - From `slip-withdraw.ts`: the withdraw rules (the note needed, the note trimmed and cut to 200, the body, and
    `withdrawAnswer` with its close/resend predicates).
- **The reads.** The access probe, `ByOwner` (by owner kind + key), `/Content`, Upload and Withdraw. Their query keys
  move under **one `attachments` head**.
  - The probe keeps **one** shared cache entry, which the slip grids, the drawer and (from 327) the order page all
    read.
  - The ByOwner read takes its **freshness as a parameter**. The slip drawer passes today's "a new read on every
    opening".
- **The upload store** (`slip-upload-store.ts`), **keyed by owner kind + key**. It keeps each file's
  `ClientRequestId` across retries and a close, exactly as today.
- **The types.** `core/models` gains the shared stored/withdrawn item and access shapes. `StoredSlip`,
  `WithdrawnSlip`, `AttachmentAccess` and the rest become **aliases** of them. Nothing is renamed on the wire.

**Stays in `collection/inquiry`** (slip-specific): `CASH_CLOSE`, `STORE_DAY`, `ECR_SLIP`, `storeDayOwnerKey`,
`slipDayOf`, the slip count, column and "No slip" filter, `slipCountedRows`, `markSlipDayChanged` (it now invalidates
the new ByOwner key), and the five-code **slip reason list**. The slip call sites pass the slip constants into the
parameterised functions.

The form builder must stay **byte-identical** for slips: the same six parts, in the same order, with no
`SourceDevice`. The caption part is 330's. Do not add it here.

## Spine reach

model/api · store/logic · test (no component, route or i18n change)

## Proof (→ `tdd` red-green cycles)

- [x] `slips.test.ts`, `slip-upload.test.ts`, `slip-upload-store.test.ts` and `slip-withdraw.test.ts` move with their
      modules, re-pointed at the new paths with **assertions unchanged**. Slip-only cases stay in the feature. · pure
- [x] A new `core/attachments` test pins the probe query key: the slip grids and the drawer resolve to the **same**
      key. · pure
- [x] `slip-count-drive`, `slip-drawer-drive`, `slip-add-drive` and `slip-withdraw-drive` pass **unmodified**, and
      `npm test`, `typecheck`, `lint` and `build` are green. · flow (Playwright)

## Boundaries

No new endpoint, no i18n change, no new namespace (that is 326's).
- **Lint:** nothing under `core/attachments` imports a feature.
- Keep `core/models/collection.ts`'s slip exports as aliases, so no other feature changes.
- An assertion that has to change is a behaviour change: stop and record it as a finding.

## Done when

The slip pure modules, reads and upload store live in `core/attachments` with their suites green unchanged, and the
four slip drives pass without edits.

## Blocked by

None — can start immediately.

## Comments

**Done 2026-09-27 (AFK).** No behaviour change. The decisions are logged in `.afk/HITL-325.md`.

**What moved to `src/core/attachments/`.**
- `rules.ts` (from `slips.ts`): `holdsCategory`, `attachmentSource` (was `slipTill`; the spec's source-line rule),
  `attachmentPreviewKind`, `wallClockText`, `withdrawnNewestFirst`, `attachmentOwnerList`, and
  `attachmentContentFailure` with `CONTENT_NOT_FOUND` / `CONTENT_FILE_MISSING`.
- `upload.ts` (`git mv` of `slip-upload.ts`): the browser check (10,485,760 bytes; jpg/jpeg/png/pdf by extension
  **or** type), `attachmentUploadForm(item, target)` (the same six parts in the same order, with owner kind/key,
  category and kind from an `AttachmentTarget`), and `isRetryableUpload` (by code, never status).
- `upload-store.ts` (`git mv` of `slip-upload-store.ts`): `useAttachmentUploads`, keyed by owner kind + key
  (`uploadSlot`, read through `uploadsOf`). It no longer takes a `QueryClient`: `add`/`retry` run the caller's
  `onStored` after each 200. The slip passes `markSlipDayChanged`, which makes the same three invalidations in the
  same order.
- `withdraw.ts` (from `slip-withdraw.ts`): `needsWithdrawNote(reasons, code)` and
  `canConfirmWithdraw(reasons, code, note)` over `{ code, noteRequired }[]`, plus `withdrawNote` (trim, then 200
  without splitting a surrogate pair), `withdrawBody`, `withdrawAnswer`, `withdrawClosesDialog` and
  `withdrawCanResend`.
- `api.ts` (the reads, out of the feature's `api.ts`): `attachmentsApi` (`access`, `byOwner`, `content`, `upload`,
  `withdraw`), all through `@/core/api`. Every key is under ONE `attachments` head:
  - `ATTACHMENT_ACCESS_KEY = ['attachments','access']` — the ONE probe entry (`staleTime ∞`, `retry: false`). The
    grids (`useSlipView`), the drawer and Add all read `attachmentAccessQuery()`, and no other spelling exists.
  - `attachmentsByOwnerKey(owner)` = `['attachments','by-owner',kind,key]`.
  - `attachmentContentKey(id)` (`gcTime 0`).
- **Freshness is a parameter:** `attachmentsByOwnerQuery(owner, freshness)`. `AttachmentFreshness` is `staleTime`,
  `gcTime`, `refetchOnWindowFocus` and `refetchOnReconnect`; the key and `retry: false` cannot be overridden. The
  slip passes `READ_ON_EVERY_OPENING = {}` — exactly the options it had, so each drawer opening reads again. 327
  brings the order tab's preset.
- **Types:** the new `src/core/models/attachment.ts` holds `AttachmentOwner`, `AttachmentAccess`,
  `StoredAttachment`, `WithdrawnAttachment` and `AttachmentOwnerSiblings`. In `core/models/collection.ts`,
  `StoredSlip`, `WithdrawnSlip`, `SlipOwnerSiblings` and `AttachmentAccess` are now aliases of them. Nothing is renamed
  on the wire.

**What stays in `collection/inquiry`.**
- In `slips.ts`: `CASH_CLOSE`, `STORE_DAY`, `ECR_SLIP` (moved here from `slip-upload.ts`), a new `slipTarget(ownerKey)`
  (the four slip codes, spelled once), `storeDayOwnerKey`, `slipDayOf`, and the count, column and "No slip" filter.
- `slipCountedRows` and `canSeeSlips` (over `holdsCategory`).
- `slip-withdraw.ts` shrinks to `canWithdrawSlips` and the five-code `WITHDRAW_REASONS`, which now carry
  `noteRequired` (Other only).
- `markSlipDayChanged` (feature `api.ts`) now invalidates `attachmentsByOwnerKey(slipTarget(ownerKey))`.
- The components (`SlipDrawer`, `SlipAdd`, `SlipWithdrawDialog`, `SlipTillText`, `use-slips`) import from core. None
  of their DOM changed. There is no slip-named re-export, so each rule has one copy.

**⚠ Finding: one expected value changed.** It is the ByOwner cache-key literal in the Add-slip freshness case, which
moved to `slip-freshness.test.ts`: `['collection','slips','by-owner',OWNER]` is now
`['attachments','by-owner','STORE_DAY',OWNER]`. This ticket requires it ("keys move under one `attachments` head";
"`markSlipDayChanged` … now invalidates the new ByOwner key"). It is a client cache identity, not wire behaviour. A
script compared all 222 `expect`s of the four old suites with the new ones (after the renames): this is the only
difference. Every other move is an import or call-site re-point (the new names, and the slip's `WITHDRAW_REASONS` /
`slipTarget` passed into the parameterised functions), with the expected values untouched. See HITL.

**Where the tests went.**
- Generic cases moved to `core/attachments/{rules,upload,upload-store,withdraw}.test.ts`.
- Slip-only cases stay in the feature:
  - `slips.test.ts` gains the slip's six-part form case;
  - `slip-withdraw.test.ts` keeps the grant, the reason table and the confirm rule over the slip's reasons;
  - `slip-freshness.test.ts` keeps the grid invalidations.
- New cases:
  - `core/attachments/api.test.ts` (the probe key: one entry and one request for two readers; invalidating ByOwner
    never re-asks the probe; freshness passed through, and the slip's adds nothing; ByOwner by kind + key);
  - `holdsCategory`'s bare-string trap in core;
  - the store runs `onStored` only on a 200, and keeps two owner kinds under one key apart.

**Proof.**
- `npm test`: **151 files / 2584 tests** green (baseline 147 / 2571).
- `typecheck` clean. `lint` clean on all three gates (boundaries: 665 files; nothing under `core/attachments` imports a
  feature). `build` green.
- `slip-count-drive` **64/64**, `slip-drawer-drive` **63/63**, `slip-add-drive` **52/52** and `slip-withdraw-drive`
  **68/68**, against vite on :5199 with stubbed doors. None of the four was edited. They were run after the review
  fixes too.
- `/code-review`: no findings.
- `/standards-review`: Spec has no blocking findings (its `holdsCategory`-in-core gap is closed). Standards has no hard
  violations, and three of its smells were applied (one ByOwner key spelling, `AttachmentOwner` into `core/models`, no
  slip names in the core store test). The rest are logged in HITL, including the `CONTEXT.md` terms for
  `/domain-modeling`.
- **Outstanding (not this ticket's to fake):** none of 325's own Proof. The wave's owner hand walk against a live
  SIS.Api is 2071's.
