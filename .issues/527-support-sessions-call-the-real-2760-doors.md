---
status: open
spec: BO 2737 (brief § HQ contract: support sessions (2760))
blocked-by: —
---

# 527 — Support sessions call the real 2760 doors

Split out of [520](520-the-rule-campaign-screens-call-the-real-doors-on-staging.md) on 2026-10-17. Its
model is separate from the campaign's, so it does not wait on 522.

## What to build

Re-point 518:

- **`GET Rules/Support/Sessions?storeCode=&from=&to=&state=&take=`** replaces `RuleCampaign/Sessions?store=
  &date=&status=`. States are `open|paying|closed|partiallyReturned|returned|cancelled`. A range is
  possible, so the one-day picker can stay (send `from` only).
- **`GET Rules/Support/Session?sessionId=`** replaces `Sessions/{saleId}`. The reply has `session, calls,
  cart, effects, points, returned, holds, movements, budgetEvents, refusals, coupon, createdCoupons,
  pointsActivities`, and **holds and budget events come as separate lists**, which answers 518's ask.
  Rebuild `timeline.ts` from `calls` + `movements` + `budgetEvents`. A stamp never reached is `null`.
- **`POST Rules/Support/Cancel { sessionId, requestId, reason }`**: ⚠ **the reason is required** (at most
  500 characters, `RULES_REASON_REQUIRED`), which overrules 518's "asks no reason" default. A **new
  `requestId` per press** (`crypto.randomUUID()`), so a double press is a `repeated: true` that moved
  nothing. The reply `{ reply, rollback, repeated, session }` shows the rollback and swaps in the session.
  Refusals by code: `RULES_SESSION_CANCELLED`, `RULES_SESSION_CLOSED`, `RULES_SESSION_OPEN` and
  `RULES_REQUEST_ID_REUSED`.
- **`SessionAccess` has no door.** The grants are `RuleSupport[03]` / `[02]`, and a missing grant is a
  bare 403. Until BO ask **B** (see 520) lands, show Cancel and let a 403 say why. Remove `sessionAccess()`.

## Spine reach

model (session shapes) · logic (timeline) · api · component (cancel dialog gains a reason) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `timeline_mergesCallsMovementsAndBudgetEvents` oldest first · pure
- [ ] `cancel_newRequestIdPerPress` · pure
- [ ] sessions drive re-stubbed, green; cancel requires a reason · flow

## Done when

Sessions calls only the three real doors, and its drive is green stubbed.
