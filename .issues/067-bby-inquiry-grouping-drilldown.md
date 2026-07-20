---
status: open
spec: 061
blocked-by: 066
---

# 067 — groupingRowsOpenAPagedMembersDrilldown

## What to build

The material-grouping **members drilldown** inside the Details modal — so a grouping that stands for
many SKUs is inspectable without bloating the detail payload.

- Each Buy/Get row that `isGrouping && memberCount>0` carries an inline **"N members"** chip.
- Clicking it opens a **nested, paged** drilldown (a second `core/ui/Modal.tsx`) that calls
  **`GET Bby/GroupingMembers?bbyNumber=&side=&groupingKey=&page=&pageSize=`** →
  `BbyGroupMembersDto { side, groupingKey, total, page, pageSize, members[] }` (material number,
  per-page-enriched description, qty, uom).
- Works for **both** sides: Buy groupings keyed by `matGrouping`, Get groupings keyed by `condNumber`
  (the `side` param selects). Prev/Next paging; footer shows the range + total; loading state per page.
- Scales to ~1,000 SKUs — only the opened grouping's current page is ever fetched.

## Spine reach

model/api (`BbyGroupMembersDto`, `api.ts` `groupingMembers(...)`) · component (nested Modal, member
table, pager) · i18n (drilldown title, column headers, pager) · test (app-drive).

## Proof (→ `tdd` red-green cycles)

- [ ] a Buy-side grouping chip opens the drilldown and pages through mocked `Bby/GroupingMembers` (range/total correct); a Get-side grouping opens with `side=get` keyed by `condNumber` · **flow** — verify via typecheck + drive (mocked members envelope)

## Boundaries

New endpoint **`GET Bby/GroupingMembers`** (runtime-blocked; lazy + paged). Nested `core/ui/Modal.tsx`.
New i18n keys. No vitest bootstrap.

## Done when

Grouping rows open the paged members drilldown for both Buy and Get sides against a mocked
`Bby/GroupingMembers`, with working paging; typecheck + build green.

## Blocked by

[066](066-bby-inquiry-details-modal.md) — the chips live in the modal's Buy/Get tables.
