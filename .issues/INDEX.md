# Issues index

`oms-react`'s local issue tracker. Conventions: `docs/agents/issue-tracker.md`.
One line per issue under its effort heading. Numbers start fresh at `001`.

<!-- Format:
- [NNN](NNN-short-slug.md) — <title> · **open**/**done** · blocked by: NNN, NNN | —
-->

## Active Sessions admin screen (map 001)

- [001](001-active-sessions-admin-screen.md) — Active Sessions admin screen · **open** · wayfinder map
- [002](002-active-sessions-endpoint-gap-and-contract.md) — Active-sessions endpoint gap & contract · **done** · blocked by: —
- [003](003-active-sessions-access-grant.md) — Which access grant gates the Active Sessions screen? · **done** · blocked by: —
- [004](004-active-sessions-design-mock.md) — Interactive design mock for the Active Sessions screen · **done** · blocked by: 002
- [005](005-active-sessions-screen-spec.md) — Lock the Active Sessions screen spec · **done** · blocked by: 003, 004
- [006](006-active-sessions-screen-spec.md) — Active Sessions admin screen (spec) · **ready** · spec — consumable by /to-tickets
- [007](007-active-sessions-screen-access-spine.md) — activeSessionsScreenGatesOnItsOwnGrant · **done** · blocked by: — · dep: BackOffice Sessions/Access + grant seed
- [008](008-active-sessions-search-list.md) — searchingLiveSessionsListsMatchingRowsCappedAt50 · **done** · blocked by: 007 · dep: BackOffice GET Sessions
- [009](009-active-sessions-chips-counts.md) — channelAndIdleChipsFilterWithServerCounts · **done** · blocked by: 008 · dep: BackOffice Sessions/Counts
- [010](010-active-sessions-revoke-one.md) — revokingASessionSignsTheDeviceOut · **done** · blocked by: 008 · reuses Sessions/Revoke
- [011](011-active-sessions-revoke-all-for-user.md) — revokeAllForUserSignsAPersonOutEverywhere · **done** · blocked by: 008, 010 · dep: BackOffice Sessions/RevokeAllForUser
- [012](012-active-sessions-freshness.md) — theMonitorAutoRefreshesAndShowsFreshness · **done** · blocked by: 008

## Web POS Simulation screen (BackOffice map 484 / spec 503)

Client port of the WPF POS Simulation pricing harness. Server slice is BackOffice 509 (`Pricing/Simulate`
+ `Pricing/Access` + `POS_SIMULATION_ADMIN` grant) — **done**. Moved here from BackOffice `.issues/510–513`.

- [013](013-web-sim-screen-tracer.md) — POS Simulation screen: enter a basket, Process, see priced results · **done** · blocked by: — · dep: BackOffice 509 Pricing/Simulate + Access (done)
- [014](014-web-sim-condition-cards.md) — Pricing detail with expandable condition cards + statistical toggle · **done** · blocked by: 013
- [015](015-web-sim-bonusbuy-elements.md) — Bonus-buy tabs + pricing elements · **done** · blocked by: 013
- [016](016-web-sim-editable-grids.md) — Editable items + manual-conditions grids · **open** · blocked by: 013

## POS Simulation stale-BBY cache reset (map 017)

Prevent false pricing feedback from SIS.Api's server-side `"Pricing"` FusionCache serving a stale
BBY after re-download. Destination is a decision/spec (server + client). WPF cleared it in-process;
React needs a new `Pricing/*` endpoint.

- [017](017-sim-stale-bby-cache-reset.md) — POS Simulation stale-BBY cache reset · **done** · wayfinder map — spec ready for /to-tickets
- [018](018-cache-bust-endpoint-feasibility.md) — SIS.Api cache-bust feasibility: endpoint + FusionCache API + download path · **done** · blocked by: —
- [019](019-cache-bust-scope.md) — Whole-cache clear vs targeted BBY eviction · **done** · blocked by: 018
- [020](020-cache-bust-trigger-surface.md) — Where the cache-bust is triggered · **done** · blocked by: 018
- [021](021-cache-bust-blast-radius-auth.md) — Shared-cache blast radius & who may clear it · **done** · blocked by: 019
- [022](022-cache-reset-spec-lock.md) — Lock the stale-BBY cache-reset spec · **done** · blocked by: 019, 020, 021 · [spec](022-cache-reset.SPEC.md)

## Web Back-Office Notification Center (map 023)

Bell + badge + list + deep-link + banner + claim (receive) and a channel-targeted broadcast/compose
screen (send), over `SIS.Api Notifications/*` polling. Backend NC (issues 164–172) already ships the
contract; the web BO caller (no `registerid`) is already a `User+All` audience. Destination = ready spec.

- [023](023-web-notification-center.md) — Web Back-Office Notification Center · **done** · wayfinder map — destination reached (spec 031 ready)
- [024](024-nc-backend-contract-for-web.md) — Notification Center backend contract for the web client · **done** · blocked by: — · [research](024-nc-backend-contract-for-web.RESEARCH.md)
- [025](025-web-identity-session-fit.md) — Web app identity & session fit for the NC · **done** · blocked by: — · [research](025-web-identity-session-fit.RESEARCH.md)
- [026](026-receive-side-parity-scope.md) — Receive-side parity scope for the back-office · **done** · blocked by: 024, 025
- [027](027-broadcast-channel-model.md) — Broadcast channel/audience model · **done** · blocked by: 024
- [028](028-access-gating-and-grants.md) — Access gating & grants (bell + compose screen) · **done** · blocked by: 024
- [029](029-nc-bell-panel-compose-ux.md) — Bell / panel / compose UX prototype · **done** · blocked by: 026, 027 · [prototype](029-nc-bell-panel-compose-ux.PROTOTYPE.html)
- [030](030-nc-spec-shape-and-lock.md) — Lock the NC spec shape & hand off to /to-spec · **done** · blocked by: 026, 027, 028, 029
- [031](031-web-notification-center-spec.md) — Web Back-Office Notification Center (spec) · **ready** · spec — consumable by /to-tickets

## Web Notification Center — build (spec 031)

Tracer tickets sliced from spec 031. Two independent chains: **Receive** (032→033→{034,035}, layout/
chrome) and **Send** (036→{037,038}, features/admin). AFK plan: [NC-AFK-HANDOFF.md](NC-AFK-HANDOFF.md);
overnight blockers: [NC-MORNING-REPORT.md](NC-MORNING-REPORT.md).

- [032](032-nc-bell-poll-badge.md) — theBellPollsAndShowsAnUnreadBadge · **code-complete** (typecheck green; runtime-blocked, SIS.Api down) · blocked by: — · dep: GET Notifications/Poll (+ api.get header passthrough)
- [033](033-nc-panel-list.md) — theBellOpensAPanelListingAnnouncementsNewestFirst · **code-complete** (typecheck green; runtime-blocked) · blocked by: 032
- [034](034-nc-read-state.md) — readingAnItemDropsTheUnreadCount · **code-complete** (typecheck green; runtime-blocked) · blocked by: 033 · dep: POST Notifications/{id}/Read
- [035](035-nc-arrivals-sonner.md) — aFreshArrivalRaisesAToastAndBumpsTheBadge · **code-complete** (typecheck green; runtime-blocked) · blocked by: 033
- [036](036-nc-compose-send-store.md) — composingABroadcastSendsItToAStore · **code-complete** (typecheck green; runtime-blocked) · blocked by: — · dep: POST Notifications
- [037](037-nc-fleet-confirm.md) — sendingToTheWholeFleetAsksForConfirmation · **code-complete** (typecheck green; runtime-blocked) · blocked by: 036
- [038](038-nc-compose-access-gate.md) — theComposeScreenIsHiddenWithoutTheBroadcastGrant · **code-complete** (client + backend built; runtime-blocked) · blocked by: 036 · dep: GET Notifications/Access (backend ADDED — BackOffice pricing2 dc73ba1f)

## Simulation applied-promotion visibility rework (map 039)

Rework how the POS Simulation screen shows per-line results + the promotions that fired: promo
visible without clicking each line, buy→get shown as relationships (1+1 free, 50%-off-2nd), today's
full detail preserved for advanced users via progressive disclosure. Destination = **approved
sketches** (spec + build are a later effort). Buy→get data is present-but-unused; no backend work.

- [039](039-sim-promo-visibility-rework.md) — Simulation applied-promotion visibility rework · **done** · wayfinder map — destination reached (B+C hybrid approved)
- [040](040-sim-promo-shape-taxonomy.md) — Promo-shape taxonomy & response-field mapping · **done** · blocked by: — · [taxonomy](040-sim-promo-shape-taxonomy.TAXONOMY.md)
- [041](041-sim-results-promo-sketch.md) — Sketch the reworked results-and-promo surface · **done** · blocked by: 040 · [prototype](041-sim-results-promo-sketch.PROTOTYPE.html) · chose B+C hybrid
- [042](042-sim-promo-hybrid-lock.md) — Consolidate the B+C hybrid & lock the direction · **done** · blocked by: 041 · [sketch](042-sim-promo-hybrid-lock.PROTOTYPE.html) · APPROVED
- [043](043-sim-promo-visibility-spec.md) — Simulation applied-promotion visibility rework (spec) · **ready** · spec — consumable by /to-tickets

## Simulation promo-visibility — build (spec 043)

Tracer tickets sliced from spec 043. Two chains meeting at the pure view model: **backend projection**
(044, own repo) + **frontend surface** (045 pure `promoView` → 046 grid column / 047 blocks →
{048 missed, 049 disclosure} → 050 responsive). Slice 0 = 045 (pure, in-memory, degradation path first).

- [044](044-sim-applied-bby-projection.md) — appliedBonusBuysSplitBuyFromGetByConditionKey · **open** · blocked by: — · dep: SIS.Pricing/BackOffice projection pass-through
- [045](045-sim-promoview-model.md) — promoViewDerivesLinesBlocksAndMissedFromAResult · **done** · blocked by: — · Slice 0 (pure, graceful degradation) · harness 11/11
- [046](046-sim-grid-promo-column.md) — theResultsGridShowsPromoKindAndRolePerLine · **done** (typecheck/build/transform green; live-drive pending SIS.Api) · blocked by: 045
- [047](047-sim-promo-blocks.md) — firedPromotionsRenderAsBuyGetBlocks · **done** (typecheck/build green; drove real component via Playwright — live-drive of split path pending 044) · blocked by: 045
- [048](048-sim-could-have-applied.md) — aMissedPromotionShowsWhyItDidNotFire · **open** · blocked by: 047
- [049](049-sim-progressive-disclosure.md) — aPromotionBlockRevealsTodaysConditionAndPricingDetail · **open** · blocked by: 047
- [050](050-sim-responsive-hybrid.md) — theHybridLaysOutResponsivelyByWidth · **open** · blocked by: 046, 047, 048, 049
