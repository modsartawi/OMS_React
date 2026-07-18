---
name: new-feature
description: >-
  Scaffold a new oms-react feature screen — folder under an area (oms/admin/…), a Page + api stub,
  its i18n namespace, and every registration point (route, menu, i18n) wired so it compiles and
  routes on the first try. Use this WHENEVER adding a new screen, page, module, or "feature" to the
  oms-react SPA — an OMS screen, an admin screen, a new list/detail page — even when the user just
  says "add a screen for X", "create a new page", "scaffold a module", or names a nav item that
  doesn't exist yet. Prefer this over hand-creating files so the canonical shape and boundaries
  (`.claude/rules/feature-structure.md`) are followed by construction.
---

# Scaffold a new feature

A **feature** is one screen (or a tight cluster) that owns its data-fetching, columns, dialogs, and
i18n namespace. The layout is settled — this skill just applies it so a new screen is born consistent
and never drifts from `.claude/rules/feature-structure.md`. Read that rule if anything here is unclear;
it is the source of truth and this skill implements it.

The value is in the **registration points**: a new screen isn't done when its folder exists — it's
done when the router, the menu, and i18n all know about it. Miss one and the screen 404s, is invisible
in the nav, or renders raw `t()` keys. This skill wires all of them in one pass.

## Step 1 — Gather the inputs

Ask the user (or infer from the request) — don't guess silently:

- **area** — the top-level nav group / URL prefix. Existing: `oms`, `admin`. A *new* area is only
  warranted when the screen starts a genuinely new nav group (e.g. `reports`). If unsure, ask.
- **feature** — a kebab-case name, unique within `features/` (e.g. `stock-count`, `price-audit`).
  This is the folder name AND the i18n namespace (they stay identical — see the rule).
- **title** — the human-readable screen name (e.g. "Stock Count"). Goes in i18n, never hard-coded.
- **gated?** — is the screen permission-gated (like `ua-admin`/`authz-admin`, which probe a server
  grant and hide from the nav until allowed) or always-visible (like `deliveries`)? Default to
  **always-visible** unless the user says it needs an access check.
- **icon** — a `lucide-react` icon name for the menu (e.g. `Boxes`, `FileText`). Ask or pick a sensible one.

Derive the rest mechanically:

| thing | rule | example (`stock-count` in `oms`) |
|---|---|---|
| folder | `src/features/<area>/<feature>/` | `src/features/oms/stock-count/` |
| Page component | PascalCase(feature) + `Page` | `StockCountPage` in `StockCountPage.tsx` |
| api export | camelCase(feature) + `Api` | `stockCountApi` in `api.ts` |
| i18n namespace | == feature (flat, hyphens kept) | `stock-count` |
| import ident | camelCase(feature) | `stockCount` (for i18n import) |
| route path | `/<area>/<feature>` | `/oms/stock-count` |

## Step 2 — Create the feature files

