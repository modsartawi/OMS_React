---
status: done
spec: 430
blocked-by: —
---

# 431 — An HQ lead lists today's donor requests across stores and filters them

## What to build

**Slice 0 of spec 430.** It proves the whole new path: an extended access probe, a new OMS leaf, a
new `SdDocumentWeb/*` list door (stubbed), a grid on the core grid base, and a new namespace.

- **The probe grows (D2).** `OmsAccessResult` gains **all nine** optional flags of spec 430 D2 in
  this ticket, so 433–438 only read them. An absent flag reads as `false`, through one pure reader.
  The probe stays the one `OMS_ACCESS_KEY` entry and still fails closed.
- **The leaf and the route.** The OMS group gets a "Donor requests" leaf, gated on
  `canOpenDonorRequests`. It is placed after Central invoicing, in the D18 order. The route is
  `/oms/donor-requests`, and the page guard shows the standard denied card without the flag.
- **The list (D3, D9).**
  - A filter bar with state (multi), donor store, order store and a raised-date range. It defaults
    to today, all states and no store.
  - Search calls `GET SdDocumentWeb/DonorRequests` with the criteria and reads
    `{ rows: DonorRequestModel[], limited }`. The row model is the existing one in `@/core/models`.
  - The grid shows request no, delivery no, donor store, order store, state, outcome + reason,
    units asked/given, and raised / picked / ended times.
  - Refused and expired rows take the `attention` tone and a cancelled row is muted, via
    `donorOutcome`.
  - An OPEN, unpicked row shows its waiting time, via `waitingOnDonor` / `elapsedSince`.
  - A request cancelled after it was picked is marked as such.
  - A status bar shows the count, with "showing the first N" when `limited`.
- **`?request=<no>` seeds the criteria once.** Ticket 434's link uses it. It searches for that one
  request with no date bound, so the row is found whatever day it was raised. This needs the
  door's `requestNo` param. Add it to the stub contract and say so in Open questions.
- **Strings.** Namespace `donor-requests`, registered centrally, English + Arabic.

## Spine reach

model/api · logic (criteria → params, row model, access reader) · component/route/menu · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `criteriaToParams` — the default is today, all states, no store. `state` is a repeated key, `toDate` is inclusive, empty filters are dropped, and `?request=` seeds a request-only search · pure
- [x] `donorRow` — the waiting elapsed time for OPEN+unpicked only, the outcome tone, cancelled-after-picked, and minutes to pick · pure
- [x] `omsGrants` — an absent flag is false for every D2 flag · pure
- [x] `tools/donor-requests-drive.mjs` — the leaf is hidden without the flag; the filter → stubbed list → tones, count and limited note; LTR and RTL · flow

## Boundaries

- A new door, `SdDocumentWeb/DonorRequests` (BackOffice ask BO-2, **not filed**), built on a stub
  of exactly the D3 shape. It shows the business refusal message through `apiErrorMessage`.
- A new namespace, `donor-requests`.
- Read-only. There is no inspector or export yet (432).

## Done when

The drive is green on the stub, and `npm test`, typecheck and lint are green.

## Blocked by

None — can start immediately.

## Open questions

- The `requestNo` filter on the door is not in spec 430 D3. It is added here for 434's link and
  needs to go into BO-2.

## Comments

**Done 2026-10-07 (AFK).** Built on a STUB of spec 430 D2/D3 — the door `SdDocumentWeb/DonorRequests`
(BO-2) and the probe flags (BO-1) are NOT built, so nothing was driven against a live SIS.Api.

- Proof: vitest `src/core/oms/access.test.ts` (7), `donor-requests/criteria.test.ts`, `donor-row.test.ts`,
  plus two menu tests in `src/layout/menu-model.test.ts`; full suite 211 files green. Drive
  `tools/donor-requests-drive.mjs` 50/50 in LTR and RTL (stubbed); `tools/oms-access-drive.mjs` still 28/28.
  typecheck, lint (4 gates) and build green.
- `omsGrants` (`@/core/oms/access`) is the one reader of all nine D2 flags; `canOpenDonorRequests`
  is the predicate both the menu leaf and the page's `ScreenGate` use. The leaf reads the ONE
  `OMS_ACCESS_KEY` entry (drive: one probe call per page life).
- `?request=<no>` sends `requestNo` alone (no dates). The list is keyed on the param, so it is read
  once per arrival; "Back to today" drops it from the URL. A server that ignores `requestNo` is
  guarded client-side (only the asked-for row is kept).
- Rulings logged in `.afk/HITL-431.md`: no `store`/`limit` sent, loads on open (D16 vs story 2),
  where the tones show, the elapsed formatting left duplicated for 432 to graduate.

**Outstanding (not AFK's):** a live walk against a real SIS.Api once BO-1/BO-2 exist; the owner's
eye on the Arabic strings (`src/locales/ar/donor-requests.json`) under RTL.
