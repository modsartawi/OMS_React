# OMS Portal (`oms-react`)

React rebuild of the OMS back-office portal — successor to the Angular prototype at
`C:\Playground\frontend`, which stays runnable as the behavioral reference until this app
reaches parity. Wayfinder map 402 in `C:\Work\DMSCO\BackOffice\.issues\` tracks the effort;
the two research assets there are this repo's contract:

- `403-ANGULAR-PROTOTYPE-CONTRACT.RESEARCH.md` — behavioral parity checklist (auth, envelope, screens, shell)
- `404-REACT-STACK-BASELINE.RESEARCH.md` — pinned stack + conventions

## Run

```
npm install
npm run dev      # http://localhost:5173, proxies /api → http://localhost:5111
```

Prerequisite: SIS.Api running on `localhost:5111` with `CookieAuth.Enabled = true`
(dev stub accepts any non-empty password except the configured `FailPassword`).

`npm run build` → typecheck + static `dist/` (carries `web.config` for the IIS
same-origin deployment; SPA fallback excludes `/api`).

## Stack

react 19 · vite 8 · react-router 8 (library/data mode) · tailwind 4 + shadcn tokens ·
TanStack Query · zustand · react-i18next (en-only, zero-literal rule) · sonner · lucide.

Deviations from the 404 baseline, made at scaffold time:

- **npm, not pnpm** — corepack can't shim pnpm without admin rights on this machine.
- **Vite proxy rewrites `/api` off** — the 404 asset assumed SIS.Api serves under `/api`;
  the live API serves at the root (the Angular `proxy.conf.json` strips the prefix too).
- shadcn CLI components not yet pulled — tokens + `components.json` are in place; run
  `npx shadcn@latest add <component>` when a screen needs real primitives. Screen 1 therefore
  uses native `<input type=date>` / `<select>` where the Angular prototype used PrimeNG
  (no Today/Clear button bar, no type-ahead on long dropdowns) — theme-pass work.
- **xlsx export uses `write-excel-file` 4.1.1, not SheetJS `xlsx`** — closes 403's R-7: the
  npm `xlsx@0.18.5` pin carries a high-severity advisory in its *parsing* path and is the last
  npm SheetJS release. This library only writes, and has no parser.
- **AG Grid Community only** — Excel export is an Enterprise module, so the workbook is built
  client-side (`features/deliveries/export.ts`); set filters are likewise Enterprise. Budget
  both before Screen-1 GA (404 §3).
- react-hook-form/zod, eslint/prettier, vitest/playwright: deferred to the hardening ticket
  (nothing here needs them yet — Screen 1's smoke borrowed Playwright from the Angular
  prototype's `node_modules`).

## Layout

```
src/
  app/            entry, router (route arrays per module), global.css (tokens)
  core/           api client (envelope+errors+401), session store, i18n, nav indirection
  layout/         AppShell (topbar/sidebar/dark mode/account popup), menu-model, theme
  features/
    auth/         LoginPage, ProtectedLayout (guard), StoreSwitcher, auth api
    deliveries/   Screen 1: filter panel, 41-column grid, toolbar, saved views, xlsx export
    document/     Screen 2 placeholder (ticket 407 replaces it)
  locales/en/     translation JSON per namespace
```

House rules (from the baseline): logical Tailwind utilities only (`ms-*/pe-*/text-start`,
never `ml/pr/left-`); no user-visible string literals in JSX — always `t()`.

Owner verdict on the skeleton (2026-07-17): functionally approved; current look is
placeholder-grade by design — a proper theme/design pass is a later map item.
