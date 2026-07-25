---
status: open
spec: 110
blocked-by: —
---

# 111 — `aggregateConditions` holds its grouping contract under test

## What to build

**Prefactor, not a vertical slice.** A safety net under the one pure module the rework is about to
lean on much harder, put in place *before* anything moves.

The condition aggregator is the client-side port of the WPF controller's grouping. It is pure, it is
the module the line expansion's rule list is built from, and it currently has **no tests at all**.
[103](103-sim-deep-layers-placement.md) makes it the **sole** producer of that rule list and makes its
`isStatistics` flag load-bearing for the new `STAT` key — so its blast radius grows while its coverage
stays zero. [109](109-sim-i18n-churn-and-test-seams.md) named it the one seam testable *today*, with no
rework in place.

Cover the behaviour the WPF port promises, through the module's public functions only:

- Raw condition rows sharing (type, rate, unit, origin) fold into **one** group, with base and value
  **summed** and `count` counting the rows folded in.
- Rows differing in **any** of the four key parts stay separate — including the case the unit-separator
  key exists to defend: a field containing a space must not collide with a different tuple.
- Groups keep **first-appearance order**.
- The **two-pass index**: non-statistical groups are numbered first, statistical ones after.
- `bbyNumbers` collects **distinct, non-empty** bonus-buy numbers across the group's rows.
- `isStatistics` and the origin-derived badge/category survive the fold intact.
- Empty, `null` and `undefined` inputs return an empty list rather than throwing.

Use the captured live payloads under `.issues/assets/098-simulate-payloads/` as fixtures rather than
hand-built objects — the map's standing evidence rule, and the reason an earlier effort's synthetic-data
work had to be thrown away.

**Do not change the module's behaviour.** If a test disagrees with the code, the code is the WPF port
and wins; record the surprise in this ticket rather than "fixing" it. One exception is already known
and belongs to [116](116-sim-line-expansion.md), not here: `countStatistical` loses its only call site
when the statistical toggle retires, and is deleted there.

## Spine reach

store/logic · test

(Deliberately no component, route or i18n reach — this is the prefactor exception. It is named as such
so it is not mistaken for a tracer bullet.)

## Proof (→ `tdd` red-green cycles)

- [ ] `aggregateConditions folds rows sharing type, rate, unit and origin into one summed group` — base and value summed, `count` correct, `subs` carries the raw rows · **pure**
- [ ] `aggregateConditions numbers non-statistical groups before statistical ones` — the two-pass index, on a fixture holding both · **pure**
- [ ] `aggregateConditions keeps distinct non-empty bbyNumbers and survives empty input` — de-duplication, blank rejection, and the `null`/`undefined`/`[]` guard · **pure**

Runs on the existing `vitest` tier (`environment: 'node'`, `src/**/*.test.ts`), bootstrapped by ticket
090. Prior art: the document feature's five pure test files, built under the same ruling.

## Boundaries

No API, no i18n, no nav, no new runner — `vitest` is already installed. **React Testing Library is not
installed and this ticket does not install it** (spec 110, owner-confirmed).

## Done when

The three named tests are green under `npm test`, using 098 captures as fixtures, with
`aggregate.ts`'s behaviour unchanged.

## Blocked by

None — can start immediately.
