# HITL — ticket 525 (the simulator on `Rules/Authoring/Simulate`)

## Q: HQ prices nothing in a dry run. Where does a typed line's money come from?
**Decision taken:** Each typed line gets a **unit price** box (before promotions, in the sale's currency). The line's `netBeforePromotion` is price × quantity at the currency's decimals, `gross` = net, `vatRate` 0, `unit` EA, `fee` false, `attributes` {}. A price with more places than the currency has holds Run back. It is never rounded silently, for example after switching BH → SA. Run waits until every line has a price.
**Why:** The cart line carries its own net (`RuleBuilderService.SimulateAsync` uses `line.NetBeforePromotion`). The materials lookup has no price. The VAT rate and gross defaults are HQ's own CSV defaults (`BasketCsv`).
**Revisit if:** HQ adds a price to the materials lookup, or the owner wants the VAT rate typed.

## Q: A line's category
**Decision taken:** The first word of the materials lookup's `detail` ("A002 Beauty" → `A002`). The stub's `detail` was re-cut to HQ's real "code name" form.
**Why:** Filters match categories, so a line with no category would never be reached. HQ's `detail` is `ACode + " " + ADesc` (BO test `MaterialLookup_BySkuOrName`).
**Revisit if:** **BO ask G (new):** give a material hit its category code as its own field.

## Q: The sale's country, currency and decimals
**Decision taken:** A Country select (the audience's fixed list SA, BH; BO ask E), defaulting to SA. The currency and decimals follow it (`campaignCurrency` + `currencyDecimals`: SA → SAR 2, BH → BHD 3). The country is NOT tied to the store picked.
**Why:** The request needs `country`, `currency` and `decimals`, and the stores lookup carries no country (`detail` is the engine).
**Revisit if:** **BO ask H (new):** the stores lookup answers each store's country. Until then, a Bahraini store left on SA runs as a Saudi sale, and HQ does not object.

## Q: The store select lists at most 50 stores
**Decision taken:** Kept 514's select over `Lookups/stores { q: '' }`. HQ answers at most 50 hits.
**Why:** Re-point, not redesign. The same limit was there before.
**Revisit if:** The estate has more than 50 open stores. Swap in a searching picker that sends `q`.

## Q: The member's profile, coupons, points and offers
**Decision taken:** The request sends `profile: { loyaltyId, tier: '', earning, firstPurchase, points: 0, audiences: [] }`. A walk-in sends an empty `loyaltyId`, never null. Two checkboxes are added: "earns points" (on) and "first purchase" (off). Two optional fields are added: coupon codes (space- or comma-separated) and points to redeem (a whole number). An offer in the reply has "The customer says yes", which puts its `flag` in the next run's `flags`.
**Why:** HQ reads a known member's tier and points (`ResolveProfileAsync`), but `earning` and `firstPurchase` are the request's. Sending `earning: false` silently would show no member points. The brief says to send the flag back in `flags` on the customer's yes.
**Revisit if:** The owner wants these inputs hidden, or audiences typed.

## Q: "Use every campaign's working copy"
**Decision taken:** Removed. The run is the newest version alone, or one campaign as its saved draft (`?draft=`). A `?draft=` campaign with no saved draft (`source: published`) sends no `draft`, says so, and runs live. A `draft` it lacks would be a 404. A `?draft=` that cannot be read holds Run back and says why.
**Why:** The contract takes `campaign` OR `draft`, never several drafts.
**Revisit if:** HQ adds a multi-draft run.

## Q: The unsaved `campaign` and `tree`
**Decision taken:** Not sent from the simulator page. They are in the model only. A saved draft runs with its own tree (HQ: `tree ?? TreeOf(row)`).
**Why:** The page holds no unsaved campaign. A "simulate what is on screen" from the builder would be new UI.
**Revisit if:** The builder grows a Simulate that sends its unsaved campaign.

## Q: The CSV basket — client pre-check or HQ only?
**Decision taken:** Both. HQ reads the file (`csv`, sent exactly as pasted, with `lines: []`). The page checks it first by HQ's own `BasketCsv` rules:
- comma-separated only;
- a header naming article/material/sku, quantity/qty and net;
- each line by its file line;
- invariant figures, with a sign before or after.

The file is usable only when every line is good. A used file IS the basket, shown read-only (first 100 lines). It is no longer merged into the typed basket ("Add to it" is gone), and "Type a basket instead" goes back. HQ's own refusals (`RULES_BAD_BASKET` by file line, `RULES_DUPLICATE_LINE`) are shown with their code and lines.
**Why:** The ticket ("the CSV goes to HQ as csv", the pre-check "can stay … or go"). Merging is impossible: HQ refuses lines and a csv together.
**Revisit if:** The owner prefers no pre-check, or wants a file converted into typed lines.

## Q: The trace has no campaign names, rules or conditions
**Decision taken:** Each entry shows HQ's `status` and `code` (in our words), the campaign's id, its group's id ("In group g-basket"; null = base), what it gave (`money`) and HQ's `reason` {en, ar}. These go: 514's names, per-rule rows, met / not-met condition rows and group mode. A near miss's gaps now carry HQ's `text`, `says` and `path`.
**Why:** The real `trace` is `{ campaign, group, status, code, money, reason }`.
**Revisit if:** The owner wants names (Drafts/List) or group names (Order) joined in. That is extra reads, and a draft's tree may differ from the live one.

## Q: The bonus-buy note
**Decision taken:** Shown when the store run at has `detail: BonusBuy` in the stores lookup. It now says the rule campaigns do not apply at that store's till until it is flipped. The result itself still shows, because HQ runs a dry run at any store.
**Why:** The reply has no engine field, and "Writes nothing … for any store (its engine is not asked)".
**Revisit if:** —
