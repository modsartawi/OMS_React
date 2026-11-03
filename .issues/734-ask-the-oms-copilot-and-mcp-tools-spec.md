---
type: spec
status: ready
map: 717
---

# 734 — Ask the OMS: an AI copilot, agent-ready MCP tools and a sourcing advisor over one read-only tool catalogue

Settled for [The AI copilot has a ready spec](729-the-ai-copilot-has-a-ready-spec.md) on 2026-11-03.
It is headline feature 2 from
[Which 2–3 headline features do we build before the pitch?](725-which-2-3-headline-features-do-we-build-before-the-pitch.md),
and it closes **gap #2** of the agreed [gap matrix](../docs/research/717-gap-matrix.md): rows 47
(plain-language data questions), 48 (AI agents) and 50 (agent-ready MCP APIs).

**Scope widened by the owner (2026-11-03).** The owner chose to start with the LACK rows,
"specially the analytics and AI and MCP". So this spec also covers **MCP (row 50)**: the tools the
copilot uses are also published as an MCP server. MCP is not a third product. It is a second way in
to the same tool catalogue.

The vocabulary is `CONTEXT.md`'s: **delivery document**, **store**, **session**, **envelope**,
**guardrail refusal**, **callout**, **search radius**, **donor request**, **donor moment**. This spec
coins three terms: **tool catalogue**, **copilot**, **trace**. Decisions D1–D14 are this file's own.

**Two halves.**
- **Server half:** BackOffice (SIS.Api, .NET 8). It is **filed as BackOffice spec 3345** (2026-11-03; BO-1 = 3346–3349, BO-2 = 3350–3353); see Further
  Notes. It holds the catalogue, the model loop, masking, the audit log and the MCP endpoint.
- **Web half:** this repo. It is the copilot panel. It builds and tests against a stub of exactly the
  wire in D10, and never invents a field beyond it.

## Problem Statement

Our people can see almost anything about an order or the business, but only by knowing which of
about 100 screens holds it, and which filters to set. Some questions cross several screens:
- A COO asking *"why was order X late?"* needs the delivery document, its timeline, its callout
  rounds and its donor moments. Someone has to read those and join them up in their head.
- A CEO asking *"how did HungerStation do in Riyadh this week versus last?"* needs an analyst.

The market now sells exactly this. Kibo, Blue Yonder and Fluent have "explain why" agents.
Salesforce and Fluent ship MCP servers so outside AI agents can use the OMS. Our gap matrix scores
all three rows **LACK**. Management will hear these words from vendors. Today we have nothing to
show back.

There is also a hard constraint. The owner's ruling is that **no personal data leaves our
servers**: no names, mobiles, national IDs, addresses or diagnoses. Every answer must be built
from data that was safe *before* it reached the model.

## Solution

One **tool catalogue** on SIS.Api: a small, fixed set of read-only functions. Each answers one
kind of question and returns only aggregates or masked facts. Two ways in:

1. **The copilot ("Ask the OMS").** A panel in the back office where a permitted user types a
   question in plain language. SIS.Api sends the question and the catalogue to Claude. Claude picks
   tools, SIS.Api runs them, and Claude writes the answer from what they returned. The panel shows the
   answer and a **trace**: which tools ran, with what inputs, and how many rows each returned. Every
   order number in the answer links to its delivery document.
2. **MCP.** The same catalogue, published as an MCP server on SIS.Api. A permitted person can
   connect an MCP client (Claude Desktop, Claude Code) and ask the same questions from their own
   assistant, under the same masking, grants and audit.

The model never writes SQL and never sees a table. It can only call the catalogue, and the catalogue
cannot write. Anything the catalogue cannot answer gets "I can't answer that from the OMS tools", never a
guess.

## User Stories

