---
name: to-tickets
description: Break a plan, spec, or the current conversation into a set of tracer-bullet tickets, each declaring its blocking edges, published to .issues/.
disable-model-invocation: true
---

# To Tickets

Break a plan, spec, or conversation into a set of **tickets** — tracer-bullet vertical slices, each declaring the tickets that **block** it.

Tickets are published to the repo's `.issues/` tracker — conventions in `docs/agents/issue-tracker.md`. Slicing heuristics, with worked examples from this repo, are in [slicing.md](slicing.md) — consult it while drafting, not after.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a reference (a spec path or issue number) as an argument, read its full body — and if the spec came out of a wayfinder map, the map's Decisions-so-far too.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Ticket titles and descriptions should use the project's domain glossary (`CONTEXT.md`) vocabulary, and respect ADRs and `.claude/rules/` in the area you're touching.

Re-verify any load-bearing claim the spec makes about existing code before slicing on top of it — a "reuse this" that has drifted poisons every slice built on it.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets. First name the **spine** and pick Slice 0 by risk × spine-coverage — [slicing.md](slicing.md) is the how.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer of the spine (model/api → store/logic → component/route → i18n keys → test) — vertical, NOT a horizontal slice of one layer
- A completed slice is demoable in the running app or verifiable on its own — if you can't name its test (or, until the runner lands, the app action that proves it), it's an implementation step, not a slice
- Each slice is sized to fit in a single fresh context window
- Any prefactoring should be done first

</vertical-slice-rules>

Give each ticket its **blocking edges** — the other tickets that must complete before it can start. A ticket with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change — rename a model field, retype a shared prop, swap a utility's signature — whose **blast radius** fans across the whole app, so a single edit breaks many call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**. First expand: add the new form beside the old so nothing breaks. Then migrate the call sites over in batches sized by blast radius (per feature folder, per module), each batch its own ticket blocked by the expand, keeping `typecheck` green batch to batch because the old form still exists. Finally contract: delete the old form once no caller remains, in a ticket blocked by every migrate batch.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each ticket, show:

- **Title**: the capability, phrased as a test name
- **Blocked by**: which other tickets (if any) must complete first
- **What it delivers**: the end-to-end behaviour this ticket makes work
- **Boundaries**: new API endpoint dependency? new i18n namespace? feature-flagged/hidden nav? deferred behind the vitest bootstrap?

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct — does each ticket only depend on tickets that genuinely gate it?
- Should any tickets be merged or split further?
- Is Slice 0 the right tracer bullet — does it retire the biggest unknown?

Iterate until the user approves the breakdown.

### 5. Publish the tickets to .issues/

For each approved ticket, write one file using the template below.

- Number from the next free NNN; publish in dependency order (blockers first) so **blocked-by** references real issue numbers.
- Add each ticket to `.issues/INDEX.md` as you go (see the tracker doc for the line format).
- A ticket that needs a human decision before work can start gets that decision spelled out under **Open questions** — it stays `open` like any other ticket; the question is the first task.

Do NOT close or modify the source spec — tickets derive from the spec, they don't replace it.

<ticket-template>
---
status: open
spec: <NNN of the spec issue, or path to the source doc — or "—">
blocked-by: <issue numbers, e.g. 003, 004 — or "—">
---

# <NNN> — <Behavior, phrased as a capability / test name>

## What to build

The end-to-end behavior of this slice, in the project's vocabulary. A capability, not an
implementation step ("an expired session bounces to login with one toast", not "add a 401 check").
Prefer behavior over file paths — paths go stale. Exception: a snippet that encodes a locked
decision (model/type shape, filter-criteria object, reducer — often from a prototype) may be
inlined, trimmed to the decision-rich parts.

## Spine reach

<layers this slice touches: model/api · store/logic · component/route · i18n · test>

## Proof (→ `tdd` red-green cycles)

- [ ] `<testName1>` — what it asserts, through the public interface · <pure | component (RTL) | flow (Playwright)>
- [ ] `<testName2>` — ...

Point pure logic at an in-memory test, screen behavior at a component (RTL) test, an end-to-end
path at a Playwright flow. If the runner isn't installed yet, name the **app action** that proves
this slice instead (drive `npm run dev` / extend `tools/screen1-smoke.mjs`) and note "verify via
typecheck + drive" — the `tdd` skill's Project stack governs the fallback.

## Boundaries

<new API endpoint + which envelope `success:false` codes to handle? new i18n namespace/keys?
nav visibility / feature gate? does this slice bootstrap the vitest runner? Or "—">

## Done when

<observable condition that closes the issue — a named test green, or a specific action working in
the running app>

## Blocked by

<links to blocking issues, e.g. [003](003-slug.md) — or "None — can start immediately">

## Open questions

<decisions a human must make before/while building, or omit this section>
</ticket-template>

### 6. Hand off

Work the **frontier**: any ticket whose blockers are all done. For a purely linear chain that means top to bottom. Build one ticket at a time with `/implement`, clearing context between tickets — `/implement` owns closing the ticket (status, Proof checkboxes, INDEX line) when its Done-when holds.
