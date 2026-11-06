---
status: open
spec: 805
blocked-by: 806
---

# 807 — A role's Held by tab adds several holders found by searching people

## What to build

A role's **Held by** tab gains **Add holders**, shown only when the role is in the admin's assignable
scope (the Access probe's `assignableRoles`, the rule the person-side assign already uses). It opens the
checklist picker in **server mode** over `AuthzAdminWeb/Employees` (contains-match on ID/name, capped at
50): the admin types a term, the results list as rows (name + employee ID), and ticks people.

- Picks **survive a new search term** and show as removable chips above the list.
- People who already hold the role are disabled with "Already holds".
- Inactive people carry the "Inactive" tag and stay pickable.
- **Select all shown** ticks only the current, enabled results.
- When the search returns the cap, the cap note says to narrow the term.

Footer **Assign to N** runs the batch runner with one `Users/AssignRole` per person — run-all-then-report,
refused people stay ticked with the server message, assigned people leave the picks. The holders list,
holder count and each person's assigned-roles cache refresh. A person with no user account yet is fine:
the server creates it on the first assign.

## Spine reach

model/api (existing search + assign) · store/logic (picker server mode, already-holds) · component (Held by tab, Add holders dialog) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `picker keeps picks across a server query change and disables already-held rows` — extends the 806 helper's tests · pure
- [ ] `authz-batch-drive` Add holders leg — search `ahmed` tick 2, search `khalid` tick 1 → 3 chips; a current holder is disabled; Assign to 3 with one stubbed refusal → "2 assigned, 1 refused", the Held by list shows the two; the button is absent for a role outside a delegated scope · flow (Playwright)

## Boundaries

Existing `Employees` and `Users/AssignRole`; refusals (delegation scope, protected role) surface verbatim.
New `authz-admin` keys. No new route.

## Done when

From a role's Held by tab an admin can gather people from several searches and assign them all in one
batch, with refusals reported and retryable, and the drive leg passes.

## Blocked by

[806](806-a-composite-gets-many-member-roles-in-one-search-and-tick-batch.md)
