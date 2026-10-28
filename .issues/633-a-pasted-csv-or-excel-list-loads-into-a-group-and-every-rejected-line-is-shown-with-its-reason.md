---
status: done
spec: BackOffice 3173 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3173-oms-react-loyalty-groups-brief.md)
blocked-by: 632
---

# 633 — A pasted, CSV or Excel list loads into a group, valid lines are added, and every rejected line is shown with its reason

## What to build

A **Load a list** action on the Members tab (maintainers only). The user pastes text (one mobile per line or
comma-separated) or picks a `.csv` or `.xlsx` file. **The browser turns any of these into lines**: the
first column (CSV) or the first column of the first sheet (Excel, via `@/core/util/xlsx-read`); a first
line that isn't a mobile is skipped as a header and said on screen; lines trimmed, blanks dropped. Over
**50,000** lines is refused before sending, naming the cap. The parser decides shape only — it never judges
a mobile; duplicates and bad lines go up and the server answers them.

`POST LoyGroupWeb/Groups/Members/Bulk { groupId, lines }` → `{ added, alreadyInGroup, duplicateInBatch,
notAMobile, placeholder, rejected: [{ line, outcome }] }`. The result shows the counts and a table of
rejected lines with their reason. Valid lines are added even when others are rejected; the member list and
count refresh.

Decision D4: the parser is a pure module in the feature (one consumer; its header rule differs from
`core/import/material-list`).

## Spine reach

api (Bulk) · logic (`mobile-lines.ts` parser, outcome summary) · component (dialog: paste/file → preview → results) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `mobile lines split, trim, drop blanks and skip a non-mobile header` — paste newline + comma, CSV first column, sheet rows; "Mobile" / "الجوال" header skipped; a mobile-looking first line kept · pure
- [x] `over 50,000 lines is refused before sending with the cap` · pure
- [x] `bulk outcome summary counts every outcome and lists rejected lines by reason` — added / alreadyInGroup / duplicateInBatch / notAMobile / placeholder rendered as keyed counts summing to the lines sent; an unknown outcome string still listed, not dropped · pure
- [x] `loy-groups bulk drive` — paste and an `.xlsx` fixture both load; counts + rejected table shown per outcome · flow (extend `tools/loy-groups-drive.mjs`)

## Boundaries

Door BackOffice 3175 (stubbed). A whole-batch server refusal (cap) shown through `apiErrorMessage`. Lines in
the rejected table are shown as typed, isolated as machine values.

## Done when

On stubs, paste, CSV and Excel each load with the results shown, the cap refuses client-side, and the gates are green.

## Blocked by

[632](632-a-groups-members-are-listed-by-page-searched-by-any-mobile-spelling-and-added-or-removed-one-at-a-time.md)

## Comments

- 2026-10-28 — Done — built 2026-10-28 on spec/3173-loyalty-groups (worktree C:\Playground\oms-react-spec3173, unpushed), all envelopes stubbed; commit 744bdc62 + b33ea828 (figures grouped with formatFigure; the agent's drive had run against a stale vite).
- 2026-10-28 — Review fix 9c27d39c: a pasted line takes its first field across `;` and tab too, like CSV (two Excel columns paste).
- 2026-10-28 — Owner: first line with no digit (Latin or Arabic-Indic) is a header; CSV decoded UTF-8; repeats sent as typed; Arabic strings unsigned.
