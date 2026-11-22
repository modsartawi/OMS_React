---
status: open
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

- [ ] the open sections render and the four others are folded with their summaries · vitest
- [ ] a not-available section shows its last good date and no figure · vitest
- [ ] the language switch asks for the other language and lays the page right to left · vitest
- [ ] the status line shows a red dot for a failed run · vitest
- [ ] the page is absent when the server does not offer it · vitest

## Boundaries

Front end only. Nothing is shown until the server switch is on.

## Done when

The tests are green, and on dev the page shows last night's brief in both languages.

## Blocked by

BackOffice 4176
(`E:\Projects\BackOffice\.issues\4176-the-home-route-returns-the-latest-published-brief-in-the-readers-language-the-region-table.md`)
