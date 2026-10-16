---
status: open
spec: BO ticket 2763 (C:\Work\DMSCO\BackOffice\.issues\2763-a-view-only-oms-user-opens-a-delivery-s-details-but-cannot-change-it-or-create-a-return.md)
blocked-by: —
---

# 521 — A view-only OMS user sees no update, reschedule or return on a delivery

## What to build

BackOffice 2763 split the Document Details grant. `BackOfficeScreen[DocumentDetails,03]` (`canOpenDetail`) now only
**reads**. The write doors need a second grant on top of it:

- `UpdateDocument`, `UpdateDelivery`, `RescheduleDocument`, `RescheduleDelivery` → `BackOfficeScreen[DocumentDetails,02]`,
  reported by `SdDocumentWeb/Access` as **`canChangeDetail`**.
- `CreateReturn` → `BackOfficeScreen[OmsCreateReturn,01]`, reported as **`canCreateReturn`**. Change does not imply return
  and return does not imply change.
- Mark delivered is unchanged (`canMarkDelivered`).

A new role `OMS_VIEWER` holds the list and the details only. Until this ticket ships, such a user sees the buttons
and gets the server's bare 403.

- `src/core/models/oms-access.ts` — add `canChangeDetail?: boolean` and `canCreateReturn?: boolean` (optional: an older
  SIS.Api omits them, and absent reads as denied, like the other flags).
- `features/oms/deliveries/acts.ts` and `features/oms/document/actions.ts` — draw update, reschedule, request-close and
  add-note only when `canChangeDetail` (all of them go through `UpdateDocument`/`UpdateDelivery`/the reschedules).
- `features/oms/document/return-order.ts` — draw the return action only when `canCreateReturn`.
- The detail screen still opens on `canOpenDetail` alone.

## Proof

- [x] a viewer session (`canOpenDetail` true, the two new flags false) opens a delivery and sees no update,
      reschedule, request-close, add-note or return action
- [x] `canChangeDetail` without `canCreateReturn` draws the change acts and no return; the reverse draws only the return
- [x] a probe answer without the two fields (an older SIS.Api) reads as denied

## Done when

The Proof holds, and a live session bound to `OMS_VIEWER` on staging (after the BackOffice seed and the 2763 SIS.Api
deploy) sees the details with no acts.

## Blocked by

None for the client (the flags are optional). The live check waits on the BackOffice 2763 deploy.

## Comments

**2026-10-16 — client half built (`/implement`).** The status stays **open**: Done-when's live `OMS_VIEWER` walk on
staging waits on the BackOffice 2763 seed + SIS.Api deploy.

Where the gates live (one deviation from *What to build*):
- `core/oms/access.ts`: `canChangeDetail()` and `canCreateReturn()` are strict `=== true` reads, so an absent field
  is a denial. They are in `OMS_SCREEN_FLAGS`.
- `document/actions.ts`: `grantOf(kind)` maps `return-document` to `return` and every other command to `change`.
  `commands.ts` `commandBar` leaves ungranted commands off the bar and drops empty clusters (and an empty terminal
  tier). **The return is gated there, not in `return-order.ts`**: that file only builds the request body and
  draws nothing.
- Close, Force cancel and Change store are hidden along with update, reschedule, request-close and add-note,
  because they post to `UpdateDocument` / `UpdateDelivery` too.
- `CommandPanel` renders nothing when it has no command, so a viewer gets no empty Actions card. The note
  composer, the R / C / N keys and the palette rows follow `canChangeDetail`. The list's open intent resolves
  through the filtered bar, so it opens nothing ungranted.
- `deliveries/acts.ts` `actsOffered` = `canOpenDetail && canChangeDetail`. It gates the inspector act rows,
  R / C / N and the status-bar hint.
- Added after review: a 403 from a change door or `CreateReturn` revokes that flag on the shared probe entry
  (`revokeOnForbidden`, same pattern as `revokeMarkDelivered`).

Proof:
- vitest: `commands.test.ts` (viewer, change-only, return-only, both), `detail-keys.test.ts`,
  `deliveries/acts.test.ts`, `core/oms/access.test.ts`, `core/oms/api.test.ts`. 760/760 in oms + core/oms.
- `tools/oms-viewer-drive.mjs` 31/31 STUBBED: A viewer (fields absent, and explicitly false), B change only,
  C return only, D the list's acts, E 403 revoke.
- Regression drives: document-actions 67/67, document-composer 70/70, return-dialog 105/105.
- mark-delivered 38/40. Its two reload-count failures fail the same way on the pre-change baseline (stash run),
  so they are not from this ticket.
- 26 drives' probe stubs now grant both write flags. Without them those drives would see a viewer.

⚠ **Deploy order.** Absent means denied, so this client must not reach a host before the 2763 SIS.Api does.
An older API would hide every write command from every operator, admins included.
