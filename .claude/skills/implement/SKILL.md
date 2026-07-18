---
name: implement
description: "Implement a piece of work based on a spec or a ticket."
disable-model-invocation: true
---

Implement the work described by the user in the spec or ticket (`.issues/` — conventions in `docs/agents/issue-tracker.md`). One ticket per session; work the frontier (blockers all done).

Respect `.claude/rules/` (i18n zero-literal, logical Tailwind, api-envelope) and `CONTEXT.md` vocabulary in everything you touch.

Use /tdd where possible, at pre-agreed seams — a ticket's **Proof** section names the tests and their tiers; that's the seam agreement. Where the test runner isn't installed yet, /tdd's "Project stack" section governs the fallback (typecheck + driving the app) — record what you did in Proof.

Run `npm run typecheck` continuously (the fast inner loop), run the affected test file regularly if a runner is present, and `npm run build` once at the end. For UI slices, also **drive the app** (`npm run dev`, or extend `tools/screen1-smoke.mjs`) to confirm the behavior actually renders — a green typecheck is not proof a screen works.

Once done, review the work: the built-in /code-review for correctness bugs, then /standards-review for rules-compliance and spec-fidelity.

Close the ticket when its **Done when** holds: set `status: done`, tick the Proof checkboxes, update its `INDEX.md` line.

Commit your work to the current branch.
