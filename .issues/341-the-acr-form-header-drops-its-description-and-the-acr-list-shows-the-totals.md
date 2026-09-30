---
status: done
spec: 334
blocked-by: —
---

# 341 — The ACR form header drops its description and the ACR list shows the totals

BackOffice spec 2149 D14, D15; web spec 334 items 7 and 8. Web only; the server already sends everything needed.

## What to build

**Form.** The web ACR follow-up form's header no longer shows the description line (الوصف / the ACR's label). Nothing else in the header moves out of place.

**List.** The web list of ACRs shows, per ACR: cash sales, settlement, net collected, card total, card slips.

- "Net collected" binds to the banked total the server sends. The current binding reads a field the server stopped sending and renders blank; remove it.
- The wire model declares the totals the server already sends.
- The Label column on the list STAYS (owner ruling: only the form header line goes).
- Settlement keeps its sign as sent.
- The ACR list's export (ticket 336) picks the new columns up by being the grid as shown.

## Spine reach

oms-react screen / wire model / vitest

## Proof (→ `tdd` red-green cycles)

- [x] `acr form header renders no description line` · vitest — `acr-header.test.ts`
- [x] `acr list shows cash sales, settlement, net collected, card total and card slips` · vitest — `acr-columns.test.ts`
- [x] `net collected binds to the banked total and is not blank` · vitest — `acr-columns.test.ts`
- [x] `acr list still shows the label column` · vitest — `acr-columns.test.ts`

### What was done (2026-09-30, AFK)

- **Form.** The header strip became data (`acr-header.ts`) that `CollectionAcr.tsx` draws as
  listed, because the node test runner cannot import the component (it pulls in a stylesheet and
  an image, and React Testing Library is not installed). The header test was red with الوصف in
  the list and green once it was removed. The row now has three cells, not four.
- **List.** `AcrInquiryRow` declares `cashSalesTotal`, `settlementTotal` and `bankedTotal` (checked
  against BackOffice's `AcrInquiryModel`) and no longer declares `netCollectedTotal`. The five
  figures are default columns in the ticket's order; Card Slips left the More-columns tail.
  The list tests were written alongside the rebinding, not watched red first.
- **Export.** Ticket 336 had not landed, so the existing CSV column map was moved to the new
  fields (it is typed by the grid's field lists and would not compile otherwise).
- **Driven, all envelopes stubbed** (vite on :5199): `collection-drive` 222/224,
  `collection-print-drive` 151/153, `acr-closed-by-drive` 41/41, each with new 341 checks. The
  four failures are the same four that fail without this ticket's changes (measured on a
  stash): two expect the ACR list to open on today's *business* date, two expect the Hijri date
  and a blank collection date on the form — stale since b124dfe and 5324d41.
- Gates: typecheck clean, vitest 160 files / 2732 tests, lint's three gates clean, build clean.

### Outstanding (not this session's)

- A live SIS.Api drive of the ACR list and form — every envelope here was stubbed.
- An A4 print check of the header: the second row re-flows from quarters to thirds.
- Decisions and review findings left for the owner: `.afk/HITL-341.md`.

## Boundaries

Web only. English locale only (Arabic appears inline where labels already carry it). No new dependency.

## Done when

The ACR list shows five money columns with values, and the form prints without الوصف.

## Blocked by

None — can start immediately
