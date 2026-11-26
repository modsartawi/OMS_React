---
status: done
spec: BackOffice 4354
blocked-by: BO 4379, BO 4363, BO 4366, BO 4386
---

# 965 — Why this plan: the promise in parts, the money, how deliveries go at the store, and why not another store

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- The tab "Why this plan", top to bottom:
- the promise, in parts: a bar per Dawaa Now shipment (made ready, courier wait, travel, margin, each with its source), the pick end, the usual time beside it, lengtheners marked "adds nothing" where so; a slot shipment lists the slots skipped and why, which rule set its pick end, and its next two slots with the mark when a later one was cheaper;
- the money: a row per part, a column per shipment, every rate with its source, and a banner naming the assumed ones;
- how deliveries go at this store: a row per measure against like stores, with the deliveries behind it and its cost or credit. Never the words "fault", "performance" or "rating";
- why not another store: pick a store and get, per mode, the rule that removed it or the best plan that uses it and what it would cost more.
- A line planned on a short stock figure shows its plain sentence with its own chance ("About 8 in 100 such lines are not handed over at this store"), never "out of stock".
- The tab "What the run used": every factor with how it enters, whether it ran on real data, a neutral default or an assumption, or was switched off, and its source; four counts on top. The marks of the run ("straight line", "assumption", "no location", "list fee", "range not confirmed", "figures as read at {time}").

## Spine reach

oms-react: page / models / locales / tests

## Proof (→ `tdd` red-green cycles)

- [x] `promise-bar-model.test.ts` — the parts, their sources and the pick end from a reply · vitest (`npm test`)
- [x] `money-rows-model.test.ts` — rows per part, columns per shipment, the assumed banner · vitest (`npm test`)
- [x] `why-not-model.test.ts` — a removed store gives its rule; a standing one gives the extra cost by part · vitest (`npm test`)
- [x] `used-factors-model.test.ts` — the four counts and the list · vitest (`npm test`)
- [x] `tools/sourcing-simulator-drive.mjs` — open both tabs on a split plan, in both languages · Playwright drive, run by hand against stubs

## Boundaries

—

## Done when

The model tests are green and the drive passes.

## Blocked by

[962](962-the-simulator-builds-a-cart-runs-it-and-shows-the-plans-as-cards-or-as-one-table.md),
BackOffice 4379 (`.issues/4379-the-run-record-carries-every-figure-the-run-read-at-three-levels-with-a-code-for-every-reason.md`),
BackOffice 4363 (`.issues/4363-the-money-delivery-rates-and-fee-rules-carry-their-source-a-split-charges-a-fee-per-shipment-and.md`),
BackOffice 4366 (`.issues/4366-pick-up-is-promised-its-target-the-three-lengtheners-only-lengthen-and-the-promise-sentence-is-b.md`),
BackOffice 4386 (`.issues/4386-the-store-record-and-the-slot-costs-move-the-choice-between-stores-of-one-mode.md`)

## Comments

**2026-11-27 — built on stubs (done in oms-react; reconcile when BackOffice 4379, 4363, 4366 and 4386 land).** The
middle and full levels' parts do not exist yet. Both tabs are built against BackOffice 4281's worked example, widened
where 4281 names a part without its fields: `src/features/oms/sourcing-simulator/advise-reply.fixture.json` (cost and
promise parts on every shipment — the slot shipment's are 4281's own — more stores with records, a longer `used[]`) and
`split-plan.fixture.json` (a Fastest plan of two Dawaa Now shipments), read by the model tests and the drive alike. When
the four server tickets land, replace the fixtures with a captured reply, rerun the model tests and the drive, and
settle each provisional name below. The BO blockers stay listed for that reason.

What was built:
- Wire types in `src/core/models/sourcing-run.ts` (new section at the end; `AdviseShipment.costParts` /
  `.promiseParts`, `AdviseReply.inputs` / `.used` / `.search` typed).
