# HITL — ticket 523 (Catalogue, Validate, Lookups, ValueMaps, Budgets on the real 2758 doors)

## Q: How does a block read now that HQ's catalogue carries its sentence?
**Decision taken:** A condition or effect reads in HQ's own `sentence` ({en, ar}, the reader's language, English when Arabic is empty), its braced fields filled by type and isolated by kind; the whole HQ sentence is isolated once (`<bdi>`). The bundle's per-type sentences (`sentence.condition.*`, `sentence.effect.*`) are deleted. A field the sentence does not name reads as a bundle clause where one exists (scope, basis, activity, activates/expires, tierPoints) or, for EN + AR text, as a line under the block (role by field name: says → not met, label → receipt label, prompt → cashier prompt).
**Why:** The ticket: "the sentence names its fields in braces"; a catalogue-driven sentence.
**Revisit if:** The owner prefers the bundle's own wording (it read "At least 3 units of sun"; HQ's reads "at least 3 units of sun", and "at least 1 units" for one).

## Q: Palette names: HQ's or the bundle's?
**Decision taken:** HQ's catalogue `name` and group `name` ({en, ar}); `palette.block.*` / `palette.group.*` deleted. Blocks HQ marks `open` (audience) stay out of the palette (505's ruling).
**Why:** Catalogue-driven palette, and HQ already gives both languages.
**Revisit if:** The owner wants the friendlier bundle labels back ("Basket value is at least" vs HQ's "Minimum subtotal").

## Q: Which catalogue does the builder read?
**Decision taken:** Two reads, each kept for the page's life: every feature on (to READ blocks, so a block of a feature switched off still reads as itself, and to say which off feature would add blocks), and the draft's own features (the palette; asked again when they change).
**Why:** A catalogue for the draft's features does not list a block of a missing feature, which would then read "a block this screen cannot read".
**Revisit if:** HQ prefers one read.

## Q: A new block's defaults
**Decision taken:** HQ's `example`: its figures, choices, yes / no and texts (e.g. count 2, "not met yet", label "Offer"). Its SAMPLE identifiers are left out — `code` and `codes` (store S101, channel CASH, coupon HAYAK*, activity BONUS…), `budget`, and a sample filter (an effect points at the rule's first filter). A group starts empty.
**Why:** The ticket says `example` gives the defaults; /code-review showed the sample codes would silently target store S101.
**Revisit if:** HQ adds real `default`s per field, or wants the label / "not met" text blank.

## Q: The ƒx helper's guide (fields, functions, recipes, operators)
**Decision taken:** HQ's catalogue has none, so the guide moved from the invented catalogue into `src/core/rules/formula-guide.ts` unchanged (522 had re-cut it to the checker's paths). **BO ask F (new):** carry the formula guide (readable paths, functions, recipes) in `Rules/Authoring/Catalogue`.
**Why:** No door exists; the helper must keep working.
**Revisit if:** HQ adds the guide to the catalogue.

## Q: Validate — when is the unsaved campaign checked?
**Decision taken:** Once the rules on screen differ from the saved ones and have not changed for 600 ms, `Validate { campaign, tree? }` is sent with the whole unsaved campaign (and the draft's tree). The pill and the ƒx helper read that answer; while the rules equal the saved ones, the draft's own `validation` is read (no call). The ƒx helper shows the issues whose path is the value's path.
**Why:** The ticket: "the helper validates the whole draft (debounced) and filters the issues to its path".
**Revisit if:** HQ finds the call rate too high; the delay is one constant.

## Q: Settings ▸ Offline — Validate or the draft's validation?
**Decision taken:** Kept on the saved draft's `validation.offline` (Drafts/Load and Save answer the same Validate reply, with the draft's tree). No extra call.
**Why:** The page saves the whole draft; its verdict is of the saved draft.
**Revisit if:** The owner wants the verdict to follow the unsaved "online only" box before saving.

## Q: Countries and channels (no lookup — BO ask E)
**Decision taken:** Fixed client lists, marked PROVISIONAL in `src/core/rules/lookups.ts`: countries SA, BH; channels POS, CC, SD, CMRC (the prototype's), with names in the bundle. The simulator's channel select uses the same list (its lookup door is gone). A code a campaign already holds that is not listed stays shown.
**Why:** The ticket: "Audience keeps a fixed list for those". The BO catalogue gives the audience fields no `values`.
**Revisit if:** BO ask E lands, or the channel words differ (HQ's catalogue example says CASH).

## Q: ValueMaps/Upload — where in the UI?
**Decision taken:** A new Settings ▸ Value map page (between Budgets and Offline): meaning and unit, a CSV file read by HQ, the entries (first 10 listed), and the page's own Save, which saves the whole draft with the map HQ returned. A refused file lists HQ's lines (`where`: message) and changes nothing.
**Why:** No value-map UI existed; Settings pages are where a campaign setting is edited, and every Settings page saves the whole draft.
**Revisit if:** The owner wants it inside the builder, or an auto-save on upload.

## Q: Budgets view on a live campaign
**Decision taken:** Read from `Rules/Authoring/Budgets { campaign }` (the newest version's budgets). A campaign-wide budget reads used / limit in force with a bar; a per-key budget reads "N in all (K counted), at most L each" with no bar (HQ sums over keys); `held` shows beside used; the overshoot is HQ's. The budget sentence reads the limit in force while the draft counts what the live version counts. A budget the live version does not declare shows no count. The drawer's live/draft mode is fixed when it opens. SetLimit refetches the budgets.
**Why:** The contract's shape (summed, per-key limit, `held` new).
**Revisit if:** HQ adds a per-key maximum ("busiest member") to the view.

## Q: A bare 403 on the builder's doors
**Decision taken:** Named in our words ("You do not have the rule-author permission (RuleAuthoring)…") through `refusalText` / `isBareDenial` on the builder, Settings refusals, the checks pill and the lookup picker. The drives stub a missing grant as a bare 403 for Catalogue, Lookups and Budgets (their contract has no other refusal).
**Why:** Wave rule: "apiErrorMessage must still show something sensible".
**Revisit if:** —

## Q: Material search under three characters
**Decision taken:** Not sent; the picker says "Type at least three characters". (HQ refuses it with `RULES_BAD_LOOKUP`.)
**Why:** The contract.
**Revisit if:** —
