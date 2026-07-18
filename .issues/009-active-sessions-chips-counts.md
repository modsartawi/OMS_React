---
status: open
spec: 006
blocked-by: 008
---

# 009 — channelAndIdleChipsFilterWithServerCounts

## What to build

Filter chips above the grid — **All / Web / Mobile / BackOffice / Idle** — each showing a
server-computed count (true totals, independent of the 50-row page). Clicking a chip sets the
active filter (a `channel`, or `idleOnly` for Idle) and re-queries; the active chip is visually
marked. The **Idle** chip is labelled just "Idle" (no fixed number) with a tooltip explaining the
per-channel rule: no heartbeat for web > 45m or mobile > 8h; POS/BackOffice never count as idle
(their idle expiry is disabled).

## Spine reach

api (counts + `channel`/`idleOnly` param) · component (chip row, active state, tooltip) · i18n

## Proof (→ `tdd` red-green cycles)

- [ ] `chipsRenderServerCounts` — each chip shows its count from the counts call · component
  (stub `api.counts`) / drive
- [ ] `clickingChannelChipFiltersAndMarksActive` — clicking Web re-queries with `channel=web` and
  marks the chip · component / drive
- [ ] `idleChipShowsPerChannelTooltip` — the Idle chip carries the per-channel explanation copy ·
  component / drive

Runner not installed — verify via typecheck + drive. Prior art: `ua-admin` report-count cards.

## Boundaries

- **External dep (BackOffice):** `GET UaAdminWeb/Sessions/Counts → { all, web, mobile, backoffice,
  idle }` (idle computed per-channel-relative); `channel` and `idleOnly` params on the list
  endpoint (008).
- New i18n keys: chip labels + Idle tooltip.

## Done when

Chips show live counts and filter the grid; the Idle tooltip is present; `npm run typecheck` green.

## Blocked by

[008](008-active-sessions-search-list.md)
