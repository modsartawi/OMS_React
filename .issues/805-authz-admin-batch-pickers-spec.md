---
type: spec
status: ready
---

# Authorization Admin: pick many, search, and paste IDs when building roles and teams

Grilled 2026-11-06 (`/grill-with-docs`). Client-only — no BackOffice work.

## Problem Statement

An administrator building teams in the Authorization Admin screen works one item at a time:

- Adding member roles to a composite shows a flat list of every single role with one **Add** button per
  row and **no search**. With a large role catalog, filling a composite means scrolling and clicking
  once per role.
- A role's **Held by** tab can only show and revoke holders — it **cannot add anyone**. Giving a role to
  people means opening each person's pane, opening **Assign role**, finding the role in an unsearchable
  list, assigning, and repeating — the dialog closes after every single assign.
- A new composite role is always created **empty**; its members can only be added afterwards, one by one.

The administrator is about to receive teams as **lists of employee IDs** and must turn each list into a
role's holders. Doing that one person at a time is the blocker.

## Solution

One shared, inline **checklist picker** — a search box over the list (name and description), a check box
per row, **Select all shown** / **Clear**, a picked count, and one footer button (**Add N** / **Assign to
N**) — used in four places:

1. **Composite → Add member roles** — offers single roles not yet members.
2. **Role → Held by → Add holders** (new) — searches people on the server; picks survive across searches
   and show as removable chips; a **Paste IDs** box takes a pasted list of employee IDs, looks each one up
   exactly, and adds the found people to the picks, reporting the IDs it could not use.
3. **Person → Assign roles** — offers the admin's assignable roles not yet held, many at once.
4. **New composite role** — members picked at creation.

Pressing the footer button writes the batch **one item at a time** through the existing single-item doors.
A refusal never stops the batch: when it finishes the dialog stays open and says how many were done and
how many refused, naming each refused item with the server's message. Refused items stay ticked so the
administrator can retry them.

## User Stories

