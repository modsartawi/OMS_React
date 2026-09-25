---
type: spec
status: ready
---

# 308 — The collection cycle's web half (frontend half of BackOffice spec 1976)

The stories, decisions and glossary are BackOffice's: read
`C:\Work\DMSCO\BackOffice-spec1976\.issues\1976-collection-cycle-roles-papers-and-collector-guards-spec.md`
(the BackOffice worktree, branch `spec1976`; once it merges, the same path under `C:\Work\DMSCO\BackOffice`),
and ADRs 0043-0045 in that tree's `docs\adr`. This file lists only what the web builds.

**The seam is the contract.** Every ticket here calls an endpoint built by a BackOffice ticket of spec 1976.
That ticket records the envelope (route, method, fields, a sample response) under its `## Web contract`
heading before it closes. Build and test against a stub of **exactly that shape**, and never invent a field.
If the BackOffice ticket has not landed, the web ticket is not startable.

| oms-react | BackOffice | What |
|---|---|---|
| 309 | 1977, 1978 | A pending surplus is labelled, excluded from totals, and a supervisor approves or rejects it |
| 310 | 1979 | Cancel, close-out and batch withdrawal are shown only to a supervisor |
| 311 | 1980 | Posting an entry requires a description |
| 312 | 1984 | The collection voucher's red box carries the accountant's description |
| 313 | 1987 | The ACR grid shows who closed each ACR, including SYSTEM |
| 314 | 1990 | The ACR form, voucher and grids show the profit center beside the store code |
| 315 | 1992 | Collections filters by collector, accountant, business date and collection date, and shows both dates |
| 316 | 1993 | ACRs, Deposits and Attempts take the same four filters |
| 317 | 1994, 1995 | A Ready for collection screen lists closed uncollected days and prepared receipts |
| 318 | 1996 | An assignment file is uploaded with a preview, then committed |

Out of scope here: every server, SIS.Api and POS change (BackOffice's), and the cutover (BackOffice 1997).
