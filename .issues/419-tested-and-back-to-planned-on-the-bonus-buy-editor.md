---
status: done
spec: C:/Work/DMSCO/BackOffice/.issues/2396-an-oms-bonus-buy-is-tested-before-it-goes-live-and-authoring-scales-to-real-campaigns-spec.md
blocked-by: 417
---

# 419 — The editor and overview show Tested, offer Mark Tested, and take a bonus buy back to Planned

**Source:** BackOffice spec 2396 and ADR 0063. **Standing preference:** like SAP wins.

## What to build

- Status `3` reads **Tested** everywhere a status is shown: overview rows, the editor header, and the `BbyStatusCode` map.
- **Read-only unless Planned.** The editor opens Tested, Activated and Deactivated bonus buys read-only. Only a Planned one
  offers Save and the line actions.
- **Mark Tested** (`POST BbyMaintainWeb/BonusBuy/MarkTested { number, note }`):
  - shown only when `GET Access` returns `canTest`, and only on a Planned bonus buy;
  - asks for an optional note;
  - shows the server's in-band refusals as is: last writer, validator refusals in EN + AR.
- **Back to Planned** (`POST BonusBuy/BackToPlanned { number }`):
  - on Tested, Activated and Deactivated;
  - on Activated, a confirmation warns that the offer leaves the tills.
  - There is no promotion-level Back to Planned.
- **Activate** on a Planned bonus buy is not offered; the hint says it must be tested first. A promotion-level Activate refusal
  lists the untested bonus buys.
- The editor and overview show **tested by / at / note** (`testedBy`, `testedAt`, `testNote`).

## Spine reach

UI (oms-react feature) · API client (MarkTested, BackToPlanned, Access.canTest)

## Proof (→ `tdd` red-green cycles)

- [x] `each status opens read-only except Planned` · vitest
- [x] `mark tested is offered only with canTest on a Planned bonus buy` · vitest
- [x] `back to planned on an activated bonus buy asks first` · vitest
- [x] `status 3 reads Tested in the overview and the editor` · vitest

## Boundaries

Same rules as 416–418. Needs BackOffice 2397 and 2398 for the live walk.

## Done when

- [ ] **OWNER, outstanding:** the owner walks Planned → Mark Tested (as a second user) → Activate → Back to Planned on a dev SIS.Api.

## Blocked by

417 (+ BackOffice 2397, 2398 for the endpoints)

## Comments

**Built 2026-10-05 (AFK).** The doors are NOT built (BackOffice 2397 and 2398 are open), so every new shape is
spec 2396's reading, kept in one place: `BbyMaintainAccessResult.canTest`, `BbyTestMark` (`testedBy/At/Note` on
the document and the overview rows), and `BbyMarkTestedRequest { number, note }` / `BbyBackToPlannedRequest { number }`
in `src/core/models/bonus-buy-maintenance.ts`, with one `api.ts` function each. The guesses are logged in `.afk/HITL-419.md`
(⚠️ `number` vs the shipped `bbyNumber` is a question for 2397/2398).

- `overview.ts`: `overviewStatus('3')` = `tested` (severity `go`), and `canActivateSelection` means Activate is never offered
  on a selection holding a Planned bonus buy; its hint says to test it first. The promotion-level Activate is unchanged, and its
  refusal names the untested bonus buys through the existing `bonusBuys[]` → `ActReport`.
- `editor.ts`: `editorAccess(mode, doc, canTest)` locks every status but Planned with reason `locked` (an unreadable status
  is locked too). `sap` stays its own reason. It also returns `canMarkTested` (grant + Planned + OMS), `canBackToPlanned`
  (Tested/Activated/Deactivated, OMS), and `backToPlannedAsks` (Activated only). Four eyes is left to the server.
  `formChanged` holds Mark Tested back while an edit is unsaved (a /code-review finding).
- The editor reads `canTest` off the ONE shared access query (`canMarkTested`, fail closed). It shows the test mark in
  the header (`Ltr` for the time, `<bdi>` for the name and note), and the overview shows Tested by / Tested at / Test note columns.
- **2374 reversals retired, not kept:** overview.test's "'3' is unknown" (now Tested); editor.test's access shapes
  (new fields, "Planned" named); drive steps 4 (four statuses), 6 (activates a selection with no Planned row), 7 (refusal names
  an untested bonus buy) and 8 (re-selects the Planned row it copies). Locale: the promotion Activate copy now says Tested,
  and the multi-delete copy states the Planned/Deactivated rule. CONTEXT.md's **BBY status** entry was updated.

**Proof:** vitest `editor.test.ts` + `overview.test.ts` (82 in the feature; whole suite 3688/3688). `tools/bby-maintenance-drive.mjs`
is **130/130 STUBBED** (block 27–34 added). Typecheck, lint (4 gates) and build are green.

**Outstanding:** the owner walk above needs a dev SIS.Api carrying BackOffice 2397 and 2398.
