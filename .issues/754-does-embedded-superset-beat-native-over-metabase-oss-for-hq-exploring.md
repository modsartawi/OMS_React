---
type: wayfinder-ticket
wayfinder: prototype
map: 741
status: done
blocked-by: —
---

# 754 — Does embedded Superset beat native over Metabase OSS for HQ exploring?

## Question

[Do users explore inside oms-react or inside the BI tool?](747-do-users-explore-inside-oms-react-or-inside-the-bi-tool.md)
ruled **native over Metabase OSS**. Its prototype showed embedded *Metabase* only, and embedding
Metabase interactively needs Pro. It never showed embedded *Superset*, which
[Which on-prem BI tool lets an AI create views that users save and re-run?](744-which-on-prem-bi-tool-lets-an-ai-create-views-that-users-save-and-re-run.md)
ranked second precisely because its embedding is free (Apache-2.0, guest tokens SIS.Api can mint).

The owner (2026-11-03) asks for that demo before the ruling stands: is Superset light enough to
run, does its embed look and behave well inside oms-react, and how far can it be customized?

Add a sixth variant, `superset`, to the 747 prototype (branch `prototype/747-embedded-bi`), over a
local Superset in Docker on the same synthetic SQLite (`C:\Playground\mb-proto`, never the replica):

- the HQ board as a Superset dashboard, created **by its REST API** (the door an AI would use);
- embedded in oms-react with `@superset-ui/embedded-sdk` and a guest token minted server-side;
- themed toward DMSCO as far as Superset 6's theming allows;
- English and Arabic, with screenshots, and a note of what breaks;
- the running footprint (containers, RAM, image size) measured, not quoted.

Then the owner rules: does 747's native ruling stand, flip to embedded Superset, or become a
hybrid (e.g. native boards, embedded Superset for a power-user tier instead of Metabase Pro)?

## Prototype findings (2026-11-03) — awaiting the owner's ruling

**Evidence:** commit `3f02d1f2` on branch `prototype/747-embedded-bi` (worktree
`C:\Playground\oms-react-proto747`), route `/prototype/analytics?variant=superset&scenario=en|ar`.
The harness lives in `C:\Playground\ss-proto` (see its README). Screenshots are in
`.issues/assets/754-shots/` on that branch.

**What worked:**
- **Built entirely by REST:** the database, 3 datasets, 16 charts, and an English and an Arabic
  dashboard with native filters, all from `setup-superset.mjs`. That is the door an AI's
  `create_view` would use.
- **Free embedding works:** `@superset-ui/embedded-sdk` 0.4.0 and a guest token minted
  server-side (`POST /api/v1/security/guest_token/`, so SIS.Api can do this). There is no second
  login and no licence.
- **The host can talk to the iframe:** `setThemeConfig` / `setThemeMode` push our tokens at
  runtime. `observeDataMask` and `getDataMask` tell the host what the user filtered, which is the
  hook for "drill into the OMS record".
- **Arabic data renders:** chart titles, axis titles, legends and Arabic store names in table
  rows all show correctly.

**What broke or needs work:**
1. **Charts made by REST fail as guests at first.** Every chart showed "Guest user cannot modify
   chart payload" (403). Guest mode compares each data request with the chart's stored
   `query_context`, and an API-made chart has none. Fix: store the frontend-built query context
   (`seal-query-context.mjs`). ⇒ An AI `create_view` on Superset must write `params` **and**
   `query_context`, which is the frontend's `buildQuery` output. This is a real cost for 746.
2. **No RTL inside the iframe.** Our shell mirrors, but the dashboard stays LTR: card order,
   left-aligned Arabic titles, table columns not mirrored, English month names on the axis.
   Superset's own chrome stays English, because the image ships `ar/messages.po` but no compiled
   language pack.
3. **The theme reaches the chrome, not the series colours.** Card and font tokens apply. The chart
   palette stays Superset's colour scheme, so DMSCO colours need a server-side
   `EXTRA_CATEGORICAL_COLOR_SCHEMES`. Toggling `setThemeConfig` produced no visible change on this
   board.
