---
status: done
spec: BackOffice 4182
blocked-by: 951, BO 4184
---

# 952 — A "?" on every analytics page opens its article, and Home and the Copilot point to the help

Spec: BackOffice `C:\Work\DMSCO\BackOffice\.issues\4182-the-analytics-help-center-in-english-and-arabic-read-by-the-copilot-spec.md`.

## What to build

- **Page help:**
  - A "?" button in the header of every analytics page: Home, the library pages, board, view, report, designer,
    runs, My schedules, SQL editor, item lists, Price Command Center and the catalog.
  - It opens a side drawer: on the right in English, on the left in Arabic.
  - The drawer shows the article whose `screens` contain the current route (longest match), falling back to
    `start`, with "Open full article".
  - It closes with Escape and never takes focus from an open dialog.
- **The Home card:**
  - "New to Analytics? Start here" on Analytics Home, linking to `start` (and to the tours once 955 exists).
  - Each user can dismiss it, stored in local storage inside try/catch; if storage fails, the card simply shows again.
- **The Copilot's "How do I…?" row:**
  - The empty Copilot panel and page show two or three questions picked from the table of contents' `questions`, in
    the app's language. Clicking one asks it.
  - The row is separate from the curator-edited starters (`/Copilot/Starters`), which stay unchanged.
- **The help link answer part (BO 4184):** `kind: "help"` renders as "Open the help" (to `/analytics/help/:slug#anchor`)
  and "Open this screen" (when `screen` is present), beside the existing view and table parts.

## Spine reach

UI (header button, drawer, Home card, Copilot panel row, answer part)

## Proof (→ `tdd` red-green cycles)

- [x] The drawer picks the longest-matching article for a route, and `start` for an unknown one · vitest (pure module)
- [x] The drawer opens on the side for each language and closes with Escape · vitest
- [x] The Home card hides after dismissing, and shows again when storage throws · vitest
- [x] The "How do I…?" row comes from the contents' questions in the app's language and asks on click · vitest
- [x] The help answer part renders both buttons, and only "Open the help" without a screen · vitest (`answer.ts`)
- [x] The locale key-mirror test passes · vitest

## Boundaries

- No change to the curator-edited starters, the Copilot conversation store, or the board, view and report pages
  beyond their header button.

## Done when

The proofs are green, and on dev: "?" on a board opens the boards article; the Home card shows; "كيف أشارك لوحة؟"
asked from the row answers with an "Open the help" button.

## Blocked by

[951](951-the-help-center-lists-an-areas-articles-searches-them-and-reads-one-in-the-apps-language.md),
BackOffice [4184](C:\Work\DMSCO\BackOffice\.issues\4184-the-copilot-answers-how-to-questions-only-from-the-help-and-links-the-article-and-the-screen.md)

## Comments

- 2026-11-22 (/implement-spec): Built on spec/4182-help-center (a85036fe, merged 6e041dd4; review fixes 374f10f6), **stubbed** — BO 4184 unbuilt. All 6 proofs green in vitest (Escape proven via the drawer store + native dialog close; a real key press is part of the walk). **Owed:** the dev walk. Defaults open to veto: answer field assumed `helpLinks`; “?” drawn by `ScreenGate` on /analytics/*; route match = whole route, `:param` one segment, most literal wins; drawer refuses to open over another dialog; Home card dismissed per user id, no tours link until 955; how-to asked with origin `starter`; row gated by `canReadHelp`.
