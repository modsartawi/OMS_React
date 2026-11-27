---
status: open
spec: 983
blocked-by: —
---

# 993: The agent's default source applies when an order opens

Slice of [spec 983](983-the-console-is-built-around-the-caller-spec.md). Reference picture: the
*Call Center Console v3* artifact (v3).

## What to build

On open, if the order has no source and `myDocumentSources` holds an `isDefault` source, the
console calls `setDocumentSource` once (D14). On `SOURCE_REFERENCE_REQUIRED` it opens the Source
section with that source pre-filled and the reference focused. With no default, nothing happens. The
source shows as "CODE · description", as the walk already changed.

## Spine reach

pure (`default-source.ts`) · page wiring · test

## Proof (→ `tdd` red-green cycles)

- [ ] `appliesOnceOnlyWhenEmptyAndADefaultExists`: no default, an existing source, and a default each behave as stated · pure
- [ ] `aReferenceRequiredOpensTheSectionPrefilled` · pure/flow

## Boundaries

No wire change (`isDefault` is already on `AgentDocumentSource`).

## Done when

A pilot agent with a default source opens an order and the source is set; the owner's login (no default) is untouched.
