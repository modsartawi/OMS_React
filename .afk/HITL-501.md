# HITL — ticket 501 (campaigns list + dashboard)

Brief re-read at the start of 501: **no contract section** has appeared in
`2737-oms-react-rule-engine-brief.md`, so every shape below is the runner's provisional one.

## Q: How are a campaign's states stored versus derived?
**Decision taken:** The wire carries `status: draft | waitingForApproval | live | disabled`. Scheduled, running and expired are worked out on the client from a `live` campaign and its schedule, at the reader's local now (`core/rules/campaign-state.ts`). A status the client doesn't know is read as a draft, never as live.
**Why:** The ticket's proof says "from its status + schedule at a local now", and the prototype's `stateOf` derives the states the same way.
**Revisit if:** BackOffice 2759 sends the derived state itself, or adds a "sent back" status (at the moment a sent-back campaign is a draft).

## Q: Is the schedule's end day inclusive?
**Decision taken:** It is exclusive, as the prototype's schedule page says ("the end date is exclusive"). A campaign is expired from its `until` day onwards, and "Ends in N days" counts to `until`. `hoursFrom`/`hoursTo` are daily hours, not a start and end time.
**Why:** This is the owner-approved prototype's own rule.
**Revisit if:** 2758 or 2759 define `until` as inclusive, or move to a date-and-time end.

## Q: Should "Starts in N days" read differently before activation?
**Decision taken:** A campaign that isn't live (draft, waiting or disabled) says "Would start in N days". A live one says "Starts in N days".
**Why:** The prototype says "Would start" when `c.live` is false. For a disabled campaign I chose the more conservative wording, because it will not start.
**Revisit if:** The owner wants a disabled campaign that was once live to say "Starts in".

## Q: What does the list search match?
**Decision taken:** The English name, the Arabic name and the code, ignoring case. There is also an "All" tile in front of the six state tiles, so a filter can be cleared.
**Why:** The prototype searches code + name. Adding the code costs nothing and makes it easy to find a campaign by its receipt code. The prototype has a "Total" tile too.
**Revisit if:** The owner wants the search to match names only.

## Q: Where do the wire model and the campaign-features' api live?
**Decision taken:** The model is in `src/core/models/rule-campaign.ts` (the runner's layout; the ticket says "core/rules"). The endpoints are in `src/core/rules/api.ts`. `features/campaigns/list` and `features/campaigns/workspace` have **no `api.ts` of their own**. This follows the `features/oms/pick-support` precedent: their only calls are shared core doors.
**Why:** feature-structure lists `api.ts` as required, but the wave's rule of one PROVISIONAL file per door family wins.
**Revisit if:** A later slice adds a call that only one feature uses. That call should go in that feature's `api.ts`.

## Q: Where does the Campaigns nav group sit?
**Decision taken:** It is a new top-level group placed right after Pricing and before Materials, so Deliverect stays last and Materials second-last (`menu-deliverect.test.ts` pins both). It is ungated by ruling.
**Why:** It is the rule engine's promotions, a neighbour of Pricing's bonus-buy screens.
**Revisit if:** The owner wants it elsewhere in the rail.

## Q: Which campaigns do the stub fixtures hold?
**Decision taken:** The prototype's 13 sample campaigns, in the provisional wire shape, with Rx exclusion set to A006 only. I added three campaigns so that every state tile has one under it: NATDAY-15 (scheduled), SPRING-DRAFT (draft) and SUMMER-FLASH (disabled).
**Why:** The prototype's samples have no scheduled, draft or disabled campaign at its simulator date.
**Revisit if:** 520 replaces the fixtures with the real contract's shapes.

## Note (BackOffice, not editable from here)
The prototype's `data.js` still uses `EXCL_RX = ['A006', 'A008']`, while the decision is A006 only. The fixtures here use A006 only.
