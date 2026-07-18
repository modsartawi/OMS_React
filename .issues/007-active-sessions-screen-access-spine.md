---
status: done
spec: 006
blocked-by: —
---

# 007 — activeSessionsScreenGatesOnItsOwnGrant

## What to build

A new **Active Sessions** feature under the Administration nav group — the access spine, before
any data. Scaffold the feature module (`features/admin/active-sessions/`: a default-export Page +
`api.ts` with an `access()` call), register the `active-sessions` i18n namespace, add one lazy
route `admin/sessions`, and one menu item under Administration gated by its **own** access probe.

On open, the screen probes the new session-monitor grant: while checking → a spinner; without the
grant → the **denied card** ("You don't have access to Active Sessions"); with it → the empty
**screen shell** (page title + the search box, inert for now, + the empty-grid placeholder). The
menu item is hidden unless the probe confirms the grant (fail-closed show/hide; the server stays
authoritative). This retires the biggest unknown — the new `[UaSessions,03]` grant reaching the
browser end-to-end, separately from the Ua Users grant.

## Spine reach

api (access) · route (`admin/sessions`) · menu-model (probe) · component (Page: checking / denied /
shell) · i18n (`active-sessions` namespace)

## Proof (→ `tdd` red-green cycles)

- [x] `menuItemHiddenUntilGrantConfirmed` — the Active Sessions leaf is absent while the probe is
  pending/errors and appears only on `canOpen:true` · verify via typecheck + drive (stub `access`)
- [x] `deepLinkWithoutGrantShowsDeniedCard` — navigating to `/admin/sessions` without the grant
  renders the denied card, not a broken screen · verify via typecheck + drive
- [x] `grantHolderSeesEmptyShell` — with the grant, the title + search box + empty placeholder
  render · verify via typecheck + drive

Runner not installed (CLAUDE.md) — verify via `npm run typecheck` + driving `npm run dev`. Prior
art: `features/admin/ua-admin/UaAdminUsersPage` access states.

**Verified (2026-07-18):** `npm run typecheck` + `npm run build` green. Drove all three states in
the real app with the network stubbed at Playwright (BackOffice `Sessions/Access` not built yet):
canOpen:false → denied card + menu hidden; probe pending → spinner + menu hidden; canOpen:true →
title + inert search box + empty placeholder + menu item visible. 9/9 checks passed.

## Boundaries

- **External dep (BackOffice repo):** `GET UaAdminWeb/Sessions/Access → { canOpen }` (cookie-gated,
  NOT grant-gated) and the `BackOfficeScreen[UaSessions,03]` grant seed must exist to exercise the
  grant path. Tracked in BackOffice `.issues/`; this ticket consumes it.
- New i18n namespace `active-sessions` (register in `core/i18n.ts`).
- Nav visibility via `accessProbe` sharing the Page's route-guard react-query key
  (`['active-sessions','access']`) — one call, not two.
- Does NOT bootstrap the vitest runner.

## Done when

`/admin/sessions` shows the denied card without the grant and the empty shell with it; the menu
item respects the probe; `npm run typecheck` green.

## Blocked by

None — can start immediately (React side). External precondition: the `Sessions/Access` endpoint +
grant seed (BackOffice) are needed to drive the grant-held path; the denied path is drivable with a
stubbed probe meanwhile.

## Open questions

- Final grant `CONTROLLER`/`COMMAND` string confirmed against the authz catalog at build time
  (spec assumes `UaSessions`/`03`).
