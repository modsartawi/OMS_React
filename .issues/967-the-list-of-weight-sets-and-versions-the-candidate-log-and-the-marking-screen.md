---
status: done
spec: BackOffice 4354
blocked-by: 963, BO 4360, BO 4395
---

# 967 — The list of weight sets and versions, the candidate log and the marking screen

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- Start with a quick prototype shown to the owner (HITL); the spec gives the content and not the look.
- The list of sets and versions: owner, note, what differs between two versions, a retired set shown as retired, which version is the candidate set.
- The candidate log: who, when, the version before and after, the reason, the trial's number and its figures.
- The marking screen, under the marking grant: the plans changed against the candidate set, the orders refused, the promise check per mode under the new version, every shelf chance figure that differs with "enough", "too few" or "not steady", and a written reason that must speak to each "too few" or "not steady". A refusal shows its reason.

## Spine reach

oms-react: pages / models / locales / tests

## Proof (→ `tdd` red-green cycles)

- [x] `version-diff-model.test.ts` — what differs between two versions · vitest (`npm test`)
- [x] `marking-model.test.ts` — the figures shown, and the reason required per "too few" or "not steady" · vitest (`npm test`)
- [x] `tools/sourcing-sets-drive.mjs` — list, compare two versions, try to mark without a trial and read the refusal · Playwright drive, run by hand against stubs

## Boundaries

HITL prototype first.

## Done when

The owner has seen the prototype; the model tests are green and the drive passes.

## Blocked by

[963](963-pins-and-the-weight-set-panel-pin-from-a-plan-change-values-on-a-draft-save-as-a-named-set.md),
BackOffice 4360 (`.issues/4360-weight-sets-are-saved-as-numbered-versions-a-draft-runs-unsaved-and-the-candidate-set-is-marked.md`),
BackOffice 4395 (`.issues/4395-a-marking-is-refused-without-a-recent-clean-trial-and-the-candidate-log-keeps-the-trials-figures.md`)

## Comments

Owner decision 2026-11-27 on the prototype (branch `prototype/4354-secondary-screens`, route `/oms/prototype-sourcing-sets`): **variant A**. Sets expand into versions in a table, the candidate log is rows, and marking is one long form. The four checks show first and Mark stays off while one fails. One written reason plus a tick for each "too few" / "not steady" figure. Defaults taken: the version diff shows changed settings only, grouped.

**2026-11-27 — done on stubs; must be reconciled with BO 4360 and BO 4395.** Both server tickets are open and name the
content of their doors only: no path, query, field, refusal code or grant name. By the orchestrator's ruling the screens
are built on a designed wire and drive stubs. Every invented name carries `// PROVISIONAL (spec 4354: not specified)`.
When BO 4360 / 4395 land, replace `stub-sets.json` with captured replies, settle each name below, and rerun the two
model tests and the drive. The BO blockers stay listed for that reason.

