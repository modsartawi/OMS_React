---
status: open
spec: BackOffice 4057
blocked-by: BO 4061, 925
---

# 926 — Item lists sit in the library, and a Copilot answer shows the list it used

## What to build

- **The analytics library** shows the `itemlist` kind beside boards, reports and views: icon, filter, folders, share,
  reassign and delete, through the existing item actions. Opening one goes to 925's list page.
- **A Copilot answer** shows the server's "Used" line with a link to the list. The `list_periods` result renders as
  a table with a per-status total, and calendar overlaps appear as a warning line.
- **A saved panel whose list is gone** shows "list not available" with no figures.

## Spine reach

UI (library, Copilot answer rendering, panel state).

## Proof (→ `tdd` red-green cycles)

- [x] The library filters by the new kind
- [x] The answer's Used line links to the list
- [x] The calendar warning renders
- [x] The "list not available" panel state has no figures
- [x] Lint + build clean

## Done when

Proof is green, and there is a live walk on BO 4061.

## Blocked by

- BackOffice 4061
- 925

## Comments

**2026-11-19: built against stubs (impl/926). Status stays open: the live walk on BO 4061 is owed.**

- Proof, red-green in vitest: `boards/library.test.ts` (kind chip, filter, door param, URL), `boards/item-actions.test.ts`
  (a list: share/unshare/narrow/reassign/delete, never certify or save), `copilot/answer-item-lists.test.ts` (Used line
  and link, list_periods table and per-status total, change format, calendar warning), `boards/panel-state.test.ts`
  (`listGone` shows no figures, even over an earlier answer). Drive `tools/item-lists-copilot-drive.mjs` 48/48, LTR and
  RTL, stubbed. Lint: every gate clean except `check-boundaries`, which fails only on the pre-existing
  `insurance-rules/aliases/door-shapes.test.ts`. typecheck, test and build clean.
