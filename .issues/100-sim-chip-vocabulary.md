---
type: wayfinder-ticket
wayfinder: grilling
map: 097
status: done
blocked-by: 098, 099
---

# 100 — The chip vocabulary: what earns a chip, and what a chip may never be

## Question

"Nice chips" is the ask, and a chip is the densest thing this design system has: a label, sometimes a
value, sometimes a colour, in one line-height. Used without a rule it becomes decoration — a screen
where everything is a chip has the same problem as a screen where everything is a card.

Settle the vocabulary **before** the whole-screen prototype draws with it:

1. **What earns a chip.** Candidates across the screen: the collapsed run parameters (plant, sales
   org, channel, date, promo on/off, pricing-elements on/off), a line's `pricingStatus`, a line's
   promo kind + role (today's 046 column), a condition type, a loyalty tier, the currency, the
   calc-time. State the test — a chip is a *settled fact short enough to read without a label*, or
   whatever test survives the grilling — and then apply it to every candidate rather than judging
   them one at a time.
2. **The chip's anatomy, and how many kinds exist.** Bare label · label+value · with a leading dot ·
   removable · interactive (opens the form). Each kind an operator has to learn is a cost; 083 got to
   two (pill, tag) and said why. Name the smallest set that covers the screen.
3. **What colour on a chip means.** 082 shipped `severity.ts` with `ok/go/warn/bad/mute` and the
   077 ruling that **hue is reserved for severity**. So a run-parameter chip is neutral, and a
   `pricingStatus` chip is severity — but where does the *promo* chip sit, which today spends hue as
   an identity distinguisher (kind and role)? Rule it, and if the answer needs a token that does not
   exist, state the need for the spec rather than minting a value.
4. **What a chip may never be.** An editable field, a button that mutates, a container for a number
   the analyst must compare against another number (tabular figures need a column, not a chip), or a
   truncated value — a chip that ellipsises has lied about being a settled fact.
5. **The interactive chip's affordance.** The input chip bar's chips expand the form; nothing else
   on the screen should look identical and do nothing.

Ground every ruling in real values from [098](098-simulate-payload-capture.md) — a chip vocabulary
written against field *names* will discover on live data that half its chips are 40 characters long.
Consume [099](099-sim-region-question-inventory.md)'s glance-vs-study split: only glance values are
chip candidates at all.

## Answer

**Ruled.** Owner grilling session, 2026-07-25, against 098's eleven captures and 099's approved
Arrangement D. Seven decisions; **no new token is needed** — every ruling resolves to the shipped
`core/ui/severity.ts` families plus `bg-muted`.

One fact the ticket did not know, found before asking anything: **sub-question 3 was already answered
in code.** `src/features/pricing/simulation/promo-kind.ts` records that ticket 088 retired the
per-kind colour map under spec 082 D-13, and every kind chip already renders on
`bg-muted text-muted-foreground` with a glyph carrying the meaning. Hue is off promo identity today;
this ticket confirms that survives the rework rather than re-litigating it.

### 1 — The test

> A chip is a **settled fact**: it does not change while you read it, it fits one line-height
> **untruncated**, and it reads alone **or** carries a tiny uppercase key when the bare value would
> be ambiguous.

The ticket proposed "short enough to read without a label", which its own approved prototype fails —
099 draws `[PLANT P001]`, and `P001` alone means nothing. The keyed form is admitted deliberately,
not tolerated.

### 2 — The anatomy: two kinds, one new component

| Kind | Form | Colour |
|---|---|---|
| **Neutral chip** | `bg-muted text-muted-foreground`, optional uppercase key | none, ever |
| **Severity** | 082's shipped `core/ui/StatusBadge` — *not a new component* | severity only |

**Two casualties in the 099 prototype**, both to be corrected when [101](101-sim-screen-device-prototype.md)
redraws it:

- **The primary-tinted `.chip.on`** (`Promotion on`) is retired. "Promotion is switched on" is an
  input value, not a severity; tinting it spends hue as an on/off distinguisher — precisely what 088
  stripped off promo kinds. It becomes the keyed neutral chip `PROMO on` / `PROMO off`.
- **The dashed `.chip.ghost`** is retired as a distinct form. A third shape to learn buys nothing the
  `○` glyph and the words do not already carry.

### 3 — The interactive affordance lives on the region, never the chip

**The run strip is one hover/click target** that expands back to the form, anchored by a visible
`Edit ▾` control for discoverability. An individual chip has **no hover state, no cursor change, and
is never a button** — anywhere on this screen. That is what makes "a chip is a readout" enforceable:
the kind chip on a result line cannot be mistaken for something that acts, because nothing that looks
like it acts.

### 4 — Every candidate, judged by the test

| Candidate | Verdict | Why |
|---|---|---|
| `plant` · `salesOrganization` · `distributionChannel` · `pricingDate` | **keyed chip** | bounded codes, settled per run |
| promotion on/off | **keyed chip, both states** | 098 finding 3 — promo-off blacks out the *whole* rail, so a blacked-out rail must never read as "nothing fired" |
| `documentPricingProcedureKey` · `loyGroups` · `loyTier` | **keyed chip only when set** | 083 D-3: no value ⇒ no chip, not a muted one. A stray procedure key silently rewriting the procedure is exactly what makes a run inexplicable — set, it must announce itself |
| pricing elements on | **keyed chip only when on** | off by default and changes no price |
| `pricingStatus` = ok | **no mark at all** | see below |
| `pricingStatus` = `W` | **`StatusBadge sev="warn"`** | the only evidenced 200-borne failure |
| `pricingStatus` = `E` | **coded, unproven** — one spec line | 098 finding 5: never produced on live data |
| promo kind (`% percent`, `＋ free`, …) | **neutral chip + glyph** | already ruled, 088 / `promo-kind.ts` |
| promo role (buy / get / buy+get) | **neutral chip** | identity, not severity — same ruling |
| condition type rows (`VKP0`, `ZB03`, `MWST`) | **not chips — a list** | tabular, read down a column |
| Net Total · discounts · tax · `wouldSave` · `totalDiscountValue` | **never a chip** | figures compared against other figures need decimal alignment |
| currency (`SAR`) | **never a chip** | a unit, glued to its number |
| calc time (ms) | **never a chip** | a measurement compared run to run |
| material / promotion descriptions | **never a chip** | server free text — 098's `BIODERMA ATODERM CREAM PUMP 200 ML` is 34 characters |

**The ordinary run strip is therefore five chips** — `PLANT P001` · `ORG 1000` · `CHAN 20` ·
`25 Jul 2026` · `PROMO on` — rising to eight only when the test levers are in play.

**On `pricingStatus`, 083's rule transfers wholesale.** A healthy line carries no status mark of any
kind. On 098's evidence a results grid is 1–3 lines of `ok` and occasionally one `W`, so a dot column
would spend colour on "nothing is wrong" three times to surface the one case that matters — and would
quietly re-invent the E/W count banner 099 retired. Silence is the healthy state; the eye lands only
on the exception.

### 5 — What a chip may never be

1. **Editable**, or a button that mutates. (Settled absolutely by decision 3.)
2. **A money figure.** `−63.88` and `would save 26.04` are compared run to run; they belong in a
   right-aligned tabular column or a weighted readout — which is what Arrangement D's promo cards
   already do. The 099 prototype's Arrangement C, which put the saving on a chip, is not the approved
   arrangement and this rule does not disturb D.
3. **Server free text.** Chip content is drawn from a **bounded domain** — a code, a formatted date,
   or a fixed enum label. Truncation is then impossible *by construction*, with no character cap to
   invent (the map forbids inventing numbers the owner did not set).
4. **Truncated.** Follows from 3: a chip that ellipsises has lied about being a settled fact.

### The hue budget for the whole screen: two

**`success` on a fired promotion, `attention` on a `W` line. Nothing else on the screen is coloured.**

A fired promotion reads as `ok` and this is legitimate severity use, not identity use: 099 ruled the
first read of this screen is *"did the promotion fire?"*, which makes the fire the successful outcome
the analyst came to confirm. **A near-miss is not `warn`** — it is not a problem and demands no
action; it stays neutral, its verdict carried by the `○` glyph and its words. Amber would promise a
human must act, and nobody must.

This also gives `success` and `attention` their first and only constituencies on this screen, and
leaves `go`, `bad` and `mute`-as-colour unowned here — consistent with 082, which defined `go` with
no owner on the document pill rail either.

### What this hands on

- [101](101-sim-screen-device-prototype.md) — draws with exactly two chip kinds; **must correct the
  099 prototype's tinted `.chip.on` and dashed `.chip.ghost`**, which are retired above.
- [102](102-sim-input-chip-bar.md) — inherits the five-chip default, the keyed form, the
  value-present rule for the three test levers, and the ruling that **the strip is the control**. It
  still owns chip *copy*, the expand/collapse mechanics, and staleness.
- [104](104-sim-results-line-anatomy.md) — inherits "ok lines carry no mark", the neutral kind/role
  chips, and "condition types are a list, not chips".
- [103](103-sim-deep-layers-placement.md) — inherits that nothing inside a disclosure may be a chip
  that is really a control.

### Open, not blocking

- **`isStackable`** (098: on the wire, unmodelled client-side) passes the test as a bounded enum and
  would make a legitimate neutral chip on a near-miss card. Whether the missed card *wants* it is
  [104](104-sim-results-line-anatomy.md)'s call, not this ticket's.
- **Chip copy is not settled here** — `PLANT` vs `PL`, `CHAN` vs `CHANNEL`, and the date's format are
  [102](102-sim-input-chip-bar.md)'s. This ticket settles only that a key exists and is short and
  uppercase.
