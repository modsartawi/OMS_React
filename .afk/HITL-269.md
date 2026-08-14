# HITL — ticket 269 (a branch's account is the destination)

Decisions taken unattended, with the evidence and the condition that would overturn each.

## Q: The wire contract (spec 267 D8) carries no currency, but D10 and this ticket's Proof both demand the branch's own precision (3 decimals for BHD, 2 for SAR). Where does the currency come from?

**Decision taken:** `Settlement/Account` answers a **store header beside the two arrays** —
`{ storeId, storeName, currencyKey, entries, consumptions }` — and `currencyKey` is what
`formatMoneyIn` draws every figure at. Recorded in `src/core/models/settlement.ts` as an explicit
extension of D8's table, flagged for ticket 274 to settle against SIS.Api.

**Why:** D8's own words are *"treat this table as the shape, and settle the strings against SIS.Api
in the joining ticket"*, and the alternative readings are worse: deriving the currency from the store
code is a rule nobody wrote down, and hardcoding SAR is exactly the silent 2-decimal rounding D10
exists to forbid. A `storeName` on the same header is the same call — the account's heading must name
the branch, and 270 arrives at this screen from a search hit that already knows the name, but a
pasted URL does not.

**Revisit if:** BackOffice 1173 answers the account door with the bare `{ entries, consumptions }` of
D8's table. Then the store header becomes a second (cached) call, not a hardcoded default — a
defaulted currency is the defect, not the extra request.

## Q: The wire's `Consumption` carries `consumedByOperatorId` but no name, while the prototype's journal shows `consumedByName`. Which does the journal render for "who"?

**Decision taken:** the **operator id**, as `Operator {id}`, and no name is invented.

**Why:** D8 is the contract and it carries an id. The prototype's `fake.js` is explicit that names on
a settlement row are a cross-database question it deliberately split two ways (`postedByName`
denormalised, `storeName` resolved at read time) — a consumption's operator was on neither side of
that split, so a name here would be a field this screen assumes rather than reads.

**Revisit if:** 274 finds the live door does carry a `consumedByName`. Then the journal renders it and
falls back to the id, which is a one-line change because the projection already exposes both.

## Q: Which way does the journal sort?

**Decision taken:** **oldest first** — the story of the entry read forward in time, tie-broken by
`settlementConsumptionId` so the order is total and a re-render cannot reshuffle it.

**Why:** the prototype's `auditRows` sorts ascending for the same reason, and 272's audit pane is a
projection of this same journal into one column of time — two panes on one screen that disagreed
about the direction of time would be a defect. It also puts 0455's void directly under the receipt it
voids, which is the one row-pair whose meaning depends on adjacency.

**Revisit if:** a real branch's journal grows past a screenful, at which point newest-first is the
kinder default and the pairing argument has to be re-made with a grouping instead.

## Q: Entry ordering in the grid, given open and closed both render?

**Decision taken:** **open entries first, then closed**; newest `postedAt` first inside each group.

**Why:** the ticket asks for both and for "closed visibly closed". Open entries are the ones a phone
call is about; closed ones are the history behind them. Sorting is still the accountant's to change —
every column is sortable, so this is a landing order, not a constraint.

**Revisit if:** 270's worklist starts deep-linking to a specific closed entry, which would want the
target row on the first page rather than behind the open set.

## Q: `isCapReached` / `GRID_PAGE_SIZE` live in `features/collection/inquiry/cap.ts`, and a feature may not import a feature. Copy or graduate?

**Decision taken:** **copied** into `features/collection/settlement/cap.ts`, with its own
`ACCOUNT_LIMIT = 500` (this ticket's cap, not the inquiries' 2,000).

**Why:** ticket 268's own rubric — *"copying is the cheaper default and matches the neighbours;
graduating is right only if the copy would be the second one and the component is genuinely
identical"*. This is the **second** copy and it is **not** identical: the limit differs, and the
inquiry module's whole docblock argues about a WPF `Limit` box this screen never had.

