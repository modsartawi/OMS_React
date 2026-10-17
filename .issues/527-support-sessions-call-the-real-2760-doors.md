---
status: done
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

- [x] `timeline_mergesCallsMovementsAndBudgetEvents` oldest first · pure (`sessions/timeline.test.ts`)
- [x] `cancel_newRequestIdPerPress` · pure (`sessions/cancel.test.ts`)
- [x] sessions drive re-stubbed, green; cancel requires a reason · flow (`tools/sessions-drive.mjs`, 73/73 on the real doors' stubbed shapes)

## Done when

Sessions calls only the three real doors, and its drive is green stubbed.

## Comments

**Done 2026-10-17 (AFK).** Sessions now calls only `GET Rules/Support/Sessions`, `GET Rules/Support/Session` and
`POST Rules/Support/Cancel`; `sessionAccess()`, `ruleSessionAccessQuery` and the `RuleCampaign/Sessions*` doors are
gone, and the session types moved out of the provisional `rule-campaign.ts` into `core/models/rule-session.ts`,
named as SIS.Api answers them (`RuleSupportService` + SIS.Rules 1.0.10 `SessionReply`/`Cart`/`UnitEffect`/...).

- **Model:** list rows are `RuleSessionSummary`; the detail is the whole `RuleSessionLookup`. A never-set stamp
  (`null`, or `0001-01-01`) is never shown.
- **Logic:** `timeline.ts` merges `calls` + `movements` + `budgetEvents` (refusals carry no time: each call shows its
  own reply's). New pure `session-read.ts` groups the per-unit effects into cart rows, totals and per-campaign rows;
  new pure `cancel.ts` holds the reason rule, the per-press request id and the refusal map.
- **UI forced by the shapes:** the list loses member / gross / discount / net (the summary has none) and gains coupon,
  ruleset, opened / paid / closed. The header's money is computed from the cart and the effects. The Campaigns tab
  shows what each campaign gave, held, created and was refused (no per-campaign trace or version in the lookup),
  plus the sale's own refusals, the coupon and the points posted. Cancel is offered on paying / closed / partly
  returned only (`RULES_SESSION_OPEN`: an open session holds nothing).
- **Cancel:** a reason box (required, ≤ 500 trimmed); a new request id per press via `mintRequestId()` (the repo's
  wrapper over `crypto.randomUUID()`, which is undefined over plain http), except that a retry of a press that may
  have landed (network / server / unreadable answer) re-sends the same id with the same reason, so HQ's
  `repeated: true` is shown as "nothing moved now". A stale refusal re-reads the session and the lists and disables
  Confirm. A bare 403 says which `RuleSupport` grant is missing (cancel, list and detail).
- **Drive deletions:** the old §13 ("without the permission / when the access door fails, no Cancel is drawn") is
  gone with the `SessionAccess` door; §14 (bare 403 explained) replaces it until BO ask B (529). Old §8's outcomes
  applied / not met / skipped / lost and the per-campaign version have no source in the 2760 lookup (no trace): §8
  now checks gave / refused / created / coupon / points.

**Outstanding (not this ticket's):** the live drive against SIS.Api (520). Owner sign-off on the settled defaults
logged in `.afk/HITL-527.md`. **Grant mismatch:** the store picker reads the builder's `Lookups/stores` under
`RuleAuthoring 02`, which a `RULE_SUPPORT` reader lacks, so the page falls back to typing the store code (523
re-points the lookup and should keep that fallback). An Arabic eyeball is owed for the en-only namespace.
