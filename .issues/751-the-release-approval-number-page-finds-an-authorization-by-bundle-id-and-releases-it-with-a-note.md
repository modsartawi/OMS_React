---
status: done
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

- [x] `release button shows only with the grant and on a releasable row`: every combination of grant ×
  dispensed / empty / already-released · vitest (prior art: `row-acts.test.ts`)
- [x] `confirm is disabled until a note is typed` · vitest
- [x] `each refusal code maps to its message; not found is its own state` · vitest (prior art: `detail-view.test.ts`)
- [x] `the release posts only authId and note` · vitest
- [x] `i18n keys exist in EN and AR` (prior art: the area's i18n-keys test) · vitest

## Boundaries

None. UI only, and the server stays the gate.

## Done when

The proofs are green, `npm run build` and the full vitest suite stay green, and the page is reachable from the
Nphies navigation for a user with the Nphies grant.

## Blocked by

BackOffice 3343 (`C:\Work\DMSCO\BackOffice\.issues\3343-a-support-user-with-the-release-grant-releases-an-approval-number-through-sis-api.md`): the two routes and the `Access` field.

## Comments

**2026-11-04 — done** (`abec0ecb`, review fixes in the next commit). New feature `features/nphies/approval-release/`
(its own namespace, EN + AR) at `/nphies/approval-release`, a leaf in the Nphies nav group on `canOpenNphies`.

- **Proof:** vitest `release-rules.test.ts` (39) + `i18n-keys.test.ts` (9), all green. The full suite is 616 files / 8590 tests,
  and `npm run build` and the five lint gates are green for this feature.
- **Drive:** `tools/nphies-approval-release-drive.mjs` passes 39/39 against **stubbed** 1.1 envelopes (the shapes 3343 built). It covers
  not found, a release that posts `{ authId, note }` only, the new value and the refreshed history, no polling, no grant,
  a 1.0 probe, dispensed and empty rows, the dispensed refusal in the dialog, the canonical id, Escape during an
  in-flight release, the nav leaf, and the RTL layout. No live SIS.Api call was made.
- **⚠ Dispensed is not visible on this page (open BackOffice ask).** `Nphies/AuthResponse/{id}` (`NphiesAuthHeaderDto`)
  does not answer `IsDispensed`, so the summary reads "Not shown here". The button stays offered, with a line saying the
  page cannot tell, and a dispensed row meets the server's `AUTH_ALREADY_DISPENSED` in the dialog ("Undispense it
  first, then release…"). `AuthDetail.isDispensed` is declared optional, so the withheld line lights up with no client
  change the day the DTO carries it. **BO ask:** add `IsDispensed` to `NphiesAuthHeaderDto` (unfiled).
- **Arabic is not rendered anywhere yet.** The app never switches i18next `lng` (`oms.locale` only sets `<html dir>`).
  The AR keys are proven by vitest, and the RTL layout by the drive.
- **Overrulable choices:** Verdict is split into Request + Verdict badges (CONTEXT.md avoids "outcome"). History
  shows Before / After as two columns rather than one "before → after" string (the bidi rule's whole-value
  isolation). The bundle Id lives in `?id=`. A user without the release grant sees a line saying so. A success toast is shown.
- **Reviews.** Standards: no hard violations. Spec: only the dispensed gap above. `/code-review` found 8, all fixed:
  the canonical id for the post and the history key; no close mid-flight; kept data wins over a failed refetch; the dialog
  snapshots its value; only stale-row refusals re-read the detail; the box re-syncs on back/forward; the not-found id is
  interpolated; the history uses `retry: false`. Left as judgement calls: a third private `Fact` (a `core/ui` candidate)
  and the client predicting `after` as `value + "_"` in the dialog sentence only.
