# HITL log — ticket 459 (rail agreement: fleet tile + column, Agreement tab, Recheck)

## Q: Which colour (token) does each gap kind get?
**Decision taken:** Missing at the counter rail = bad, missing at the mirror rail = bad, totals differ = warn.
**Why:** A missing receipt means a whole sale is absent from one copy of HQ. A total mismatch means the sale arrived on both rails, only its money differs. All the colours come from the Severity tokens, through `CodeBadgeView`.
**Revisit if:** The owner wants every kind to read bad (any gap makes the day disagree), or wants the kinds as plain words, the way 457 handled dead-letter reasons.

## Q: `applyRecheck(days, result)`: with a `null` result, how is the day to remove known?
**Decision taken:** The signature is `applyRecheck(days, day, result)`, where `day` is the day that was rechecked.
- A `null` result removes that day.
- A non-null result replaces the row for `result.businessDay` in place.
- An answer for a day not in the list is inserted by date, and no listed day is dropped for it.
**Why:** The recheck response's `day: null` does not say which day it was for.
**Revisit if:** —

## Q: Recheck: write the answer into the cache, then re-read?
**Decision taken:** Both. `setQueriesData` applies `applyRecheck` to every cached Agreement read of the store. Then the store prefix (the gaps, the header and the days), the fleet and the audit feed are invalidated, as 458 does. Toast outcomes:
- the rails agree: success;
- the rails still disagree: warning;
- the day was removed: success.
**Why:** The ticket asks for both: "applyRecheck replaces the day or removes it on null, then the gaps and the store header are re-read". The fleet's agreement column and its tile count can change too.
**Revisit if:** One write is enough. /code-review flagged the patch-then-refetch as redundant; I kept it on purpose because the ticket asks for it.

## Q: Should whole-request recheck refusals get words?
**Decision taken:**
- `ReasonDialog` gains an optional `codeLabel` prop. Only the Agreement tab passes it.
- `recheckRefusalLabel` words `BAD_DATE` and `BAD_REQUEST`, and takes `REASON_REQUIRED` and `NO_STORE` from the console's shared `failureLabelKey`.
- The server message stays as the banner's message, per the api-envelope rule.
**Why:** The wave note says `BAD_DATE` is unreachable "but it still falls back to a label".
**Revisit if:** The owner wants every ReasonDialog caller to default to `failureLabelKey`, which would change the other dialogs. I left that out of this slice.

## Q: What extras does the Agreement tab show?
**Decision taken:**
- A line with the store's overall agreement (from the header row's `agreement`).
- The days table carries Judged (`judgedAt`).
- The gap grid carries a Business day column, because with no day picked it lists every day.
- Clicking the picked day again also goes back to every day, as well as the "Show every day's gaps" button.
- A picked day the door no longer lists (rechecked away, or aged out of the window) resets to every day.
- The days are a plain table (as in LastHourPanel), not AG Grid, so a day button can mark the picked row. The gaps use TabGrid, so they keep the grid base.
**Why:** These are all fields of the contract, shown so the tab can be read alone.
**Revisit if:** A human's eye on the tab (no prototype covers it) wants it leaner.

## Q: Which existing drive assertions changed?
**Decision taken:** Only the ones the ticket grows:
- **Fleet:** the tile count in section 1 (12 → 13), and section 10's "no rails-disagree tile yet", which now expects that tile last.
- **Store:** the four tab-list assertions (sections 3, 7, 11, 12b), with Agreement appended after Mirror. The ruling named the WPF one as the one to change, but 457 had already put Mirror into the worker one, so both lists grow.

Each change carries a 🚩/459 note. The vitest tile and tab-list tests changed the same way.
**Why:** The ruling appends the tile and the tab.
**Revisit if:** —

## Q: How should the fleet filter on agreement?
**Decision taken:** Through the `railsDisagree` state tile only, with no `agreement=` parameter (the fleet drive asserts that none is ever sent). The column is display only.
**Why:** It is the ruled trap: the fleet door has no agreement parameter.
**Revisit if:** See the contract gap below.

## Contract gap
- `GET ActionSync/Fleet` cannot filter to `notJudged` or `agree` stores. Only "disagree" is filterable, through the `railsDisagree` state. Story 37 ("an Agreement column … so that I can filter to the disagreeing stores") is met. A filter for "not judged" would need a door parameter, which the contract does not have.
- The old Fleet/Summary does not count `railsDisagree`. Against a pre-2563 door the tile draws with a blank count, the same as the four mirror tiles in 456.

## Note: a commands drive flake
In one run of `sync-console-commands-drive`, 4 timing checks failed. They passed 69/69 on the next two runs, and 459 does not touch those screens.
