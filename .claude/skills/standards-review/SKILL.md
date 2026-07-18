---
name: standards-review
description: Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes — Standards (does the code follow this repo's rules?) and Spec (does the code match what the originating issue/spec asked for?). Runs both reviews in parallel sub-agents and reports them side by side. Use when the user wants to review a branch against its spec or the repo standards, or asks to "review since X". (For correctness-bug hunting, use the built-in /code-review instead.)
---

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards** — does the code conform to this repo's documented coding standards?
- **Spec** — does the code faithfully implement the originating issue / spec?

Both axes run as **parallel sub-agents** so they don't pollute each other's context, then this skill aggregates their findings.

This skill complements the built-in `/code-review` (correctness bugs); it does not replace it. Issues and specs live in `.issues/` — conventions in `docs/agents/issue-tracker.md`.

## Process

### 1. Pin the fixed point

Whatever the user said is the fixed point — a commit SHA, branch name, tag, `main`, `HEAD~5`, etc. If they didn't specify one, ask for it.

Capture the diff command once: `git diff <fixed-point>...HEAD` (three-dot, so the comparison is against the merge-base). Also note the list of commits via `git log <fixed-point>..HEAD --oneline`.

Before going further, confirm the fixed point resolves (`git rev-parse <fixed-point>`) and the diff is non-empty. A bad ref or empty diff should fail here — not inside two parallel sub-agents.

### 2. Identify the spec source

Look for the originating spec, in this order:

1. `.issues/` references in the commit messages or branch name — the ticket's `spec:` frontmatter points at the spec issue; read both the ticket (What to build / Proof / Done when) and the spec.
2. A path the user passed as an argument.
3. A spec/PRD/design doc under `.issues/`, `docs/`, or next to the touched feature, matching the branch.
4. If nothing is found, ask the user where the spec is. If they say there isn't one, the **Spec** sub-agent will skip and report "no spec available".

### 3. Identify the standards sources

This repo documents its standards in **`.claude/rules/*.md`** and `CLAUDE.md`:

- [`feature-structure`](../../rules/feature-structure.md) — `features/<area>/` layout and import boundaries.
- [`i18n-zero-literal`](../../rules/i18n-zero-literal.md) — no user-visible string literals; always `t()`.
- [`logical-tailwind`](../../rules/logical-tailwind.md) — logical Tailwind utilities, never physical `ml/pr/left`.
- [`api-envelope`](../../rules/api-envelope.md) — all server calls through `src/core/api.ts`.

Include `CONTEXT.md` for vocabulary drift — code that names a domain concept against the glossary (delivery document, store, session, envelope, guardrail refusal) is a standards finding. TypeScript/tooling already enforces types and (once configured) lint/format — **skip anything tooling enforces**; the sub-agent reviews only what a compiler can't.

On top of whatever the repo documents, the Standards axis always carries the **smell baseline** below — a fixed set of Fowler code smells (_Refactoring_, ch.3) that applies even when a repo documents nothing. Two rules bind it:

- **The repo overrides.** A documented repo standard always wins; where it endorses something the baseline would flag, suppress the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible Feature Envy"), never a hard violation — and, like any standard here, skip anything tooling already enforces.

Each smell reads *what it is* → *how to fix*; match it against the diff:

- **Mysterious Name** — a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code** — the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy** — a function/component that reaches into another module's data more than its own. → move it onto the data it envies (e.g. logic that lives in a component but only touches store state belongs in the store).
- **Data Clumps** — the same few fields or props keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession** — a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type (a model in `core/models/`).
- **Repeated Switches** — the same `switch`/`if`-cascade on the same type recurs across the change. → replace with a lookup map both sites share.
- **Shotgun Surgery** — one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change** — one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality** — abstraction, props, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one function on the first object.
- **Middle Man** — a component or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest** — a component that takes a prop/context it ignores, or a shared abstraction most callers override. → drop it, use composition.

Accepted Standards findings are applied at review time (not mid-tdd-loop) — see [refactoring.md](refactoring.md).

### 4. Spawn both sub-agents in parallel

Send a single message with two `Agent` tool calls. Use the `general-purpose` subagent for both.

**Standards sub-agent prompt** — include:

- The full diff command and commit list.
- The list of standards-source files you found in step 3, **plus the smell baseline from step 3** pasted in full — the sub-agent has no other access to it.
- The brief: "Report — per file/hunk where relevant — (a) every place the diff violates a documented standard: cite the standard (file + the rule); and (b) any baseline smell you spot: name it and quote the hunk. Distinguish hard violations from judgement calls — documented-standard breaches can be hard, but baseline smells are always judgement calls, and a documented repo standard overrides the baseline. Skip anything tooling enforces (types, lint, format). Under 400 words."

**Spec sub-agent prompt** — include:

- The diff command and commit list.
- The path or fetched contents of the spec (and the ticket's Proof / Done-when if present).
- The brief: "Report: (a) requirements the spec asked for that are missing or partial; (b) behaviour in the diff that wasn't asked for (scope creep); (c) requirements that look implemented but where the implementation looks wrong. Quote the spec line for each finding. Under 400 words."

If the spec is missing, skip the Spec sub-agent and note this in the final report.

### 5. Aggregate

Present the two reports under `## Standards` and `## Spec` headings, verbatim or lightly cleaned. Do **not** merge or rerank findings — the two axes are deliberately separate (see _Why two axes_).

End with a one-line summary: total findings per axis, and the worst issue _within each axis_ (if any). Don't pick a single winner across axes — that's the reranking the separation exists to prevent.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Reporting them separately stops one axis from masking the other.
