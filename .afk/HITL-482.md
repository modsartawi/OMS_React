# HITL — ticket 482 (Deliverect delivery platforms and terms)

## Q: Page layout — one page or tabs?
**Decision taken:** One page at `/deliverect/terms`, three sections top to bottom: Deliverect accounts (read only), Delivery platforms (a Terms button picks one, an Edit button opens the reason dialog), and the picked platform's terms timeline. The picked platform rides the URL (`?platform=KEY`); with none, the first platform listed is shown. Plain tables, not AG Grid (three to a dozen rows each).
**Why:** The ticket's three parts in its own order; small lists need no grid.
**Revisit if:** Platforms grow past a screenful, or the owner wants tabs.

## Q: Timeline order and "current"
**Decision taken:** Oldest first by `validFrom`; the row with `validTo` null is marked "Current" (briefing ruling), its valid-to reads "Open". A future-dated open row is still the one marked current.
**Why:** Briefing: "marks the row with validTo null as current".
**Revisit if:** Finance wants "current" to mean "in force today" (then a future open row would read "Scheduled").

## Q: The overlap hint — which dates are flagged?
**Decision taken:** `termsConflict` flags (a) a date inside a closed row, both ends included; (b) the open row's own first day; (c) a date before a later row (before every row, or in a gap). A date after the open row starts is fine. The hint never blocks: the server's DLV-00008 is shown inline at the date. Under a flagged date the note does not name a closing date.
**Why:** The briefing names "inside an existing row"; (b) and (c) are the other dates whose new open-ended row would overlap one. Goes beyond the briefing's wording (spec review flagged it).
**Revisit if:** 2627 accepts a back-dated row in a gap (then (c) would be a false alarm, still non-blocking).

## Q: What do the add-terms fields start with?
**Decision taken:** The open row's numbers (money at 3 decimals); the date empty. A stored value the fields could not send back unchanged (>3 decimals, exponent) starts empty — never rounded. A platform with no row starts empty. Currency is carried, not typed: the open row's, else the latest row's, else `SAR`.
**Why:** A correction is a new row, usually a small change; never silently alter a rate.
**Revisit if:** Finance prefers empty fields.

## Q: Client-side field rules (no ranges in the contract)
**Decision taken:** Every terms field required; numbers ASCII, non-negative, at most 3 decimals; a percentage at most 100. Channel id: a whole number (safe integer), zero allowed. Display name required. Credit customer: trimmed, blank sent as `null`.
**Why:** Conservative floor; the server stays the judge.
**Revisit if:** 2627 names ranges (e.g. negative discount, more decimals on %).

## Q: Active without a credit customer
**Decision taken:** The Active box cannot be ticked while the credit customer is empty, and the dialog says "A platform with no credit customer cannot be active: its orders would be refused." If the user clears the credit customer of an active platform, the box is NOT flipped for them: Save is blocked with the same sentence plus "Untick Active, or enter a credit customer."
**Why:** Ticket + briefing; never change a flag the user did not touch.
**Revisit if:** —

## Q: No "add platform"
**Decision taken:** No create affordance for a platform: the contract has only GET and PUT.
**Why:** Contract; spec story 7 is "adding configuration rows", not a screen.
**Revisit if:** 2627 adds a POST.

## Contract gap

- **PUT Platforms / POST Terms answers are unspecified.** 482 reads nothing from them and refetches (platform list / timeline). **Ask:** name them.
- **PUT Platforms refusals are not listed.** Any refusal shows in the dialog with its code (DLV-00009 inline at the reason). **Ask:** list them (e.g. the "active without a credit customer" refusal's code).
- **Terms field ranges are not named** (see the field-rules ruling). **Ask:** state them.
- **Back-dated / gap `validFrom`.** The contract says only "overlaps an existing row". **Ask:** is a `validFrom` before the latest row always DLV-00008? The drive's stub refuses any date on or before the latest row's start — re-check at 483.
- (Carried from 477/479, no new ask) Accounts and Platforms behind `canManageTerms` — this page holds that grant, so no fallback is needed here.

## Review notes
- /code-review, applied: "first terms" only for an empty timeline; no closing date named under a flagged date; read failures no longer reuse the access sentence; prefill never invalid/rounded (`termsDraftFrom`); `Timeline` keyed by platform (no dialog carry-over); channel id must be a safe integer; `day()` returns its Date; the catalog drive asserts the full leaf list. Not applied: `money()` and the table class strings copied from orders/stores (features may not import each other; the area copies).
- /standards-review, applied: overlap fallback text; one number-field list (`TERMS_NUMBER_FIELDS`); `currentRow` / `termsCurrency` / `money` moved into the pure module (tested). Not applied: the `keep(…, money)` boolean, `DEFAULT_CURRENCY` in the feature (only consumer), inline timeline query (sibling pattern).
- Drive: one of six terms-drive runs failed "ONE probe call" right after a source edit (vite hot reload during the first load); the five runs since are 80/80.

## Outstanding (not AFK's)
- Live doors on staging (483, BackOffice 2627).
- Owner sign-off: the overlap hint's extra cases, the prefill, the field ranges, "current" = open row.
- Owner's eye on the Arabic rendering (the app's `lng` stays `en`; the RTL drive proves direction and isolation only).
