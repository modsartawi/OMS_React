---
status: done
spec: 819
blocked-by: 822
---

# 826 — An author shares with roles and users; an outsider gets "not shared with you"; a curator narrows or reassigns

## What to build

**The share dialog:**
- "Everyone", or a mix of authz roles and named users, picked through `GET Analytics/AudienceCandidates` (search by name or employee id);
- a deleted role is marked "removed";
- it saves with `PUT Analytics/Item/{id}/Audience`, and Share takes an audience.

**An audience chip** shows on Shared items: on the home, the board and the report.

**A user outside the audience** opening a link gets the `ANALYTICS-413` page: "not shared with you", naming the owner, with no title or data.

**A curator** may narrow the audience or unshare in the same dialog. `POST …/Reassign` hands an item to another author (spec 819 §C). Audience changes and reassigns appear in the item's history and never raise `ANALYTICS-405`.

Source: [HQ analytics v2 spec](819-hq-analytics-v2-team-reports-with-parameters-spec.md).

## Spine reach

model/api (Audience, AudienceCandidates, Reassign) · store/logic (audience chip text, who may share/narrow/reassign) · component (share dialog, 413 page) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `audienceSummary` — everyone, or roles and users, gives the chip text, with a removed role marked; the count goes through `formatCount` · pure
- [ ] `share actions` — owner, curator and author-in-audience → share, narrow, reassign or none · pure
- [ ] drive: share with a role and a user; reopen as an outsider and see 413 naming the owner; as a curator, narrow and reassign · flow

## Boundaries

Proposed doors: Audience, AudienceCandidates and Reassign. Code 413. New `boards` keys. Names are free text, so `<bdi>`; employee ids are machine values, so `Ltr`.

## Done when

The pure tests are green and the drive covers share, 413, narrow and reassign.

## Blocked by

[822](822-a-runner-sees-no-builder-and-the-author-grant-unlocks-it.md)

## Comments

- 2026-11-06 — built on integration branch `spec/819-analytics-v2` (worktree `C:/Playground/oms-react-spec819`, tip 71c7cc53, incl. the review-fix commit); stubbed — the live walk is 835. Merged to main 2026-11-07 at bf198e97 (unpushed); branch and worktree removed.
