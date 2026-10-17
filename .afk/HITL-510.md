# HITL — ticket 510 (budgets as sentences, used / limit / overshoot, live limit without republishing)

I re-read the brief at the start of 510. It still has **no contract section**, so every door and shape below is provisional
(`src/core/models/rule-campaign.ts`, `src/core/rules/api.ts`) and 520 re-points it.

## Q: Which doors does Budgets use?
**Decision taken:** Three provisional doors:
- `PUT RuleCampaign/Campaigns/{id}/Settings/Budgets` with `{ budgets: [...] }`. It saves the whole list, the same way the 509 pages each save their part.
- `GET …/{id}/BudgetUsage`, answered as `[{ budgetId, used }]`.
- `PUT …/{id}/Budgets/{budgetId}/Limit` with `{ value }`. This is the live limit (2744).

A new budget travels with an id the browser mints (`mintRequestId`), as a new rule's blocks do.
**Why:** It mirrors 509's one-door-per-page shape. Limits get their own door because ADR 0091 puts them outside the version pin.
**Revisit if:** 2758/2744 give one door per budget (add / change / delete), or HQ mints the ids.

## Q: Is saving the whole list last-write-wins?
**Decision taken:** Yes, for now. Add, edit and delete send the list built from the campaign as last read. Two authors editing budgets at the same moment can drop each other's change. The 509 settings pages work the same way.
**Why:** No contract gives a version or etag yet.
**Revisit if:** 2758 adds a version check (then a stale save is refused on the envelope and shown as it comes) or per-budget doors. Raised by `/code-review`.

## Q: On a live campaign, what can the drawer change?
**Decision taken:** For an existing budget on a campaign whose `status` is `live`, the drawer changes **only the limit**. It saves through the Limit door, at once, with no publish call. What the budget counts, what it is counted per, how often it starts again and its name are all shown but disabled ("To count something else, add a new budget."). Adding or deleting a budget on a live campaign goes through `Settings/Budgets`, like any other setting on a live campaign.
**Why:** ADR 0091 makes only *limits* live settings. Whether a new budget, or a different scope or period, is live or waits for a new version is not ruled anywhere.
**Revisit if:** 2758/2759 rule that adding or deleting a budget on a live campaign is a draft change that waits for the next activation. The copy then needs to say so. The live delete copy currently says "What was used against it is kept in HQ's history", which is a guess at 2744's journal.

## Q: Does a disabled campaign use the live-limit door and show counters?
**Decision taken:** No. Only `status === 'live'` reads the counters and uses the Limit door. A disabled campaign edits budgets like a draft.
**Why:** The ticket says "on a live campaign". A disabled campaign gives nothing, so it has nothing to protect.
**Revisit if:** Support wants a disabled campaign's counters shown (they survive, ADR 0091), or HQ refuses a list save on a once-published campaign.

## Q: What does "used" mean for a per-member, per-code, per-store or per-sale budget?
**Decision taken:** HQ answers one `used` per budget. For a per-key scope that is the **highest** counter of any one key in the current period (the prototype's "highest counter so far"), labelled "Most used by one member" (or code, store, sale). A budget with no counter row reads `0 / limit`.
**Why:** It is the number that tells a marketer whether the limit bites. ADR 0091 says counters start from zero.
**Revisit if:** 2744 answers a distribution (count of keys at the limit, and so on) or a different period.

## Q: Is `year` a period?
**Decision taken:** It is kept. The drawer offers lifetime, day, week, month and year.
**Why:** 501's model and the owner-approved prototype both have `year`, and BDAY-BEAUTY's fixture uses it ("once a year per member"). BackOffice 2744 lists only "lifetime / day / week / month".
**Revisit if:** 2744 really has no yearly period. Then drop `'year'` from `RuleBudgetPeriod` and `BUDGET_PERIODS`, and re-word BDAY-BEAUTY.

## Q: Which figures does the drawer accept?
**Decision taken:** A plain figure above zero (no exponent and no hex). Uses must be whole. Money and points take at most the currency's decimals: SAR 2, BHD 3, and 3 when the currency is unknown (the scale money is held at). Points given and points taken are their worth in the campaign's currency, as in the prototype ("Points given (SAR)").
**Why:** Money is formatted by currency, BHD has three decimals, and `/code-review` caught that `2.5e-1` slipped past the whole-number check.
**Revisit if:** 2744 counts points in points rather than currency. Then `budgetAmount` reads `pointsGiven` and `pointsTaken` as a number with a "points" unit.

## Q: Should a budget that a rule reads ("Budget not used up") be deletable?
**Decision taken:** Yes. Delete asks first, and its copy warns that a rule reading the budget will show it as missing. The client does not block the delete. HQ's checks (508) flag the dangling reference, and HQ may refuse the delete on the envelope.
**Why:** It matches how the builder shows "a budget that no longer exists", and refusal is HQ's to rule.
**Revisit if:** The owner wants the delete refused at the page, naming the rules (the same pattern as 509's `featuresInUse`).

## Note: CONTEXT.md
Both reviews note that budget, counter, overshoot and live limit are not in CONTEXT.md (509 raised the same for campaign, offline-safe and audience). A `/domain-modeling` pass for the rule-engine vocabulary is owed. It is not in this slice.

## Note: the drawer frame
`BudgetDrawer` repeats the native-`<dialog>` side-sheet plumbing that `SnapshotDrawer`, `SlipDrawer` and `StatusHistoryDrawer` each carry, as the repo's drawers do today. A shared docked-sheet primitive in `core/ui` would be a separate hardening ticket.
