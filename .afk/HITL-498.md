# HITL — ticket 498 (Pick support: the Stuck now census)

## Q: How does a census row open its diagnosis?
**Decision taken:** It switches to Search with `?key={deliveryNo}` (dropping `?delivery=` and `?tab`). The Open diagnosis button in each row does this, and so does a double click on the row. If Search already holds that key, the lookup and the diagnosis are asked again.
**Why:** This is the brief's own option and the runner's conservative choice. It reuses the shared panel and its fix dialog unchanged.
**Revisit if:** Resolve of a delivery number matches more than one kind and lands on a pick list. In that case a drawer that opens `PickSupport/Delivery/{no}` directly would be cleaner.

## Q: Does a floor or blank `since` also sort last, or only `null`?
**Decision taken:** Anything that reads as "—" (null, blank, or a year ≤ 1900) is moved last. The rows on each side keep the server's order.
**Why:** A floor stamp reads "—" (rule 6). Two "—" rows at opposite ends of the list would read as inconsistent. The spec only names `null`, so for a genuine timestamp this goes no further than the spec does.
**Revisit if:** The server ever sends a floor `since` on purpose and expects the server's position to be kept.

## Q: Is header sorting allowed on the census grid?
**Decision taken:** Yes. Every column can be header-sorted, as other OMS grids allow. The default stays the server's order. The since sort compares the stamps as text, never parsing them, and keeps an unwritten stamp last in both directions.
**Why:** The brief says "Keep that order by default". That implies a default, not a ban on sorting.
**Revisit if:** The owner wants the order fixed (`sortable: false`).

## Q: How is "All" written in the URL? When does a filter apply?
**Decision taken:**
- "All" writes no `shape` at all. A hand-typed `shape=ALL` (any case) also reads as All.
- The shape select applies as soon as it changes.
- The store applies on Enter or Show, not on blur. Applying on blur made a click on Refresh fire two door calls.
**Why:** It is the fewest door calls for free text, and a pick list has nothing to wait for.
**Revisit if:** The owner wants both filters to apply only on Show.

## Q: What does the badge show on Search, and while a read fails?
**Decision taken:**
- On Search the badge shows the `total` for the filters currently in the URL. The filters stay in the URL when a row opens Search, so going back to Stuck now restores them.
- The badge is hidden while the read is pending or has failed (for example on `PICK-00003`).
**Why:** The brief: "`total` is the number of distinct deliveries in `rows` after the filters, and it is the tab's count badge." A failed read has no total to show, and the client never counts rows itself.
**Revisit if:** Support reads a filtered badge on Search as "the whole estate". Two options then: an unfiltered badge, which would need a second call, or a filter marker beside the badge.

## Q: What does the empty census say?
**Decision taken:** With no filter it says "Nothing is stuck", a UI word the runner allows. With a filter set it says "Nothing is stuck for these filters."
**Why:** /code-review found that a filtered empty read claiming "Nothing is stuck" says more than the read showed.
**Revisit if:** The owner wants only the one wording.

## Q: Arabic word for "Shape" in the filter
**Decision taken:** "النمط", the same word 496 used for `fix.shape`. It was first written as "الحالة" ("status"), and the standards review flagged that.
**Why:** It keeps one Arabic term for one concept across the namespace.
**Revisit if:** An Arabic-reading owner prefers another term. Shapes are shown as codes anyway.

## Contract gap
None. `PickSupportCensus` / `PickSupportCensusRow` match the brief. The stub's `PICK-00003` sentence ("'X' is not a stuck shape") is taken from the shipped `PickDocumentService_SupportLookup.cs:139`.
