---
status: open
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

- [ ] `Home renders recent, pinned and certified from the Home door` · vitest
- [ ] `pin toggle is optimistic and rolls back on refusal` · vitest
- [ ] `runner Home has no New buttons` · vitest

## Boundaries

Web only, against the 3443 wire (stub until it lands).

## Done when

Proofs green; on staging, opening a board puts it on Home and pinning it shows it under Pinned in another browser.

## Blocked by

[839](839-the-analytics-menu-has-one-leaf-per-library-page.md), BackOffice [3443](C:/Work/DMSCO/BackOffice/.issues/3443-analytics-home-lists-my-recent-opens-my-pins-and-the-newest-certified-items.md)
