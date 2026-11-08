---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3460-a-qc-callout-measures-its-radius-by-road-spec.md
blocked-by: —
---

# 859 — The road Shadow report page shows what deciding by road would have changed

The owner needs to read the Shadow week (BackOffice [3473](C:/Work/DMSCO/BackOffice/.issues/3473-road-distance-runs-in-shadow-on-staging-and-the-switch-on-runbook-is-written.md),
runbook [§4](C:/Work/DMSCO/BackOffice/.issues/ROAD-DISTANCE-CALLOUT.SWITCH-ON-RUNBOOK.md)) without Postman. They use
it to decide whether QC goes from Shadow to On, and whether 5/10 km should be retuned.

## What to build

**No backend change.** The door is `GET DispatchBoard/RoadShadow?from=YYYY-MM-DD&to=YYYY-MM-DD&type=` (BackOffice
3470, on pricing2). Its range rules are the scorecard's: whole local days, both inclusive. With no dates it covers
the last 30 days, it allows at most 92 days, and it refuses with `CALLOUT-301`/`302`. `type` '' means every type. It
answers counts only:

```ts
{ asOf, from, to, type,
  measured: number,                         // Shadow deliveries measured by road
  fallbacks: { reason: string, count: number }[],  // STRAIGHT_FALLBACK deliveries by reason
  roadWouldRemoveBids: number,              // road would have dropped an offered store
  roadWouldWiden: number,                   // road would have widened to the wider radius
  competedWouldDiffer: number,              // would have raced where it did not, or the other way round
  measuredBids: number,                     // bids measured both ways
  medianRoadToStraightRatio: number | null }
```

Before modelling, check the field names against `CalloutRoadShadowReport` in BackOffice
`Sartawi.Retail.Data/Modules/Callouts/Scorecard/CalloutRoadShadowReportService.cs`. This repo's drift-detector
pattern applies.

**Where.**
- The page lives inside `features/oms/dispatch-board/`, because the door is the board's and is gated by the board's
  Display grant. Features never import features.
- It has its own route, `/oms/dispatch-board/road-shadow`, and its own menu leaf under OMS, "Road distance
  (Shadow)", gated by `canOpenDispatchBoard`.
- No new grant.

**Filters:** the range (default the last 7 days) and the delivery type (default QC; "All types" sends ''). Both go
in the URL.

**What it shows:**
- **Headline tiles:** Measured, Would remove a store, Would widen, Competed would differ. Under each tile, its share
  of Measured as a percentage. The percentage is display, worked out from the door's own counts.
- **Fallbacks:**
  - a small table of reason → count, plus the total and the total's share of
    `measured + Σ fallbacks`;
  - each known reason in words (`TIMEOUT`, `QUOTA`, `KEY`, `HTTP_ERROR`, `BAD_RESPONSE`, `ERROR`,
    `NOT_CONFIGURED`), with the runbook §6 action as a one-line hint;
  - an unknown code shown raw.
  - When the total share is over 2%, the panel gets a warning tone: "Fallbacks are high: check the key and the quota
    before switching on".
- **Median road / straight ratio:**
  - shown to 2 decimals, with `measuredBids` beside it;
  - null reads "Not enough measured bids";
  - one helper line: "About 1.3 is normal in a city; much higher means long detours".
- **An empty range** (`measured` 0 and no fallbacks): "No Shadow callouts in this range. Is the type set to
  Shadow?", with a link to the delivery-type form.
- **As of:** the door's `asOf`.

**Text:** labels in English and Arabic (the Arabic drafts to be reviewed). The figures are bidi-isolated where they
meet Arabic text.

## Spine reach

UI (page, route, menu leaf, models, locales) → web API client → SIS.Api (3470, already shipped on pricing2)

## Proof (→ `tdd` red-green cycles)

- [ ] Unit (pure view module):
  - the share percentages, including `measured` 0 (no divide-by-zero, shows "—");
  - the fallback total and its share, with the warning flagged above 2%;
  - known reasons map to words and an unknown code stays raw;
  - a null median reads "Not enough measured bids".
- [ ] Stubbed drive, LTR and RTL:
  - the default call sends `type=QC` and a 7-day range;
  - "All types" sends `type=`;
  - a `CALLOUT-301` refusal shows the server's bilingual message;
  - the empty state links to the delivery-type form;
  - the menu leaf hides when `canOpenDispatchBoard` says no.
- [ ] Live: the page reads the staging Shadow week with the owner (BackOffice 3473 step 4).

## Boundaries

oms-react only, and read-only. It shows the report's counts and nothing else. No drill to deliveries, because the
door sends no delivery, store or customer by design.

## Done when

The proof tests are green, and the owner has read the staging Shadow week on the page.

## Blocked by

None — the door is on pricing2 (BackOffice 3470). For the live check, a staging host carrying it, with QC in Shadow.
