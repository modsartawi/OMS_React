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
