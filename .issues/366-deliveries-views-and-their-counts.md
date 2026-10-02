---
type: wayfinder-ticket
wayfinder: grilling
map: 358
status: done
blocked-by: 360
---

# 366 — Deliveries views and their counts

## Question

The prototype's Deliveries list has **views** with counts (for example "Failed jobs", "Today").

- **What is a view?** A saved set of the 14 search criteria? Column layouts, as `ViewManager.tsx`
  keeps today? Both?
- **Ownership.** Built-in, per user, or shared, and where is it stored?
- **Counts.** Does a view's count mean the loaded rows, or a server count? That depends on
  [What the delivery reads give us](360-what-the-delivery-reads-give-us.md). If the count is
  honestly unknown, how is that said?

## Answer

Grilled with the owner, 2026-10-02. Facts came from [What the delivery reads give us](360-what-the-delivery-reads-give-us.md),
the code (`grid-views.ts`, `ViewManager.tsx`, `search-store.ts`, `DeliveryDocumentModel`), the
[state sources](assets/369-delivery-state-sources.md), and a sweep of BackOffice + SIS.Oms that found
**no server-side preference store of any kind** (no entity, table or endpoint for user settings,
saved views or grid layouts).

### A view is two things: a lens and a saved view

- A **lens** is built in. It is a predicate over the rows **already loaded**, so it never calls the
  server. The five, all from fields the list row carries:
  - **All**.
  - **Needs attention**: `failedJobsCount > 0`.
  - **Cancellation requested**: `closeStatus === 'R'` (close requested, which is final).
  - **Dawaa Now**: `isExpressDelivery`.
  - **Rescheduled**: `rescheduled`.
- The prototype's "Store P042" is **not** a lens. It is one operator's criteria, so it is a saved view.
- A **saved view** captures four things, and applying it **runs its search**:
  - the 14 `DeliveryFilterCriteria`, with the date range stored **relative** ("today", "last 3
    days"), never as frozen dates;
  - the active **lens**;
  - the column state (order, width, visibility, pinning, sort);
  - the AG Grid column filters.
- Both terms are now in `CONTEXT.md`.

### Counts are loaded rows, said honestly

- A lens count is **the number of loaded rows it matches**. There is no server total and no
  BackOffice count ask: a criteria `COUNT(*)` has no `EntryTime` index and multiplies per lens on
  every refresh.
- Counts cover the **whole loaded result** and **ignore the grid's column filters**, so they change
  only when a search runs. When column filters narrow the grid, the grid bar says "N of M shown".
- When `rows.length === Limit`, the result may have been cut:
  - **every** lens count reads as a lower bound ("200+", "7+");
  - the grid bar says the page stopped at the limit ("Showing the newest 200, there may be more.
    Narrow the search or raise the limit.").
- Before any search, the counts show "—".

### Ownership: per user, in the browser

- Saved views are **per user**, in `localStorage` **keyed by user id**, so a shared counter PC never
  shows one operator's views to the next.
- There are **no shared views**. The prototype's "Shared with you" section is dropped.
- A server store, which would let views follow an operator across PCs and be shared, is **out of
  scope**. It needs a new BackOffice entity, table and cookie endpoints, and it is a later effort.
- **Existing views** (`oms-web.delivery-grid-views`, layout only, shared with the Angular app):
  - On first load they are **imported once** into the signed-in user's store as **layout-only**
    views: no criteria, lens All.
  - Applying one sets the layout, leaves the current criteria alone, and runs no search.
  - Re-saving one makes it a full view.
  - The old key is never written or removed.

### Lifecycle

- **Default.** Each user may **star one** saved view. On page open with no in-memory search, the
  default applies **and runs**. Without a default, the page opens empty as today.
  - Returning from Delivery details still restores the in-memory search (`search-store.ts`),
    never the default.
  - This is a behaviour change, so the **operator lead accepts it** (per [How the Ops Console
    reaches main](361-how-the-ops-console-reaches-main.md)).
- **Modified dot.** A dot sits beside the active view's name once its criteria, lens, columns or
  grid filters drift from what was saved.
- **Actions:**
  - Update (overwrite);
  - Save as new;
  - Rename;
  - Set or clear default;
  - Delete, with **undo from the toast** and no confirm dialog.
- Names are unique per user.

### For the dependent tickets

[The Deliveries list as one screen](368-the-deliveries-list-as-one-screen.md) prototypes this as:

- a views rail (lenses, then saved views);
- the count and lower-bound wording;
- the grid bar's "N of M shown" and cut-off line;
- the modified dot and the actions menu.

Whether lenses and saved views also appear in the palette's **This screen** group is that ticket's
call, inside [What the Ctrl+K palette holds](364-what-the-command-palette-holds.md).
