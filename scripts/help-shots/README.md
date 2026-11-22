# help-shots — the help's screenshots, in English and Arabic

Shoots every screen in `shots.json` once in English and once in Arabic from the **local** app on the local seeded
analytics data, into BackOffice's `Services/SIS.Api/Help/analytics/images/` as `<name>.en.png` and `<name>.ar.png`.
The same run rewrites `src/features/help/screens.snapshot.json` from the help's table of contents (the route guard
`src/app/help-screens-snapshot.test.ts` reads it). oms 954, BackOffice spec 4182 §D/§F.

Development tooling only: not part of the build or CI, and it refuses any base URL that is not `localhost`,
`127.0.0.1` or `[::1]` — staging and production hold real stores and people.

## Start first

1. The local analytics database (seeded) and Cube.
2. SIS.Api on `:5111`, with the help endpoint (BO 4183) and the articles under `Services/SIS.Api/Help/analytics/`.
3. Vite: `npm run dev` (`:5173`, proxies `/api` to `:5111`).
4. Once per machine: `npx playwright install chromium`.

## Run

```sh
SIS_USER=<seed test user> SIS_PASS=<password> npm run help-shots -- C:/Work/DMSCO/BackOffice/Services/SIS.Api/Help/analytics/images
```

| Variable | Meaning |
|---|---|
| `SIS_USER`, `SIS_PASS` | The seed test user (a curator, so every shot's controls show). Read from the environment only — never written to the script, the shots or the output. |
| `SIS_COOKIE` | Instead of the two above: a `sis_session` cookie from a signed-in local browser. |
| `HELP_SHOTS_BASE` | The app to drive. Default `http://localhost:5173`; anything not on localhost is refused. |

Everything is checked before a browser starts: the images folder exists, the base is local, a sign-in is set, and
`shots.json` is valid (all its problems are listed at once). A failed shot is reported and the rest still run; the
run then exits 1.

The language switch is the app's own: `localStorage['oms.locale']` (`en` / `ar`) before the page loads, which the
help reads through `helpLang()`.

## Add a shot

Add an entry to `shots.json`:

```json
{ "name": "boards-editor", "route": "/analytics/board/1/edit", "crop": "[data-board-editor]",
  "steps": [{ "waitFor": "[data-board-editor]" }, { "click": "[data-add-panel]" }, { "type": { "selector": "input[name=q]", "text": "sales" } }] }
```

- `name` — lower-case words joined by dashes; the article references `images/<name>.en.png`.
- `route` — an app path starting with `/` (ids from the local seed).
- `crop` — the element to shoot, **or** `"fullPage": true`, never both.
- `steps` — optional, in order: `{ "click": sel }`, `{ "type": { "selector": sel, "text": "…" } }`, `{ "waitFor": sel }`.
- `viewport` — optional, default `{ "width": 1440, "height": 900 }`.

Prefer `data-*` selectors over classes: they survive a restyle.

## Re-shoot after a screen change

Run the same command. Every listed image is overwritten in both languages, and the snapshot is rewritten; commit the
images in BackOffice and the snapshot here (and run `npm test` — a route the help names that no longer exists fails).
