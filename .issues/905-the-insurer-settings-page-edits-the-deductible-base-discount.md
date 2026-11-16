---
status: done
spec: BO 3946 (C:\Work\DMSCO\BackOffice\.issues\3946-bupa-care-connect-takes-its-deductible-of-a-fixed-base-spec.md)
blocked-by: BO 3949
---

# 905 — The insurer settings page edits the deductible-base discount

## What to build

On the insurer settings page (617), a new field, "Deductible-base discount %", read and written
through BackOffice ticket 3949's endpoint:

- 0–100, validated client-side with the server's message shown when the server refuses;
- an English and Arabic label and help text saying it is the % off the gross that the patient's
  deductible is taken of, that 0 means the normal base, and that it is **not** the fixed discount;
- **no** "inherited from *" hint for this field: it is never inherited.

## Spine reach

UI → BackOffice SIS.Api insurer settings endpoint.

## Proof

- [x] A page test: the field loads, saves, and shows a refusal for 120. (RTL not installed: pure `settings.test.ts` (`deductibleBaseRange` for 120/−1, `readSettings`, the log word) + `insurance-coverage-drive.mjs` §905, ltr and rtl)
- [x] Driven against a stub of the 3949 contract. (`insurance-rules-stubs.mjs`: the field, its default 0 on PUT, 3949's exact 400 message; drive 190/190)

## Boundaries

oms-react only. The endpoint contract comes from BO 3949.

## Done when

The insurance team can set Bupa Care Connect's value to 5 from the page and see the change logged.

## Blocked by

BackOffice 3949.

## Comments

**2026-11-16 — done (stubbed; live walk owed on a host with BO 3949 deployed).** Field "Deductible-base discount" (%)
in the Contract card, with its own help (the % off the gross, 0 = the normal base, not the fixed discount, never
inherited); the page-wide inherit hint names it as the one exception. 120 is refused in words before the PUT; a refusal
HQ makes anyway is shown in HQ's words (driven by forcing 3949's 400, since the page never sends 120). Setting Bupa to 5
PUTs it and logs "Deductible-base discount (%) from 0 to 5". `readSettings` defaults an omitted field to 0 (3949's
default), so a host without 3949 does not lock Save (code-review find). Typecheck, build, 10774 tests green; lint's
other four gates green, the boundary gate red on pre-existing `aliases/door-shapes.test.ts` (e9243c46), not this diff.

**Open ruling:** the field stays editable on the estate `*` row, where 3949 makes its value inert. Hide it there? Not
done without a ruling. CONTEXT.md has no "deductible base discount" entry yet (CONTEXT.md carries unrelated local edits).
