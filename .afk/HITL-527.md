# HITL — ticket 527 (support sessions on the real 2760 doors)

## Q: What does "a new requestId per press" mean when a press got no answer?
**Decision taken:** Settled default applied: every press of "Cancel the session" mints a new id (`mintRequestId()`, the repo's wrapper over `crypto.randomUUID()`). The one exception is a retry of a press that may have landed (a network drop, a 5xx, or an unreadable answer). That retry re-sends the SAME id with the reason locked, so HQ answers `repeated: true` and nothing moves twice. A refusal in the envelope, or a bare 403, mints a new id.
**Why:** The ticket wants a double press to be a `repeated` that moved nothing. A fresh id on a retry after a lost answer would instead get `RULES_SESSION_CANCELLED` and hide the rollback. `crypto.randomUUID` alone is undefined over plain http (`core/util/request-id.ts`).
**Revisit if:** The owner wants a strictly fresh id on every press, whatever happened before. The fix is to make `pressRequestId` always call `mint()`.

## Q: The cancel reason box
**Decision taken:** Settled default applied: the reason is required and at most 500 characters, counted trimmed as HQ counts it. It is checked before sending, and nothing goes out without it.
**Why:** The brief says `RULES_REASON_REQUIRED`, at most 500 characters.
**Revisit if:** HQ widens the reason.

## Q: Which sessions offer Cancel?
**Decision taken:** Paying, closed and partly returned only. Not open (`RULES_SESSION_OPEN`: it never paid), cancelled or returned. There is no access probe (BO ask B), so a reader without `RuleSupport 02` meets the door's bare 403, which the dialog explains.
**Why:** The brief: "a paying session releases its holds; a closed or partly returned one ... is a full return"; ticket 2779 refuses an open one.
**Revisit if:** BO ask B lands (ticket 529 then gates the button).

## Q: A budget movement's amount has no unit on the wire
**Decision taken:** The amount is shown as HQ sends it ("Held 22 of budget money-cap"), with the budget's id. No currency is added.
**Why:** `RuleSessionMovement` and `RuleBudgetHold` name the budget but not its limit kind (uses, money or points). Guessing money would be wrong for a uses budget.
**Revisit if:** HQ adds the budget's `limit` (or name) to the movement. That is a small **BO ask** on 2760.

## Q: The list's money columns and the member have no source
**Decision taken:** Dropped from the list: member, gross, discount, net. Added: coupon, ruleset, opened, paid, closed. The detail header computes before / discount / net from `cart.lines[].netBeforePromotion` and `effects[].amount`, rounded to the session's decimals, and shows nothing without a cart.
**Why:** `RuleSessionSummary` carries no money and no member. Showing nothing beats inventing.
**Revisit if:** Support needs the member or the totals on the list. That would be a **BO ask** to add them to the summary.

## Q: The Campaigns tab without a trace
**Decision taken:** The 2760 lookup has no per-campaign trace or version. The tab now reads what each campaign gave (discount, free units, points), what it holds, the codes it created and the refusals it was answered. Then come the sale's own refusals, the campaign coupon with its refunds, and the points posted. Outcome is "Applied" or "Refused" only.
**Why:** The lookup's `effects`, `points`, `holds`, `createdCoupons` and `refusals` are all it answers. 518's not met / skipped / lost came from an invented trace.
**Revisit if:** HQ adds the evaluate `trace` to the stored reply. That would be a **BO ask** on 2760.

## Q: The list's size
**Decision taken:** Every list asks `take=500` (HQ's maximum), sends one day as `from` alone, and the status bar says when the 500 cap is reached.
**Why:** HQ's default of 100 would silently cut a busy store's day.
**Revisit if:** HQ adds paging.

## Q: The store picker when the reader lacks the builder's grant
**Decision taken:** The picker still reads the builder's store lookup (ticket 523 re-points it). If that lookup fails, the page shows why (HQ's message, or "you do not hold its grant" on a bare 403) and offers a text box for the store code.
**Why:** Grant mismatch: `Lookups/stores` is under `RuleAuthoring 02`, which a `RULE_SUPPORT` reader does not hold. Without the fallback, support could not list sessions at all.
**Revisit if:** BO gives support a store list under `RuleSupport 03`. That is a **BO ask**, similar to ask C.
