# HITL — 514 (Simulator: the rule engine's dry run)

I re-read the brief at the start of 514. It still has **no contract section**, so the door is provisional: `POST RuleCampaign/Simulate` (`src/core/rules/api.ts`). The request is `RuleSimRequest` and the answer is `RuleSimResult` (`rule-campaign.ts`). Stubs: `tools/simulator-fixtures.mjs`. They hold the prototype's six baskets (smoke-engine.js) with the prototype engine's own answers. I ran a COPY of engine.js and data.js in a temp folder to get those answers; nothing ran in BackOffice.

## Q: What does the dry run answer, and who shapes it?
**Decision taken:** HQ answers the priced lines, the totals and ONE flat list of effects. Each effect has `line: number | null`, where null means session-level. HQ also answers a trace per campaign (outcome, reason, group, lostTo, and its rules with each top-level condition met or not) and near misses (`gap` is money, or N items of a filter, plus the `offer` label in EN + AR). The client only groups the effects per line and counts the outcomes (`shapeSimResult`). An effect on a line HQ did not answer is shown at session level, not dropped.
**Why:** ADR 0089 says the client never evaluates. A flat effect list is the smallest guess.
**Revisit if:** 2758 nests the effects under the lines, words the near-miss text itself, or traces nested condition groups.

## Q: Inputs the prototype has that the ticket does not list (coupon code, moment, offline, points offer, editable member profile)?
**Decision taken:** These are left out. The sale is the store, an optional member id (a plain text box: no member lookup door exists before 519), the channel, the local date and time, "include drafts", and one chosen draft (`?draft=<id>`).
**Why:** The ticket lists exactly these inputs.
**Revisit if:** The owner wants a coupon code on the sale (WKND20 / HAYAK10 cannot be tried without one) or the moment (attach / subtotal / check).

## Q: Store and channel defaults?
**Decision taken:** The store starts blank and must be chosen. The channel starts on the first one HQ's channels lookup lists. The date and time start at the local now.
**Why:** Not guessing a store is the conservative choice. Every sale has a channel.
**Revisit if:** The owner wants the reader's acting store preselected.

## Q: A CSV basket with some bad rows?
**Decision taken:** Every row is checked: its format first, then its SKU on the materials lookup (an exact code match). The rows are taken only when EVERY one is good. A bad row is fixed in the text or removed, never dropped silently. Replace and Add are both offered. A repeated SKU adds up. The basket takes at most 100 lines and 9999 units a line. The header is optional (sku/item/material/code, qty/quantity/units). Comma, semicolon and tab files are read.
**Why:** No silent subset. The caps keep a pasted file from firing hundreds of lookups.
**Revisit if:** 2758 gives an exact "check these SKUs" door. Then swap the per-SKU lookups for it. Also revisit if the owner prefers "use the good rows, skip the rest", as the prototype's uploader did.

## Q: "Simulate the working copy"
**Decision taken:** It is a new item in the dashboard's ⋯ menu. It links to `/campaigns/simulator?draft=<id>` (`simulatorPath` in core/rules/campaign-state). That campaign runs as its draft and the others run live. "Run it live instead" drops it.
**Why:** The prototype has this item in the State-cell menu, and a cross-feature jump is a route link.
**Revisit if:** It should be offered only for a campaign that has a draft.

## Q: When does the run happen?
**Decision taken:** On an explicit **Run**, not live on every change (the prototype re-evaluated in the browser). A changed sale marks the result as stale until it is run again.
**Why:** Each run is a call to HQ.
**Revisit if:** The owner wants auto-run with a debounce.

## Note: the BonusBuy banner needs `engine` on the answer
`RuleSimResult.engine` lets the page say that rule campaigns never apply at a bonus-buy store. 2758 may answer this as a refusal instead.

## Q: "Include drafts" together with a chosen draft?
**Decision taken:** It is one or the other. While a draft is chosen, the "every working copy" box is off, and the request never carries both (`simRequest`).
**Why:** The ticket reads "include drafts OR a chosen draft".
**Revisit if:** 2758 defines what both together mean.

## Review notes left open (judgement calls, not fixed)
- `RuleSimGap.of` (the filter's name in "N more items of X") is plain text, not an EN + AR pair. A filter name is back-office text today, so the Arabic line shows the offer only. Revisit this if 2758 makes filter names bilingual.
- None of the six prototype baskets loses a group or hits a budget stop without a coupon code, so the "lost the group to X" and "Budget" trace paths are drawn but not driven. 520's live walk, or a coupon input, would cover them.
- The lines grid shows its money figures with no currency code (the totals carry the code), as other grids in the app do.
