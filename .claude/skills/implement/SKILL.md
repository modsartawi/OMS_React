---
name: implement
description: "Implement a piece of work based on a spec or a ticket."
disable-model-invocation: true
---

Implement the work described by the user in the spec or ticket (`.issues/` — conventions in `docs/agents/issue-tracker.md`). One ticket per session; work the frontier (blockers all done).

Respect `.claude/rules/` (i18n zero-literal, logical Tailwind, api-envelope) and `CONTEXT.md` vocabulary in everything you touch.

**Batch your exploration — budget the round trips, not the reading.** Read as much as the slice needs; under-reading is the worse failure. What is capped is how many *calls* you spend: one Bash call may carry many reads (`cat a.tsx b.tsx; grep -n X c.ts` is ONE call), and it gives you more context in a single view than four calls do. Batch by default; before a third consecutive single-file read, batch the next ten. Sequential reads are fine when file A names file B — never guess at B to save a call. For breadth-first location questions ("where is this route registered", "what else uses this hook") spawn one `Explore` subagent and keep its conclusion; do not delegate judgement, since a subagent returns a summary and the detail is lost.

Use /tdd where possible, at pre-agreed seams — a ticket's **Proof** section names the tests and their tiers; that's the seam agreement. Where the test runner isn't installed yet, /tdd's "Project stack" section governs the fallback (typecheck + driving the app) — record what you did in Proof.

Run `npm run typecheck` continuously (the fast inner loop), run the affected test file regularly if a runner is present, and `npm run build` once at the end. For UI slices, also **drive the app** (`npm run dev`, or extend `tools/screen1-smoke.mjs`) to confirm the behavior actually renders — a green typecheck is not proof a screen works.

Once done, review the work: the built-in /code-review for correctness bugs, then /standards-review for rules-compliance and spec-fidelity.

Close the ticket when its **Done when** holds: set `status: done`, tick the Proof checkboxes, update its `INDEX.md` line.

Commit your work to the current branch.
