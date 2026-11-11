---
type: wayfinder-ticket
wayfinder: research
map: 717
status: done
blocked-by: —
---

# 718 — What do top-tier enterprise OMS products offer?

## Question

What capabilities do the market-leading enterprise OMS products sell? Group them into a
**capability taxonomy** that can serve as the rows of the comparison matrix.

The products to cover: Manhattan Active Omni, Salesforce Order Management, IBM Sterling Order
Management, Fluent Commerce, Kibo, Blue Yonder Order Management and Oracle Retail / Oracle
Commerce OMS. Also check how analysts frame the category, for example the Gartner Market Guide or
IDC MarketScape for distributed order management.

The answer should include:
- the capability taxonomy, roughly 30–60 rows grouped into domains. Examples: order capture,
  distributed order management and sourcing, inventory visibility and ATP, store fulfilment
  (pick, pack, BOPIS, curbside, ship-from-store), delivery and last mile, returns and exchanges,
  customer service console, payments and refunds, promotions and pricing, analytics, integrations
  and APIs, configurability (rules, low-code), mobile store apps.
- for each product, which rows it claims, citing a primary source such as a vendor doc or
  datasheet.
- what the market treats as **table stakes** and what it treats as a **differentiator** in 2026,
  including AI or agentic features.

Write it with `/research` to `docs/research/717-enterprise-oms-capabilities.md`.

## Answer

Research note: [docs/research/717-enterprise-oms-capabilities.md](../docs/research/717-enterprise-oms-capabilities.md) — 69 capability rows in 14 domains, coverage across the 7 products, 47 cited sources.

- **Oracle** is compared as Oracle Retail Order Management Suite (Order Orchestration + Order Administration). Fusion Order Management is a B2B / manufacturing product, so it is out.
- **How analysts frame it:** Gartner has a *Market Guide for Distributed Order Management* (June 2025) and no Magic Quadrant. IDC's 2026 MarketScape is called "AI-Enabled Order Orchestration". In Forrester's Wave (Q1 2025), Manhattan, Fluent and Kibo say they are Leaders.
- **The five differentiators of 2026:**
  1. Sourcing that minimises total cost, with simulation or A/B tests of the routing rules.
  2. AI agents that explain in plain language why an order went where it did.
  3. Configuration in plain language, with a person approving it.
  4. Delivery promises based on store capacity, down to 15-minute windows.
  5. MCP servers that let outside AI agents act on orders.
- **Pharmacy fit:** of the seven, only Kibo publicly sells lot, serial and expiry tracking. Nahdi runs Fluent (secondary source). Raia Drogasil runs Manhattan. Walgreens is a Blue Yonder customer.
- **Pricing:** only Fluent publishes a model. The rest are "contact us".
- **Caveat:** a "?" cell means "not publicly claimed", not "absent". Most of the 2026 AI claims come from vendor press releases.
