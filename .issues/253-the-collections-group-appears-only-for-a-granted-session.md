---
status: done
spec: 249
blocked-by: —
---

# 253 — The Collections group appears only for a granted session

## What to build

The new area exists and routes: a **Collections** menu group with four items, four Pages that render
(empty shells are fine — [254](254-cash-collections-opens-on-today.md) fills the first one), and the
access model that decides who sees what.

**A new top-level area, `src/features/collection/`**, at `/collection/*`. Not under `features/oms/` —
the rule ties folder = URL prefix = menu group, and this is a **finance** surface (collection
supervisor, accountant), not order management. Four items would have made the OMS group five items of
two unrelated kinds. Follows how `callcenter`, `loy` and `nphies` each minted a group.
(`tools/check-boundaries.mjs` covers new areas automatically — no edit needed there.)

**One feature, not four siblings** — the rule's "tight cluster of screens". Four Pages, one `api.ts`,
one `collection` i18n namespace, both document renderers, shared helpers as **relative** imports. Four
siblings would have forced every helper up into `core/` before a second screen existed to justify it.

| Menu item | Route |
|---|---|
| Cash Collections | `/collection/collections` |
| ACRs | `/collection/acrs` |
| Deposits | `/collection/deposits` |
| Collection Attempts | `/collection/attempts` |

**The access model** ([244 §10](244-four-inquiry-screens-in-our-clothes.md)):

- **One `Collection/Access` probe** returning all four booleans in a single call — the menu needs them
  at once, so four probes would be four round trips to draw one group.
- The **four existing WPF grants are reused unchanged** (`CollectionInquiry`, `AcrInquiry`,
  `DepositInquiry`, `CollectionAttempts`), so a WPF user's current rights carry to the web and no new
  permission is designed or seeded. Supervisor vs accountant is **grant assignment**, not screen
  design; neither is scoped to a subset of stores.
- Each item appears only if granted, and the **group is hidden entirely when none are**.
- **A ragged group is allowed and correct** — a user granted only Deposits sees one item, not three
  that would refuse them.
- ⚠ **The probe only hides the menu. The endpoint grant filter is the real boundary** — a hand-typed
  URL must be refused by the server, not merely unlinked by the client. Both exist for different
  reasons; neither substitutes for the other.

## Spine reach

api (probe, mocked) · logic (access) · route · menu · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `menu-collection.test.ts` — the menu model given each access shape: **all four granted** → four
      items under one Collections group; **one granted** → a ragged group with exactly that item;
      **none granted** → **no group at all**, not an empty one; the probe shape unknown/failed →
      hidden rather than crashing · pure (prior art: `src/layout/menu-loy.test.ts`)
      — 6 cases, reading the **real** `MENU`; plus
      `src/features/collection/inquiry/access.test.ts` (3 cases) pinning the four predicates
      themselves: `=== true` only, and each reads **only its own flag** so one grant never admits a
      neighbour.
- [x] `tools/collection-drive.mjs` — a new drive: with the probe mocked all-granted, all four routes
      load their Pages and the group renders; with it mocked none-granted, the group is absent and a
      hand-typed `/collection/collections` renders the denied backstop rather than a broken screen ·
      flow (Playwright) — **23/23 green**. Also pins that the four leaves plus the screen's own guard
      cost **one** `CollectionWeb/Access` call, the ragged Deposits-only group, and the two probe
      failures: a **403 reads as a refusal** (see an administrator — which is what the unbuilt door
      answers today) while a 500 reads as **unreachable** (try again). Both deny.

## Boundaries

- **New API dependency:** `CollectionWeb/Access` — **mocked in this ticket.** Backend
  [1090](file:///C:/Work/DMSCO/BackOffice/.issues/1090-a-browser-reaches-the-four-collection-inquiries.md)
  owns the real door; [259](259-the-screens-call-the-real-door.md) joins them.
- **New i18n namespace `collection`** — `src/locales/en/collection.json` plus registration in
  `src/core/i18n.ts` (import, `ns[]`, `resources`). ⚠ An unregistered namespace renders raw keys to
  users, so registration is part of this slice, not a follow-up.
- Four lazy route entries in `src/app/router.tsx` under the area prefix; four menu items with the
  shared `accessProbe` in `src/layout/menu-model.ts`.
- ⚠ Screen chrome obeys **every** rule — `i18n-zero-literal`, `logical-tailwind`, the palette gate.
  The documented exception belongs to the two facsimiles alone and does not extend here.

## Done when

A granted session sees a Collections group with the right items and can reach all four routes; an
ungranted session sees no group and is refused on a hand-typed URL; the menu test and the drive are
green; `typecheck` and `lint` are clean.

## Blocked by

None — can start immediately. Independent of the two document tickets.

## As built

`src/features/collection/inquiry/` — **area `collection`, feature `inquiry`**, not the flat
`features/collection/` this ticket wrote. `tools/check-boundaries.mjs` classifies
`features/<a>/<b>` as feature id `a/b`, so a flat layout makes every sibling file its own "feature"
and a `./api` import fails the lint gate — verified empirically before choosing. Every existing area
nests the same way (`loy/member`, `callcenter/console`, `nphies/eligibility`), and "one feature, not
four siblings" is preserved: four Pages, one `api.ts`, one namespace, relative imports.
⚠ **251 and 252 put the two document renderers in this same folder** — a
`features/collection/documents/` would be a *different* feature to the boundary gate and could not
import this `api.ts`. Where a print route sits in `router.tsx` (outside `ProtectedLayout`) is
independent of the folder.

The probe is `CollectionWeb/Access` — the name spec 249's backend contract table and BackOffice 1090
use; the spec's story-4 prose says `Collection/Access` and is the loose one. Its four booleans are
`{ canOpenCollections, canOpenAcrs, canOpenDeposits, canOpenAttempts }` (`src/core/models/collection.ts`) —
nobody had written the field names down; the repo's `canOpen*` house style and a 1:1 map onto the four
menu items decided it, and 259 is where a mismatch with the door would surface.

**Mocked at Playwright, not in `src/`** — `collectionApi.access()` calls the real door, and
`tools/collection-drive.mjs` stubs the envelope, exactly as the BBY and Loy drives do for their
unbuilt doors. So ticket 259 deletes nothing, and the fail-closed path stays testable. Against a live
SIS.Api today the door 403s and the group is simply absent, which is the correct posture for a door
that does not exist.

Each Page carries its own in-page backstop on the SAME probe key (`ScreenGate`), and it splits two
sentences the way `MemberLookupPage` does: a **403 is a refusal** (see an administrator — a retry
against a permanently shut door invites a loop), anything else is **unreachable** (try again). Both
deny; only the sentence differs. Four extra keys, beyond the ticket's bare "denied backstop", earned
by the built-in `/code-review`.

## Outstanding

- ⚠ Nothing here has been driven against a **live SIS.Api** — `CollectionWeb/Access` does not exist
  yet (BackOffice [1090](file:///C:/Work/DMSCO/BackOffice/.issues/1090-a-browser-reaches-the-four-collection-inquiries.md)).
  [259](259-the-screens-call-the-real-door.md) is that verification event.
- The four Pages are **shells**: the header and the access model, not the screens. 254–257 fill them.