1. As an authz administrator, I want to type into a search box in the Add member dialog, so that I can find one role in a catalog of hundreds without scrolling.
2. As an authz administrator, I want the role search to match the description as well as the role name, so that I can find a role by what it does when I don't remember its code.
3. As an authz administrator, I want to tick several single roles and add them all with one button, so that filling a composite is one action, not one per role.
4. As an authz administrator, I want **Select all shown** to tick every role the current search shows, so that "type `PHARM`, select all, Add" builds a team composite in seconds.
5. As an authz administrator, I want **Clear** to untick everything, so that I can start a pick over without unticking rows one by one.
6. As an authz administrator, I want to see how many items I have picked, so that I know what the button will write before I press it.
7. As an authz administrator, I want the footer button to state the count ("Add 12"), so that there is no surprise about the size of the write and no extra confirmation step is needed.
8. As an authz administrator, I want roles that are already members of the composite left out of the list, so that I cannot pick a no-op.
9. As an authz administrator, I want only single roles offered as composite members, so that composites still never nest.
10. As an authz administrator, I want the picker to tell me when nothing is left to add, so that an empty list doesn't look broken.
11. As an authz administrator, I want the search to tell me when nothing matches, so that I can tell "no match" from "nothing left".
12. As an authz administrator, I want an **Add holders** action on a role's Held by tab, so that I can give the role to people from the role's side.
13. As an authz administrator, I want Add holders to appear only for a role I'm allowed to assign, so that I'm never offered a write the server will refuse for scope.
14. As an authz administrator, I want to search people by name or ID inside Add holders, so that I can find each person without leaving the role.
15. As an authz administrator, I want my picks kept when I change the search term, so that I can gather a team from several searches.
16. As an authz administrator, I want my picked people shown as removable chips above the list, so that I can see and correct the whole batch before writing it.
17. As an authz administrator, I want people who already hold the role shown greyed as "Already holds" and not tickable, so that I see they're covered without creating a duplicate assign.
18. As an authz administrator, I want inactive people tagged but still pickable, so that the picker matches how the Held by tab draws them and I decide.
19. As an authz administrator, I want **Select all shown** in the people picker to tick only the current results, so that I never pick people I haven't seen.
20. As an authz administrator, I want the people search's 50-row cap stated when it is hit, so that I know to narrow the term rather than assume everyone is listed.
21. As an authz administrator, I want a **Paste IDs** box where I paste a column of employee IDs (from Excel, or separated by commas, spaces or new lines), so that a team sent to me as IDs becomes a pick list in one step.
22. As an authz administrator, I want each pasted ID matched **exactly**, so that `1234` never picks employee `12345`.
23. As an authz administrator, I want repeated IDs in a paste collapsed, so that a messy list doesn't double-assign.
24. As an authz administrator, I want the found people added to my picks with their names, so that I can check the batch is the right people before anything is written.
25. As an authz administrator, I want the IDs that were not found listed back to me, so that I can send them back to whoever made the list.
26. As an authz administrator, I want pasted IDs of people who already hold the role reported as such and not picked, so that the result tells me they're already in the team.
27. As an authz administrator, I want to see the paste's lookup progress while it runs, so that a 40-ID paste doesn't look frozen.
28. As an authz administrator, I want a person who has never signed in (no user account yet) to be assignable from a pasted ID, so that new team members are covered — the server creates their account on the first assign.
29. As an authz administrator, I want to tick several roles in a person's **Assign role** dialog and assign them together, so that onboarding one person is one action.
30. As an authz administrator, I want Assign roles to offer only roles I'm allowed to assign and the person doesn't already hold, so that the list matches today's delegation rule.
31. As an authz administrator, I want to pick a new composite's members while creating it, so that a team composite is created complete, not empty.
32. As an authz administrator, I want a batch to write every item even when one is refused, so that one bad item doesn't leave the rest of the team undone.
33. As an authz administrator, I want a summary when the batch ends ("18 added, 2 refused"), so that I know the outcome at a glance.
34. As an authz administrator, I want each refused item named with the server's own message, so that I know why (out of scope, last admin, protected role, not found).
35. As an authz administrator, I want refused items left ticked and the dialog left open, so that I can fix the cause and press the button again for just those.
36. As an authz administrator, I want succeeded items removed from the picker after the batch, so that a retry cannot re-write what already worked.
37. As an authz administrator, I want the button disabled while a batch runs, with progress shown, so that I cannot start a second overlapping batch.
38. As an authz administrator, I want the role's Held by list, member list, holder counts, and each person's assigned roles refreshed after a batch, so that the screen shows the new truth without a reload.
39. As an authz administrator, I want each change in a batch to leave its own audit row, so that the trail still says exactly who got what — one change, one entry.
40. As an authz administrator, I want an expired session during a batch handled the usual way (one toast, back to login), so that a batch never strands me on a dead screen.
41. As an authz administrator using Arabic, I want role names, employee IDs and counts isolated, so that the picker reads correctly right-to-left.
42. As a keyboard user, I want to tick rows and move through the list with the keyboard, so that I can build a team without the mouse.
43. As a screen-reader user, I want the list, its count and the batch summary announced, so that I know what I picked and what happened.

## Implementation Decisions

- **Client-only.** The batch loops the existing single-item doors — `Roles/AddMember`, `Users/AssignRole`,
  and `Roles/CreateComposite` (which already accepts a member list). No new endpoint, no BackOffice ticket.
  Bulk endpoints were considered and rejected: they would block on a BO deploy, and one change per write
  keeps one audit row per change (the same reasoning CONTEXT.md gives for member commands).
- **Batch runner — a new pure module in `core/`.** Given the item list and a single-item write, it runs the
  writes **sequentially**, never stops on a refusal, and returns each item's outcome (`done` / `refused`
  with the `ApiError`) plus totals, reporting progress as it goes. Refusal text is shown through
  `apiErrorMessage`; a 401 is left to `handle401` (the runner stops the batch on an `auth` error, since the
  session is gone). Sequential, not parallel: it keeps load trivial and makes the audit order match the
  pick order.
