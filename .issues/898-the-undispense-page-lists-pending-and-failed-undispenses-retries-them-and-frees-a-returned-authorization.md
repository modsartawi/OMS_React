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

- [x] A drive with `/api` stubbed: list and filters, Retry, the manual dialog's blank-note guard, a refusal shown
- [x] The buttons are hidden without `canUndispense`

## Done when

The proofs are green and BO 3727's walk shows the row done on this page.

## Blocked by

BO 3725 (the routes and `Access.canUndispense`).

## Comments

**2026-11-13 — built, stubbed; left open for BO 3727's walk.** `features/nphies/undispense/` (`/nphies/undispense`,
namespace `undispense`, EN + AR), on contract 1.2 §1.1 rows 19–21 as `NphiesUndispenseDesk` answers them.
- List: state chips (default pending + failed; none = every state), store, added from/to, authorization; Refresh with
  load time, no `refetchInterval`; the 500-row `truncated` notice. Retry sits beside State on a failed row.
- Manual box + note dialog (confirm `aria-disabled` while blank; body `{ note }` alone); the answer's `created: false`
  reads as already queued / failed / done. After it, the list shows that authorization in every state.
- 751: a dispensed row's withheld line links to `/nphies/undispense?authId=…`, which opens on that id in every state
  (a done row answers "already undispensed") and prefills the manual box.
- Proof: `undispense-rules.test.ts` + `i18n-keys.test.ts` (46), `tools/nphies-undispense-drive.mjs` **46/46**, 751's
  drive 39/39, typecheck, build, full vitest. `npm run lint`: four gates green; the boundary gate fails on the
  pre-existing `insurance-rules/aliases/door-shapes.test.ts` (e9243c46), not this change.
- Owed: BO 3727's walk showing the row done here. Open for `/domain-modeling`: "undispense" is not in `CONTEXT.md`.
