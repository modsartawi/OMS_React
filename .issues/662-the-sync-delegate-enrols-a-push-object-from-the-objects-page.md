---
status: done
spec: BackOffice 2557 (D10: the control lives in this console); doors BackOffice 2558-2560
blocked-by: —
---

# 662 — The sync delegate enrols a push object from the Objects page

The enrol doors shipped in BackOffice (2558-2560, contract
`C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md` "Object enrolment doors"), but spec 2557
D10 left the screen to this console and nobody minted it (460's "Drift" note). The IDF go-live (BackOffice specs
3157/3185) is the first wave that needs it: seven objects, lines 7900-7960, and the only other route is a DevTools
`fetch`.

## What to build

- **Objects page** at `/admin/sync/objects`, a console page in `ConsoleNav` (a read: `ActionSync.Health.View`, the
  same gate as the rest of the console).
  - Reads `GET ActionSync/Objects`. One row per pushed object: object id, HQ table, line number, HQ rows, and its
    state — **Enrolled** (with the store count), **Not enrolled**, or **No line number** (cannot be enrolled from the
    console).
  - Opens on the objects not yet enrolled; a toggle shows the enrolled ones too. The door's order is kept.
- **Enrol**, on a row that is not enrolled and has a line number, only with `canEnrol` (`ActionSync.EnrollObject`).
  - The shared reason dialog with a **Preview** first (`preview: true`, writes nothing): line number, rows to send,
    stores, the action block.
  - Confirm stays disabled until a preview answers. Confirm posts the same object with `preview: false`.
  - The dialog says what it does: every current HQ row of the table goes to every store on the rail at once, and it
    cannot be undone from the console.
  - A refusal shows with its code (`ALREADY_ENROLLED`, `UNKNOWN_OBJECT`, `NO_STORES`, `TOO_MANY_ROWS`, `BAD_KEY`,
    `ENROL_BUSY`), and the dialog stays open.
  - Success: a toast with the stores and actions, the list and the audit feed re-read.
- The audit feeds label `EnrolObject` ("Enrolled a push object").

## Spine reach

ui · api client · test · drive (stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `objects-helpers.test.ts`: a row's state (enrolled / ready / no line number); the default view hides enrolled
      rows and keeps the door's order; the preview sentence's counts.
- [x] `control-helpers.test.ts`: `EnrolObject` is labelled.
- [x] `tools/sync-console-objects-drive.mjs` (stubbed): the list, the toggle, Enrol absent without `canEnrol`, Confirm
      waits for the preview, the confirm posts `preview: false` with the reason, a refusal keeps the dialog open.
- [x] `npm run typecheck`, `npm test`, `npm run lint`.

## Boundaries

- No new door and no BackOffice change: the doors are built.
- No bulk enrol: one object per dialog, as the door takes one.

## Done when

The proofs above hold. The live walk (enrolling the IDF objects on production) is the owner's.

## Blocked by

—

## Open questions

—

## Comments

- 2026-10-29 done. `features/admin/sync-console`: `ObjectsPage`, `EnrolDialog`, `objects-columns`, `objects-helpers`
  (+ test), `api.ts` (`canEnrolObjects`, `pushObjects`, `enrolObject`, `OBJECTS_KEY`), models `PushObject(s)` /
  `EnrolObject*`, `canEnrol?` on the access (optional: a door older than 2558 leaves it out = no). Nav link
  **Objects** for every console holder; route `/admin/sync/objects`. `EnrolObject` labelled in the audit feeds.
- Proof: vitest 7,661 green; mutations caught (default view showing enrolled rows; `noLine` checked before
  `enrolled`); lint 5/5; drive 25/25 **stubbed**. The refusal list is a typed list in the helpers
  (`ENROL_REFUSALS`), not a locale import in the component.
- The enrolment of the IDF wave (7900-7960) on production is the owner's walk, against a SIS.Api carrying 2558.