1. As a COO, I want to ask "why was order X late?" in plain words, so that I get the cause without opening five screens.
2. As a COO, I want the answer to name the stage that overran (store acceptance, picking, the callout search, the courier), so that I know whom to talk to.
3. As a COO, I want to see how many callout rounds an order needed and how wide the search radius grew, so that I can tell a dispatch problem from a store problem.
4. As a COO, I want a late order's donor moments in the answer, so that I know whether waiting for a donor store caused the delay.
5. As a CEO, I want to ask "HungerStation orders in Riyadh this week versus last?", so that I get a number and its change without an analyst.
6. As a CEO, I want to break order counts down by channel, city or day in a follow-up question, so that I can dig into a number without starting over.
7. As a CFO, I want to ask how many stores have an SAP posting backlog today, so that I see the finance risk in one line.
8. As an operations manager, I want to ask for a store's or a city's callout take rate and failed takes, so that I can spot weak stores quickly.
9. As any user, I want to see which tools ran and with what inputs, so that I can trust the answer or spot a wrong filter.
10. As any user, I want every order number in an answer to link to its delivery document, so that I can check the source in one click.
11. As any user, I want to see when the copilot can't answer from its tools, so that I never act on a made-up figure.
12. As any user, I want two example questions shown when the panel is empty, so that I know what kind of question works.
13. As any user, I want to ask a follow-up ("and the week before?") that keeps the earlier context, so that the conversation flows.
14. As any user, I want to start a new conversation, so that an old context doesn't bleed into a new question.
15. As any user, I want to see that the copilot is working while it calls tools, so that a 10–20 second wait doesn't look like a hang.
16. As any user, I want a plain message when the AI service is unreachable, so that I know it's the service and not my question.
17. As any user, I want a plain message when I have hit my question limit, so that I know when I can ask again.
18. As any user, I want answers that work in an Arabic interface, so that the copilot fits the rest of the app.
19. As a user without the copilot grant, I want no copilot button at all, so that I don't hit a dead end.
20. As a data-protection officer, I want customer names, mobiles, national IDs, addresses and diagnoses never sent to the AI service, so that we keep the no-personal-data rule and PDPL.
21. As a data-protection officer, I want a last-line check that blocks any outbound text that looks like a mobile number, national ID or email, so that a mistake in one tool can't leak data.
22. As a data-protection officer, I want every blocked call recorded, so that I can find and fix the tool that caused it.
23. As an auditor, I want every question, every tool call and every answer logged with the user and the time, so that copilot use can be reviewed.
24. As IT, I want the AI service key to live only on the server, so that it never reaches a browser.
25. As IT, I want only the SIS.Api host to make outbound calls to the AI service, so that the egress rule is one firewall line.
26. As IT, I want a per-user rate limit and a per-question tool-call cap, so that cost and load stay bounded.
27. As an engineer with an MCP client, I want to connect to the OMS tools with a token, so that my own assistant can answer OMS questions.
28. As an engineer with an MCP client, I want the MCP tools to be exactly the copilot's tools, with the same masking, so that the two ways in can never disagree.
29. As an administrator, I want to issue and revoke MCP tokens, each tied to a user, so that every MCP call is audited to a person.
30. As an administrator, I want MCP calls to need the same copilot grant, so that one permission governs both ways in.
31. As the presenter, I want the two scripted demo questions to answer reliably on staging, so that the pitch's copilot moment works live.
32. As the presenter, I want a recorded fallback of both demo questions, so that the pitch survives a network failure.
33. As an engineer, I want a fixed evaluation set of questions with expected tool calls, so that a prompt or model change can be checked before it ships.

## Implementation Decisions

**D1 — One catalogue, two ways in.** The tool catalogue is one module in SIS.Api.
- Each tool has a name, a description written for the model, a strict JSON input schema
  (`additionalProperties: false`) and a C# implementation.
- The copilot loop (D4) and the MCP endpoint (D8) both enumerate the **same** registry. Neither has a
  tool the other lacks.
- Adding a tool is a code change and a review. Nothing is configurable at runtime.

