---
status: open
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: —
---

# 607 — The Insurance rules area lists guard rules by folder with their flags and opens a rule read as sentences

## What to build

**Slice 0 of the insurance-rules screens.** A nav group **Insurance rules** at `/insurance-rules/*` (new area
`features/insurance-rules/`). The **Guards** leaf lists guard rules by **folder** (a tree beside the grid), with
state (draft / waiting for approval / shadow / live / disabled), severity, folder, last fired, and **flags**
(noisy / silent / jump). A row opens the rule read-only, written as sentences (WHEN / IF / THEN), EN + AR message.

`core/insurance-rules/` holds the model **taken from the brief's contract** (not a guess): guard ruleset, rule,
blocks, list refs by id, flags. Doors are stubbed in the drive until 618.

**HQ contract:** the brief's sections for BackOffice 3139, BackOffice 3141. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

model/api (`core/insurance-rules`) · logic (sentence rendering, state) · component/route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `guardSentence_rendersEachBlockKind` — history / supply / volume / line / reference / group + NOT · pure
- [ ] drive `tools/insurance-rules-drive.mjs` (stubbed) — folder tree filters the list, flags show, row → sentences

## Boundaries

New area + nav group + i18n namespaces; stubbed doors per the brief. Reuse `core/rules` pieces where they fit (sentence helpers) rather than importing from `features/campaigns`. Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Typecheck, lint and vitest green; the drive opens a stubbed rule from the list.

## Blocked by

None — can start immediately (stubbed)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.
