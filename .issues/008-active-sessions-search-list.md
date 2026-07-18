---
status: done
spec: 006
blocked-by: 007
---

# 008 — searchingLiveSessionsListsMatchingRowsCappedAt50

## What to build

The search box becomes live: typing an employee id, part of a name, a store code, or an IP and
searching runs a server query for matching **live sessions** and renders them in the monitoring
table. Each row is an `ActiveSessionRow` — User (id + display name), Store, Channel badge, Started,
Last seen (relative + absolute, a dormant last-seen visually marked), IP, Client (user-agent,
truncated). Rows are ordered most-recently-seen first. States: empty (no query yet), loading,
no-matches, and the **"first 50 of N — refine to narrow"** cap note when the true match count
exceeds the 50-row page.

## Spine reach

model (`ActiveSessionRow`) · api (search) · helpers (lastSeen relative-time format, query builder)
· component (grid + empty/loading/no-match/cap states) · i18n

## Proof (→ `tdd` red-green cycles)

- [x] `sessionsQueryDropsBlankParams` — building the `Sessions` query from a term omits
  null/empty params · pure (in-memory when runner lands; typecheck + drive until then)
- [x] `searchRendersMatchingRowsAllColumns` — a term renders matching sessions with every column ·
  component (RTL, stub `api.search`) / drive
- [x] `overFiftyMatchesShowsCapNote` — `isCapped` renders "first 50 of N — refine to narrow" ·
  component / drive

Runner not installed — verify via `npm run typecheck` + drive. Prior art: `ua-admin` grid + cap
note (`grid.capped`).

**Verified (2026-07-18):** `npm run typecheck` + `npm run build` + boundary lint green. Pure
seam lives in `helpers.ts` (`buildSessionsQuery` drops a blank/whitespace term; `isDormant`
per-channel web>45m/mobile>8h; `relativeTime` buckets last-seen). Drove the real app with the
network stubbed at Playwright (BackOffice `GET Sessions` not built yet): empty state before
search; a term renders matching rows with all seven columns (User id+name · Store · Channel badge ·
Started · Last seen rel+abs with a dormant row marked · IP · Client truncated); `isCapped` →
"first 50 of 128 — refine to narrow" over 50 rows; no-matches state; menu leaf visible with the
grant. 15/15 checks passed, no page errors. Search is term-driven only — the term-less "All live"
view is deferred to its chip in ticket 009.

## Boundaries

- **External dep (BackOffice):** `GET UaAdminWeb/Sessions?term=&skip=0&take=50` →
  `{ rows, totalMatches, rowCap, isCapped }`, server-side search + 50-cap.
- New model `ActiveSessionRow` in `src/core/models/` = `ActiveSessionModel` fields + `displayName`.
- New `active-sessions` i18n keys (columns, states, cap note).
- All calls through `@/core/api`; failures via `apiErrorMessage`.

## Done when

Typing a term and searching lists matching live sessions with all columns and the cap note;
`npm run typecheck` green.

## Blocked by

[007](007-active-sessions-screen-access-spine.md)