- Pure models with tests: `promise-bar-model.ts`, `money-rows-model.ts` (money table and store record),
  `why-not-model.ts`, `used-factors-model.ts` (four counts, factor rows, marks of the run), `short-figure.ts`; and
  `why-used-locale.test.ts` (every `why`/`used` key has Arabic; no "fault", "performance", "rating", "out of stock").
- Panels `WhyThisPlan.tsx` (`PromiseParts`, `MoneyTable`, `StoreRecords`, short-figure lines, `WhyNotStore`) and
  `WhatTheRunUsed.tsx`, registered as `why` and `used` in `SimulatorTabs.tsx`. The plan card's short-figure line now
  says the sentence with its own chance (`why.shortFigure.sentence`; the old `card.shortFigure` key is gone).
- Locale sections `why` and `used`, EN + AR. No hand-written controls (core `Select`), no new colours (the bar uses
  `chart-1/3/5` and `ink-3`).

PROVISIONAL (spec 4354: not specified) — every name invented, each marked so in the code:
- Door `GET SourcingAdvisor/WhyNot?runId=&store=&goal=` → `AdviseWhyNot[]` (4281's `search.whyNot[]` row shape), in
  `api.ts`; a run no longer held is read as `ADVISE-404`. The drive stubs it with the reply's own rows.
- Solve mark codes `RANGE_NOT_CONFIRMED` (spec §8, "range not confirmed") and `NO_LOCATION` (4363, "no location").
  "Straight line" reads `kmKind`/`ROAD_NOT_MEASURED`; "list fee" is shown whenever a fee is (spec §6: no waiver modelled);
  "figures as read at" reads `figuresReadAt`.
- `promiseParts.courierWait`, `.travel` (`{usual, cautious, source}`), `.margin` (`{minutes, source}`), `.usualBy`,
  `.target` (pick-up), `.pickEndRule` (`CAUTIOUS_MADE_READY`, `HALF_WAY_TO_SLOT`, `SLOT_START`, `FOUR_HOURS`,
  `STORE_CLOSES`); `slot.next[]` (`{code, from, to, sum}`) and `slot.laterCheaper` (4386's next two slots and its mark).
- Lengthener names `BASKET_LINES`, `HOUR_OF_DAY` (only `DELIVERIES_WAITING` is 4281's); slot skip reason `NOT_ACTIVE`
  (only `INSIDE_LEAD` is 4281's).
- Store record measure names `returned`, `cancelled`, `neverMadeReady`, `calloutIgnored`, `readyLate` (only `late` is
  4281's) and the per-measure `cost`.
- `used[].state` values `NEUTRAL_DEFAULT` and `ASSUMED` (4281 names `REAL_DATA` and `SWITCHED_OFF` only);
  `used[].entersAs` (`FILTER`, `OFFERED_STOCK`, `PROMISE`, `COST`, `RULE`, the model ticket's "role"); every factor code
  but `DELIVERIES_WAITING` and `RIDERS_AVAILABLE`.

Other choices to confirm: the money's plan column holds only the totals sent (`totals.fee`, `totals.companyCost`,
`sum.*`) and leaves the part rows blank rather than adding them up (4281 decision 28); "why not" shows the best plan's
balanced total beside the open plan's and the server's difference by part, never a subtraction of its own; a removal
(`removedAt` + `code`) answers for every goal, a standing pair only for its own goal.

Proof as run: `npm test` (979 files, 12,863 tests), `npm run typecheck`, `npm run lint` green;
`tools/sourcing-simulator-drive.mjs` 102/102 on Edge (`PLAYWRIGHT_CHANNEL=msedge`), LTR and RTL — both tabs on the
split plan, "why not" on a removed, a used and a standing store, the slot shipment and the short-figure sentence. As
for 962, the RTL pass reads English words (the app boots i18next in English); the Arabic of every key is pinned by
`why-used-locale.test.ts`.
