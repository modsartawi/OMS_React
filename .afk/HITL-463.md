# HITL — ticket 463 (SAP export console, fleet page)

## Q: What do the accounting-breaks and legacy-stalled tiles do when clicked?
**Decision taken:** Nothing: they are plain counts. Only the three store tiles drive the `label` filter, and the two double-send tiles link to the list.
**Why:** `GET SapExport/Fleet` has no break or stalled filter, and the contract is the only source of parameters. Inventing one would provoke a `BAD_FILTER`.
**Revisit if:** the contract gains a fleet filter for break days or stalled stores (then the tile drives it).

## Q: Tile colours outside the label ruling
**Decision taken:** The three store tiles take their label's token from `label-helpers` (behind = strong warning, stuck = danger, held for inventory = info). Double sent, double send pending, accounting breaks and legacy stalled are all danger. A tile whose count is 0 loses its accent (muted top border).
**Why:** Story 26 makes double sends red. A breaking day and a stalled store are money that is not on its way. The muted zero keeps the eye on problems.
**Revisit if:** a human's eye on the tiles wants breaks or stalled as a warning, or wants zero tiles coloured.

## Q: The "never computed" rollup (`computedAt: null`)
**Decision taken:** The stamp reads "The rollup has not computed any numbers yet." and no stale warning shows. An unparseable stamp is stale.
**Why:** /code-review: "never computed" beside "not refreshed for over 30 minutes" contradicts itself.
**Revisit if:** the owner wants a null rollup raised as a warning too.

## Q: Where the stale clock comes from
**Decision taken:** Browser time, ticking every minute (never earlier than the last successful read), compared with the stamp parsed as local wall-clock.
**Why:** Contract times are local with no offset (`no-utc-time`), and readers share the estate's clock. A clock frozen at the last read would never warn while the summary refetch is failing.
**Revisit if:** readers outside the estate's time zone use the console.

## Q: Where 461's open-a-day form went
**Decision taken:** It moved from `/reports/sap-export` (now the fleet) to the store-page placeholder, `/reports/sap-export/store/:code`, with the code fixed by the route. The store-day page's back link now goes up to that store ("Store P014"), not to the fleet.
**Why:** The fleet → store → day path stays walkable before 464. HITL-461 said to delete the form when 463 lands, but deleting it would have left no way into a store-day until 464.
**Revisit if:** 464 draws the store page; the strip replaces the form there.

## Q: Placeholder for the double-send list
**Decision taken:** `/reports/sap-export/double-sends` is a guarded "on its way" note that names the requested flag(s), X1 or X1p only. It makes no call.
**Why:** The ticket says "a placeholder route until then". 465 replaces it.
**Revisit if:** 465 lands.

## Q: The URL-state hook
**Decision taken:** The Material search's "latest + echoes" URL pattern graduated to `src/core/ui/use-url-query.ts`, and the fleet uses it. It adds one fix: echoes are settled on each landed navigation (`location.key`), so a burst of writes that returns to the URL already showing does not leave stale echoes behind. `MaterialSearchPage` still has its own copy.
**Why:** feature-structure says logic shared by two features graduates to core, but reworking a shipped screen (Materials) inside this slice risks unrelated behaviour.
**Revisit if:** a hardening ticket moves `MaterialSearchPage` onto the hook (standards-review flagged the two copies).

## Q: Grid shape
**Decision taken:**
- **Label counts:** six columns under a "Transactions by label" group, worst first. Zero cells are blank.
- **Rail mix:** two columns, Legacy and New rail, with zero shown.
- **Break days:** blank at 0.
- **Markers:** stalled is danger (stuck's token), "held for inventory" (inventory-gated) is info. Markers is the last column and the only one that stretches.
- **Rows:** the code cell is a real link, and a click anywhere else on the row also opens the store.
**Why:** The ticket's list. A zero break count reads clean, the same way a zero label count does.
**Revisit if:** the owner wants a total-transactions column, or the inventory-gated marker worded differently from the transaction label (standards-review: the two read alike).

## Q: The label filter's UI
**Decision taken:** A row of six label chips (worst first) beside the tiles. The tiles toggle three of the same labels. Chosen states show as removable chips beside them. "Clear filters" keeps the sort.
**Why:** The ticket asks for "label (repeated)" as a filter, and the tiles cover only three labels.
**Revisit if:** the owner finds two ways to set the same filter confusing.

## Contract gap
None blocking. Notes:
- `wire.ts` fills a missing `breakDays` / `legacyStalled` / `legacyInventoryGated` / tile with 0 / false, following 461's store-day precedent (the contract marks them required; this only guards a door that ships ahead of 2583's checks). Spec-review noted this would make a store look clean rather than unknown. If 2584 always sends them, the fill never fires.
- The fleet door has no filter for break days, stalled stores or flags (see the first question).
