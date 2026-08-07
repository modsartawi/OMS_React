---
status: open
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

- [ ] `menu-collection.test.ts` — the menu model given each access shape: **all four granted** → four
      items under one Collections group; **one granted** → a ragged group with exactly that item;
      **none granted** → **no group at all**, not an empty one; the probe shape unknown/failed →
      hidden rather than crashing · pure (prior art: `src/layout/menu-loy.test.ts`)
- [ ] `tools/collection-drive.mjs` — a new drive: with the probe mocked all-granted, all four routes
      load their Pages and the group renders; with it mocked none-granted, the group is absent and a
      hand-typed `/collection/collections` renders the denied backstop rather than a broken screen ·
      flow (Playwright)

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
