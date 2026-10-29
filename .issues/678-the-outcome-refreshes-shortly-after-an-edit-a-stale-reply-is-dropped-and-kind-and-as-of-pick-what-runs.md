---
status: open
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

- [ ] `latestWins` — of two in-flight runs, the older one's answer arriving last is dropped; edits inside the window
      make one request — pure (fake timers)
- [ ] `asOfText` — a local date-time prints as `yyyy-MM-ddTHH:mm:ss` with no `Z` and no offset; the default is now — pure
- [ ] `verdictView` — guard, coverage and category verdicts each become their tab-B rows, and an absent verdict
      reads as none — pure
- [ ] drive (extend `insurance-playground-drive.mjs`): type, wait, and the outcome refreshes with no Run; a stubbed
      slow first reply is dropped; switch to category and see tab B's categories — flow

## Boundaries

Same door as 677: the coverage/category body is BackOffice 3245. No new namespace.

## Done when

An edit refreshes the outcome on its own, a stale reply never overwrites a newer one, and all three kinds show their
tab B. Drive green; vitest green.

## Blocked by

[677](677-a-guard-experiment-typed-as-json-runs-through-playground-evaluate-and-shows-the-matched-lines-or-nothing-matched-and-the-trace.md)
