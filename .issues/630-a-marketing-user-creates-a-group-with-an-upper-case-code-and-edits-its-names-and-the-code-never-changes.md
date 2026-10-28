---
status: done
spec: BackOffice 3173 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3173-oms-react-loyalty-groups-brief.md)
blocked-by: 629
---

# 630 — A marketing user creates a group with an upper-case code and edits its English and Arabic names, and the code can never be changed

## What to build

**Create** from the groups list: a dialog with code, English name and Arabic name. The code is
upper-cased as typed and checked against `[A-Z0-9_-]{1,20}` before the round trip (the server is still the
authority). Server refusals — bad code, duplicate code, name over width — are shown with the envelope's
message in the active locale (`messageEn` / `messageAr`) and their Loy error code. On success the user
lands on the new group's page.

**Group page** `/loy/groups/:groupId` (`GET LoyGroupWeb/Groups/{groupId}`): the code read-only, always — no
field, anywhere, renames it. English and Arabic names editable and saved via `Rename`; the Arabic name is
saved exactly as typed. Shows created by/at and updated by/at (local wall-clock, no `Z`). The page is the
home later tickets add to (631 active toggle, 632 members tab).

Create and Rename are hidden on a view-only grant (`canMaintain` false).

## Spine reach

model/api (`Groups/{id}`, `Create`, `Rename` in the feature's `api.ts`) · logic (code normaliser + check) ·
component/route (dialog, group page route) · i18n (`loy-groups`, EN + AR) · test

## Proof (→ `tdd` red-green cycles)

- [x] `group code is upper-cased and checked against the pattern` — `vip-1` → `VIP-1`; space, `é`, 21 chars refused with a reason key · pure
- [x] `rename request never carries a code` — the request built from the page form is `{ groupId, nameEn, nameAr }` only · pure
- [x] `loy-groups create + rename drive` — create lands on the page; duplicate refusal shown in EN and AR; code has no input; buttons absent on view-only · flow (extend `tools/loy-groups-drive.mjs`)

## Boundaries

Doors (BackOffice 3174, stubbed): `GET Groups/{groupId}`, `POST Groups/Create`, `POST Groups/Rename`.
Refusals surfaced through `apiErrorMessage` / `apiErrorCode`. Times via the repo's local-time formatter.

## Done when

On stubs, a group is created and renamed, a duplicate code is refused in both languages, the code is never editable, and the gates are green.

## Blocked by

[629](629-the-loyalty-groups-list-shows-each-groups-code-name-active-flag-mobile-count-and-live-bonus-buys.md)

## Comments

- 2026-10-28 — Done — built 2026-10-28 on spec/3173-loyalty-groups (worktree C:\Playground\oms-react-spec3173, unpushed), all envelopes stubbed; commit 1a1665b3.
- 2026-10-28 — Refusal shape (`errors[0].errorCode` + `data { messageEn, messageAr }`) CONFIRMED by brief Changes 2026-10-27 (3174). Stub codes (LOY-00601) are not the real LOY-12001–12008.
- 2026-10-28 — Owner: names are not checked client-side and are sent exactly as typed (both); `updatedBy/At` null shows "Never".
- 2026-10-28 — Arabic-locale choice of the refusal is proven only in the pure test (app language fixed to en).
