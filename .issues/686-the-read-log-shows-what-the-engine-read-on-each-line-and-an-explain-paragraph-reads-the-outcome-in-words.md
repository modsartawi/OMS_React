---
status: open
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

- [ ] `readsView` — raw → parsed; missing; derived; an eligibility fact read on two lines shows one value; a
      request-scope field carries `noLiveSource`; empty reads → "none from the door" — pure
- [ ] `explain` — a matched rule, a false block and an unknown block (from a missing read) each give their sentence
      keys and values; the en and ar keys it builds exist — pure
- [ ] drive: a stubbed reply with reads shows the log and the paragraph, LTR + RTL — flow

## Boundaries

BackOffice 3251 (read log). No new namespace.

## Done when

The read log and the explain paragraph show what the engine saw, in both languages. Vitest and drive are green.

## Blocked by

[677](677-a-guard-experiment-typed-as-json-runs-through-playground-evaluate-and-shows-the-matched-lines-or-nothing-matched-and-the-trace.md)
