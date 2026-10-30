---
status: done
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

- [x] a stale Compile reply never overwrites a newer one (the playground's rule, 678) — pure
- [x] can-propose: each refusal blocks, the case-only warning and zero matches do not — pure
- [x] one path for each refusal, the case warning, a per-payer Probe result, and a proposal sent — flow

## Boundaries

The client never parses FHIRPath: every verdict is the door's, and no FHIRPath library ships to the browser. A path is
`Ltr`. Doors stubbed; 711 reconciles.

## Done when

A bad path cannot be proposed, and the author sees which payers answer a good one before relying on it.

## Blocked by

692.

## Comments

**2026-10-30, built, all stubbed (no live SIS.Api).** The verdict in each flow is the stub's; the client never reads a path.

Shape guesses for 711:
- `POST InsuranceRules/Fields/Compile` and `.../Probe`, body `{ path, moment, level, type, cardinality, system }`. Compile
  takes the declared type because the ticket has it answer type fit as you type; 3282's Probe also refuses a misfit, so a
  Probe reply carries refusals too.
- Compile reply `{ refusals: [{ code, message, detail }], warnings: [{ code, message, literal, known }] }`. Refusal codes:
  `syntax`, `clockFunction`, `terminologyFunction`, `conformsTo`, `trace`, `typeMisfit`, `unlistedExtension`. Warning code
  `caseOnlyCode`. A refusal code the client does not know still blocks and shows the door's message; an unknown warning
  shows its message and does not block.
- Probe reply `{ payers: [{ payer, match, noMatch, unknown }], refusals }`, counts per payer. 3282 says per payer and per
  source; source is not drawn.
- `POST InsuranceRules/Fields/Proposals`, body `{ key, label, moment, level, type, cardinality, system, fhirPath }`. The
  reply is not read. The row has no `unit`, because the ticket's list names none; the catalog row has one.

Overrulable decisions:
- Propose needs a Probe of this very question (path, message, focus, type, cardinality, system), not only a clean Compile,
  so the author has seen who answers. Changing any of those drops the Probe. Zero matches still pass.
- A code field must name its code system.
- A key already in the catalog at the same message and focus is refused in the client, in any case. The door still decides.
- Closing a changed form asks first, because a backdrop click would otherwise lose it.
- The form is a dialog opened from the Fields page. `RawPathDialog` takes `initial` (any part of the form) for 697; 696
  reads `FIELD_PROPOSALS_KEY`, which a proposal invalidates.

`latestWins` graduated to `core/insurance-rules/latest-wins` (second user); `playground/run.ts` re-exports it. It only drops
a reply older than the newest request SENT, so a reply landing while the next edit waits in its window still gets through.
Each answer therefore carries its question and counts only while the form still asks it (`currentAnswer`).

Same finding as 692: `lng: 'en'` is held, so the drive's `ar` run proves the RTL layout; the `ar` keys are proved by the
mirror test only.
