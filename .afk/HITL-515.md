# HITL — ticket 515 (campaign coupons: create random / universal / personal batches)

## Q: Is a coupon's `until` inclusive (last day it works) or exclusive like the campaign schedule's `until`?
**Decision taken:** Inclusive — "Valid until" is the last day the code works; from = until (a one-day code) is allowed, until before from is refused. Documented on `RuleCampaignCoupon.until` / `RuleCouponValidity`.
**Why:** A marketer reads "valid until 30 Nov" as including 30 Nov; the prototype's "expiry" wording was ambiguous.
**Revisit if:** BackOffice 2755 defines coupon validity as exclusive like the schedule (then rename the field or shift the check in `coupon-form.ts`).

## Q: Are pasted member ids upper-cased?
**Decision taken:** No — ids are sent exactly as typed (trimmed, exact duplicates dropped). The prototype upper-cased them.
**Why:** Changing an identifier's case is HQ's call; nothing says member keys are case-insensitive (code review finding).
**Revisit if:** 2755 says member ids are case-insensitive / always upper-case.

## Q: Who decides a code is `expired`?
**Decision taken:** HQ answers `status: 'expired'` on the wire; the client does not derive it from `until` and a local now.
**Why:** Smallest client guess; HQ already owns redemption state.
**Revisit if:** 2755 stores only unused/used/disabled and expects the client to derive expired.

## Q: Does "lists the campaign's coupon codes and batches" mean a separate batch table?
**Decision taken:** No separate table — the codes grid has a Batch column; a batch id filters the list (`?batch=`) with a clearable chip, as the prototype does.
**Why:** The prototype (governing design) has no batch table; the ticket's Done-when is about the batch id.
**Revisit if:** the owner wants a per-batch summary (count, kind, created) above the codes.

## Q: Codes list size — client-side filtering of every code?
**Decision taken:** GET returns every code of the campaign; search / status / batch filter in the browser (AG Grid), like the prototype.
**Why:** No contract yet; a 5,000-code batch is fine in AG Grid.
**Revisit if:** 2755 pages or filters server-side (ticket 520 re-points `ruleCampaignApi.coupons`).

## Q: Bounds of the create form
**Decision taken:** 1–5,000 codes per batch (prototype), random part 4–16 characters, prefix/suffix up to 8 letters/digits, charsets letters+digits (no 0/O/1/I) / letters / digits; universal code 3–32 letters, digits or dashes (prototype). HQ remains the authority (and refuses an exhausted shape).
**Why:** Prototype values where it had them; conservative small bounds elsewhere.
**Revisit if:** 2755 states other bounds.

## Q: Endpoint names
**Decision taken:** `GET RuleCampaign/Campaigns/{id}/Coupons`, `POST RuleCampaign/Campaigns/{id}/Coupons/Batches`, in `src/core/rules/api.ts` with the mandated PROVISIONAL line plus a note naming BackOffice 2755.
**Why:** One file per door family; 520 re-points.
**Revisit if:** 2755 names them otherwise.

## Note: drive flakiness under machine load
The full campaigns drive (548 checks, ~6 min) timed out in UNRELATED pre-existing sections (501, 503, 510 waits) on three runs while the machine sat at ~97% CPU from other sessions; it passed 548/548 twice when load dropped. Not changed here.
