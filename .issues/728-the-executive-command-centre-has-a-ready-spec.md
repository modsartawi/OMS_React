---
type: wayfinder-ticket
wayfinder: task
map: 717
status: open
blocked-by: —
---

# 728 — The executive command centre has a ready spec

## Question

Run `/to-spec` on headline feature 1 from **Which 2–3 headline features do we build before the
pitch?** (725, section 1). The result is a `status: ready` spec of about 5–8 tickets, handed to
`/to-tickets`. The server door goes in BackOffice (SIS.Api) and the screen in oms-react.

The spec must settle:
- the KPI list and the definition of each one, agreed with finance (723 caveats: till value is
  not revenue);
- the source of each figure (existing door, new door, or a pre-aggregation job);
- the refresh rate and caching;
- how the big-screen mode works;
- what the screen shows when a source is down.

Resolved when the spec is `ready` and its build tickets exist. Building them is outside this map
(execution override).
