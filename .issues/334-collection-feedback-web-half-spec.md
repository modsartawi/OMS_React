---
type: spec
status: ready
---

# 334 — Collection feedback: the web half (frontend half of BackOffice spec 2149)

The stories, decisions and glossary are BackOffice's: read
`C:\Work\DMSCO\BackOffice\.issues\2149-collection-feedback-saud-sheet-theft-settlement-notice-and-uploads-spec.md`
and ADR 0049 in that tree's `docs\adr`. Decision numbers below (D1…D15) are that spec's. This
file lists only what the web builds.

**The seam is the contract.** Every server-backed item here calls an endpoint built by a
BackOffice ticket of spec 2149. That ticket records the envelope (route, method, fields, a sample
response) under its `## Web contract` heading before it closes. Build and test against a stub of
**exactly that shape**, and never invent a field. If the BackOffice ticket has not landed, the web
ticket is not startable. Items marked *web only* have no server dependency.

| # | Needs server | What the web builds |
|---|---|---|
| 1 | D1, D2, D3 | Cash Collections opens with finance's nine columns in finance's order (collection date, business date, store code, type, description, amount, surplus, net collected, collector), then the profit center. Type shows the server's label. Everything the screen has today stays behind "More columns". Rows arrive in the server's order and are not re-sorted by default. |
| 2 | *web only* (D4) | All four collection screens (Cash Collections, ACRs, failed attempts, deposits) export `.xlsx` through the shared grid-to-Excel writer: the grid as shown. Money as numbers, identity cells as text. The collection CSV writer and its `sep=` line are removed; the upload templates stay as they are. |
| 3 | D6 | A people upload on the People tab: template download, file pick, preview (added / updated / refused with the server's reason), commit. Same shape as the assignment upload dialog beside it. |
| 4 | D7 | The assignment upload's template and preview gain the optional `ProfitCenter` column; the preview shows current and new. |
| 5 | D8 | Post-entry dialog offers Theft, which requires a business day. Theft is not offered in the bulk upload. The approval dialog shows the named day's cash variance beside a theft. Open settlements gains a Theft tab. |
| 6 | *web only* (D13) | "Owing" / "Owed" tabs become "Shortage" / "Surplus"; "owed" / "owes" wording leaves the headline and empty states; the accountant's text is labelled "Description" everywhere; the menu and title read "Settlement Account". Tab keys in the address may stay as they are. |
| 7 | *web only* (D14) | The ACR follow-up form's header drops the description line. The Label column on the list stays. |
| 8 | *web only* (D15) | The ACR list shows cash sales, settlement, net collected, card total and card slips. "Net collected" binds to the server's banked total, replacing the stale field that renders blank. The wire model declares the figures the server already sends. |

## Testing

oms-react's own suite, as spec 308 did: column definitions and order, the label shown for each
type, the export's sheet content for a fixture grid including Arabic, the upload dialogs' preview
states, the tab names, and the ACR list bindings. Fixtures follow the recorded web contract.

## Out of scope

Everything BackOffice 2149 lists as out of scope, plus an Arabic locale for the web (only the
English locale exists; Arabic appears where the labels already carry it inline).