**D2 — The v1 catalogue (seven tools, all read-only).**

| Tool | Input | Returns | Built on |
|---|---|---|---|
| `order_timeline` | order or delivery document number | Channel, store code and name, city, promised slot, every status milestone with its time, callout rounds (radius, offers, takes, refusals), donor moments, the current state. **No customer fields.** | delivery document + its action log, the dispatch read, donor requests |
| `order_delay_facts` | order or delivery document number | Promised versus actual, minutes late, the stage that overran most and by how much, callout rounds needed and the final radius, donor wait if any | the same sources, computed server-side, so the model never does the arithmetic |
| `orders_by_channel` | `from`, `to` (≤ 92 days), optional `channel`, `city`, `store`; `groupBy` = `day`, `week`, `channel` or `city` | counts per group, plus the same-length previous period when `compareToPrevious` is true | the delivery document header (category O) and its document source |
| `sales_summary` | `from`, `to` (≤ 92 days), optional `city`, `store`; `groupBy` | till sale count, "value through our tills" (net SAR), and the share of sales identified to a loyalty member | the till sales tables, through a pre-aggregated daily store rollup |
| `callout_stats` | `from`, `to`, optional `city`, `store` | callouts offered, take rate, failed takes, median time to take | the dispatch scorecard's existing door logic |
| `sap_posting_backlog` | none | stores with unposted days, the oldest unposted day, a count by rail | the SAP export console's fleet summary |
| `store_lookup` | free text (code, name or city) | up to 20 stores: code, name, city, region | store master data |

- Wording: values the model sees use the gap matrix's caveat language. Till value is "value through
  our tills", never revenue (723).
- `sales_summary` must not scan `RetailTrx` per question, because the table has about 465M rows. It
  reads a daily per-store rollup. If no rollup exists, BO-1 builds one: a nightly job, plus a
  same-day partial refreshed every 15 minutes.

**D3 — Masking by construction, then a backstop.**
- Every tool returns its **own DTO** that projects only allowed fields. No tool returns an entity,
  a row or a dynamic object.
- Customer name, mobile, email, national ID or iqama, address, coordinates, prescription contents and
  diagnosis fields **do not exist** on any tool DTO. A server test fails the build if one appears.
- City and store are allowed; customer location finer than a city is not.
- As a backstop, every outbound payload to the AI service (tool results and the user's own
  question) passes a scrubber that looks for:
  - Saudi mobile shapes;
  - 10-digit national ID or iqama shapes (leading 1 or 2);
  - email addresses.
  A hit **blocks** the call, returns refusal `COPILOT-403`, and logs the tool name and the field path
  (never the value).
- The user's own question is scrubbed too, so pasting a customer's mobile into the question is
  refused, not forwarded.

**D4 — The model loop, behind a switchable model connector (owner ruling, 2026-11-03).** The
company chooses the AI vendor by contract, so the copilot must not be tied to one vendor.
- SIS.Api owns the loop: send the question and the D1 tools, run the tool calls the model asks
  for, send the results back, and repeat until the model answers.
- The loop talks to the model only through **one internal model connector**. The connector covers
  only what every major vendor supports: a system prompt, tools as JSON schema, tool calls, tool
  results, a final answer, and token counts.
- **v1 ships two connectors:**
  - **Anthropic (Claude):** uses the official Anthropic C# SDK, NuGet `Anthropic`.
  - **Google (Gemini):** uses Google's official .NET SDK for Gemini.
  The first server ticket checks whether both SDKs plug into `Microsoft.Extensions.AI`'s common
  chat-client abstraction. If they do, that abstraction is the connector. If not, we write our own
  thin interface.
- **Which vendor and model to use is configuration per environment** (`provider`, `model`, key).
  Switching is a config change and a restart, never a code change.
- The default is `claude-opus-5-5` at effort `medium`. Vendor-only extras are switched on inside
  their own connector and never relied on by the loop: Claude's prompt caching and its
  `fallbacks: "default"` refusal fallback, and Gemini's own equivalents.
