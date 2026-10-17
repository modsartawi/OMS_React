---
status: done
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 501
---

# 518 — Support lists sessions, reads one's events, cart and campaigns, and cancels it with the rollback shown

## What to build

**Campaigns ▸ Sessions** (new feature `features/campaigns/sessions/`) lists customer sessions by **store, date
(local) and status**, and can look one up by **sale id**. A session's detail has three tabs:

- **Events:** every call (moment, requestId, cartVersion, reply), holds, journal movements, budget events
  and refusals;
- **Cart items:** each line with its effects and its unit allocation;
- **Campaigns:** each campaign's outcome, so "why didn't I get the offer" has an answer.

**Cancel session**, shown only to support holding the permission, asks for confirmation and then shows the **rollback**: budgets
released, coupon uses refunded, created codes disabled, points reversed.

## Spine reach

model/api (list, lookup, cancel) · logic (event timeline shaping) · component (list, detail tabs, cancel
dialog) · i18n (`rule-sessions`) · test

## Proof (→ `tdd` red-green cycles)

- [x] `sessionTimeline_ordersCallsAndMovements_byLocalTime` · pure — `src/features/campaigns/sessions/timeline.test.ts` (9 cases: merge + oldest-first, times compared as times, call → refusal → movements at one moment, HQ's order kept, an offset read locally, unreadable last, stable keys) plus `session-query.test.ts` (URL filter, cancellable statuses, Back path)
- [x] drive: filter by store/date/status → detail tabs → cancel shows the rollback (stubbed) · flow — `tools/sessions-drive.mjs` 56/56 against vite :5199, every door stubbed at Playwright (list, one session, SessionAccess yes/no/failing, Cancel refused once then answered)
- [ ] OWNER: Arabic-UI eyeball of the EN + AR pairs (marketer names, not-met messages, labels, refusal reasons)
- [ ] OWNER: sign-off on the HITL defaults (.afk/HITL-518.md: Cancel hidden on returned, no reason asked, store required)
- [ ] LIVE: the real BackOffice 2760 doors + Ua grant — ticket 520

## Boundaries

Provisional endpoints + a new Ua permission (BackOffice 2760), stubbed. A server message inside an event is passed through as data in
`<bdi>`.

## Done when

The drive opens a session's three tabs and cancels it with the rollback shown.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)

## Outcome (2026-10-17)

Built on `spec/2737-rule-engine-screens`. `features/campaigns/sessions/` at `/campaigns/sessions` and
`/campaigns/sessions/:saleId`, plus a Sessions leaf in the Campaigns group (ungated). The provisional
`RuleSession*` types are in `core/models/rule-campaign.ts`, and the four doors are in `core/rules/api.ts`
(`RuleCampaign/Sessions…`, `RuleCampaign/SessionAccess`), all PROVISIONAL for 520. CONTEXT.md gains
**Customer session**. Gates: typecheck, vitest 330/5474, lint (4 gates) and build are green. Decisions are
in `.afk/HITL-518.md`.
