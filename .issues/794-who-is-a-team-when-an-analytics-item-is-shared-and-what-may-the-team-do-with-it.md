---
type: wayfinder-ticket
wayfinder: grilling
map: 793
status: done
blocked-by: —
---

# 794 — Who is a team when an analytics item is shared, and what may the team do with it?

## Question

v1 shares an item with **every** analytics user (spec 766 story 58). v2 shares it with chosen
teams. Settle:
- **What a team is:** the existing authz roles (`src/features/admin/authz-admin`, with members and
  grants), a new analytics-only group, or named users. Who creates and maintains it.
- **What a team member may do:** run only (change parameters and filters, export, permalink), or
  also edit. Whether "Save as my copy" stays open to them.
- **How it sits beside the tiers** (Personal, Shared, Certified). Is "shared with a team" a fourth
  tier, or does Shared gain an audience?
- **What a non-member sees** when they open a team item's permalink.
- **Whether an item can be shared with several teams**, and whether the owner or a curator may
  change its audience.

Record new terms in `CONTEXT.md` via `/domain-modeling`.

## Answer

Done 2026-11-06 (grilling). The owner chose how a team is defined and how it fits the tiers, and
added that **building is a grant**. The remaining points are settled below and the owner may
overrule them.

1. **A team is an audience made of authz roles and named users (owner).** It can be any mix of
   the roles the Authz admin screen already manages and individual analytics users. Analytics
   stores only role names and user ids. Membership stays in authz, so it is resolved when the item
   is read, and a person who leaves a role drops out at once. Analytics has no team store and no
   team admin screen. A role that is later deleted is ignored, and the owner sees it marked as
   removed.
2. **Building is its own grant (owner).** Analytics now has three grants:
   - **run**: v1's screen grant, `canView`;
   - **author**: new, `canAuthor`;
   - **curate**: as in v1, and it requires author.

   Only an **author** sees the builder and the chart editor, saves, copies, shares, declares
   parameters, and uses the analytics AI (`create_view` and composing a whole report, 802).
3. **A runner only runs.** A runner holds run without author. They may:
   - open the items whose audience includes them, Certified items, and items shared with
     everyone;
   - change parameter values and use the cross-filter;
   - use fullscreen, the table view and TV mode;
   - **export**;
   - copy and open permalinks.

   They have no builder, no AI, no save, no **Save as my copy**, and no Personal items. Copilot
   tools outside analytics are not affected.
4. **An author in the audience** runs the item like a runner. v1's "Save as my copy" (stories 49
   and 50) stays open to them, because they can build.
5. **There are still three tiers. Shared gains an audience (owner).** A Shared item's audience is
   either `everyone` (what v1 meant) or a list of roles and users. Certified stays for every
   analytics user. Whether it can also be limited to a team stays in the map's fog. The home keeps
   v1's order (Certified, then Shared, then my own), and a Shared item shows an audience chip.
6. **Several roles and users per item.** The owner sets and changes the audience. A curator may
   narrow it or unshare the item, which matches the curator's existing power to delete. Every
   audience change is written to the item's history. It is not a definition revision, so it never
   clashes with an edit (`ANALYTICS-405`).
7. **A user outside the audience** who opens a permalink gets a new refusal,
   **`ANALYTICS-413` "not shared with you"**. It names the owner so the user can ask, and shows no
   title or data. A user with no run grant still gets `ANALYTICS-401`. An item that does not exist
   is still `ANALYTICS-404`.
8. **Out of this ticket:** who may be a scheduled email recipient. Email is a different audience,
   and the scheduled-delivery ticket (803) decides it.

New terms in `CONTEXT.md`: **Audience**, **Analytics author** and **Runner**. **Tier** now says
that a Shared item is seen by its audience.
