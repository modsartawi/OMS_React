---
name: to-spec
description: Turn the current conversation into a spec and publish it to .issues/ — no interview, just synthesis of what you've already discussed.
disable-model-invocation: true
---

This skill takes the current conversation context and codebase understanding and produces a spec (you may know this document as a PRD). Do NOT interview the user — just synthesize what you already know.

Specs are published to the repo's `.issues/` tracker — conventions in `docs/agents/issue-tracker.md`.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary (`CONTEXT.md`) vocabulary throughout the spec, and respect ADRs (`docs/adr/`) and `.claude/rules/` in the area you're touching.

2. Sketch out the seams at which you're going to test the feature. Existing seams should be preferred to new ones (in this repo the highest seams are usually: a pure module — reducer, query builder, formatter, zustand action — verified in-memory; a component verified through React Testing Library with the network stubbed at `api.ts`; a Playwright flow for an end-to-end path). Use the highest seam possible. If new seams are needed, propose them at the highest point you can. The fewer seams across the codebase, the better — the ideal number is one.

Check with the user that these seams match their expectations.

3. Write the spec using the template below, then publish it as `.issues/NNN-<slug>-spec.md` (next free NNN, frontmatter `type: spec`, `status: ready`) and add its INDEX.md line. No further triage needed — a published spec is ready for `/to-tickets`.

<spec-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format of:

1. As an <actor>, I want a <feature>, so that <benefit>

<user-story-example>
1. As a back-office user, I want an expired session to bounce me to login with a single toast, so that a background call failing never leaves me clicking a dead screen
</user-story-example>

This list of user stories should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified (`core/` vs a `features/<area>/`)
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- New API endpoints consumed and their envelope contract (which `success:false` codes the UI must handle)
- New i18n namespaces/keys, new zustand stores, new routes
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, model/type shape, filter-criteria object), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested, and at which seams
- Which tier each seam belongs to — pure in-memory vs component (RTL) vs flow (Playwright)
- Whether this feature is the one that finally bootstraps the vitest/RTL runner (it may be), or verifies via typecheck + driving the app until then
- Prior art for the tests (i.e. similar checks already in the codebase, e.g. `tools/screen1-smoke.mjs`)

## Out of Scope

A description of the things that are out of scope for this spec.

## Further Notes

Any further notes about the feature.

</spec-template>
