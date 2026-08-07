---
status: done
spec: 249
blocked-by: —
---

# 250 — `money.ts` graduates to `@/core` on its second consumer

## What to build

**Prefactor. "Make the change easy, then make the easy change."**

The collection screens are the second consumer of Loy's money formatter, and a feature may not import
a feature. So `features/loy/member/money.ts` **moves up to `@/core/money.ts`** and Loy imports it from
the new home — exactly as `core/ui/pager.ts` graduated at ticket 232 when it acquired its second
consumer.

Nothing about the behaviour changes. What moves is already correct and is the reason it graduates
rather than being rewritten:

- `currencyDecimals` — KSA + Bahrain, with BHD the estate's only 3-decimal currency.
- Fixed `en-US` grouping, so two readers never see the same line formatted differently.
- **Blank, not `0.00`**, for a missing figure — "no value" and "zero" stay distinguishable.
- The sign left as the row's own.

This is a pure move: no new capability, no call-site behaviour change, and no consumer added here.
Ticket [254](254-cash-collections-opens-on-today.md) is what actually consumes it.

## Spine reach

model/logic only — no route, no i18n, no component.

## Proof (→ `tdd` red-green cycles)

- [x] `money.test.ts` moves with the module and stays green **unchanged** — it is the regression net
      for the move, and the fact that not one assertion needs editing is the evidence the move was
      behaviour-preserving · pure
      → `git` reports **similarity index 100%** on `features/loy/member/money.test.ts → core/money.test.ts`:
      not one byte edited, not even the `from './money'` import, which still resolves from the new
      home. 15 tests green (`npx vitest run src/core/money.test.ts`); the whole suite is
      **1224/1224 across 78 files**.
- [x] `npm run lint` passes the import-boundaries gate — no `features/loy/*` import survives in any
      consumer, and nothing under `core/` imports a feature · flow (lint gate)
      → `✓ import boundaries clean (416 files checked)`, all three gates green. `sales-columns.ts` is
      the module's only call site and now reads `@/core/money`.

## Boundaries

No API. No i18n. No nav. Touches an existing shipped feature (`features/loy/member`), so the Loy
member screen must still render its money identically afterwards — verify by driving it, since the
Loy screens have no component tests.

## Done when

`@/core/money.ts` exists, `features/loy/member/money.ts` is gone, `money.test.ts` is green from its
new home with no assertion edited, `npm run typecheck` and `npm run lint` are clean, and the Loy
member screen still renders sales and action money unchanged.

## Blocked by

None — can start immediately.

## What landed

`git mv` of both files to `src/core/money.ts` + `src/core/money.test.ts`, the one import in
`features/loy/member/sales-columns.ts` re-pointed at `@/core/money`, and three stale prose pointers
repaired (the module header's rule link re-depthed, and the two comments in `sales-columns.ts` and
`core/models/loy.ts` that called it "the feature's own `formatMoneyIn`"). **The executable diff of
`money.ts` is empty** — every hunk in it is doc comment.

`npm run typecheck`, `npm test` (1224/1224), `npm run lint` (3/3 gates) and `npm run build` are all
clean. The Boundaries clause — *"the Loy member screen must still render its money identically
afterwards — verify by driving it"* — was discharged with `tools/loy-member-drive.mjs` against a
vite server on :5199: **184/184 passed**, including the Sales-tab money scenarios (SAR at 2 dp, BHD
at 3, a return line keeping its own sign, a missing figure blank rather than `0.00`).

The header's rationale now reads the move as a **prefactor** landed one slice ahead of the consumer
that licenses it, naming [254](254-cash-collections-opens-on-today.md) as where the second call site
actually arrives — the earlier wording claimed a second consumer the tree does not yet contain.
Placement question (`core/money.ts` as the ticket writes it, vs `core/util/money.ts` beside its 2-dp
twin) logged in `.afk/HITL-250.md`; the ticket's own address won.
