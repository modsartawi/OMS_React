# HITL — ticket 504 (the rule builder reads each rule as sentences)

I re-read the brief at the start of 504. It still has **no contract section**, so the block catalogue door is the runner's provisional one (`GET RuleCampaign/Catalogue`), and its shape is mine.

## Q: What does the block catalogue look like?
**Decision taken:** `RuleBlockCatalogue = { groups: [{key, kind}], blocks: [{ type, kind, group, feature, decided, variant?, fields: [{ key, kind, options?, unitFrom?, role?, clause?, default?, plural? }] }] }`, in `core/models/rule-campaign.ts`. A field's `kind` (items, money, count, days, discount, points, code, codes, text, choice, choices, formula, timing, budget, flag, says) decides how `core/rules/sentence.ts` formats it. `variant` names the field that picks the wording (`minSubtotal.basis`), `unitFrom` the sibling that holds a unit (`discount.kind`, `points.unit`), and `clause` marks an optional trailing part (", at most SAR 40.00").
**Why:** The ticket says sentences are built "from the block catalogue (types, fields, units, palette groups)". A field-kind catalogue lets a new block that HQ adds render once its locale keys exist, and keeps per-type code out of the client.
**Revisit if:** BackOffice 2758 sends display hints in another form, or none (then `variant` / `unitFrom` / `clause` move into a client-side table keyed by type).

## Q: Where do the wording and the stub catalogue live?
**Decision taken:** The templates live in `campaign-workspace.json` under `sentence.*` (by block: `sentence.<condition|effect>.<type>[.<variant>]`, `sentence.clause.<type>.<field>`, `sentence.option.<type>.<field>.<value>`). The stub catalogue is `CATALOGUE` in `tools/campaigns-fixtures.mjs`. The vitest proof imports that same file (typed by a new `tools/campaigns-fixtures.d.mts`), so the test and the drive read ONE copy of the sample campaigns and the catalogue.
**Why:** The ticket says "Sentence templates live in the namespace JSON". One fixture copy means a re-point in 520 cannot leave the test and the drive disagreeing.
**Revisit if:** The simulator (514) or sessions (518) need to show sentences. The renderer (`workspace/SentenceView.tsx`) and the `sentence.*` keys would then graduate to `core/rules` with a namespace of their own.

## Q: What currency is a campaign's amount in?
**Decision taken:** The provisional campaign carries no currency, so `campaignCurrency` reads it from `audience.countries`: SA → SAR, BH → BHD (three decimals). An audience that spans both, or names neither, shows the figure with no code and its own decimals (`formatMoneyOfUnknownCurrency`). A points unit that is itself a currency code (`unit: 'SAR'`) is used as it stands.
**Why:** The prototype's BH-SPEND10 is in BHD only because its audience is Bahrain. Guessing SAR for a two-country campaign would silently lose a fils.
**Revisit if:** 2758 puts a currency on the campaign (or per amount). Then `campaignCurrency` is deleted.

## Q: How does a filter name read, and which category is named?
**Decision taken:** A filter shows as its name (in `<bdi>`), then a chain of pills: what it looks at, then category / collection / product codes, then "not …". Only A006 is named in words ("Prescription A006"), through `RX_CATEGORY` in `core/rules/sentence.ts`. Every other category and collection shows as its code. The red "Rx not excluded" flag is left to 506, as the ticket split says.
**Why:** Category and collection names come from HQ lookups, which are 506's. A006 is a ruled domain constant.
**Revisit if:** 506 adds the lookups. The chain should then show names (it can, through a `name` value).

## Q: Where do the EN + AR texts sit?
**Decision taken:** Under the block's sentence, never inside it: one line per text, with its role ("If not met, the till says", "On the receipt", "The cashier is prompted", "The message"), the English in `<bdi>` and the Arabic in `<bdi dir="rtl" lang="ar">`. An empty Arabic half says "No Arabic yet."
**Why:** The brief requires both languages wherever the value is read. A two-language value inside an English sentence would read badly under either direction.
**Revisit if:** The owner wants the receipt label inside the sentence, as the prototype has it (English only).

## Q: Is the catalogue cached for the session?
**Decision taken:** It is a TanStack query with `staleTime` and `gcTime` set to Infinity. It is read once per page load and shared by every builder page (the drive asserts one read across two campaigns).
**Why:** The ticket says "fetched once and cached". The catalogue changes only with an HQ release.
**Revisit if:** HQ can change the catalogue at runtime (a feature flag, for example). Then give it a finite `staleTime`.

## Note: 501's drive check 5 changed
501's check 5 said the side menu shows only Dashboard. With 504 the Rule builder lands, so the check now expects Dashboard and Rule builder. Coupons still waits for 515. The drive's console filter now also ignores a stubbed 5xx refusal (504's refused catalogue is a 503), as it already ignored a 4xx.

## Note: the workspace breadcrumb
The app's breadcrumb reads "Campaigns / Campaigns / SUN-3FOR2" on the builder page too. It does not name the workspace page. This was there before 504 (it is 501's), so I left it alone.

## Q: Does the one-line summary show only on a collapsed card (as in the prototype)?
**Decision taken:** It shows in the card's header all the time, open or closed, as three pills (filters, conditions or "always", effects). It does not use the prototype's " · " join.
**Why:** The ticket asks for "collapsible cards, each with a one-line summary". A summary that never moves keeps the header steady when the card is toggled. Pills avoid a separator literal between counts.
**Revisit if:** The owner wants the prototype's behaviour (summary only while collapsed).

## Q: Are Collapse all / Expand all, the named values and the "short of points" line in scope?
**Decision taken:** Yes. All three are in the prototype's builder (`RuleBlock`, `RuleBuilder`). Collapse all / Expand all appear only when a campaign has more than one rule.
**Why:** The prototype governs layout. Leaving the values out would hide what an effect's "back" or "pts" means.
**Revisit if:** The owner wants 504 kept to filters, When and Then only.

## Q: What does a block whose number is not set yet read like?
**Decision taken:** It reads in its plural form, with "not picked yet" in the number's slot ("At least not picked yet units of sun"). No sample campaign has such a block. 505's panel is where one would appear while it is being edited.
**Why:** It is better than claiming the block cannot be read, which was the code review's finding.
**Revisit if:** 505 wants a separate "incomplete" wording for a half-filled block.

## Note: codes shown as codes
`createCoupon.from`, `valueMap.map` and `freeProduct.sku` show the wire's code (WKND20, PCUT-SA01, GIFT-BAG). The prototype looks up a name for them. Those lookups (campaigns, value maps, materials) are 506's or 2758's doors, so they are not added here.
