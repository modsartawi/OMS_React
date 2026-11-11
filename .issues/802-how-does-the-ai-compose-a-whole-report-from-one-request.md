---
type: wayfinder-ticket
wayfinder: grilling
map: 793
status: done
blocked-by: 797, 801
---

# 802 — How does the AI compose a whole report from one request?

## Question

v1's copilot has `create_view`: one Personal view per call, never a board (spec 766 §D). The owner
wants one request to produce the whole report in map 793's worked example. Settle:
- **The tool:** a new `create_report` (or `create_view` widened) that writes a report with its
  parameters, sections and panels in one call, validated by the same server validator. It lands
  Personal, as AI-made views do.
- **Parameters from words:** how "defaults to yesterday, but I can change it" becomes a declared
  period parameter, and "HungerStation and QC" becomes a channel parameter or a fixed filter.
  **From 799 (2026-11-06):** "HungerStation and QC, compare them" is two **named series**
  (`channel = hungerstation`, `delivery_type = QC`), not a parameter. So settle when words become
  series rather than a breakdown or a members parameter, and when the AI picks the cross-area view
  `store_day` rather than panels side by side.
- **The confirm step:** whether the copilot shows the plan (sections, measures, filters,
  parameters) before writing, and how the user edits it in the chat ("add the cancellation rate as
  a bar").
- **Editing afterwards:** whether a follow-up in the same conversation edits the report in place
  (a new revision) or makes another.
- **The surface:** panel only, as `create_view`; MCP stays read-only.
- **What it may not do:** share, certify, or schedule. Those stay human actions.

**From 798 (2026-11-06):** the designer is settled: D = an outline, the report editable in place, and a
fixed inspector, with undo/redo and drag and drop. The owner then asked "is AI going to help me build such a
report?". So settle here whether the copilot's report **opens in that designer as an editable draft** (undo
takes back any part of it), and whether a chat follow-up and a designer edit are the same kind of step. The
owner's worked example is the test: one sentence becomes the 798 sample report.

## Answer

Done 2026-11-06 (grilling). The owner made the two rulings that shape the feature (1–2). The rest are the
agent's, and the owner may overrule any of them.

**What was inherited.** The CTO demo bridge (`C:\Playground\demo766\bridge\server.mjs`) already has
`build_report`, `update_report` and `get_report`:
- an update sends the **full** block list and becomes a new revision of the same report;
- the prompt says "never build a second report unless asked";
- there is no plan step.

Its charts are separate Personal views made with `create_view`, which 801 now forbids, because panels are inline.
v1's copilot keeps a conversation of at most 10 questions (`COPILOT-406`, `conversation.ts`). Its panel
opens from the top bar on every screen, so it can sit beside 798's designer.

1. **The AI builds straight away. There is no plan step (owner).** One request writes the whole report:
   title, parameters, bindings, sections, inline panels, text and, when asked, the summary block. It then
   opens in the designer.
   - The answer lists **what it assumed**, one line each, for example "Period: a parameter, default
     yesterday", "HungerStation and QC: two named series", or "Cancellation rate: cancelled ÷ all orders,
     expired shown apart".
   - It **asks first only** when the words cannot be resolved:
     - a member that matches values in two dimensions, or in none;
     - a comparison of more than 4 series;
     - a figure the model lacks, which gets 734's `cannot-answer` ("I can't answer that from the analytics
       model").

   A wrong guess costs one undo or one follow-up, because the report is a private draft.
2. **One copilot, aware of the designer (owner).** The AI uses the same copilot panel.
   - **With a report open in the designer,** the panel sends it as the **report in context**:
     `{reportId, revision, draft}`, where `draft` is the designer's current working copy, saved or not.
     "Add the cancellation rate as a bar" then edits **that** report. This holds for any report the user
     may edit, **including ones built by hand**.
   - **The AI never saves a report open in the designer.** It returns a validated definition, which the
     designer applies as **one undo step**, labelled with the request ("AI: add the cancellation rate as a
     bar"). The author keeps or undoes it, and saves as usual. A chat edit and a designer edit are the
     same kind of step in one history.
   - **With no designer open,** `create_report` saves the new report **Personal**, at revision 1. The
     answer carries an "Open in designer" link. A follow-up in that conversation edits the same report and
     saves it as a new revision, as the demo did. "Make another one" makes a second report.
   - **What the AI may edit:** the user's own Personal or Shared report. A Certified report, or someone
     else's Shared one, is not editable. The AI says so and offers **Save as my copy** (794's rule), then
     edits the copy.