4. **Embedding covers dashboards only.** A guest cannot open Explore or SQL Lab. "Build a new
   view" inside oms-react would still need a real Superset login (our own FAB security manager),
   which is the same gap 744 found.
5. **Column labels default to raw names** (`store_name_ar`, `city`) unless every dataset column is
   given a verbose name. That is a semantic-model chore per language.
6. **First paint took about 22 s** on a cold, single-worker container. This is not tuned and not
   representative, but it is slower than native.
7. **Not tested here:** SQL Server. The image has no MSSQL driver, so production needs a custom
   image with `pyodbc` and ODBC Driver 18.

**Footprint, measured:**
- Image size: 877 MB, of which the Python venv is 472 MB.
- Idle RAM: 309 MiB in *lean single-container* mode (SQLite metadata, no Redis, no Celery,
  in-memory cache and rate limits).
- A production setup is heavier: Postgres metadata, Redis (cache and async queries), a Celery
  worker and beat, and several gunicorn workers. That is about 4–6 containers, roughly 2–4 GB RAM
  (estimated, not measured). Metabase is one JVM plus one app DB.

**Probe of the chart menu as an embedded guest (2026-11-03):**
- **The menu lists:** Force refresh, Enter fullscreen, Edit chart, Cross-filtering scoping, View
  query, View as table, Drill to detail, Share, Download. The prototype's guest role is *Admin*
  (a shortcut). A narrow production guest role would list fewer.
- **Enter fullscreen works** (`superset-guest-fullscreen.png`).
- **Edit chart does not work.** It navigates the iframe to Explore, which a guest cannot open, and
  the board goes **blank** (`superset-guest-after-edit.png`). No popup, no error.
- **There is no "Edit dashboard"** (layout, resize, add chart) for guests.
- ⇒ Superset's authoring features (edit chart, build chart, edit layout) are **not available
  embedded**. They need a real Superset login in Superset's own UI: our own FAB security manager
  for SSO, and its LTR, English-only chrome.

## Answer (2026-11-03)

**Native stands, and it widens to full authoring ("beast mode").** Embedded Superset is ruled
out. HQ users explore **and author** inside oms-react's own screens, over Metabase OSS as the
engine (unchanged from
[Do users explore inside oms-react or inside the BI tool?](747-do-users-explore-inside-oms-react-or-inside-the-bi-tool.md)).

The owner chose option 1 of three:
1. **Native only, with editing:** about 6–8 weeks. **Chosen.**
2. Native boards plus standalone Superset for a few analysts.
3. Embedded Superset.

**Why embedded Superset lost.** It is light only in a stripped dev setup: production is 4–6
containers. Its editing does not survive embedding. Edit chart blanks the iframe, and there is no
dashboard edit for guests. Its iframe is LTR and English under Arabic. Its series colours ignore
our theme. And an AI-created chart must also carry a hand-built `query_context`. What embedding
gives us is a viewer, which native already does better.

**What "full" now means for native** (the scope the spec must carry; detail is owed by the
authoring-scope ticket below):
- **Per panel:**
  - fullscreen;
  - refresh, with "fetched N ago";
  - view as table;
  - download as CSV, xlsx or PNG;
  - drill to detail and drill by;
  - share or permalink.
- **Edit chart:** change the chart type, measures, breakdowns and filters, then save. This grows
  the prototype's Build tab.
- **Edit dashboard:** drag, resize, add and remove panels, and save the layout.
- **Customization:** colours from DMSCO tokens, titles, number formats, legend position.
- **Still out:** a SQL editor, arbitrary joins, and anything outside the semantic model. The
  model never writes raw SQL, and neither do users.

**Amends 747.** 747's line "we do not rebuild ... build literally any question from scratch" still
holds for SQL and arbitrary joins. Within the semantic model, authoring charts and dashboards is
now in scope for native v1. Pro-embed as a later power-user tier is no longer the plan for authoring.

**Evidence:** commit `3f02d1f2` on `prototype/747-embedded-bi`, with screenshots in
`.issues/assets/754-shots/` on that branch, and the findings above.
