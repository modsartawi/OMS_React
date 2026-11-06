---
status: open
spec: 805
blocked-by: 806
---

# 809 — A person is assigned several roles in one batch

## What to build

The person pane's **Assign role** dialog becomes the checklist picker (local mode): the admin's assignable
roles (full scope → the whole catalog; delegated → only those) minus roles the person already holds,
searchable by name and description, each row tagged with its kind (composite / system) as today. Footer
**Assign N** runs the batch runner — one `Users/AssignRole` per role — and the dialog **no longer closes
after one assign**: it stays open with "N assigned, M refused", refused roles ticked with their message.
The person's assigned roles, effective authorizations and audit refresh.

## Spine reach

store/logic (reuses runner + picker) · component (Assign role dialog) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `authz-batch-drive` Assign roles leg — search, tick 3 roles, one stubbed refusal → "2 assigned, 1 refused"; the person's chips show the two; a delegated admin sees only their assignable roles · flow (Playwright)

## Boundaries

Existing `Users/AssignRole`. New `authz-admin` keys; today's single-assign keys retired if unused.

## Done when

An admin assigns several roles to one person in one batch with refusals reported, and the drive leg passes.

## Blocked by

[806](806-a-composite-gets-many-member-roles-in-one-search-and-tick-batch.md)
