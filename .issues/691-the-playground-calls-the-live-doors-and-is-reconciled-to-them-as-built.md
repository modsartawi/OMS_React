---
status: open
spec: BO 3243 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3243-oms-react-rule-playground-brief.md; doors BackOffice 3244-3252)
blocked-by: 676, 677, 678, 679, 680, 681, 682, 683, 684, 685, 686, 687, 688, 689, 690
---

# 691 — The playground calls the live doors and is reconciled to them as built

## What to build

**Live doors.** This is blocked on BackOffice 3244-3252 landing and being deployed, as well as on every playground
ticket.

- Reconcile every shape against the doors **as built**. The brief's **Changes** section is where BackOffice records
  drift: walk every dated line and every shape guess the earlier tickets left in their `## Comments`. That covers:
  - the verdict per kind (678);
  - `reference` / `payer` (683);
  - the Flatten body (685);
  - `reads` (686);
  - the `PLAYGROUND_*` codes.
- **The grant gate:** the menu leaf shows only with `BackOfficeScreen[InsuranceRulePlayground, 01]`, through whatever
  door BackOffice provides (open question from 677). A session without it still gets the bare 403 said in words.
- Re-run every lesson's **Check** on the live door (689's open question). Lesson 6 must give the owner the answer to
  the "limit of 10,000" question.
- A live drive, read-only by construction (the doors write nothing), against a dev/staging SIS.Api. Then the owner
  walk.

## Spine reach

model/api (reconciled shapes) · store/logic · component (gate) · i18n · test (live drive)

## Proof (→ `tdd` red-green cycles)

- [ ] every pure test still green after the reconcile, with changed shapes covered by new cases — pure
- [ ] live drive against SIS.Api: guard, coverage, category, raw, flatten and the nine lessons — flow
- [ ] owner walk on the deployed host — app action

## Boundaries

Live `POST InsuranceRules/Playground/Evaluate`, `POST InsuranceRules/Playground/Flatten` and
`GET InsuranceRules/Fields`. The grant seed (`INSURANCE_RULE_PLAYGROUND`) is run by the owner.

## Done when

The live drive is green and the owner has walked the page. The brief's Changes are all reconciled, and the leaf is
gated.

## Blocked by

All of 676-690; BackOffice 3244-3252 deployed.

## Open questions

- Which door answers the playground grant for the menu leaf (a new `Playground/Access` probe, or a flag on the
  insurance probe of 618)? If nothing is built, file it as a BackOffice ask.

## Comments

- 2026-10-30 — **first live walk** (BackOffice `pricing2` + `walk3243`, SIS.Rules 1.0.28, local SIS.Api, ADMIN wildcard), driven in Chrome:
  - BackOffice fixed on its side (brief Changes, 2026-10-30 live walk): a rule with no `state` reads as a draft (every
    experiment answered `rules[0].state` is required); a line with no `quantity` reads it unknown (lesson 9).
  - Reconciled here: patient = `{ birthDate, gender: 'M'|'F' }` (no `idType`: the engine derives it from
    `request.patientKey`); a history event is `{ eventType, at: 'yyyy-MM-ddTHH:mm:ss', … }` (not `on`); the reference
    tables are `sfda` and `formulary` (no `mapped`); lesson 8's first block is a formula on `$line.item` (a line check
    has no `item` field).
  - Live: guard / coverage / category, raw intake, Flatten (object and pasted text, `PLAYGROUND_SOURCE`), the read log,
    a declared line field, `count` over `request.lines`, and **all nine lessons' Check met**. Lesson 6 answers the
    owner's question: 10,000 is the approval limit.
  - Still open: the grant gate for the menu leaf (open question), the remaining `GUESS (691)` shapes (coverage payer),
    a drive script against the live door, and the owner walk on the deployed host.
