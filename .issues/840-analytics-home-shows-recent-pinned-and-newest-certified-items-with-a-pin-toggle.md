---
status: done
spec: C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md
blocked-by: 839, BackOffice 3443
---

# 840 — Analytics Home shows recent, pinned and newest certified items, with a pin toggle

oms-react half of BackOffice spec 3437 (`C:/Work/DMSCO/BackOffice/.issues/3437-analytics-library-pages-and-the-data-catalog-spec.md`), §G; the server spec is the normative wire.

## What to build

BackOffice spec 3437 §G (Home), user stories 3–7, 16.

- `/analytics` reads `GET Analytics/Home` and shows three sections: Recent (≤10), Pinned, and New in Certified (5),
  plus the ask box and the New buttons (authors only).
- A pin toggle sits on every library row and on the board, view and report pages (`PUT`/`DELETE …/Pin`), with an
  optimistic update that rolls back on a refusal.
- Empty states for each section, in both languages and RTL.
- A link to "All my items" opens the library.

## Spine reach

UI / api / tests.

## Proof (→ `tdd` red-green cycles)

- [x] `Home renders recent, pinned and certified from the Home door` · vitest
- [x] `pin toggle is optimistic and rolls back on refusal` · vitest
- [x] `runner Home has no New buttons` · vitest

## Boundaries

Web only, against the 3443 wire (stub until it lands).

## Done when

Proofs green; on staging, opening a board puts it on Home and pinning it shows it under Pinned in another browser.

## Blocked by

[839](839-the-analytics-menu-has-one-leaf-per-library-page.md), BackOffice [3443](C:/Work/DMSCO/BackOffice/.issues/3443-analytics-home-lists-my-recent-opens-my-pins-and-the-newest-certified-items.md)

## Comments

**2026-11-07 — built (code half), stubbed against the BO spec3437 wire (`AnalyticsHome.cs`).**

- `AnalyticsHomePage.tsx` is the new Home at `/analytics`: Recent / Pinned / New in Certified from `GET Analytics/Home`
  (pure `home-page.ts`: `readHome`, `homeSections` caps 10 / all / 5, `homeNewLinks`), each section with its own empty
  state (en + ar), the ask box, an author's three New buttons, the curator status card, and **All my items**.
- **All my items** = the whole library (what Home was until now) at a new route `/analytics/library`
  (`LibraryPage` gains `'library'`; not a menu leaf — the menu keeps its eight). An old `/analytics?…` link a leaf
  holds still goes to that leaf; one that only narrows otherwise (`who=mine`, a kind, a folder, a search) now goes to
  `/analytics/library` with its choice. The ask box, every New and the status card stay on All my items too.
- Pin toggle (`PinToggle.tsx`, pure `pin.ts`) on every library row, every Home row, and the board, view and report
  pages (hidden in TV mode with the board's other actions). `PUT`/`DELETE Analytics/Items/{id}/Pin` (plural, verbatim).
- Rulings applied: **1** — pin state only from `Home.pinned` (one query, `ANALYTICS_HOME_KEY`); the toggle is disabled
  until Home answers; optimistic patch of that entry, rolled back on refusal, Home re-read when the call lands.
  **13** — a pin's own 404 sentence (`pin.notFound`), else the code's words / server message / `pin.pinFailed|unpinFailed`.
- Proofs: `home-page.test.ts`, `pin.test.ts` (drives the mutation through a real `QueryClient` + `MutationObserver`),
  `library-pages.test.ts` updated for All my items. Drive scenario 840 (stubbed, ltr + rtl) 52/52 with 839.
- **Staging walk owed:** open a board, see it under Recent; pin it, see it under Pinned in another browser.