- **Checklist picker — a new shared control in `core/ui`**, inline in the dialog body (not a popover):
  search box, check-box rows, Select all shown, Clear, picked count, optional picked-chips strip, empty
  and no-match states, a "cap hit" note. Presentational: the caller owns the options, the picks and the
  query. Two modes: **local** (the caller hands every option; the picker narrows by name + description) and
  **server** (the caller narrows on query change, as `MultiSelect`'s `onQueryChange` does). Rows can be
  **disabled with a note** ("Already holds") and **tagged** ("Inactive", role kind). Its list logic —
  narrowing, exclusion, select-all-shown, picks surviving a query change, count — lives in a pure helper
  beside it. The existing `MultiSelect` is unchanged; it stays the field-style control. Living in
  `core/ui`, its check boxes are outside the feature control ratchet.
- **Add member roles (composite).** Options = catalog single roles minus current members. Footer **Add N**.
  Replaces today's per-row Add list.
- **Add holders (role → people), new.** A button on the Held by tab, shown when the role is in the admin's
  assignable scope (the same Access-probe rule the person-side assign uses). Server-mode picker over
  `AuthzAdminWeb/Employees` (contains-match, capped at 50). Current holders are disabled "Already holds";
  inactive people are tagged and pickable. Footer **Assign to N**, writing `Users/AssignRole` per person.
- **Paste IDs.** Reuses `core/ui/PasteCodesDialog` and the `core/util/code-list` parser to split and
  de-duplicate. Each ID is looked up through the same `Employees` search, sequentially, and resolves to the
  row whose `employeeId` equals it **exactly** (the search is a contains-match). Outcomes per ID: found →
  added to picks with its name; already holds → reported, not picked; not found → listed back. The
  resolution rule is a pure helper in the feature. Assigning a person with no user account is fine — the
  server auto-creates the account from the identity spine on the first assign.
- **Assign roles (person).** Options = assignable roles (full scope → whole catalog) minus held. Footer
  **Assign N**. The dialog no longer closes after one assign; it follows the batch rule.
- **New composite role.** The create dialog gains the picker (singles only) and passes the picks to
  `CreateComposite`. That is one write, so it is all-or-nothing on the server's side; its refusal surfaces
  in the dialog as today.
- **After a batch:** succeeded items leave the picker, refused ones stay ticked with their message, the
  dialog stays open showing "N done, M refused", and the caller invalidates the role detail, holders,
  catalog counts and assigned-roles caches (the same keys today's single writes invalidate).
- **i18n:** new keys in the existing `authz-admin` namespace (picker labels, summary, paste outcomes,
  Add holders); generic picker words passed in by the caller, as `PasteCodesDialog` does. Counts go
  through i18next plurals; values isolated per the bidi rule (`Ltr` for IDs and counts, `<bdi>` for
  names/descriptions, `fsi()` in toasts and `t()` interpolations).
- **No new route, store or namespace. No CONTEXT.md change** — a "team" stays a role (usually a
  composite) whose holders are the team; CONTEXT.md already says there is no team object.

## Testing Decisions

- A good test drives a module through its public interface and asserts outcomes a user would notice —
  which items were written, which were refused and why, what the picker shows — never internal state.
- **Pure tier (vitest):**
  - batch runner — a fake single-item write that succeeds, refuses (business), fails (network) and
    401s; asserts sequential order, run-past-refusal, per-item outcomes, totals, stop on `auth`.
  - picker list helper — name + description narrowing, exclusion, disabled rows, select-all-shown only
    ticks shown and enabled rows, picks survive a query change, clear, count.
  - paste-ID resolution — splitting/de-dup via the existing parser, exact match over contains-search
    results (`1234` vs `12345`), found / already-holds / not-found classification.
- **Flow tier (Playwright drive, manual-run):** a new `tools/authz-batch-drive.mjs` against stubbed
  `AuthzAdminWeb/*` routes, walking all four dialogs, including a Paste-IDs batch with one refused item
  and a retry, and an RTL pass. Prior art: `tools/ua-bulk-create-drive.mjs` (bulk with per-row outcomes)
  and the existing `*.test.ts` beside `core/ui` helpers (`pager.test.ts`, `inspector-pane.test.ts`).
- No RTL component tests — React Testing Library is still not installed (spec 083); the dialogs stay thin
  over the pure modules. `typecheck` + `lint` gate every slice.

## Out of Scope

- Bulk BackOffice endpoints or all-or-nothing batches.
- Bulk **revoke** / bulk remove member / bulk unbind grant.
- Binding several grants to a single role at once (the bind-grant picker is untouched).
- A "team" object, team CSV import beyond pasting IDs, or creating user accounts outside the assign.
- Changing `MultiSelect` or the Ua Admin bulk-create uploader.
- Paging the people search past its 50-row cap (paste IDs is the path for big lists).

## Further Notes

- Build order for `/to-tickets`: the batch runner + checklist picker first, then **Add holders with Paste
  IDs** (it unblocks the incoming team lists), then Add member roles, Assign roles, and New composite.
- A pasted 40-ID team is 40 searches plus 40 assigns, all sequential — seconds, not minutes, against
  SIS.Api; worth confirming once on staging (`http://172.23.10.110:4321`).
