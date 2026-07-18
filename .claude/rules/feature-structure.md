# Rule: feature folders, areas, and import boundaries

`src/features/` is organized under an **area layer**. A feature is a screen (or tight cluster of
screens) that owns its data-fetching, columns, dialogs, and i18n namespace. Settled in BackOffice
map 478 / ticket 479 (`C:\Work\DMSCO\BackOffice\.issues\479-oms-react-feature-shape-and-area-taxonomy.md`).

> **Interim:** the physical `git mv` into `features/<area>/…` is BackOffice ticket 481 (pending).
> Until it runs, `features/*` is still flat (`features/deliveries`, not `features/oms/deliveries`).
> This rule is the **target** the migration and the `/new-feature` scaffold implement.

## Areas

An **area** = a top-level nav group / URL prefix. It is a folder under `features/`:

- `features/oms/` — `deliveries`, `document` (URLs `/oms/*`).
- `features/admin/` — `ua-admin`, `authz-admin` (URLs `/admin/*`).
- `features/auth/` — **top-level, NOT an area.** Login, session, `StoreSwitcher`, `ProtectedLayout`
  are cross-cutting platform, not a nav destination — they stay directly under `features/`.

A new area folder appears **only when a new nav group / URL prefix does** (e.g. a future
`features/reports/` behind `/reports/*`). The folder mirrors the URL prefix and the menu group.

## A feature's files

- **Required:** `<Feature>Page.tsx` (default-export, the route entry point) + `api.ts` (all server
  calls, through `@/core/api`, wrapped in TanStack Query at the Page). Plus the feature's **i18n
  namespace** JSON (see below).
- **Optional, add as the screen needs them:** `columns.ts`, `helpers.ts`, `filter.ts`,
  dialog/modal/pane components, a local `zustand` store. Don't pre-create them.
- **Intra-feature imports are relative** (`./api`, `./columns`, `./FilterPanel`). Shared code comes
  from `@/core/*`.

## Import boundaries (enforced by lint + review — ticket 483)

- **Feature → `@/core/*`:** allowed. `core/` is the **single shared layer**.
- **Feature → its own files:** relative only.
- **Feature → another feature: forbidden** (including across areas, `admin/* ↛ oms/*`). Logic shared
  by two features graduates **up to `@/core/*`**, it does not cross sideways.
- **`core/` → any feature: forbidden.** Shared code must never depend on a feature.
- **`app/` + `layout/` → any feature: allowed.** They are the composition root — `app/router.tsx`
  lazy-imports Pages; `layout/menu-model.ts` imports a feature's OWN access call to build its
  `accessProbe`; `layout/AppShell.tsx` imports `authApi` / `StoreSwitcher`.
- **No per-feature barrel** (`index.ts`). `app`/`layout` deep-import exact paths
  (`@/features/oms/deliveries/api`) — keeps router lazy-import code-splitting clean.

## i18n stays flat

Folder grouping does **not** touch i18n. Namespace name **== feature name** (`t('deliveries:key')`,
`t('ua-admin:key')`); locale files stay flat at `src/locales/en/<feature>.json`; registration stays
central in `src/core/i18n.ts`. Grouping a feature under an area never renames its namespace or its
`t('ns:key')` call sites. (See [i18n-zero-literal](i18n-zero-literal.md).)

## Path alias

Single `@/* → ./src/*` (`tsconfig.json` `paths` + `vite.config.ts` `resolve.alias`). Areas only
lengthen feature paths (`@/features/oms/deliveries/…`) — there is no per-area alias.

## Adding a feature — the registration checklist

A new feature touches exactly these (the `/new-feature` scaffold skill, ticket 482, automates them):

1. `src/features/<area>/<feature>/` — folder + `<Feature>Page.tsx` + `api.ts`.
2. `src/locales/en/<feature>.json` **and** register in `src/core/i18n.ts` (import, `ns[]`, `resources`).
3. `src/app/router.tsx` — one lazy route entry under the area's URL prefix.
4. `src/layout/menu-model.ts` — one menu item (optional `accessProbe` for a permission-gated screen).

## The tell

If a file under `features/<A>/` imports from `@/features/<B>/`, or anything under `core/` imports a
feature, it's a violation — move the shared piece to `core/`. If a new screen's namespace isn't
registered in `core/i18n.ts`, its `t()` calls render raw keys.
