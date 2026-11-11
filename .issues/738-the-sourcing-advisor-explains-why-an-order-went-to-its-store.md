---
status: done
spec: 734
blocked-by: —
---

# 738 — The sourcing advisor explains why an order went to its store

## What to build

This is the sourcing advisor's tracer bullet (spec 734 D15, D17, D18, D20, D21). A user granted
`canView` opens `/oms/sourcing-advisor/order/:orderNo` and sees:
- **The order:** delivery type, city and promised time.
- **Actual against cheapest.** The store that filled it and the cheapest on-time candidate, side by
  side, each with km, estimated cost, ready and travel minutes, and on-time state.
- **The saving**, in SAR, with the reasons as i18n sentences built from the reason codes.
- **The candidate table:** up to 15 rows, each with cost parts (courier, pick, split, express),
  on-time state, and stock evidence ("recorded" or "estimated").
- **A "placeholder rates" banner** whenever `placeholderRates` is true, so nobody quotes those SAR
  figures.

Two more things:
- The delivery details page gets a **"Why this store?"** link to this view, shown only when the
  advisor probe allows it.
- The advisor gets one menu item under the OMS group, gated by the same probe.

The probe fails closed. It lives in `@/core/` (a sourcing-access module beside `core/oms/api`), so
the `oms/document` feature can gate its link without importing the advisor feature.

## Spine reach

model/api (`core/models/sourcing-advisor`, probe in `core`, feature `api.ts`) · logic (explain view
model) · component/route (explain page, delivery-details link, menu item) · i18n (`sourcing-advisor`
namespace) · test

## Proof (→ `tdd` red-green cycles)

- [x] `sourcingExplainModel_buildsActualBestAndCandidates`:
  - cost parts sum to each candidate's cost as shown;
  - an unknown on-time state is never shown as a saving;
  - reason codes map to keys, and an unknown code falls back;
  - absent lists are read as empty;
  · pure
- [x] `sourcing-advisor-drive: explain-one-order`: covers all of:
  - no menu item and no link without the grant;
  - the link from delivery details opens the explanation;
  - the placeholder banner;
  - `SOURCING-403` for an order that is not scored;
  - RTL (`code · name` pairs and km/SAR as `Ltr`);
  · flow

## Boundaries

- New doors `SourcingAdvisor/Access` and `SourcingAdvisor/Explain` (BackOffice BO-2, unbuilt).
  Build against stubs of exactly the D20 wire.
- New namespace `sourcing-advisor`, a route under `/oms/`, and a menu item with an `accessProbe`.
- Touches `features/oms/document` only for the link and its core probe.

## Done when

The pure test and the drive scenario are green, and typecheck, lint and test pass.

## Blocked by

None — can start immediately.

## Open questions

- **S2 (owner, with finance):** the real rates. This slice ships on placeholders, and the banner
  must stay until the rates arrive.

## Resolution

Built 2026-11-03 on `spec/734-ask-the-oms` (commit 1a61095c; review fixes in ed0e3911). All proofs pass against stubbed envelopes; the live walk is [740](740-ask-the-oms-and-the-sourcing-advisor-work-live-on-staging.md). Drives: copilot 177/177, sourcing advisor 100/100; 8,536 unit tests pass; lint shows only the 4 boundary violations already on main (insurance-rules aliases).
The review fix changed one proof assertion: a candidate now shows the door's `cost` as sent, and its parts as sent, with a missing part shown as "—". The screen no longer sums the parts. Spec D20a is amended to match.
