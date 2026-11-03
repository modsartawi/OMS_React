---
type: wayfinder-ticket
wayfinder: grilling
map: 741
status: open
blocked-by: 743, 744
---

# 746 — How does the AI generate queries and views within spec 734's tool catalogue and MCP?

## Question

How does the AI reach the semantic layer and the BI tool, reusing
[Ask the OMS](734-ask-the-oms-copilot-and-mcp-tools-spec.md) rather than standing up a second AI
stack?

Settle these:
- **New catalogue tools.** Which tools join 734's D1 registry? For example:
  - `semantic_query` (structured measures, dimensions, filters and grain, validated against the
    model);
  - `describe_model`;
  - `create_view` (saves a view in the BI tool and returns its link).
  Are they read-only? 734's catalogue "cannot write", but saving a view is a write to the BI tool,
  not to the OMS.
- **Overlap with D2.** Do D2's fixed tools (`orders_by_channel`, `sales_summary`) stay, or move
  onto the semantic layer?
- **Masking.** Is masking still by construction (no PII member is declared), and does D3's scrubber
  also run on semantic results?
- **Limits.** What row caps and time-outs apply per semantic query, and how are they shown in the
  trace?
- **Ways in.**
  - Is the panel (D11) the entry point, or does the BI tool's own UI get an "ask" box?
  - Does MCP (D8) expose the new tools unchanged?
- **The switchable model (D4).** It stays as it is, and the D14 evaluation set extends to queries
  and views.
