---
status: open
spec: BackOffice 4013 (brief C:\Work\DMSCO\BackOffice\.issues\assets\4011-oms-react-stock-health-brief.md, "Changes" 2026-11-18 (4014))
blocked-by: BO 4014 (door - built), SIS.Stock 073 and 074 (the two Stock Visibility doors)
---

# 913 — Stock health shows the batch book against SAP, and negative stock

## What to build

Two more tiles on the Stock health page ([912](912-stock-health-page.md)), after S8 `drsQueue`, in the same
`GET StockHealth` answer (BackOffice spec 4013, door 4014). The page draws them like S1-S8; the server judges.

- **S9 `batchBookVsSap`** — **Batch book against SAP** / **دفتر الدفعات مقابل SAP**, `link: null`. Figures, in order:
  `Stores compared`, `Stores drifting`, `Drifting batches`, `Failed stores`, `Last run` (time string, or null when it
  never ran).
- **S10 `negativeStock`** — **Negative stock and dummy batch** / **المخزون السالب والدفعة الوهمية**,
  `link: 'oms/held-stock-report/refusals'`. Figures, in order: `Negative batches`, `In blocking stores`,
  `Would-be refusals today`, `Dummy batch quantity` (signed, never a verdict), `Change since yesterday` (signed, or null).
- Both are `verdict: null` when no store is Seeded or Blocking; an older Stock Visibility without the door answers 404,
  which makes that one signal `noAnswer` and nothing else.
- **Arabic:** reasons keyed by `key` + verdict with the figures by position, like S1-S8; where the server joins several
  findings (`watch`, `bad`) the Arabic line carries the figures and appends the server's English line, isolated, as
  `drsQueue` does. AR labels for all ten figure labels.

## Proof

- [x] S9 AR reasons for `null`, `good`, `watch`, `bad` (the "off", "never run", "stale" and joined-findings lines each
  still read, through the isolated server line), and its five AR labels · pure (`health.test.ts`, real i18next)
- [x] S10 AR reasons for `null`, `good`, `watch`, `bad`, and its five AR labels; a signed figure reads as sent · pure
- [x] the two keys are in the model's key list, so the i18n mirror test demands their names and `noAnswer` reasons in
  both locales (`i18n-keys.test.ts`)
- [x] drive (stubbed, LTR/RTL, light/dark): ten tiles, S9 and S10 last with their five figures in order; green (All
  good), amber and red (header counts 2; red S9 says the nightly comparison is off), noAnswer 404 (did not answer,
  outlined, the reason names the door and the 404, the other eight unchanged); S10 links to the refusals leaf, S9 does not
  (`tools/stock-health-drive.mjs`)
- [ ] staging walk, with 912's: both tiles answer once SIS.Stock 073/074 are deployed; S9 is Bad "the nightly
  comparison is off" until `BatchDrift:Nightly` is turned on (spec 4013 D7)

## Boundaries

- No verdict logic in the browser. No change to S1-S8.

## Comments

**2026-11-18 — built (stubbed); the walk is owed with 912's.** Branch `spec/4013-stock-tiles` (off main 3cd6bd47).
`STOCK_HEALTH_KEYS` gains `batchBookVsSap` and `negativeStock`; `locales/{en,ar}/stock-health.json` gain their names,
reasons and labels (EN mirrors the server line, as for every key).

- AR one line per key + verdict cannot carry every EN variant: S9 `bad` is one of off / never run / stale / joined
  findings, so its AR line names those causes, the last run (`{{f5}}`, a dash when it never ran) and appends the server's
  line, which says which. S10 `bad` gives the Blocking negatives out of all negatives; refusals today in Blocking stores are
  not a figure, so only the appended server line names them.
- `Change since yesterday` shows as sent (`2`, `-3`): no `+` sign is added, the page never reformats a number.
- Typecheck green; `npm test` 11147/11147; drive 246/246; lint green but for the pre-existing boundary failure on main
  (`insurance-rules/aliases` imports `insurance-rules/labels`), not this diff.
