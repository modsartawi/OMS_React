---
type: wayfinder-ticket
wayfinder: task
map: 717
status: open
blocked-by: 728, 729, 730
---

# 731 — What does the live demo walk show?

## Question

Write the **demo script** for the story in [What story does the pitch tell?](726-what-story-does-the-pitch-tell.md). Its live sections are:
- §0, the command-centre cold open;
- §2, one Wasfaty order through six hops: app, insurance, donor store, serial and batch pick, courier callout, SAP posting;
- §3, Customer 360 for that customer;
- §4, the copilot answering "why was that order late?" and the HungerStation question.

Settle:
- **Screens, clicks and timing for each hop.** Section 2 has 12 minutes. Each hop names the oms-react screen it shows and the matrix row it proves (724).
- **The demo order and data.** Is there a real staging order that walks all six hops? Or do we seed one? Which staff/test loyalty member owns it (730)? Is a dedicated demo store needed?
- **Environment.** Is staging rich and stable enough to run live? Which moments are live and which are recorded fallbacks? Callouts and the copilot are the risky ones.
- **What is left out.** Insurer rules with the playground, and prescription sessions, stay out (726).

Resolved when the script exists as a linked asset (`docs/research/717-demo-script.md`), with a recorded-fallback list.

> **Owner ask, 2026-11-03:** the copilot's first example question, "Why was order X late?" (spec 734 D12), must use **the real demo order this ticket picks**. The order must:
> - walk all six hops;
> - include a callout whose search radius widened;
> - exist on staging.
>
> When you pick it, update the copilot's single demo-order setting (built in spec 734's review-fix pass) and the D14 eval story, and note the order number here.
