---
status: open
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

- [ ] helpers: the line labels (null vs zero, inactive marked), the 15-day wording, the 200-cap notice (vitest)
- [ ] `tools/hungerstation-stores-drive.mjs`: new sections, against stubs emitting **exactly** the contract's
  fields, LTR and RTL:
  - open the logs, open a push's lines, filter by material, page;
  - DHS-00015's wording;
  - material history from a store row, including the cap notice.
- [ ] typecheck, lint, test green

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
