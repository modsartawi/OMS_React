---
type: wayfinder-ticket
wayfinder: prototype
map: 793
status: done
blocked-by: 794, 797, 801
---

# 798 — How does an author declare a parameter, and a viewer run the report with it?

## Question

Make a rough, clickable prototype on branch `prototype/793-parameters` for the owner to react to:
- the author's side: declaring a parameter, setting its default, and binding it to panels;
- the viewer's side: a team member opens the shared report, fills in the parameters and re-runs
  it, with no edit control showing;
- the report page itself (parameters on top, sections of charts and tables), per the report decision;
- the share dialog that picks teams, per the team decision.

**Widened after 801 (owner, 2026-11-06: "how am I going to design the report and the components
for filtering?").** The owner asked whether this would feel like SAP Web Intelligence or
Stimulsoft. It will not (801: no banded designer, no SQL, no joins). The prototype must show
instead what designing a report *is*:
- **the report designer:** add, reorder and remove sections, and add a chart or table block in a
  section, built from the semantic model's measures and dimensions or **copied from a saved view**
  (inline, per 801);
- **the panel editor inside a block:** measures, breakdown, chart type and up to 4 **named
  series** (799), the acceptance case's HungerStation against QC;
- **text blocks with live figures:** inserting a figure token from a panel, and how it reads
  filled in;
- **the summary block:** how it looks when it is written, and when it is "summary unavailable";
- **each parameter kind's control** in the strip (period, members, grain, threshold, top N,
  measure, breakdown), and a panel that a parameter does not reach;
- the acceptance case built end to end as the prototype's sample report, on stub data.

It must hold the repo rules (zero-literal, logical Tailwind, bidi, DMSCO core controls) and mirror
under Arabic. Screenshots go in `.issues/assets/798-shots/`.

## Prototype (built 2026-11-06, awaiting the owner's reaction)

Branch `prototype/793-parameters` (commit `fb721efd`, worktree `C:\Playground\oms-react-proto798`), never
merged. Run it: `npx vite --port 5198` in that worktree, open
`/analytics/prototype/report?variant=A&scenario=design`; ←/→ switch the designer, ↑/↓ the scenario.
Drive: `tools/report-proto-798-drive.mjs`, 114/114 in LTR and RTL. Screenshots:
[798-shots/](assets/798-shots/) (`<variant>-<scenario>-<dir>.png`, `run-*`, `run-fallback-*`, `not-shared-*`).

**Three designers** for the same acceptance-case report (9 parameters covering all 7 kinds, 4 sections, named
series, live figures, the summary):
- **A — the document is the editor.** The report reads as it will be sent; each block and section carries
  edit / move / remove; the parameter strip carries a ⚙ per parameter and "+ Parameter"; the selection
  opens in a side sheet. ([A-design-ltr](assets/798-shots/A-design-ltr.png), [A-declare-ltr](assets/798-shots/A-declare-ltr.png))
- **B — outline · canvas · inspector.** Parameters and the section tree on the start side, the live report
  in the middle, the selection's editor fixed on the end side. ([B-panel-ltr](assets/798-shots/B-panel-ltr.png))
- **C — steps.** Parameters (a parameter × panel **binding matrix**, "can't" with the reason on hover) →
  content → words → share → preview. ([C-design-ltr](assets/798-shots/C-design-ltr.png))

