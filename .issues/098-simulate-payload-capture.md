---
type: wayfinder-ticket
wayfinder: task
map: 097
status: done
blocked-by: —
---

# 098 — Capture live Simulate payloads

## Question

Nothing to decide — this unblocks every decision after it. **What does a real
`POST Pricing/Simulate` response actually look like**, across the baskets this screen exists to run?

078 did this for Document Details and its five payloads invalidated a rail designed on a synthetic
one. Design here starts from captured evidence for the same reason.

Capture and file, under `assets/098-simulate-payloads/`, one JSON per run with a `_capture` block
recording the request that produced it (as 078's files do). Target corpus — at minimum:

1. **A plain multi-line basket** — several lines, no promotion, `includePricingElements: false`.
2. **A basket with a fired bonus buy** — the buy→get case `SimPromoBlocks` renders, so the promo
   surface is designed against real `conditionKey` / prerequisite data rather than the harness.
3. **A basket with a near-miss** — a bonus buy that did *not* fire, feeding `promoView`'s `missed`
   (the surface [104](104-sim-results-line-anatomy.md)/[103](103-sim-deep-layers-placement.md) argue over).
4. **A basket with an error and a warning line** — `pricingStatus` `E` and `W` on separate lines in
   one HTTP 200, which is what the count banner and the per-line status dots exist for.
5. **A run with `includePricingElements: true`** — the pricing-procedure trace `SimBonusBuyPanel`
   renders, so its real row count and column widths are known.
6. **Manual conditions supplied**, header and item level, so the request half is evidenced too.

Then answer, from the files rather than from `src/core/models/simulation.ts`:

- Which fields are **populated on every run**, which on none, and which only sometimes — the
  emptiness picture 083's D-5 needed.
- How **many** conditions a typical line carries before and after `aggregateConditions`, and how many
  are statistical. This is the number that decides whether the detail region can be compressed.
- Row counts: lines, blocks, missed, pricing elements. The prototype's density is a fiction until
  these are real numbers.
- Any **contradiction or surprise** (078 found negative discounts, a null address, an unbound flag).
  File findings even when they are data bugs rather than UI ones.

Needs SIS.Api on `:5111` and a valid pricing-enabled login. Redact anything that identifies a real
customer, and say so in each file's `_capture` block.

**Blocked on nothing.** If SIS.Api cannot be reached this session, that is the finding — record it,
leave the ticket open, and do not substitute a hand-written payload.

## Progress — 2026-07-25, harness built, waiting on the backend

**SIS.Api is not up.** `POST http://localhost:5111/Auth/Login` fails to connect; nothing is listening
on :5111 (only Vite on :5173 / :5199). No payload captured, and none invented.

**Two further blockers found while probing**, both owner-side:

- **Login carries a TOTP step** (`Auth/UaLogin` → `Auth/UaVerifyTotp`), so the capture cannot
  authenticate headlessly. The session must come from a browser login — the `sis_session` cookie
  value, pasted in.
- **The corpus needs real SKUs.** A bonus buy that fires, the same one one unit short, and a line
  that prices `E` are all live-data facts. `Bby/*` is not built on SIS.Api, so they cannot be
  discovered from this repo's endpoints.

**The capture is now one command.** Built this session, AFK from the moment those three arrive:

- [`tools/sim-payload-capture.mjs`](../tools/sim-payload-capture.mjs) — posts each basket straight to
  SIS.Api (`/Pricing/Simulate`, no `/api` prefix — that is the Vite proxy only), writes one
  pretty-printed file per run to `.issues/assets/098-simulate-payloads/` with the `_capture` block
  078's files use, then prints the census this ticket asks for: lines, conditions per line,
  statistical per line, `pricingStatus` tally, applied/potential bonus-buy counts, pricing elements
  per line, and the empty-top-level-key list feeding the emptiness picture.
- [`tools/sim-capture-baskets.json`](../tools/sim-capture-baskets.json) — the six-basket corpus,
  header defaults mirroring `SimHeaderForm.defaultHeader()` (`P001` / `1000` / `20`), materials left
  as `TODO` placeholders. The tool refuses to run while a `TODO` remains unless `--allow-todo`.

Run: `SIS_COOKIE=<value> node tools/sim-payload-capture.mjs`.

**Owner ruling on how it gets unblocked (2026-07-25):** the owner brings SIS.Api up (`http` launch
profile → :5111), pastes the `sis_session` cookie, and supplies the material numbers. Ticket stays
open until those land.

## Progress — 2026-07-25, two real payloads filed, harness still unauthenticated

SIS.Api **is now up** on :5111 (swagger answers 200). The session value supplied does **not**
authenticate: `GET Auth/Me` with `Cookie: sis_session=<value>` + `X-Web-Client: 1` returns
`{"authenticated": false}`, so `Pricing/*` 401s and the harness cannot run. The value looks like a
*session id* rather than the cookie's token — the two are different strings.

Two payloads arrived **owner-supplied** instead, and they are real, so they open the corpus:

- [`02-fired-bonus-buy-owner-supplied.json`](assets/098-simulate-payloads/02-fired-bonus-buy-owner-supplied.json)
  — one line, material `200706` ×2, BBY `000100000131` "70% 2nd PCS" (`ZB03`) fired, −63.88.
- [`03-applied-and-potential-owner-supplied.json`](assets/098-simulate-payloads/03-applied-and-potential-owner-supplied.json)
  — two lines (`200706` ×2 promoted, `200382` ×1 plain), the same fired BBY **plus** a potential one,
  `000100000132` "2 PC for 29.95 SR" (`ZB01`, would save 26.04).

Neither carries its request half; the header determination fields for both runs are unknown. Both
were run with `includeConditions: true` and `includePricingElements: false`.

**Known promo material, for the remaining baskets:** `200706` (BIODERMA ATODERM CREAM PUMP 200 ML)
fires `000100000131` at quantity 2 — so quantity 1 is the near-miss run.
`tools/sim-capture-baskets.json` baskets 02, 03 and 05 are filled with it.

### The finding that outranks the ticket

**A missed promotion has no prerequisite data behind it.** `potentialBonusBuys[0].prerequisites` is
`[]` and `skipReason` is `null` on live data. `promo-view.ts`'s `buildMissed` reads
`prereqs.find((q) => !q.isMet)`, so it yields `prereq: null` — the "required 3, found 2" line, the
whole reason the missed surface was designed, **renders nothing**. A missed card can carry only its
description, its kind, and `wouldSave`.

Worse for placement: a potential bonus buy carries **no item linkage at all** — no
`affectedItemNumbers`, no material, no grouping. A missed promo therefore **cannot be attached to a
result line**; it can only live in a screen-level region.
[104](104-sim-results-line-anatomy.md) and [103](103-sim-deep-layers-placement.md) must design
around this, not around the model's optimistic `PrereqStatus[]`.

### Density facts (the numbers the prototype needs)

- **Raw conditions per line: 4 on a promoted line, 2 on a plain one.** Zero statistical rows on
  either. The detail region's aggregated `ConditionCard` list is a **two-to-three card** surface in
  the common case, not the dense list its four-tile framing implies.
- A quantity-2 promotion stamps **one condition row per piece** — two identical `ZB03` rows differing
  only by `bbyItemIndex` (0, 1), sharing one `conditionKey`. So `aggregateConditions` collapses 4
  rows → 3 cards, and `promoView`'s distinct-`conditionKey` count reads **1 firing**, correctly.
- `appliedBonusBuys`: 1. `potentialBonusBuys`: 0 then 1. `pricingElements`: **empty everywhere** —
  neither run asked for them, so `SimBonusBuyPanel`'s real row count is still unknown.

### Contradictions and surprises

1. **`remainingUsage` is typed `number` but arrives `null`** — on both `AppliedBonusBuy` and
   `PotentialBonusBuy`. A model bug, not a UI one.
2. **The 044 projection is absent on live data**, as expected: no `applications[]`, no
   `discountKind`. Live traffic takes `promoView`'s **degraded** path today, so the arrangement is
   designed against the degraded shape and must merely tolerate the split one.
3. **Identical line, different rounding across runs.** `200706` ×2 prices `taxValue 17.80 /
   netTotal 136.44` alone, but `17.79 / 136.43` when a second line is present. Same inputs, different
   pennies — a pricing-engine artefact worth reporting upstream; the screen must not present line
   money as reconcilable to the header by naive addition.
4. **`conditionKey` is per-run, not stable** — the same promotion on the same basket returned
   `eOHHNXyqgUyrqmFDPowA` and `1BlQpmg_BUyO8dT5iNF9` on two runs. Fine as an in-run grouping key,
   never a cross-run identity.
5. **`validFrom` / `validTo` are SAP `YYYYMMDD` strings** (`"20260719"`), not ISO dates, and the
   `*Time` companions are empty. Any date a missed-promo surface shows needs formatting.
6. **The wire carries a whole insurance/deductible dimension the client model omits** — items carry
   `payment`, `receivableValue`, `maxPayerShare`, `patientShare`, `calculatedDeductible`,
   `deductibleValue`, `isDeleted`; the header carries `deductibleTotalValue` plus its own (empty)
   `conditions` and `pricingElements`; the result carries `analysis`, `completeAnalysis`,
   `insuranceSummary` (all `null` here). All zero/null on these runs. The arrangement ignores them —
   but their existence should be recorded before someone reads the model as the contract.
7. `PotentialBonusBuy` on the wire also carries `bbyProfile`, `linkCategoryBuy` / `linkCategoryGet`,
   `condTargetType`, `limitNumber`, `includes` / `excludes`, `isStackable`, `allowNestedStacking`,
   `stackingExcludes`, `score`, `originFilter`, `priceListType`, `loyGroups`, `loyTiers` — none
   modelled client-side. `isStackable` in particular is a fact a missed card could show now that
   prerequisites cannot be.

## Answer

**Captured.** All six target baskets, plus four extra runs the corpus needed, live under
[`assets/098-simulate-payloads/`](assets/098-simulate-payloads/) — eleven files, each with its
`_capture` block. Nothing is synthetic; nothing is redacted (a Simulate exchange carries materials,
org determination, quantities and money only — no customer-identifying field exists on it).

| File | Lines | Raw conditions / line | Statistical | `pricingStatus` | Applied | Potential | Elements / line |
|---|---|---|---|---|---|---|---|
| `01-plain-multiline` (promo **off**) | 3 | 2, 2, 2 | 0 | ok ×3 | 0 | 0 | 0 |
| `02-fired-bonus-buy` | 1 | 4 | 0 | ok | 1 | 0 | 0 |
| `03-near-miss` | 1 | 2 | 0 | ok | 0 | 1 | 0 |
| `04a-unknown-material` | — | HTTP **400** `INVALID_UOM` | | | | | |
| `04b-no-price` | 2 | 1, 2 | 0 | **W**, ok | 0 | 1 | 0 |
| `05-pricing-elements` | 2 | 4, 4 | 0 | ok ×2 | 1 | 0 | **7, 7** |
| `06-manual-conditions` | 2 | 5, 5 | 0 | ok ×2 | 2 | 0 | 0 |
| `06a-manual-header-rejected` | — | HTTP **400** `INVALID_CONDITION_ITEM_LEVEL` | | | | | |

Plus the three owner-supplied payloads (`*-owner-supplied.json`) that opened the corpus.

**How to reproduce:** `SIS_USER=<id> SIS_PASS=<pw> node tools/sim-payload-capture.mjs` — the harness
mints its own session via `Auth/Login` and never stores a credential in the repo.

### The density picture — the numbers the prototype needs

- **A line carries 1–5 raw conditions. Never more.** Plain line 2 (`VKP0` + `MWST`), promoted line 4,
  promoted **and** manually adjusted line 5, a line that failed to price 1.
- **Zero statistical rows on every run.** The `isStatistics` toggle in `SimItemDetail` has, on this
  data, nothing to hide and nothing to reveal.
- **`aggregateConditions` therefore collapses 4 rows → 3 cards at most.** The detail region is a
  **two-to-three card** surface, not the dense list its four-tile framing implies. This is the number
  [103](103-sim-deep-layers-placement.md) was waiting for: the deepest layer is small.
- **Pricing elements: exactly 7 rows per line**, of which **3 are subtotals** (`isSubtotal: true`,
  blank `conditionType`) — Gross Value, Net Total + Tax, Receivable. `SimBonusBuyPanel`'s `h-72`
  AG Grid is sized for a table roughly twice the height of its content.
- Applied bonus buys 0–2, potential 0–1, lines 1–3. Nothing on this screen is a big grid.

### Emptiness — which fields never populate

`analysis`, `completeAnalysis`, `insuranceSummary` are **`null` on every run**. The header's own
`conditions` and `pricingElements` arrays are **empty on every run** (conditions live on the lines).
Every insurance/deductible number — `payment`, `receivableValue` (= `netTotal`), `maxPayerShare`,
`patientShare`, `calculatedDeductible`, `deductibleValue`, `deductibleTotalValue` — is **0 on every
run**, and `isDeleted` is always `false`. `offerId` is always `""`. `salesDiscount` and
`headerDiscount` are always 0; only `promotionDiscount` ever moves.

### The findings that outrank the ticket

1. **A missed promotion has no prerequisite data.** `potentialBonusBuys[].prerequisites` is `[]` and
   `skipReason` is `null` on every capture. `promo-view.ts`'s `buildMissed` reads
   `prereqs.find((q) => !q.isMet)` and therefore always yields `prereq: null` — the "required 3,
   found 2" line, the reason the missed surface exists, **renders nothing**. A missed card can carry
   only description, kind, and `wouldSave`.
2. **A potential bonus buy carries no item linkage** — no `affectedItemNumbers`, no material, no
   grouping. A missed promo **cannot be attached to a result line**; it can only live in a
   screen-level region. [104](104-sim-results-line-anatomy.md) and
   [103](103-sim-deep-layers-placement.md) must design around this.
3. **Turning promotion off blanks the missed surface too.** `01-plain-multiline`
   (`isPromotionApplicable: false`) returns `potentialBonusBuys: []` — not just no applied ones. So
   "promo off" is not "show me what I'd be missing"; it is a total blackout.
4. **One applied bonus buy can span several lines.** `05-pricing-elements` returns a single
   `000100000131` with `affectedItemNumbers: [20, 10]` — two different materials (`200706`, `200710`)
   under one promotion, one summed `totalDiscountValue`. A promotion is **not** a per-line ornament;
   the arrangement needs a cross-line block. (Both materials are members of the same offer.)
5. **A per-line `E` was never produced.** Every failure this session surfaced as an HTTP **400
   business envelope** that kills the whole run — `INVALID_UOM` for an unknown material,
   `INVALID_CONDITION_ITEM_LEVEL`, "Pricing procedure determination could not resolve a procedure"
   for a bad distribution channel. Only **`W`** rides a 200, twice, both from a missing base price:
   `[070] Mandatory condition 'VKP0' (Basic Price) not found at step 5` (material `COUP01`, and any
   material priced at a date outside its validity), and `[071] … has zero value at step 5` (quantity
   0). **So the E/W count banner is, on this evidence, a W-only banner** — the red half of the design
   is unproven. Worth one line in the spec rather than a red dot nobody will see.
6. **Manual conditions are item-level only, and the header-level type is unknown.** `ZB01` is the
   one type the procedure accepts (`RA00`, `ZDIS`, `K007`, `HA00`, `RB00` all 400 with "not found in
   pricing procedure"), and passing it with `itemNumber: 0` is rejected. `SimManualConditions` offers
   a free-text condition type and an item number defaulting to `0` — **its default input is invalid**.
   A manual row lands inline in the line's own `conditions` with `conditionOrigin: 'M'`.
7. **A negative quantity returns HTTP 500** (`Internal Server Error`, not an envelope), and
   **quantity 99999 hangs** — a request left running for minutes without responding. Both are backend
   defects, filed here as 078's precedent instructs. The screen has no client-side quantity guard.
8. **An invalid plant is silently accepted.** `plant: 'ZZZZ'` prices normally. Distribution channel
   *is* validated (400). So the header form's fields are not uniformly load-bearing.
9. **The 044 projection is absent on live data** — no `applications[]`, no `discountKind`. Live
   traffic takes `promoView`'s **degraded** path today, so the arrangement is designed against the
   degraded shape and must merely tolerate the split one.
10. **Identical line, different pennies.** `200706` ×2 prices `taxValue 17.80 / netTotal 136.44`
    alone but `17.79 / 136.43` beside a second line. Line money does not reconcile to the header by
    naive addition, and the screen must not imply that it does.
11. **A manual `5%` produced a flat `-5.00`** on a 62.52 base (`06-manual-conditions`, item 10) —
    5% of the base would be −3.13. Whether the rate unit is being ignored or applied per unit is
    unresolved; flagged as an engine question, not a UI one.

### Model corrections (client-side, for whoever builds the spec)

- `remainingUsage` is typed `number` on both `AppliedBonusBuy` and `PotentialBonusBuy` but arrives
  **`null`** every time.
- `SimulationResultItem` omits `payment`, `receivableValue`, `maxPayerShare`, `patientShare`,
  `calculatedDeductible`, `deductibleValue`, `isDeleted`; `SimulationResultHeader` omits
  `deductibleTotalValue`, `conditions`, `pricingElements`; `SimulationResult` omits `analysis`,
  `completeAnalysis`, `insuranceSummary`. All zero/null today — recorded so nobody reads the model as
  the contract.
- `PotentialBonusBuy` also carries `bbyProfile`, `linkCategoryBuy`/`linkCategoryGet`,
  `condTargetType`, `limitNumber`, `includes`/`excludes`, `isStackable`, `allowNestedStacking`,
  `stackingExcludes`, `score`, `originFilter`, `priceListType`, `loyGroups`, `loyTiers` — unmodelled.
  **`isStackable` is a fact a missed card could show now that prerequisites cannot be.**
- `validFrom`/`validTo` are SAP `YYYYMMDD` strings (`"20260719"`), not ISO; the `*Time` companions
  are empty. `bbyStatus` is `""` when the promotion fired and `"2"` when it was merely potential.
- `conditionKey` is **per-run**, not stable across runs — an in-run grouping key only.
- The evidenced request sends `pricingDate` as a midnight **datetime** (`2026-07-25T00:00:00`);
  `SimHeaderForm` builds a date-only string. Both may work; only the datetime form is evidenced.

### Test data, for every later ticket

`200706` (BIODERMA ATODERM CREAM PUMP 200 ML) and `200710` both sit on BBY `000100000131`
"70% 2nd PCS" (`ZB03`, −35%), which fires at quantity 2 — quantity 1 is the near-miss. `200382`
(AXE DEO SPRAY FIFA EDITION 150 ML) sits on BBY `000100000132` "2 PC for 29.95 SR" (`ZB01`), also at
quantity 2. `COUP01` prices as `W` (no base price); `32423333` 400s. Manual condition type: `ZB01`,
item level only. All under `P001` / `1000` / `20`.
