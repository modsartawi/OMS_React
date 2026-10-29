---
status: done
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; stories 37-41, 43)
blocked-by: 677
---

# 686 — The read log shows what the engine read on each line, and an explain paragraph reads the outcome in words

## What to build

Outcome tab A gains:

- **The read log per line:** every `reads[]` row (`ruleId`, `blockPath`, `path`, `raw`, `value`, `missing`,
  `noLiveSource`):
  - a registry field shown as **raw → parsed** (`"abc"` → not a number → unknown);
  - a missing fact said as "missing";
  - derived facts (`patient.age`, the supply end date) shown with the value the engine derived;
  - an eligibility fact shown as the **same value on every line**, marked as belonging to the whole request;
  - a request- or patient-scope field read flagged **"no live source: reads unknown at the till"**.
- **Explain this result:** a plain-words paragraph built from the trace and the reads. It names which rule matched or
  not, which block decided, and why a block was unknown (the missing or unparsed read). It is built from `t()`
  sentence keys with values isolated (`fsi` in the interpolations, or `<Trans>` slots), in EN and AR.

`reads` is `[]` until BackOffice 3251. With no reads, the log says the door gave none, and Explain works from the
trace alone.

## Spine reach

model/api (`reads` rows) · store/logic (reads view model, explain builder) · component · i18n (en + ar sentences) · test

## Proof (→ `tdd` red-green cycles)

- [x] `readsView` — raw → parsed; missing; derived; an eligibility fact read on two lines shows one value; a
      request-scope field carries `noLiveSource`; empty reads → "none from the door" — pure
- [x] `explain` — a matched rule, a false block and an unknown block (from a missing read) each give their sentence
      keys and values; the en and ar keys it builds exist — pure
- [x] drive: a stubbed reply with reads shows the log and the paragraph, LTR + RTL — flow

## Boundaries

BackOffice 3251 (read log). No new namespace.

## Done when

The read log and the explain paragraph show what the engine saw, in both languages. Vitest and drive are green.

## Blocked by

[677](677-a-guard-experiment-typed-as-json-runs-through-playground-evaluate-and-shows-the-matched-lines-or-nothing-matched-and-the-trace.md)

## Comments

- 2026-10-30 (686 built, branch `impl/3243-686`). vitest `reads.test.ts` (9) + `explain.test.ts` (7, incl. en+ar keys);
  drive `tools/insurance-playground-reads-drive.mjs` 46/46 (LTR + RTL) on the new `// --- 686 ---` stub
  (`playgroundReadsStub` / `evaluatePlaygroundWithReads`: wraps the 677 evaluator, flattens `line|request|patient.field.K`
  from that scope's `attributes` parsed as a number, adds `patient.age` and every `eligibility` key per line). The 677
  drive stays 64/64 (it now also shows "no read log" + an Explain paragraph). typecheck, lint, test, build green.
- **Layout:** `reads.ts` (`readsView(reply, documentFields)`) and `explain.ts` (`explain(outcomeView, readsView)` →
  `{ key, values }[]`) are pure; `ReadLog.tsx` and `ExplainParagraph.tsx` are their own components, mounted in
  `OutcomePane` after the trace (new optional prop `reads`, default none); the page builds `reads` from `run.data` and
  the SENT document's `fields` (`run.variables`). Keys: `reads.*`, `explain.*` in `insurance-playground` (en + ar).
- **Shape guesses for 691:** derived paths are exactly `patient.age` and `line.supplyEndsOn` (3248); a field path is
  `(line|request|patient).field.Key` (ADR 0117); eligibility paths start `eligibility.`. A read whose value is null
  with `missing:false` is shown missing unless it is a field with raw text (then "did not parse → unknown", naming the
  type from the document's `fields` block when declared). An eligibility value `{ type, number, unit }` reads its typed
  member + unit. `noLiveSource` is HQ's flag OR a request/patient field path (belt and braces).
- **Decisions (overrulable):** an eligibility fact's FIRST line value stands for every line (story 40: one value);
  Explain picks per rule the first false top-level block (`when[n]`), else the first unknown, and names the
  missing/unparsed read under that block (prefix match on `blockPath`), else the engine's `why`. "Nothing matched"
  opens the paragraph; no lines / a line with no trace / no read log each have a sentence. Every value goes through
  `fsi` in the `t()` sentence.
