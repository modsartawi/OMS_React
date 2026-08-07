---
type: wayfinder-ticket
wayfinder: grilling
map: 240
status: open
blocked-by: 244
---

# 248 — Whether the web owes a spreadsheet

## Question

Graduated from the map's **Export parity** fog once
[What a browser can print a paper form with](241-what-a-browser-can-print-a-paper-form-with.md)
settled the print path as client-side. Export no longer hangs on that decision, so the question is
now sharp — and it is a scope question first, a mechanism question second.

The WPF suite offers XLSX in two distinct places, and they are not the same feature:

1. **Out of every inquiry grid** — `PrintableControlLink.ExportToXlsx`, a generic "dump this grid"
   affordance sitting on Collection Inquiry, ACR Inquiry, Deposit Inquiry and Collection Attempts
   alike.
2. **Out of the ACR form** — a dedicated `AcrFormExcelWriter` that writes the *document*, not a
   grid: the 11 columns, the totals row, the ملخص التحصيل block. A second rendering of the
   facsimile, in a third medium.

Settle, with the user:

- **Does the web owe either?** Who actually uses these exports today and for what — is the
  accountant pasting a grid into a reconciliation workbook, or is this a WPF affordance nobody
  asked for that got added because the control offered it? Read `AcrFormExcelWriter.cs` before the
  conversation so the second one can be judged on what it really produces.
- **If the grids owe an export**, is it client-side off the AG Grid rows already in memory (fast,
  free, exports exactly what's on screen including the active filter) or a server endpoint (exports
  the whole result set past the page, needs a backend-wave ticket)? The answer turns on whether
  users export a filtered view or a full month.
- **If the ACR form owes one**, note that it becomes a **third** rendering to keep in sync with the
  WPF writer and the React facsimile — the same drift argument that ruled server PDF out in 241.
  Establish whether that cost is worth paying, or whether "print the form, export the grid" covers
  the real need.

A defensible "no, and here's what the users do instead" is a complete answer. If the answer is yes
in either place, say which wave owns it and whether it belongs in this spec or a follow-on effort.
