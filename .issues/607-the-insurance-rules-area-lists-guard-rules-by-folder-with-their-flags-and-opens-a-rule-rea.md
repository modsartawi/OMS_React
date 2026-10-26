---
status: done
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

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/5qwrpEcu9o6ThdwsQphb4y)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

model/api (`core/insurance-rules`) · logic (sentence rendering, state) · component/route · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `guardSentence_rendersEachBlockKind` — history / supply / volume / line / reference / group + NOT · pure
- [x] drive `tools/insurance-rules-drive.mjs` (stubbed) — folder tree filters the list, flags show, row → sentences

## Boundaries

New area + nav group + i18n namespaces; stubbed doors per the brief. Reuse `core/rules` pieces where they fit (sentence helpers) rather than importing from `features/campaigns`. Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Typecheck, lint and vitest green; the drive opens a stubbed rule from the list.

## Blocked by

None — can start immediately (stubbed)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/5qwrpEcu9o6ThdwsQphb4y, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.

## Comments

**2026-10-27 — built on `impl/3126-607`.** Proof: `src/core/insurance-rules/sentence.test.ts`
(guardSentence_rendersEachBlockKind — every block kind, group + NOT, read off the drive's own stubs), `folders.test.ts`,
`i18n-keys.test.ts` (en/ar mirror, six Arabic plural forms, every key the code builds),
`src/layout/menu-insurance-rules.test.ts`; drive `tools/insurance-rules-drive.mjs` 86/86 STUBBED (LTR + RTL).
Typecheck, lint and vitest green. The group-order tests of Deliverect and HungerStation moved one place (the new
group is last).

**For 608–617 — where to build:**
- Model: `src/core/insurance-rules/model.ts` (ruleset, rule, every block, lists by id, flags, states,
  REFUSE > OVERRIDE > WARN with `mostSevere` / `ruleSeverity`, paths). Sentences: `core/insurance-rules/sentence.ts` +
  `GuardSentenceView.tsx` (`ConditionTree`). Pills: `core/insurance-rules/badges.tsx` (OVERRIDE = violet `post` token).
  Folder tree: `core/insurance-rules/folders.ts`.
- Shared doors: `core/insurance-rules/api.ts` (`guardDraftQuery`; every key under `['insurance-rules']`). A feature's own
  doors go in its `api.ts`.
- Routes: `src/app/insurance-rules-routes.tsx` (pathless layout at `insurance-rules`, per-ticket slot comments). Menu:
  `src/layout/menu-insurance-rules.ts` (slots). Namespaces: `src/core/insurance-rules/locales.ts` (slots; `i18n.ts`
  spreads it). `router.tsx`, `menu-model.ts` and `i18n.ts` need no further edit.
- Stubs: `tools/insurance-rules-stubs.mjs` (+ `.d.mts`): `RULESET`, `RULES` (G-001..G-011; G-007 is the templates'
  nesting + NOT), `LISTS`, `GUARD_ROWS`, `envelope`, `insuranceRulesStub(method, path, body, { deny, reads })` — add
  your doors there.

**Guesses where the brief is silent (618 reconciles):**
- `GET InsuranceRules/Guards` row: `{ id, name: {en, ar}, folder, state, severity, lastFired: string | null,
  flags: [{ kind, since }] }`. `lastFired` is a guessed field name; `severity` is read as the rule's heaviest effect.
- The rule page reads the rule from the DRAFT document (`GET …/Guards/Draft`): the brief has no per-rule or
  live-document door. A live rule with draft edits would read as the draft.
- A folder is a `/`-separated path; a rule in no folder has `""`.
- Block spellings are the templates' sketch (3093 leaves them to the build ticket): `match: "list:<filter id>"`,
  `line.inList` = a rule filter id, `patient` / `policy.inList` = a patient / policy list id, shown as its id (the
  names live behind 3133's doors). `volume.window` assumed `day | week | month`; `sfda.priceAbove` read as SAR.
- No access probe: the group is ungated like campaigns, and a bare 403 on either read is "You do not have access".
- Arabic UI strings ship and are mirror-tested; `lng` stays `en`.
- The tree beside the grid replaces the prototype's folder chips (the ticket asks for a tree); the insurance team's
  walk (3096) is still open.
