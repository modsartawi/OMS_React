---
status: done
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; stories 3, 22, 23, 42, 44)
blocked-by: 677
---

# 678 — The outcome refreshes shortly after an edit, a stale reply is dropped, and kind and "as of" pick what runs

## What to build

- **Auto-run:** about 500 ms after the last edit to data, rule, kind or "as of", the experiment runs by itself, and
  the Run button goes. An older request that answers after a newer one is **dropped** (latest-wins by a request
  sequence, not by arrival). The outcome shows a quiet "running…" while a request is in flight, and keeps the last
  good outcome visible meanwhile. JSON that does not parse does not run.
- **Kind picker:** guard, coverage or category, per experiment. Switching kind seeds that kind's empty document and
  example data. A coverage experiment's data carries the `payer` block.
- **"As of":** a date-time input, default local now, sent as local text with no `Z` (`yyyy-MM-ddTHH:mm:ss`), shown
  isolated (`Ltr`).
- **Outcome tab B, "What the live check would say":** the reply's `verdict`, drawn per kind:
  - guard: per line, the outcome and the fired rules;
  - coverage: the result per line and for the invoice;
  - category: each line's category, group, source and the rule that set it, plus its unknowns.

  Money goes through `formatMoney`, and codes and numbers through `Ltr`.

The verdict view models are pure. They are written against the brief's shapes and reconciled in 691.

## Spine reach

model/api (verdict types per kind) · store/logic (latest-wins runner, as-of text, verdict view models) ·
component (kind picker, as-of, tab B) · i18n (`insurance-playground`, en + ar) · test

## Proof (→ `tdd` red-green cycles)

- [x] `latestWins` — of two in-flight runs, the older one's answer arriving last is dropped; edits inside the window
      make one request — pure (fake timers)
- [x] `asOfText` — a local date-time prints as `yyyy-MM-ddTHH:mm:ss` with no `Z` and no offset; the default is now — pure
- [x] `verdictView` — guard, coverage and category verdicts each become their tab-B rows, and an absent verdict
      reads as none — pure
- [x] drive (extend `insurance-playground-drive.mjs`): type, wait, and the outcome refreshes with no Run; a stubbed
      slow first reply is dropped; switch to category and see tab B's categories — flow

## Boundaries

Same door as 677: the coverage/category body is BackOffice 3245. No new namespace.

## Done when

An edit refreshes the outcome on its own, a stale reply never overwrites a newer one, and all three kinds show their
tab B. Drive green; vitest green.

## Blocked by

[677](677-a-guard-experiment-typed-as-json-runs-through-playground-evaluate-and-shows-the-matched-lines-or-nothing-matched-and-the-trace.md)

## Comments

- 2026-10-30 (678 built, branch `impl/3243-678`). vitest: `run.test.ts` (latestWins 6 + asOfText 3, fake timers),
  `verdict.test.ts` (7), seeds in `experiment.test.ts` (+2), keys in `i18n-keys.test.ts` (+1). Drive
  `tools/insurance-playground-drive.mjs` 116/116 (LTR + RTL; 677's steps now wait on the auto-run, no Run button).
  Stub `// --- 678 ---` `playgroundVerdict(body, reply)` adds the verdict per kind; the slow reply is the drive's own
  route delay (`slow` queue in `open()`), not a stub option. typecheck, lint, test, build green.
- **Layout for later tickets:** `run.ts` — `latestWins({ delayMs, run, onStart, onSettle })` → `{ edit(body|null),
  dispose() }` (latest-wins by a request sequence; `edit(null)` = JSON that does not parse: sends nothing, drops the
  waiting body, keeps the last good outcome) and `asOfText(Date|string, now)`. `verdict.ts` — `verdictView(kind,
  verdict)` → `none | guard | coverage | category`. `VerdictPane.tsx` draws it. `OutcomePane` takes `{ view, verdict }`
  and owns the A/B tab state (`data-tab="saw" | "live"`); Tab A's insides (`Saw`, `ReaderErrors`) are untouched — a
  reader error shows alone in BOTH tabs. `experiment.ts` — `kindSeed(kind)` (guard = 677's seed).
  The page keeps `kind` and the answer's kind separately: Tab B reads the verdict as the kind it was ASKED for.
- **Shape guesses for 691:** guard verdict `[{ line, outcome, fired: [{ ruleId, severity, en, ar }] }]` (3134's
  `GuardCheckLine`; a fired rule as a bare id is read too); coverage `{ lines: [{ line, covered, priorApproval,
  deductiblePercent, deductibleMax, priceCap, quantityCap, daysSupplyCap }], invoice: { segment,
  exceptionPrescriptions } }`, each `{ value, source: payer|rule|ruleOverridesPayer|none, ruleId }` (BackOffice's
  `CoverageLineReply`; a `deductible: { value: { percent, max } }` is unfolded, a bare value has no source);
  category `[{ line, category | insuranceItemCategory, group, source: rule|default|none, ruleId, unknowns }]`. A list
  may come bare or as `{ lines }`. Coverage `payer` seeded as `{ deductibles: { G1|G2|G3: { percent, max } } }`
  (the engine's `CoveragePayer.Deductibles`) — a guess. The category seed's data has no item default category: 3245
  says it "comes from the experiment's data" but names no field.
- **Decisions (overrulable):** switching kind seeds a starter document with ONE example rule (C-1 quantity cap,
  K-1 setCategory G2), not an empty `rules: []`, so Tab B has something to show; it overwrites both boxes. "As of"
  defaults to the moment the page opened; a cleared input falls back to that moment (never a moving now, which would
  re-run forever). A failure replaces the outcome until the next good answer; "running…" shows only once there is
  something to keep. `run.run` ("Run") removed from both locales.
