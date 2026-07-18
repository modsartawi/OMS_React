---
name: domain-modeling
description: Build and sharpen a project's domain model. Use when the user wants to pin down domain terminology or a ubiquitous language, record an architectural decision, or when another skill needs to maintain the domain model.
---

# Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the *active* discipline — challenging terms, inventing edge-case scenarios, and writing the glossary and decisions down the moment they crystallise. (Merely *reading* `CONTEXT.md` for vocabulary is not this skill — that's a one-line habit any skill can do. This skill is for when you're changing the model, not just consuming it.)

## File structure

This repo is a single context:

```
/
├── CONTEXT.md                        ← glossary (seeded; extend it)
├── docs/
│   └── adr/                          ← decision records (create lazily)
│       └── 0001-<slug>.md
├── .claude/rules/                    ← coding conventions (NOT this skill's output)
└── ...
```

The three doc kinds divide cleanly: `.claude/rules/` says **how code is written** (owned by its own amendment flow, not this skill), `CONTEXT.md` says **what words mean**, `docs/adr/` says **why a decision was made**. Don't blur them — "always use `t()`" is a rule, not a glossary entry; "delivery document" is a glossary entry; "we rebuilt the portal in React rather than extending the Angular prototype" is an ADR.

`CONTEXT.md` already holds the core OMS terms (delivery document, store, session, envelope, guardrail refusal). Extend it as new concepts firm up. If no `docs/adr/` exists, create it when the first ADR is needed.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'store' as the acting branch, but you seem to mean the zustand store — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'order' — do you mean the customer's order or one of its delivery documents? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "You said the client session is the source of truth, but `core/api.ts` treats a 401 from the server as authoritative and clears it — which is right?"

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up — capture them as they happen. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

`CONTEXT.md` should be totally devoid of implementation details. Do not treat `CONTEXT.md` as a spec, a scratch pad, or a repository for implementation decisions. It is a glossary and nothing else.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).
