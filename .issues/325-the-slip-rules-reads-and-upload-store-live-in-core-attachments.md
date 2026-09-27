---
status: open
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

- [ ] `slips.test.ts`, `slip-upload.test.ts`, `slip-upload-store.test.ts` and `slip-withdraw.test.ts` move with their
      modules, re-pointed at the new paths with **assertions unchanged**. Slip-only cases stay in the feature. · pure
- [ ] A new `core/attachments` test pins the probe query key: the slip grids and the drawer resolve to the **same**
      key. · pure
- [ ] `slip-count-drive`, `slip-drawer-drive`, `slip-add-drive` and `slip-withdraw-drive` pass **unmodified**, and
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