- **The D14 evaluation set gates every switch.** A provider or model is not switched in production
  until it passes the set on staging, both demo stories included.
- The audit (D6) records the provider and model that served each answer, and `servedBy` (D10) shows
  it.
- Limits: at most **8 tool calls per question** and **60 seconds** wall clock. Past either, the
  loop stops and answers with what it has, saying it stopped.
- The system prompt states:
  - answer only from tool results;
  - name the figures' periods;
  - say "I can't answer that from the OMS tools" when no tool fits;
  - never estimate a number a tool did not return;
  - answer in the language of the question.
- The model id, effort and caps are server configuration, not code.

**D5 — Conversations.**
- Each answer belongs to a `conversationId`. Follow-ups send it back, and SIS.Api replays that
  conversation's messages, append-only.
- A conversation holds at most **10 questions** and expires **30 minutes** after its last
  question. Past either limit, the panel offers a new conversation.
- Conversations live in server memory or cache. They are not a durable store; the audit (D6) is the
  durable record.

**D6 — Audit.**
- One audit record per question, written whether it answered, was refused or failed. It holds:
  - user and channel (`panel` or `mcp`), time, `conversationId`;
  - the question text after scrubbing;
  - each tool call: name, inputs, row count, milliseconds;
  - the answer text;
  - input, output and cache tokens, and the model that served it;
  - the outcome: `answered`, `cannot-answer`, `refused`, `blocked-pii`, `limit`, `error`.
- Retained **180 days**. Read by query or SQL in v1; an admin screen is out of scope.

**D7 — Access, limits and refusals.**
- Grant `BackOfficeScreen[Copilot, 01]`. Probe `GET Copilot/Access` → `{ canAsk, canUseMcp }`.
  The probe follows the OMS pattern: **absent or unreachable means denied**, because the panel can
  send data to an external service.
- Limits: **30 questions per user per hour**, and a question of at most **1,000 characters**.
- Refusals are envelope business outcomes with codes:

| Code | Meaning |
|---|---|
| `COPILOT-401` | no grant |
| `COPILOT-402` | rate limit, with the reset time |
| `COPILOT-403` | blocked: looked like personal data |
| `COPILOT-404` | AI service unreachable or timed out |
| `COPILOT-405` | question too long |
| `COPILOT-406` | conversation expired or full |

**D8 — MCP endpoint.**
- SIS.Api hosts an MCP server over **Streamable HTTP** at `/mcp`, using the official MCP C# SDK. It
  exposes the D1 registry as MCP tools with the same names, schemas and descriptions.
- **Auth in v1: per-user bearer tokens.**
  - An administrator issues a token tied to a user. Only its hash is stored, and it can be revoked.
  - Every MCP call resolves to that user, needs `canUseMcp` (the same grant), counts against the
    same rate limit and writes the same audit record with channel `mcp`.
  - OAuth for MCP is out of scope.
- Token issue and revoke in v1 is a server-side admin command or SQL script. An admin screen is
  out of scope.
- **MCP calls run our tools only. SIS.Api calls no model for them;** the client's own assistant
  does the reasoning. Masking still holds because the tools' DTOs are the same. The scrubber (D3)
  also runs on MCP tool results before they leave.

**D9 — Keys, egress and the IT precondition.**
- The Anthropic API key lives only in SIS.Api's server secret configuration. It never reaches the
  browser or the repo.
- Outbound HTTPS to the Anthropic API is allowed from the SIS.Api host only.
- **Precondition, raised first:** IT approves the key and that egress for **staging**, and for
  production if it is to be shown there.
- **Fallback:**
  - If production approval doesn't arrive, the pitch demos on staging only.
  - If staging approval isn't in place by **2026-11-24**, the demo moment is a recording made on a
    developer machine against staging data. The pitch says so.

