---
status: open
spec: 342
blocked-by: 344
---

# 345 — The requester withdraws their own waiting request, and nobody else is offered Withdraw

Builds against BackOffice 2194's `## Web contract` (`POST Settlement/ChangeRequest/Withdraw`).

## What to build

On the waiting-request card, **Withdraw** is drawn only when the session's `userId` equals the request's
`requestedByStaffId` (W6) — the decision lives in 343's offer module, not in the component. Withdrawing
sends `{ changeRequestId }`; on `requestStatus: "WITHDRAWN"` the pane redraws from the act response
(the entry's figures unchanged), then History and the account are re-read (W8). A request is
**withdrawn**, never "cancelled" (W13).

- `NOT_REQUESTER` (the server's guard, which a supervisor also gets) and `CHANGE_NOT_OPEN` (with
  `requestStatus` naming which) are said through 344's map.
- A supervisor sees Withdraw only on a request they raised themselves.

## Spine reach

model/api (`withdrawChangeRequest`) · store/logic (offer cell already decided) · component (card button)
· i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `offerFor` — Withdraw present only for the requester, for an accountant and for a supervisor; absent
  on someone else's request · pure
- [ ] `settlement-change-drive` extended — the requester's card shows Withdraw, another accountant's does
  not; an accepted withdraw redraws the pane with no card; `NOT_REQUESTER` and `CHANGE_NOT_OPEN`
  (`"SUPERSEDED"`) are said from the stubbed answers · flow (drive)

## Boundaries

New door `POST Settlement/ChangeRequest/Withdraw` behind the settlement grant (W1). No new keys outside
`settlement`.

## Done when

Both Proof items are green, typecheck + `npm test` pass, earlier drives unmodified and green.

## Blocked by

[344](344-every-change-request-refusal-is-said-by-its-code-with-its-next-step.md)

## Open questions

- **`session.userId` vs `requestedByStaffId` — confirmation stays open (owner ruling 2026-10-01).** W6
  says both are the session's UserId claim on the server. With no live SIS.Api the drive stubs the match;
  the live check (`Auth/Me`'s `userId` equals the History row's `requestedByStaffId` for a request this
  session raised) is the first thing to do when a live SIS.Api with the 2190 wave is reachable. The
  server's `NOT_REQUESTER` stays the guard either way.
