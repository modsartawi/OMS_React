---
status: done
spec: BackOffice 4182
blocked-by: 951
---

# 954 — A capture script shoots every help screen, in English and Arabic, from the local app on sample data

Spec: BackOffice `C:\Work\DMSCO\BackOffice\.issues\4182-the-analytics-help-center-in-english-and-arabic-read-by-the-copilot-spec.md`.

## What to build

- **`scripts/help-shots/`,** with Playwright as a development-only dependency (pinned exactly; Chromium only).
- **A shot list,** `shots.json`. Each shot has a `name`, a `route`, optional setup steps (click, type, wait for a
  selector), a `crop` selector or a full-page flag, and a viewport (default 1440 × 900).
- **The run:**
  - It signs in to the local app (Vite :5173 against local SIS.Api :5111) with the seed test user. The credentials
    come from the environment and are never written to the script or its output.
  - It switches the language, then shoots every entry once in English and once in Arabic.
  - It writes `<name>.en.png` and `<name>.ar.png` into the BackOffice folder `Services/SIS.Api/Help/analytics/images/`,
    given as an argument.
- **Refreshing the route snapshot:** the same run writes `src/features/help/screens.snapshot.json` from the
  table of contents (951's test reads it).
- **Data:** local seeded analytics data only. The script refuses to run when the base URL isn't localhost.
- **A README** next to the script covers what to start first (local analytics DB, Cube, SIS.Api, Vite), how to add a
  shot, and how to re-shoot after a screen change.
- **The first shots:** the help center itself and the two BO 4183 articles' screens. 4185 and 4186 add the rest.

## Spine reach

Dev tooling (script, shot list, README)

## Proof

- [x] A run on the local stack writes both languages' images for the first shots, and they open correctly
      (attach two in Comments)
- [x] The run refuses a non-localhost base URL · vitest (pure module over the config)
- [x] The shot list's schema is checked before any browser starts · vitest

## Boundaries

- Not part of the production build or CI. It never points at a hosted environment.

## Done when

One command re-shoots every listed screen in both languages into the BackOffice images folder.

## Blocked by

[951](951-the-help-center-lists-an-areas-articles-searches-them-and-reads-one-in-the-apps-language.md)

## Comments

- 2026-11-22 (/implement-spec): Built on spec/4182-help-center (a7dbcad2), the two vitest proofs green (25 tests). **Owed:** the live run on the local stack (no local help endpoint yet — BO 4183) and two attached images; crop selectors untested until then. Run: `SIS_USER=… SIS_PASS=… npm run help-shots -- <BackOffice>/Services/SIS.Api/Help/analytics/images` (or `SIS_COOKIE`; `HELP_SHOTS_BASE`). Playwright 1.60.0 pinned dev-only. Defaults: seed user assumed curator; run stops before shooting if the contents are unusable; images folder must exist.
- 2026-11-23: **live run done** against the local stack (SIS.Api pricing2 on POS_Test, Vite :5173, `SIS_USER=ADMOP1`): 10 images (5 shots × en/ar) in `C:\Work\DMSCO\help-shots-4182` (not the BackOffice folder — the articles reference no images yet), snapshot rewritten (28 screens, f9b6deaa). Checked help-center.en/ar.png by eye: correct. Note: the local `POS` DB lacks `UaLoginEvent`/`UaSession.TerminalId`, so web login 500s there; use `POS_Test`. `Admin` is a shared account and is refused for web login.
