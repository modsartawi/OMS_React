---
status: open
spec: 441
blocked-by: 442
---

# 443 — A pricing user searches bonus buys by Status and Valid today

## What to build

The inquiry toolbar's "Active only" toggle splits into two independent criteria (spec 441):

- **Status**: four toggle chips (Activated · Planned · Tested · Deactivated), each with its label.
  Defaults to **Activated**; choosing none means every status.
- **Valid today**: a checkbox, default **on**. It sits where "Active only" was.

The default view is unchanged: Activated + valid today, i.e. the **active** bonus buys.

```ts
interface BbyListCriteria {
  bbyNumber: string
  validFrom: string   // yyyyMMdd or ''
  validTo: string     // yyyyMMdd or ''
  statuses: BbyStatusWord[]   // [] = every status; default ['activated']
  validToday: boolean         // default true
}
type BbyStatusWord = 'activated' | 'planned' | 'tested' | 'deactivated'
```

The pure params builder owns the override rules:

- **number present** → `bbyNumber` only. Status and valid-today are not sent, and both controls
  read as overridden (disabled, with a tooltip naming why).
- **either date present** → `validFrom`/`validTo` + `status`. Valid-today is not sent and reads as
  overridden.
- **otherwise** → `status` (when non-empty) + `validToday`.
- Always `activeOnly=false`. `status` is a comma list of **words** (`status=planned,tested`); a
  blank code cannot be sent.

The "Filtered" chip shows whenever the applied criteria differ from the default. Reset (and
dismissing the chip) restores it. The cap banner and the date-bounds error keep working as now.

## Spine reach

api (two new query params) · logic (criteria + builder + is-filtered) · component (toolbar, Page
default/Reset) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `buildListParams` — default criteria → `status=activated&validToday=true&activeOnly=false`;
  several statuses; empty statuses (no `status`); valid-today off; a number overrides both; dates
  replace valid-today and keep status · pure (vitest)
- [ ] `isDefaultCriteria` (or equivalent) — true only for Activated + valid today with no number and
  no dates; status order does not matter · pure (vitest)
- [ ] `tools/bby-inquiry-drive.mjs` — the toolbar sends the right `Bby/List` query for each case
  above. The chips toggle. The overridden controls disable. The chip and Reset restore the default.
  A stubbed 400 `INVALID_STATUS` shows its message. Under `ar`, the controls mirror. The old
  `activeOnly`-toggle checks are rewritten · flow (Playwright, manual-run, **stubbed**)

Plus `npm run typecheck`, `npm run lint`, `npm test`.

## Boundaries

- **Server dependency: BO-1, not filed** in BackOffice. `GET Bby/List` gains
  `status=<comma list of activated|planned|tested|deactivated>` (any case; blank = all;
  `activated` matches blank-or-whitespace) and `validToday` (bool, default false, same `@today` as
  `isActive`). An unknown word returns 400 `INVALID_STATUS`. `activeOnly` keeps its meaning and its
  default `true` for older callers. The cap applies after every filter. Build on stubbed envelopes
  until BO-1 ships; the live walk waits on it.
- `INVALID_STATUS` is shown through `apiErrorMessage`, with no special branch (it is a client bug,
  not user input).
- i18n (`bonus-buy-inquiry`, en + ar): Status control label, "Valid today" + hint + overridden
  tooltip. The chip labels reuse 442's status labels. The `search.activeOnly*` keys are removed.
- Logical Tailwind only; the chips are toggle buttons with `aria-pressed`.

## Done when

On the inquiry, a user can list e.g. Planned + Tested bonus buys valid today, or Deactivated ones
valid during a past range. A number search still finds any bonus buy. The default view and Reset are
Activated + valid today. The proofs are green against stubs.

## Blocked by

[442](442-the-bby-inquiry-badges-every-bonus-buy-status-as-the-server-reads-it.md) (the status words
and labels). Live: BO-1 (unfiled).
