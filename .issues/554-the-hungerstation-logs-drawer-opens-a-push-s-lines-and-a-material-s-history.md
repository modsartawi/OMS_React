---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3028-hungerstation-follow-up-on-oms-react-spec.md
blocked-by: 551 (live: BackOffice 3033)
---

# 554 — The HungerStation logs drawer opens a push's lines, and a store shows a material's history

## What to build

On the HungerStation Stores page (551). This is the follow-up the WPF Last Logs / Log Items windows give
today, shaped like the Deliverect logs drawer (480, 550).

- **Logs drawer.** From a store row, the store's pushes, newest first and at most 15 days back: type (full /
  delta), start, end, status, rows sent and error. A failed push is highlighted.
- **Push lines.** A push opens its lines: material number, active, quantity, maximum sales quantity, price
  (3 decimals with `currencyKey`) and sent at. Filter by material number (exact match), paged (`skip`/`take`,
  `total`). A `null` value renders blank, because the push didn't send it, not as zero.
  - DHS-00015 (the push is gone or older than 15 days) says in words that push detail is kept 15 days, never
    an empty table that reads as "nothing was sent".
- **Material history.** From a store row, look up one material: every line sent for it at that store in the
  15 days, newest first (at most 200, with a notice when capped), each with its push type and status. This
  answers "what stock did HungerStation last get for 601624 at 1234?".
- A removed store's history stays readable from wherever the store code is known (e.g. the orders monitor's
  link). DHS-00007 appears only when the code has no store and no logs.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3028-hungerstation-web-door-contract.md`, sections `GET
…/Sync/{storeCode}/Logs`, `…/Logs/{logId}/Lines` and `…/Lines?material=`.

## Spine reach

UI → app (BackOffice doors, stubbed until 557)

## Proof (→ `tdd` red-green cycles)

- [x] helpers: the line labels (null vs zero, inactive marked), the 15-day wording, the 200-cap notice (vitest)
- [x] `tools/hungerstation-stores-drive.mjs`: new sections, against stubs emitting **exactly** the contract's
  fields, LTR and RTL:
  - open the logs, open a push's lines, filter by material, page;
  - DHS-00015's wording;
  - material history from a store row, including the cap notice.
- [x] typecheck, lint, test green

## Boundaries

oms-react only. Same gate as the Stores page (`canManageStores`). No new menu entry. Reuse the side-sheet
frame the Deliverect drawers use; don't copy it an eleventh time.

## Done when

The helpers and the drive are green; the live check rides 557.

## Blocked by

- [551](551-an-hq-user-lists-onboards-and-edits-hungerstation-stores-with-a-reason.md)

(live: BackOffice 3033)

## Open questions

- **Material history before its index exists (owner, BackOffice 3028).** In production the
  material-history read is only a seek after the purge worker (BackOffice 3034) clears the backlog and index
  script 007 part 2 is built. Until then, each lookup reads about 118M rows. There are two options:
  - hide the material-history entry behind a per-environment switch until the owner says the index is in;
  - rely on BackOffice refusing the door while the index is missing (a BackOffice change, not yet made).

  Build the entry point either way; the owner's answer decides only whether it shows.

## Comments

**Done 2026-10-24** (branch `ticket/554`). Proof: vitest `features/hungerstation/stores/sync-history.test.ts`
(the three door paths; `linesQuery`; `readLine` — every value sent, a `null` stays blank, a sent 0 stays 0,
inactive marked, the price at 3 decimals with `currencyKey`; `pushReading`; `linesNotice`; DHS-00015 /
DHS-00007 mapped; the 15-day wording and the 200-cap notice in en + ar; the drawer ⇄ URL mapping) and
`i18n-keys.test.ts`; typecheck + lint (4 gates) + `npm test` (6255) green; `tools/hungerstation-stores-drive.mjs`
**302/302 against STUBS** (553's 216 plus sections 15–18, LTR and RTL; every fixture emits exactly the
contract's fields); `tools/deliverect-stores-drive.mjs` **230/230** after the re-point. 🚩 Not driven against a
live SIS.Api — the live check is 557.

What landed:
- `stores/sync-history.ts` (pure) + `storesApi.syncLogs` / `syncLines` / `materialLines` and their query keys.
- `SyncLogsDrawer`, `PushLines` (opens in place, Back returns focus), `MaterialHistoryDrawer`, and `PushCells`
  (push type, push status, the four line value cells) shared by the three tables. Row actions Logs and Material
  history (`act.onLogs` / `act.onMaterial`).
- Core: the drawers sit on 556's `core/ui/SideSheet`. Their header (eyebrow, title, hint, close) graduated to
  `core/ui/SideSheetHeader.tsx`, and the plain-table cell classes plus the body class to `core/ui/sheet-table.ts`.
  Deliverect's three stores drawers (logs, material history, status history) are re-pointed at all three, and
  `deliverect/stores/table-cells.ts` is gone.
- As the wave's last landing, `src/app/HungerStationPlaceholderPage.tsx` and its `placeholder.*` keys (en + ar)
  are deleted, with the i18n check for them; drive section 1 now opens the real Materials and Orders pages.

Judgement calls (overrulable):
1. **The drawers live in the URL** (`?logs=<code>`, `?history=<code>`). This is how a removed store's history
   stays readable "from wherever the store code is known": the orders monitor (or any link) can point at
   `/hungerstation/stores?logs=1234`. The drawer takes a store code, not a row; off the list, its title is the
   code alone. Opening and closing replaces the history entry, as the filters do.
2. **The logs read asks `take=500`** (the door's max), not the default 50: 15 days of half-hourly deltas is
   ~720 pushes, and the drawer should reach as far back as the door allows.
3. **A value not sent is an empty cell with a title** ("Not sent by this push"), never a dash or a 0.
4. **The price is one machine value** — `18.950 SAR`, isolated once — rather than a separate currency column.
5. **DHS-00007 and DHS-00015 read in words** (`role="status"`, no danger banner); any other refusal shows the
   generic banner with the server's message and code.
6. **A failed push's line is red in the material history; an inactive line is amber** in both line tables.
7. **The header is a separate core component**, not a second frame: 556's `SideSheet` stays the only frame, and
   a drawer with more in its header (the raw views) keeps drawing its own.

Open for the owner:
- 🚩 **Material history before its index (BackOffice 3028), still open.** The entry point is built and shown.
  No per-environment switch exists in this repo and none was added: hiding it until index script 007 part 2 is
  in (or BackOffice refusing the door while the index is missing) is the owner's call.
- The Arabic copy is unread by a native eye (the drive's RTL pass is direction only).
