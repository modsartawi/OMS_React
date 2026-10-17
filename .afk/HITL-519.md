# HITL — 519 (Campaigns ▸ Coupon finder and Customers)

I re-read the brief at the start of 519. It still has **no contract section**, and neither BackOffice 2754 nor 2744 names a door for these screens. So the doors are provisional and live in `src/core/rules/api.ts`:
- `GET RuleCampaign/Coupons/{code}`: one code. An unknown code is refused with 404.
- `GET RuleCampaign/Members?loyaltyId=` or `?mobile=`: the members matching that key.
- `GET RuleCampaign/Members/{id}/Wallet`
- `GET RuleCampaign/Members/{id}/Budgets`

The shapes (`RuleCouponFound`, `RuleMember*`, `RuleWalletCoupon`, `RuleMemberBudget`) are in `rule-campaign.ts`. The stubs are in `tools/support-lookups-drive.mjs`. The ticket's Open-questions default ("provisional, settled in 520") is taken as given.

## Q: Is the finder an exact lookup or a substring search?
**Decision taken:** Exact. One code gives one answer. Before it is sent, the code is cleaned the way codes are stored: upper-case, no spaces (`cleanCode`, moved into `core/rules/coupon.ts`).
**Why:** The ticket says "enter a code and see its campaign…". The prototype's substring search ran over its own in-memory sample data; across SIS.Coupons it would be a different door.
**Revisit if:** Support needs to search by prefix or by member id. That needs a list door with paging.

## Q: Can a mobile number match more than one member?
**Decision taken:** Yes. The members door answers a list. If there are several, the page lists them, and picking one opens that member by loyalty id. The pick is pushed to history, so Back returns to the list. A loyalty id wins if both keys are in the address.
**Why:** It is the conservative choice. A shared family mobile is plausible, and a single-object door would hide the other members.
**Revisit if:** HQ guarantees that mobiles are unique per member.

## Q: In what unit are the points shown?
**Decision taken:** As bare numbers, `formatNumber` of what HQ sends, with three tiles: spend points, tier points and pending. `RuleMemberPoints` has no unit field.
**Why:** The ticket asks for "spend vs tier, pending". The spec says points are awarded "in SAR or PTS", but no contract says which unit the balance is answered in.
**Revisit if:** 520's contract answers the balance in SAR. Then add a currency field and format it as money.

## Q: How does a points budget read?
**Decision taken:** It uses `core/rules/budget.ts`'s existing `budgetFigure`, as the Budgets drawer does (510). Uses is a count; money, points given and points taken are amounts in the campaign's currency.
**Why:** One reading across the screens. 510 settled this.
**Revisit if:** A points budget is counted in PTS. Then `budgetFigure` changes once, for both screens.

## Q: Does "budgets used" list a budget the member has not touched?
**Decision taken:** Whatever HQ answers is drawn, a `0 / N` row included. The empty state reads "No per-member budget counts anything for this member yet".
**Why:** The page does not filter HQ's answer. A 0 row tells support that the budget applies.
**Revisit if:** 2744's door answers only the counters that exist.

## Q: How does a counter at its limit read?
**Decision taken:** Every row has a State: "Used up" at or past the limit, "Available" below it. Past the limit, "Over by X" is also shown, never clamped (ADR 0091). The at-limit rule moved into `budgetUsage` as `usedUp`, at three decimals.
**Why:** Support's question is "why didn't the member get it". The bar and the state answer it.

## Q: Should the screen be called "Customers" when CONTEXT.md says "Loyalty member — avoid: customer"?
**Decision taken:** It is kept as "Customers", with the folder `customers` and the namespace `rule-customers`, because the brief names both (the screen table and the NAMESPACES ruling). Inside the page the person is a "member".
**Why:** The brief is the ruling.
**Revisit if:** The owner wants the leaf renamed "Members".

## Q: Should the coupon's days be formatted?
**Decision taken:** No. They are shown as HQ sends them, a local `yyyy-MM-dd` (isolated with `Ltr`), the same as 515's coupons grid. `formatDay` would parse a bare day as UTC midnight and could shift it in a negative-offset zone. Use moments go through `formatDateTime`, which reads a no-`Z` moment as local.
**Why:** Local time with no parsing round trip.

## Graduated to core (two features need each)
- `core/rules/SaysBoth.tsx`: the EN + AR pair. Sessions and Simulator now import it in place of their identical local copies.
- `core/rules/coupon.ts`: `COUPON_STATUS_SEV` and `cleanCode`, used by the workspace coupons and the finder.
- `core/rules/campaign-state.ts`: `ruleSessionPath`, `campaignCouponsPath`, `couponFinderPath`, `ruleCustomerPath`. Sessions' own `sessionPath` was replaced by the core one.

## Review notes left open
- `/code-review`: a campaign whose id is `coupon-finder` or `customers` is shadowed by the static leaves. Priority, simulator and sessions have the same issue; it follows the layout ruling. Campaign create could reserve these words; that is 520's or the owner's call.
- `/code-review` and `/standards-review`: the two pages repeat the same search-form shell (keyed form, Find again re-reads, hint, loading, refusal). It is left as two small copies, the same as 518's copies.
- `/standards-review`: the triple `campaignId` + `campaignCode` + `campaignName` appears in several provisional wire types. Naming it as a type is left to 520, when the real shapes land.
- `/standards-review`: coupon status and kind labels exist in both `campaign-workspace.json` and `coupon-finder.json`. Namespaces are per feature by rule.
- Under the Arabic UI the chrome is English, because the namespace is en-only by ruling. An owner still needs to eyeball the RTL rendering of the EN + AR pairs.
