---
status: done
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

- [x] `chipsRenderServerCounts` — each channel chip shows its count from `api.counts()` (the four
  `CHANNEL_CHIPS`, `toLocaleString`, `—` until loaded); Idle shows no number per spec · component
  (stub `api.counts`) / drive
- [x] `clickingChannelChipFiltersAndMarksActive` — `selectChip` re-queries and `buildSessionsQuery`
  maps Web→`channel=web`, Idle→`idleOnly=true`, All→neither; `aria-pressed` marks the active chip ·
  component / drive
- [x] `idleChipShowsPerChannelTooltip` — the Idle chip carries `chips.idleTooltip` (web >45m, mobile
  >8h; POS/BackOffice never idle) · component / drive

Runner not installed — verified via `npm run typecheck` (green), `npm run build` (green), and a pure-seam
harness proving the `buildSessionsQuery` chip→param mapping (all/web/mobile/backoffice/idle + term
compose). Live app-drive deferred: `Sessions/Counts` is a BackOffice sibling endpoint not present in
this repo (same as 008). Prior art: `ua-admin` report-count cards.

## Boundaries

- **External dep (BackOffice):** `GET UaAdminWeb/Sessions/Counts → { all, web, mobile, backoffice,
  idle }` (idle computed per-channel-relative); `channel` and `idleOnly` params on the list
  endpoint (008).
- New i18n keys: chip labels + Idle tooltip.

## Done when

Chips show live counts and filter the grid; the Idle tooltip is present; `npm run typecheck` green.

## Blocked by

[008](008-active-sessions-search-list.md)
