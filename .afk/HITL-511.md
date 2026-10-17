# HITL — 511 (approval by role)

## Q: How does the client learn the caller's role?
**Decision taken:** `GET RuleCampaign/Roles` → `{ author: boolean, approver: boolean }`; one person may hold both and then sees both sets of acts. A refused roles door shows its message + code, offers no act, and a Try again.
**Why:** 2759's Ua permissions are unwritten; two flags fit "author" and "approver" without guessing permission codes.
**Revisit if:** 2759 exposes Ua permission codes (then 520 maps them) or forbids self-approval (the server refuses; nothing to change client-side).

## Q: Which acts in which state?
**Decision taken:** draft → author: Ask for approval, Delete draft (only if never published). Waiting → approver: Activate, Send back. Live → approver: Disable. Disabled → nothing. Approver never asks/deletes; author never activates/sends back/disables.
**Why:** the ticket's ruled states; fewest acts consistent with them.
**Revisit if:** the owner wants Re-enable on a disabled campaign, or an approver to activate a draft directly (the prototype allowed it).

## Q: Disable while changes wait over a live version?
**Decision taken:** not offered — the approver sends back first, then disables the live campaign.
**Why:** disabling from waiting would drop the pending request with nowhere to go (disabled offers nothing).
**Revisit if:** an urgent stop must not wait for a send back (then offer Disable and decide what happens to the request).

## Q: Is Activate gated like Ask for approval?
**Decision taken:** yes — both need at least one saved rule and HQ's checks of the saved draft with no error; a check that cannot be read blocks both (fail closed). The dialog re-reads the gate while open.
**Why:** both send the SAVED draft; the prototype draws no main button while errors stand.
**Revisit if:** an approver must be able to activate over HQ's errors (the server would still refuse).

## Q: What are "the pending changes" an approver sees?
**Decision taken:** the draft's rules (name, condition and effect counts) with a link to the rule builder, and whether it is a first version or replaces live version N. No diff against the live version.
**Why:** no contract carries the live snapshot; versions are 512's.
**Revisit if:** 2759 / 512 gives a live snapshot — then show what differs.

## Q: Notes
**Decision taken:** Ask: optional note. Send back: required note. Activate: optional version-history note (prototype). Disable: no note (body sends `note: ''`). 500 characters max. A sent-back draft carries `sentBack {by, at, note}` (new optional field) and the author reads it on the State.
**Why:** the ticket asks for the ask and send-back notes; the rest follows the prototype.
**Revisit if:** 2759 names the fields differently or wants a reason on Disable.

## Q: Pre-activation steps
**Decision taken:** four steps — named in BOTH languages, valid rules (a rule + checks with no error), a schedule (either bound set), a budget. Shown only until first published. Each ticks, or links to its page once landed; Settings pages (509/510) are unlinked until then (`pageLanded` in menu.ts). Only the rules step gates approval.
**Why:** ticket's list ("named, rules valid, schedule set, budgets considered"); EN+AR is required data in this wave.
**Revisit if:** the owner wants "schedule set" to mean an end date (the prototype's test) or "named" to mean English only.