**D10 — The wire (what the web half builds against).**
- `GET Copilot/Access` → `{ canAsk, canUseMcp }`.
- `POST Copilot/Ask` with `{ question, conversationId? }` returns:
  - `conversationId`, `questionNo` (1–10);
  - `answer`: plain text with light markdown — paragraphs, bullet lists and simple tables only;
  - `orderRefs`: the order or delivery numbers named in the answer;
  - `trace`: one entry per tool call, `{ tool, input, rows, ms, ok }`;
  - `outcome`, `stoppedEarly`, `servedBy`, `askedAt`.
- Refusals are the D7 codes, in the envelope, through `@/core/api`. A `COPILOT-402` refusal
  carries `data.resetAt` (`yyyy-MM-ddTHH:mm:ss`, the same format as `askedAt`) for when the user
  may ask again. This was settled while building 737; BO-1 must send it.
- Non-streaming. The panel shows a working state for the whole call (D11). Streaming is out of
  scope in v1, because the envelope rule keeps every call inside `@/core/api`.

**D11 — The web panel.**
- A top-level feature `features/copilot/`. It is cross-cutting like `auth`, not a nav area: it is
  opened from an app-shell button the probe gates, and is also routable at `/copilot` as a full page.
  i18n namespace `copilot`.
- The panel holds:
  - the question box (with the 1,000-character limit shown);
  - two example questions while it is empty: the D12 demo stories;
  - the conversation;
  - "New conversation".
- Each answer shows:
  - the answer text, with its `orderRefs` linked to the delivery document route;
  - a collapsed "How I got this" trace listing each tool in plain words with its inputs and row
    counts;
  - "stopped early" when set.
- Bidi:
  - The answer is free text and gets `<bdi>`.
  - Order numbers and trace inputs are machine values and get `Ltr`.
  - Each refusal shows its own i18n message, never a raw code.
- The working state names the steps generically ("Looking up the order", "Counting orders")
  from a fixed tool → label map, because there is no streaming.

**D12 — The two demo stories (726 §4).**
1. *"Why was order X late?"* X is the order used in the demo's six-hop walk (731), chosen so its
   timeline has a callout with a widened radius. The expected tool calls are `order_timeline` and
   `order_delay_facts`.
2. *"HungerStation orders in Riyadh this week versus last?"* The expected tool call is
   `orders_by_channel` with `channel`, `city` and `compareToPrevious`.

Both questions sit in the evaluation set (D14), so a change that breaks the demo fails before the
pitch.

**D13 — Delivery-time facts.** `order_delay_facts` reads the live OMS milestone columns through
SIS.Api, not the replica: the replica has them empty (723). If a milestone is missing for an order,
the tool returns it as `null`, and the answer says the stage time is unknown rather than inventing
one.

**D14 — Evaluation set.**
- About 25 questions: the two demo stories, other orders, aggregates, follow-ups, questions no
  tool can answer, and attempts to extract personal data.
- Each question records the **expected tool calls** and a pass rule:
  - the right tools were called;
  - no number appears that a tool did not return;
  - no-tool questions get "can't answer";
  - extraction attempts are refused or blocked.
- It runs on staging before any prompt, model or tool-description change ships. It is built with
  the `claude-api` skill's `build-eval` guide when the server half is ready.

## Part two: the sourcing advisor (smart sourcing, gap #3)

**Owner ruling, 2026-11-03.** Smart sourcing joins this spec. This **overrules 725**, where it was
only a roadmap slide, because of its value to the CFO. It closes gap-matrix **row 8**:
cost-optimised sourcing, simulation and explain-why.

In v1 it is a **read-only advisor**. It never changes how a live order is routed. Callouts,
serving lists and the order store behave exactly as today (the map rules out backend architecture
changes).

