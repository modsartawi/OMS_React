---
status: done
spec: 135
blocked-by: BackOffice 4464
---

# 1000: A search row says the item's material status

BackOffice 4464 (owner ruling 2026-11-28) widened the catalogue search to match the till: every item but
DISCONTINUED. Before, an agent searching **509091** got *"Nothing matches that"*, because its status is
DEPLETION.

Now a found item can be DEPLETION, SFDA, SUPPLIER CONSTRAINT, UNDER PROCESSING and so on, and the agent
should see that before adding it.

## Built

- **`ItemSearchRow.materialStatus`.** The server already sent it; it is now typed.
- **`SearchRowView.status`.** The master's own text, trimmed. It is `null` for AVAILABLE, a blank status, or
  a prerequisite row.
- **The badge.** A small badge beside the name, with the tooltip *Material status: …* (`search.status`, en
  and ar).
- **No other change.** Availability stays on the end edge, and the stock check at add still decides.

## Proof

- [x] `item-search.test.ts`:
  - the status is named for anything but AVAILABLE;
  - it is silent for AVAILABLE, blank, or absent;
  - the row-shape guard now lists `status` and checks it never carries the estimate.
- [x] typecheck, vitest 832/832, lint.
- [x] Live on the walk, store 1224: *TODDIES WIPES OLIVE EXTRACT (2+1)*180* shows **DEPLETION** and
  *none at store*.
