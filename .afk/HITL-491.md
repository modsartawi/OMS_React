# HITL — 491 (the per-store table switches between Delivery, Pick-up and All)

## Q: How are the average column headers worded in the track views?
**Decision taken:** "Avg time to deliver (min)" / "متوسط مدة التوصيل (دقيقة)" and "Avg time to ready (min)" / "متوسط مدة التجهيز (دقيقة)" — the brief's Arabic captions exactly, plus the "(min)" / "(دقيقة)" unit that the All view's existing header ("Avg hand-over (min)") already carries. New keys `table.avgToDeliver` / `table.avgToReady`.
**Why:** a table cell carries no unit beside its value, so the header has to; the All view's header already does this.
**Revisit if:** "exactly" in the brief is meant to rule out the unit suffix, or the owner wants the header keys to reuse `lane.avg.*` with no unit.

## Q: How is the switch captioned, and where does it sit?
**Decision taken:** pill buttons "All · Delivery · Pick-up" in that order (All first, as the default), in the "By store" heading row, at the inline end, above the grid. Delivery / Pick-up reuse 489's `lane.delivery` / `lane.pickUp`; new keys `table.track.all` = "All" / "الكل" and `table.track.label` = "Track" / "المسار" (the group's aria-label). It uses the same pill look as the period tabs (the classes moved into `controls.ts`).
**Why:** the ticket gives the order "Delivery / Pick-up / All", but All is the default, and the period tabs put their default first.
**Revisit if:** the owner wants the ticket's literal order (Delivery, Pick-up, All) or another Arabic word for "Track".

## Q: What happens to the user's sort when they switch view?
**Decision taken:** the grid remounts per view (`key={track}`), so every switch opens on that view's hand-over column, descending. A sort picked in one view is not kept when the user comes back to it.
**Why:** the ticket says "the default ranking is the view's hand-over column, descending". The three views have different column sets, so a sort carried across views would point at a column that may not exist.
**Revisit if:** users want each view to remember its last sort (per-view sort state; it could be put in the URL).

## Q: Which column is Pick-up's "hand-over column" for the default ranking?
**Decision taken:** Picked up (`tracks.pickUp.flow.handedOver`).
**Why:** the wire contract says `handedOver = Picked up` for pickUp, and that is the view's hand-over column.
**Revisit if:** the owner reads "hand-over" for a pick-up as Made ready (brief rule 4; 2659's average times a pick-up to Made ready).

## Review notes (not acted on, by ruling)
- /code-review: "the Pick-up view never shows Returned back / Rejected / Rescheduled, so a store with bad pick-up data cannot be found in the table." This is by design: the ticket and the brief leave those three out of the Pick-up columns ("a table cannot hide per row"). 490's misses row shows them when they are not zero. The owner may want them added conditionally later.
- /code-review flagged that `showsUnspecified` in `lanes.ts` is a type predicate that also returns false for 0. That is 489's code and outside this slice; it is harmless today.
- /standards-review raised these smells, all left as they are:
  - the per-track lookup maps are spread over `store-rows.ts` and `StoreTable.tsx`;
  - `query.ts` imports `TableTrack` from `store-rows.ts`;
  - the avg header keys repeat the lane captions.
  Only the duplicated `sourceOf` lane branches were fixed.
