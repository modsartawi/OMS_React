---
status: done
spec: 805
blocked-by: —
---

# 806 — A composite gets many member roles in one search-and-tick batch

## What to build

Slice 0 of spec 805. The composite role's **Add member** dialog stops being a flat list with one Add
button per row. It becomes the shared inline **checklist picker** (local mode): a search box that narrows
by role name **and** description, a check box per single role not already a member, **Select all shown**,
**Clear**, a picked count, empty and no-match states, and one footer button **Add N**.

Pressing it runs the shared **batch runner**: one `Roles/AddMember` per picked role, sequentially, never
stopping on a refusal. When it ends the dialog stays open and shows "N added, M refused", each refused role
named with its server message (`apiErrorMessage`) and left ticked; added roles leave the list. The role
detail, catalog counts and assigned-roles caches refresh as today's single add does. A 401 stops the batch
and is left to `handle401`.

Both shared pieces are built here for every later slice:
- **batch runner** (pure, `core/`) — items + a single-item write → per-item outcome (`done` / `refused`
  with its `ApiError`), totals, progress callback; sequential; stops on an `auth` error.
- **checklist picker** (`core/ui`) — presentational; caller owns options, picks and query; rows may be
  disabled with a note or carry a tag; its list logic (narrowing, exclusion, select-all-shown over shown
  and enabled rows only, picks surviving a query change, count) is a pure helper beside it. Designed with
  a server mode in mind (caller narrows on query change) though only local mode is used here.

Composites still never nest: only single roles are offered.

## Spine reach

store/logic (batch runner, picker list helper) · component (picker, Add member dialog) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `runBatch writes every item in order and reports each outcome` — a fake write that succeeds, refuses (business) and fails (network) → all items attempted in order, outcomes + totals right · pure
- [x] `runBatch stops on an expired session` — an `auth` ApiError ends the batch; the remaining items are reported not attempted · pure
- [x] `picker narrows by name and description; select-all ticks only shown, enabled rows; picks survive a new query; clear empties` · pure
- [x] `tools/authz-batch-drive.mjs` (new) — stubbed `AuthzAdminWeb/*`: search `PHARM`, select all shown, Add 3 with one stubbed refusal → "2 added, 1 refused", the refused role still ticked, retry succeeds; LTR + RTL · flow (Playwright)

## Boundaries

Existing `Roles/AddMember` only — no new endpoint. New keys in the existing `authz-admin` namespace
(picker words passed in by the caller). The picker's check boxes live in `core/ui`, outside the feature
control ratchet; `npm run lint` must stay green. Counts through i18next plurals; IDs/counts in `Ltr`,
names/descriptions in `<bdi>`.

## Done when

On a composite, searching, ticking several singles and pressing **Add N** adds them all, a stubbed refusal
is reported in the dialog and retryable, and the three vitest tests plus the drive pass.

## Blocked by

None — can start immediately.

## Comments

- 2026-11-06 built (`impl/806-batch-runner-picker`). Batch runner `src/core/util/batch-runner.ts`
  (+ `.test.ts`, 3 tests incl. a sequential-only proof); picker `src/core/ui/ChecklistPicker.tsx` with
  its pure list helper `src/core/ui/checklist.ts` (+ `.test.ts`); `AddMemberModal` rewritten on them;
  `RoleDetailPane` no longer closes the dialog after an add (it only re-reads). Drive
  `tools/authz-batch-drive.mjs` 34/34 (17 LTR + 17 RTL). typecheck + test green; of the lint gates,
  grid-base, contrast, palette and controls are green — `check-boundaries` fails on the pre-existing
  `src/features/insurance-rules/aliases/door-shapes.test.ts` (from e9243c46, already on the spec
  branch, untouched here), which short-circuits `npm run lint`.
