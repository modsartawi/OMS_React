# HITL — ticket 464 (SAP export console, store page)

## Q: Where the per-day Recompute lives
**Decision taken:** On the store-day page's header (`/reports/sap-export/store/:code/day/:day`), posting `{ code, day }`. The store page carries the window Recompute (`{ code }`). Clicking a strip cell opens the day; the hover card shows counts and verdict and has no button.
**Why:** The ticket allows "from the strip's context or the store-day header", and a click on a cell is already taken by "opens that day's store-day page". A button inside a hover card is hard to reach by keyboard.
**Revisit if:** the owner wants a per-day recompute on the strip itself (a context menu or a selected-day panel).

## Q: What a day recompute re-reads
**Decision taken:** The store's header and strip (`storeKey`) and the fleet. It does not re-read the live store-day: that read is classified live, not from the rollup. The store's strip is re-read when you go back to it.
**Why:** The ticket says "re-reads the strip and header". The spec review called re-reading the live day useless.
**Revisit if:** 2584's recompute turns out to feed the store-day read too.

## Q: The open-a-day form on the store page
**Decision taken:** Removed. The strip's 30 cells replace it. HITL-463 parked the form there "until 464 draws the store page". The fleet and store-day drives now walk through the strip instead.
**Why:** HITL-463 said the strip replaces the form.
**Revisit if:** someone needs to open a day outside the window. The door refuses that with `DAY_OUT_OF_WINDOW` anyway.

## Q: How a never-computed (`noData`) day looks
**Decision taken:** A dashed border with muted ink and no fill. This is the ticket's "hatched or muted". No diagonal hatch is drawn.
**Why:** A hatch needs an arbitrary gradient value, which sits close to the palette gate. The dashed edge already reads differently from byDesign's solid muted ring.
**Revisit if:** a human's eye on the strip can't tell noData apart from byDesign (OWNER check, outstanding).

## Q: Which facts read as danger
**Decision taken:** Danger when there is no SAP location (`!underSap || sapLocations === 0`), with the L6 cause, or when there is no counter row, with the L7 cause. Open date, closed and inventory date are shown plain. L8 ("before the open date") gets no cause, because a date is not a fault by itself.
**Why:** The ticket names only "the L6 / L7 meanings". `underSap: true` with 0 locations shouldn't happen per the contract; I read it the safe way.
**Revisit if:** the owner wants a closed store or a recent inventory date flagged.

## Q: Window length in the copy
**Decision taken:** The strip title counts its own cells ("The last 30 days"), and the recompute hint and its DAY_OUT_OF_WINDOW sentence say "window" rather than "30". 461's store-day sentence still says "30-day window" (not mine to reword).
**Why:** The spec makes the window a setting (30 is its default).
**Revisit if:** the window is fixed for good at 30.

## Q: Refusal text for recompute
**Decision taken:** The four contract codes (BAD_REQUEST, NO_STORE, BAD_DAY, DAY_OUT_OF_WINDOW) show the console's own sentence. Any other code shows the envelope's message via `apiErrorMessage`. This is the same pattern as 461 and 463.
**Why:** It is consistent across the console.
**Revisit if:** the server's message turns out to be more specific than our sentence.

## Contract gap
None blocking. Notes:
- `wire.ts` fills a strip day's ABSENT `accounting` with `agrees` on a computed day (and `null` on a noData day), mirroring 461's store-day fill ("agrees until 2583 fills the checks"). An explicit `null` passes through. The spec review flagged that this could hide a breaking day if 2584 ships before 2583. If 2584 always sends the field, the fill never fires.
- Story 38 ("stale, clearly stamped"): the store header shows the store's `computedAt`. There is no stale warning on the store page and no per-day stamp in the hover card. The ticket did not ask for either; 463's `isStale` could be reused if wanted.
