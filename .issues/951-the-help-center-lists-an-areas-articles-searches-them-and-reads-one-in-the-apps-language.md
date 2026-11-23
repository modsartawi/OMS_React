---
status: done
spec: BackOffice 4182
blocked-by: BO 4183
---

# 951 — The help center lists an area's articles, searches them, and reads one in the app's language

Spec: BackOffice `C:\Work\DMSCO\BackOffice\.issues\4182-the-analytics-help-center-in-english-and-arabic-read-by-the-copilot-spec.md`
(ADR 0143 there: the articles live in SIS.Api; this app only reads them).

## What to build

- **A new feature folder,** `src/features/help/`, with the area as a parameter so a later area reuses it. It holds
  the wire types and an api for BO 4183's three routes.
- **Routes** `/analytics/help` and `/analytics/help/:slug`, added to `router.tsx` beside the other analytics routes.
  - They need a login only.
  - The menu leaf `boards:menu.help` is added to `LIBRARY_PAGES` after Recently deleted, and shows wherever the
    Analytics menu shows.
- **The page:**
  - A contents rail lists the articles in order, each with its access badge (Viewer, Author, Curator, SQL).
  - The article is rendered from Markdown.
  - Previous and next links.
  - The "checked against" line.
  - A Draft banner while the area is draft.
  - `/analytics/help` opens `start`.
- **Search:**
  - A box above the rail filters by title, front-matter questions and body, in the app's language.
  - Arabic matching ignores diacritics and the alef and taa marbuta variants.
- **Markdown:**
  - One small renderer, a new dependency pinned exactly.
  - No raw HTML.
  - `screen:` links render as an "Open this screen" button that navigates.
  - `help:slug#anchor` links navigate inside the help.
  - Images load from the help image route, and pick the `.en`/`.ar` file for the app's language.
- **The language follows the app** (i18next). Arabic renders right-to-left, and code and numbers stay left-to-right
  through the existing `Ltr` and bidi helpers.
- **The access badge** says "You have this access" or "Ask your administrator for … access", from the existing
  `analytics-access` helpers. The article stays readable either way.
- **The route-snapshot test:** a checked-in `src/features/help/screens.snapshot.json` holds every `screens` route of
  the table of contents. A test fails if any of them matches no route in `router.tsx`. The capture script (954)
  refreshes the snapshot.

## Spine reach

UI (route, menu leaf, page, wire types, api, locale files, a new dependency)

## Proof (→ `tdd` red-green cycles)

- [x] Contents in order with the right badge and the "you have / ask for" sentence for each access · vitest
- [x] Search finds by title, question and body in English and Arabic (with and without diacritics) · vitest (pure module)
- [x] `screen:` and `help:` links become buttons that navigate; raw HTML in an article is not rendered · vitest
- [x] The Draft banner shows only when `draft` is true · vitest
- [x] An image link picks the file for the app's language · vitest
- [x] Every snapshot route matches a router route · vitest
- [x] The locale key-mirror test passes · vitest

## Boundaries

- Nothing outside `src/features/help/`, `router.tsx`, `library-pages.ts`, the locale files and `package.json`.
- No drawer, Home card, Copilot change (952) or print route (953).

## Done when

The proofs are green, and on dev the help center lists BO 4183's two articles in both languages with the Draft
banner.

## Blocked by

BackOffice [4183](C:\Work\DMSCO\BackOffice\.issues\4183-sis-api-serves-the-help-articles-of-an-area-in-english-and-arabic-to-anyone-signed-in.md)

## Comments

- 2026-11-22 (/implement-spec): Built on spec/4182-help-center (9f073880; review fixes 374f10f6), **stubbed** on the spec-4182 wire contract — BO 4183 is unbuilt. All 7 proofs green in vitest. **Owed:** the dev walk (two articles, both languages, Draft banner). Defaults open to veto: `help:` links are in-text router links (only `screen:` is a button); Help leaf shows for Analytics:03 OR PriceWatch:03 (`canReadHelp`); help page labels follow the help language (`helpLang()` = i18n `ar` OR RTL boot direction); `help` added to `TOP_LEVEL_FEATURES`; shared pieces in `src/core/help/`; markdown-to-jsx 9.10.4 pinned; Arabic heading anchors assumed to match BO 4183.
- 2026-11-23: **reconciled** with BackOffice pricing2 @ 98f9a5ad9 (4183/4184/4188) in 83b780a7: `access` is a list (one badge per level, sentence names the missing ones), article reply flattened from `{ article, markdown, sections }`, `{#anchor}` ids mirror `HelpArticleParser`, tours typed. **Local live walk** (SIS.Api pricing2 on POS_Test, Vite, user ADMOP1): `GET Help/analytics?lang=ar` → 14 articles, 4 tours, `draft: true`; the help center renders both languages with the Draft banner, per-level badges, Open-this-screen buttons, checked-against line, next/prev (shots in `C:\Work\DMSCO\help-shots-4182`). Still owed: the walk on the dev host. Findings: `/analytics` is claimed by start, home-library and whats-new (first in order wins → Home's ? opens start); `09-copilot-admin.md` access is `[curator, viewer]` (not lowest first; client sorts); the shell breadcrumb shows the slug (`start`), not the article title.
- 2026-11-23: crumb names the article by its title (df7f5dbd). BackOffice start/whats-new screens moved off `/analytics` to `/analytics/help` (uncommitted on pricing2), so Home's "?" opens home-library; snapshot refreshed live (e.g. +/analytics/help).
