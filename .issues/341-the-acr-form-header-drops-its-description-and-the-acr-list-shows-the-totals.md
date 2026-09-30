---
status: open
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

- [ ] `acr form header renders no description line` · vitest
- [ ] `acr list shows cash sales, settlement, net collected, card total and card slips` · vitest
- [ ] `net collected binds to the banked total and is not blank` · vitest
- [ ] `acr list still shows the label column` · vitest

## Boundaries

Web only. English locale only (Arabic appears inline where labels already carry it). No new dependency.

## Done when

The ACR list shows five money columns with values, and the form prints without الوصف.

## Blocked by

None — can start immediately