Create exactly these two files (the **required** set — add `columns.ts`, `helpers.ts`, dialogs, a
`zustand` store later, by hand, only when the screen needs them; don't pre-create empties).

`src/features/<area>/<feature>/<Pascal>Page.tsx` — a minimal, compiling screen:

```tsx
import { useTranslation } from 'react-i18next'

// Scaffolded by /new-feature. Replace the placeholder body with the real screen
// (grid / form / master-detail). Keep every user-visible string in t() — see
// .claude/rules/i18n-zero-literal.md. Data comes from ./api via TanStack Query.
export default function <Pascal>Page() {
  const { t } = useTranslation('<feature>')
  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h1 className="text-lg font-semibold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('placeholder')}</p>
    </div>
  )
}
```

`src/features/<area>/<feature>/api.ts` — server calls through the shared client:

```ts
import { api } from '@/core/api'

// Every server call goes through @/core/api (see .claude/rules/api-envelope.md):
// it unwraps the SIS.Api envelope, returns `.data`, and maps failures to ApiError.
// Replace this example with the screen's real endpoints and type the results with
// a model under @/core/models/. Never fetch() directly, never import another feature.
const BASE = '<Pascal>' // SIS.Api controller/route segment — adjust to the real one.

export const <camel>Api = {
  list(): Promise<unknown[]> {
    return api.get<unknown[]>(`${BASE}/List`)
  },
}
```

**If the screen is permission-gated**, model it on `features/admin/ua-admin` instead of writing the
minimal stub blind: add an `access()` call to `api.ts` returning a typed access result, have the Page
guard on `useQuery({ queryKey: ['<feature>','access'], queryFn: () => <camel>Api.access() })` and show a
"no access" backstop when denied, and give the menu item an `accessProbe` (Step 4). Read
`features/admin/ua-admin/api.ts` + `UaAdminUsersPage.tsx` and mirror the shape — the server enforces
the grant on every call regardless; the nav hide is show/hide hygiene sharing the same query key.

## Step 3 — Register the i18n namespace

Create `src/locales/en/<feature>.json`:

```json
{
  "menu": {
    "<feature>": "<Title>"
  },
  "title": "<Title>",
  "placeholder": "This screen is scaffolded but not built yet."
}
```

If you are creating a **new area**, also add its group label here: `"menu": { "<area>": "<Area Title>",
"<feature>": "<Title>" }` (the area group's label lives in its first feature's namespace).

Then wire it into `src/core/i18n.ts` — three edits, matching the existing hyphenated entries
(`'ua-admin': uaAdmin`):

1. Import: `import <camel> from '@/locales/en/<feature>.json'`
2. Add `'<feature>'` to the `ns: [...]` array.
3. Add `'<feature>': <camel>` to the `resources.en` object.

## Step 4 — Register the route

In `src/app/router.tsx`, add a lazy route inside the `ProtectedLayout` `children` array (near the
other `/<area>/…` entries):

```tsx
{
  path: '<area>/<feature>',
  lazy: async () => ({ Component: (await import('@/features/<area>/<feature>/<Pascal>Page')).default }),
},
```

Lazy `import()` keeps each screen in its own code-split chunk — don't convert it to a static import.

## Step 5 — Register the menu item

In `src/layout/menu-model.ts`: import the icon at the top (`import { <Icon> } from 'lucide-react'` —
merge into the existing lucide import), then add a leaf. For an **existing area**, append it to that
area group's `items: [...]`. For a **new area**, add a new top-level group `{ labelKey:
'<feature>:menu.<area>', icon: <Icon>, items: [ <leaf> ] }`.

The leaf (always-visible):

```tsx
{
  labelKey: '<feature>:menu.<feature>',
  icon: <Icon>,
  routerLink: '/<area>/<feature>',
  activePrefix: '/<area>/<feature>',
},
```

Gated leaf — add an `access` probe sharing the Page's query key (import `<camel>Api` at the top too):

```tsx
  access: accessProbe({
    key: ['<feature>', 'access'],
    run: () => <camel>Api.access(),
    visible: (r) => r.canOpen === true, // match your access result's field
  }),
```

## Step 6 — Verify

Run `npm run typecheck`. It must be clean — a green typecheck proves the namespace is registered, the
route resolves, the menu imports link, and the Page compiles. Then confirm the screen is reachable:
`npm run dev` and open `/<area>/<feature>` (it should render the title + placeholder and highlight its
menu item). Fix any red before handing back.

## Boundaries (inherited from the rule — do not violate while scaffolding)

- The new feature imports only `@/core/*` and its own relative files — **never** another feature.
- No per-feature barrel `index.ts`; `app`/`layout` deep-import the exact paths above.
- The i18n namespace stays flat (== feature name); don't nest it under the area.

## Worked example

Request: *"add a stock-count screen under OMS."* → area `oms`, feature `stock-count`, title
"Stock Count", always-visible, icon `Boxes`. Creates `src/features/oms/stock-count/StockCountPage.tsx`
+ `api.ts` (`stockCountApi`), `src/locales/en/stock-count.json`; registers `stock-count` in
`core/i18n.ts`, route `/oms/stock-count` in `router.tsx`, and a `Boxes` leaf under the OMS group in
`menu-model.ts`. `npm run typecheck` green → screen live at `/oms/stock-count`.
