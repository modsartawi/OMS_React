---
type: wayfinder-ticket
wayfinder: grilling
map: 275
status: done
blocked-by: —
---

# 279 — The nav grows a third level, and the views become paths

## Question

The map rules that `Settlement Account` becomes an **expandable node** under Collections with four
leaves — Overview (the parent's own link) · **Open settlements** · **Ledger** · **Bulk upload**.
Two shipped mechanisms have to change for that, and this ticket settles how far each change reaches.

**What is true today, by inspection:**

- **The shell renders exactly two levels.** `MenuGroup` (`src/layout/AppShell.tsx:55`) maps its
  children straight to `MenuLeaf`, and `MenuLeaf` (line 36) is a `NavLink` with no recursion. Three
  levels cannot render.
- **`isActive` matches pathname only** (`src/layout/menu-model.ts:503`) — its docstring: *"query/hash
  already stripped by caller"*. So `?view=ledger` and `?view=batch` can never highlight distinct
  submenu entries. This is what forces the URL change; the submenu is not cosmetic.
- **`Settlement Account` is deliberately a leaf** (menu-model.ts:366-369): *"a further leaf in this
  group rather than a group of its own, because neither a new nav group nor a new URL prefix
  appears."* That reasoning is now overtaken — a URL prefix **does** appear — but the ruling should
  be overturned in writing rather than silently.

**Decisions:**

1. **How deep does the recursion go?** Make `MenuGroup` genuinely recursive (any depth), or add
   exactly one nested level and stop? Recursion is fewer lines and more rope; a bounded change is
   honest about what has been designed. ⚠️ This touches the shell every group renders through — the
   blast radius is every screen in the app, and `useVisibleMenu`'s fail-closed probe filtering has to
   keep working at the new level (a nested node whose children are all hidden must itself disappear,
   or the nav grows an empty expander).
2. **The URL grammar.** `addresses.ts` is a **keep-list** — 270 built it so *"a later slice's
   parameter belongs to a view by default"*, and `?store=`, `?view=`, `?scope=`, `?batch=`, plus
   270's six ledger criteria all live under that rule. Moving `view` from a parameter to a path
   segment changes what that module is: which parameters survive a path change, and does `?scope=`
   still ride along everywhere (the rule every address on this screen follows)?
3. 🔑 **Back-compatibility, the one question the map cannot answer for you.** 273 made a batch
   address deliberately shareable — *"reachable an hour and a reload later"* — and 269's `?store=`
   is *"the whole of how a branch is reached"*. Someone may have one pasted into a ticket or an
   email. Do the old query URLs redirect, and for how long? A redirect is cheap; a dead link an
   accountant pasted into an incident is not.
4. **What the parent's own click does.** A nested node is both a label and a destination here
   (Overview). Confirm clicking the parent navigates rather than only expanding — and that
   `activePrefix` on the parent does not make every child render as if the parent were selected.
5. **Labels and namespace.** Four new `t()` keys. The group header stays `collection`'s; the leaves
   are `settlement`'s own namespace, following the existing leaf's precedent. *Open settlements* is
   the user's own words and should stay them.

## Why it blocks

[281](281-the-open-settlements-view.md) draws a screen at an address this ticket decides. Building
the view first would mean addressing it twice.

## Answer

**One extra level, rendered by a bounded component; four paths under
`/collection/settlement`; the old query addresses redirect, permanently.** Resolved AFK,
2026-08-15.

### 1. Depth — bounded to three, and the reason is that only the RENDERER is missing

🔑 **`useVisibleMenu` is already fully recursive and needs no change at all.** `collectGated`
(`useVisibleMenu.ts:13`) walks `item.items` recursively, and `filterMenu` (`:21`) drops any node
whose children all hid — *at any depth*, because it recurses before it decides. So decision 1's
⚠️ *"fail-closed probe filtering has to keep working at the new level"* is already satisfied by
construction, and the empty-expander failure it feared cannot occur. **Verified by reading, not
assumed** — it is the one part of this change with real blast radius, and it turns out to be the part
that is already done.

What is missing is only `AppShell.tsx`'s renderer, which maps children straight to `MenuLeaf`
(`:78-80`). Add a **`MenuSubGroup`** and dispatch on shape:

```tsx
{(item.items ?? []).map((c) =>
  c.items ? <MenuSubGroup key={c.labelKey} item={c} onNavigate={onNavigate} />
          : <MenuLeaf     key={c.labelKey} item={c} onNavigate={onNavigate} />)}
```

**Bounded, not generically recursive**, and the reason is visual rather than architectural: a
generic `MenuNode` would render a fourth level nobody has designed — the group header is uppercase
tracking-wide muted, the leaf is sentence case, and there is no third type. Rope that renders
something no one has drawn is rope. `MenuSubGroup` differs from `MenuGroup` in exactly two ways: its
header is a **`NavLink` beside a chevron** rather than a bare button (decision 4), and its indent is
one step deeper. When a fourth level is genuinely wanted, the change is to promote the dispatch —
visible in a diff, argued at that time.

### 2. The URL grammar — four paths, and `view` retires

| leaf | path | what it draws |
|---|---|---|
| **Settlement Account** (parent) | `/collection/settlement` | navigates to Overview |
| Overview | `/collection/settlement` | the door — search, triage, scope |
| **Open settlements** | `/collection/settlement/open` | 281's three tabs |
| Ledger | `/collection/settlement/ledger` | the cross-estate lookup |
| Bulk upload | `/collection/settlement/upload` | the upload, and a batch's withdrawal |

**What survives as a parameter, and the rule that decides it:** a path segment names *which screen*;
a parameter names *what that screen is looking at*. So —

- **`?scope=` rides everywhere**, unchanged. `addresses.ts`'s `KEPT` list stays `[SCOPE_PARAM]` and
  its keep-list rule is untouched — the module's claim is *the URL grammar is spelled once*, and
  after this change it spells paths as well as parameters. Its functions return `path + search`
  rather than `search`.
- **`?store=` and `?entry=` stay parameters on `/collection/settlement`**. A branch's account is not
  a nav destination — it is *where you land*, from a search hit, a lane row or a phone call. Every
  269-era `?store=0142` address therefore **keeps working with no redirect at all**, which is worth
  noting because it is by far the most-pasted address on this screen.
- **The ledger's six criteria stay parameters** on `/collection/settlement/ledger` (`ledger.ts` keeps
  owning what they mean). They are a *question*, which is exactly what a query string is for.
