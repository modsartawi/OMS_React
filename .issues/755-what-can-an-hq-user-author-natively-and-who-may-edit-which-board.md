---
type: wayfinder-ticket
wayfinder: grilling
map: 741
status: done
blocked-by: —
---

# 755 — What can an HQ user author natively, and who may edit which board?

## Question

[Does embedded Superset beat native over Metabase OSS for HQ exploring?](754-does-embedded-superset-beat-native-over-metabase-oss-for-hq-exploring.md)
widened native v1 to **full authoring** inside the semantic model. Settle the exact v1 authoring
surface and the ownership policy, so `/to-spec` can slice it:

1. **Chart types:** the v1 list. For example KPI, line, area, bar (stacked or horizontal), donut,
   table with cell bars, pivot, heatmap, map. For each, which measure and dimension shapes it
   accepts.
2. **Per-panel actions:** fullscreen, refresh, view as table, download (CSV, xlsx, PNG), drill to
   detail, drill by, share or permalink. Which are v1 and which are later?
3. **Edit chart:** which controls (type, measures, breakdowns, filters, sort, limit, number
   format, colours, legend, titles in both languages). How is an edit saved: in place, as a copy,
   or as a new version?
4. **Edit dashboard:** grid model (columns, row height), drag and resize, add from saved views,
   text or section headers, tabs, and board-level filters and cross-filter scoping. Does the
   layout live in a Metabase dashboard, or in our own store?
