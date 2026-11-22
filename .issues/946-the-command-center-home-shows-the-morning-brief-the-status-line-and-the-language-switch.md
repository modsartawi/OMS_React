---
status: done
spec: BackOffice 4165
blocked-by: BO 4176
---

# 946 — The command center home shows the morning brief, the status line and the language switch

Spec: BackOffice `E:\Projects\BackOffice\.issues\4165-retail-command-center-phase-1-the-overnight-store-scorecard-product-health-and-morning-brief-spec.md`.

## What to build

The home page of the Retail Command Center in the Retail Back Office, visible only when the server offers it
(`CommandCenter:Home`) and the reader holds the analytics view grant.

- **Layout:** the brief on the left; the right half is left for the kingdom map (the next ticket).
- **Status line** under the title: the data-as-of day, and each overnight run with its time and a green or red dot.
- **The brief:** the headline with its four figures; what changed overnight, the top risks and the top
  opportunities always open; "More in today's brief" with the four folded sections, each showing its one-line
  summary.
- **Every line** shows its sentence and its SAR figure as the server sent them. A pharmacy code and a category
  name are links.
- **A section that is not available** shows "Not available this morning" with its last good date.
- **English and Arabic** with a switch; Arabic is right to left. The page asks the server for the brief in the
  chosen language; it translates nothing itself.
- The page computes no figure, colour or order.

## Spine reach

route → page

## Proof (→ `tdd` red-green cycles)

- [x] the open sections render and the four others are folded with their summaries · vitest
- [x] a not-available section shows its last good date and no figure · vitest
- [x] the language switch asks for the other language and lays the page right to left · vitest
- [x] the status line shows a red dot for a failed run · vitest
- [x] the page is absent when the server does not offer it · vitest

## Boundaries

Front end only. Nothing is shown until the server switch is on.

## Done when

The tests are green, and on dev the page shows last night's brief in both languages.

## Blocked by

BackOffice 4176
(`E:\Projects\BackOffice\.issues\4176-the-home-route-returns-the-latest-published-brief-in-the-readers-language-the-region-table.md`)

## Comments

**2026-11-22 — done (stubbed; live walk owed, BO 4176 unbuilt).** The home at `/analytics/command-center`
(`features/analytics/command-center/`, namespace `command-center`, en + ar): the status line (data-as-of day, each run
with its finish time, the server's dot and its state in words), the brief (headline + four figures; changed, risks and
opportunities open; the four others folded under "More in today's brief" with their one-line summaries; "Not available
this morning" with the last good date and no figure), and the language switch (`?lang=en|ar`, `getFixedT`, `dir` on the
page root; the server is asked in the chosen language; the shell stays English and left to right). The end half is an
empty `data-cc-map-slot` for 947. Every line is drawn through the shared `@/core/findings/FindingCard`. Shared pieces
for 947-950: `core/models/command-center.ts` (home + the profiles' `CcPeriod`/`CcTable`/`CcCell`/`CcProfileSection`),
`core/command-center-routes.ts` (all four builders), `core/findings/` (card + `Sentence`), `tools/command-center-stubs.mjs`.
Proof: `page.test.ts` (the five boxes, static render with a seeded cache + stubbed `api.get`), `finding-card.test.ts`,
`command-center-routes.test.ts`, `i18n-keys.test.ts`, the permissions parse case. Typecheck, 12147 tests, and five of
the six lint gates green. The boundary gate is red only on the pre-existing `insurance-rules/aliases/door-shapes.test.ts`
(e9243c46), not this diff. `tools/command-center-drive.mjs` is written but not run: no Playwright on this host.

**BackOffice follow-ups:**
- **`commandCenterOn` on `Auth/Permissions`** (decisions §2): the page and the menu leaf read `CommandCenter:Home` as
  `extras.commandCenterOn`, the way `notificationCenterOn` works. BO 4176 does not add this extra, so a follow-up
  is needed. Until it lands the flag is missing, which reads as off, and the page stays hidden. The heavy home route
  is never probed.
- **BO 4176 is unbuilt.** The route and shape (`GET CommandCenter/Home?lang=`) are this client's proposal, marked
  `⚠ proposed` in the models file: `CcPart`/`CcTarget` link parts, the server-chosen run `dot`, the section's `folded`,
  `isLatest`, and `maps`.
- **Live walk owed:** on dev, last night's brief in both languages, once 4176 and the flag are deployed.

