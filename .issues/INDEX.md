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
- [014](014-web-sim-condition-cards.md) — Pricing detail with expandable condition cards + statistical toggle · **open** · blocked by: 013
- [015](015-web-sim-bonusbuy-elements.md) — Bonus-buy tabs + pricing elements · **open** · blocked by: 013
- [016](016-web-sim-editable-grids.md) — Editable items + manual-conditions grids · **open** · blocked by: 013
