---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 692
---

# 698 — Publish shows its warnings: a channel that never answers, a flagged field and missing Arabic

## What to build

Stories 19, 67; J14, D5, L14; doors 3284, 3293, 3297. Before asking for approval or publishing, the author sees each
warning the door returns: "on bupa this condition is always unknown", a field flagged by drift, and Arabic text that
would show an English label or a bare code. Each warning names the rule and the fact. None of them stops the publish. A
refusal such as `overridesPayer` on a payer key (story 47) stays a refusal and reads differently from a warning.

## Spine reach

model/api (warning shapes on Validate / publish) · store/logic (warning against refusal) · component (checks pill,
publish step) · i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] warnings never disable publish; a refusal does — pure
- [x] one rule with all three warnings publishes after they are shown; a payer-key override is refused — flow

## Boundaries

The warnings are the door's, computed by no client rule. An unrecognised warning kind still shows its server text. Doors
stubbed; 711 reconciles.

## Done when

An author cannot publish without having been shown what the rule cannot do, and nothing a warning says blocks them.

## Blocked by

692.

## Comments

**2026-10-30, built, all stubbed (no live SIS.Api).** Drive 55/55, LTR and RTL.

Shape guesses for 711:
- The warnings arrive on the existing `POST …/Guards/Validate` and `…/Coverage/Validate` answer, as issues with
  `severity: warning`. Added fields: `kind` (`channelNever` | `fieldFlagged` | `arabicMissing`), `fact` (the rule key),
  `channel`. A refusal is `severity: error`, with `kind: overridesPayer`. Warning against refusal is read from severity only.
- `RULES_OVERRIDES_PAYER`, a 409 on Approve for a refusal Validate did not report. The stub reads coverage's `deductible` as
  the payer's patient share, and its fact as `$request.deductible`.
- The doors name no way to tell the three apart. Nothing branches on `kind` beyond its label, so a different spelling costs
  a label and a plain "Warning" until reconciled.

Overrulable decisions:
- **Behaviour change: Approve now holds** while HQ's checks are loading or have failed (`checking`), and on an error
  (`checks`). Before this it followed only who the user was. This is how "cannot publish without having been shown" is met.
  Send back never waits. Risk for 711: if Validate refuses an approver's grant, Approve stays held for them.
- The list sits on the publish step (Approvals panel for guards, `RulesetApproval` for categories and coverage), in both the
  author's and the approver's view, and needs no acknowledgement. Showing it is enough; there is no tick box.
- The publish step lists every issue of the draft, including older warnings with no `kind`, as a plain "Warning".
- The guard editor's checks pill already counted warnings and pinned HQ's text on the rule, so it is unchanged. Coverage's
  pill read green on warnings-only; it is now the attention tone.
- `RulesetApproval` now says when Validate failed; before this the ask just sat at "checking".

Not proved on screen: the `ar` chrome keys, for 692's reason (`lng` stays `en`). They are held by the mirror test.