3. **Two tools replace the demo's three.** They join 734's one catalogue, on the `panel` surface only, and
   **MCP stays read-only** (766 D):
   - **`create_report`** takes a whole report definition: the 801 report shape with 797 parameters and
     bindings and 799 named series, every text in English and Arabic. It writes a Personal report and
     returns `{id, revision}`. It makes **no Personal views** (801).
   - **`edit_report`** takes `{reportId, baseRevision or draft, definition}`, the **full** new
     definition. A full replace is simpler for the model and is what the demo proved.
     - In the designer it returns the validated definition unsaved.
     - Otherwise it saves a new revision. A stale `baseRevision` is `ANALYTICS-405`, the board's conflict
       rule.

   Both go through **the same server validator as the designer**: shape rules (`ANALYTICS-406`),
   declarations and bindings (`ANALYTICS-411`), live-figure tokens, caps. A refusal returns to the model
   so it can correct itself in the same answer, as tool errors do today. Bindings are **pre-filled by the
   same rule the designer uses** (797), so the AI never chooses a binding the designer would not offer.
   `get_report` is dropped, because the report in context is sent with the question.

4. **Words become shapes.** This is the AI's rulebook, written into the prompt and tested by the D14
   cases in item 9.
   - **The period.** Every report has the ready-made period parameter (797). A period in the words sets
     its **default** ("yesterday" means default yesterday). "But I can change it" adds nothing, because
     every parameter can be changed.
   - **A fixed mention becomes a fixed filter; a choice becomes a parameter.** "For Riyadh" is a filter
     inside the panel. "For a city I pick" or "per store, choosable" is a members parameter, bound by
     pre-fill.
   - **"Compare X and Y"** depends on where X and Y come from:
     - From **two dimensions** (HungerStation is a channel, QC is a delivery type): **named series**, at
       most 4 (799).
     - From **one dimension**: a **breakdown** filtered to those members, never series.
     - More than 4: the AI asks.
   - **Figures from two areas in one chart** use `store_day` when every measure is declared there.
     Otherwise they are **panels side by side** in one section (799). The AI never invents a cross-area
     measure.
   - **"Per channel", "by store"** is a breakdown. **"Top 10"** is a top N fixed in the panel. "Top N I
     choose" is a top N parameter.
   - **Text has no typed numbers.** Every number in AI-written text is a **live-figure** token (801). The
     server refuses AI text with a bare digit outside a token, a date or a parameter's label, and the
     model rewrites it.
   - **The summary block** is added only when the request asks for findings, a summary or "what stands
     out". It costs an AI call on every run, so it is not a default.
   - **Language.** Titles, headings and text are written in **both** English and Arabic, because report
     words are bilingual data. The answer itself is in the question's language.

5. **What it may not do.** The AI cannot share, certify or schedule (766, 801, 803).
   - When the words ask for any of these ("share it with my team", "email it daily to…"), the AI builds
     the report and ends with **the next steps as links**: "Share…" opens 798's share dialog, and
     "Schedule…" opens the schedule. Nothing is sent or shared by the AI.
   - The owner's acceptance sentence is therefore met in two parts: the AI builds the report, and the
     author does two clicks.

6. **Who may use it.** `create_report` and `edit_report` are offered only to holders of the **author**
   grant (794). A runner's copilot answers questions and never sees the tools. The audit records each call
   (734 D6): the words, the definition produced, the revision or the "unsaved draft" outcome, the model
   and the provider. The model writes structured definitions only, never SQL.

7. **The wire and the panel.**
   - The D10 answer's demo `reportRefs[]` becomes `{id, revision, title{en,ar}}` for a saved report.
   - A new optional `reportEdit` carries `{reportId, definition, note{en,ar}}`, which the open designer
     applies.
   - Both read as empty when they are missing.
   - The trace labels are "Building a report" and "Editing the report".
   - The 10-question conversation cap stands. The report outlives the conversation, and a new
     conversation with the designer open still sends the report in context.

8. **The tutorial (798) gains one closing step:** "Or ask the copilot". It types the owner's sentence and
   shows the same report appear. It is an option, not a replacement. Whether more tutorials follow stays
   in the map's "Teaching the designer" fog.

9. **The evaluation.** D14 gains **whole-report cases**, with the owner's sentence as the first. A case
   passes when the definition is **structurally equivalent** to the expected report; identical wording is
   not required:
   - the period default;
   - the parameters and their kinds;
   - the series and their filters;
   - the measures and breakdowns per panel;
   - the chart types fitting the shape;
   - no typed number in text;
   - no share, certify or schedule attempted.

   Edit cases ("add the cancellation rate as a bar") pass when only the asked part changes. 798's
   `sampleReport()` is the expected answer for the acceptance case. The new areas' questions (796,
   Q16–Q31) join as query cases. This clears the map's "AI's evaluation" fog.

New term in `CONTEXT.md`: **Report in context**.
