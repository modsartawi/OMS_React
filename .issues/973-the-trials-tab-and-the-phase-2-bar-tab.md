---
status: done
spec: BackOffice 4354
blocked-by: 971, BO 4394, BO 4396
---

# 973 — The Trials tab and the Phase 2 bar tab

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- Trials: the list of trials, the form that starts one (a saved version and a period; needs the save grant), a trial's result (orders solved, refused by reason, failed), the factor table, and "open with this set beside it", which puts the tried set in the page's "Set beside it": a banner, a thin second bar, one more column in the breakdowns, the promise check under that set.
- Phase 2 bar: its own picker for 28 days and a channel group; each limit in words with its figure and "met", "not met" or "cannot be read yet" with why; the things read that are no limit, apart; the 30 largest differences to open and mark; the rulings to write; and "accept this reading", which keeps it.
- No riyal sum, no green and no red.

## Spine reach

oms-react: page / models / locales / tests

## Proof (→ `tdd` red-green cycles)

- [x] `trials-model.test.ts` — the list, a result with its refusals, and the factor table · vitest (`npm test`)
- [x] `bar-model.test.ts` — each limit with its state and why; "cannot be read yet" names the cause · vitest (`npm test`)
- [x] `tools/sourcing-results-drive.mjs` — start a trial on stubs, open its result beside the candidate set, read the bar · Playwright drive, run by hand against stubs

## Boundaries

—

## Done when

The model tests are green and the drive passes.

## Blocked by

[971](971-the-comparison-results-page-one-sentence-one-bar-three-panels-where-the-plans-differ-and-a-figur.md),
BackOffice 4394 (`.issues/4394-a-saved-version-is-tried-over-stored-runs-and-two-sets-are-read-side-by-side.md`),
BackOffice 4396 (`.issues/4396-the-phase-2-bar-is-read-limit-by-limit-and-a-shelf-chance-figure-is-marked-enough-too-few-or-not.md`)

## Comments

**2026-11-27 — done on stubs; must be reconciled with BO 4394 and BO 4396.** Both server tickets are open and name the
content of their doors only ("a door of its own", "SIS.Api doors"): no path, query name, field, code or grant. By the
orchestrator's ruling the tabs are built on a designed wire and drive stubs. Every invented path, field, code and grant
carries `// PROVISIONAL (spec 4354: not specified)`. When BO 4394 / 4396 (and BO 4360's grant seed) are built, change
these to match:

- **Grant** (`src/core/permissions.ts`, `src/core/sourcing-advisor/access.ts`): the save grant `SourcingAdvisorSave:01`
  (`canSaveWeightSets`) starts a trial and the factor table. The Phase 2 bar's marks, rulings and "accept this reading"
  are written under the same key, because no grant is named for them (the spec says "the owner judges"); split them out
  when one is seeded. Reading both tabs needs only today's view grant (`SourcingAdvisor:01`), as BO 4283 decision 4 says.
- **Trial doors** (`src/features/oms/sourcing-results/api.ts`): `GET SourcingAdvisor/Trials`,
  `POST SourcingAdvisor/Trials/Start` (`weightSet`, `weightSetVersion`, `from`, `to`), `GET SourcingAdvisor/Trials/Factors?trialId=`,
  `POST SourcingAdvisor/Trials/Factors` (`trialId`).
- **Bar doors**: `GET SourcingAdvisor/Phase2Bar` (`from`, `channelGroup` = `APP_SITE`|`CALL_CENTRE`, `runs` = `OMS`|`CHANNEL`),
  `POST SourcingAdvisor/Phase2Bar/Mark` (+ `orderNumber`, `view`, `direction`, `mark`), `POST …/Ruling` (+ `subject`,
  `key`, `text`), `POST …/Accept` (+ `to`); each write answers the whole reading.
- **Fields and codes** (`src/core/models/sourcing-results.ts`): `TrialsReply`, `TrialRow` (states `WAITING|RUNNING|DONE|FAILED`,
  `queuePosition`, `leftOutNoPlan`, `fromKept`), the seven refusal codes `TRIAL_REFUSALS`, `FactorTableReply`/`FactorRow`
  (factor codes `TRIAL_FACTORS`, `measure`, `switched`, change kinds), `ResultsBeside` (on the summary reply as `beside`
  when `besideSet` is asked: `leftOut`, `top`, `differ`, `estimate`, `shipments`, `listFee`, `promise`),
  `ResultsBesideCell` (on each breakdown row and the total as `beside`), `BarReply`, `BarLimitReading` (limit codes
  `BAR_LIMITS` a–i, states `MET|NOT_MET|CANNOT_READ`, causes `BAR_CAUSES`), `BarFigure` (`part` codes, `unit`, `of`,
  `meets`), the reading codes, `BarLargestRow` (with `runId`), the marks `RULE_RIGHT|WRONG_RULE|DATA_FAULT`, `BarRuling`,
  `BarAccepted`, `lastChangedAt`.
- **Stubs** both the model tests and the drive read: `stub-trials.json` (trials, factor table, the set beside it) and
  `stub-bar.json`.

Built: Trials tab (`TrialsTab.tsx`, `trials-model.ts`): the list newest first with the queue, the start form (a saved
version and whole local days, at most `maxDays`, inside the kept runs, ended by yesterday), a trial's result (orders,
solved, refused by reason in the spec's order, failed, left out; a mismatch note when they do not add up), the factor
table, "open with this set beside it". "Set beside it" (`BesideSection.tsx`): the banner (trial-set wording), the thin
second bar (`@/core/charts/ShareBar`), the plans that differ by kind, the estimate between the sets, shipments, list
fee, and the promise check under that set labelled "the real deliveries, as this set would have promised them"; and
the Breakdowns tab's one more column (`besideSamePlan`, after the two same-plan columns, only when the rows carry it).
Phase 2 bar tab (`BarTab.tsx`, `bar-model.ts`): its own picker (first of 28 days, channel group, OMS or channel runs),
the nine limits with figure, state and why (a limit left out or with no cause is never shown met), readings apart, the
largest differences in four lists (each order opens its stored run; marked by select), rulings to write, "accept this
reading" offered only when nothing is "cannot be read yet". No riyal sum, no green, no red; no new hand-written control
(core `Button`/`Select`/`Input`/`Textarea`/`Chip` only); en and ar keys.

Not built (outside this ticket's list): the drawer's two plans side by side with their sum parts (BO 4283 decision 14);
the promise figures under the set beside it are plain, not drills, since the orders door reads the candidate set.

Proof: `trials-model.test.ts` (23) and `bar-model.test.ts` (16) green, plus two Breakdowns cases for the extra column;
`npm test`, `typecheck`, `lint` green; `tools/sourcing-results-drive.mjs` on Edge (`PLAYWRIGHT_CHANNEL=msedge`), LTR and
RTL, 295/295.
