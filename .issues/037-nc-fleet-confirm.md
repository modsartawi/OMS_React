---
status: code-complete
spec: 031
blocked-by: 036
---

# 037 — sendingToTheWholeFleetAsksForConfirmation

> **Build note (runtime-blocked):** code-complete, `npm run typecheck` green. Runtime app-drive
> deferred (SIS.Api :5111 down). Reuses the app-wide `confirmAction` service for the fleet dialog;
> inline amber warning shows while composing an All send; a Store send still posts straight through.

## What to build

Choosing **Whole fleet** raises the blast radius, so it earns a guardrail. While composing a
whole-fleet message an inline amber warning shows ("this reaches every open store and back-office
user"). Pressing Send on an `AudienceKind='All'` broadcast opens a **confirmation dialog** ("reach
every open store and back-office user… can't be recalled") — confirming posts `POST Notifications`
with `AudienceKind='All'` (empty `AudienceKey`); cancelling returns to the form unchanged. A **One
store** send still goes straight through (no dialog).

## Spine reach

logic (branch send on channel) · component (inline warning + confirm modal) · i18n (warning +
dialog copy) · test/drive.

## Proof (→ `tdd` red-green cycles)

- [ ] `allFleetSendOpensConfirmStoreSendDoesNot` — component: All ⇒ modal; Store ⇒ direct POST · component
- [ ] `confirmingTheFleetDialogPostsAllAudience` — component: confirm ⇒ one POST with `AudienceKind=All` · component
- App-drive fallback: pick Whole fleet → warning shows → Send → confirm dialog → confirm ⇒ success; Cancel ⇒ no send.

## Boundaries

Reuses 036's `POST Notifications`. New i18n keys. `—` runner.

## Done when

A whole-fleet send is gated by a confirmation dialog (and a single-store send is not) — proven by
the component tests green (or the app-drive action) with typecheck clean.

## Blocked by

[036](036-nc-compose-send-store.md)