- **Guessed contract (BO 4059–4061 not built), each in one place:**
  - `usedLists: [{ listId, name, version, members, line: {en, ar} }]` on the answer: `core/models/copilot.ts`, read in
    `copilot/answer-item-lists.ts`. The panel shows `line` as sent and adds "Open the list".
  - `listPeriods: { step, listId, measure, members: [{ level, key, label, noPeriods, segments: [{ status, days, perDay }],
    change }], totals: [segments], overlaps: [{ member, status, from, to, event: {en, ar}, eventFrom, eventTo }] }`: same
    files. Top and bottom recoveries are not drawn; the guess carries none (expected in the answer's text or tables).
  - The list-gone refusal code `ANALYTICS-434`: `ITEM_LIST_GONE` in `boards/panel-state.ts`.
  - The library asks `GET Analytics/Items?kind=itemlist`; a list row carries the item tier actions (share, unshare,
    narrow, reassign, delete) through the existing Analytics/Item doors (925's list page cannot import them).
- No "My item lists" menu leaf: lists sit on All items under the Item lists chip.

- **2026-11-19 — code review fixed** (commits 823fd1a9..8ee84d1a on `impl/926`): a gone list (`listGone`) hands no
  figures to the panel's actions (table / CSV / XLSX / PNG), marks, as-of or period line, on board panels and the view
  page (`figuresOf` in `panel-state.ts`, `shownAnswer` in `PanelBody.tsx`); the delete and un-certify confirms and the
  untitled share / narrow / reassign titles have `itemlist` words in en+ar (they rendered raw keys); the share dialog's
  can / cannot lists are by kind (`share-rights.ts`) — a list's audience reads and exports it, only its owner uploads a
  new version or deletes it; tier writes re-read the item-lists keys and a delete drops the list's own; the copilot's
  used-list and list-periods rows key by index too. Tests in `panel-state.test.ts` and `kind-locale.test.ts`;
  `tools/item-lists-copilot-drive.mjs` 58/58 (share words, delete confirm, list gone over a held answer added).
- **2026-11-19 — reconciled to BackOffice's real 4059/4060 and in-progress 4061** (BO `spec4057` d919921f5; BO
  `t4061` f374504d9 plus its UNCOMMITTED working tree; read only). Commit 9845a300. Guess → real:
  - Library `GET Analytics/Items?kind=itemlist`; a saved query's `itemList` is the list's id (string): **matched**.
  - `usedLists[{listId,name,version,members,line:{en,ar}}]` → **`itemLists[{id,name,version,itemsAndGroups,line}]`**,
    where `line` is the INDEX of the server's "Used:" line inside `assumptions`. The reader now takes the line from
    `assumptions`, draws it once (linked, under the plain assumption lines, which leave it out; reading choices keep
    their own lines). Fixed.
  - `listPeriods` answer part: **BO sends none.** 4060's `ListPeriodsResult` (statuses, change + base, breakdown,
    entries, top/bottom 5 recoveries, calendar overlaps) goes to the model only; the answer's `trace` carries inputs, not
    results, and no panel table was added. The oms reader/table stays dormant (drawn only if a later BO ticket sends it);
    recoveries cannot be drawn. Open ask for BO if the table is wanted.
  - List gone: **`ANALYTICS-437`** with `data { itemList, reason: 'deleted' | 'not-shared' }`, not 434 (434 is 4058's
    refused file). ⚠ It exists only UNCOMMITTED in t4061's tree; t4061's committed state still answers the expansion's
    404/413 to a saved panel. Recheck when 4061 merges.
  - Drive `tools/item-lists-copilot-drive.mjs` restubbed: **48/48** (was 58: the list_periods table/warning checks were
    replaced by "none drawn").
  - Still unverified: 4061 is unfinished (no Comments, uncommitted store/query/refusal changes, eval cases and live
    walk not done); no live walk (no local SIS.Api with these doors; BO's dev Cube unreachable).

- **2026-11-20 — final reconcile to BackOffice spec4057 723cdb708** (merged into `pricing2`; read only). Guess → real:
  - afc267a0e: `ANALYTICS-437` `data { itemList, reason: 'deleted' | 'not-shared' }` is now COMMITTED, as we read it
    (saved views, board/report/draft panels, report figures; inline queries keep 404/413). **Matched.**
  - `itemLists[{ id, name, version, itemsAndGroups, line }]`, `line` an index into `assumptions`: **unchanged**;
    b2f0413be (fix 15) keeps the Used lines first when the ten-line limit cuts, in the server's order — our index read
    is unaffected. Still no `listPeriods` answer part (4060's result stays with the model).
  - 589da89d1 (fix 7): one unreadable list no longer refuses a report's Words; the summary becomes
    `unavailable: 'listNotAvailable'` and other figures stand. We drew the raw code: **fixed** (be976a43,
    `summaryReasonKey` + `report.summary.reason.listNotAvailable` en/ar; other reasons still as sent).
  - aa5e3c4fd (fix 8): a blank `itemList` is refused 406 `query.itemList`. Ours never writes one (it passes the table's
    query through). **No change.**
  - 2102f9a7f (fix 13): suggestions carry their list server-side (`CopilotSuggested.ItemList`); the wire's suggestions
    stay `{ question, by }`. **No change.** 23939613d, 0d8dc1344, 7970b5b45, 09dcf730a, 1784a29df, e2f40417c: server/
    model-side only. **No change.**
  - Later on `pricing2` (not 4057): ticket 4089 adds `itemListId` on an assumption line (additive); our `line` index
    read still works — adopt it if BO drops `line`.
  - Drive `tools/item-lists-copilot-drive.mjs` **48/48** (LTR + RTL), stubbed. typecheck, test, build clean; lint as 925.
    Status stays open: the live walk on BO 4061 (deployed) is owed; BO 4061's clean eval run is owed on their side.
