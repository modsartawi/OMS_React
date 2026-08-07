---
status: open
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

- [ ] `money.test.ts` moves with the module and stays green **unchanged** — it is the regression net
      for the move, and the fact that not one assertion needs editing is the evidence the move was
      behaviour-preserving · pure
- [ ] `npm run lint` passes the import-boundaries gate — no `features/loy/*` import survives in any
      consumer, and nothing under `core/` imports a feature · flow (lint gate)

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
