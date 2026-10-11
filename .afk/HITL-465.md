# HITL — ticket 465 (SAP export console: runner card, double sends, identity breaks)

## Q: Where the runner card sits on the fleet page
**Decision taken:** The red banner sits above the tiles, as the ticket says. The card itself sits between the tiles and the store list. Both read one query.
**Why:** The ticket places only the banner ("above the tiles"). Putting the card under the tiles keeps the morning glance (tiles) first.
**Revisit if:** the owner wants the card above the tiles, or collapsed when every runner is up.

## Q: Outcome badge colours
**Decision taken:** `faulted` danger, `moved` success, `idle` muted, `none` (never ran) neutral.
**Why:** The ruling covers liveness only. A fault is the one outcome that needs action; idle follows idle liveness and is never red.
**Revisit if:** a human's eye wants "never ran" louder (it can sit beside an `up` liveness when the door infers the row).

## Q: A cycle that started but has not ended
**Decision taken:** "Started <time>, not ended" instead of "Never". /code-review caught that "Never" beside "Up" was false.
**Why:** `lastCycleStartedAt` is in the contract, and "never" would claim the runner never ran.
**Revisit if:** the door always stamps start and end together.

## Q: The double-send flag filter
**Decision taken:** A select with three options: both (no `flag`, the door's default), X1p, X1. The URL carries at most one `flag`. A URL with both or an unknown flag reads as both.
**Why:** The contract allows a repeated `flag`, but with only two values "both" equals "none", and two toggle chips would show a confusing state.
**Revisit if:** more double-send flags join the door.

## Q: The store filter on the double-send list
**Decision taken:** A text box applied on Show (Enter), not debounced. Changing the flag also applies whatever the box holds.
**Why:** A store code is an exact match, and a 404 `NO_STORE` on every half-typed code would flash errors. Applying the box with the flag stops the box and the list from disagreeing (/code-review).
**Revisit if:** the owner prefers a store picker. No store-list door exists in the contract.

## Q: Colours on the double-send list
**Decision taken:** Both X1 and X1p badges are danger (461's `FLAG_TOKEN`, left as it was). X1p also carries "Can still be stopped" in danger ink and sorts first.
**Why:** Story 25 lists X1 for reversals, and 461 had already made both red. The spec review asked whether "in red" was meant for X1p alone.
**Revisit if:** the owner wants X1 drawn as a strong warning so that only X1p reads red.

## Q: Links on a double-send row
**Decision taken:** Three links: transaction → inspector, day → store-day page, store code → store page. The third was not asked for.
**Why:** It costs nothing and matches the fleet list's code link.
**Revisit if:** the extra link clutters the row.

## Q: Identity breaks: a tab or a section, and links
**Decision taken:** A section under the strip on the store page, drawn as a plain table (not AG Grid). The transaction number is not a link.
**Why:** The ticket allows "a tab or section", and the store page has no tabs. An orphan has no `RetailTrx`, so an inspector link could open on nothing; a duplicate key's link would be ambiguous.
**Revisit if:** the owner wants inspector links on breaks (462's inspector shows orphan evidence too).

## Q: Retry policy on the two new lists
**Decision taken:** A refusal (`kind: 'business'`) is not retried; an outage is retried twice. This differs from the siblings' `retry: false`.
**Why:** /code-review: neither list has a refetch cadence, and pressing Show with the same code does nothing, so a transient 500 would stick.
**Revisit if:** the console should behave the same way everywhere (then the fleet and store reads take `retryOutage` too).

## Q: Deferred refactor
**Decision taken:** The "clamp to last page when the page empties" effect is not graduated to core. It is now in four files of this feature.
**Why:** Moving it reworks 461/463's screens inside this slice. Both reviews said to keep it as a deliberate ticket.
**Revisit if:** a hardening ticket picks it up (with the pager-visibility condition copied beside it).

## Contract gap
None blocking. Notes:
- Story 13 (a store silent while the fleet moves, flagged apart from a fleet-wide stop) has no field on `Runner` or `FleetStoreRow`, so it is not drawn.
- `normaliseRunners` reads an ABSENT `fromHeartbeat` as `false` ("inferred"), the weaker claim. The contract marks it required, so this fill never fires on a door built to it.
- The identity-break meanings are oms-react's wording. The contract gives only the kind names, and the spec gives only "no duplicate store+number key, no evidence without a transaction".