**D15 — What the advisor answers.**
- **Explain one order.** For a past delivery document:
  - the candidate stores that could have filled it;
  - each candidate's estimated cost and whether it would have been on time;
  - the store that actually filled it;
  - the cheapest on-time candidate;
  - in plain words, why they differ (for example "the actual store was 7.4 km away; a store 2.1 km
    away had the stock and was on time for SAR 9 less").
- **Simulate a period.** Over a date range (≤ 92 days, default the last 30):
  - how many orders had a cheaper on-time candidate than the actual store;
  - the total and average estimated saving in SAR;
  - the same, broken down by city, channel and delivery type;
  - the orders with the biggest savings, each linking to its explanation.

**D16 — Candidates.** The candidates for an order are the stores that:
- the order's delivery type allows (serving list or callout radius, the same rules routing uses
  today, including the wider callout radius);
- had the ordered lines in stock at order time.

Stock evidence, best first:
1. the order's callout bids and donor-request lookups, recorded at the time;
2. the stock-by-distance lookup's history, if kept;
3. otherwise, current stock, with the candidate marked "stock estimated".

The server ticket's first task is to find out which of these exist (open question S1).

**D17 — The cost model v1.** The estimated cost of a candidate is the sum of:
- **courier cost:** fleet type (own fleet, OTO, aggregator) × (base + rate per km × road distance
  from store to delivery point);
- **pick cost:** a rate per order line;
- **split penalty**, when no single candidate has every line (v1 shows the split but does not
  optimise across splits);
- **express premium**, where the delivery type is express.

Notes:
- **All rates are configuration**, versioned with an effective date, and **supplied by finance**
  (open question S2). Until finance supplies them, the advisor runs on placeholder rates and every
  screen says "placeholder rates". No SAR saving goes on a slide until finance's rates are in.
- Distance is computed server-side from the delivery coordinates. **Coordinates never leave the
  server** and never appear in any response or tool (D3 still holds). Responses carry only km and
  city.
- Stock protection (keeping stock a walk-in customer might need) and expiry are **not** in v1. They
  are listed as next factors.

**D18 — On time.** A candidate is on time when its estimated ready time plus travel time meets the
order's promised slot:
- ready time = the store's median pick-to-ready minutes over the last 30 days, at that hour of the
  day;
- travel time = road distance ÷ the city's median courier speed from delivery history.

When no history exists for a store, the candidate is "on time: unknown" and is never counted as a
saving.

**D19 — How the simulation runs.**
- A nightly server job scores every delivered order of the day before and stores one row per order:
  - actual store and its estimated cost;
  - the cheapest on-time candidate and its cost;
  - the saving;
  - the reason codes;
  - the rate version used.
- The simulation reads these rows. It is never computed per click.
- A back-fill over the last 92 days runs once when the job first ships, and again when finance
  changes the rates (open question S3: re-score history or not).

**D20 — The wire (what the web half builds against).**
- `GET SourcingAdvisor/Access` → `{ canView }`.
  - Grant `BackOfficeScreen[SourcingAdvisor, 01]`.
  - Absent or unreachable means denied, as for the OMS viewer.
- `GET SourcingAdvisor/Explain?orderNo=` returns:
  - `orderNo`, `deliveryType`, `city`, `promisedBy`;
  - `actual`: `{ store, km, cost, onTime, readyMins, travelMins }`;
  - `best`: the same shape;
  - `candidates[]`: up to 15 rows of `{ store, km, cost, costParts{ courier, pick, split, express },
    onTime, stockEvidence }`;
  - `saving`, `reasons[]` (codes), `rateVersion`, `placeholderRates`.
- `GET SourcingAdvisor/Summary?from=&to=&city=&channel=&deliveryType=` returns:
  - `orders`, `ordersWithSaving`, `totalSaving`, `avgSaving`;
  - `byCity[]`, `byChannel[]`, `byDeliveryType[]`;
  - `top[]`: up to 50 orders, each `{ orderNo, actualStore, bestStore, saving, reasons[] }`;
  - `rateVersion`, `placeholderRates`, `scoredThrough`.
- Refusals:

| Code | Meaning |
|---|---|
| `SOURCING-401` | no grant |
| `SOURCING-402` | range over 92 days or reversed |
| `SOURCING-403` | order not found or not scored yet |
| `SOURCING-404` | scoring not run for part of the range, with `scoredThrough` |

**D20a — Wire details settled while building 738 (2026-11-03). BO-2 must confirm or replace
each.**
- **`onTime`** is `true`, `false` or `null` (unknown). Any other value reads as unknown and is
  never counted as a saving.
- **`storeName`** is an optional field beside every `store` (in `actual`, `best`, `candidates[]` and
  `top[]`), so the screen can show the `code · name` pair D21 asks for. Without it, the code shows
  alone.
- **Reason codes v1:**

| Code | Meaning |
|---|---|
| `NEARER_STORE_STOCKED` | a nearer store had the stock |
| `ACTUAL_LATE` | the actual store would have been late |
| `AVOIDABLE_SPLIT` | the split could have been avoided |
| `EXPRESS_PREMIUM` | the express premium changed the result |
| `CHEAPER_FLEET` | a cheaper fleet type could have delivered it |
| `ACTUAL_WAS_BEST` | the actual store was the cheapest on-time choice |
| `STOCK_ESTIMATED` | stock was estimated, not recorded |

  An unknown code shows a fallback sentence that names the code.
- **Summary breakdown rows** are `{ key, orders, ordersWithSaving, totalSaving, avgSaving }`.
  Each `top[]` row carries `actualStoreName` and `bestStoreName` beside its store codes (settled
  in 739).
- **`SOURCING-404`** carries `data.scoredThrough`.
- **The default range** is the 30 days ending yesterday, because scoring is nightly (D19).
- **The share** of orders with a saving is computed on screen, as `ordersWithSaving ÷ orders`. The
  server need not send it. `top[]` keeps the server's order.
- **Displayed cost (amended in the review fix, 2026-11-03).** A candidate always shows the door's
  `cost` as sent, and its parts as sent; a missing part reads "—", never 0. The screen never
  recomputes a total. The door owns the parts summing to `cost`.

**D21 — The advisor in the web app and in the copilot.**
- A new oms-react screen, **Sourcing advisor**, at `/oms/sourcing-advisor`, i18n namespace
  `sourcing-advisor`. It opens on the 30-day simulation (D15) and drills into one order's
  explanation.
- The delivery details page gets a "Why this store?" link into that order's explanation, shown
  only when the probe allows it.
- Two more catalogue tools (D2), so the copilot and MCP can answer "why did this order go to that
  store?" and "how much could smarter sourcing have saved last month?":
  - `sourcing_explain(orderNo)`;
  - `sourcing_savings(from, to, city?, channel?)`.
  They return the D20 shapes, with no coordinates.
- Bidi:
  - store `code · name` pairs and every km, SAR and time are machine values and get `Ltr`;
  - the reasons are i18n sentences built from the codes, never server free text.

**Open questions (part two):**
- **S1 (server ticket, first task):** which stock-at-order-time evidence exists (D16)?
- **S2 (owner, with finance):** the v1 rates — courier per fleet type and per km, pick per line,
  split, express. The advisor ships on placeholders until these arrive.
- **S3 (owner):** when finance changes the rates, re-score history or score only from that date?
  The recommendation is to re-score the last 92 days, so the period comparison stays
  like-for-like.

## Testing Decisions

- **Test only external behaviour.** Assert what a user or a client sees: the rendered answer,
  links, trace and refusal message on the web, and the tool output and the outbound payload on the
  server. Never assert internal calls.
- **Web seam 1: one pure module (vitest).** It turns the D10 answer into the view model:
  - order references become link targets;
  - the trace becomes plain-language rows, using the tool → label map;
  - each refusal code maps to its i18n key, and an unknown code falls back to the server's message;
  - a missing `trace` or `orderRefs` is read as empty, so a bare answer never crashes.
  Prior art: `src/features/oms/dispatch-scorecard/figures.test.ts` and
  `src/features/reports/sap-export-console/wire.test.ts`.