- **`?batch=` stays a parameter** on `/collection/settlement/upload`. It names *which* batch, and it
  never named the view — `?view=batch` did, and the path now does.
- **`VIEW_PARAM` is deleted.** `readBatchView`'s ⚠️ *"both halves are required"* rule dissolves with
  it: a bare `?batch=` on the Overview path is now simply a parameter no view reads.
- **`?tab=owing|owed|cash`** is 281's, on `/collection/settlement/open`. A tab is what the screen is
  looking at, not a screen — and three nav leaves for one work session would be the triage-page
  mistake again, one level down.

### 3. 🔑 Back-compatibility — redirect, in the client, and keep it

At `/collection/settlement`, before anything renders: `?view=ledger` → `/collection/settlement/ledger`,
`?view=batch&batch=…` → `/collection/settlement/upload?batch=…`, every other parameter carried
through, `<Navigate replace>` so the Back button does not bounce.

**Kept indefinitely, with no sunset.** The asymmetry the ticket names is the whole argument: a
redirect is six lines and one test; a dead link an accountant pasted into an incident is a person
being told *page not found* while holding a phone. There is no benefit on the other side of the
ledger to weigh against that — nothing is simplified by removing it later, so nothing schedules its
removal. It is documented as a **compatibility shim with a date and a reason**, which is what stops
it being read as live grammar by the next reader.

⚠️ Only `?view=` needs it. `?store=`, `?entry=` and `?scope=` are unmoved, so the addresses 269 and
273 made shareable stay literally correct.

### 4. The parent click, and the active-highlight trap this exposes

The parent **navigates to Overview and expands** — a nested node here is both a label and a
destination, and a header that only expands would make Settlement Account the one nav item you
cannot click. Hence `MenuSubGroup`'s header is a `NavLink` with the chevron as a separate control
beside it, so expanding and navigating are two targets rather than one ambiguous one.

🚩 **And the ticket's fear is real, in a place it did not point at.** `isActive`
(`menu-model.ts:503`) is `pathname === target || pathname.startsWith(target + '/')`, so an **Overview
leaf** at `/collection/settlement` would render as active on `/open`, `/ledger` and `/upload` —
two leaves highlighted at once, permanently. The fix is one field:

```ts
/** Match this path EXACTLY — for a parent that is also a destination (Overview). */
exact?: boolean
```

…and `isActive` returns `pathname === target` when it is set. Used by the Overview leaf and by
nothing else today. The **parent's own row** is deliberately *not* asked `isActive` at all — it takes
its emphasis from `hasActiveChild`, so the group reads as *"you are somewhere in here"* rather than
competing with the leaf that says where.

### 5. Labels and namespace

`settlement:menu.settlement` stays the parent's (unchanged, so the existing key keeps its meaning).
Four new keys in the **`settlement`** namespace, following the leaf's own precedent — the group
header above stays `collection`'s:

- `settlement:menu.overview` → *Overview*
- `settlement:menu.open` → **_Open settlements_** — the owner's own words, kept verbatim
- `settlement:menu.ledger` → *Ledger*
- `settlement:menu.upload` → *Bulk upload*

### Overturning 268 in writing, as asked

`menu-model.ts:366-369` ruled Settlement Account *"a further leaf in this group rather than a group
of its own, because neither a new nav group nor a new URL prefix appears."* **That reasoning was
correct and its premise has now changed:** a URL prefix does appear — `/collection/settlement/*`,
four screens under it — so the same rule that made it a leaf makes it a node. The rule is not being
overturned; it is being applied to new facts. The comment is rewritten to say exactly that, so the
next reader sees a decision that moved rather than one that was ignored.

### Scope of the change, for whoever builds it

`AppShell.tsx` (one component + one dispatch line) · `menu-model.ts` (the `exact` field, `isActive`,
the settlement node) · `app/router.tsx` (three child routes + the redirect) ·
`features/collection/settlement/addresses.ts` (paths, `VIEW_PARAM` deleted) · `SettlementPage.tsx`
(the four-way body becomes routed children) · `locales/en/settlement.json` (four keys) ·
`addresses.test.ts` (the redirect table). **`useVisibleMenu.ts`: no change.**
