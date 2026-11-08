---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3460-a-qc-callout-measures-its-radius-by-road-spec.md
blocked-by: BackOffice 3472
---

# 858 — The dispatch board says whether a callout was measured by road

## What to build

- **Search radius label and bids:** the dispatch board's search-radius label and its bid list read BackOffice 3472's
  measure. The label reads, for example:
  - `5 km by road`;
  - `10 km by road · widened`;
  - `5 km · straight-line (fallback: timeout)`;
  - `5 km · shadow`.
- **Shadow callouts:** each bid shows its road km next to the straight-line km, so a dispatcher can see the gap.
- **Default:** a callout with no measure reads exactly as today.
- **Text:** the labels are in English and Arabic, and the km figures are bidi-isolated where they meet Arabic text.

## Spine reach

UI (dispatch view and columns, `SearchRadius`, models, locales) → SIS.Api (3472)

## Proof (→ `tdd` red-green cycles)

- [x] `view.test.ts`: the label for each measure (none / road / road widened / fallback with reason / shadow)
- [x] The bid row shows road and straight km on a shadow callout

## Boundaries

oms-react only. 🚩 Do not deploy before BackOffice 3472.

## Done when

The proof tests are green and the board reads correctly on staging.

## Blocked by

BackOffice 3472

## Comments

**2026-11-08 — built (implementer), against BackOffice branch `spec3460` @ e9988aba7 (3466–3472 built, not merged
or deployed).** Wire names are the real ones from that branch: row `distanceMeasure` (`''` | `ROAD` |
`STRAIGHT_FALLBACK` | `SHADOW`), bid `distanceKm` (the decision km), `straightKm`, `roadKm` (0 = not measured).

- **Pure seam** (`src/core/dispatch/view.ts`): `searchRadiusView` adds `measure` (road / shadow / fallback with a
  known reason key, a raw unknown code, or `null`) and `widened` only when the row says so, so an unmeasured
  callout returns exactly today's shape (the 715 tests are unchanged and green). An unknown measure reads as none.
  `bidRow(bid, measure)` carries `roadKm` only on a `SHADOW` callout with a measured road (> 0).
- **UI:** `SearchRadius` (board row, inspector, Delivery details' Callout panel) renders "Searched 5 km by road",
  "… · shadow", "… · straight-line (fallback)", "… (fallback: timeout)" and a trailing "· widened"; km in `Ltr`,
  a known reason in `<bdi>`, an unknown raw code in `Ltr`. `data-distance-measure` / `data-search-widened` for the
  drives. The inspector's bid km cell shows "road 12.2" under the straight km on a shadow callout. en + ar keys.
  The delivery's Callout sub-tab ledger (`document` feature) was left as is — not in this ticket's reach.
- 🚩 **BO ask (fallback reason):** `DispatchBoardService` does not map `Callout.DistanceFallbackReason` onto the
  row. Modelled as optional `distanceFallbackReason?: string`; absent → the label says plain "(fallback)". Ask
  3472 to add it (codes `RoadDistanceFailureReasons`: NOT_CONFIGURED ERROR TIMEOUT QUOTA KEY HTTP_ERROR
  BAD_RESPONSE).
- 🚩 **BO ask (widened) — guessed name:** the row sends no normal radius and no widened flag, so "· widened" can't be
  known from the door (715 ruled never to infer it from km). Modelled as optional `searchWidened?: boolean`, GUESSED
  name; absent → no "widened". Ask 3472 to add it (the Copilot projection already computes
  `SearchRadiusKm > TypeRadiusKm`), or rename the field here to match.
- **Staging check owed:** a ROAD, a SHADOW and a fallback callout read on staging once 3472 is deployed there.
- 🚩 **Do not deploy before BackOffice 3472** (and the two asks above, for the full label).
- `npm run lint`: the boundary gate fails on four pre-existing violations in
  `src/features/insurance-rules/aliases/door-shapes.test.ts` (on the base branch, not this ticket's); the other
  four gates pass.
- **Review fixes (2026-11-08):** radius column 240px with a tooltip, its value the label in words (km + measure + reason + widened, so a change refreshes it; fsi in the tooltip only); measure normalised trim + upper case; Delivery details' ledger shows a shadow callout's road km; each measure x widened is one locale sentence (`_widened` keys, `searchRadiusLabelKey`), en+ar.
- **Closed 2026-11-08:** merged on main. BackOffice answered both asks in 136e8c943: the row carries
  `distanceFallbackReason` and `searchWidened`, under exactly the names modelled here. The staging read (ROAD,
  SHADOW and a fallback) is carried by BackOffice 3473's Shadow walk.
