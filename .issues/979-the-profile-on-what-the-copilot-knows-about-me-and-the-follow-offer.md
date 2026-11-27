---
status: open
spec: BackOffice 4411
blocked-by: BO 4417
---

# 979 — The profile on "What the copilot knows about me", and the Follow offer

Spec: BackOffice `E:\Projects\BackOffice\.issues\4411-the-copilot-investigates-a-why-question-to-its-cause-spec.md`.

## What to build

The page "What the copilot knows about me" gains the profile: the kind of reader (executive or operations) and the
areas followed (cities, KSA regions, channels), each with delete, beside own readings and named sets; forget-everything
clears it too. In an answer, the server's "Follow Jeddah?" offer is a button; nothing is followed without the tap. The
assumption line that says "the areas you follow" shows as the server sends it.

## Spine reach

route → page

## Proof (→ `tdd` red-green cycles)

- [ ] the profile lists, adds and deletes followed areas, and forget-everything clears it · vitest
- [ ] the Follow offer is a button and stores only on tap · vitest
- [ ] the kind of reader can be changed · vitest

## Boundaries

Front end only. The page works whenever the server's profile store answers; the default scope needs `Copilot:Profile`. Help updated (or why not): the copilot article's "what the copilot knows" section.

## Done when

The tests are green, and on dev a reader follows Jeddah and the next vague question is scoped to it.

## Blocked by

BackOffice 4417 (`E:\Projects\BackOffice\.issues\4417-the-readers-profile-scopes-a-vague-question-to-the-areas-they-follow-and-the-copilot-offers-to-follow-never-adds.md`)
