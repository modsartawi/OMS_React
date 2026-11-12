---
status: open
spec: BO 3208 (`C:\Work\DMSCO\BackOffice\.issues\3208-a-full-newpos-return-undispenses-its-nphies-authorization-and-support-can-finish-it-from-oms-react-spec.md`)
blocked-by: BO 3725
---

# 898 — The Undispense page lists pending and failed undispenses, retries them, and frees a returned authorization

## What to build

The page from BackOffice spec 3208, under the Nphies feature (`features/nphies/`), behind the existing Nphies
access probe. Support and the call center both use it (BO 3208 Q6/Q7).

- **List**, from `GET Nphies/Undispense`: filters state (pending / failed / done, default pending + failed),
  store, date range, authorization id. Columns: authorization, store, return, origin, who, attempts, last error,
  added and processed times.
- **Retry** on a failed row, when `Access.canUndispense`: posts `Nphies/Undispense/{id}/Retry`, then refreshes.
- **Undispense one authorization**, when `Access.canUndispense`: an authorization-id box, then a dialog that
  requires a note (confirm disabled while blank), posting `Nphies/Auth/{authId}/Undispense` with `{ note }` only.
  The door's refusals map to messages, including "the invoice is not fully returned".
- Link from 751's authorization summary: a dispensed row says "undispense it first" and links here with the id.
- EN + AR keys, RTL as the area's existing pages. No `refetchInterval`.

## Proof

- [ ] A drive with `/api` stubbed: list and filters, Retry, the manual dialog's blank-note guard, a refusal shown
- [ ] The buttons are hidden without `canUndispense`

## Done when

The proofs are green and BO 3727's walk shows the row done on this page.

## Blocked by

BO 3725 (the routes and `Access.canUndispense`).
