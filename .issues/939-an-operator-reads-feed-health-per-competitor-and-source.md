---
status: open
spec: BackOffice 4127
blocked-by: 934, BO 4131
---

# 939 — An operator reads feed health per competitor and source

## What to build

The **Feed health** tab (BackOffice spec 4127, decision 8), on the feed-health endpoint extended by BO 4131.

- Per competitor: its authoritative source, enabled, blocked (with reason and the clear action where it
  exists), and its latest runs **per source**: counts, failures, and quota or auth errors.
- **Cross-check** flags (two sources disagree above the margin) with the example materials, each linking to the
  drill-down.
- The nightly effective-price job's last run and its watched count.
- The authority setting per competitor, changeable with the Manage grant (BO 4128's endpoint), with a
  confirmation that names what changes ("Mindsite's prices will count for Panda; our scraper's will not").

Spec: `C:\Work\DMSCO\BackOffice\.issues\4127-price-command-center-release-1b-mindsite-as-a-second-source-the-page-and-the-product-grid-spec.md`.

## Spine reach

UI (feed-health tab, wire types, api)

## Proof (→ `tdd` red-green cycles)

- [x] runs are shown per source per competitor · component test
- [x] a cross-check flag lists its materials and links them · component test
- [x] the authority change asks for confirmation and sends the setting, and is hidden without Manage · component test

## Boundaries

Needs BO 4131 (and 4128 for the authority setting).

## Done when

Proofs green, and the tab walked on dev.

## Blocked by

[934](934-the-price-command-center-page-opens-on-the-price-alerts-with-accept-and-dismiss.md), BackOffice [4131](C:\Work\DMSCO\BackOffice\.issues\4131-feed-health-shows-each-source-and-flags-where-the-two-sources-disagree.md)

## Comments

**2026-11-22 — built (branch `t939-feed-health`), stubbed; dev walk + BO 4131/4128 owed.** Proofs green
(`feed-health.test.ts`, 17 tests), drive `tools/price-feed-health-drive.mjs` 33/33 against stubs. Status stays open for
the dev walk and for the BO doors below.

- **No door clears a block (ruling).** `GET PriceWatch/FeedHealth` carries `isBlocked`/`blockedAt`/`blockReason` but
  SIS.Api has no clear door — the scraper's operator clears it in the database. The tab shows the block and its reason
  only, with a sentence saying the screen does not lift it. If BO adds a door, the action goes in `CompetitorFeed`.
- **GUESSED (BO 4131) — per-source runs, cross-check, effective-price job.** Modelled as OPTIONAL fields on the shipped
  `PriceWatchFeedHealth` (`core/models/price-watch.ts`, Feed health section, `⚠ GUESSED` block):
  `crossCheckMarginPercent`, `effectivePriceJob`, and per competitor `authoritativeSource`,
  `runsBySource[{ source, lastRun{…, errorMessage, isQuotaOrAuthError} }]`, `crossCheck{ disagreements, examples[] }`.
  Today's server (none of them) still renders: one "Latest run (source not reported)" row per competitor, no cross-check,
  no job, no setting (drive step 6). Reconcile against 4131 as shipped.
- **GUESSED (BO 4128) — the authority setting door.** `PUT PriceWatch/Competitors/{competitor}/AuthoritativeSource`
  `{ source: 'SCRAPER'|'MINDSITE' }` → the competitor setting; refusal `PWT-00050` (`PRICE_FEED_HEALTH_ERRORS.sourceUnknown`)
  guessed too. The current authority is read off the feed health (`authoritativeSource`); the setting is offered only with
  Manage AND when the server reports the authority. Confirmation on the core confirm dialog (`confirmAction`), sentence
  `feedHealth.change.message` with every value `fsi()`-wrapped: "Mindsite's prices will count for Panda; our scraper's
  will not. …" Nothing is sent on No, or when the picked source already counts.
- **Merge note (936).** Cross-check materials link through ONE local pair: `materialHref()` (`feed-health.ts`, today
  `/analytics/price-command-center?material=<n>`) and `CrossCheckMaterial` (`FeedHealthTab.tsx`). Swap both for 936's
  drill-down link helper at the merge.
- Cross-check prices are formatted with `formatMoney` (2 dp): the guessed example carries no `currency`.
