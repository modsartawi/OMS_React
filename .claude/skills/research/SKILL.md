---
name: research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

Spin up a **background agent** to do the research, so you keep working while it reads.

Its job:

1. Investigate the question against **primary sources** — official docs, source code, specs, first-party APIs — not a secondary write-up of them. Follow every claim back to the source that owns it. For library/framework facts (React, Vite, TanStack Query, AG Grid, react-i18next, …) prefer the context7 MCP docs over web search, and the Angular prototype at `C:\Playground\frontend` or the SIS.Api backend at `C:\Work\DMSCO\BackOffice` when the question is about this app's behavioral contract.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Save it under `docs/` as `<topic-slug>-research.md` (this repo's convention). If the research resolves a wayfinder ticket, link the file from that ticket's `## Answer` (see `docs/agents/issue-tracker.md`) rather than pasting the findings into the ticket.
