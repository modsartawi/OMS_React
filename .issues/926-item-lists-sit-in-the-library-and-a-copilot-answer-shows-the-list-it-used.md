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
