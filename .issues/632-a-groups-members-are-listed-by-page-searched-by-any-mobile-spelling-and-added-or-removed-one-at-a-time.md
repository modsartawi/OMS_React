---
status: done
spec: BackOffice 3173 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3173-oms-react-loyalty-groups-brief.md)
blocked-by: 630
---

# 632 — A group's members are listed page by page, searched by any spelling of a mobile, and added or removed one at a time

## What to build

A **Members** tab on the group page (`GET LoyGroupWeb/Groups/{groupId}/Members?search=&page=&pageSize=` →
`{ total, rows: [{ mobile, isEnrolled, loyId?, addedBy, addedAt }] }`): a paged grid of mobile, enrolled
flag, added by, added at. Search passes what the user typed (`05…`, `5…`, `+9665…`, `9665…` all work — the
server canonicalises); the search and page sit in the URL.

Mobiles are shown **exactly as the server returns them** (canonical `9665XXXXXXXX`) — never reformatted on
the client, isolated as machine values.

A maintainer can **add one** mobile (`POST …/Members/Add`) — refusals not-a-mobile, placeholder mobile,
already-in-group shown with the server's message and code — and **remove one** (`POST …/Members/Remove`)
after a confirm naming the mobile. Mobile count on the group refreshes after either.

## Spine reach

api (Members, Add, Remove) · logic (query from URL, pager) · component (tab, grid, add field, remove confirm) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `members query carries the typed search untouched and drops a blank one` — `+966 5…` passed through; `''` dropped · pure
- [x] `loy-groups members drive` — paging, search, enrolled flag, add refused as placeholder, add succeeds, remove after confirm; add/remove hidden on view-only · flow (extend `tools/loy-groups-drive.mjs`)

## Boundaries

Doors BackOffice 3174 (stubbed). Grid uses `GridPager` + base col def. Remove's confirm interpolates the
mobile with `fsi()` (a `t()` sentence).

## Done when

On stubs, a group's members page, search, add and remove work with the refusals shown, and the gates are green.

## Blocked by

[630](630-a-marketing-user-creates-a-group-with-an-upper-case-code-and-edits-its-names-and-the-code-never-changes.md)

## Comments

- 2026-10-28 — Done — built 2026-10-28 on spec/3173-loyalty-groups (worktree C:\Playground\oms-react-spec3173, unpushed), all envelopes stubbed; commit 2930a91c.
- 2026-10-28 — Page size 50, 1-based — matches brief Changes 2026-10-27. Members is a plain section (no tab strip). Mobile-count caption not pluralised.
- 2026-10-28 — Owner: the Remove confirm adds "Bonus-buys for this group stop applying to it"; Arabic copy needs sign-off.
