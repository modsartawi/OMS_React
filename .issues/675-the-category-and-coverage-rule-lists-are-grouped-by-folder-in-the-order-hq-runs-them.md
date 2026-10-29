---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md); owner ask 2026-10-30
blocked-by: 617
---

# 675 — The category and coverage rule lists are grouped by folder, in the order HQ runs them

## What to build

Asked by the owner on 2026-10-30, after the 674 walk. Each category and coverage rule already has a **Folder** box
(`rule.folder`, a free-text `Input` in `coverage/RulesetPage.tsx`), but the rule list on the left ignores it. The list
is one flat, numbered list with up / down arrows. The owner asked whether the rules can be organised in folders. They
also asked what the numbers and arrows are for.

**Why the list is not a folder tree, as on Guards (609).** A ruleset's ORDER is part of its meaning
(`coverage/ruleset-edit.ts`; BO spec 3126):

- **Category:** the first rule that matches a line sets its category; with none, the item master's category stands.
- **Coverage:** for each value, the first rule (in order) that holds and may set it wins.

Guards are independent checks, so their folders can be a tree. A tree here would put rules side by side that are not
next to each other in the order HQ runs, and moving a rule inside its folder could jump it past rules in other
folders. So the folders are shown **inside the one ordered list**, never instead of it.

Build, on both pages (`RulesetPage` serves `category` and `coverage`):

- **Folder runs.** The list is cut into runs of rules that sit next to each other and share a folder. Each run gets a
  heading: the folder (path as written, `bdi`; a blank folder reads "No folder"), how many rules it holds, and their
  positions (e.g. "5–15"). The seeded 059 + 060 document reads **Segments** 1–3, **Prescriptions** 4, **Item master**
  5–15.
- **A split folder is shown, not hidden.** If the order splits a folder (rules 1–2 and 4 are in Segments, rule 3 is
  not), the heading appears again where the folder continues, marked as a continuation. The list never moves a rule
  to group it.
- **Collapse.** A run heading collapses and expands its rules. A collapsed run still shows its heading, count and
  positions. Collapse state is per viewer and per page, kept in the component; it is not saved with the draft. The
  open rule's run (`?rule=`) is always expanded.
- **Numbering stays global.** Each rule keeps its position in the whole ruleset (1…n), in every run and in the filter
  below.
- **Arrows.** Up / Down still move a rule one place in the whole order (`moveRule`, unchanged). A rule moved past
  the edge of its run joins no other folder. It keeps its own folder, so the runs re-cut around it (that is how a split
  appears). Arrow labels and tooltips keep "checked earlier / later".
- **Folder filter.** A picker above the list ("All folders" + the document's folders, plus "No folder" when any rule
  has none) shows only that folder's rules, with their real positions (e.g. 3, 7, 12). While a filter is on, the
  arrows are disabled, with the tooltip "Show all folders to change the order": one step in the whole order could
  pass a hidden rule.
- **Folder picker on the rule.** The free-text Folder box becomes a combobox that offers the document's folders and
  takes a new name. A blank value drops the key, as `withFolder` does today. Changing the folder never changes the
  rule's position.
- **The order note is visible.** The page's `{kind}.order` sentence (today small muted text under the title) moves to
  an info note directly above the list, so it is read where the numbers are.

## Spine reach

components · test

## Proof (→ `tdd` red-green cycles)

- [x] unit (`coverage/ruleset-edit.test.ts` or a new pure `folderRuns`): contiguous runs with their positions; a
      split folder gives two runs of that folder (the second a continuation); blank folder → its own "no folder" run;
      an empty ruleset → no runs; the rules come back in document order (nothing regrouped)
- [x] drive (stubbed with the 059 + 060 document, `tools/insurance-coverage-seeded.json`): headings Segments 1–3,
      Prescriptions 4, Item master 5–15; collapse Item master → rules 5–15 hidden, heading still reads 11 rules
      5–15; move C-EXCEPTION up → Segments 1–2, Prescriptions 3, Segments 4 (continued); filter Segments → rules
      1, 2, 4 (after the move), arrows disabled; pick a folder for a rule → Save sends only that rule's `folder`, in
      the same position; LTR + RTL
- [x] drive: the Categories page shows the same runs for a category document
- [x] mutation: bucket the rules by folder ignoring the order → the drive fails
- [x] walk on the owner's local SIS.Api: the Coverage page shows the three seeded folders in order

## Boundaries

No SIS.Rules or BackOffice change: `folder` is already in both documents and the engine ignores it. The wire is
unchanged; a rule nobody edits goes back exactly as it was read. Out of scope: a folder tree like Guards, nested
folder levels (a `/` path is shown as written), dragging rules to reorder, renaming a folder across rules, and moving
a whole run at once (follow-ups if the team asks). Rules: `feature-structure`, `i18n-zero-literal` (EN + AR),
`logical-tailwind`, `bidi` (folder names `bdi`, positions and rule ids `Ltr`).

## Done when

On both pages, the rule list shows each folder as a heading over its rules, in the order HQ runs them, with global
positions. A split folder is visible, a folder can be collapsed or filtered, and a rule's folder is picked from the
existing ones. No rule's position changes unless the arrows move it.

## Blocked by

[617](617-the-insurance-team-edits-insurer-settings-category-rules-and-coverage-rules-with-the-payer.md)

## Done (2026-10-30)

- **Runs** (`coverage/rule-folders.ts`, pure): `folderRuns` cuts the rules where the folder changes, in document order
  (nothing is moved), each run with its positions, `continued` and `nth` (which of its folder's runs it is);
  `folderPath` / `ruleFolder` read a folder segment by segment as the Guards page does (`a / b` = `a/b`, blank = none);
  `folderOptions` = the folders in first-seen order + whether any rule has none.
- **List** (`RulesetPage.tsx` `RuleList`, both pages): a heading per run (folder `bdi` or "No folder", "(continued)",
  positions `Ltr` via `formatRange`, count); a heading collapses its own run (keyed folder + `nth`, so a move elsewhere
  keeps it; the open rule's run stays open); global positions everywhere; the arrows still `moveRule` one step, and a
  keyboard press keeps focus on the arrow when the rule lands in another run; the folder filter ("All folders", each
  folder, "No folder") keeps real positions and turns the arrows off with `aria-disabled` + the reason as `title`
  (focusable, click guarded); a filtered folder that disappears resets to All. The "first match wins" note is an info
  box above the list.
- **Folder box**: `<input list>` + `<datalist>` of the document's other folders; typed as is, read as a path on blur
  (blank drops the key); the position never changes.
- **Proof.** vitest `coverage/rule-folders.test.ts` (7); full suite 541 files / 7727 tests green; typecheck + lint green
  (control baseline: the run heading allowlisted as a disclosure). Drive `tools/insurance-ruleset-folders-drive.mjs`
  56/56 LTR + RTL; mutation (bucket by folder ignoring order) → the drive and the unit test fail. 617's coverage drive
  172/172, 674's seeded drive 52/52; 607's insurance-rules drive 84/86, the same two "one read of the ruleset"
  failures as on the base commit. Walk on the owner's local SIS.Api (2026-10-30, user 14419, view only): Segments 1–3,
  Prescriptions 4, Item master 5–15, the filter and the note as built.
- **Left as is (reviews):** the folder box edits live, so while a name is typed its prefixes briefly show as folders
  (as every other box on the rule); the order note shows only once the draft is read (not on loading / denied).
