---
status: done
spec: 209
blocked-by: 217
---

# 218 — The agent's five money inputs reach the request, and nothing else is editable

## What to build

Nobody computes money in the browser. The engine computes all of it, and the agent supplies
**five inputs** — and the screen's job is to make exactly those five editable and everything else
plainly read-only.

**Editable:**

1. **Header deductible rates and their caps.** Inherited from the coverage and then correctable —
   one edit re-prices the whole request through the engine, so the line amounts stay derived rather
   than hand-set. The correction is precisely what the audit trail exists to catch.
2. **Header paid-outside**, three fields inside the same block. Included *and persisted*, because a
   stored cap of 300 cannot otherwise be distinguished from a 500 cap with 200 already spent — and
   the agent's input is exactly the part that would vanish.
3. **Line quantity** (already landed in [217](217-a-live-engine-session.md)).
4. **Line Max Coverage**, an editable cell. It writes the engine's payer-share cap so the deductible
   stays derived; it can re-bucket sibling lines, because per-group caps share a pool.
5. **Line Days Supply.** The header default stamps each line as it lands; per-line editable;
   **validated 1–100 at the cell**.

Plus **Selection Reason**, a code and not an amount: a select **disabled on generic lines only** —
exactly the rule the till applies, no broader.

**Read-only, and visibly so:** unit price, extended price, amount, net, VAT, discount, patient
share, calculated deductible, deductible group. The agent corrects the *insurance* terms, never the
merchandise or its price. There is no item swap and no price or discount override.

Two rules worth stating where they apply rather than discovering later:

- **Days Supply validated at the cell** means an out-of-range value can never exist. The old screen
  swept them at submit, silently resetting to the header value and then listing them in a warning —
  that sweep and its dialog are **deleted, not ported**, and the web can never hand the service a
  value it throws on.
- **A cap of zero will not apply.** The engine silently ignores it, so the cell must say so rather
  than accept a value that will quietly do nothing. This is an inherited asymmetry, not a bug to fix
  here.

## Spine reach

model/api (three insurance verbs) · store/logic (the line-rules module: which cells are editable,
the 1–100 range, generic-only disabling, the zero-cap warning) · component/route (the editable rate
block and the grid's editable cells) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `onlyFiveInputsAreEditable` — the module's editability map admits exactly the five (plus
      Selection Reason) and refuses every derived field · pure
      (`src/features/nphies/authorizations/line-rules.test.ts`)
- [x] `daysSupplyOutsideOneToOneHundredCannotBeEntered` — rejected at the cell, so no sweep exists
      anywhere · pure
- [x] `selectionReasonIsDisabledOnGenericLinesOnly` — enabled on every other category, including the
      ones that look like they should be excluded · pure
- [x] `aZeroCapWarnsRatherThanSilentlyDoingNothing` · pure
- [x] editing a rate re-prices every line; editing a cap re-buckets siblings · flow (Playwright,
      `tools/nphies-authorization-session-drive.mjs`, **92/92**)

**Verified:** 1002 vitest tests green (22 new) · session drive 92/92 against stubbed envelopes
(SIS.Api down, all three verbs unbuilt) · the two earlier Nphies drives re-run 121/121 and 108/108 ·
`npm run typecheck`, `npm run lint` and `npm run build` clean. Twelve decisions in
`.afk/HITL-218.md`.

## Boundaries

**Server dependency (SIS.Api):** three insurance verbs — set insurance (rates, caps, paid-outside),
update line insurance (bucket at scan, cap on override), update line meta (days supply, selection
reason) — plus **one new schema column** to persist paid-outside.

**A quirk to carry deliberately, not fix.** On a brand-IR line the agent may pick a selection reason
and the Nphies service overwrites it at submit with its own value; it also blanks the field entirely
for certain items. The old screen behaves identically. Reproduce it and say so in a comment, or
someone will "fix" it and change what reaches the payer.

**Audit note:** the money is recorded before-and-after; days supply and selection reason persist
their **final value only**, which the owner has accepted. Do not build change-tracking for those two.

## Done when

Exactly five inputs plus Selection Reason are editable, every other money field is read-only, days
supply cannot be set out of range, a zero cap warns, and a rate edit re-prices the request — drive
green.

## Blocked by

[217](217-a-live-engine-session.md) — there is no line to price and no header to set until the
session exists.