5. **Ownership and promotion** (graduated from the map's saved-view fog):
   - who owns a view or a board;
   - personal versus shared versus HQ-certified;
   - how an AI-generated or user-edited view is promoted to certified;
   - whether re-runs take parameters (a date range, a city);
   - whether a user who opens a certified board may edit it in place, or edits a personal copy.
6. **Versioning:** does an edit keep history and allow revert? Metabase keeps 15 revisions per
   card, so say whether we surface that.

Evidence to lean on: the 747 prototype's Build and Linked board variants, and Superset's chart
menu as probed in 754 (`.issues/assets/754-shots/` on `prototype/747-embedded-bi`).

## Answer (2026-11-04)

Grilled with the owner. Q1–Q3 were the pivotal questions and the owner ruled on each. Items 1–20
are the decision list the owner accepted ("go"). Items 19–20 were added at the owner's request.

### Pivotal rulings

**Q1. Ownership: three tiers, copy-on-edit, a curator grant.**

| Tier | Who sees it | Who edits it in place | How an item gets here |
|---|---|---|---|
| **Personal** | its owner only | its owner | anything a user builds, and **every view the AI creates** |
| **Shared** | every holder of the analytics screen grant | its owner only | the owner shares it (one click, reversible) |
| **Certified** | every holder of the screen grant, with a "Certified" badge | **curators only** | a curator promotes a Personal or Shared item. That freezes a certified copy, and the original stays its author's |

- Editing an item you may not edit never changes it. Edit opens **Save as my copy**. The copy is
  Personal and records where it came from.
- **Curator** is a second grant beside the screen grant (working name `AnalyticsCurate`), held by a
  handful of analysts. Viewers cannot certify, and the AI cannot certify.
- Certified boards are what the home page and the AI's answers point at first.

**Q2. Our store is the record. Metabase only runs queries.** This amends 747.

- SIS.Api keeps every view and board as a JSON definition in **semantic-model terms**: measure
  keys, dimension keys, filters, chart type, formatting, and for a board its layout.
- Each item also carries its owner, tier, curation state and revisions.
- Metabase OSS is a **stateless engine**. The definition is compiled to MBQL and run through
  `/api/dataset`. We never use `/api/card` or Metabase dashboards.
- `create_view` writes to our store and routes to `/analytics/view/:ourId`, not to a Metabase card
  id.
- Why:
  - The service credential makes Metabase credit everything, revisions included, to the service
    user.
  - Ownership must live in our store anyway.
  - An engine-neutral definition keeps 746's Cube + Metabase path open.
  - Every save and run passes SIS.Api with the acting person, for the audit.
- Cost: the definition→MBQL compiler. The prototype's `toMbql` sketches it.

**Q3. Eight chart types in v1. Map and pivot are later.**

| Type | Accepts | Answers |
|---|---|---|
| KPI | 1 measure, no dimension; optional compare to the previous period (▲▼ %) | Q14 |
| Line | 1–4 measures × time; or 1 measure × time × 1 category (≤ 8 series) | Q5, Q7 |
| Area (stacked) | 1 measure × time × 1 category | channel mix |
| Bar: vertical, horizontal, stacked, grouped | 1–3 measures × 1 category, or 1 measure × 2 categories | Q1, Q2, Q9 |
| Donut | 1 **additive** measure × 1 category, ≤ 6 slices plus "Other" | channel share |
| Table with cell bars | any measures × 1–3 dimensions; sort, top N, cell bars on numeric columns | Q4, Q8, Q10 |
| Heatmap | 1 measure × 2 dimensions (store × week, day × hour) | pattern spotting |
| Combo: bar + line, two axes | 1 volume measure + 1 rate measure × time or category | Q12, Q13 |

- A **rate or percentile measure** is never stacked or put in a donut. The measure's metadata in
  the semantic model enforces this, and so does the AI's validator.
- **Map** is out of v1: city or region geography needs a basemap, and remote tiles would break
  on-prem.
- **Pivot** is out of v1: it is open-ended BI, and the heatmap plus a 3-dimension table cover the
  curated questions.

### Decision list (accepted)

**Panel actions**
1. v1 has fullscreen, refresh ("fetched N ago"), view as table, download CSV, xlsx or PNG, **drill
   by** (break the clicked point down by another dimension, with a breadcrumb), and permalink (the
   board plus its current filters).
2. **Drill to detail never renders raw rows inside analytics.**
   - It hands off to an existing OMS screen, filtered: store or city → Deliveries or Orders,
     callout → Dispatch.
   - That screen's own grants and masking apply, so no customer row ever appears on an analytics
     surface (745 §5, 734's no-PII rule).
   - A measure with no matching screen (till sales) offers no detail drill.
3. Later, not v1: scheduled email or subscriptions, alerts and thresholds, annotations.

**Edit chart**
4. The controls:
   - chart type, limited to those the shape allows (Q3);
   - measures and breakdowns, from the model only;
   - filters, sort, top N;
   - number format: auto, integer, decimal, %, SAR, minutes;
   - series colours from **DMSCO chart tokens only**, with no free picker (this keeps the
     colour-literal gate and dark mode working);
   - legend: hidden, top, bottom or end;
   - title and subtitle **in English and Arabic**.
5. An empty title is generated from the measure and dimension labels through `t()`.
6. Saving follows Q1. Your own item saves in place. An item you may not edit saves as your copy.
   Shared and Certified items also offer an explicit Save as copy.

**Edit dashboard (board)**
7. A **12-column grid** in logical order, so it mirrors under RTL, with fixed row units. Panels can
   be dragged and resized, with a minimum size per chart type.
8. Add a panel from a saved view (yours, Shared or Certified), linked **by reference**, or build a
   new one on the board. Text and section-header panels are allowed. **Tabs are later.**
9. Board filters run over the shared dimensions: date period (relative or fixed), city, region,
   store, channel and country. Any panel can opt out of any board filter.
10. **Cross-filter:** clicking a mark filters every other panel on that dimension (the prototype's
    Linked variant). Any panel can opt out. Clicking again clears it.
11. **Re-run parameters:**
    - Saved periods are **relative** ("last 30 days" stays last 30 days).
    - Board filters are the run-time parameters, and the permalink carries them.
    - There are no per-view prompt parameters.

**Versioning**
12. Every save of every item writes a **revision in our store**: who, when, and the full definition
    snapshot. The last 20 are kept per item. Metabase's 15 card revisions are **not** surfaced,
    because Q2 makes them meaningless.
13. Anyone who may edit an item sees its history. Revert writes a new revision, so it can itself be
    undone.
14. **Certification freezes a copy.** When a curator certifies a later revision of the source, the
    certified copy updates as one new revision.
15. A personal copy is a snapshot. It never follows its source, but shows "the original changed
    since you copied it".

**Lifecycle**
16. Owners delete their own items. Curators may delete or **un-certify** a Certified item.
17. Deleting a view that boards reference leaves a "view removed" panel on them, and never breaks
    the board.
18. AI-created views always land Personal (Q1). Promotion is the same curator action as for any
    other item.

**Auto-refresh and TV mode** (added at the owner's request)
19. **Board auto-refresh**
    - The board header has a picker: Off · 30 s · 1 min · 5 min · 15 min. The default is Off.
    - The owner or curator saves an interval with the board. A viewer may change it for their own
      session without editing the board.
    - Refresh pauses while the tab is hidden and catches up when it is visible again.
    - One loop per board refreshes the panels in staggered order.
    - **The server caches results**, and a result stays cached as long as the shortest interval.
      N screens on the same Certified board therefore cost one query per interval, not N.
    - **30 s is provisional.** If the replica headroom probe (750) says the replica cannot carry
      it, the floor becomes 1 min. That is a config value.
    - Each panel keeps its "fetched N ago" stamp. Where the figure comes from a slower mart, it
      also shows "data as of HH:MM" rather than implying live data. This ties to the map's
      freshness fog.
20. **Board fullscreen (TV mode)**
    - It hides the app shell. Panels fill the screen, and board filters shrink to a read-only
      chip strip.
    - Cross-filter and panel actions keep working. Esc exits.
    - The permalink can open straight into fullscreen with auto-refresh on, for an ops-room wall
      screen.
    - It still needs a signed-in session. A non-expiring kiosk login is out of v1.
    - Per-panel fullscreen (1) stays as well.

**Vocabulary** (added to `CONTEXT.md`): analytics view, board, Personal / Shared / Certified,
curator. These are deliberately not "saved view", which already names the Deliveries list's
browser-local bundles.
