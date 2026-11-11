---
status: done
spec: BackOffice .issues\3633-the-copilot-keeps-a-readers-own-readings-on-a-tap-spec.md
blocked-by: BackOffice 3689
---

# 894 — The page "What the copilot knows about me" lists, changes and deletes every kept reading and named set

## What to build

BackOffice spec 3633 R25, R28, R29: the page, reachable from the panel: each kept reading with its value (change, delete),
each named set with its members (edit through the name lookup, delete), unused readings and vanished members marked,
and "Forget everything" with a confirm. Built so the investigations spec's profile can join it.

## Proof (→ `tdd` red-green cycles)

- [x] The page lists readings and sets, marking unused ones · oms-react tests
- [x] Change, edit, delete and forget everything call their doors and redraw · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3689.

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3689

## Build notes

Built 2026-11-12 on `t894` (from `spec/3633`), against BackOffice 3689's wire.

- **Contract** in `src/core/models/copilot.ts`: `CopilotKnowsMe` (`readings` / `sets` / `limits`; the investigations
  spec's profile joins beside them), `CopilotKeptReading`, `CopilotNamedSet`, `CopilotSetMember`, the request and answer
  shapes of the seven doors.
- **Pure seam** `src/features/copilot/me.ts` (`me.test.ts`): `fromMeWire` reads the page defensively (readings in kind
  order, `unused` and `gone` kept, a missing gone count taken from the members); `addMember` / `removeMember` build the
  `POST Copilot/Me/Sets` body - the live keys in order, a gone member always left out (3689 refuses it), one kind, at
  most `maxMembers`, never an empty set (delete instead); `lookupFits` (blank / over 100 is not sent).
- **Doors** `src/features/copilot/me-api.ts` (`me-api.test.ts`, `@/core/api` mocked, a real `QueryClient`): each change
  calls its door with its body, redraws the cached page from the door's own answer, then asks for it afresh (R29). A
  refusal redraws nothing. `meFeatureOff` = `COPILOT-430`; `meEntryVisible` = the page read.
- **Screen** `CopilotMePage` at `/copilot/me`, behind `canAskCopilot`: readings (struck through + "No longer used" when
  unused; Change through the reading's `choices`; Delete), sets (members, gone ones marked and counted; add through the
  name lookup; remove; delete the set), "Forget everything" with a confirm. `COPILOT-430` / `COPILOT-401` from any door
  draw their own closed state. **Entry**: a link at the top of the copilot panel, shown only when `GET Copilot/Me`
  reads, so a 430 hides it (the page shares the query).
- **Words**: `me.*` in `copilot.json`, English and Arabic (the Arabic file gained the section).
- Not driven against a live SIS.Api in this slice (no drive tool added); typecheck, tests and lint (bar the base
  boundaries failure in `insurance-rules/aliases/door-shapes.test.ts`) green.

## Comments

- The panel's entry costs one `GET Copilot/Me` per panel mount. 3689's suggested `canKeepReadings` flag on
  `GET Copilot/Access` would let the entry ride the access probe instead - a small follow-up if wanted.
