---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3028-hungerstation-follow-up-on-oms-react-spec.md
blocked-by: 551 (live: BackOffice 3031)
---

# 552 — An HQ user removes a HungerStation store's onboarding, and revives it

## What to build

On the HungerStation Stores page (551):

- **Remove onboarding.** A row action with a mandatory reason and a confirmation that says, in words:
  - the store's stock sync stops and its orders are no longer fetched;
  - its vendor id becomes free for another store;
  - its logs, orders and history stay readable;
  - it is **not** taken off HungerStation: that is done in HungerStation's portal.
- The door answers `data: null`. The row leaves the list, because a removed store is never listed.
- DHS-00007 (already removed, or not onboarded) shows inline and refreshes the list.
- **Revive.** There is no separate action: onboarding the same store code again (551's dialog) revives it,
  with the vendor id and chain given in the dialog. The onboard dialog's help text says so.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3028-hungerstation-web-door-contract.md`, section
`DELETE HungerStationWeb/Stores/{storeCode}?reason=` (the reason goes in the **query string**), plus
onboard's revive note.

## Spine reach

UI → app (BackOffice doors, stubbed until 557)

## Proof (→ `tdd` red-green cycles)

- [x] helper: the remove confirmation text and the reason in the query string, URL-encoded with unicode kept (vitest)
- [x] `tools/hungerstation-stores-drive.mjs`: new sections, against stubs, LTR and RTL:
  - remove with a reason, and the row leaves the list;
  - DHS-00007 inline;
  - onboarding the removed code again brings it back.
- [x] typecheck, lint, test green

## Boundaries

oms-react only. Same gate as the Stores page (`canManageStores`).

## Done when

The helpers and the drive are green; the live check rides 557.

## Blocked by

- [551](551-an-hq-user-lists-onboards-and-edits-hungerstation-stores-with-a-reason.md)

(live: BackOffice 3031)

## Comments

**Done 2026-10-24** (branch `ticket/552`). Proof: vitest `features/hungerstation/stores/remove.test.ts`
(the path, the reason in the query string — Arabic, a line break, an emoji, `&`/`#`/`%` kept as ONE
reason, nothing raw on the wire — and the four consequence sentences in en + ar), typecheck + lint
(4 gates) + `npm test` (6107) green, and `tools/hungerstation-stores-drive.mjs` **124/124 against STUBS**
(551's 84 plus sections 9–11, LTR and RTL). 🚩 Not driven against a live SIS.Api — the live check is 557.

What landed:
- `stores/remove.ts` — `removePath(storeCode, reason)` (the door's path, the reason via
  `URLSearchParams`) and `REMOVE_CONSEQUENCES`; `storesApi.remove` calls `api.del` on it.
- `RemoveDialog` in `StoreDialogs.tsx` (danger confirm); the actions cell's `act` gains `onRemove`.
- The drive's stubs now keep a per-context copy of the stores: DELETE takes one off, POST of a removed
  code revives it on the body's chain and vendor id. 551's sections are unchanged and still pass.

Judgement calls (overrulable):
1. **The confirmation is a list, not one sentence.** The four consequences are separate bullets in the
  dialog body (the note is a `<p>`, so a list can't live there); the note names the store, isolated. A
  line under them says how to bring it back (onboard the same code) — the ticket asked only for the
  onboard dialog's help text, which 551 already wrote.
2. **The row leaves at once.** On success the row is filtered out of every cached Stores list, then the
  list is read again — so it is gone even before the refetch answers.
3. **DHS-00007** shows "no longer onboarded" with the server's sentence and code inside the dialog (not
  the generic banner), refreshes the list and turns Remove off; the dialog stays open until cancelled,
  as 551's edit does.
4. **`removePath` spells the path segment itself** rather than importing `storePath` from `./api`, so
  the pure module (and its test) never loads `@/core/api`. One line duplicated.
5. **No confirm-by-typing.** The mandatory reason is the friction; no second "type the store code" step.

Open for the owner: none blocking. The Arabic copy is unread by a native eye (the drive's RTL pass is
direction only).
