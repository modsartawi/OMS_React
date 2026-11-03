---
status: open
spec: BO 3342 (`C:\Work\DMSCO\BackOffice\.issues\3342-support-releases-a-nphies-approval-number-from-oms-react-spec.md`)
blocked-by: BO 3343
---

# 751 — The Release approval number page finds an authorization by bundle Id and releases it with a note

## What to build

The page from BackOffice spec 3342, under the Nphies feature (`features/nphies/`), behind the existing Nphies
access probe:

- **Search.** A bundle-Id box (the authorization's id, exact match) with a Search button. It reads the
  authorization through the existing detail route (`Nphies/AuthResponse/{id}`). An unknown id shows
  **"not found"**, never an empty card.
- **Summary.** Shows Id, approval number, payer, patient, claim type, outcome, dispensed and cancelled.
- **Release approval number button.** It shows only when `Access.canReleaseApprovalNumber` is true **and** the
  row is releasable: not dispensed, the approval number not empty and not already ending with `_`. If the row
  is not releasable, a line says why (for a dispensed row: "undispense it first").
- **Dialog.** It is the confirmation step. It names the approval number and requires a note: confirm is
  disabled while the note is blank. It posts `Nphies/ApprovalNumber/Release` with `{ authId, note }` only.
  On success the summary shows the new value and the history refreshes.
- **History.** Below the summary, from `Nphies/ApprovalNumber/Releases/{authId}`: when, who, before → after,
  and the note.
- Each refusal code maps to its message. EN + AR keys, and the RTL layout follows the area's existing pages.
  No `refetchInterval`.

## Spine reach

UI (route, page, dialog, api client)

## Proof (→ `tdd` red-green cycles)

- [ ] `release button shows only with the grant and on a releasable row`: every combination of grant ×
  dispensed / empty / already-released · vitest (prior art: `row-acts.test.ts`)
- [ ] `confirm is disabled until a note is typed` · vitest
- [ ] `each refusal code maps to its message; not found is its own state` · vitest (prior art: `detail-view.test.ts`)
- [ ] `the release posts only authId and note` · vitest
- [ ] `i18n keys exist in EN and AR` (prior art: the area's i18n-keys test) · vitest

## Boundaries

None. UI only, and the server stays the gate.

## Done when

The proofs are green, `npm run build` and the full vitest suite stay green, and the page is reachable from the
Nphies navigation for a user with the Nphies grant.

## Blocked by

BackOffice 3343 (`C:\Work\DMSCO\BackOffice\.issues\3343-a-support-user-with-the-release-grant-releases-an-approval-number-through-sis-api.md`): the two routes and the `Access` field.
