---
status: open
spec: 334
blocked-by: — (+ BackOffice 2157)
---

# 338 — The assignment upload carries the profit center

BackOffice spec 2149 D7; web spec 334 item 4. Server: BackOffice 2157.

## What to build

The assignment upload's template gains an optional `ProfitCenter` column, and its preview shows each branch's current and new profit center.

- Template header becomes `StoreCode, ProfitCenter, AccountantId, CollectorId`.
- A row whose only change is the profit center counts and shows as a change.
- The dialog's help text says a blank profit center leaves the stored value unchanged.
- The server's new refusal (an over-long value) is shown like the other row refusals.

## The seam

Build and test against a stub of EXACTLY the shape recorded under `## Web contract` in the BackOffice ticket(s) named above (`C:/Work/DMSCO/BackOffice/.issues/`). Never invent a field. If that heading is missing, the BackOffice ticket has not landed and this ticket is not startable. **Do not edit the BackOffice repo.**

## Spine reach

oms-react screen / wire model / vitest

## Proof (→ `tdd` red-green cycles)

- [ ] `assignment template carries the ProfitCenter column` · vitest
- [ ] `preview shows current and new profit center` · vitest
- [ ] `a profit-center-only row is shown as a change` · vitest

## Boundaries

Web only. English locale only (Arabic appears inline where labels already carry it). No new dependency.

## Done when

Uploading a branch file with profit centers shows them in the preview and, after commit, on the collection screens.

## Blocked by

BackOffice 2157 (its `## Web contract`)
