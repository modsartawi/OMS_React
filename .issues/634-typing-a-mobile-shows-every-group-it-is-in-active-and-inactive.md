---
status: done
spec: BackOffice 3173 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3173-oms-react-loyalty-groups-brief.md)
blocked-by: 629
---

# 634 — Typing a mobile shows every group it is in, active and inactive

## What to build

A **Find a mobile** search on the Loyalty groups list page ("why did this customer get that offer"). The
user types a mobile in any spelling; `GET LoyGroupWeb/Mobile/{mobile}/Groups` → `[{ groupId, code, nameEn,
nameAr, isActive }]` lists every group it is in, inactive ones marked, each opening its group page.
"In no group" is said plainly; a not-a-mobile refusal is shown with the server's message. The typed mobile
sits in the URL so a refresh repeats the search. View grant is enough.

## Spine reach

api (`Mobile/{mobile}/Groups`, path-encoded) · logic (URL query) · component (search + result list) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `mobile lookup path encodes the typed mobile` — `+9665…` encoded in the path segment · pure
- [x] `loy-groups lookup drive` — a mobile in an active and an inactive group lists both, marked; none → the empty sentence; refusal shown · flow (extend `tools/loy-groups-drive.mjs`)

## Boundaries

Door BackOffice 3176 (stubbed).

## Done when

On stubs, a mobile search lists its groups active and inactive, and the gates are green.

## Blocked by

[629](629-the-loyalty-groups-list-shows-each-groups-code-name-active-flag-mobile-count-and-live-bonus-buys.md)

## Comments

- 2026-10-28 — Done — built 2026-10-28 on spec/3173-loyalty-groups (worktree C:\Playground\oms-react-spec3173, unpushed), all envelopes stubbed; commit 33da9662.
- 2026-10-28 — ⚠ BackOffice 3176: a typed `+966…` goes in the PATH (`%2B`), which IIS may refuse (double escaping). Confirm on staging (638) or move the mobile to a query parameter.
- 2026-10-28 — Owner: the found / none sentences show the mobile as typed (the door returns no canonical mobile); no count in the sentence (avoids ar plurals).