**Revisit if:** a third area wants the same three lines — the trigger 268 already honoured once for
`ScreenGate`.

## Q: With no door yet (270 owns search and the worklist), how does a branch get reached?

**Decision taken:** a **`?store=` search param** on the existing route, read with `useSearchParams`.
No picker, no dropdown, no fixture menu.

**Why:** the ticket forbids growing a branch picker to test itself and offers "a route param or a
fixture selector". The `?acr=` drill-down on `CashCollectionsPage` (257) is the same idiom in the same
area — *the URL is the scope's only home* — so 270's search hit and worklist row become ordinary
links, and a pasted address reproduces the view.

**Revisit if:** 270 rules the account a separate route (`/collection/settlement/:storeId`) rather
than a mode of this one. The projection and the components are unaffected either way; only the Page's
three lines of param reading move.

## Q: D8 lists the account door as `GET Settlement/Account?storeId=…` and nothing else, but D3 says the door applies a 500-row `TOP`. Does the client name that limit on the wire?

**Decision taken:** yes — `settlementApi.account()` sends `{ storeId, limit: ACCOUNT_LIMIT }`, and
`ACCOUNT_LIMIT` is the same constant `isCapReached` measures the answer against.

**Why:** the banner and the door have to agree about one number or the banner is measuring one cap
while the server applies another — at which point it either cries wolf or stays silent on a truncated
branch, which is the failure `cap.ts` exists to prevent. `buildQuery` drops the param harmlessly if
the door does not read it, so the cost of being wrong here is zero and the cost of being silent is a
phone call about an entry that never arrived.

**Revisit if:** 274 finds the door rejects unknown params, or names it something other than `limit`
(the four collection inquiries spell it `Limit`) — a one-word change either way.

## Q: `CONTEXT.md`'s **Store** entry says *"Identified by `storeCode`. Avoid: branch, site, location"*, yet spec 267 and this ticket say "branch" throughout — including in the copy the accountant reads. Which vocabulary wins?

**Decision taken:** **the spec's**, for this feature only. The component is `BranchAccount`, and the
user-visible sentences say *"this branch owes head office"*. Nothing was renamed to `store`.

**Why:** spec 267 is a later, ratified document that uses "branch" as the accountant's own noun in
every one of its 35 user stories, and D9 rules that this screen speaks the branch's language — the
till screen the branch manager reads at 23:00 says *branch*, not *store*. Renaming the screen's copy
to match a glossary entry written for a different concern would make the two halves of one feature
disagree in front of a user. The **wire** vocabulary is untouched: every identifier that crosses the
API boundary is `storeId`/`storeCode`, exactly as the glossary requires.

⚠️ **This is a real conflict and not a resolved one.** `CONTEXT.md` also has no entry at all for
*settlement entry*, *consumption*, *journal*, *orphan*, *shortage* or *surplus*, and currently lists
"settlement" only as a word to **avoid** under **Deposit**. That is a `/domain-modeling` job for the
wave, not a rename this ticket should make unilaterally.

**Revisit if:** `/domain-modeling` rules for "store" across the settlement feature too. Then it is a
mechanical rename of one component, one prop and six i18n values — and it should be done in one act
across 269–273 rather than drifting in slice by slice.

## Q: This ticket builds against fixtures. Do the components read the fixture directly, or the real door?

**Decision taken:** the components read the **real door** through `settlementApi.account()`, and the
fixture is served **over the wire** by the drive — the shape 262–265 used and `acr-fixture.ts`
established.

**Why:** a screen wired to a fixture import is a screen whose loading, error and empty branches are
never exercised, and 274 would then be rewiring rather than joining. The fixture module is shared by
`vitest` and the drive so the six hostile branches are one set of bytes, not two.

**Revisit if:** nothing foreseeable — this is the wave's established shape.
