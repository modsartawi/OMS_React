---
type: wayfinder-ticket
wayfinder: task
map: 717
status: done
blocked-by: —
---

# 729 — The AI copilot has a ready spec

## Question

Run `/to-spec` on headline feature 2, "Ask the OMS", from **Which 2–3 headline features do we
build before the pitch?** (725, section 2). The result is a `status: ready` spec of about 5–8
tickets, handed to `/to-tickets`. Load the `claude-api` skill for the model and SDK choices.

The spec must settle:
- the fixed tool set and what each tool returns;
- server-side masking that enforces the owner's **no-personal-data** rule;
- where the API key lives and the audit log of questions and tool calls;
- refusals for anything outside the tools;
- the two scripted demo stories.

**A precondition to raise first:** IT approval for the API key and outbound traffic from staging
(and production, if it is to be shown there). If approval cannot arrive before the pitch, the
spec records the fallback (demo on staging only).

Resolved when the spec is `ready` and its build tickets exist.

## Progress

- 2026-11-03: the spec is written and `ready`: [Ask the OMS: an AI copilot and agent-ready MCP tools](734-ask-the-oms-copilot-and-mcp-tools-spec.md). The owner widened the scope to include **MCP (gap-matrix row 50)**, so the spec covers rows 47, 48 and 50. This ticket stays open until `/to-tickets` has cut the build tickets.

## Answer

The spec is ready: [Ask the OMS](734-ask-the-oms-copilot-and-mcp-tools-spec.md). The owner widened it on 2026-11-03 in two ways:
- It also covers **MCP** (row 50) and a **read-only sourcing advisor** (row 8, gap #3).
- The AI model is **switchable by configuration** (Claude or Gemini connectors).

Web build tickets 735–740 exist. The server halves are BackOffice asks BO-1 and BO-2, not yet filed.
