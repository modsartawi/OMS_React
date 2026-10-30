---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 702, 705, 706
---

# 708 — A labels-only re-pin shows text before and after, and labels and package items reach the review list

## What to build

Stories 24, 61, 64; D9, L5, L9; doors 3295, 3296, 3297. Three connected pieces:

- A **labels-only re-pin draft**, on 705's list: the rule's text before and after, no back-test, a separate approver.
- A **labels-changed** review item and badge on the published ruleset, opening that draft.
- An **upload-due** review item, opening the upload (706), and a **package** review item showing the IG diff: profiles,
  extensions and CodeSystems added, removed or renamed.

**Decision (overrulable):** the package item is added here. Door 3295 raises it, but the brief's review row does not list
it, so it would otherwise have no screen.

## Spine reach

model/api (draft kind, item kinds, IG diff) · store/logic (before / after pairs) · component (draft, rows, badge) ·
i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] the before / after pairs, and no back-test demanded for this draft kind — pure
- [x] labels-changed item → draft → approve as another user; upload-due item → upload; package item → diff — flow (stubbed; RTL direction with English words, see Comments)

## Boundaries

The builder shows the latest labels, and a published ruleset's text stays pinned until its draft is approved. Doors
stubbed; 711 reconciles.

## Done when

Better wording reaches a published rule only through an approved draft, and the team learns when a Nphies release needs
attention.

## Blocked by

702, 705, 706.

## Comments

**2026-10-30, built on stubs (`tools/insurance-fhir-708-drive.mjs`, `tools/fhir-rules-stubs-708.mjs`, port 5218).** Never
against a live SIS.Api. Draft and badge on 705's list (`aliases/`, group `repin.labels`); items on 702's shape (`review/`,
groups `item.labels`, `item.due`, `item.package`).

Door shapes guessed, for 711 to reconcile (3295, 3296 and 3297 spell none):

- 705's re-pin doors carry `kind: 'labels'`: `Affected` lists the ruleset; `before` / `after` are the label versions as
  strings; `subject` is one machine string (`benefit-category · 12`).
- The draft adds `texts: [{ ruleId, before: { en, ar }, after: { en, ar } }]`, with `backtest: null`.
- Review rows, all on `GET InsuranceRules/Review`, cleared on 702's `Clear`:
  - `kind: labelsChanged`: `ruleset: { id, name, version }`, `draftId` (null when none is raised).
  - `kind: uploadDue`: `due: { why: newPackage | unlistedCode, version, system, code }`.
  - `kind: package`: `package: { version, previousVersion, profiles, extensions, codeSystems }`, each group
    `{ added: string[], removed: string[], renamed: [{ from, to }] }`; a missing group or list reads as empty.

Overrulable decisions:

- **The badge sits on the re-pin list's ruleset row and on the review row.** No other screen lists a published ruleset
  with its version, so the editor screens carry none. If "on the published ruleset" means the guards or monitors screen,
  that needs a read door those screens can call.
- A draft is reached by address, `/insurance-rules/aliases?repin=<id>`; closing it takes `repin` out. An item with no
  draft goes to the list, where any grant holder raises one. Door 3297 reads as raising it itself, so the raise may go.
- A labels-only draft ignores a back-test if a door sends one; approval never waits on it.
- Only text that moves gets a line, per rule and language. Both languages show whatever the reader's. Nothing moved says
  so and can still be approved, as 705's zero-change draft can.
- Unknown `why` reads as "A workbook upload is due." The three kinds clear with a required note, as 702 ruled. Clearing a
  labels-changed item does not touch its draft, and approving a draft does not clear its item: 711 should check whether
  the door clears it.
- Package counts are label + figure, so `ar` needs no plural forms. Package names are machine values, never translated.

**Defect fixed in passing:** 710's Inspect column made the table 12 columns while 702's item rows still spanned 11, which
also failed 702's own drive check. The item's Open cell now spans Actions and Inspect, and that check reads 12.

⚠ `core/i18n.ts` pins `lng` to `en`, so the flow's RTL pass flips direction with English words. The Arabic keys are proved
only as mirroring the English: their wording awaits an Arabic sign-off.

**2026-10-30, review fixes (branch `t3271-review-fix`), all stubbed.** **The labels-changed badge now sits on the published rulesets themselves:** the Guards screen's title (`guards` and `monitors`, since it shows both) and the Coverage and Categories titles. It opens the draft, or the re-pin list when none is raised; an approved draft takes it away. This replaces the decision above that no screen could carry it: those screens read the same `RepinDrafts/Affected` (key shared, `REPINS_KEY` moved to core). 🚩 Guesses for 711: `rulesetId` is `guards` / `monitors` / `coverage` / `category`, and any holder of those screens may read Affected. A denied read shows no badge.
