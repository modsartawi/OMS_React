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

## Cache reset — client build (spec 022)

Client slice 3 of spec 022 (the simulator Clear-cache button). Server slices 1–2 (`Pricing/ClearCache`,
the `PricingCache` cache-admin grant, `GET Pricing/CacheAccess`, BBY auto-evict) are **BackOffice**
work, tracked in `C:\Work\DMSCO\BackOffice\.issues\` — the tickets below consume those endpoints.

- [051](051-sim-clearcache-button-gated.md) — theSimulatorShowsAClearCacheButtonOnlyToCacheAdmins · **done** (typecheck/build green; drove gating 3/3 via mocked envelope — live-drive pending SIS.Api) · blocked by: — · dep: BackOffice GET Pricing/CacheAccess + PricingCache grant
- [052](052-sim-clearcache-confirm-clear-toast.md) — clickingClearCacheConfirmsClearsAndToasts · **done** (typecheck/build green; drove confirm/clear/toast + rate-limit 5/5 via mocked envelope — live-drive pending SIS.Api) · blocked by: 051 · dep: BackOffice POST Pricing/ClearCache

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

- [044](044-sim-applied-bby-projection.md) — appliedBonusBuysSplitBuyFromGetByConditionKey · **in-progress** (condition-projection half — IsPrerequisite/IsCondition/ConditionKey/BbyItemIndex — landed in BackOffice `SIS.Pricing.Services`, builds & sim tests pass; unblocks the client "applied N×" count after SIS.Api restart. Structural `Applications[]`/`DiscountKind` split still blocked on the SIS.Pricing.Core package repo) · blocked by: — · dep: SIS.Pricing/BackOffice projection pass-through
- [045](045-sim-promoview-model.md) — promoViewDerivesLinesBlocksAndMissedFromAResult · **done** · blocked by: — · Slice 0 (pure, graceful degradation) · harness 11/11
- [046](046-sim-grid-promo-column.md) — theResultsGridShowsPromoKindAndRolePerLine · **done** (typecheck/build/transform green; live-drive pending SIS.Api) · blocked by: 045
- [047](047-sim-promo-blocks.md) — firedPromotionsRenderAsBuyGetBlocks · **done** (typecheck/build green; drove real component via Playwright — live-drive of split path pending 044) · blocked by: 045
- [048](048-sim-could-have-applied.md) — aMissedPromotionShowsWhyItDidNotFire · **done** (typecheck/build green; drove real component via Playwright 13/13 — found-vs-required meter, would-save, reason, expand, absent-when-empty) · blocked by: 047
- [049](049-sim-progressive-disclosure.md) — aPromotionBlockRevealsTodaysConditionAndPricingDetail · **wontfix** (superseded by map 097 → [103](103-sim-deep-layers-placement.md)) · blocked by: 047
- [050](050-sim-responsive-hybrid.md) — theHybridLaysOutResponsivelyByWidth · **wontfix** (superseded by map 097 → [105](105-sim-responsive-arrangement.md)) · blocked by: 046, 047, 048, 049

## BBY Inquiry screen (map 053)

React rebuild of the WPF `Sartawi.Retail.Pricing.BbyInquiry` screen: read-only Bonus Buy inquiry —
summary grid defaulting to currently-active BBYs, searchable by number or validity-overlap date
range, with a per-row Details modal mirroring SAP "Display Bonus Buy". Destination = **ready spec**
(+ two prototypes). Two backend contracts (list-search + detail-by-number) designed here, built on
SIS.Api separately.

- [053](053-bby-inquiry-map.md) — BBY Inquiry screen · **done** · wayfinder map — destination reached (both prototypes approved; ready for /to-spec)
- [054](054-bby-domain-glossary.md) — Bonus Buy domain model & glossary · **done** · blocked by: —
- [055](055-bbymodel-detail-shape-research.md) — Research: full BbyModel detail shape for the Details modal · **done** · blocked by: —
- [056](056-bby-feature-placement-access.md) — Feature placement, nav & access gate · **done** · blocked by: —
- [057](057-bby-list-search-endpoint-contract.md) — List/search endpoint contract · **done** · blocked by: 054
- [058](058-bby-detail-endpoint-contract.md) — Detail-by-number endpoint contract · **done** · blocked by: 055
- [059](059-bby-list-search-ux-prototype.md) — List + search UX prototype · **done** · blocked by: 054, 057 · [prototype](assets/059-bby-list-search-prototype.html)
- [060](060-bby-detail-modal-prototype.md) — Details modal prototype (SAP "Display Bonus Buy" mirror) · **done** · blocked by: 055, 058 · [prototype](060-bby-detail-modal-prototype.PROTOTYPE.html)
- [061](061-bby-inquiry-spec.md) — Bonus Buy (BBY) Inquiry screen (spec) · **ready** · spec — consumable by /to-tickets

## BBY Inquiry — build (spec 061)

Tracer tickets sliced from spec 061. Tracer = 062 (gate + list-active grid); frontier after it is
{063, 064} (parallel). Every slice ships **code-complete / runtime-blocked** until the SIS.Api `Bby/*`
endpoints (`Bby/Access`, `Bby/List`, `Bby/Detail`, `Bby/GroupingMembers`) are built separately.

- [062](062-bby-inquiry-scaffold-gate-list.md) — bonusBuyInquiryGatesAndListsActiveBonusBuysByDefault · **done** (typecheck/build green; pure harness 10/10; drove gate + active-list + empty/fail-open/denied 14/14 via mocked `Bby/*` envelopes — live-drive pending SIS.Api) · blocked by: — · dep: SIS.Api Bby/Access + Bby/List
- [063](063-bby-inquiry-full-grid.md) — theGridShowsAllTwentyEightHeaderFieldsGroupedWithChipsStickyIdentityAndDetailsAction · **done** (pure harness 23/23; drove full grid 23/23 via mocked `Bby/*` — live-drive pending SIS.Api) · blocked by: 062
- [064](064-bby-inquiry-search-toolbar.md) — searchingByNumberOrDateClearsActiveOnlyAndFiltersByValidityOverlap · **done** (typecheck/build green; pure harness 8/8; drove search toolbar — chip, cap banner, date-error title, Reset — 35/35 via mocked `Bby/*`; live-drive pending SIS.Api) · blocked by: 062
- [065](065-bby-inquiry-csv-export.md) — exportingTheGridWritesAllTwentyEightRawFieldsToCsv · **done** (typecheck/build green; drove Export CSV — 28-col header + raw code/date cells — via mocked `Bby/List`; live-drive pending SIS.Api) · blocked by: 063
- [066](066-bby-inquiry-details-modal.md) — openingDetailsShowsTheHeaderRecapBuyGetOrTotalDiscount · **done** · blocked by: 063 · dep: SIS.Api Bby/Detail
- [067](067-bby-inquiry-grouping-drilldown.md) — groupingRowsOpenAPagedMembersDrilldown · **done** · blocked by: 066 · dep: SIS.Api Bby/GroupingMembers

## POS palette + Document Details rework — wayfinder map 068

Adopt the `Sartawi.POS/View/Themed/PosTheme.xaml` palette as oms-react's standard (retiring the
claude.ai warm neutrals), then rebuild Document Details to match the POS "OMS Detail — reworked"
prototype. Destination is two ready specs. Palette first, screen second — owner ruling.
Reference capture: [assets/068-pos-detail-reference.html](assets/068-pos-detail-reference.html).
All 13 tickets done — wayfinding complete. **Both specs published: 082 (design system) and 083
(Document Details rework).** The map is reached; 083 consumes 082 and must not start until it lands.

- [068](068-pos-palette-and-document-detail-rework.md) — POS palette as the app standard + Document Details rework · **done** · wayfinder map — destination reached, both specs ready
- [069](069-token-surface-inventory.md) — Token surface & call-site inventory · **done** · blocked by: —
- [070](070-pos-token-remap-light.md) — The POS token remap (light) · **done** · blocked by: 069 · [prototype](assets/070-pos-token-remap.PROTOTYPE.html)
- [071](071-pos-token-dark-twin.md) — The derived dark twin · **done** · blocked by: 070 · [prototype](assets/071-pos-dark-twin.PROTOTYPE.html)
- [072](072-command-family-taxonomy.md) — The command-family taxonomy · **done** · blocked by: — · [prototype](assets/072-command-families.html)
- [073](073-detail-layout-with-our-data.md) — The reworked layout, filled with our real fields · **done** · blocked by: 070 · [prototype](assets/073-detail-layout.PROTOTYPE.html)
- [074](074-ag-grid-theme-mapping.md) — AG Grid theme mapping · **done** · blocked by: 070 · [research](assets/074-ag-grid-theme-mapping.RESEARCH.md)
- [075](075-brand-surfaces-reconciliation.md) — What survives of al-dawaa gold & navy · **done** · blocked by: 069
- [076](076-action-bar-grammar.md) — The action-bar grammar for our eight commands · **done** · blocked by: 072, 073
- [077](077-severity-colour-layer.md) — The severity colour layer and the raw-palette sweep · **done** · blocked by: 070, 071, 075
- [078](078-live-document-payload-capture.md) — Capture live document payloads · **done** · blocked by: — · [payloads](assets/078-document-payloads/)
- [079](079-status-severity-mapping.md) — Status value → severity mapping for the pill rail · **done** · blocked by: 078
- [080](080-rtl-mirroring-of-the-reworked-layout.md) — RTL mirroring of the reworked layout · **done** · blocked by: 073 · [prototype](assets/080-rtl-mirroring.PROTOTYPE.html)
- [081](081-rail-card-field-rules.md) — The rail cards' field rules against live data · **done** · blocked by: 079
- [082](082-pos-design-system-spec.md) — The POS design system · **ready** · spec (map 068, 1 of 2)
- [083](083-document-details-rework-spec.md) — The Document Details rework · **ready** · spec (map 068, 2 of 2) · consumes 082

### Design-system build — spec 082

Expand → migrate → contract. 084 expands (tokens; zero `.tsx` churn), 085–088 migrate the consumers,
089 contracts (the gates are green only when the sweep is complete).
**084 done** — the tokens are in and the contrast gate runs on every `npm run lint`; the app now
renders steel-blue neutrals against warm status badges, the expected intermediate state.
**085 done** — every grid now paints from the tokens out of one params block, so the grid can no
longer diverge from `global.css`.
**086 done** — the badge idiom is one component taking a severity; the two feature tone maps (and
the duplicate third) are gone, and `go` found its first consumer in the BBY validity marker.
**087 done** — al-dawaa gold/navy now live only inside the mark: the login Editorial Split swaps its
ground to `--brand-panel` (kickers lose their gold, marks stay gold), the home hero becomes a plain
`--card` tool (watermark + gold kicker dropped), both `text-[#FDC801]` classes and the four brand
`text-white` sites are gone, and the dead `auth.json` `subtitle` key is deleted. `-\[#` is zero across
`src/`.
**089 done — the design-system build is closed.** `npm run lint` runs three gates; the third,
`tools/check-palette.mjs`, fails on a raw palette class, an arbitrary colour value, a `white`/`black`
utility or a bare hex anywhere in `src/` outside `global.css` and the mark. The ticket's open question
was resolved as it recommended: the hex pattern is widened past D-12's `-\[#` to `#[0-9a-fA-F]{3,8}`,
so a colour hidden in a `.ts` string — the one place this app ever hid one — is caught by lint rather
than by review. The four deliberate literals (three `bg-black/50` scrims, the login QR quiet zone)
are file-scoped exclusions carrying their reason inline.

- [084](084-pos-tokens-both-themes.md) — theAppRendersOnThePosTokensInBothThemes · **done** · blocked by: — · slice 0 · + contrast gate
- [085](085-grid-theme-reads-tokens.md) — theGridReadsTheAppTokensInsteadOfItsOwnHexCopy · **done** · blocked by: 084 · one params block · + `tools/grid-theme-drive.mjs`
- [086](086-status-badge-takes-a-severity.md) — aStatusBadgeTakesASeverityRatherThanAClassString · **done** · blocked by: 084 · new `core/ui` primitive · + `tools/status-badge-drive.mjs`
- [087](087-brand-colour-lives-in-the-mark.md) — brandColourLivesOnlyInTheMark · **done** · blocked by: 084 · both kickers + 4 brand `text-white` retired, hero → card
- [088](088-raw-palette-sweep.md) — noScreenSpellsARawPaletteClass · **done** · one pass, 35 files
- [089](089-colour-literal-lint-gates.md) — lintFailsOnAReintroducedColourLiteral · **done** · blocked by: 085, 087, 088 · `tools/check-palette.mjs`, hex gate widened
- [107](107-identity-band-dark-separation.md) — theIdentityBandReadsAsASlabOnTheDarkPage · **open** · blocked by: — · follow-up from [096](096-document-detail-drive.md)'s manual pass · `--brand-panel` separates at 13.54:1 in light but 1.18:1 in dark and is the page's only borderless slab; D-9 sized that step deliberately, but for the login half, not for 091's full-width header

### Document Details build — spec 083

Region by region, each slice taking one region of Screen 2 the whole way down (payload → pure rule →
component → i18n → test). **090 is slice 0**: it bootstraps vitest against the five captured payloads
and cuts the pill rail, retiring the spec's biggest unknown — that rules derived from real data hold
against that data. 093 needs only the runner, so it runs in parallel with 091/092. The action bar is
094 rather than earlier because it is the only region whose change deletes state elsewhere in the
page (`pendingNote`). 095 lands the RTL respellings byte-identical under LTR; 096 is the acceptance
drive.
**096 done — the Document Details rework is closed, and with it map 068.** The rebuilt screen drives
end to end (39/39) with the six region drives still green beside it, and the both-theme pass across
all five captured documents found no arrangement defect. Its one recorded finding is a *design-system*
question, not a screen one: `--brand-panel` is fixed in both themes, so the identity band separates
from the page at 13.54:1 in light and 1.18:1 in dark.

- [090](090-pill-rail-and-vitest.md) — theRailRendersOnlyTheStatusesThatCarryAValue · **done** (vitest bootstrapped, `npm test` 17/17 on the five captured payloads; typecheck/lint/build green; drove the rendered rail 25/25 via `tools/document-rail-drive.mjs`) · blocked by: — · slice 0 · + Status tab removed, header Status group retired early
- [091](091-identity-band.md) — theDocumentNumberIsTheLargestThingOnTheScreen · **done** (`npm test` 28/28; typecheck/lint/build green; drove the rendered band 32/32 via `tools/document-band-drive.mjs` in both themes) · blocked by: 090 · `isExpressDelivery` binds — no contract bug; `DocumentHeader` retired, provenance moved into the disclosure
- [092](092-summary-rail-cards.md) — theScatteredFieldsBecomeFiveCardsOnASummaryRail · **done** (`npm test` 40/40; typecheck/lint/build green; drove the rendered rail 45/45 via `tools/document-cards-drive.mjs` in both themes and across the 900px unstack) · blocked by: 091 · `FieldGroup`/`ShippingAddress` retired; `courierCode` is set on 5/5 so the driver card does NOT collapse on pick-in-store — the rule ships as written, the gloss was wrong; the address panel's GPS + Google-Maps link left the screen with it
- [093](093-items-grid-and-jobs-count.md) — theItemsGridSumsItselfAndFlagsASignedDiscount · **done** (`npm test` 56/56; typecheck/lint/build green; drove the rendered grid 23/23 via `tools/document-items-drive.mjs`) · blocked by: 090 · parallel with 091/092 · counts land on ALL four tabs (a lone number on Jobs reads as an anomaly), no count until a deferred collection resolves; the footer label is two pluralised fragments — `1 lines` would have shipped on all five captures; totals round off float dust; the `cellClass` bidi wrap is 095's
- [094](094-action-bar-grammar.md) — theActionBarReadsAsThreeClustersAndATerminalTier · **done** (`npm test` 68/68; typecheck/lint/build green; drove the rendered bar 38/38 via `tools/document-actions-drive.mjs`) · blocked by: 092 · `pendingNote` dies with the standing textarea; the note is captured in each command's own dialog (`NoteDialog` + `NoteField`, `ChangeStoreResult.note`); a reasoned command carries `aria-disabled` (not `disabled`) so it stays focusable enough to explain itself; four new `core/ui/Button` variants carry 072's families; "command cluster" added to `CONTEXT.md`
- [095](095-rtl-mirroring-and-bidi.md) — theLayoutMirrorsCorrectlyBeforeAnyDirSwitchExists · **done** (`npm test` 68/68 unchanged; typecheck/lint/build green; drove both directions 33/33 via `tools/document-rtl-drive.mjs`, and the four region drives re-run green untouched) · blocked by: 091, 092, 093, 094 · new `core/ui/Ltr` on six fields; F1/F2/F4 were already correct from 085/091/093 and are now measured rather than assumed; **F5 has no counterpart in this build** — 073's notched frame became an underline tablist, so there is no notch to respell; `↗` flips to `↖`; `Undo2`/`Reply` on the action bar were never ruled on and stay unflipped for the `dir`-switch effort
- [096](096-document-detail-drive.md) — theRebuiltScreenDrivesEndToEndInBothThemes · **done** (`tools/document-detail-drive.mjs` 39/39; the six region drives re-run green untouched — rail 25, band 32, cards 45, items 23, actions 38, rtl 33; `npm test` 68/68, typecheck/lint/build green) · blocked by: 095 · **no source change was needed** — the pass found no defect; the one finding is recorded, not fixed: `--brand-panel` separates from the page at 13.54:1 in light but **1.18:1 in dark**, and the band is the page's only borderless surface, so the "one dark band" reads as a faint slab in dark — an 082 token decision, not a one-line correction · 090's fold-in note answered: the corpus table folded in, `document-rail-drive.mjs` stays as region evidence

## POS Simulation screen rework — wayfinder map 097

The Simulation twin of map 068: the whole screen — input side and results side — rearranged on the
shipped POS design system (082) into a denser, chip-led device that reclaims the space eleven
bordered cards spend on chrome. **Fresh design, no external reference**; evidence-first (098 before
every design ticket); **arrangement only**, no behaviour change. Destination = one **ready spec**.
Supersedes the two open 043 build tickets (049, 050).

- [097](097-simulation-screen-rework.md) — The POS Simulation screen rework · **done** · wayfinder map · all 11 tickets resolved, fog clear → hand off to `/to-spec`
- [098](098-simulate-payload-capture.md) — Capture live Simulate payloads · **done** · blocked by: — · task · 11 payloads under assets/098-simulate-payloads/
- [099](099-sim-region-question-inventory.md) — What the analyst reads the screen for, region by region · **done** · blocked by: — · grilling · arrangement D approved; 9 frames → 3
- [100](100-sim-chip-vocabulary.md) — The chip vocabulary: what earns a chip · **done** · blocked by: 098, 099 · grilling · two kinds, two hues, chips never act
- [101](101-sim-screen-device-prototype.md) — The reworked screen as one device · **done** · blocked by: 098, 099, 100 · prototype · quiet strip, 3 frames, near-misses in
- [102](102-sim-input-chip-bar.md) — The input chip bar: collapse, expand, edit, stale run · **done** · blocked by: 101 · prototype · one status slot, three states; defaults chip
- [103](103-sim-deep-layers-placement.md) — Where the deep layers live · **done** · blocked by: 101 · supersedes 049 · one idiom + the modal; only trace hides
- [104](104-sim-results-line-anatomy.md) — The anatomy of a result line · **done** · blocked by: 098, 101
- [105](105-sim-responsive-arrangement.md) — How the arrangement behaves across widths · **done** · blocked by: 101, 103, 104 · supersedes 050 · one breakpoint at 900 of work area; floor 1024
- [106](106-sim-rtl-mirroring.md) — Mirroring and bidi for the reworked arrangement · **done** · blocked by: 101, 104 · mirroring clean, 13 Ltr wrappers, 2 icons to flip
- [108](108-sim-bby-details-affordance.md) — The bonus-buy details affordance on a promo card · **done** · blocked by: 101, 103 · both cards · modal in place · ships dark until Bby/Detail lands
- [109](109-sim-i18n-churn-and-test-seams.md) — The i18n churn and the testing seams · **done** · blocked by: 108 · research · 22 retired / 6 renamed / 17 new keys, 6 pure seams, 5 drives
- [110](110-sim-screen-rework-spec.md) — The POS Simulation screen rework · **ready** · spec · synthesized from map [097](097-simulation-screen-rework.md); 80 stories, 6 pure seams, 4 drives to build; sliced into 111–122
- [111](111-sim-aggregate-conditions-under-test.md) — `aggregateConditions` holds its grouping contract under test · **open** · blocked by: — · spec 110 · prefactor · safety net before 116 grows its blast radius
- [112](112-bby-detail-modal-to-core.md) — The bonus-buy detail modal answers from `@/core/` · **open** · blocked by: — · spec 110 · prefactor · file move, zero behaviour; i18n namespace unchanged
- [113](113-sim-run-strip.md) — The run strip collapses the determination into chips and processes from there · **open** · blocked by: 123 · spec 110 · **slice 0** · + the work-area `@container` · drive port 5199
- [114](114-sim-status-slot.md) — The status slot marks a stale run and an in-flight one · **open** · blocked by: 113 · spec 110 · the rework's only new component · drive port 5199
- [115](115-sim-result-line.md) — The result line reads its money in the corrected order · **open** · blocked by: 113, 123 · spec 110 · 7 columns; blank not 0.00; W ⇒ not priced · pure only
- [116](116-sim-line-expansion.md) — A result line expands its rules and elements in place · **open** · blocked by: 111, 115, 123 · spec 110 · dissolves 2 components and the last AG Grid · drive port 5200
- [117](117-sim-promotions-rail.md) — The promotions rail shows fires and near-misses beside the lines · **open** · blocked by: 115, 123 · spec 110 · near-misses reinstated; card prints its line list · drive port 5201
- [118](118-sim-bby-details-affordance.md) — A promotion card opens its bonus buy details · **open** · blocked by: 112, 117, 123 · spec 110 · gate `probed && screenAllowed`; ships dark · drive port 5202
- [119](119-sim-responsive-arrangement.md) — The arrangement stacks the rail above the results below 900 px · **open** · blocked by: 116, 117 · spec 110 · container queries; pure shed order · drive port 5203
- [120](120-sim-non-result-states.md) — The screen's non-result states: pre-run, manual conditions, and the whole-run failure · **open** · blocked by: 113, 123 · spec 110 · manual conditions self-open; 400 replaces the work area · drive port 5204
- [121](121-sim-rtl-mirroring.md) — The reworked screen mirrors, spends two hues, and carries no retired key · **open** · blocked by: 115, 116, 117, 119 · spec 110 · absorbs 122; 13 `Ltr` wrappers + the ledger close-out · drive port 5205
- [122](122-sim-hue-and-key-audit.md) — The screen spends two hues and carries no retired key · **wontfix** · blocked by: 116, 121 · spec 110 · merged into [121](121-sim-rtl-mirroring.md) to remove a build wave
- [123](123-sim-i18n-key-expand.md) — The simulation namespace carries every new key before any slice needs it · **done** · blocked by: — · spec 110 · **expand half** · 27 keys minted, nothing retired; vitest key-ledger test