**The same in all three:** the runner's page (no edit control; parameters, export, copy link carrying the
values: [run-ltr](assets/798-shots/run-ltr.png)), the share dialog (roles + people, a removed role flagged,
can / can't: [A-share-ltr](assets/798-shots/A-share-ltr.png)), the 411 list at save
([A-refused-ltr](assets/798-shots/A-refused-ltr.png)), the link-value fallback and "summary unavailable"
([run-fallback-ltr](assets/798-shots/run-fallback-ltr.png)), and 413 ([not-shared-ltr](assets/798-shots/not-shared-ltr.png)).

**Found while building:**
- 🚩 **A defect on main, outside this map:** `core/charts/SeriesChart.tsx` writes a `fill` onto every data row,
  and Recharts lets a row's `fill` beat `<Bar fill>`, so **every series of a multi-series bar draws in
  `--chart-1`** (the legend shows the right colours). v1's multi-measure bar views take the same path. Fixed
  on the prototype branch only (row `fill` only for a single series); main needs its own ticket.
- Listing every parameter that doesn't reach a panel ("Not filtered by: …") under each panel is **noisy**: the
  sample's p2 lists five. Recommendation: the author sees all of them; a runner sees a line only for a
  parameter they have moved off its default.
- Live-figure tokens are typed as `{p3:hs}` in a plain text field, with a filled preview under it.
  Recommendation for the build: tokens as inline chips in the text, never raw braces.
- Arabic mirrors correctly, but the app still runs `lng: 'en'` everywhere, so the RTL shots show English copy
  (the `proto798` keys have Arabic ready).

**Open for the owner:** which designer (or which parts of each), and the two recommendations above.

### Owner reaction, round 1 (2026-11-06)

"Confirmed so far", with three asks, built on the same branch (commit `9a3f71b8`, drive 139/139):
- **A section could not be deleted** (B's outline and the section editor had no remove; only A's inline tools
  and C's step did). Now it can be removed everywhere. **For the spec:** every add has a remove in every place
  the thing is shown.
- **Undo / redo (owner).** A history of every designer edit: Ctrl+Z / Ctrl+Y and buttons, typing in one field
  counts as one step, and every removal says "Removed … · Undo". No confirm dialogs: undo replaces them.
  **For the spec:** undo/redo covers the unsaved session only; once saved, revisions and revert (766) take over.
- **A built-in tutorial (owner)** "for anyone who wants to build the same report". Prototyped as a scenario
  (`?scenario=tutorial`): a blank report and a 10-step checklist that builds the acceptance case. Each step
  **ticks itself from the report's own state** (never "did you do it?"), and there is "Load the finished
  report" as a way out. Shots: [A-tutorial-ltr](assets/798-shots/A-tutorial-ltr.png),
  [A-tutorial-done-ltr](assets/798-shots/A-tutorial-done-ltr.png),
  [B-tutorial-ltr](assets/798-shots/B-tutorial-ltr.png). Finding: **A's modal sheet hides a floating guide**,
  so A must carry the guide inside the sheet; B and C never cover it.
- **"Can the API generate this report?"** By design, yes: every piece maps to a settled door (panels → SIS.Api
  resolves parameters into Cube `/load`, 795/797; series → one query each, 799; QC + cancellation rate,
  796/804; the store table → `store_day`, 799; live figures, summary and kept runs, 801; the daily email,
  803). **Not yet in practice:** no v2 door exists, v1 still waits on real data (784), and till's
  `delivery_type` via `order_no` is unchecked (800). The AI writing the whole report from one sentence is 802.

**Still open for the owner:** which designer (A, B, C or a mix), and whether the tutorial is one fixed
walkthrough (this one) or every Certified report gets a "show me how this was built" replay.

### Owner reaction, rounds 2–3 (2026-11-06)

- "Can we add also in sections a drag drop in the designers?" Built in every designer (commit `86f72a3d`):
  sections and blocks are dragged by a grip, blocks also into another (or an empty) section, a line shows
  where they land, and each drop is one undoable step. The ↑/↓ buttons stay as the keyboard's way to move.
- "Why don't combine B & A?" Built as **variant D**, now the default. Drive 165/165.

## Answer

Done 2026-11-06 (prototype, three rounds with the owner). The prototype is the primary source: branch
`prototype/793-parameters` (last commit `86f72a3d`), never merged; shots in [798-shots/](assets/798-shots/).

1. **The designer is D = A + B (owner).** B's frame around A's document:
   - **Outline** on the start side: the parameters, then the section tree. Every row can be selected, and
     sections and blocks can be dragged.
   - **The report in the middle, editable in place** (A): the strip with ⚙ per parameter and "+ Parameter",
     a toolbar on each block (drag, edit, up, down, remove) and on each section heading, and "Add to this
     section" (chart or table, copy a saved view, text, AI summary).
   - **A fixed inspector** on the end side (B), sticky, never a modal: the parameter editor, panel editor,
     text editor and section editor all open here.

   Not chosen: A alone (its modal sheet covers the report and the tutorial) and C (steps). C's **binding
   matrix** (parameters × panels, "can't" with the reason) is worth keeping as an overview inside D's
   parameter inspector (agent; overrulable).
2. **Undo / redo (owner).** Every designer edit is a step (Ctrl+Z / Ctrl+Y and buttons, and typing in one
   field counts as one step), and every removal says "Removed … · Undo". There are no confirm dialogs.
   Undo covers the unsaved session; after a save, revisions and revert (766) take over.
3. **Drag and drop (owner)** of sections and blocks, as above. Every add has a remove wherever the thing is
   shown (the missing section remove in B was the owner's first finding).
4. **A built-in tutorial (owner).** A blank report and a checklist that builds the acceptance case. Each step
   ticks itself from the report's own state, and "Load the finished report" is the way out. In D it lives at
   the top of the inspector. Whether one fixed walkthrough is enough is left in the map's fog.
5. **Declaring a parameter** reads: kind → name (the link key, checked live: slug, unique, not reserved) →
   label in English and Arabic → kind fields → **default set with the viewer's own control** → "Applies to",
   pre-filled with every panel that can take it, each other panel saying why it can't. This is 797 made
   concrete; nothing in 797 changed.
6. **The runner's page** has no edit control anywhere. They get the strip, "Reset to defaults", export and a
   copied link carrying their values. A link value outside a parameter's list falls back to the default and
   says so. "Summary unavailable" drops only the summary.
7. **Settled by the agent, overrulable:**
   - A runner sees "not filtered by …" only for a parameter they have moved off its default; the author sees
     all of them.
   - Live figures sit in the text as chips, never as raw `{panel:figure}` braces.
8. 🚩 **Found on main:** `core/charts/SeriesChart.tsx` draws every series of a multi-series bar in
   `--chart-1`, because a row's own `fill` beats `<Bar fill>` in Recharts. It is fixed on the prototype
   branch only and needs its own main ticket.
