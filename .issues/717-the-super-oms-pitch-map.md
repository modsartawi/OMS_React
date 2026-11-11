---
type: wayfinder-map
status: open
---

# 717 — The super OMS pitch: proving our platform against the market

## Destination

A **pitch package ready to present to top management** (CEO, CFO, COO, CMO), plus a **build
roadmap**. The package has four parts: an executive slide deck, a live demo script on staging, a
capability-by-capability comparison matrix against top-tier OMS products, and a
cost-of-buying comparison. The roadmap names the **2–3 headline features** we build before the
pitch, each with a `ready` spec. It also ranks what comes after.

We have arrived when all four parts exist, the headline features' specs are `ready` and handed to
`/to-tickets`, and no decision still blocks the pitch. **Target pitch date: about 2026-12-03.**

## Notes

**What owner charting settled (2026-11-03):**
- **What we claim.** We built an end-to-end OMS. The claim covers the **whole platform**, and
  oms-react is the part management sees. That means NewPos tills, SIS.Api, the SAP IDoc rail,
  Nphies/Wasfaty/Waseel insurance, the rules engine (insurance rules, IDF priority, playground),
  HungerStation/Deliverect, dispatch with callouts and scorecards, donor requests, pick support,
  prescription sessions, coupons/campaigns, loyalty and collection. It is not a screen-by-screen
  comparison of the web portal.
- **Audience.** The whole top-management team. Every claim must answer at least one of: *revenue /
  customer* (CMO), *cost* (CFO), *control / operations* (COO), *strategy / risk* (CEO).
- **What we compare against:** enterprise OMS (Manhattan Active Omni, Salesforce OMS, IBM Sterling,
  Fluent Commerce, Kibo, Blue Yonder, Oracle); pharmacy and health retail omnichannel; delivery and
  quick-commerce dispatch. Loyalty and CRM suites are **not** a comparison set. Our loyalty and
  campaigns still count as capabilities we have.
- **Numbers.** Real figures from the prod replica are allowed as proof points. The replica is
  read-only and reachable only from the corporate network (BackOffice memory
  `reference_pos_replica_readonly_door`). No customer-identifying data goes into the materials.
- **Language:** English only.

**Execution override.** Wayfinder normally only plans. This map **does produce the pitch
materials** (deck, demo script, matrix, cost comparison), because they are the destination. The
**headline features** do not get built inside the map. Each one leaves for `/to-spec` → `/to-tickets` →
`/implement` **as soon as its spec can be written**, without waiting for the rest of the map,
because of the one-month deadline.

**Skills:** research tickets use `/research`. Research notes go in `docs/research/717-*.md`
and are linked from the ticket, never pasted in. Grilling tickets use `/grilling`. Use
`/domain-modeling` only if a new domain term comes up. The deck and matrix are built with the
Artifact tool (Slides type for the deck).

**Where the code is.** Web features are under `src/features/<area>/` (14 areas, roughly 100 features).
The backend lives in BackOffice (`C:\Work\DMSCO\BackOffice`, its own `.issues/` and `CONTEXT.md`).
Read BackOffice to find out what the platform does. Do not edit it from this map.

**Owner rulings after charting (2026-11-03):**
- We start with the LACK gaps. Gap #2 (AI copilot, plain-language data questions, MCP) is
  specced in [Ask the OMS](734-ask-the-oms-copilot-and-mcp-tools-spec.md).
- **Smart sourcing (gap #3) is built, not just a slide.** This overrules part of 725. It is built
  as a read-only sourcing advisor (explain one order, plus a 30-day savings simulation) in the same
  spec.
- **The copilot's AI model is switchable by configuration** (Claude or Gemini), because the vendor
  follows the company contract.
- Web build tickets 735–740. The server halves are BackOffice asks BO-1 and BO-2, not yet filed.

## Decisions so far

<!-- the index — one line per resolved ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [What do top-tier enterprise OMS products offer?](718-what-do-top-tier-enterprise-oms-products-offer.md) — 69 rows across 7 products. The 2026 differentiators are AI sourcing and explain-why agents, capacity-aware promises and MCP. Only Kibo sells lot/serial tracking. Nahdi runs Fluent.
- [How do leading pharmacy chains run omnichannel orders?](719-how-do-leading-pharmacy-chains-run-omnichannel-orders.md) — 31 pharmacy rows. KSA must-haves are Wasfaty, NPHIES and SFDA RSD (fines are live). Nahdi is the benchmark at 25.8 % digital in FY25 and 31 % in Q1-26.
- [What do delivery and quick-commerce dispatch tools offer?](720-what-do-delivery-and-quick-commerce-dispatch-tools-offer.md) — 35 rows. Only Tookan documents a widening callout radius. "Modern" means live tracking, own fleet first, capacity slots and regulated handover.
- [What does our platform do today?](721-what-does-our-platform-do-today.md) — 127 capabilities, but only 25 provably live and 81 not provably live. 15 hidden gems. Whether oms-react runs in production is still unknown.
- [Which real numbers prove the platform works?](723-which-real-numbers-prove-the-platform-works.md) — 965 stores, ~187 k sales a day and 412 k omni orders in 30 days (52 % own app/web). 2.69 M Wasfaty eRx, 14.9 M members. No delivery times available from the replica.
- [Where do we lead, match and lag the market?](724-where-do-we-lead-match-and-lag-the-market.md) — 54 rows: 13 lead / 27 match / 8 part / 6 lack. oms-react is in production. The four headlines are operations and compliance only (serial+batch, donor transfers, callouts, till+OMS). Gaps ranked Raqeeb > AI copilot > smart sourcing > cold-chain.
- [Which 2–3 headline features do we build before the pitch?](725-which-2-3-headline-features-do-we-build-before-the-pitch.md) — Build three: an executive command centre (CEO/CFO), an AI copilot "Ask the OMS" (no personal data leaves our servers) and a Customer 360 journey (CMO). The sourcing simulator and Raqeeb become roadmap slides. Built by the owner plus agents, about one spec each.
- [What story does the pitch tell?](726-what-story-does-the-pitch-tell.md) — 45 minutes, presented by the owner alone. Opens on the command centre live, follows one Wasfaty order through 6 hops (donor store, serial and batch, callout and SAP carry the leads), then Customer 360, then the copilot. The ask is OMS of record plus a funded roadmap with a named headcount. The CFO and CMO payoff comes from the hops, the numbers and the features, not from headline leads.

- [The AI copilot has a ready spec](729-the-ai-copilot-has-a-ready-spec.md) — The [Ask the OMS](734-ask-the-oms-copilot-and-mcp-tools-spec.md) spec is ready. It covers the copilot, MCP and a read-only sourcing advisor over one masked, read-only set of tools. The AI model is switchable (Claude or Gemini). Web tickets 735–740; server halves BO-1 and BO-2.

## Not yet specified

_All fog toward the destination has graduated into tickets: the demo script (731), the roadmap
and headcount (732), and the deck with objection prep and rehearsal (733)._

## Out of scope

- Arabic versions of the pitch materials (owner: English only).
- Benchmarking against loyalty or CRM marketing suites (Braze, Salesforce Marketing Cloud and so on).
- Changing backend architecture to support the pitch. The headline features build on what exists.
