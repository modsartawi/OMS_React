---
status: done
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

- **number present** → `bbyNumber` (+ any dates given, still ANDed; amended in the build). Status and valid-today are not sent, and both controls
  read as overridden (disabled, with a tooltip naming why).
- **either date present** → `validFrom`/`validTo` + `status`. Valid-today is not sent and reads as
  overridden.
- **otherwise** → `status` (when non-empty) + `validToday`.
- Always `activeOnly=false`. `status` is a list of **words**, sent as a repeated key
  (`status=planned&status=tested`, how `@/core/api` sends an array); a blank code cannot be sent.

The "Filtered" chip shows whenever the applied criteria differ from the default. Reset (and
dismissing the chip) restores it. The cap banner and the date-bounds error keep working as now.

## Spine reach

api (two new query params) · logic (criteria + builder + is-filtered) · component (toolbar, Page
default/Reset) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `buildListParams` — default criteria → `status=activated&validToday=true&activeOnly=false`;
  several statuses; empty statuses (no `status`); valid-today off; a number overrides both; dates
  replace valid-today and keep status · pure (vitest)
- [x] `isDefaultCriteria` (or equivalent) — true only for Activated + valid today with no number and
  no dates; status order does not matter · pure (vitest)
- [x] `tools/bby-inquiry-drive.mjs` — the toolbar sends the right `Bby/List` query for each case
  above. The chips toggle. The overridden controls disable. The chip and Reset restore the default.
  A stubbed 400 `INVALID_STATUS` shows its message. ~~Under `ar`, the controls mirror~~ (not possible: no ar `bonus-buy-inquiry` namespace, see Comments). The old
  `activeOnly`-toggle checks are rewritten · flow (Playwright, manual-run, **stubbed**)

Plus `npm run typecheck`, `npm run lint`, `npm test`.

## Boundaries

- **Server dependency: BO-1, not filed** in BackOffice. `GET Bby/List` gains
  `status=<word>` repeated, each `activated|planned|tested|deactivated` (any case; none = all;
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

## Comments

**Done 2026-10-08.**

- **Builder:**
  - `buildListParams` takes `{ bbyNumber, validFrom, validTo, statuses, validToday }`.
  - The override rules live once, in the pure `searchOverrides` (the builder applies it, the toolbar
    disables what it names).
  - `isDefaultCriteria` compares against `DEFAULT_CRITERIA` and drives the Filtered chip.
  - The Page keeps the **applied criteria** (not params). The `?bby=` link seeds
    `DEFAULT_CRITERIA` + the number.
- **Two amendments, made in the build** (spec 441 and this ticket edited to match):
  - `status` travels as a **repeated key** (`status=planned&status=tested`), not a comma list,
    because `@/core/api`'s `buildQuery` sends every array that way for ASP.NET binding. BO-1 must
    bind `string[] status`.
  - A **number + dates** still AND: a number drops only status and valid today. That was the
    grilling's decision 3, and it is how the screen behaved before. The ticket's "bbyNumber only"
    overstated it. CONTEXT "Active / current" was amended to match.
- **UI:**
  - Status toggle chips with `aria-pressed` and a `useId` group label.
  - Overridden chips read as **off** (like the overridden checkbox), with a tooltip on each chip
    as well as on the group.
  - "Valid today" replaces "Active only" in place.
- **Copy, not named in the ticket:**
  - The date labels became "Valid during — from/to" ("active" now means Activated + valid today).
  - The subtitle names status.
  - The empty hint is now "No Bonus Buys match this search."
- **Proof:**
  - vitest 4162 (list-params 12 cases); typecheck, lint and build green.
  - `bby-inquiry-drive` 103/105, all 14 new 443 checks green. The 2 failures (menu leaf) fail
    identically on HEAD before 442.
  - `bby-link-drive` 11/11.
  - Everything is **stubbed**: BO-1 is unbuilt and unfiled.
- **ar:** no ar `bonus-buy-inquiry` namespace exists, so there are no ar keys and no ar mirroring
  check. This is the same as 442; it needs a follow-up if the Arabic rollout reaches this screen.
- **Reviews:**
  - Standards: CLEAN with MINOR smells. The override duplication, the hard-coded default and the
    fixed id were fixed.
  - Spec: no blocking findings. The chip pressed-state, the tooltip, the stale comment and the
    order test were fixed.
  - `/code-review`: no crash bugs. The number + dates behaviour was resolved as above.
  - Left as is: `Partial` criteria on the builder (used by the tests), and the `yyyyMMdd` string
    dates (pre-existing).
