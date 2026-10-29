---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md); owner walk 2026-10-29
blocked-by: 608
---

# 661 — An empty code box keeps the first condition's code

## What to build

Found on the owner's walk: `G-001` (same item within 14 days) was saved with the Conflict box cleared, and the live
check answered `"conflict": null` instead of the default 83. The editor wrote a cleared box as `null`, and SIS.Rules
reads a PRESENT key as the author's override (`GuardCodeOverride`), so null meant "no code" and dropped the default.

- Typing in a code box sets the code; **clearing it leaves the key out** (`setCode`), so the first condition's code
  applies. The empty box shows that default as its placeholder.
- `effectiveCodes` reads codes as the engine does (left-out key = default, present null = none); `codesAreDefault` uses it.
- A code already saved as none over a default (`G-001` in version 3) is said under the codes — "No conflict code: this
  rule overrides the first condition's 83" — with **Use 83**, which leaves the key out.
- The wire is unchanged: a rule nobody edits goes back exactly as it was read (the editor drive's step 7 holds).

## Spine reach

ui · test

## Proof (→ `tdd` red-green cycles)

- [x] `guard-edit.test.ts`: clearing leaves the key out, never null; the engine's reading of left-out vs null; G-001's
      null named as overriding 83, a null equal to the default not
- [x] mutation: `setCode` writing null again fails the test
- [x] drives: guard editor 158/158, templates 92/92; tsc, lint, insurance-rules vitest 616/616
- [x] walked on the owner's local SIS.Api: `G-001`'s editor shows Conflict empty with placeholder 83 and the "overrides 83 — Use 83" note

## Boundaries

A code cannot be set to none by clearing a box any more (only a code saved as none before stays none, said on screen).
Rules: `i18n-zero-literal` (EN + AR), `bidi`.

## Done when

Clearing a code box saves no key and the engine answers the default.
