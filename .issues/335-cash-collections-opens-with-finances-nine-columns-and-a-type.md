---
status: open
spec: 334
blocked-by: — (+ BackOffice 2151, BackOffice 2152)
---

# 335 — Cash Collections opens with finance's nine columns and a Type

BackOffice spec 2149 D1-D3; web spec 334 item 1. Server: BackOffice 2151 (the figures, Type, order) and 2152 (theft filled in).

## What to build

The Cash Collections grid opens with these default columns, in this order: collection date, business date, store code, type, description, amount, surplus, net collected, collector — then the profit center (store) column.

- Type shows the server's label as sent (`Regular`, `Short`, `Regular+Surplus`, `Regular+Stolen`, `Regular+Surplus+Stolen`, and the outside-system label). The web does NOT derive it.
- Surplus is shown as the negative figure the server sends; zero shows as zero, not blank.
- Every column the screen has today stays available behind "More columns". Nothing is deleted.
- Rows are shown in the order the server returns them (collection date, store, business date); the grid applies no default sort of its own. A user may still sort by clicking a header.
- The wire model declares the fields the server already sends and the web never declared (type, cash sales, settlement, status and the rest named in the contract).
- The collector filter, date filters and the slip-count column keep working.

## The seam

Build and test against a stub of EXACTLY the shape recorded under `## Web contract` in the BackOffice ticket(s) named above (`C:/Work/DMSCO/BackOffice/.issues/`). Never invent a field. If that heading is missing, the BackOffice ticket has not landed and this ticket is not startable. **Do not edit the BackOffice repo.**

## Spine reach

oms-react screen / wire model / vitest

## Proof (→ `tdd` red-green cycles)

- [ ] `default columns are finance's nine in order, then profit center` · vitest (collections columns)
- [ ] `type cell shows the server label for each of the five shapes` · vitest
- [ ] `more columns still offers every previous field` · vitest
- [ ] `rows keep the server order by default` · vitest

## Boundaries

Web only. English locale only (Arabic appears inline where labels already carry it). No new dependency.

## Done when

An accountant opening Cash Collections sees finance's sheet: same columns, same order, same type words.

## Blocked by

BackOffice 2151 and BackOffice 2152 (their `## Web contract`)