- **Web seam 2: one Playwright drive (`tools/copilot-drive.mjs`) against stubbed envelopes.** It
  covers:
  - the probe hides the button;
  - the empty state's examples;
  - an answer with links and the trace;
  - a follow-up keeping the `conversationId`;
  - "New conversation";
  - each refusal code;
  - the working state;
  - Arabic RTL with an English answer.
  Prior art: `tools/dispatch-scorecard-drive.mjs`, `tools/delivery-statistics-drive.mjs`.
- **Server, owned by BO-1:**
  - a reflection test that **no tool DTO carries a forbidden field** (D3);
  - scrubber tests with real-shaped mobiles, IDs and emails;
  - one contract test per tool against a seeded test database;
  - an MCP test that lists the tools and checks they equal the registry;
  - an audit-record test for each outcome.
- **Model behaviour** is tested by the D14 evaluation set, not by unit tests. The same set is run
  against every connector (D4) before a switch.
- **Sourcing advisor, web side:**
  - One pure module turns the D20 Explain and Summary replies into rows: cost parts, on-time state,
    the reason codes as i18n keys, the "placeholder rates" flag, and an absent list read as empty.
  - One drive (`tools/sourcing-advisor-drive.mjs`) covers: the probe; the 30-day summary; a drill
    into one order; the "Why this store?" link from delivery details; each SOURCING code; and RTL.
- **Sourcing advisor, server side (BO-2):**
  - cost-model tests with fixed rates and fixed distances;
  - a test that no reply carries coordinates;
  - a scoring-job test on a seeded day.

## Out of Scope

- Any write or action: cancelling, reassigning, refunding or messaging a customer. The catalogue is
  read-only.
- Free-form SQL or table access for the model.
- Customer-level questions about a person: who bought what, a member's history. Customer 360 (730)
  is the screen for that, and it never goes through the copilot.
- Streaming answers, voice and file uploads.
- OAuth for MCP; an admin screen for MCP tokens or for the audit log.
- Natural-language **configuration** (an agent drafting rule changes).
- **Changing live routing** from the sourcing advisor, A/B tests of sourcing on live orders, and
  optimising across split shipments. The advisor is read-only in v1, and these are its next phase.
- The executive command centre (728). Its KPIs may later become catalogue tools.
- Embedding or RAG over documents or manuals.

## Further Notes

- **BO-1 (filed: BackOffice 3346–3349): the copilot's server half.** D1–D9, D13 and the D14 runner,
  plus the `sales_summary` rollup if none exists. The suggested split is four tickets:
  1. catalogue, masking and scrubber;
  2. model connector with the Claude and Gemini connectors (D4);
  3. Ask loop, conversations and audit;
  4. MCP endpoint and tokens.
- **BO-2 (filed: BackOffice 3350–3353): the sourcing advisor's server half.** D16–D20, plus the two
  sourcing tools of D21. The suggested split:
  1. finding the stock evidence (S1), candidates and the cost model with configured rates;
  2. the nightly scoring job and back-fill;
  3. the Explain and Summary doors;
  4. the two catalogue tools.
- **Web tickets (for `/to-tickets`):**
  - probe and panel shell with the empty state;
  - answer, links and trace;
  - follow-ups, new conversation and refusals;
  - the live walk on staging once BO-1 ships, with both demo stories and the recording fallback.
- **Owner actions:**
  - IT approval for the key and egress (D9), started now;
  - pick demo order X with the demo-script ticket (731);
  - one data-protection sign-off on the D2 field lists.
- **Pitch framing (726).** The copilot is section 4, "Ask the OMS". MCP is one roadmap-slide line
  showing it already exists: "our OMS is agent-ready". If the MCP endpoint is live by 3 December, it
  can be shown in Claude Desktop as a 30-second extra.
