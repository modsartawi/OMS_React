---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 608
---

# 612 — An author simulates a draft on a patient and reads the back-test report

## What to build

**Simulator**: type a request (lines, channel, payer, policy, class, store) and a patient key; see per-line
outcomes and the condition trace with true / false / unknown. **Back-test**: pick 30 / 90 / 180 days, start the job,
follow progress, read fires by severity, the requests it would have stopped (patient key masked), SAR, distinct
patients / stores / pharmacists, and overlap with live guards.

**HQ contract:** the brief's sections for BackOffice 3140. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

components · test

## Proof (→ `tdd` red-green cycles)

- [x] drive (stubbed) — simulate G-007 on a stub patient; read a back-test

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[608](608-an-author-edits-a-guard-from-a-palette-with-nested-all-of-any-of-groups-and-not-severity-e.md)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.

## Comments

**2026-10-27 — built on `impl/3126-612`.** Proof: `src/core/insurance-rules/backtest.test.ts` (running / progress /
current revision / fires heaviest first / `maskedKey`), `simulator/simulate.test.ts` (typed request → the brief's
body, problems per field and line), `simulator/trace.test.ts` (the flat trace laid on the rule's own IF tree: NOT on
its node, unread conditions, entries not in the draft kept aside), `simulator/query.test.ts`, `simulator/i18n-keys.test.ts`
(en/ar mirror), menu test; drive `tools/insurance-simulator-drive.mjs` 92/92 STUBBED (LTR + RTL): simulates G-007 on a
stub patient (body asserted exactly; G-007 OVERRIDE on a GLP-1 pen with its trace true/false/unknown; G-004 REFUSE on
120 days with its suggestion), back-tests 90 days (start body, progress, report tiles, masked keys incl. one sent
whole, overlap, current vs stale revision, reload follows the job), bare 403s. 607's drive still 86/86.
Typecheck, lint and vitest green.

Screen: `/insurance-rules/simulator` (`?tab=simulate|backtest&days=30|90|180&id=`), menu leaf "Simulator". Namespace
`insurance-simulator` (en + ar). Shared: `src/core/insurance-rules/backtest.ts` — `GuardBacktest`, `BACKTEST_DAYS`,
`BACKTEST_STATUSES`, `backtestRunning`, `backtestProgressPct`, `backtestIsCurrent(bt, revision)` (611's Submit gate),
`backtestFires`, `maskedKey`. ⚠️ 611 is adding its own minimal back-test status shape in core in parallel: the merger
keeps ONE (`GuardBacktest` is the full 3140 GET shape). Stubs `// --- 612 ---`: `SIM_PATIENT`, `simulateGuards`,
`backtestReport`, `newBacktestStore`, `simulatorStub` (call before `insuranceRulesStub`).

**Guesses where the brief is silent (618 reconciles):**
- Back-test `status` is `queued | running | done | failed`; `progress` a fraction 0–1; `overlap` a COUNT of its fires
  that a live guard fires on too (shown "n of total fires"). Polled every second while queued / running.
- There is no door listing back-tests, so the job followed is the one in the address (`?id=`); 611 needs a way to
  find the current revision's back-test (a list door, or the draft carrying its last back-test id) — not in the brief.
- A back-test runs the whole draft (the brief's POST takes only `days`); no per-rule back-test.
- `maskedKey` arrives masked (`10••••••83`, 614's stub style); one that arrives whole is masked client-side (2 + 2 digits).
- Trace `value` is read AFTER the block's NOT (the sentence folds NOT in); `why` is read as `{ en, ar }` or one text;
  `blockPath` uses 608's Validate grammar (`when[0].conditions[2]`). A rule only read (not fired) is listed after the
  fired ones, heaviest first; a block or rule not in the draft is shown flat beside the tree.
- Simulate request: blank payer / policy / class are sent as null; `daysSupply` omitted when blank; ICD codes typed
  comma/space-separated, upper-cased; a new line's `unit` starts as `PC` (vocabulary unspelled). Patient key only
  required (format left to HQ); it never enters the address. The fired rule's `codes` / `suggestion` read as 616's
  check shapes.
- Layout follows the prototype's Backtest view (KPI tiles + stopped-requests table); the by-store / by-pharmacist bars
  are not in 3140's shape, so they are not drawn. The insurance team's walk (3096) is still open.

**2026-10-28 — realigned to the BUILT 3140 shapes (`impl/3126r-612`).** The brief's section "HQ contract: simulate
and back-test (3140)" now spells what 612 had guessed. Changed:
- **Simulate body** — each line carries `line` (from 1, typed order); `user` / `dob` / `gender` typed as optional,
  not on the form. **`document` is never sent**: 608's editor keeps its unsaved document in its own page reducer, which
  the simulator (another feature) cannot reach, so HQ runs the SAVED draft. Answer lines are matched by `line`; `fired`
  carries `version`; each line's **`unknowns`** are shown under it (the undecided rules, linked); each rule's
  **`blockPath: "when"`** is read as its whole condition, drawn at the head of its IF tree (`trace.ts` `whole`), never
  set aside. 400s show through `apiErrorMessage`.
- **Back-test** — `GuardBacktest` is the full built shape (`id, status, progress, revision, days, requestedBy,
  requestedAt, finishedAt, error, since, requests, lines, fires, stopped[{ on, store, item, maskedKey, sar, rules }],
  stoppedTotal, sar, distinct, overlap, rules[{ ruleId, fires, stopped }]`); `POST …/Backtests` answers the back-test.
  New tiles requests / lines, a window line (days, since, requested by), "Showing the first n of total" when `stopped`
  is cut, a Rules column on stopped lines, a **By rule** table; a failed one shows HQ's `error`. `overlap` now reads
  "On n of the lines it fired on, a live guard fired too." `maskedKey` fallback = first digit + last two
  (`1*******01`), as HQ masks.
- **Finding the draft's back-test** — `GET …/Backtests` (core `draftBacktestsQuery`, polled while one runs) +
  `draftBacktest(list, revision)` (a done one of this revision, else its newest, else the newest at all). The tab with
  no `?id=` shows it; `?id=` still follows one job (`backtestByIdQuery`). 611's approval panel uses the same pair;
  the guessed `DraftApproval.backtestId` and `draftBacktestQuery(id)` are gone.
- **Submit's 409 `GUARDS_BACKTEST_MISSING`** is shown in words (`insurance-approvals:refused.backtestMissing`) with
  a link to the simulator, and the back-tests are read again (the panel then says out of date).

Proof: `backtest.test.ts` (draftBacktest, stoppedShown, maskedKey), `simulate.test.ts` (line numbers, no document,
lineUnknowns), `trace.test.ts` (`when` → whole). Drives STUBBED: simulator 118/118 (body asserted exactly incl. `line`
and no `document`; whole condition; unknowns; list-found back-test with and without `?id=`; tiles, by rule, truncation,
masked keys), approvals 126/126 (new 1b: 409 in words), 607 86/86. Typecheck, lint, `npm test` (7130) green.
Untouched: the per-line category (`lineCategory`, step 5b — 617 re-points it), class lists (610).

**Guesses still open for 618:** `unknowns` read as rule ids (a `{ ruleId }` object also read); trace `value` read
after the block's NOT; `why` as `{ en, ar }` or one text; back-test `progress` as a 0–1 fraction; the list rows assumed
to carry the full back-test (the panel reads them without a per-id read); `since` / `stopped.on` as `yyyy-MM-dd`.
