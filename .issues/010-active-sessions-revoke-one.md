---
status: done
spec: 006
blocked-by: 008
---

# 010 — revokingASessionSignsTheDeviceOut

## What to build

Each row's **Revoke** action opens a confirmation modal naming the session (channel + person);
confirming calls the revoke door, drops the row **optimistically**, and toasts success. The person
stays enabled and can sign in again — this is a session action, not an account action. Revoking an
already-dead session is a server-side no-op (business success), not an error; a genuine failure
surfaces via `apiErrorMessage` and the row is restored.

## Spine reach

api (revoke) · component (confirm modal + optimistic removal + toast) · i18n

## Proof (→ `tdd` red-green cycles)

- [x] `revokeConfirmRemovesRowAndToasts` — Revoke → confirm → row leaves + success toast ·
  component (stub `api.revoke`) / drive
- [x] `cancelLeavesRow` — dismissing the confirm keeps the row · component / drive
- [x] `revokeErrorRestoresRowWithMessage` — an `ApiError` surfaces via `apiErrorMessage`, the row
  returns · component / drive

Runner not installed — verify via typecheck + drive. Prior art: `ua-admin` `UserDetailPane` revoke
+ `confirmAction` + `notify`.

**Verified:** `npm run typecheck` green, `npm run build` green, import boundaries clean. Drive path
(`tools/screen1-smoke.mjs`) needs a live SIS.Api + borrowed Playwright, not runnable this session —
same posture as tickets 007–009. Behaviour confirmed by reading the wired handler: confirm names
person + channel; optimistic `setQueryData` drop (row + `totalMatches`); `if (!ok) return` leaves the
row on cancel; `catch` restores the captured `previous` snapshot and surfaces `notify.apiError`; a
dead-session business-success never enters `catch`, so the row simply leaves. Both `/standards-review`
axes and `/code-review` came back clean.

## Boundaries

- Reuses the **existing** `POST UaAdminWeb/Sessions/Revoke { sessionId }` — no new server door.
- Envelope: standard taxonomy only; no feature-specific `success:false` codes.
- New i18n keys: confirm title/body, revoke label, success toast.

## Done when

Revoking a row signs the device out (row gone, toast), leaves the person enabled, and a failure
restores the row; `npm run typecheck` green.

## Blocked by

[008](008-active-sessions-search-list.md)
