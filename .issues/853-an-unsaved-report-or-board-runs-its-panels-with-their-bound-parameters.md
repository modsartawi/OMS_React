---
status: open
spec: —
blocked-by: —
---

# 853 — An unsaved report or board runs its panels with their bound parameters

## Why

Found 2026-11-07 on the local demo: a new report with the view "Sales By Category and SubCategory" in a section.
In the designer and in **Preview as a runner**, changing the report's **Period** at the top did nothing: the table
kept its own period. After **Save**, run from the main page, the same panel followed the Period. So the
binding was saved correctly; only the **unsaved** run ignores it.

**Cause.** An unsaved run goes through `effectiveQuery`'s inline branch
(`features/analytics/boards/effective-query.ts:116-123`, `BoardContext.inline`), which posts
`{ definition, params, bindings, panelId, values }` to `POST Analytics/Query`. SIS.Api's `AnalyticsQueryRequest`
(BackOffice `Sartawi.Retail.Data/Modules/Analytics/AnalyticsWire.cs:133`) has **no `params` or `bindings`**: they are
dropped silently, and the panel runs as a bare `definition` at the view's own period and filters. No error, no
`notReached`: it just looks unlinked.

The server already has the right door: a body with a **`draft`** object (the whole unsaved board or report
definition) plus `panelId` and `values` is validated as a save would be and run through the same `CompilePanel`
as a saved item (BackOffice spec 3408 §D, ticket 3419: `AnalyticsWebEndpoints.Query` lifts `draft`;
`AnalyticsQueryService.CompileDraftPanelAsync`). The client never sends it.

Affected (every `inline: true` context):
- `ReportDesignerPage.tsx:409`: the designer canvas (runs at the parameters' defaults)
- `ReportDesignerPage.tsx:792`: Preview as a runner (runs at the viewer's chosen values)
- `BoardPreview.tsx:55`: an unsaved board's preview

## What to build

- The inline branch posts `{ draft: <the whole working definition>, panelId, values }` (plus `crossFilter` and
  `compareToPrevious` as now) instead of `{ definition, params, bindings }`. Drill keeps today's form
  (`drilledDefinition` inline), since a drilled panel is not on the draft.
- Read the answer's `notReached` / `fellBack` as for a saved item, so the designer shows "not reached" the same way.
- The query cache key changes with the draft, so editing a block re-runs, and editing an unrelated block does not
  re-run every panel (key on the panel's definition + its bound values, not the whole draft text).

## Proof

- [x] Unit: an inline context with a bound period builds a body carrying `draft` and `values`, and no `params` /
      `bindings`; an unbound panel's body still runs at its own period.
- [x] Unit: drill on an unsaved panel keeps the inline `definition` form.
- [x] Drive: designer with one table panel, top Period → *Last 7 days*: the panel's request carries `values.period`
      and its rows change; untick the panel in Applies to → it goes back to its own period.
- [x] Drive: Preview as a runner follows the viewer's Period; the unsaved board preview follows its parameters.
- [ ] Live (local SIS.Api): the designer and the saved report show the same numbers for the same Period.

## Boundaries

Client only. The server door exists (3419). A refusal of the draft (e.g. `ANALYTICS-412`) shows on the panel as any
query refusal does.

## Open questions

- The draft is "validated as a save would be". A brand-new report with no title yet (the case found) may be
  refused by validation the save would also refuse. Check on local SIS.Api first; if it is, either send a
  placeholder title in the run-only draft, or ask BackOffice to relax title checks for a run (a small server ticket).
- Author-only (`ANALYTICS-415`): Preview as a runner is an author's screen, so this holds; confirm no runner path
  reaches the inline branch.

## Comments

**2026-11-08 — built (client), stubbed; Live box open.**

- `effectiveQuery` (`features/analytics/boards/effective-query.ts`): `BoardContext.inline` became `draft` (the whole working
  definition). Undrilled, a draft panel asks `{ draft, panelId, values, crossFilter?, compareToPrevious? }`; drilled, it keeps
  `{ definition, params, bindings }`. With a draft, its own `params`/`bindings` make the values (one source, not two).
- Cache key: `queryKeyOf` puts the panel's own share of the draft under `draftPanel` (its view, the params bound to it and their
  bindings there), a shape no wire body has, so it never collides with the inline form. Editing a text or another panel re-asks
  nothing; a binding or value change re-asks that panel alone.
- Keying on the panel's share means a draft refused AS A WHOLE (`ANALYTICS-406`/`411`) would stay refused after the fix. So
  `BoardPanel` re-asks a panel refused with one of those two codes whenever the draft changes (no other code: 412/415/404 are
  the panel's own).
- Wire type: `AnalyticsParamQuery` gains `{ draft: AnalyticsDraftDefinition }` (core models).
- Stubs: `tools/analytics-stubs.mjs` has the 3419 draft door (author-only 415, the bound period sets the answer's period, unbound
  → the view's own; `draftRefuse` to refuse a draft as a whole). The 837 drive now asserts the draft form.

**Open questions, answered from BackOffice source:**
- Title: `ValidateDraftAsync` validates the *definition* only (the title rides on the Item body, not in it), so an untitled new
  report is not refused. Not yet confirmed on a live SIS.Api.
- Runner path: only the designer, its DraftPreview and the board editor's Preview build a draft context, all author routes.

**Proof:**
- Unit: `effective-query.test.ts` (draft body; unbound → `values: {}`; draft wins over item; drill keeps the inline form; key
  stays put for unrelated blocks and moves for a binding or value). 687/687 analytics tests.
- Drive: `tools/draft-run-853-drive.mjs` 50/50 (en + ar): designer panels by draft with the default period in `values`; Period →
  Last 7 days re-asks all four with it; unticking p1 in Applies to re-asks p1 alone with no period (own period); a text edit
  re-asks nothing; Preview as a runner follows its Period; the unsaved board Preview follows its Period; a draft refused as a whole
  (411) shows refused on every panel and the fixing edit brings them back. Shots: `assets/853-shots/`.
- Regression: `analytics-drive.mjs` 821/823/824/825/827/829/831/832/834/837 all pass; `report-designer-846-drive.mjs` 80/80.
  826 and 828 fail identically on clean HEAD 00fd1697 (pre-existing drive drift: `data-analytics-new-report` moved to the library).
- typecheck, build green. `npm run lint` fails only on the committed `insurance-rules/aliases` boundary imports (e9243c46), not here.
- **Live: not run.** The local SIS.Api on :5111 is up, but the drive needs a sign-in. To close: run the designer against it
  (`SIS_SIGN_IN=window`, the analytics-v2-live-drive pattern), set Period, compare a panel with the saved report's numbers.

**Findings left for follow-up (not this ticket):**
- A **drilled** panel (saved or unsaved) still sends `{ definition, params, bindings }`, which SIS.Api drops, so a drill runs at
  the view's own period, not the bound one. This ticket kept that form as asked. The fix is to fold the bound values into the
  drilled definition (period + filters), or a server-side draft/item drill.
- Because the server validates the whole draft, one declaration problem anywhere (a text naming a removed panel) refuses every
  panel in the designer until it is fixed (the ticket's Boundaries accept this; the designer also lists the problem). A valid
  draft that turns invalid by an unrelated edit keeps its cached answers until a panel re-keys.
- The designer and DraftPreview still drop `fellBack`/invalid notices (`onParamNotice: noop`), which predates this ticket.
