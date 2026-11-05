---
type: wayfinder-ticket
wayfinder: grilling
map: 741
status: done
blocked-by: 744
---

# 747 — Do users explore inside oms-react or inside the BI tool?

## Question

Where does an HQ user explore, save and re-run views?

The options:
1. **Embedded:** the BI tool is embedded in an oms-react screen under a new area.
2. **Standalone:** the BI tool's own UI, reached by SSO from a menu link.
3. **Native:** an oms-react screen of our own that talks to the semantic layer directly, keeping
   the BI tool for authoring only.

For the chosen option, settle:
- how oms-react grants gate it (one `BackOfficeScreen` grant beside `Copilot`, or the same one);
- the area and URL;
- how the AI's `create_view` link lands the user on the view;
- what the zero-literal, RTL and DMSCO-theme rules mean for embedded content we don't render.

## Context from 744 (2026-11-03)

[Which on-prem BI tool lets an AI create views that users save and re-run?](744-which-on-prem-bi-tool-lets-an-ai-create-views-that-users-save-and-re-run.md)
ranked Metabase first and Superset second. Two facts from it bear on this ticket:

- **Embedded on Metabase costs money.** Interactive embedding and JWT SSO (trusting a token
  signed by SIS.Api) need Pro: $6,210 a year plus $130 per user per year beyond 10. The open-source
  edition can embed only view-only guest content, with a banner. So the owner also rules on this:
  **is there budget for Pro, or must v1 cost nothing in licences?** If it must cost nothing, the
  choice is Superset embedded (free, SIS.Api signs guest tokens) or Metabase standalone with its
  own login.
- **Standalone exposes the tool's own UI.** Superset has no RTL layout. Metabase has an Arabic UI,
  but nobody has seen how it renders. Ticket 752 will produce screenshots of both.

## Answer (2026-11-03)

**Option 3, Native — but resolved more sharply than the original framing, after building a working
prototype the owner drove.** HQ users explore inside **oms-react's own screens**, drawn with our own
components (Chip/Select controls, recharts charts themed from the DMSCO tokens). The BI tool sits
behind them as the **engine only**: **Metabase OSS, the free AGPL edition**, reached over its REST
API (`POST /api/dataset` to run, `POST /api/card` to save). No embedding SDK, no iframe, no
Metabase UI on screen.

**The licence ruling (this is what 744 deferred here): v1 costs nothing.** Native over the free OSS
engine is **$0, unlimited users, on-prem**. Pro is **not** bought for v1. We only revisit Pro if we
later add an *optional* power-user tier that embeds Metabase's own explorer with JWT SSO — a
separable, later decision, not a v1 dependency.

Why native won over embedded-Pro and standalone:

- **Single login, truly native.** SIS.Api holds the Metabase service credential server-side and
  proxies the REST calls; the HQ user only ever sees oms-react. No second login, and **no per-seat
  fee** (the ~$6,210/yr + ~$130/user/yr Pro cost, and its ~10-user cap, are avoided entirely).
- **The zero-literal / RTL / DMSCO rules stop being a problem.** The ticket worried what those rules
  mean "for embedded content we don't render." Native renders everything *ourselves*, so they apply
  normally: `t()` keys, logical Tailwind, tokens. RTL/Arabic is our own i18n — proven in the
  prototype, where the whole board mirrors correctly. This is the opposite of embedded Metabase,
  whose Arabic depends on Metabase's own locale bundle (an unsolved gap on the embedded variant).
- **OMS integration no generic BI tool can match:** a drill can jump from a chart straight into the
  underlying oms-react record (a store, a delivery).

**The AGPL safe side (confirmed):** we run the **stock** Metabase jar unmodified, call its **REST
API** at arm's length, for **internal** HQ use, and **never copy Metabase's frontend code**. A
network API boundary is not linking, so oms-react stays proprietary. (This is why "reverse-engineer
/ copy the source" was rejected: using the API is free and clean; copying AGPL code is the trap.)

**Scope that makes native viable for v1:** v1 is *curated*, not open-ended self-serve —
[ticket 745](745-which-subject-areas-measures-and-questions-does-v1-answer.md)'s four subject areas
and fifteen HQ questions. We build the measures, dimensions, boards and drill ladders; users
configure *within* that (filters, saved views, drill, AI ask). "Build literally any question from
scratch / SQL editor / arbitrary joins / pivot tables" is the expensive part we **do not** rebuild —
if that need becomes real, we embed Metabase's own explorer (Pro) for those users rather than
reimplementing a BI tool.

**Settled sub-questions (for `/to-spec`):**
- **Grant:** a new `BackOfficeScreen` grant, gated like the other screens (sibling to Copilot's, not
  shared with it).
- **Area & URL:** a new `analytics` area at `/analytics` (dashboards, explore, ask). It mirrors the
  URL prefix per the feature-structure rule.
- **`create_view` landing:** the 734 loop's `create_view` tool POSTs a card to Metabase OSS, gets
  the card id, and routes the user to `/analytics/view/:id`, rendered natively from that card's
  query. Same plan→MBQL core the prototype's Ask variant uses.
- **Theme/RTL/i18n:** full oms-react rules apply (native rendering); no exemption needed.

**Evidence — the prototype.** Branch `prototype/747-embedded-bi` (worktree
`C:\Playground\oms-react-proto747`), route `/prototype/analytics?variant=board|explore|ask|native|linked&scenario=en|ar`,
over a local Metabase + synthetic SQLite (`C:\Playground\mb-proto`, never the replica). Five
variants: board/explore/ask show **embedded Metabase (SDK, Pro in prod)** for contrast; **native**
is our builder with **drill-through** (click a bar/slice/row → break-down or filter, with a
breadcrumb); **linked** is a **cross-filtered dashboard** of eight panels where clicking a store row
refocuses all of them. Screenshots in `.issues/assets/747-shots/` (`native-*`, `linked-*`).

**Carried into the spec (not re-decided here):** the native approach is componentized as
*query-spec + themed-renderer + shared-filter-state*, which is exactly what a later configurable,
multi-source dashboard needs — reusability, multiple Metabase-connected datasources (per-panel
`database` id), and theme-following are all natural, not rework.

> **Amended 2026-11-03 by
> [Does embedded Superset beat native over Metabase OSS for HQ exploring?](754-does-embedded-superset-beat-native-over-metabase-oss-for-hq-exploring.md):**
> native stays, and it now includes **full authoring** inside the semantic model: edit chart, edit
> dashboard layout, per-panel actions and customization. SQL and arbitrary joins remain out.

> **Amended 2026-11-04 by
> [What can an HQ user author natively, and who may edit which board?](755-what-can-an-hq-user-author-natively-and-who-may-edit-which-board.md):**
> views and boards live in **our own SIS.Api store** in semantic-model terms. Metabase OSS only runs
> them through `/api/dataset`, and `/api/card` is not used. `create_view` writes to our store and
> routes to `/analytics/view/:ourId`, not to a Metabase card id.
