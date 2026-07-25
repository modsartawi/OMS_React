---
status: done
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

- [x] `aggregateConditions folds rows sharing type, rate, unit and origin into one summed group` — base and value summed, `count` correct, `subs` carries the raw rows · **pure**
- [x] `aggregateConditions numbers non-statistical groups before statistical ones` — the two-pass index, on a fixture holding both · **pure**
- [x] `aggregateConditions keeps distinct non-empty bbyNumbers and survives empty input` — de-duplication, blank rejection, and the `null`/`undefined`/`[]` guard · **pure**

Landed as `src/features/pricing/simulation/aggregate.test.ts` (14 cases under the three named
describes) over a new `src/features/pricing/simulation/__fixtures__/payloads.ts`, which imports the
nine ticket-098 captures that carry a `data` block. `npm test` 152 passed / 7 files; `typecheck`,
`lint` and `build` green. `aggregate.ts` is byte-for-byte unchanged.

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

## Comments

**Corpus gap: no capture is statistical.** Not one of the 098 payloads carries `isStatistics: true`
(nor a `H`-origin row) — origins across the corpus are only `A`, `B` and `M`. So the two-pass index
cannot be proved on a capture as-is. The test builds the case by spreading captured rows and
flipping the flag, with the deviation stated at the call site; the same technique covers the
space-in-a-field key collision and a second distinct `bbyNumber`, neither of which the corpus holds
either. Worth a statistical/`H` scenario next time `tools/sim-payload-capture.mjs` runs — 103's
`STAT` key rides on a flag no live capture has yet exercised.

**Behaviour recorded, not changed.** Two facts the tests pin that were implicit before:

- A group's `isStatistics` (and `description`, `conditionRate`, `badge`, `category`) comes from the
  **first** row of the group — flagging only the second row of a fold leaves the group
  non-statistical. That is the WPF `GroupBy(...).Select(g => g.First())` shape, so it is the
  contract, but 103 should know the flag is first-row-wins, not any-row-wins.
- `isBonusBuy` is the one field that **ORs** across the fold rather than taking the first row.

**Mutation-checked.** Collapsing the two-pass loop into one pass fails exactly the two index tests
and nothing else — the net bites where it claims to.

**Concurrent session.** The working tree also held an in-flight `112` (bonus-buy move to `core/`)
while this ran; the commit is limited to this ticket's two new files and the ticket/INDEX edits.
