---
status: done
spec: 766
blocked-by: —
---

# 767 — An analytics view opens at /analytics/view/:id and draws its bar chart behind the Analytics probe

## What to build

**Slice 0, the tracer bullet.** It proves the whole spine against the proposed wire and the new
chart wrapper before anything else is built on them.

- **The area.** A new area folder `features/analytics/` with its first feature `boards`, and the i18n
  namespace `boards` in `en` and `ar`, registered centrally. It gets the `/analytics/view/:id` route
  and an Analytics menu group. The menu entry's `accessProbe` is `GET Analytics/Access`
  (`canView`), and absent or unreachable means denied.
- **The `api` module** wraps `Analytics/Access`, `Model`, `Item/{id}` and `Query`, with their models
  (766 §C). Each call goes through `@/core/api`.
- **`core/charts`, the only place Recharts is imported:**
  - Recharts 3 pinned to an exact version;
  - `--chart-1…5` tokens in light and dark, with the values from
    `docs/research/741-recharts-for-native-charts.md`;
  - the `dir="ltr"` box, with mirroring only through props (`XAxis reversed`, y-axis on the right),
    commented as a logical exception;
  - ink-coloured ticks, gridlines and legend text;
  - `Intl` formats by unit;
  - the **per-panel loading frame**: the previous chart dimmed, a spinner, the indeterminate top bar,
    the "Updating…" label and `aria-busy`.
- **The colour-slot rule:** channel groups and countries have fixed slots, and any other breakdown
  uses the definition's saved member → slot map.
- **The result → view model** pure module.
- **The page** renders one view, a vertical bar of one measure × one category. It uses TanStack
  Query with `placeholderData: keepPreviousData`, and shows "data as of" from `dataAsOf`. A model
  label is shown in the active language. `ANALYTICS-404` shows a not-found state, and
  `ANALYTICS-401` the no-access state.

## Spine reach

model/api · store/logic (view model, colour slots) · component/route (`core/charts`, view page, menu) · i18n (`boards` en+ar) · test

## Proof (→ `tdd` red-green cycles)

- [x] `result → view model: a channel keeps its fixed slot when other channels are filtered out` · pure (vitest)
- [x] `result → view model: a breakdown's saved member→slot map is honoured and a new member takes the next free slot` · pure (vitest)
- [x] `analytics wire: each of ANALYTICS-401/404 maps to its i18n key, an unknown code falls back to the server message, absent arrays read as empty` · pure (vitest)
- [x] `the view page draws the bar under en, ar (mirrored) and dark, and the probe hides the menu item when absent` · flow (Playwright, `tools/analytics-drive.mjs`, stubbed envelopes)

## Boundaries

New area `analytics`, namespace `boards`, new route and menu group behind `Analytics/Access`. New dependency: `recharts` (exact pin). New `--chart-1…5` tokens (the contrast and colour-literal gates must stay green). Stubbed: the wire is spec 766 §C, owned by BackOffice 3378 (a `400` on the first live call is a drift report).

## Done when

The drive shows the bar view drawn from a stubbed `Analytics/Query` in en, ar and dark, and the three pure tests are green.

## Blocked by

None — can start immediately.

## Outcome

Built on `impl/766-767`. Pure: `view-model.test.ts` (3), `wire.test.ts` (2), `menu-analytics.test.ts` (3).
Flow: `tools/analytics-drive.mjs` 58/58 against `tools/analytics-stubs.mjs` (en, ar, dark; probe absent and
`canView:false`; 404 and 401 states). Recharts pinned at **3.10.1**.

Rulings made while building (overrulable):
- **The definition shape** is the web's proposal (`AnalyticsViewDefinition` in `core/models/analytics.ts`:
  `chart`, `query` mirroring `semantic_query`, `slots`) — §C does not fix one. BackOffice 3378 owns it.
- **Fixed slots** = a dimension served with inline `values` (channel group, country), by catalogue order.
- **`/analytics`** gets an empty-state home now, so the menu leaf never opens a missing route; 770 replaces it.
- **Menu position:** the Analytics group sits after Reports, not last — the Campaigns, Deliverect,
  HungerStation and Insurance-rules tests pin the groups from Pricing on by position.
- **Light `--chart-2`** (gold, 2.83:1 on white) is the research's documented WARN; the contrast gate holds it
  in dark only, the other four slots in both themes.
- An **absent probe** (404) reads as ScreenGate's "can't be reached" card; a `canView:false` as the denial.
  Both deny and hide the group.
