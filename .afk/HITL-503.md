# HITL — ticket 503 (start a campaign from a template)

I re-read the brief at the start of 503. It still has **no contract section**, so the templates door (`GET RuleCampaign/Templates`) and the create-from-template door (`POST RuleCampaign/Templates/{id}/Create`) are provisional.

## Q: How does a template store its placeholders? (the ticket's open question)
**Decision taken:** I took the ticket's default (2759's): a template is a campaign draft (`name {en, ar}`, `features`, optional `audience`, `rules`) plus a list of named placeholders (`key`, `label`, `kind: number | pick | choice`, `min`/`max`, `lookup`, `options`, `default`). Inside the draft, a value that is exactly `{ "placeholder": "<key>" }` is replaced whole by the typed value. `{{<key>}}` inside any string (the name, a "not met" message, a receipt label, a rule name, a formula) is replaced by the value as text.
**Why:** It is the ticket's ruling. Two mark forms are needed because a number must stay a number in a block field, while the same value must also read inside the marketer's EN + AR sentences.
**Revisit if:** 2759 picks one mark form or a different token syntax. Only `template-form.ts` (`fillTemplate`) and the PROVISIONAL model change.

## Q: Who fills the template — the client or HQ?
**Decision taken:** The client fills it (`fillTemplate`, the ticket's pure proof). The create body sends **both** the `values` and the filled `draft`. HQ is expected to re-fill the draft from `values` to check it, then mint the code and id.
**Why:** The ticket names a client-side fill as its pure seam. Sending the values as well lets HQ refuse a value out of bounds without trusting the client's draft.
**Revisit if:** 2759 wants the values only (drop `draft` from `RuleCampaignFromTemplate`) or the draft only.

## Q: What is the new campaign called?
**Decision taken:** It takes the template's own name, `{en, ar}`, with the placeholders filled. The dialog shows that name in both languages before Create. There are no name inputs on the template tab. The marketer renames the campaign in Settings ▸ Details.
**Why:** This is the prototype's flow (the name comes from `build()`). Asking for both names again would duplicate the blank tab.
**Revisit if:** The owner wants editable name fields prefilled on the template tab.

## Q: A "category" placeholder: one code or several?
**Decision taken:** A `pick` placeholder uses the builder's own item picker (`LookupPicks`), which takes one code or more. The fixture's description now says "the categories picked". The prototype's version was a single-choice list.
**Why:** The ticket says to use "the builder's field pickers where they exist", and that picker is multi-select (a filter's step matches any of its picks).
**Revisit if:** The owner or 2759 wants a template to be able to say "exactly one". That would need a `maxPicks` on the placeholder.

## Q: Template labels and descriptions are single strings, not EN + AR pairs
**Decision taken:** The template's **name** is `{en, ar}` and both are shown. The one-line **description** and each placeholder's **label** are single strings written by the template's author and shown as data (isolated).
**Why:** The EN + AR rule covers campaign names, "not met" messages, receipt labels and cashier messages, which are what a till or customer reads. Template chrome is only read by a marketer in the back office. Each of those campaign texts *inside* the template draft is still an EN + AR pair with its placeholders filled in both.
**Revisit if:** 2759 makes template labels bilingual, or the Arabic chrome pass needs them.

## Q: The builder's item picker moved to core
**Decision taken:** `LookupPicks` and `useDebounced` graduated from `features/campaigns/workspace` to `src/core/rules/LookupPicks.tsx` and `src/core/util/use-debounced.ts`, because a feature may not import another feature. `LookupPicks` still reads its words from the `campaign-workspace` namespace, where 506 put them. `CampaignStateBadge` is the precedent: it is a core component reading `campaign-list`.
**Why:** Moving its keys into a new shared namespace would rename keys under shipped screens and mint a namespace the wave did not list.
**Revisit if:** A reviewer rules that core must not read a feature namespace. The fix is a `rule-common` namespace for the shared rule components (the badge too).

Two behaviours of the shared picker changed for **every** caller (the filter editor and Settings ▸ Audience as well): Enter in its search no longer submits an enclosing form, and Escape clears the search without closing an enclosing native `<dialog>`. The full campaigns drive (495/495, including 506's and 509's sections) passed after the change.

## Note: a key collision in the mark form
A draft object whose only key is a string `placeholder` is always read as a mark. No block in the catalogue has such a field today. If 2759 keeps the `{ placeholder }` form, it should reserve the key, or use something unlikely such as `$placeholder`.

## Note: the model types do not show a mark
`RuleTemplateDraft.rules` is typed `CampaignRule[]`, so a mark in a typed field (`cats`, a number) is not visible to the compiler. The unit test casts it. I left it this way so the provisional shape stays one type. 520 can split it into a "draft with marks" type and a "filled draft" type once 2759 fixes the format.
