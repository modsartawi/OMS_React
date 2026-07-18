---
status: open
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

- [ ] `revokeConfirmRemovesRowAndToasts` — Revoke → confirm → row leaves + success toast ·
  component (stub `api.revoke`) / drive
- [ ] `cancelLeavesRow` — dismissing the confirm keeps the row · component / drive
- [ ] `revokeErrorRestoresRowWithMessage` — an `ApiError` surfaces via `apiErrorMessage`, the row
  returns · component / drive

Runner not installed — verify via typecheck + drive. Prior art: `ua-admin` `UserDetailPane` revoke
+ `confirmAction` + `notify`.

## Boundaries

- Reuses the **existing** `POST UaAdminWeb/Sessions/Revoke { sessionId }` — no new server door.
- Envelope: standard taxonomy only; no feature-specific `success:false` codes.
- New i18n keys: confirm title/body, revoke label, success toast.

## Done when

Revoking a row signs the device out (row gone, toast), leaves the person enabled, and a failure
restores the row; `npm run typecheck` green.

## Blocked by

[008](008-active-sessions-search-list.md)
