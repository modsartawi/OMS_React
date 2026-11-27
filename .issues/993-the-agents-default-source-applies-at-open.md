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

- [x] `appliesOnceOnlyWhenEmptyAndADefaultExists`: no default, an existing source, and a default each behave as stated · pure
- [x] `aReferenceRequiredOpensTheSectionPrefilled` · pure/flow

## Boundaries

No wire change (`isDefault` is already on `AgentDocumentSource`).

## Done when

A pilot agent with a default source opens an order and the source is set; the owner's login (no default) is untouched.

## Comments

**2026-11-27 — built (branch `t/993`), stubbed.**

- Pure: `src/features/callcenter/console/default-source.ts` — `defaultSourceToApply` (open order,
  no source, a default, not already tried → the code; else `null`) and `afterDefaultRefused`
  (`SOURCE_REFERENCE_REQUIRED` → ask for the reference; anything else → quiet). 8 vitest cases in
  `default-source.test.ts`, red first.
- Page: `CallCenterConsolePage.tsx` reads `MY_SOURCES_KEY` while the open order has no source
  (same key as `SourceForm`, read once a shift) and sends the default through the existing
  `documentSource` mutation with an empty reference. **Once per transaction:** the transaction id is
  added to a ref-held set *before* the send, so StrictMode's double effect, re-renders while it is in
  flight and the same order re-opened in this tab never send it twice — and an agent who later changes
  the source is not overruled.
- Refused `SOURCE_REFERENCE_REQUIRED`: the Source section opens (`openSection('source')`), the
  select pre-filled with the default (the form's existing `isDefault` pre-selection), the caret in
  the reference box (new `askReference` prop on `SourceForm`), worded by the new key
  `source.defaultNeedsReference`. Any other refusal is quiet: the chip reads unset as before and
  `submitBlockers` still names it.
- Flow: `tools/callcenter-default-source-drive.mjs` (dev build, StrictMode on) — 15/15: one send with
  a default; one send + section open, pre-filled, reference focused on the refusal; no send without a
  default; no send over a held source.
- The source reads "CODE · description" — already done in 5e778beb, not redone.

**Owed:** the live walk — a pilot agent with an `SdDocumentSourceUser` default opens an order and the
source is set; the owner's login (no default) sends no `SetDocumentSource`. No Arabic string added
for `source.defaultNeedsReference` (the ar `callcenter.json` has no `source.*` keys yet).
