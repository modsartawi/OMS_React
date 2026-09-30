---
status: done
spec: 334
blocked-by: — (+ BackOffice 2150)
---

# 339 — An accountant posts a theft, a supervisor decides it beside the day's variance, and it has its own tab

BackOffice spec 2149 D8, ADR 0049; web spec 334 item 5. Server: BackOffice 2150.

## What to build

Theft (سرقة) is a third settlement entry kind on the web's settlement screens.

- **Post.** The post-entry dialog offers Theft. Choosing it requires a business day as well as store, amount and description. The dialog says a theft always waits for a supervisor and moves no cash. The server's refusal for an open or unknown day is shown on the day field.
- **Not in bulk.** The bulk upload template and help text do not offer Theft; a server refusal on such a row is shown as any other.
- **Decide.** The approval dialog shows, for a theft, the named day and that day's cash variance beside the amount. Approve and reject work as for a pending surplus.
- **Find.** Open settlements gains a Theft tab listing theft entries with their day; the ledger filter accepts the kind.
- A theft is never included in the shortage or surplus headline figures.
- An approved theft offers no close-out; cancel stays supervisor-only.
- Use the tab and kind names from ticket 340 if it has landed; otherwise add Theft beside the existing names and let 340 rename.

## The seam

Build and test against a stub of EXACTLY the shape recorded under `## Web contract` in the BackOffice ticket(s) named above (`C:/Work/DMSCO/BackOffice/.issues/`). Never invent a field. If that heading is missing, the BackOffice ticket has not landed and this ticket is not startable. **Do not edit the BackOffice repo.**

## Spine reach

oms-react screen / wire model / vitest

## Proof (→ `tdd` red-green cycles)

- [x] `post dialog requires a business day for a theft` · vitest — `src/features/collection/settlement/theft.test.ts` (`checkBusinessDay`, `postRequest`, `postRefusalField`)
- [x] `approval dialog shows the day's variance for a theft` · vitest — same file (`approvalTarget` / `dayVarianceFor` / `needsDayLookup`)
- [x] `open settlements has a theft tab fed by kind THEFT` · vitest — same file (`buildTheftLane`, `readOpenTab`)
- [x] `theft is excluded from the shortage and surplus headline` · vitest — same file (`accountHeadline`, `tallyOpenLane`, `remainingIsAClaim`)
- [x] `bulk template does not offer theft` · vitest — same file (`BULK_KINDS`, the template's bytes, the `bulk` locale strings)

Fixtures follow BackOffice 2150's `## Web contract` (commit `11e615be9`, branch spec2149): `theft-fixture.ts` carries the contract's own sample row field for field.

Driven as well (network stubbed at Playwright, this session's vite on :5198 because :5199 was held by a server it did not start): `tools/settlement-theft-drive.mjs` 62/62, five runs in a row. Regression drives: `settlement-drive.mjs` 291/291, `settlement-approval-drive.mjs` 42/42, `settlement-supervision-drive.mjs` 41/41, `settlement-description-drive.mjs` 41/41. Gates: typecheck clean, `npm test` 161 files / 2754 tests, lint's three gates clean, build clean.

Outstanding (not AFK's): nothing here was driven against a live SIS.Api — every envelope is a stub of the recorded contract. Decisions for the owner are in `.afk/HITL-339.md`; the one that needs a ruling is that approved thefts stay in the `status=OPEN` answer for ever and count against the open lane's 2,000-row cap.

## Boundaries

Web only. English locale only (Arabic appears inline where labels already carry it). No new dependency.

## Done when

An accountant posts a theft, it appears as awaiting approval, and a supervisor approves it while seeing the day's variance.

## Blocked by

BackOffice 2150 (its `## Web contract`)
