---
status: open
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

- [ ] `post dialog requires a business day for a theft` · vitest
- [ ] `approval dialog shows the day's variance for a theft` · vitest
- [ ] `open settlements has a theft tab fed by kind THEFT` · vitest
- [ ] `theft is excluded from the shortage and surplus headline` · vitest
- [ ] `bulk template does not offer theft` · vitest

## Boundaries

Web only. English locale only (Arabic appears inline where labels already carry it). No new dependency.

## Done when

An accountant posts a theft, it appears as awaiting approval, and a supervisor approves it while seeing the day's variance.

## Blocked by

BackOffice 2150 (its `## Web contract`)
