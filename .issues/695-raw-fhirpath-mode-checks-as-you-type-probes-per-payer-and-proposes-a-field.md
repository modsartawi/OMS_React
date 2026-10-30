---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 692
---

# 695 — Raw FHIRPath mode checks as you type, probes per payer and proposes a field

## What to build

Stories 9–13; 3262 V4; doors 3282, 3296. A trained author enters a path with its message, line or message focus, type,
single or list, code system, key and EN and AR labels. While typing, the page asks **Compile** and shows:

- **refused:** does not compile; uses a clock, terminology, `conformsTo` or `trace()` function; the result misfits the
  declared type; names an extension URL the Nphies profiles do not list;
- **warned:** a literal code that exists only in a different case. It does not stop the proposal.

**Probe** runs the path over the kept bundles and samples and shows match / no match / unknown per payer. Zero matches
is a warning. **Propose** sends the row to the proposals inbox (696). A raw path is never written inline into a rule.

## Spine reach

model/api (Compile, Probe, propose) · store/logic (debounced compile, stale reply dropped, can-propose rule) ·
component (form, per-payer result) · i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] a stale Compile reply never overwrites a newer one (the playground's rule, 678) — pure
- [ ] can-propose: each refusal blocks, the case-only warning and zero matches do not — pure
- [ ] one path for each refusal, the case warning, a per-payer Probe result, and a proposal sent — flow

## Boundaries

The client never parses FHIRPath: every verdict is the door's, and no FHIRPath library ships to the browser. A path is
`Ltr`. Doors stubbed; 711 reconciles.

## Done when

A bad path cannot be proposed, and the author sees which payers answer a good one before relying on it.

## Blocked by

692.

## Comments