Built (variant A, production code; no prototype switcher or fake-data plumbing copied): feature
`src/features/oms/sourcing-sets/` (route `/oms/sourcing-sets`, namespace `sourcing-sets` en + ar, OMS menu leaf after
the Store record leaf of 969, which follows 968's planner data). Tabs in the URL (`?tab=list|log|mark&set=&version=`).
- Sets and versions (`SetsList.tsx`, `VersionDiff.tsx`, `version-diff-model.ts`): owner, note, versions, the candidate
  version, retired / trial set / baseline; the candidate's set opens first onto its versions (saver, time, change line);
  tick two versions to see what differs: changed settings only, grouped (weights, factors, reach, shelf chance table,
  other), "Show every setting" for all. Two versions of one set read older → newer. A setting a version does not hold
  reads at its starting value. "Mark…" on a version, under the marking grant, opens the marking screen on it.
- Candidate log (`CandidateLog.tsx`): rows that open: when, who, before, after, trial number, plans changed, orders
  refused, Dawaa Now promise, the phase 2 bar (was counting, started again); open row: reason, trial period, refusals
  by reason in the spec order, promise check per mode.
- Marking (`MarkingForm.tsx`, `marking-model.ts`): the four checks first, a refusal banner with each reason (and the
  trial-set rule) while one fails, Mark off and the reason box closed; the trial's figures; every shelf chance figure
  that differs with its reading; one written reason plus a tick per "too few" / "not steady" (any reading but "enough"
  must be spoken to: fails safe). A refusal from the mark door shows its reasons in the screen's words; a bare 403 says
  the grant is needed. Marked: a confirmation, the form closes, queries re-read.
- Weight-set settings moved to core: `WEIGHT_CONTROLS` / `WEIGHT_GROUPS` now live in
  `src/core/sourcing-advisor/weight-controls.ts` (the simulator's `draft-model.ts` re-exports them), because two
  features name them.
- No hand-written counted control (checkboxes only), so no `tools/control-baseline.txt` line; colours are tokens.

PROVISIONAL (spec 4354: not specified), each marked so in the code:
- Marking grant: `SourcingAdvisorMark:06` (`canMarkCandidateSet`, `src/core/sourcing-advisor/access.ts`, `SCREEN_KEYS`).
- The screen's own gate: `canOpenWeightSets` = run, save or mark grant (spec §19 names no grant for the list).
- List fields on `WeightSetListItem` (`src/core/models/sourcing-run.ts`): `note`, `retired`, `saved[]{version, savedBy,
  savedAt, change}` (optional, so the simulator's picker is untouched). The list and version doors are 963's.
- Candidate-log door: `GET SourcingAdvisor/WeightSets/CandidateLog` → `CandidateLogEntry[]` (`at`, `by`, `before`,
  `after`, `reason`, `exception`, `trial`, `barDay`) in `src/core/models/sourcing-sets.ts`.
- Marking door: `GET SourcingAdvisor/WeightSets/Marking?name=&version=` → `MarkingReply` (`target`, `candidate`,
  `trialSet`, `checks[]{check, passed, why[]{code, figure}, exception}`, `trial` with `endedDaysAgo`, `lastCandidate`,
  `shelf[]{key, mode, asked, leftOver, from, to, reading, lines, failed, expectedFailed, halves}`); check codes
  `BALANCED_ON`, `NO_WHAT_IF`, `NO_ASSUMED_CARRIER_ROW`, `KEPT_TRIAL`; exceptions `FIRST_CANDIDATE`, `BACK_WITHIN_90`;
  readings `ENOUGH_TO_CHANGE`, `TOO_FEW`, `NOT_STEADY`.
- Mark door: `POST SourcingAdvisor/WeightSets/Mark` `{ name, version, reason, spokenTo[] }` → the new log row.
- Refusal codes (`MARKING_REFUSALS`): `BALANCED_OFF`, `WHAT_IF_ON_PLANNER_DATA`, `CARRIER_ROW_ASSUMED`, `NO_TRIAL`,
  `TRIAL_TOO_SHORT`, `TRIAL_TOO_OLD`, `TRIAL_REFUSED_TOO_MANY`, `TRIAL_STOP_FINDING`, `REASON_MISSING`,
  `REASON_NOT_SPOKEN_TO`, `ALREADY_CANDIDATE`, `SET_RETIRED`; an unknown code is shown with the server's words.
- Keys inside a set's document: the panel's keys (963's), plus `shelfChance.<mode>.<asked>.<leftOver>` for the shelf
  chance table.

Not built (outside this ticket's list): "Copy…" and "Retire" on the list (the prototype showed them; copying is the
simulator's "Save as a named set"; retire needs its own door from BO 4360). The simulator's picker still lists a retired
set's versions; hide them there once `retired` is on the wire.

Proof: `version-diff-model.test.ts` (8) and `marking-model.test.ts` (18) green, plus the grant and menu cases;
`npm test` (13,106), `npm run typecheck`, `npm run lint` green; `tools/sourcing-sets-drive.mjs` on Edge
(`PLAYWRIGHT_CHANNEL=msedge`), LTR and RTL, 127/127. As on the other advisor screens, the RTL pass reads English words
(the app boots i18next in English); every key has its Arabic.

**2026-11-27 — reconciled with BackOffice 4360 and 4395 at pricing2 35a4e56be** (branch `reconcile-sets-planner`).
- Doors (`WeightSetEndpoints`): `GET SourcingAdvisor/WeightSets?withRetired=true`, `GET …/Version`, `GET …/CandidateLog`
  under the run grant; `GET …/MarkScreen?name=&version=` and `POST …/Mark {name, version, reason}` under the mark grant.
- Grants: mark = `SourcingCandidateSet:03` (`WeightSetGrants.Mark`); the screen opens to the run grant only
  (`canOpenWeightSets`), as every read is under it.
- Wire (`src/core/models/sourcing-sets.ts`): the candidate log row `{markedBy, markedAt, before?, after, reason, review?}`;
  the marking screen `{name, version, refusals[{code, why}], review{offered, exception, candidateUntil, trial, shelfChance[],
  barPeriodCounted, barCountedFrom}}`; trial figures with shares as FRACTIONS, `refusedBy`/`changedBy` as maps, the promise
  check `{mode, checked, within, share}`; a shelf figure `{figure, candidate, version, evidence: ENOUGH|TOO_FEW|NOT_STEADY}`
  named `shelfChance 2/0` or `shortFigure SLOT bookAtZero`. Refusal codes are the server's `MarkRefusalCodes`; a refused
  mark is `WEIGHTSET-423` (HTTP 422) with every reason in `data.refusals`.
- The server reads the written reason for each "too few" / "not steady" figure's NAME (`ReasonSpeaksToFigures`): the
  owner's tick now writes the figure's name into the reason (untick takes it out), and is ticked while the reason names
  it; the body carries no `spokenTo`. The screen door always answers `REASON_SILENT_ON_FIGURE` (it checks a blank
  reason): the screen treats it as the reason's to answer, not as a failed check.
- Dropped as not on the wire: a figure's lines / failed / expected / halves, the promise check under the candidate set,
  "ended N days ago" and "N days ago" for going back (the date is shown).
- `stub-sets.json` is rebuilt from the server's own `baseline-weight-set.json`. Proof: `version-diff-model.test.ts` (10),
  `marking-model.test.ts` (23), `tools/sourcing-sets-drive.mjs` 138/138 on Edge, LTR and RTL.
- Not built, not in this ticket's list: `POST WeightSets/Copy` and `/Retire` as actions on the list (the server has them).
No SERVER GAP left for this ticket.
